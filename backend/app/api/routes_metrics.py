from fastapi import APIRouter, Request, Response
from fastapi.responses import PlainTextResponse
from app.services.metrics_service import metrics_service

router = APIRouter(tags=["Metrics & Telemetry"])

@router.get("/metrics")
async def get_prometheus_metrics(request: Request):
    """
    Exposes metrics at /metrics.
    Returns Prometheus plain-text exposition format by default,
    or structured JSON if application/json is requested.
    """
    accept = request.headers.get("accept", "")
    fmt = request.query_params.get("format", "").lower()
    if fmt == "json" or "application/json" in accept:
        return metrics_service.get_metrics_summary()
    return PlainTextResponse(metrics_service.get_prometheus_metrics(), media_type="text/plain; version=0.0.4")

@router.get("/api/metrics")
async def get_json_metrics(request: Request):
    """
    Exposes metrics at /api/metrics.
    Returns structured JSON by default,
    or Prometheus plain-text format if format=prometheus is requested.
    """
    fmt = request.query_params.get("format", "").lower()
    accept = request.headers.get("accept", "")
    if fmt == "prometheus" or ("text/plain" in accept and "application/json" not in accept):
        return PlainTextResponse(metrics_service.get_prometheus_metrics(), media_type="text/plain; version=0.0.4")
    return metrics_service.get_metrics_summary()
