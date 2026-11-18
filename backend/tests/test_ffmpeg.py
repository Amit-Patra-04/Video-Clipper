import os
import pytest
from app.services.ffmpeg_service import ffmpeg_service

def test_probe_video(sample_video):
    probe_data = ffmpeg_service.probe_video(sample_video)
    assert probe_data["duration"] > 0
    assert probe_data["width"] > 0
    assert probe_data["height"] > 0
    assert probe_data["fps"] > 0

def test_extract_audio(sample_video, tmp_path):
    output_wav = str(tmp_path / "extracted.wav")
    result = ffmpeg_service.extract_audio(sample_video, output_wav)
    assert os.path.exists(result)
    assert os.path.getsize(result) > 1000

def test_cut_clip(sample_video, tmp_path):
    output_mp4 = str(tmp_path / "cut_vertical.mp4")
    result = ffmpeg_service.cut_clip(
        video_path=sample_video,
        output_path=output_mp4,
        start=0.5,
        end=2.5,
        aspect_ratio="9:16"
    )
    assert os.path.exists(result)
    probe = ffmpeg_service.probe_video(result)
    assert probe["width"] == 1080
    assert probe["height"] == 1920

def test_detect_scenes(sample_video):
    scenes = ffmpeg_service.detect_scenes(sample_video)
    assert isinstance(scenes, list)
    assert len(scenes) >= 1
    assert scenes[0].timestamp == 0.0
