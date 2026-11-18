import pytest
from app.core.security import (
    sanitize_filename,
    validate_uploaded_file,
    validate_youtube_url,
    check_rate_limit
)
from app.services.ingestion_service import ingestion_service

def test_sanitize_filename():
    assert sanitize_filename("../../../malicious_file.mp4") == "malicious_file.mp4"
    assert sanitize_filename("safe_video.mp4") == "safe_video.mp4"
    assert sanitize_filename("special%#*chars.mov") == "special___chars.mov"
    assert sanitize_filename("") != ""

def test_validate_uploaded_file():
    # Valid mp4
    is_valid, _ = validate_uploaded_file("clip.mp4", 1024 * 1024, b"\x00\x00\x00\x20ftypmp42")
    assert is_valid is True

    # Bad extension
    is_valid, err = validate_uploaded_file("script.exe", 1024, b"MZ")
    assert is_valid is False
    assert "Unsupported file extension" in err

    # Exceeding size
    huge_size = 600 * 1024 * 1024  # 600 MB
    is_valid, err = validate_uploaded_file("huge.mp4", huge_size, b"\x00\x00\x00\x20ftyp")
    assert is_valid is False
    assert "exceeds limit" in err

def test_validate_youtube_url():
    # Valid standard watch URL
    valid, vid_id, err = validate_youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert valid is True
    assert vid_id == "dQw4w9WgXcQ"

    # Valid youtu.be short link
    valid, vid_id, err = validate_youtube_url("https://youtu.be/dQw4w9WgXcQ")
    assert valid is True
    assert vid_id == "dQw4w9WgXcQ"

    # Valid Shorts URL
    valid, vid_id, err = validate_youtube_url("https://youtube.com/shorts/dQw4w9WgXcQ")
    assert valid is True
    assert vid_id == "dQw4w9WgXcQ"

    # Invalid domain
    valid, _, err = validate_youtube_url("https://vimeo.com/123456789")
    assert valid is False
    assert "Invalid YouTube URL" in err

def test_rate_limiting():
    ip = "192.168.1.100"
    for _ in range(60):
        assert check_rate_limit(ip) is True
    # 61st call in same second should trigger limit
    assert check_rate_limit(ip) is False
