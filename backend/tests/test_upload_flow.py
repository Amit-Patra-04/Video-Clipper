import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.db import db_get_job

client = TestClient(app)

def test_upload_valid_mp4(sample_video):
    """Acceptance Criteria: User can upload a .mp4 file; get a job ID response. Backend enqueues a job record."""
    with open(sample_video, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/upload",
        files={"file": ("interview.mp4", io.BytesIO(file_bytes), "video/mp4")}
    )
    assert response.status_code == 200
    data = response.json()

    assert "job_id" in data
    assert data["job_id"].startswith("job_")
    assert data["status"] == "queued"
    assert data["type"] == "file_upload"
    assert "Upload successful, job queued" in data["message"]

    # Verify job record is stored in SQLite DB
    job_record = db_get_job(data["job_id"])
    assert job_record is not None
    assert job_record.video_id == data["video_id"]
    assert job_record.source == "interview.mp4"

    # Also test GET /api/jobs/{job_id} endpoint
    status_resp = client.get(f"/api/jobs/{data['job_id']}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["job_id"] == data["job_id"]
    assert status_data["status"] in ["queued", "processing", "completed"]

def test_upload_endpoint_root_mount(sample_video):
    """Verify POST /upload directly also works."""
    with open(sample_video, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/upload",
        files={"file": ("clip_root.mp4", io.BytesIO(file_bytes), "video/mp4")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"].startswith("job_")

def test_youtube_url_policy_warning_without_permissions():
    """
    Acceptance Criteria:
    User can input a YT URL; if the app has no permissions, display a warning per policy
    (do NOT download it programmatically).
    """
    response = client.post(
        "/api/upload",
        data={"youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
    )
    assert response.status_code == 403
    data = response.json()
    assert "YouTube Policy Warning" in data["detail"]
    assert "Terms of Service" in data["detail"]
    assert "OAuth2" in data["detail"]

def test_youtube_invalid_url_rejected():
    """Verify invalid YouTube links are validated and rejected."""
    response = client.post(
        "/api/upload",
        data={"youtube_url": "https://notyoutube.com/video123"}
    )
    assert response.status_code == 400
    assert "Invalid YouTube URL" in response.json()["detail"]

def test_youtube_url_authorized_queues_job(monkeypatch):
    """Verify authorized YouTube links enqueue background job successfully."""
    monkeypatch.setenv("ALLOW_YOUTUBE_DOWNLOAD", "true")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr("app.worker.pipeline_worker.execute_youtube_pipeline", lambda *args, **kwargs: None)
        response = client.post(
            "/api/upload",
            data={"youtube_url": "https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ&t=10s"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "queued"
        assert data["type"] == "youtube_url"
        assert "Authorized YouTube job queued" in data["message"]
        
        job = db_get_job(data["job_id"])
        assert job is not None
        assert job.job_type == "youtube_url"

def test_malware_scan_rejects_executable():
    """Security Guardrail: Scan uploads for malware headers (e.g. Windows PE executable disguised as mp4)."""
    fake_exe = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 500
    response = client.post(
        "/api/upload",
        files={"file": ("trojan.mp4", io.BytesIO(fake_exe), "video/mp4")}
    )
    assert response.status_code == 400
    assert "Security alert" in response.json()["detail"]
    assert "executable" in response.json()["detail"]

def test_reject_double_extension():
    """Security Guardrail: Detects and rejects dangerous double extension files (e.g. video.exe.mp4)."""
    response = client.post(
        "/api/upload",
        files={"file": ("video.exe.mp4", io.BytesIO(b"fakecontent"), "video/mp4")}
    )
    assert response.status_code == 400
    assert "suspicious" in response.json()["detail"].lower()
    assert ".exe" in response.json()["detail"].lower()
