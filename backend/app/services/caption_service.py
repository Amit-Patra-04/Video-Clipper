import re
import html
from typing import List, Dict, Any, Union
from app.models.schemas import SpeechSegment

class CaptionService:
    """
    WebVTT and SRT Caption Generation and Sanitization Service.
    Converts transcript speech segments into RFC 8216 WebVTT standard format.
    """

    @staticmethod
    def sanitize_text(raw_text: str) -> str:
        """
        Sanitize user caption text to prevent XSS and malicious script injection
        while preserving speech accuracy.
        """
        if not raw_text:
            return ""
        # Strip all HTML/script tags
        no_tags = re.sub(r"<[^>]*>", "", raw_text)
        # Escape HTML entities (&, <, >, ", ')
        clean_text = html.escape(no_tags.strip())
        return clean_text

    @staticmethod
    def format_vtt_timestamp(seconds: float) -> str:
        """Convert float seconds to WebVTT timestamp format: HH:MM:SS.mmm."""
        seconds = max(0.0, float(seconds))
        total_ms = int(round(seconds * 1000))
        hours = total_ms // 3600000
        minutes = (total_ms % 3600000) // 60000
        secs = (total_ms % 60000) // 1000
        ms = total_ms % 1000
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"

    @staticmethod
    def format_srt_timestamp(seconds: float) -> str:
        """Convert float seconds to SubRip SRT timestamp format: HH:MM:SS,mmm."""
        seconds = max(0.0, float(seconds))
        total_ms = int(round(seconds * 1000))
        hours = total_ms // 3600000
        minutes = (total_ms % 3600000) // 60000
        secs = (total_ms % 60000) // 1000
        ms = total_ms % 1000
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"

    def generate_webvtt(self, segments: List[Union[SpeechSegment, Dict[str, Any]]]) -> str:
        """
        Generate standard WebVTT formatted caption string from transcript segments.
        Ensures captions are time-coded and sanitized.
        """
        lines = ["WEBVTT", ""]

        for idx, seg in enumerate(segments, 1):
            if isinstance(seg, dict):
                start = float(seg.get("start", 0.0))
                end = float(seg.get("end", start + 1.0))
                text = str(seg.get("text", "")).strip()
                speaker = seg.get("speaker")
            else:
                start = float(seg.start)
                end = float(seg.end)
                text = str(seg.text).strip()
                speaker = getattr(seg, "speaker", None)

            clean_text = self.sanitize_text(text)
            if not clean_text:
                continue

            start_tc = self.format_vtt_timestamp(start)
            end_tc = self.format_vtt_timestamp(end)

            cue_text = clean_text
            if speaker and speaker.lower() not in ["none", ""]:
                cue_text = f"<v {self.sanitize_text(speaker)}>{clean_text}"

            lines.append(str(idx))
            lines.append(f"{start_tc} --> {end_tc}")
            lines.append(cue_text)
            lines.append("")

        return "\n".join(lines)

    def generate_srt(self, segments: List[Union[SpeechSegment, Dict[str, Any]]]) -> str:
        """Generate standard SubRip (.srt) formatted subtitle string."""
        lines = []

        for idx, seg in enumerate(segments, 1):
            if isinstance(seg, dict):
                start = float(seg.get("start", 0.0))
                end = float(seg.get("end", start + 1.0))
                text = str(seg.get("text", "")).strip()
            else:
                start = float(seg.start)
                end = float(seg.end)
                text = str(seg.text).strip()

            clean_text = self.sanitize_text(text)
            if not clean_text:
                continue

            start_tc = self.format_srt_timestamp(start)
            end_tc = self.format_srt_timestamp(end)

            lines.append(str(idx))
            lines.append(f"{start_tc} --> {end_tc}")
            lines.append(clean_text)
            lines.append("")

        return "\n".join(lines)

caption_service = CaptionService()
