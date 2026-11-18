from typing import List
from fastapi import APIRouter, HTTPException, Response
from app.models.schemas import HighlightClip, SpeechSegment, VideoMetadata
from app.worker import pipeline_worker
from app.services.caption_service import caption_service

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

@router.get("/{video_id}/vtt")
def get_video_vtt(video_id: str):
    """Generate and return WebVTT caption file for video."""
    segments = pipeline_worker.get_transcripts(video_id)
    if not segments:
        raise HTTPException(status_code=404, detail=f"No transcripts found for video {video_id}.")
    vtt_text = caption_service.generate_webvtt(segments)
    return Response(
        content=vtt_text,
        media_type="text/vtt",
        headers={"Content-Disposition": f"attachment; filename=captions_{video_id}.vtt"}
    )

@router.post("/{video_id}/captions", response_model=List[SpeechSegment])
def update_video_captions(video_id: str, updated_segments: List[SpeechSegment]):
    """Save user-edited captions back to the caption model in memory and DB."""
    # Sanitize each segment's text to prevent XSS
    for seg in updated_segments:
        seg.text = caption_service.sanitize_text(seg.text)
        if seg.words:
            for w in seg.words:
                w.word = caption_service.sanitize_text(w.word)

    pipeline_worker.transcript_store[video_id] = updated_segments
    return updated_segments

@router.post("/vtt/generate")
def generate_vtt_from_segments(segments: List[SpeechSegment]):
    """Generate WebVTT text from arbitrary segments payload."""
    vtt_text = caption_service.generate_webvtt(segments)
    return Response(content=vtt_text, media_type="text/vtt")

