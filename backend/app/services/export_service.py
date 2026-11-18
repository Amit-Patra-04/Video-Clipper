import os
import uuid
from pathlib import Path
from typing import List, Optional
from app.core.config import settings
from app.core.logger import logger
from app.models.schemas import ExportRequest, ExportResponse, SpeechSegment
from app.services.ffmpeg_service import ffmpeg_service

class ExportService:
    def __init__(self):
        self.exports_dir = settings.EXPORTS_DIR

    def generate_ass_subtitle_file(
        self,
        segments: List[SpeechSegment],
        clip_start: float,
        clip_end: float,
        output_ass_path: str,
        preset: str = "hormozi",
        font_size: int = 24,
        active_color: str = "&H0000FFFF" # ASS BGR format: Yellow = &H0000FFFF
    ) -> str:
        """
        Generate an Advanced SubStation Alpha (.ass) subtitle file
        with karaoke / word-level timing and highlight styling.
        """
        Path(output_ass_path).parent.mkdir(parents=True, exist_ok=True)

        # Style configurations for presets
        # ASS Color format: &HAABBGGRR (Alpha, Blue, Green, Red)
        style_defs = {
            "hormozi": (
                "Style: Default,Arial Black,28,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,"
                "1,0,0,0,100,100,0,0,1,3,1,2,30,30,80,1"
            ),
            "mrbeast": (
                "Style: Default,Impact,30,&H00FFFFFF,&H0000FF00,&H00000000,&H90000000,"
                "1,0,0,0,100,100,0,0,1,4,2,2,30,30,80,1"
            ),
            "neon": (
                "Style: Default,Arial,26,&H00FFFF00,&H00FF00FF,&H00000000,&H60000000,"
                "1,0,0,0,100,100,0,0,1,2,3,2,30,30,80,1"
            ),
            "minimal": (
                "Style: Default,Helvetica,22,&H00FFFFFF,&H00CCCCCC,&H00000000,&H40000000,"
                "0,0,0,0,100,100,0,0,1,1,1,2,20,20,50,1"
            )
        }
        chosen_style = style_defs.get(preset, style_defs["hormozi"])

        header = f"""[Script Info]
Title: AutoClip Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{chosen_style}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        events = []
        for seg in segments:
            # Only include words within the clip range
            seg_words = [w for w in seg.words if w.start >= clip_start and w.end <= clip_end]
            if not seg_words and seg.start < clip_end and seg.end > clip_start:
                # If no word-level details, use segment timing
                s_rel = max(0.0, seg.start - clip_start)
                e_rel = min(clip_end - clip_start, seg.end - clip_start)
                s_str = self._format_ass_time(s_rel)
                e_str = self._format_ass_time(e_rel)
                events.append(f"Dialogue: 0,{s_str},{e_str},Default,,0,0,0,,{seg.text.upper()}")
                continue

            # Group words in chunks of 3-4 words for dynamic kinetic reading
            chunk_size = 3
            for i in range(0, len(seg_words), chunk_size):
                chunk = seg_words[i:i+chunk_size]
                c_start = max(0.0, chunk[0].start - clip_start)
                c_end = min(clip_end - clip_start, chunk[-1].end - clip_start)
                if c_end <= c_start:
                    continue

                s_str = self._format_ass_time(c_start)
                e_str = self._format_ass_time(c_end)

                # Format karaoke text with \k tags (centiseconds)
                k_text_parts = []
                for w in chunk:
                    dur_cs = max(10, int((w.end - w.start) * 100))
                    clean_word = w.word.upper().replace("{", "").replace("}", "")
                    k_text_parts.append(f"{{\\k{dur_cs}}}{clean_word}")

                formatted_line = " ".join(k_text_parts)
                events.append(f"Dialogue: 0,{s_str},{e_str},Default,,0,0,0,,{formatted_line}")

        with open(output_ass_path, "w", encoding="utf-8") as f:
            f.write(header + "\n".join(events) + "\n")

        return output_ass_path

    def _format_ass_time(self, seconds: float) -> str:
        """Format seconds into H:MM:SS.cs for ASS format."""
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        cs = int(round((seconds - int(seconds)) * 100))
        return f"{hrs}:{mins:02d}:{secs:02d}.{cs:02d}"

    def render_export(
        self,
        req: ExportRequest,
        input_video_path: str,
        segments: Optional[List[SpeechSegment]] = None
    ) -> ExportResponse:
        """Execute full video rendering pipeline."""
        if not os.path.exists(input_video_path):
            raise FileNotFoundError(f"Source video file not found at {input_video_path}")

        export_id = f"exp_{str(uuid.uuid4())[:8]}"
        aspect_slug = req.aspect_ratio.replace(":", "x")
        temp_cut_path = str(self.exports_dir / f"{export_id}_cut.mp4")
        final_video_name = f"{export_id}_{aspect_slug}.mp4"
        final_video_path = str(self.exports_dir / final_video_name)

        logger.info(f"Rendering export {export_id} from {req.start:.2f}s to {req.end:.2f}s, ratio={req.aspect_ratio}")

        # 1. Cut and reframe clip
        ffmpeg_service.cut_clip(
            video_path=input_video_path,
            output_path=temp_cut_path,
            start=req.start,
            end=req.end,
            aspect_ratio=req.aspect_ratio,
            crop_x=req.crop_x,
            normalize_audio=req.audio_normalize
        )

        # 2. Burn captions if requested
        if req.burn_captions and segments:
            ass_path = str(self.exports_dir / f"{export_id}_captions.ass")
            self.generate_ass_subtitle_file(
                segments=segments,
                clip_start=req.start,
                clip_end=req.end,
                output_ass_path=ass_path,
                preset=req.caption_preset,
                font_size=req.font_size
            )
            ffmpeg_service.burn_ass_subtitles(
                input_video=temp_cut_path,
                ass_file=ass_path,
                output_video=final_video_path
            )
            # Clean up temp cut and ass
            if os.path.exists(temp_cut_path):
                os.remove(temp_cut_path)
            if os.path.exists(ass_path):
                os.remove(ass_path)
        else:
            if os.path.exists(final_video_path):
                os.remove(final_video_path)
            os.rename(temp_cut_path, final_video_path)

        file_size = os.path.getsize(final_video_path)
        duration = req.end - req.start

        return ExportResponse(
            export_id=export_id,
            video_id=req.video_id,
            download_url=f"/api/export/{export_id}/download",
            file_name=final_video_name,
            file_size_bytes=file_size,
            duration=round(duration, 2),
            status="completed"
        )

export_service = ExportService()
