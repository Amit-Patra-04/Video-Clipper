import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.schemas import SpeechSegment, WordTimestamp
from app.services.caption_service import caption_service
from app.worker import pipeline_worker

client = TestClient(app)

def test_vtt_timestamp_formatting():
    assert caption_service.format_vtt_timestamp(0.0) == "00:00:00.000"
    assert caption_service.format_vtt_timestamp(4.5) == "00:00:04.500"
    assert caption_service.format_vtt_timestamp(65.123) == "00:01:05.123"
    assert caption_service.format_vtt_timestamp(3661.05) == "01:01:01.050"

def test_xss_sanitization():
    # Dangerous XSS attack vector
    malicious_script = "<script>alert('xss')</script>Hello World"
    sanitized = caption_service.sanitize_text(malicious_script)
    assert "<script>" not in sanitized
    assert "Hello World" in sanitized
    assert "xss" in sanitized
    # Verify HTML tags and quotes are escaped/stripped
    assert "<" not in sanitized
    assert ">" not in sanitized

    img_xss = '<img src="x" onerror="alert(1)">Important message'
    sanitized_img = caption_service.sanitize_text(img_xss)
    assert "<img" not in sanitized_img
    assert "Important message" in sanitized_img

def test_generate_webvtt_output():
    segments = [
        SpeechSegment(
            id=1,
            speaker="Speaker 1",
            start=4.5,
            end=14.2,
            text="The secret reason why everyone fails at virality revealed.",
            words=[]
        ),
        SpeechSegment(
            id=2,
            speaker="Speaker 2",
            start=15.0,
            end=25.5,
            text="When you change your hook by 300 percent, viewers stay hooked.",
            words=[]
        )
    ]

    vtt = caption_service.generate_webvtt(segments)
    assert vtt.startswith("WEBVTT")
    assert "00:00:04.500 --> 00:00:14.200" in vtt
    assert "The secret reason why everyone fails at virality revealed." in vtt
    assert "00:00:15.000 --> 00:00:25.500" in vtt

def test_api_vtt_export_and_caption_update():
    video_id = "vid_caption_test_01"
    initial_segments = [
        SpeechSegment(
            id=1,
            speaker="Speaker 1",
            start=2.0,
            end=8.0,
            text="Original raw caption text.",
            words=[]
        )
    ]
    pipeline_worker.transcript_store[video_id] = initial_segments

    # 1. Test GET /clips/{video_id}/vtt
    res = client.get(f"/api/clips/{video_id}/vtt")
    assert res.status_code == 200
    assert "WEBVTT" in res.text
    assert "00:00:02.000 --> 00:00:08.000" in res.text

    # 2. Test POST /clips/{video_id}/captions (update caption model with user edits & XSS attempt)
    updated_payload = [
        {
            "id": 1,
            "speaker": "Speaker 1",
            "start": 2.5,
            "end": 9.0,
            "text": "<b>Edited</b> user caption <script>attack</script>",
            "words": []
        }
    ]
    update_res = client.post(f"/api/clips/{video_id}/captions", json=updated_payload)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data[0]["start"] == 2.5
    assert updated_data[0]["end"] == 9.0
    # Guardrail: Must be sanitized
    assert "<script>" not in updated_data[0]["text"]
    assert "Edited" in updated_data[0]["text"]

def test_srt_generation(tmp_path):
    """Test SubRip (.srt) timestamp formatting and generation."""
    assert caption_service.format_srt_timestamp(4.5) == "00:00:04,500"
    assert caption_service.format_srt_timestamp(65.123) == "00:01:05,123"

    segments = [
        SpeechSegment(id=1, speaker="Speaker 1", start=1.0, end=4.0, text="First subtitle cue", words=[]),
        SpeechSegment(id=2, speaker="Speaker 1", start=5.0, end=9.0, text="Second subtitle cue", words=[])
    ]
    srt = caption_service.generate_srt(segments)
    assert "1\n00:00:01,000 --> 00:00:04,000\nFirst subtitle cue" in srt
    assert "2\n00:00:05,000 --> 00:00:09,000\nSecond subtitle cue" in srt

def test_ass_subtitle_generation(tmp_path):
    """Test Advanced SubStation Alpha (.ass) generation with word-level karaoke timing."""
    from app.services.export_service import export_service
    ass_path = str(tmp_path / "test_captions.ass")

    words = [
        WordTimestamp(word="Hello", start=2.0, end=2.5),
        WordTimestamp(word="world", start=2.5, end=3.0),
        WordTimestamp(word="viral", start=3.0, end=3.6)
    ]
    segments = [
        SpeechSegment(id=1, speaker="Speaker 1", start=2.0, end=4.0, text="Hello world viral", words=words)
    ]

    out_path = export_service.generate_ass_subtitle_file(
        segments=segments,
        clip_start=1.0,
        clip_end=5.0,
        output_ass_path=ass_path,
        preset="hormozi"
    )
    assert out_path == ass_path
    with open(ass_path, "r", encoding="utf-8") as f:
        content = f.read()
    assert "[Script Info]" in content
    assert "[V4+ Styles]" in content
    assert "[Events]" in content
    assert "\\k" in content # karaoke tags present
