import os
import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.worker import pipeline_worker
from app.models.schemas import VideoMetadata

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_upload_endpoint(sample_video):
    with open(sample_video, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/ingest/upload",
        files={"file": ("sample.mp4", io.BytesIO(file_bytes), "video/mp4")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "video_id" in data
    assert data["status"] == "ingested"

    # Check status endpoint
    video_id = data["video_id"]
    status_resp = client.get(f"/api/pipeline/{video_id}/status")
    assert status_resp.status_code == 200
    assert status_resp.json()["video_id"] == video_id

def test_metadata_generate_endpoint():
    # Inject dummy metadata into worker for test
    pipeline_worker.metadata_store["mock_vid"] = VideoMetadata(
        video_id="mock_vid",
        filename="test_video.mp4",
        file_path="/tmp/test.mp4",
        duration=60.0,
        width=1920,
        height=1080,
        fps=30.0,
        format_name="mp4",
        size_bytes=1000000
    )

    response = client.post(
        "/api/metadata/generate",
        json={"video_id": "mock_vid"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["titles"]) > 0
    assert "description" in data

def test_export_render_and_download_flow(sample_video):
    """
    Acceptance Criteria:
    - Exported video reflects edits (tested on sample clip).
    - Final video download link works.
    - Transitions & crop applied without error.
    """
    video_id = "vid_export_flow_test"
    pipeline_worker.metadata_store[video_id] = VideoMetadata(
        video_id=video_id,
        filename="sample.mp4",
        file_path=sample_video,
        duration=4.0,
        width=640,
        height=360,
        fps=30.0,
        format_name="mp4",
        size_bytes=os.path.getsize(sample_video)
    )

    export_payload = {
        "video_id": video_id,
        "start": 0.5,
        "end": 2.5,
        "aspect_ratio": "9:16",
        "transition": "fade",
        "burn_captions": False,
        "audio_normalize": True
    }

    render_resp = client.post("/api/export/render", json=export_payload)
    assert render_resp.status_code == 200
    render_data = render_resp.json()
    assert render_data["status"] == "completed"
    assert render_data["duration"] == 2.0
    assert render_data["download_url"].startswith("/api/export/")

    export_id = render_data["export_id"]

    # Test download endpoint
    dl_resp = client.get(f"/api/export/{export_id}/download")
    assert dl_resp.status_code == 200
    assert dl_resp.headers["content-type"] == "video/mp4"
    assert len(dl_resp.content) > 1000
