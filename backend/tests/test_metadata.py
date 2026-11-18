import pytest
import re
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.services.metadata_generator import (
    metadata_generator,
    extract_clip_keywords,
    enforce_title_length,
    enforce_sentence_limit,
    count_sentences,
    sanitize_and_filter_hashtags,
    check_over_tagging,
    OFFICIAL_YOUTUBE_GUIDANCE
)
from app.worker import pipeline_worker
from app.models.schemas import SpeechSegment, HighlightClip, HighlightScoreBreakdown

client = TestClient(app)

@pytest.mark.asyncio
async def test_metadata_generator_baseline():
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


@pytest.mark.asyncio
async def test_metadata_title_and_description_constraints():
    """
    Acceptance Criteria:
    - Generated title is <= 100 chars and contains key terms from the clip.
    - Description is 1-2 sentences, summarizing clip content.
    """
    transcript = (
        "Quantum computing will disrupt modern cryptography and financial cryptography algorithms completely. "
        "Engineers must adapt to post-quantum encryption protocols before the next decade begins."
    )
    res = await metadata_generator.generate_metadata(
        video_id="quantum_vid",
        clip_id="clip_quantum",
        title="Quantum Computing Cryptography",
        transcript_text=transcript
    )

    # 1. Title length constraint <= 100 chars
    assert len(res.primary_title) <= 100
    for t in res.titles:
        assert len(t.title) <= 100, f"Title exceeded 100 chars: {t.title}"
        assert t.character_count == len(t.title)

    # 2. Title contains key terms from clip
    keywords = extract_clip_keywords(transcript, "Quantum Computing")
    assert len(keywords) > 0
    top_keyword = keywords[0].lower()
    assert any(top_keyword in t.title.lower() for t in res.titles), (
        f"Expected top keyword '{top_keyword}' in generated titles: {[t.title for t in res.titles]}"
    )

    # 3. Description is 1-2 sentences
    assert 1 <= res.sentence_count <= 2
    sentences = [s for s in re.split(r'(?<=[.!?])\s+', res.description.strip()) if s]
    assert len(sentences) in (1, 2)
    assert "cryptography" in res.description.lower() or "quantum" in res.description.lower()


def test_hashtag_rules_and_filtering():
    """
    Acceptance Criteria:
    - Up to 3 relevant hashtags are listed.
    - Longer input hashtags (> 30 chars) are ignored or warned.
    """
    # Test sanitization with long hashtag
    long_tag = "thisisareallysuperlonghashtagthatexceedsthirtycharacterscompletely"
    raw_tags = ["#Shorts", "#AI", long_tag, "#MachineLearning", "#TechNews"]
    filtered = sanitize_and_filter_hashtags(raw_tags, max_count=3)

    assert len(filtered) <= 3
    # Verify the >30 chars tag was filtered out
    assert not any(long_tag in tag.lower() for tag in filtered)
    # Verify format
    for tag in filtered:
        assert tag.startswith("#")
        assert len(tag[1:]) <= 30
        assert tag[1:].isalnum()


def test_over_tagging_policy_alert():
    """
    Acceptance Criteria:
    - Alerts if tags exceed YouTube's 60 tags policy (warn about >60 tags rule).
    - Cites YouTube Support URL: https://support.google.com/youtube/answer/6390658.
    """
    # Over 60 tags
    warning = check_over_tagging(65)
    assert warning is not None
    assert "Over-tagging Alert (>60 tags detected)" in warning
    assert "https://support.google.com/youtube/answer/6390658" in warning

    # Under 60 tags
    no_warning = check_over_tagging(15)
    assert no_warning is None


def test_official_youtube_guidance_citations():
    """
    Guardrail:
    - Clearly cite sources (YouTube support) for hashtag/metadata guidelines.
    """
    assert "source_url" in OFFICIAL_YOUTUBE_GUIDANCE
    assert OFFICIAL_YOUTUBE_GUIDANCE["source_url"] == "https://support.google.com/youtube/answer/6390658"
    assert "title_rule" in OFFICIAL_YOUTUBE_GUIDANCE
    assert "100 characters" in OFFICIAL_YOUTUBE_GUIDANCE["title_rule"]
    assert "description_rule" in OFFICIAL_YOUTUBE_GUIDANCE
    assert "1-2 sentence" in OFFICIAL_YOUTUBE_GUIDANCE["description_rule"]
    assert "hashtag_rule" in OFFICIAL_YOUTUBE_GUIDANCE
    assert "up to 3" in OFFICIAL_YOUTUBE_GUIDANCE["hashtag_rule"]
    assert "over_tagging_rule" in OFFICIAL_YOUTUBE_GUIDANCE
    assert "60 hashtags" in OFFICIAL_YOUTUBE_GUIDANCE["over_tagging_rule"]


@pytest.mark.asyncio
async def test_openai_metadata_generation_with_mock():
    """Verify OpenAI prompt structure and adherence when API key is provided."""
    mock_response_json = {
        "choices": [
            {
                "message": {
                    "content": """{
                        "titles": [
                            {"title": "The 1 AI Secret Nobody Tells You (Mind Blowing)", "hook_type": "Curiosity Gap", "estimated_ctr": "Very High"},
                            {"title": "Stop Using AI Like This (Immediate Mistake)", "hook_type": "Urgent Warning", "estimated_ctr": "High"}
                        ],
                        "description": "Discover the breakthrough AI prompt strategies that double your output. SUBSCRIBE to get daily productivity breakdowns.",
                        "tags": ["ai", "productivity", "chatgpt"],
                        "hashtags": ["#Shorts", "#AI", "#ProductivityHack"],
                        "chapters": [
                            {"timestamp": "0:00", "title": "The AI Hook"},
                            {"timestamp": "0:15", "title": "The Workflow"}
                        ]
                    }"""
                }
            }
        ]
    }

    with patch.object(metadata_generator, "openai_key", "sk-mock-key"):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_resp = AsyncMock()
            mock_resp.raise_for_status = lambda: None
            mock_resp.json = lambda: mock_response_json
            mock_post.return_value = mock_resp

            res = await metadata_generator.generate_metadata(
                video_id="ai_vid_42",
                clip_id="clip_ai",
                title="AI Workflow Secrets",
                transcript_text="AI tools are transforming how developers write code and automate tasks every day."
            )

            assert len(res.titles) == 2
            assert all(len(t.title) <= 100 for t in res.titles)
            assert res.sentence_count <= 2
            assert len(res.hashtags) <= 3
            assert res.official_guidance["source_url"] == "https://support.google.com/youtube/answer/6390658"


def test_metadata_api_route_with_clip_isolation():
    """Verify POST /api/metadata/generate properly uses the clip's transcript window."""
    video_id = "route_vid_88"
    pipeline_worker.transcript_store[video_id] = [
        SpeechSegment(id=1, speaker="Speaker 1", start=0.0, end=10.0, text="Introductory remarks that are not part of highlight."),
        SpeechSegment(id=2, speaker="Speaker 1", start=12.0, end=25.0, text="This is the core highlight explaining neural networks architecture."),
        SpeechSegment(id=3, speaker="Speaker 1", start=28.0, end=40.0, text="Closing remarks after the highlight ends.")
    ]
    pipeline_worker.clips_store[video_id] = [
        HighlightClip(
            id="clip_neural",
            video_id=video_id,
            start=11.0,
            end=26.0,
            duration=15.0,
            title="Neural Networks Architecture",
            virality_score=94,
            breakdown=HighlightScoreBreakdown(
                hook_score=95, audio_energy_score=90, visual_pacing_score=88, topic_coherence_score=92
            ),
            reason="High curiosity on neural networks",
            transcript_snippet="This is the core highlight explaining neural networks architecture."
        )
    ]

    response = client.post(
        "/api/metadata/generate",
        json={"video_id": video_id, "clip_id": "clip_neural"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["video_id"] == video_id
    assert data["clip_id"] == "clip_neural"
    assert len(data["titles"]) >= 3
    # Should contain keywords from the clip
    all_titles_text = " ".join([t["title"] for t in data["titles"]]).lower()
    assert "neural" in all_titles_text or "networks" in all_titles_text
    assert len(data["hashtags"]) <= 3
    assert data["official_guidance"]["source_url"] == "https://support.google.com/youtube/answer/6390658"
