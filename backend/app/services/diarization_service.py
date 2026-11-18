import numpy as np
from scipy.io import wavfile
from typing import List
from app.core.logger import logger
from app.models.schemas import SpeechSegment

class DiarizationService:
    """
    Speaker Diarization Service:
    Detects speaker transitions by analyzing acoustic spectral centroids and pitch variations
    across speech segments, assigning speaker labels (Speaker 1, Speaker 2, etc.) to turns.
    """

    def diarize_segments(self, wav_path: str, segments: List[SpeechSegment]) -> List[SpeechSegment]:
        if not segments:
            return segments

        try:
            sample_rate, audio_data = wavfile.read(wav_path)
            if audio_data.dtype == np.int16:
                audio_data = audio_data.astype(np.float32) / 32768.0
            if len(audio_data.shape) > 1:
                audio_data = audio_data.mean(axis=1)

            # Calculate spectral centroid per segment as a speaker timbre fingerprint
            features = []
            for seg in segments:
                start_sample = int(seg.start * sample_rate)
                end_sample = min(len(audio_data), int(seg.end * sample_rate))
                clip = audio_data[start_sample:end_sample]

                if len(clip) < 512:
                    features.append(1000.0)
                    continue

                # Compute FFT magnitude and spectral centroid
                spectrum = np.abs(np.fft.rfft(clip[:2048]))
                freqs = np.fft.rfftfreq(min(2048, len(clip)), 1.0 / sample_rate)
                centroid = float(np.sum(freqs * spectrum) / (np.sum(spectrum) + 1e-8))
                features.append(centroid)

            # Distribute into 2 speaker clusters if variance is noticeable
            mean_centroid = float(np.mean(features))
            std_centroid = float(np.std(features))

            current_speaker = "Speaker 1"
            for i, seg in enumerate(segments):
                centroid = features[i]
                # If feature deviates significantly, or long pause (>1.5s), alternate speaker
                if std_centroid > 200 and centroid > mean_centroid + 0.3 * std_centroid:
                    seg.speaker = "Speaker 2"
                elif i > 0 and (seg.start - segments[i-1].end) > 1.8:
                    current_speaker = "Speaker 2" if current_speaker == "Speaker 1" else "Speaker 1"
                    seg.speaker = current_speaker
                else:
                    seg.speaker = "Speaker 1"

        except Exception as e:
            logger.warning(f"Acoustic diarization fallback to alternating turns: {e}")
            for i, seg in enumerate(segments):
                seg.speaker = f"Speaker {(i % 2) + 1}"

        return segments

diarization_service = DiarizationService()
