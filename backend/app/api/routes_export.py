import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.core.config import settings
from app.models.schemas import ExportRequest, ExportResponse
from app.services.export_service import export_service
from app.worker import pipeline_worker

router = APIRouter(prefix="/export", tags=["Export"])

@router.post("/render", response_model=ExportResponse)
def render_clip(req: ExportRequest):
    """Render and export a trimmed, reframed clip with optional kinetic burned subtitles."""
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
    # Find file starting with export_id
    matches = list(settings.EXPORTS_DIR.glob(f"{export_id}*.mp4"))
    if not matches:
        raise HTTPException(status_code=404, detail="Exported video file not found.")

    file_path = str(matches[0])
    return FileResponse(
        path=file_path,
        media_type="video/mp4",
        filename=os.path.basename(file_path)
    )
