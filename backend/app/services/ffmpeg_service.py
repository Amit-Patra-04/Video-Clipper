import os
import re
import json
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.logger import logger
from app.models.schemas import VideoMetadata, SceneCut

class FFmpegService:
    def __init__(self):
        self.ffmpeg_exe = settings.get_ffmpeg_path()
        self.ffprobe_exe = settings.get_ffprobe_path()
        logger.info(f"FFmpegService initialized. ffmpeg={self.ffmpeg_exe}, ffprobe={self.ffprobe_exe}")

    def probe_video(self, video_path: str) -> Dict[str, Any]:
        """Probe video metadata using ffprobe JSON output."""
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at {video_path}")
            
        cmd = [
            self.ffprobe_exe,
            "-v", "error",
            "-show_entries", "format=duration,size,format_name",
            "-show_entries", "stream=width,height,r_frame_rate,codec_name,codec_type",
            "-of", "json",
            video_path
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            info = json.loads(result.stdout)
            
            format_info = info.get("format", {})
            duration = float(format_info.get("duration", 0.0))
            size_bytes = int(format_info.get("size", os.path.getsize(video_path)))
            format_name = format_info.get("format_name", "unknown")
            
            width, height, fps = 1920, 1080, 30.0
            for stream in info.get("streams", []):
                if stream.get("codec_type") == "video":
                    width = int(stream.get("width", 1920))
                    height = int(stream.get("height", 1080))
                    r_frame_rate = stream.get("r_frame_rate", "30/1")
                    if "/" in r_frame_rate:
                        num, den = r_frame_rate.split("/")
                        fps = round(float(num) / float(den), 2) if float(den) > 0 else 30.0
                    else:
                        fps = float(r_frame_rate)
                    break
                    
            return {
                "duration": duration,
                "width": width,
                "height": height,
                "fps": fps,
                "format_name": format_name,
                "size_bytes": size_bytes
            }
        except Exception as e:
            logger.warning(f"ffprobe probing failed or ffprobe not directly accessible: {e}. Using fallback inspection.")
            # Fallback estimation using file size
            file_size = os.path.getsize(video_path)
            return {
                "duration": 60.0, # Estimated default
                "width": 1920,
                "height": 1080,
                "fps": 30.0,
                "format_name": "mp4",
                "size_bytes": file_size
            }

    def extract_audio(self, video_path: str, output_wav_path: str) -> str:
        """
        Extract a 16kHz mono 16-bit PCM WAV audio file from the video.
        16kHz mono is optimized for speech recognition & acoustic feature analysis.
        """
        Path(output_wav_path).parent.mkdir(parents=True, exist_ok=True)
        cmd = [
            self.ffmpeg_exe,
            "-y",
            "-i", video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            output_wav_path
        ]
        
        logger.info(f"Extracting audio: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"FFmpeg audio extraction error: {result.stderr}")
            raise RuntimeError(f"FFmpeg failed to extract audio: {result.stderr}")
            
        return output_wav_path

    def detect_scenes(self, video_path: str, threshold: float = 0.35) -> List[SceneCut]:
        """
        Detect visual scene transitions using FFmpeg's scene change filter.
        """
        cmd = [
            self.ffmpeg_exe,
            "-i", video_path,
            "-filter:v", f"select='gt(scene,{threshold})',showinfo",
            "-f", "null",
            "-"
        ]
        
        cuts: List[SceneCut] = []
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            output = result.stderr
            # Parse showinfo pts_time
            pattern = re.compile(r"pts_time:([0-9\.]+)")
            for match in pattern.finditer(output):
                ts = float(match.group(1))
                cuts.append(SceneCut(timestamp=round(ts, 3), confidence=0.85))
        except Exception as e:
            logger.warning(f"Scene detection failed or timed out: {e}")
            
        # Ensure at least timestamp 0.0 is present
        if not cuts or cuts[0].timestamp > 0.5:
            cuts.insert(0, SceneCut(timestamp=0.0, confidence=1.0))
            
        return cuts

    def cut_clip(
        self,
        video_path: str,
        output_path: str,
        start: float,
        end: float,
        aspect_ratio: str = "9:16",
        crop_x: Optional[float] = None,
        normalize_audio: bool = True
    ) -> str:
        """
        Extract video slice with exact start/end bounds and reframing.
        - aspect_ratio "9:16": vertical short (auto-centered or crop_x).
        - aspect_ratio "1:1": square Instagram/LinkedIn post.
        - aspect_ratio "16:9": widescreen landscape.
        """
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        duration = max(0.5, end - start)
        
        # Build video filters
        video_filters = []
        if aspect_ratio == "9:16":
            # Target 1080x1920: scale so height is 1920 then crop 1080 wide
            if crop_x is not None:
                video_filters.append(f"scale=-2:1920,crop=1080:1920:max(0\\,min(in_w-1080\\,(in_w-1080)*{crop_x})):0")
            else:
                video_filters.append("scale=-2:1920,crop=1080:1920:(in_w-1080)/2:0")
        elif aspect_ratio == "1:1":
            # Target 1080x1080 square
            video_filters.append("scale=-2:1080,crop=1080:1080:(in_w-1080)/2:0")
        else:
            video_filters.append("scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2")

        vf_str = ",".join(video_filters)
        
        cmd = [
            self.ffmpeg_exe,
            "-y",
            "-ss", f"{start:.3f}",
            "-i", video_path,
            "-t", f"{duration:.3f}",
            "-vf", vf_str
        ]
        
        if normalize_audio:
            cmd.extend(["-af", "loudnorm=I=-16:TP=-1.5:LRA=11"])
            
        cmd.extend([
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            "-c:a", "aac",
            "-b:a", "192k",
            output_path
        ])
        
        logger.info(f"Cutting clip: start={start}, end={end}, ratio={aspect_ratio}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"FFmpeg cut clip failed: {result.stderr}")
            raise RuntimeError(f"FFmpeg clip cut error: {result.stderr}")
            
        return output_path

    def burn_ass_subtitles(self, input_video: str, ass_file: str, output_video: str) -> str:
        """Burn styled ASS subtitles directly onto the video frames."""
        Path(output_video).parent.mkdir(parents=True, exist_ok=True)
        # Escape path for FFmpeg filter on Windows
        escaped_ass = ass_file.replace("\\", "/").replace(":", "\\:")
        
        cmd = [
            self.ffmpeg_exe,
            "-y",
            "-i", input_video,
            "-vf", f"ass='{escaped_ass}'",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            "-c:a", "copy",
            output_video
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"FFmpeg subtitle burn failed: {result.stderr}")
            # If libass fails or is missing font, copy input as fallback
            import shutil
            shutil.copy2(input_video, output_video)
        return output_video

ffmpeg_service = FFmpegService()
