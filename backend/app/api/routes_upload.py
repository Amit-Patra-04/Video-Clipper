import os
import uuid
from typing import Optional
from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    HTTPException,
    Request,
    BackgroundTasks,
    status
)
from pydantic import BaseModel
from app.core.config import settings
from app.core.logger import logger
from app.core.security import (
    sanitize_filename,
    validate_uploaded_file,
    validate_youtube_url,
    check_youtube_permissions,
    check_rate_limit
)
from app.core.db import (
    db_create_job,
    db_get_job,
    db_update_job,
    db_list_recent_jobs
)
from app.worker import pipeline_worker

router = APIRouter(tags=["Ingestion & Upload"])

class YouTubePayload(BaseModel):
    youtube_url: str

class UploadJobResponse(BaseModel):
    job_id: str
    video_id: str
    status: str # "queued" | "processing" | "completed" | "failed"
    type: str # "file_upload" | "youtube_url"
    filename: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    message: str
    policy_warning: Optional[str] = None

@router.post("/upload", response_model=UploadJobResponse)
async def upload_video_or_youtube(
    request: Request,
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    youtube_url: Optional[str] = Form(None)
):
    """
    Unified Ingestion Endpoint.
    Accepts:
    (a) Video file upload (.mp4, .mov, .webm, .mkv)
    (b) YouTube URL input (enforcing official API/OAuth policy; no unauthorized scraping)
    
    Saves file to local sandbox storage (configurable for S3/GCS) and enqueues a job record in SQLite DB.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before submitting again."
        )

    # ---------------------------------------------------------
    # CASE A: Video File Upload
    # ---------------------------------------------------------
    if file and file.filename:
        logger.info(f"Processing video file upload: {file.filename}")
        content = await file.read()
        file_size = len(content)

        if file_size == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        safe_filename = sanitize_filename(file.filename)

        # Security & format validation (malware scan, magic bytes, extension whitelist)
        is_valid, validation_msg = validate_uploaded_file(safe_filename, file_size, content)
        if not is_valid:
            logger.warning(f"File validation failed for {file.filename}: {validation_msg}")
            raise HTTPException(status_code=400, detail=validation_msg)

        video_id = f"vid_{uuid.uuid4().hex[:10]}"
        dest_filename = f"{video_id}_{safe_filename}"
        dest_path = str(settings.UPLOAD_DIR / dest_filename)

        # Sandbox storage: write file to local disk
        # (Production assumption: write to AWS S3 or GCP Cloud Storage bucket)
        try:
            with open(dest_path, "wb") as f:
                f.write(content)
        except Exception as e:
            logger.error(f"Failed to write file to storage: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save file to storage: {str(e)}")

        # Enqueue job record in SQLite database
        job = db_create_job(
            video_id=video_id,
            job_type="file_upload",
            source=safe_filename,
            file_path=dest_path,
            file_size=file_size,
            mime_type=file.content_type or "video/mp4",
            status="queued",
            message="Upload successful, job queued"
        )

        # Trigger background processing worker with retries and DB milestone updates
        background_tasks.add_task(
            pipeline_worker.execute_pipeline,
            video_id=video_id,
            video_path=dest_path,
            title=safe_filename,
            job_id=job.id
        )

        return UploadJobResponse(
            job_id=job.id,
            video_id=video_id,
            status="queued",
            type="file_upload",
            filename=safe_filename,
            file_path=dest_path,
            file_size=file_size,
            message="Upload successful, job queued"
        )

    # ---------------------------------------------------------
    # CASE B: YouTube URL Input
    # ---------------------------------------------------------
    if youtube_url and youtube_url.strip():
        clean_url = youtube_url.strip()
        logger.info(f"Validating YouTube URL input: {clean_url}")

        is_valid_url, yt_id, url_error = validate_youtube_url(clean_url)
        if not is_valid_url:
            raise HTTPException(status_code=400, detail=url_error)

        # POLICY GUARDRAIL:
        # Per YouTube Terms of Service and user policy guidelines:
        # Do NOT attempt to programmatically download third-party YouTube videos.
        # Check if official OAuth / API permissions exist.
        has_permission, policy_msg = check_youtube_permissions()
        if not has_permission:
            logger.warning(f"YouTube ingestion rejected per policy: {policy_msg}")
            # Enqueue a policy-restricted job record for audit in DB
            rejected_job = db_create_job(
                video_id=f"yt_{yt_id}",
                job_type="youtube_url",
                source=clean_url,
                status="failed",
                message="YouTube ingestion rejected: OAuth permissions required per policy.",
                policy_warning=policy_msg
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=policy_msg
            )

        # If authorized via official OAuth2 credentials or development mode:
        video_id = f"yt_{yt_id}_{uuid.uuid4().hex[:6]}"
        job = db_create_job(
            video_id=video_id,
            job_type="youtube_url",
            source=clean_url,
            status="queued",
            message="Authorized YouTube job queued for ingestion"
        )

        # Trigger background pipeline to download and analyze video
        background_tasks.add_task(
            pipeline_worker.execute_youtube_pipeline,
            video_id=video_id,
            youtube_url=clean_url,
            title=f"YouTube_{yt_id}",
            job_id=job.id
        )

        return UploadJobResponse(
            job_id=job.id,
            video_id=video_id,
            status="queued",
            type="youtube_url",
            filename=f"youtube_{yt_id}.mp4",
            message="Authorized YouTube job queued for processing"
        )

    # If neither file nor YouTube URL is provided
    raise HTTPException(
        status_code=400,
        detail="Please provide either a video file (.mp4) or a YouTube URL."
    )

@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    """Retrieve the real-time status of an enqueued ingestion/processing job from DB."""
    job = db_get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job.to_dict()

@router.get("/jobs/{job_id}/transcript")
def get_job_transcript(job_id: str):
    """Retrieve the timestamped transcript JSON (with words and times) saved in DB."""
    job = db_get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    data = job.to_dict()
    if not data.get("transcript"):
        raise HTTPException(status_code=404, detail=f"Transcript not yet generated for job '{job_id}'. Current stage: {job.current_stage}")
    return {
        "job_id": job_id,
        "video_id": job.video_id,
        "stage": job.current_stage,
        "transcript": data["transcript"]
    }

@router.get("/jobs/{job_id}/scenes")
def get_job_scenes(job_id: str):
    """Retrieve the array of timecodes for detected scenes saved in DB."""
    job = db_get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    data = job.to_dict()
    if not data.get("scenes"):
        raise HTTPException(status_code=404, detail=f"Scenes not yet scanned for job '{job_id}'. Current stage: {job.current_stage}")
    return {
        "job_id": job_id,
        "video_id": job.video_id,
        "stage": job.current_stage,
        "scene_count": len(data["scenes"]),
        "scenes": data["scenes"]
    }

@router.get("/jobs/{job_id}/segments")
def get_job_segments(job_id: str):
    """Retrieve top N ranked non-overlapping highlight segments stored in DB."""
    job = db_get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    data = job.to_dict()
    if not data.get("segments"):
        raise HTTPException(status_code=404, detail=f"Highlights not yet ranked for job '{job_id}'. Current stage: {job.current_stage}")
    return {
        "job_id": job_id,
        "video_id": job.video_id,
        "stage": job.current_stage,
        "segment_count": len(data["segments"]),
        "segments": data["segments"]
    }

@router.get("/jobs")
def list_jobs(limit: int = 20):
    """List recent ingestion jobs from SQLite DB."""
    jobs = db_list_recent_jobs(limit=limit)
    return [j.to_dict() for j in jobs]
