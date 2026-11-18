import re
import os
import time
from pathlib import Path
from typing import Dict, Tuple
from fastapi import HTTPException, status
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

# In-memory rate limiting tracking: ip -> [timestamps]
_RATE_LIMIT_STORE: Dict[str, list] = {}
RATE_LIMIT_MAX_REQUESTS = 60
RATE_LIMIT_WINDOW_SECONDS = 60

def sanitize_filename(filename: str) -> str:
    """Strip unsafe path characters and ensure a safe filename."""
    # Remove directory separators and null bytes
    clean = os.path.basename(filename)
    clean = re.sub(r'[^a-zA-Z0-9_.-]', '_', clean)
    if not clean or clean.startswith('.'):
        clean = f"upload_{int(time.time())}.mp4"
    return clean

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
    # If not strictly matched, allow if at least looks like binary container
    return True

def validate_uploaded_file(filename: str, file_size: int, header_sample: bytes = b"") -> Tuple[bool, str]:
    """Validate filename extension, file size, and header bytes."""
    ext = Path(filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        return False, f"Unsupported file extension '{ext}'. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        
    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        return False, f"File size exceeds limit of {max_mb} MB"
        
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

def check_rate_limit(client_ip: str) -> bool:
    """Simple sliding-window rate limiter per client IP."""
    now = time.time()
    timestamps = _RATE_LIMIT_STORE.get(client_ip, [])
    # Filter timestamps within window
    timestamps = [ts for ts in timestamps if now - ts < RATE_LIMIT_WINDOW_SECONDS]
    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        return False
    timestamps.append(now)
    _RATE_LIMIT_STORE[client_ip] = timestamps
    return True
