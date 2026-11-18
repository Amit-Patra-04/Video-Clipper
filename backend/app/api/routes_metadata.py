from fastapi import APIRouter, HTTPException
from app.models.schemas import MetadataGenerateRequest, MetadataGenerateResponse
from app.services.metadata_generator import metadata_generator
from app.worker import pipeline_worker

router = APIRouter(prefix="/metadata", tags=["Metadata"])

@router.post("/generate", response_model=MetadataGenerateResponse)
async def generate_video_metadata(body: MetadataGenerateRequest):
    """Generate high-CTR YouTube titles, SEO descriptions, tags, and chapters."""
    transcripts = pipeline_worker.get_transcripts(body.video_id)
    transcript_text = " ".join([t.text for t in transcripts])
    
    meta = pipeline_worker.get_metadata(body.video_id)
    title = meta.filename if meta else "Viral Video"

    res = await metadata_generator.generate_metadata(
        video_id=body.video_id,
        clip_id=body.clip_id,
        title=title,
        transcript_text=transcript_text,
        custom_context=body.custom_context
    )
    return res
