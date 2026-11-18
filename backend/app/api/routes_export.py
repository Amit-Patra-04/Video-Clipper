import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.core.config import settings
from app.core.security import validate_export_parameters, sanitize_filename
from app.models.schemas import ExportRequest, ExportResponse
from app.services.export_service import export_service
from app.worker import pipeline_worker

router = APIRouter(prefix="/export", tags=["Export"])

@router.post("/render", response_model=ExportResponse)
def render_clip(req: ExportRequest):
    """Render and export a trimmed, reframed clip with optional kinetic burned subtitles."""
    # Input validation on export parameters
    is_valid, err_msg = validate_export_parameters(req.model_dump())
    if not is_valid:
        raise HTTPException(status_code=422, detail=f"Invalid export parameters: {err_msg}")

    meta = pipeline_worker.get_metadata(req.video_id)
    if not meta or not os.path.exists(meta.file_path):
        raise HTTPException(status_code=404, detail="Source video not found on disk.")

    segments = pipeline_worker.get_transcripts(req.video_id)
    try:
        res = export_service.render_export(
            req=req,
            input_video_path=meta.file_path,
            segments=segments
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export rendering failed: {str(e)}")

@router.get("/{export_id}/download")
def download_rendered_clip(export_id: str):
    """Download the finished MP4 video clip."""
    # Path traversal guardrail
    if ".." in export_id or "/" in export_id or "\\" in export_id:
        raise HTTPException(status_code=400, detail="Invalid export identifier.")

    clean_id = sanitize_filename(export_id)
    # Find file starting with clean_id
    matches = list(settings.EXPORTS_DIR.glob(f"{clean_id}*.mp4"))
    if not matches:
        raise HTTPException(status_code=404, detail="Exported video file not found.")

    file_path = str(matches[0])
    return FileResponse(
        path=file_path,
        media_type="video/mp4",
        filename=os.path.basename(file_path)
    )
