import pytest
from unittest.mock import patch, MagicMock
from app.core.security import (
    sanitize_filename,
    validate_uploaded_file,
    validate_youtube_url,
    check_rate_limit,
    reset_rate_limits
)
from app.services.ingestion_service import ingestion_service
import yt_dlp

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
    reset_rate_limits()
    ip = "192.168.1.100"
    for _ in range(60):
        assert check_rate_limit(ip) is True
    # 61st call in same window should trigger limit
    assert check_rate_limit(ip) is False


def test_ingestion_service_handle_file_upload(tmp_path):
    """Test IngestionService handle_file_upload with duration check."""
    # Invalid extension
    with pytest.raises(ValueError, match="Unsupported file extension"):
        ingestion_service.handle_file_upload("bad.exe", b"MZexecutable")

    # Exceeding duration
    dummy_video_bytes = b"\x00\x00\x00\x20ftypmp42" + b"\x00" * 500
    with patch("app.services.ffmpeg_service.ffmpeg_service.probe_video") as mock_probe:
        mock_probe.return_value = {
            "duration": 15000.0, # exceeds 10800s max
            "width": 1920,
            "height": 1080,
            "fps": 30.0,
            "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
            "size_bytes": 1024
        }
        with pytest.raises(ValueError, match="exceeds the maximum allowed limit"):
            ingestion_service.handle_file_upload("long_video.mp4", dummy_video_bytes)


def test_ingestion_service_youtube_restrictions():
    """Verify YouTube ingestion handles live streams, private videos, and age-restrictions."""
    # Invalid URL
    with pytest.raises(ValueError, match="Invalid YouTube URL"):
        ingestion_service.handle_youtube_download("https://invalid.com/video")

    # Live stream error
    with patch("yt_dlp.YoutubeDL") as MockYDL:
        instance = MockYDL.return_value.__enter__.return_value
        instance.extract_info.return_value = {"duration": 60, "is_live": True}
        with pytest.raises(ValueError, match="Live streams cannot be processed"):
            ingestion_service.handle_youtube_download("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    # Private / needs auth video
    with patch("yt_dlp.YoutubeDL") as MockYDL:
        instance = MockYDL.return_value.__enter__.return_value
        instance.extract_info.return_value = {"duration": 60, "is_live": False, "availability": "needs_auth"}
        with pytest.raises(PermissionError, match="Video is private"):
            ingestion_service.handle_youtube_download("https://www.youtube.com/watch?v=dQw4w9WgXcQ")

    # Age-restricted DownloadError
    with patch("yt_dlp.YoutubeDL") as MockYDL:
        instance = MockYDL.return_value.__enter__.return_value
        instance.extract_info.side_effect = yt_dlp.utils.DownloadError("Sign in to confirm your age")
        with pytest.raises(PermissionError, match="age-restricted"):
            ingestion_service.handle_youtube_download("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
