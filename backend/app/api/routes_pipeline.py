from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models.schemas import PipelineProgress
from app.worker import pipeline_worker

router = APIRouter(prefix="/pipeline", tags=["Pipeline"])

@router.get("/{video_id}/status", response_model=PipelineProgress)
def get_pipeline_status(video_id: str):
    """Poll the real-time processing stage and progress percentage of a video."""
    progress = pipeline_worker.get_progress(video_id)
    return progress

@router.post("/start/{video_id}", response_model=PipelineProgress)
async def restart_pipeline(video_id: str, background_tasks: BackgroundTasks):
    """Manually re-run the pipeline for an ingested video."""
    meta = pipeline_worker.get_metadata(video_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Video metadata not found.")
        
    background_tasks.add_task(
        pipeline_worker.execute_pipeline,
        video_id=video_id,
        video_path=meta.file_path,
        title=meta.filename
    )
    return pipeline_worker.get_progress(video_id)
