from fastapi import APIRouter, HTTPException
from app.models.schemas import MetadataGenerateRequest, MetadataGenerateResponse
from app.services.metadata_generator import metadata_generator
from app.worker import pipeline_worker

router = APIRouter(prefix="/metadata", tags=["Metadata"])

@router.post("/generate", response_model=MetadataGenerateResponse)
async def generate_video_metadata(body: MetadataGenerateRequest):
    """Generate high-CTR YouTube titles, SEO descriptions, tags, and chapters."""
    clip = None
    if body.clip_id:
        clips = pipeline_worker.get_clips(body.video_id)
        clip = next((c for c in clips if c.id == body.clip_id), None)

    transcripts = pipeline_worker.get_transcripts(body.video_id)

    if clip:
        # Filter transcripts overlapping clip window
        clip_transcripts = [
            t for t in transcripts
            if (t.end >= clip.start and t.start <= clip.end)
        ]
        if clip_transcripts:
            transcript_text = " ".join([t.text for t in clip_transcripts])
        elif clip.transcript_snippet:
            transcript_text = clip.transcript_snippet
        else:
            transcript_text = " ".join([t.text for t in transcripts])

        meta = pipeline_worker.get_metadata(body.video_id)
        fallback_name = meta.filename if meta else "Viral Clip"
        title = clip.title if clip.title else fallback_name
    else:
        transcript_text = " ".join([t.text for t in transcripts])
        meta = pipeline_worker.get_metadata(body.video_id)
        title = meta.filename if meta else "Viral Video"

    res = await metadata_generator.generate_metadata(
        video_id=body.video_id,
        clip_id=body.clip_id,
        title=title,
        transcript_text=transcript_text,
        custom_context=body.custom_context,
        tags_count=body.tags_count or 0
    )
    return res
