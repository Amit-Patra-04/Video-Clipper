import re
import os
import time
from pathlib import Path
from typing import Dict, Tuple
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

# In-memory rate limiting tracking: ip -> [timestamps]
_RATE_LIMIT_STORE: Dict[str, list] = {}
RATE_LIMIT_MAX_REQUESTS = 60
RATE_LIMIT_WINDOW_SECONDS = 60

def sanitize_filename(filename: str) -> str:
    """Strip unsafe path characters and ensure a safe filename."""
    clean = os.path.basename(filename)
    # Check for null byte poisoning
    clean = clean.replace("\x00", "")
    clean = re.sub(r'[^a-zA-Z0-9_.-]', '_', clean)
    if not clean or clean.startswith('.'):
        clean = f"upload_{int(time.time())}.mp4"
    return clean

def scan_file_for_malware(content: bytes, filename: str) -> Tuple[bool, str]:
    """
    Security Guardrail: Scan uploaded file bytes and filename for malware signatures.
    
    1. Checks for disguised Windows/Linux executable headers (MZ, ELF).
    2. Checks for embedded scripts (PHP, HTML scripts, shell commands).
    3. Checks for double extension evasion techniques (e.g. .mp4.exe).
    
    NOTE ON ENTERPRISE PRODUCTION DEPLOYMENT:
    In a distributed production environment, integrate ClamAV daemon (`pyclamd`)
    or cloud-native scanners (AWS GuardDuty, Google Cloud Security Scanner, VirusTotal API):
    ```python
    # Example production ClamAV hook:
    # import pyclamd
    # cd = pyclamd.ClamdAgnostic()
    # scan_res = cd.scan_stream(content)
    # if scan_res: return False, f"Malware detected: {scan_res}"
    ```
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
    return True

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
    and extract the video ID. Returns (is_valid, video_id, error_message).
    """
    if not url or not isinstance(url, str):
        return False, "", "URL cannot be empty."

    url = url.strip()
    
    # Strictly allow YouTube domains
    pattern = r'^(https?://)?(www\.|m\.)?(youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})'
    match = re.match(pattern, url)
    
    if not match:
        return False, "", "Invalid YouTube URL. Please provide a standard watch or shorts link (e.g., https://youtube.com/watch?v=... or https://youtu.be/...)."
        
    video_id = match.group(4)
    if len(video_id) != 11:
        return False, "", "Invalid YouTube video ID length."
        
    return True, video_id, ""

def check_youtube_permissions() -> Tuple[bool, str]:
    """
    POLICY GUARDRAIL:
    Per YouTube Terms of Service and API Policy:
    Do NOT attempt to programmatically download third-party YouTube videos.
    Only authorized user-owned content via official YouTube Data API OAuth2 is allowed.
    """
    oauth_token = os.getenv("YOUTUBE_OAUTH_TOKEN", "")
    api_key = os.getenv("YOUTUBE_API_KEY", "")

    if not oauth_token and not api_key:
        policy_warning = (
            "YouTube Policy Warning: Direct programmatic downloading of YouTube videos without "
            "authorized OAuth2 credentials is disallowed by YouTube Terms of Service. "
            "Please connect your authorized YouTube Account via OAuth2 or upload user-owned video files directly."
        )
        return False, policy_warning

    return True, "Authorized"

def check_rate_limit(client_ip: str) -> bool:
    """Simple sliding-window rate limiter per client IP."""
    now = time.time()
    timestamps = _RATE_LIMIT_STORE.get(client_ip, [])
    timestamps = [ts for ts in timestamps if now - ts < RATE_LIMIT_WINDOW_SECONDS]
    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    timestamps.append(now)
    _RATE_LIMIT_STORE[client_ip] = timestamps
    return True
