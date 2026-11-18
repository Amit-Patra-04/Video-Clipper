import pytest
from app.services.metadata_generator import metadata_generator

@pytest.mark.asyncio
async def test_metadata_generator():
    res = await metadata_generator.generate_metadata(
        video_id="test_vid_99",
        clip_id="clip_1",
        title="Mastering YouTube Virality",
        transcript_text="Here is the secret framework to make any video go viral."
    )

    assert len(res.titles) >= 3
    assert any("Curiosity" in t.hook_type for t in res.titles)
    assert len(res.tags) >= 5
    assert any(h.startswith("#") for h in res.hashtags)
    assert len(res.chapters) >= 2
    assert "SUBSCRIBE" in res.description
