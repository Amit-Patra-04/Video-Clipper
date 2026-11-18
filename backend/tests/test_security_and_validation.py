import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.core.logger import mask_sensitive_data, SensitiveDataFilter
from app.core.security import (
    sanitize_filename,
    sanitize_text,
    validate_export_parameters,
    scan_file_for_malware,
    validate_magic_bytes,
    validate_uploaded_file,
    validate_youtube_url,
    check_youtube_permissions,
    get_rate_limit_status,
    check_rate_limit,
    reset_rate_limits
)
from app.core.middleware import mask_ip_address

client = TestClient(app)

def test_sanitize_filename_security():
    """Verify filename sanitization prevents path traversal and null-byte injection."""
    assert sanitize_filename("../../etc/passwd") == "passwd"
    assert sanitize_filename("..\\..\\boot.ini") == "boot.ini"
    assert sanitize_filename("video\x00.mp4") == "video.mp4"
    assert sanitize_filename("my video clip (2026)!.mp4") == "my_video_clip__2026__.mp4"
    # Leading dot or empty fallback
    fallback = sanitize_filename(".hidden_file")
    assert fallback.endswith(".mp4")
    assert not fallback.startswith(".")


def test_sanitize_text_xss_protection():
    """Verify text input sanitization strips dangerous script injection and malicious events."""
    dirty_html = "<script>alert('pwned')</script>Hello World"
    assert sanitize_text(dirty_html) == "Hello World"

    dirty_event = '<img src="x" onerror="stealCookies()">'
    clean = sanitize_text(dirty_event)
    assert "onerror" not in clean
    assert "stealCookies" in clean  # text retained, script hook stripped

    dirty_iframe = '<iframe src="javascript:alert(1)"></iframe>Valid Text'
    assert sanitize_text(dirty_iframe) == "Valid Text"

    empty_res = sanitize_text(None)
    assert empty_res == ""


def test_validate_export_parameters():
    """Verify export parameter constraints for aspect ratio, transition, and timestamps."""
    # Valid export
    valid_payload = {
        "aspect_ratio": "9:16",
        "transition": "fade",
        "font_size": 28,
        "start": 5.0,
        "end": 25.0,
        "crop_x": 0.5
    }
    is_valid, err = validate_export_parameters(valid_payload)
    assert is_valid is True

    # Invalid aspect ratio
    bad_aspect = dict(valid_payload, aspect_ratio="4:3")
    is_valid, err = validate_export_parameters(bad_aspect)
    assert is_valid is False
    assert "aspect ratio" in err

    # Invalid transition
    bad_transition = dict(valid_payload, transition="dissolve")
    is_valid, err = validate_export_parameters(bad_transition)
    assert is_valid is False
    assert "transition" in err

    # Invalid font size
    bad_font = dict(valid_payload, font_size=100)
    is_valid, err = validate_export_parameters(bad_font)
    assert is_valid is False
    assert "Font size" in err

    # Invalid timestamps: start >= end
    bad_times = dict(valid_payload, start=30.0, end=10.0)
    is_valid, err = validate_export_parameters(bad_times)
    assert is_valid is False
    assert "start (30.0s) must be non-negative and less than end" in err

    # Invalid crop_x
    bad_crop = dict(valid_payload, crop_x=1.8)
    is_valid, err = validate_export_parameters(bad_crop)
    assert is_valid is False
    assert "crop_x" in err


def test_malware_scan_and_double_extensions():
    """Verify malware detection blocks executables, script injections, and multi-extension tricks."""
    # Windows MZ header
    is_clean, msg = scan_file_for_malware(b"MZ\x90\x00\x03\x00\x00\x00", "video.mp4")
    assert is_clean is False
    assert "Windows PE executable" in msg

    # Linux ELF header
    is_clean, msg = scan_file_for_malware(b"\x7fELF\x02\x01\x01\x00", "sample.mp4")
    assert is_clean is False
    assert "Linux ELF executable" in msg

    # Shell script signature
    is_clean, msg = scan_file_for_malware(b"#!/bin/bash\nrm -rf /", "clip.mp4")
    assert is_clean is False
    assert "Unix shell script" in msg

    # Dangerous double extension
    is_clean, msg = scan_file_for_malware(b"\x00\x00\x00\x20ftypmp42", "clip.exe.mp4")
    assert is_clean is False
    assert "multi-extension" in msg

    # Normal video bytes
    is_clean, msg = scan_file_for_malware(b"\x00\x00\x00\x20ftypisom", "clean_video.mp4")
    assert is_clean is True


def test_validate_magic_bytes():
    """Verify container magic byte checks for MP4, WebM/MKV, and AVI."""
    # Valid MP4 ftyp
    assert validate_magic_bytes(b"\x00\x00\x00\x20ftypmp42") is True
    # Valid WebM
    assert validate_magic_bytes(b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81") is True
    # Valid AVI
    assert validate_magic_bytes(b"RIFF\x24\x00\x00\x00AVI ") is True
    # Corrupted / text
    assert validate_magic_bytes(b"This is not a video file at all") is False
    assert validate_magic_bytes(b"") is False


def test_validate_youtube_url_policy():
    """Verify YouTube link format parser accepts official formats and rejects disallowed ones."""
    # Standard watch
    valid, vid, err = validate_youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert valid is True
    assert vid == "dQw4w9WgXcQ"

    # Shorts URL
    valid, vid, err = validate_youtube_url("https://youtube.com/shorts/3JZ_D3ELwOQ")
    assert valid is True
    assert vid == "3JZ_D3ELwOQ"

    # Shortened youtu.be
    valid, vid, err = validate_youtube_url("https://youtu.be/dQw4w9WgXcQ")
    assert valid is True
    assert vid == "dQw4w9WgXcQ"

    # Disallowed external domain
    valid, vid, err = validate_youtube_url("https://vimeo.com/123456789")
    assert valid is False
    assert "Invalid YouTube URL" in err


def test_youtube_permissions_guardrail():
    """Verify policy guardrail refuses programmatic downloads without OAuth credentials."""
    with patch.dict("os.environ", {}, clear=True):
        is_auth, msg = check_youtube_permissions()
        assert is_auth is False
        assert "YouTube Policy Warning" in msg

    with patch.dict("os.environ", {"YOUTUBE_OAUTH_TOKEN": "valid_token_xyz"}):
        is_auth, msg = check_youtube_permissions()
        assert is_auth is True


def test_sensitive_data_logger_masking():
    """Verify PII, tokens, passwords, and API keys are redacted before logging."""
    # Bearer token
    assert "[REDACTED_TOKEN]" in mask_sensitive_data("Authorization: Bearer secret_token_1234567890abcdef")
    # OpenAI key
    assert "[REDACTED_OPENAI_KEY]" in mask_sensitive_data("API key is sk-1234567890abcdefghijklmnop")
    # Google API key
    assert "[REDACTED_GOOGLE_KEY]" in mask_sensitive_data("Connecting with AIzaSyD1234567890abcdefghijklmnop12345")
    # Email PII
    assert "[REDACTED_EMAIL]" in mask_sensitive_data("User email: creator@youtube.com uploaded file")
    # IPv4 address masking
    assert "192.168.1.xxx" in mask_sensitive_data("Request from 192.168.1.42 completed")
    # Password field
    assert "password=[REDACTED]" in mask_sensitive_data('{"user": "admin", "password": "SuperSecretPassword123!"}')


def test_rate_limiter_throttling():
    """Verify rate limiter blocks bursts above threshold and reports retry_after."""
    reset_rate_limits()
    ip = "192.0.2.1"
    endpoint = "/test/burst"

    # Allow up to 3 requests
    for i in range(3):
        allowed, remaining, retry_after = get_rate_limit_status(ip, endpoint=endpoint, max_requests=3, window_seconds=10)
        assert allowed is True

    # 4th request must be throttled
    allowed, remaining, retry_after = get_rate_limit_status(ip, endpoint=endpoint, max_requests=3, window_seconds=10)
    assert allowed is False
    assert remaining == 0
    assert retry_after > 0


def test_security_headers_middleware():
    """Verify production-grade security headers are attached to all API responses."""
    response = client.get("/health")
    assert response.status_code == 200
    headers = response.headers

    assert "max-age=31536000" in headers.get("Strict-Transport-Security", "")
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("X-XSS-Protection") == "1; mode=block"
    assert "strict-origin-when-cross-origin" in headers.get("Referrer-Policy", "")
    assert "default-src 'self'" in headers.get("Content-Security-Policy", "")
    assert "X-Request-ID" in headers
    assert "X-Response-Time" in headers


def test_https_redirect_in_production():
    """Verify HTTP requests are redirected to HTTPS when running in production."""
    with patch.object(settings, "ENVIRONMENT", "production"):
        # Simulate non-HTTPS request with x-forwarded-proto = http
        response = client.get("/health", headers={"x-forwarded-proto": "http"}, follow_redirects=False)
        assert response.status_code == 308
        assert response.headers["location"].startswith("https://")
