import re
import os
import time
import html
import threading
import urllib.parse
from pathlib import Path
from typing import Dict, Tuple, Optional, Any
from app.core.config import settings
from app.core.logger import logger

# Magic bytes dictionary for video formats
MAGIC_BYTES = {
    b"\x00\x00\x00 ftyp": "video/mp4",
    b"\x00\x00\x00\x18ftyp": "video/mp4",
    b"\x00\x00\x00\x1cftyp": "video/mp4",
    b"\x00\x00\x00\x20ftyp": "video/mp4",
    b"\x1a\x45\xdf\xa3": "video/webm_or_mkv",
    b"RIFF": "video/avi"
}

# Dangerous executable / shell script signatures for malware scanning
DANGEROUS_SIGNATURES = [
    (b"MZ", "Windows PE executable header (MZ) detected"),
    (b"\x7fELF", "Linux ELF executable binary detected"),
    (b"#!/bin/", "Unix shell script detected"),
    (b"#!/usr/bin/", "Unix shell script detected"),
    (b"<?php", "PHP script code detected"),
    (b"<script", "Embedded HTML script tag detected"),
    (b"powershell", "PowerShell script invocation detected"),
    (b"cmd.exe", "Windows command shell invocation detected")
]

# Disallowed double extensions (e.g., video.mp4.exe)
DANGEROUS_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".js", ".php", ".py", ".msi", ".dll", ".scr"
}

# In-memory rate limiting tracking: (ip, endpoint) -> [timestamps]
_RATE_LIMIT_STORE: Dict[Tuple[str, str], list] = {}
_RATE_LIMIT_LOCK = threading.Lock()
RATE_LIMIT_MAX_REQUESTS = 60
RATE_LIMIT_WINDOW_SECONDS = 60

# Heavy endpoints have strict bursting thresholds to throttle abuse
HEAVY_ENDPOINT_THRESHOLDS = {
    "/upload": 20,
    "/api/upload": 20,
    "/api/export/render": 20,
    "/api/metadata/generate": 30,
    "/api/ingest/upload": 20
}

def sanitize_filename(filename: str) -> str:
    """Strip unsafe path characters and ensure a safe filename."""
    clean = os.path.basename(filename)
    # Check for null byte poisoning and path traversal
    clean = clean.replace("\x00", "")
    clean = clean.replace("..", "_")
    clean = re.sub(r'[^a-zA-Z0-9_.-]', '_', clean)
    if not clean or clean.startswith('.'):
        clean = f"upload_{int(time.time())}.mp4"
    return clean

def sanitize_text(text: str) -> str:
    """
    Sanitize text input against XSS, script injection, and dangerous URI schemes.
    Strips script tags, javascript: links, and HTML entities.
    """
    if not text or not isinstance(text, str):
        return ""
    # Strip null bytes
    cleaned = text.replace("\x00", "")
    # Strip dangerous HTML tags
    cleaned = re.sub(r'(?i)<script[^>]*>.*?</script>', '', cleaned, flags=re.DOTALL)
    cleaned = re.sub(r'(?i)<iframe[^>]*>.*?</iframe>', '', cleaned, flags=re.DOTALL)
    cleaned = re.sub(r'(?i)<object[^>]*>.*?</object>', '', cleaned, flags=re.DOTALL)
    cleaned = re.sub(r'(?i)<embed[^>]*>.*?</embed>', '', cleaned, flags=re.DOTALL)
    cleaned = re.sub(r'(?i)<style[^>]*>.*?</style>', '', cleaned, flags=re.DOTALL)
    # Remove event handlers (onload, onerror, onclick, etc.)
    cleaned = re.sub(r'(?i)\bon\w+\s*=', '', cleaned)
    # Remove javascript: or data: URIs
    cleaned = re.sub(r'(?i)javascript:', '', cleaned)
    cleaned = re.sub(r'(?i)data:text/html', '', cleaned)
    # Entity escape remaining HTML entities
    escaped = html.escape(cleaned.strip())
    return escaped

def validate_export_parameters(payload: Dict[str, Any]) -> Tuple[bool, str]:
    """Validate numeric ranges and categorical values for video render exports."""
    # Aspect Ratio validation
    valid_ratios = {"9:16", "1:1", "16:9", "original"}
    aspect = payload.get("aspect_ratio", "9:16")
    if aspect not in valid_ratios:
        return False, f"Invalid aspect ratio '{aspect}'. Allowed: {', '.join(valid_ratios)}"

    # Transition validation
    valid_transitions = {"cut", "fade", "zoom"}
    transition = payload.get("transition", "cut")
    if transition not in valid_transitions:
        return False, f"Invalid transition '{transition}'. Allowed: {', '.join(valid_transitions)}"

    # Font size validation
    font_size = payload.get("font_size", 28)
    if not isinstance(font_size, (int, float)) or font_size < 12 or font_size > 72:
        return False, "Font size must be between 12 and 72 pt"

    # Start and End timestamps
    start = payload.get("start", 0.0)
    end = payload.get("end", 0.0)
    if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
        return False, "Start and end must be numeric timestamp values"
    if start < 0 or end <= start:
        return False, f"Invalid trim range: start ({start}s) must be non-negative and less than end ({end}s)"

    # Crop X coordinate
    crop_x = payload.get("crop_x")
    if crop_x is not None:
        if not isinstance(crop_x, (int, float)) or crop_x < 0.0 or crop_x > 1.0:
            return False, "crop_x offset must be between 0.0 and 1.0"

    return True, "Valid"

def scan_file_for_malware(content: bytes, filename: str) -> Tuple[bool, str]:
    """
    Security Guardrail: Scan uploaded file bytes and filename for malware signatures.
    1. Checks for disguised Windows/Linux executable headers (MZ, ELF).
    2. Checks for embedded scripts (PHP, HTML scripts, shell commands).
    3. Checks for double extension evasion techniques (e.g. .mp4.exe).
    """
    # 1. Double extension check
    name_parts = filename.lower().split('.')
    if len(name_parts) > 2:
        for ext in name_parts[1:-1]:
            if f".{ext}" in DANGEROUS_EXTENSIONS:
                return False, f"Suspicious multi-extension filename detected (disallowed: .{ext})"
    if Path(filename).suffix.lower() in DANGEROUS_EXTENSIONS:
        return False, f"Disallowed executable extension: {Path(filename).suffix}"

    # 2. Content signature checks
    sample = content[:4096]
    for sig, reason in DANGEROUS_SIGNATURES:
        if sample.startswith(sig) or (sig.startswith(b"<") and sig in sample.lower()):
            logger.warning(f"Malware scan alert on file '{filename}': {reason}")
            return False, f"Security alert: {reason}. Upload rejected."

    return True, "Clean"

def validate_magic_bytes(header: bytes) -> bool:
    """Validate initial file bytes against known video container signatures."""
    if len(header) < 4:
        return False
    # Check webm/mkv
    if header.startswith(b"\x1a\x45\xdf\xa3"):
        return True
    # Check MP4 / MOV ftyp signature (commonly starts at offset 4)
    if b"ftyp" in header[:32]:
        return True
    # Check AVI / RIFF
    if header.startswith(b"RIFF"):
        return True
    return False

def validate_uploaded_file(filename: str, file_size: int, content: bytes = b"") -> Tuple[bool, str]:
    """Validate filename extension, file size, container header, and malware scan."""
    ext = Path(filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        return False, f"Unsupported file extension '{ext}'. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        
    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        return False, f"File size exceeds limit of {max_mb} MB"
        
    # Malware & executable scan
    if content:
        is_clean, scan_msg = scan_file_for_malware(content, filename)
        if not is_clean:
            return False, scan_msg

    # Magic byte check
    header_sample = content[:64] if content else b""
    if header_sample and not validate_magic_bytes(header_sample):
        return False, "Invalid file format signature. Uploaded file is corrupted or not a valid video container."
        
    return True, "Valid"

def validate_youtube_url(url: str) -> Tuple[bool, str, str]:
    """
    Validate that the URL belongs strictly to authorized YouTube endpoints
    and extract the 11-character video ID. Returns (is_valid, video_id, error_message).
    Supports:
    - https://www.youtube.com/watch?v=... (with any query parameters before/after v)
    - https://youtu.be/... (shortened link, with or without query params)
    - https://www.youtube.com/shorts/...
    - https://www.youtube.com/embed/...
    - https://www.youtube.com/live/...
    - Mobile (m.youtube.com) and music (music.youtube.com) endpoints
    """
    if not url or not isinstance(url, str):
        return False, "", "URL cannot be empty."

    url = url.strip()
    
    # Prepend scheme if missing (e.g., youtube.com/watch?v=...)
    if not (url.startswith("http://") or url.startswith("https://")):
        url = "https://" + url

    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False, "", "Invalid URL format."

    hostname = (parsed.hostname or "").lower()
    
    # Strictly allow official YouTube domains
    allowed_domains = {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
        "www.youtu.be"
    }

    if not any(hostname == d or hostname.endswith("." + d) for d in allowed_domains):
        return False, "", "Invalid YouTube URL. Please provide a standard watch or shorts link (e.g., https://youtube.com/watch?v=... or https://youtu.be/...)."

    video_id = ""

    # Case 1: youtu.be/<video_id>
    if "youtu.be" in hostname:
        path_parts = [p for p in parsed.path.split("/") if p]
        if path_parts:
            video_id = path_parts[0]

    # Case 2: youtube.com/watch?v=<video_id> (v can be anywhere in query params)
    elif parsed.path == "/watch" or parsed.path.startswith("/watch"):
        qs = urllib.parse.parse_qs(parsed.query)
        v_list = qs.get("v")
        if v_list and len(v_list) > 0:
            video_id = v_list[0]

    # Case 3: /shorts/<video_id>, /embed/<video_id>, /live/<video_id>
    elif any(parsed.path.startswith(prefix) for prefix in ("/shorts/", "/embed/", "/live/")):
        path_parts = [p for p in parsed.path.split("/") if p]
        if len(path_parts) >= 2:
            video_id = path_parts[1]

    # Fallback regex in case of non-standard path variations on youtube.com
    if not video_id:
        match = re.search(r'(?:v=|\/shorts\/|\/embed\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})', url)
        if match:
            video_id = match.group(1)

    # Validate extracted video_id (strictly 11 chars alphanumeric, dash, or underscore)
    if not video_id or not re.match(r'^[a-zA-Z0-9_-]{11}$', video_id):
        return False, "", "Invalid YouTube video ID length."

    return True, video_id, ""

def check_youtube_permissions() -> Tuple[bool, str]:
    """
    POLICY GUARDRAIL:
    Per YouTube Terms of Service and API Policy:
    Do NOT attempt to programmatically download third-party YouTube videos.
    Only authorized user-owned content via official YouTube Data API OAuth2 is allowed.
    In local development, set ALLOW_YOUTUBE_DOWNLOAD=true to enable downloading user-authorized content.
    """
    oauth_token = os.getenv("YOUTUBE_OAUTH_TOKEN", "")
    api_key = os.getenv("YOUTUBE_API_KEY", "")
    allow_dev = getattr(settings, "ALLOW_YOUTUBE_DOWNLOAD", False) or os.getenv("ALLOW_YOUTUBE_DOWNLOAD", "").lower() in ("true", "1", "yes")

    if not oauth_token and not api_key and not allow_dev:
        policy_warning = (
            "YouTube Policy Warning: Direct programmatic downloading of YouTube videos without "
            "authorized OAuth2 credentials is disallowed by YouTube Terms of Service. "
            "Please connect your authorized YouTube Account via OAuth2 or upload user-owned video files directly."
        )
        return False, policy_warning

    return True, "Authorized"

def get_rate_limit_status(
    client_ip: str,
    endpoint: str = "default",
    max_requests: Optional[int] = None,
    window_seconds: int = RATE_LIMIT_WINDOW_SECONDS
) -> Tuple[bool, int, int]:
    """
    Sliding-window rate limiter per client IP and endpoint category.
    Returns: (is_allowed, remaining_requests, retry_after_seconds)
    """
    if max_requests is None:
        max_requests = HEAVY_ENDPOINT_THRESHOLDS.get(endpoint, RATE_LIMIT_MAX_REQUESTS)

    now = time.time()
    key = (client_ip, endpoint)

    with _RATE_LIMIT_LOCK:
        timestamps = _RATE_LIMIT_STORE.get(key, [])
        # Prune timestamps outside window
        valid_timestamps = [ts for ts in timestamps if now - ts < window_seconds]

        if len(valid_timestamps) >= max_requests:
            oldest = valid_timestamps[0]
            retry_after = max(1, int(window_seconds - (now - oldest)))
            _RATE_LIMIT_STORE[key] = valid_timestamps
            return False, 0, retry_after

        valid_timestamps.append(now)
        _RATE_LIMIT_STORE[key] = valid_timestamps
        remaining = max(0, max_requests - len(valid_timestamps))
        return True, remaining, 0

def check_rate_limit(
    client_ip: str,
    endpoint: str = "default",
    max_requests: Optional[int] = None,
    window_seconds: int = RATE_LIMIT_WINDOW_SECONDS
) -> bool:
    """Convenience boolean check for rate limits."""
    allowed, _, _ = get_rate_limit_status(client_ip, endpoint, max_requests, window_seconds)
    return allowed

def reset_rate_limits():
    """Reset rate limiter store (primarily for unit testing)."""
    with _RATE_LIMIT_LOCK:
        _RATE_LIMIT_STORE.clear()
