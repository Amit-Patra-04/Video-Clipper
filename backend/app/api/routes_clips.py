from typing import List
from fastapi import APIRouter, HTTPException
from app.models.schemas import HighlightClip, SpeechSegment, VideoMetadata
from app.worker import pipeline_worker

router = APIRouter(prefix="/clips", tags=["Clips"])

@router.get("/{video_id}", response_model=List[HighlightClip])
def get_video_clips(video_id: str):
    """Retrieve AI-scored and ranked highlight clips for the specified video."""
    clips = pipeline_worker.get_clips(video_id)
    return clips

@router.get("/{video_id}/transcripts", response_model=List[SpeechSegment])
def get_video_transcripts(video_id: str):
    """Retrieve full diarized transcript segments with word-level timestamps."""
    return pipeline_worker.get_transcripts(video_id)

@router.get("/{video_id}/metadata", response_model=VideoMetadata)
def get_video_meta(video_id: str):
    """Retrieve video stream metadata (resolution, fps, duration)."""
    meta = pipeline_worker.get_metadata(video_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Video metadata not found.")
    return meta
