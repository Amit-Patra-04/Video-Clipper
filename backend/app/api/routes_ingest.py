import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Request, BackgroundTasks
from app.core.security import check_rate_limit
from app.core.logger import logger
from app.models.schemas import IngestResponse, YouTubeIngestRequest
from app.services.ingestion_service import ingestion_service
from app.worker import pipeline_worker

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

@router.post("/upload", response_model=IngestResponse)
async def upload_video(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Handle direct video file upload with validation and security checks."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait a minute before uploading again.")

    logger.info(f"Incoming upload: {file.filename}, content_type: {file.content_type}")
    
    try:
        content = await file.read()
        res = ingestion_service.handle_file_upload(file.filename or "video.mp4", content)
        
        # Auto-trigger pipeline in background
        background_tasks.add_task(
            pipeline_worker.execute_pipeline,
            video_id=res["video_id"],
            video_path=res["file_path"],
            title=res["title"]
        )

        return IngestResponse(
            video_id=res["video_id"],
            filename=res["filename"],
            title=res["title"],
            duration=res["duration"],
            file_path=res["file_path"],
            status="ingested"
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Upload processing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process video: {str(e)}")

@router.post("/youtube", response_model=IngestResponse)
async def ingest_youtube(
    request: Request,
    body: YouTubeIngestRequest,
    background_tasks: BackgroundTasks
):
    """Handle authorized YouTube link ingestion with restriction safety."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait a minute before trying again.")

    logger.info(f"Incoming YouTube ingestion request: {body.url}")
    
    try:
        res = ingestion_service.handle_youtube_download(body.url)
        
        # Auto-trigger pipeline in background
        background_tasks.add_task(
            pipeline_worker.execute_pipeline,
            video_id=res["video_id"],
            video_path=res["file_path"],
            title=res["title"]
        )

        return IngestResponse(
            video_id=res["video_id"],
            filename=res["filename"],
            title=res["title"],
            duration=res["duration"],
            file_path=res["file_path"],
            status="ingested"
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        logger.error(f"YouTube ingestion error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"YouTube ingestion failed: {str(e)}")
