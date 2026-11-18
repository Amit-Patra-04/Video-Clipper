import pytest
from app.services.stt_service import stt_service
from app.services.diarization_service import diarization_service

@pytest.mark.asyncio
async def test_stt_transcription(sample_wav):
    segments = await stt_service.transcribe_audio(sample_wav)
    assert len(segments) > 0
    seg = segments[0]
    assert seg.start >= 0.0
    assert seg.end > seg.start
    assert len(seg.text) > 0
    assert len(seg.words) > 0
    assert seg.words[0].word != ""

def test_speaker_diarization(sample_wav):
    # Create test segments
    from app.models.schemas import SpeechSegment, WordTimestamp
    test_segments = [
        SpeechSegment(id=1, speaker="Speaker 1", start=0.0, end=2.0, text="Turn one", words=[]),
        SpeechSegment(id=2, speaker="Speaker 1", start=4.0, end=6.0, text="Turn two", words=[])
    ]
    diarized = diarization_service.diarize_segments(sample_wav, test_segments)
    assert len(diarized) == 2
    assert diarized[0].speaker in ["Speaker 1", "Speaker 2"]
