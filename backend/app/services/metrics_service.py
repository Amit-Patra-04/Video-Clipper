import time
import threading
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

class MetricsService:
    """
    In-memory metrics collector and exporter.
    Tracks job execution durations, error rates, active queue lengths,
    pipeline stage timings, HTTP telemetry, and alert counters.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self.start_time = time.time()
        
        # Pipeline Job Metrics
        self.jobs_started_total: int = 0
        self.jobs_completed_total: int = 0
        self.jobs_failed_total: int = 0
        self.job_durations: List[float] = [] # durations in seconds
        
        # Stage Durations (seconds)
        self.stage_durations: Dict[str, List[float]] = {
            "audio_extract": [],
            "stt": [],
            "diarize": [],
            "scene_detect": [],
            "highlight_ranking": []
        }
        
        # Alert & Health Counters
        self.stt_warnings_total: int = 0
        self.rate_limit_blocks_total: int = 0
        
        # HTTP Telemetry
        self.http_requests_total: int = 0
        self.http_status_codes: Dict[int, int] = {}
        self.http_latencies: List[float] = []

    def record_job_start(self, video_id: str):
        with self._lock:
            self.jobs_started_total += 1

    def record_job_completion(self, video_id: str, duration_seconds: float):
        with self._lock:
            self.jobs_completed_total += 1
            self.job_durations.append(round(duration_seconds, 3))
            # Keep last 500 durations for memory bounding
            if len(self.job_durations) > 500:
                self.job_durations = self.job_durations[-500:]

    def record_job_failure(self, video_id: str, error_message: str):
        with self._lock:
            self.jobs_failed_total += 1

    def record_stage_duration(self, stage: str, duration_seconds: float):
        with self._lock:
            if stage not in self.stage_durations:
                self.stage_durations[stage] = []
            self.stage_durations[stage].append(round(duration_seconds, 3))
            if len(self.stage_durations[stage]) > 200:
                self.stage_durations[stage] = self.stage_durations[stage][-200:]

    def record_stt_warning(self, reason: str = ""):
        """Trigger alert counter for STT fallback or failure."""
        with self._lock:
            self.stt_warnings_total += 1

    def record_rate_limit_block(self):
        with self._lock:
            self.rate_limit_blocks_total += 1

    def record_http_request(self, method: str, path: str, status_code: int, duration_ms: float):
        with self._lock:
            self.http_requests_total += 1
            self.http_status_codes[status_code] = self.http_status_codes.get(status_code, 0) + 1
            self.http_latencies.append(round(duration_ms, 2))
            if len(self.http_latencies) > 500:
                self.http_latencies = self.http_latencies[-500:]

    def get_queue_length(self) -> int:
        """Calculate active + queued pipeline jobs."""
        with self._lock:
            # Active jobs = started - (completed + failed)
            active = max(0, self.jobs_started_total - (self.jobs_completed_total + self.jobs_failed_total))
            return active

    def get_metrics_summary(self) -> Dict[str, Any]:
        """Produce structured JSON metrics dictionary."""
        with self._lock:
            total_finished = self.jobs_completed_total + self.jobs_failed_total
            error_rate = round((self.jobs_failed_total / total_finished * 100), 2) if total_finished > 0 else 0.0

            avg_duration = round(sum(self.job_durations) / len(self.job_durations), 3) if self.job_durations else 0.0
            min_duration = min(self.job_durations) if self.job_durations else 0.0
            max_duration = max(self.job_durations) if self.job_durations else 0.0
            latest_duration = self.job_durations[-1] if self.job_durations else 0.0

            avg_stage_durations = {}
            for stage, durations in self.stage_durations.items():
                avg_stage_durations[stage] = round(sum(durations) / len(durations), 3) if durations else 0.0

            active_queue = max(0, self.jobs_started_total - total_finished)

            status_2xx = sum(count for code, count in self.http_status_codes.items() if 200 <= code < 300)
            status_4xx = sum(count for code, count in self.http_status_codes.items() if 400 <= code < 500)
            status_5xx = sum(count for code, count in self.http_status_codes.items() if 500 <= code < 600)

            return {
                "status": "healthy",
                "uptime_seconds": round(time.time() - self.start_time, 2),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "queue": {
                    "active_queue_length": active_queue,
                    "jobs_started_total": self.jobs_started_total
                },
                "jobs": {
                    "total_processed": total_finished,
                    "completed_total": self.jobs_completed_total,
                    "failed_total": self.jobs_failed_total,
                    "error_rate_percentage": error_rate,
                    "durations_seconds": {
                        "average": avg_duration,
                        "min": min_duration,
                        "max": max_duration,
                        "latest": latest_duration
                    }
                },
                "stage_durations_average_seconds": avg_stage_durations,
                "http": {
                    "requests_total": self.http_requests_total,
                    "status_2xx": status_2xx,
                    "status_4xx": status_4xx,
                    "status_5xx": status_5xx,
                    "status_breakdown": self.http_status_codes
                },
                "alerts": {
                    "stt_warnings_total": self.stt_warnings_total,
                    "rate_limit_blocks_total": self.rate_limit_blocks_total
                }
            }

    def get_prometheus_metrics(self) -> str:
        """Format metrics as Prometheus plain text exposition format."""
        summary = self.get_metrics_summary()
        lines = [
            "# HELP autoclip_uptime_seconds Total application uptime in seconds",
            "# TYPE autoclip_uptime_seconds gauge",
            f"autoclip_uptime_seconds {summary['uptime_seconds']}",
            "",
            "# HELP autoclip_queue_length Current count of actively running and queued pipeline jobs",
            "# TYPE autoclip_queue_length gauge",
            f"autoclip_queue_length {summary['queue']['active_queue_length']}",
            "",
            "# HELP autoclip_jobs_total Total video processing jobs by terminal status",
            "# TYPE autoclip_jobs_total counter",
            f'autoclip_jobs_total{{status="completed"}} {summary["jobs"]["completed_total"]}',
            f'autoclip_jobs_total{{status="failed"}} {summary["jobs"]["failed_total"]}',
            "",
            "# HELP autoclip_job_error_rate_percentage Percentage of jobs ending in failure",
            "# TYPE autoclip_job_error_rate_percentage gauge",
            f"autoclip_job_error_rate_percentage {summary['jobs']['error_rate_percentage']}",
            "",
            "# HELP autoclip_job_duration_seconds Average processing duration per job in seconds",
            "# TYPE autoclip_job_duration_seconds gauge",
            f"autoclip_job_duration_seconds {summary['jobs']['durations_seconds']['average']}",
            "",
            "# HELP autoclip_stt_warnings_total Alert count for Speech-To-Text transcription failures or fallbacks",
            "# TYPE autoclip_stt_warnings_total counter",
            f"autoclip_stt_warnings_total {summary['alerts']['stt_warnings_total']}",
            "",
            "# HELP autoclip_rate_limit_blocks_total Count of requests throttled by rate limiter",
            "# TYPE autoclip_rate_limit_blocks_total counter",
            f"autoclip_rate_limit_blocks_total {summary['alerts']['rate_limit_blocks_total']}",
            "",
            "# HELP autoclip_http_requests_total Total HTTP requests handled",
            "# TYPE autoclip_http_requests_total counter",
            f"autoclip_http_requests_total {summary['http']['requests_total']}"
        ]
        return "\n".join(lines) + "\n"

metrics_service = MetricsService()
