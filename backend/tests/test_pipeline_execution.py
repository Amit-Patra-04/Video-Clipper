import os
import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.core.config import settings
from app.core.db import db_create_job, db_get_job
from app.worker import pipeline_worker
from app.services.stt_service import stt_service
from app.services.scene_detector import scene_detector_service
from app.services.ffmpeg_service import ffmpeg_service
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

@pytest.mark.asyncio
async def test_full_pipeline_with_real_video(sample_video):
    """
    Acceptance Criteria:
    - Given a sample video, the pipeline produces a transcript JSON (with words and times).
    - Scene detection returns an array of timecodes for each scene.
    - Pipeline milestones update the job status (e.g. 'Transcribed', 'Scanned Scenes').
    - Transcript and scenes are saved in DB.
    """
    job = db_create_job(
        video_id="vid_test_real_sample",
        job_type="file_upload",
        source="test_sample.mp4",
        file_path=sample_video,
        file_size=os.path.getsize(sample_video),
        mime_type="video/mp4",
        status="queued"
    )
    job_id = job.id

    # Execute full processing pipeline on the real video clip
    success = await pipeline_worker.execute_pipeline(
        video_id="vid_test_real_sample",
        video_path=sample_video,
        title="Test Real Sample",
        job_id=job_id,
        max_retries=1
    )
    assert success is True

    # Check updated Job record in SQLite DB
    updated_job = db_get_job(job_id)
    assert updated_job is not None
    assert updated_job.status == "completed"
    assert updated_job.current_stage == "Completed"
    assert updated_job.progress == 100

    # 1. Verify transcript JSON in DB (with words and times)
    assert updated_job.transcript_json is not None
    transcript_data = json.loads(updated_job.transcript_json)
    assert "segments" in transcript_data
    assert len(transcript_data["segments"]) > 0

    first_seg = transcript_data["segments"][0]
    assert "start" in first_seg
    assert "end" in first_seg
    assert "words" in first_seg
    assert len(first_seg["words"]) > 0
    first_word = first_seg["words"][0]
    assert "word" in first_word
    assert "start" in first_word
    assert "end" in first_word

    # 2. Verify scene detection array of timecodes in DB
    assert updated_job.scenes_json is not None
    scenes_data = json.loads(updated_job.scenes_json)
    assert isinstance(scenes_data, list)
    assert len(scenes_data) > 0

    first_scene = scenes_data[0]
    assert "scene_number" in first_scene
    assert "start_timecode" in first_scene
    assert "end_timecode" in first_scene
    assert "start_seconds" in first_scene
    assert "end_seconds" in first_scene
    assert "duration_seconds" in first_scene

    # 3. Verify API endpoints for transcript and scenes
    resp_transcript = client.get(f"/api/jobs/{job_id}/transcript")
    assert resp_transcript.status_code == 200
    assert "transcript" in resp_transcript.json()

    resp_scenes = client.get(f"/api/jobs/{job_id}/scenes")
    assert resp_scenes.status_code == 200
    assert "scenes" in resp_scenes.json()
    assert resp_scenes.json()["scene_count"] >= 1

@pytest.mark.asyncio
async def test_assemblyai_api_mock(sample_wav):
    """
    Guardrail: Test AssemblyAI API integration with mock HTTP calls.
    Verifies that AssemblyAI word-level timestamps and speaker labels are parsed accurately.
    """
    mock_upload_resp = MagicMock()
    mock_upload_resp.status_code = 200
    mock_upload_resp.json.return_value = {"upload_url": "https://cdn.assemblyai.com/mock-upload"}
    mock_upload_resp.raise_for_status = MagicMock()

    mock_transcript_post = MagicMock()
    mock_transcript_post.status_code = 200
    mock_transcript_post.json.return_value = {"id": "mock_assemblyai_job_123"}
    mock_transcript_post.raise_for_status = MagicMock()

    mock_poll_resp = MagicMock()
    mock_poll_resp.status_code = 200
    mock_poll_resp.json.return_value = {
        "status": "completed",
        "text": "Hello world from AssemblyAI.",
        "utterances": [
            {
                "speaker": "A",
                "start": 0,
                "end": 2500,
                "text": "Hello world from AssemblyAI.",
                "words": [
                    {"text": "Hello", "start": 0, "end": 600, "confidence": 0.99},
                    {"text": "world", "start": 700, "end": 1400, "confidence": 0.98},
                    {"text": "from", "start": 1500, "end": 1800, "confidence": 0.95},
                    {"text": "AssemblyAI", "start": 1900, "end": 2500, "confidence": 0.97}
                ]
            }
        ],
        "words": []
    }
    mock_poll_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", side_effect=[mock_upload_resp, mock_transcript_post]), \
         patch("httpx.AsyncClient.get", return_value=mock_poll_resp):
        
        # Inject temporary key for test
        original_key = stt_service.assemblyai_key
        stt_service.assemblyai_key = "test_assemblyai_token"

        try:
            result = await stt_service.transcribe_audio(sample_wav)
            assert result["text"] == "Hello world from AssemblyAI."
            assert len(result["segments"]) == 1
            seg = result["segments"][0]
            assert seg.speaker == "Speaker A"
            assert len(seg.words) == 4
            assert seg.words[0].word == "Hello"
            assert seg.words[0].start == 0.0
            assert seg.words[0].end == 0.6
        finally:
            stt_service.assemblyai_key = original_key

@pytest.mark.asyncio
async def test_openai_whisper_api_mock(sample_wav):
    """
    Guardrail: Test OpenAI Whisper API integration with mock HTTP calls.
    Verifies that word timestamps from Whisper verbose JSON are parsed.
    """
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "text": "The quick brown fox jumps over the lazy dog.",
        "segments": [
            {
                "id": 0,
                "start": 0.0,
                "end": 3.0,
                "text": "The quick brown fox jumps over the lazy dog."
            }
        ],
        "words": [
            {"word": "The", "start": 0.0, "end": 0.3},
            {"word": "quick", "start": 0.3, "end": 0.7},
            {"word": "brown", "start": 0.7, "end": 1.2}
        ]
    }
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        original_key = stt_service.openai_key
        stt_service.openai_key = "test_openai_key"

        try:
            result = await stt_service._transcribe_openai(sample_wav)
            assert "The quick brown fox" in result["text"]
            assert len(result["segments"]) == 1
            words = result["segments"][0].words
            assert len(words) == 3
            assert words[0].word == "The"
            assert words[1].word == "quick"
        finally:
            stt_service.openai_key = original_key

@pytest.mark.asyncio
async def test_worker_retries_on_transient_failure(sample_video):
    """
    Acceptance Criteria: Worker handles failures with retries and logging.
    Simulate a failure on first attempt that succeeds on second attempt.
    """
    job = db_create_job(
        video_id="vid_test_retry",
        job_type="file_upload",
        source="retry.mp4",
        status="queued"
    )

    call_count = {"count": 0}
    real_extract = ffmpeg_service.extract_audio

    def flaky_audio_extract(v_path, out_wav):
        call_count["count"] += 1
        if call_count["count"] == 1:
            raise RuntimeError("Transient FFmpeg lock error on attempt 1")
        # Second call succeeds
        return real_extract(v_path, out_wav)

    with patch.object(ffmpeg_service, "extract_audio", side_effect=flaky_audio_extract):
        # Override sleep to run test fast
        with patch("asyncio.sleep", new_callable=AsyncMock):
            success = await pipeline_worker.execute_pipeline(
                video_id="vid_test_retry",
                video_path=sample_video,
                title="Retry Test",
                job_id=job.id,
                max_retries=3
            )
            assert success is True
            assert call_count["count"] == 2

            # Check DB updated retry count and completed status
            db_job = db_get_job(job.id)
            assert db_job.status == "completed"
            assert db_job.retry_count == 1

@pytest.mark.asyncio
async def test_worker_handles_fatal_failure_after_exhausting_retries(sample_video):
    """
    Acceptance Criteria: Worker marks job as failed and logs error if all retries fail.
    """
    job = db_create_job(
        video_id="vid_test_fatal",
        job_type="file_upload",
        source="fatal.mp4",
        status="queued"
    )

    with patch.object(ffmpeg_service, "extract_audio", side_effect=RuntimeError("Fatal corrupted audio stream")):
        with patch("asyncio.sleep", new_callable=AsyncMock):
            success = await pipeline_worker.execute_pipeline(
                video_id="vid_test_fatal",
                video_path=sample_video,
                title="Fatal Test",
                job_id=job.id,
                max_retries=2
            )
            assert success is False

            db_job = db_get_job(job.id)
            assert db_job.status == "failed"
            assert db_job.current_stage == "Failed"
            assert "Fatal corrupted audio stream" in db_job.error
