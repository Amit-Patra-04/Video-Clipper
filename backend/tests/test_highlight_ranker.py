import pytest
from app.models.schemas import SpeechSegment, WordTimestamp, SceneCut
from app.services.highlight_ranker import highlight_ranker
from app.core.db import db_create_job, db_save_segments, db_get_segments, db_get_job
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

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
        target_clip_min_duration=5.0,
        target_clip_max_duration=15.0,
        max_clips=5,
        min_segments=5
    )

    assert len(clips) >= 5
    top_clip = clips[0]
    assert top_clip.virality_score >= 50
    assert top_clip.virality_score <= 100
    assert top_clip.breakdown.hook_score > 0
    assert top_clip.breakdown.audio_energy_score > 0
    assert top_clip.breakdown.visual_pacing_score > 0
    assert "reason" in top_clip.model_dump()

def test_highlight_ranking_produces_at_least_5_segments_descending_scores(sample_wav):
    """
    Acceptance Criteria:
    - The system produces at least 5 segments with descending scores.
    - Explainable reasons attached to each segment.
    """
    segments = [
        SpeechSegment(
            id=1, speaker="Speaker 1", start=0.0, end=8.0,
            text="Stop making this huge mistake with your retention secret.",
            words=[
                WordTimestamp(word="Stop", start=0.0, end=0.6),
                WordTimestamp(word="making", start=0.6, end=1.2),
                WordTimestamp(word="mistake", start=1.2, end=2.0)
            ]
        ),
        SpeechSegment(
            id=2, speaker="Speaker 2", start=9.0, end=18.0,
            text="Loud applause broke out when the revenue numbers were revealed.",
            words=[
                WordTimestamp(word="revenue", start=10.0, end=11.2),
                WordTimestamp(word="revealed", start=11.2, end=12.5)
            ]
        ),
        SpeechSegment(
            id=3, speaker="Speaker 1", start=19.0, end=28.0,
            text="Fast dynamic speech keeps mobile viewers watching till the very end.",
            words=[]
        ),
        SpeechSegment(
            id=4, speaker="Speaker 2", start=29.0, end=38.0,
            text="When the camera angle switches, the visual transition sparks novelty.",
            words=[]
        ),
        SpeechSegment(
            id=5, speaker="Speaker 1", start=39.0, end=48.0,
            text="Here is the final takeaway that guarantees consistent growth.",
            words=[]
        )
    ]

    scene_cuts = [
        SceneCut(timestamp=0.0),
        SceneCut(timestamp=8.5),
        SceneCut(timestamp=18.5),
        SceneCut(timestamp=28.5),
        SceneCut(timestamp=38.5)
    ]

    clips = highlight_ranker.rank_highlights(
        video_id="vid_descending_test",
        total_duration=50.0,
        segments=segments,
        scene_cuts=scene_cuts,
        wav_path=sample_wav,
        min_segments=5
    )

    # 1. At least 5 segments produced
    assert len(clips) >= 5, f"Expected at least 5 segments, got {len(clips)}"

    # 2. Descending scores
    scores = [c.virality_score for c in clips]
    for i in range(len(scores) - 1):
        assert scores[i] >= scores[i + 1], (
            f"Scores must be descending: index {i} score {scores[i]} < index {i+1} score {scores[i+1]}"
        )

    # 3. Explainable reasons attached
    for clip in clips:
        assert clip.reason, f"Clip {clip.id} must have an explainable reason"
        assert len(clip.reason) > 5
        # Must have cues breakdown
        assert "audio_amplitude" in clip.cues
        assert "speaking_rate" in clip.cues
        assert "novelty" in clip.cues
        assert "textual" in clip.cues

def test_highlight_segments_strictly_non_overlapping(sample_wav):
    """
    Guardrail: Ensure segments are non-overlapping.
    """
    segments = [
        SpeechSegment(id=1, speaker="Speaker 1", start=0.0, end=12.0, text="First topic intro with secret keywords.", words=[]),
        SpeechSegment(id=2, speaker="Speaker 1", start=12.5, end=24.0, text="Second topic transition with fast pacing.", words=[]),
        SpeechSegment(id=3, speaker="Speaker 2", start=25.0, end=36.0, text="Third topic with visual change and loud volume.", words=[]),
        SpeechSegment(id=4, speaker="Speaker 1", start=37.0, end=48.0, text="Fourth topic concluding the argument.", words=[]),
        SpeechSegment(id=5, speaker="Speaker 2", start=49.0, end=60.0, text="Fifth topic call to action.", words=[])
    ]
    scene_cuts = [SceneCut(timestamp=12.0), SceneCut(timestamp=24.5), SceneCut(timestamp=36.5)]

    clips = highlight_ranker.rank_highlights(
        video_id="vid_non_overlap_test",
        total_duration=60.0,
        segments=segments,
        scene_cuts=scene_cuts,
        wav_path=sample_wav,
        min_segments=5
    )

    assert len(clips) >= 5

    # Check non-overlapping property for all pairs
    for i in range(len(clips)):
        for j in range(i + 1, len(clips)):
            c1 = clips[i]
            c2 = clips[j]
            # Two intervals [s1, e1] and [s2, e2] do NOT overlap if:
            # e1 <= s2 or e2 <= s1
            overlaps = max(c1.start, c2.start) < min(c1.end, c2.end)
            assert not overlaps, (
                f"Segments {c1.id} ({c1.start}s-{c1.end}s) and {c2.id} ({c2.start}s-{c2.end}s) must not overlap!"
            )

def test_db_persistence_and_api_segments_endpoint(sample_wav):
    """
    Acceptance Criteria:
    - Store top N segments (start/end times, score) in the DB.
    - Expose segments endpoint returning them.
    """
    job = db_create_job(
        video_id="vid_db_segments_test",
        job_type="file_upload",
        source="sample.mp4",
        status="queued"
    )

    test_segments_payload = [
        {
            "id": "clip_01",
            "video_id": job.video_id,
            "start": 0.0,
            "end": 10.0,
            "duration": 10.0,
            "score": 95,
            "virality_score": 95,
            "title": "Viral Hook Secret",
            "reason": "Loud applause peak and fast speaking rate (3.4 wps)",
            "reasons": ["Loud volume peak", "Fast speaking rate (3.4 wps)", "Keyword ('secret')"],
            "cues": {"audio_amplitude": {"peak": 0.85}, "speaking_rate": {"wps": 3.4}}
        },
        {
            "id": "clip_02",
            "video_id": job.video_id,
            "start": 12.0,
            "end": 22.0,
            "duration": 10.0,
            "score": 89,
            "virality_score": 89,
            "title": "Visual Scene Novelty",
            "reason": "Scene cut at topic transition and continuous engagement",
            "reasons": ["Scene cut transition", "Steady speech pacing"],
            "cues": {"novelty": {"cuts_count": 2}}
        },
        {
            "id": "clip_03",
            "video_id": job.video_id,
            "start": 24.0,
            "end": 34.0,
            "duration": 10.0,
            "score": 84,
            "virality_score": 84,
            "title": "Revenue Growth Breakdown",
            "reason": "Topic transition with high curiosity payoff",
            "reasons": ["Punchline payoff", "Clear vocal presence"],
            "cues": {"textual": {"keywords_matched": ["revenue"]}}
        },
        {
            "id": "clip_04",
            "video_id": job.video_id,
            "start": 36.0,
            "end": 45.0,
            "duration": 9.0,
            "score": 80,
            "virality_score": 80,
            "title": "Audience Retention Secret",
            "reason": "Visual novelty and steady vocal clarity",
            "reasons": ["Visual cut", "Balanced audio volume"],
            "cues": {"speaking_rate": {"wps": 2.8}}
        },
        {
            "id": "clip_05",
            "video_id": job.video_id,
            "start": 47.0,
            "end": 56.0,
            "duration": 9.0,
            "score": 75,
            "virality_score": 75,
            "title": "Closing Actionable Takeaways",
            "reason": "Clean sentence ending and clear vocal volume",
            "reasons": ["Topic transition", "Clean ending"],
            "cues": {"audio_amplitude": {"rms": 0.12}}
        }
    ]

    # Save to DB
    updated_job = db_save_segments(job.id, test_segments_payload)
    assert updated_job is not None

    # Retrieve from DB directly
    db_segments = db_get_segments(job.id)
    assert len(db_segments) == 5
    assert db_segments[0]["score"] == 95
    assert db_segments[4]["score"] == 75

    # Check via REST API
    resp = client.get(f"/api/jobs/{job.id}/segments")
    assert resp.status_code == 200
    data = resp.json()
    assert data["job_id"] == job.id
    assert data["segment_count"] == 5
    assert len(data["segments"]) == 5
    assert data["segments"][0]["score"] >= data["segments"][1]["score"]
    assert "reason" in data["segments"][0]
