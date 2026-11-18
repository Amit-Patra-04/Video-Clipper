import pytest
from app.models.schemas import SpeechSegment, WordTimestamp, SceneCut
from app.services.highlight_ranker import highlight_ranker

def test_highlight_ranking(sample_wav):
    segments = [
        SpeechSegment(
            id=1,
            speaker="Speaker 1",
            start=0.0,
            end=10.0,
            text="The secret reason why everyone fails at virality revealed.",
            words=[
                WordTimestamp(word="The", start=0.0, end=0.5),
                WordTimestamp(word="secret", start=0.5, end=1.2),
                WordTimestamp(word="revealed", start=1.2, end=2.0)
            ]
        ),
        SpeechSegment(
            id=2,
            speaker="Speaker 1",
            start=10.0,
            end=25.0,
            text="When you change your hook by 300 percent, viewers stay hooked.",
            words=[]
        )
    ]
    scene_cuts = [
        SceneCut(timestamp=0.0),
        SceneCut(timestamp=5.0),
        SceneCut(timestamp=12.0),
        SceneCut(timestamp=20.0)
    ]

    clips = highlight_ranker.rank_highlights(
        video_id="vid_test_123",
        total_duration=30.0,
        segments=segments,
        scene_cuts=scene_cuts,
        wav_path=sample_wav,
        target_clip_min_duration=10.0,
        target_clip_max_duration=30.0,
        max_clips=3
    )

    assert len(clips) > 0
    top_clip = clips[0]
    assert top_clip.virality_score >= 50
    assert top_clip.virality_score <= 100
    assert top_clip.breakdown.hook_score > 0
    assert top_clip.breakdown.audio_energy_score > 0
    assert top_clip.breakdown.visual_pacing_score > 0
    assert "reason" in top_clip.model_dump()
