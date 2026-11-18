import os
import sys
import numpy as np
from pathlib import Path
from scipy.io import wavfile
import pytest

# Ensure app is importable
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings

@pytest.fixture(scope="session")
def sample_wav(tmp_path_factory) -> str:
    """Generate a clean 16kHz mono synthetic audio WAV file for tests."""
    temp_dir = tmp_path_factory.mktemp("audio")
    wav_path = str(temp_dir / "test_sample.wav")
    
    sample_rate = 16000
    duration_secs = 5.0
    t = np.linspace(0, duration_secs, int(sample_rate * duration_secs), endpoint=False)
    
    # 440 Hz tone with amplitude envelope simulating speech syllables
    audio = 0.5 * np.sin(2 * np.pi * 440 * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 3 * t))
    audio_int16 = (audio * 32767).astype(np.int16)
    
    wavfile.write(wav_path, sample_rate, audio_int16)
    return wav_path

@pytest.fixture(scope="session")
def sample_video(tmp_path_factory, sample_wav) -> str:
    """Generate a minimal valid MP4 video using ffmpeg."""
    temp_dir = tmp_path_factory.mktemp("video")
    mp4_path = str(temp_dir / "test_sample.mp4")
    
    ffmpeg_exe = settings.get_ffmpeg_path()
    import subprocess
    cmd = [
        ffmpeg_exe,
        "-y",
        "-f", "lavfi",
        "-i", "testsrc=duration=4:size=640x360:rate=30",
        "-f", "lavfi",
        "-i", "sine=frequency=1000:duration=4",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        mp4_path
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True)
    except Exception:
        # Fallback dummy file with MP4 header if ffmpeg fails
        with open(mp4_path, "wb") as f:
            f.write(b"\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42isom")
            f.write(b"\x00" * 4096)
            
    return mp4_path
