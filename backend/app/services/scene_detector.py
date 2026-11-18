import os
import re
import subprocess
from typing import List, Dict, Any
from app.core.config import settings
from app.core.logger import logger

class SceneDetectorService:
    """
    Scene Detection Service using PySceneDetect (with FFmpeg scene filter fallback).
    Detects visual shot changes, camera switches, and cut points in video media.
    """

    def detect_scenes(self, video_path: str, threshold: float = 27.0) -> List[Dict[str, Any]]:
        """
        Detect visual scenes and return an array of timecodes for each scene.
        Each scene contains:
        - scene_number: 1-indexed count
        - start_seconds: start timestamp in seconds
        - end_seconds: end timestamp in seconds
        - start_timecode: SMPTE formatted string (HH:MM:SS.mmm)
        - end_timecode: SMPTE formatted string (HH:MM:SS.mmm)
        - duration_seconds: total scene length
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at {video_path}")

        logger.info(f"Running scene detection on {video_path} using PySceneDetect...")

        try:
            from scenedetect import detect, ContentDetector
            scene_list = detect(video_path, ContentDetector(threshold=threshold))

            if scene_list:
                results = []
                for idx, (start_tc, end_tc) in enumerate(scene_list):
                    start_sec = round(start_tc.get_seconds(), 3)
                    end_sec = round(end_tc.get_seconds(), 3)
                    results.append({
                        "scene_number": idx + 1,
                        "start_seconds": start_sec,
                        "end_seconds": end_sec,
                        "start_timecode": start_tc.get_timecode(),
                        "end_timecode": end_tc.get_timecode(),
                        "duration_seconds": round(end_sec - start_sec, 3),
                        "start_frame": start_tc.get_frames(),
                        "end_frame": end_tc.get_frames()
                    })
                logger.info(f"PySceneDetect found {len(results)} scenes.")
                return results

        except Exception as e:
            logger.warning(f"PySceneDetect encountered error: {e}. Falling back to FFmpeg scene detector filter.")

        # Fallback to FFmpeg showinfo scene filter
        return self._detect_scenes_ffmpeg(video_path)

    def _detect_scenes_ffmpeg(self, video_path: str, threshold: float = 0.3) -> List[Dict[str, Any]]:
        """FFmpeg-based scene cut fallback parser."""
        ffmpeg_exe = settings.get_ffmpeg_path()
        cmd = [
            ffmpeg_exe,
            "-i", video_path,
            "-filter:v", f"select='gt(scene,{threshold})',showinfo",
            "-f", "null",
            "-"
        ]

        cuts = [0.0]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=settings.SUBPROCESS_TIMEOUT_SECONDS
            )
            pattern = re.compile(r"pts_time:([0-9\.]+)")
            for match in pattern.finditer(result.stderr):
                ts = round(float(match.group(1)), 3)
                if ts not in cuts:
                    cuts.append(ts)
        except Exception as ex:
            logger.warning(f"FFmpeg scene detector error or timeout: {ex}")

        # Get total duration
        duration = 10.0
        try:
            from app.services.ffmpeg_service import ffmpeg_service
            info = ffmpeg_service.probe_video(video_path)
            duration = max(1.0, info.get("duration", 10.0))
        except Exception:
            pass

        if cuts[-1] < duration:
            cuts.append(round(duration, 3))

        # Build scene intervals
        scenes = []
        for i in range(len(cuts) - 1):
            s = cuts[i]
            e = cuts[i + 1]
            if e > s:
                scenes.append({
                    "scene_number": i + 1,
                    "start_seconds": s,
                    "end_seconds": e,
                    "start_timecode": self._format_timecode(s),
                    "end_timecode": self._format_timecode(e),
                    "duration_seconds": round(e - s, 3),
                    "start_frame": int(s * 30),
                    "end_frame": int(e * 30)
                })

        if not scenes:
            scenes = [{
                "scene_number": 1,
                "start_seconds": 0.0,
                "end_seconds": round(duration, 3),
                "start_timecode": "00:00:00.000",
                "end_timecode": self._format_timecode(duration),
                "duration_seconds": round(duration, 3),
                "start_frame": 0,
                "end_frame": int(duration * 30)
            }]

        return scenes

    def _format_timecode(self, seconds: float) -> str:
        """Format seconds into HH:MM:SS.mmm format."""
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int(round((seconds - int(seconds)) * 1000))
        return f"{hrs:02d}:{mins:02d}:{secs:02d}.{millis:03d}"

scene_detector_service = SceneDetectorService()
