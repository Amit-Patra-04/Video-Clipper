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
