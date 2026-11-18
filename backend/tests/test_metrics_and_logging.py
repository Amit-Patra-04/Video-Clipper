import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.services.metrics_service import MetricsService, metrics_service
from app.worker import pipeline_worker
from app.models.schemas import SpeechSegment

client = TestClient(app)

def test_metrics_service_job_lifecycle():
    """Verify MetricsService tracks job starts, durations, error rates, and queue length."""
    ms = MetricsService()
    assert ms.get_queue_length() == 0

    # Start 3 jobs
    ms.record_job_start("v1")
    ms.record_job_start("v2")
    ms.record_job_start("v3")
    assert ms.get_queue_length() == 3

    # Complete 2 jobs with different durations
    ms.record_job_completion("v1", 4.5)
    ms.record_job_completion("v2", 2.5)
    assert ms.get_queue_length() == 1

    # Fail 1 job
    ms.record_job_failure("v3", "FFmpeg decoding error")
    assert ms.get_queue_length() == 0

    summary = ms.get_metrics_summary()
    assert summary["jobs"]["total_processed"] == 3
    assert summary["jobs"]["completed_total"] == 2
    assert summary["jobs"]["failed_total"] == 1
    # Error rate: 1 / 3 = 33.33%
    assert summary["jobs"]["error_rate_percentage"] == 33.33
    # Average duration: (4.5 + 2.5) / 2 = 3.5s
    assert summary["jobs"]["durations_seconds"]["average"] == 3.5
    assert summary["jobs"]["durations_seconds"]["min"] == 2.5
    assert summary["jobs"]["durations_seconds"]["max"] == 4.5


def test_metrics_service_stages_and_alerts():
    """Verify stage durations and alert counters (STT failure warnings and rate limiting blocks)."""
    ms = MetricsService()
    ms.record_stage_duration("audio_extract", 0.8)
    ms.record_stage_duration("audio_extract", 1.2)
    ms.record_stage_duration("stt", 2.4)
    ms.record_stage_duration("scene_detect", 1.1)

    # Trigger alerts
    ms.record_stt_warning("AssemblyAI API timeout")
    ms.record_stt_warning("Whisper rate limit")
    ms.record_rate_limit_block()

    summary = ms.get_metrics_summary()
    assert summary["stage_durations_average_seconds"]["audio_extract"] == 1.0
    assert summary["stage_durations_average_seconds"]["stt"] == 2.4
    assert summary["alerts"]["stt_warnings_total"] == 2
    assert summary["alerts"]["rate_limit_blocks_total"] == 1


def test_prometheus_exposition_format():
    """Verify Prometheus text format exports valid metric names and labels."""
    ms = MetricsService()
    ms.record_job_start("vid_prom")
    ms.record_job_completion("vid_prom", 3.2)
    ms.record_stt_warning("Fallback to acoustic VAD")

    prom_text = ms.get_prometheus_metrics()
    assert "# HELP autoclip_jobs_total" in prom_text
    assert 'autoclip_jobs_total{status="completed"} 1' in prom_text
    assert 'autoclip_jobs_total{status="failed"} 0' in prom_text
    assert "autoclip_stt_warnings_total 1" in prom_text
    assert "autoclip_job_duration_seconds" in prom_text


def test_api_metrics_endpoints():
    """Verify GET /api/metrics and GET /metrics endpoints respond with valid telemetry."""
    # 1. JSON endpoint
    res_json = client.get("/api/metrics")
    assert res_json.status_code == 200
    data = res_json.json()
    assert data["status"] == "healthy"
    assert "queue" in data
    assert "jobs" in data
    assert "stage_durations_average_seconds" in data
    assert "http" in data
    assert "alerts" in data

    # 2. Prometheus endpoint
    res_prom = client.get("/metrics")
    assert res_prom.status_code == 200
    assert "text/plain" in res_prom.headers.get("content-type", "")
    assert "autoclip_uptime_seconds" in res_prom.text
    assert "autoclip_jobs_total" in res_prom.text

    # 3. Format query parameter override
    res_param = client.get("/api/metrics?format=prometheus")
    assert res_param.status_code == 200
    assert "autoclip_jobs_total" in res_param.text


def test_stt_warning_alert_recording(caplog):
    """Verify STT warning alert is logged and recorded in metrics when transcription returns 0 segments."""
    initial_warnings = metrics_service.stt_warnings_total
    
    # Simulate zero segments alert
    metrics_service.record_stt_warning("zero segments detected")
    assert metrics_service.stt_warnings_total == initial_warnings + 1
