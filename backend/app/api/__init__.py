from app.api.routes_ingest import router as ingest_router
from app.api.routes_pipeline import router as pipeline_router
from app.api.routes_clips import router as clips_router
from app.api.routes_metadata import router as metadata_router
from app.api.routes_export import router as export_router
from app.api.routes_upload import router as upload_router
from app.api.routes_metrics import router as metrics_router

__all__ = [
    "ingest_router",
    "pipeline_router",
    "clips_router",
    "metadata_router",
    "export_router",
    "upload_router",
    "metrics_router"
]
