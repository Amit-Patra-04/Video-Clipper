import os
import uuid
import time
from pathlib import Path
from typing import Dict, Any, Tuple
import yt_dlp
from app.core.config import settings
from app.core.logger import logger
from app.core.security import (
    sanitize_filename,
    validate_uploaded_file,
    validate_youtube_url
)
from app.services.ffmpeg_service import ffmpeg_service

class IngestionService:
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR

    def handle_file_upload(self, original_filename: str, file_bytes: bytes) -> Dict[str, Any]:
        """Process and validate an uploaded video file."""
        safe_name = sanitize_filename(original_filename)
        size = len(file_bytes)
        
        # Validate file
        header_sample = file_bytes[:64]
        is_valid, err_msg = validate_uploaded_file(safe_name, size, header_sample)
        if not is_valid:
            raise ValueError(err_msg)
            
        video_id = str(uuid.uuid4())[:12]
        dest_filename = f"{video_id}_{safe_name}"
        dest_path = str(self.upload_dir / dest_filename)
        
        with open(dest_path, "wb") as f:
            f.write(file_bytes)
            
        # Probe video using FFmpeg
        probe_data = ffmpeg_service.probe_video(dest_path)
        
        # Check duration cap
        if probe_data["duration"] > settings.MAX_VIDEO_DURATION_SECONDS:
            os.remove(dest_path)
            max_hours = settings.MAX_VIDEO_DURATION_SECONDS / 3600
            raise ValueError(f"Video duration ({probe_data['duration']:.1f}s) exceeds the maximum allowed limit of {max_hours:.1f} hours.")
            
        return {
            "video_id": video_id,
            "filename": safe_name,
            "title": Path(safe_name).stem.replace("_", " ").title(),
            "duration": probe_data["duration"],
            "file_path": dest_path,
            "width": probe_data["width"],
            "height": probe_data["height"],
            "fps": probe_data["fps"],
            "status": "ingested"
        }

    def handle_youtube_download(self, youtube_url: str) -> Dict[str, Any]:
        """
        Download authorized YouTube video using yt-dlp with restriction detection.
        Handles age-gating, live-streams, private videos, and oversized media.
        """
        is_valid, yt_id, err_msg = validate_youtube_url(youtube_url)
        if not is_valid:
            raise ValueError(err_msg)
            
        video_id = f"yt_{yt_id}_{str(uuid.uuid4())[:6]}"
        out_template = str(self.upload_dir / f"{video_id}_%(title).50s.%(ext)s")
        
        ydl_opts = {
            'format': 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': out_template,
            'merge_output_format': 'mp4',
            'ffmpeg_location': settings.get_ffmpeg_path(),
            'noplaylist': True,
            'max_filesize': settings.MAX_UPLOAD_SIZE_BYTES,
            'quiet': True,
            'no_warnings': True,
            # YouTube restriction safety: don't attempt live streams
            'match_filter': yt_dlp.utils.match_filter_func("!is_live"),
            'socket_timeout': 30
        }
        
        try:
            logger.info(f"Extracting YouTube video metadata for {youtube_url}")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=False)
                
                if not info:
                    raise ValueError("Could not extract YouTube video information.")
                    
                duration = info.get("duration", 0)
                if duration > settings.MAX_VIDEO_DURATION_SECONDS:
                    max_hrs = settings.MAX_VIDEO_DURATION_SECONDS // 3600
                    raise ValueError(f"Video duration ({duration}s) exceeds the maximum allowed limit of {max_hrs} hours.")
                    
                if info.get("is_live", False):
                    raise ValueError("Live streams cannot be processed. Please provide an on-demand video URL.")
                    
                if info.get("availability") in ["needs_auth", "subscriber_only", "premium_only"]:
                    raise PermissionError("Video is private or requires authentication / paywall access.")
                    
                title = info.get("title", f"YouTube Video {yt_id}")
                
                # Download stream
                logger.info(f"Downloading YouTube video: {title}")
                ydl.download([youtube_url])
                
                # Locate downloaded file
                matches = list(self.upload_dir.glob(f"{video_id}*.mp4"))
                if not matches:
                    # check any extension
                    matches = list(self.upload_dir.glob(f"{video_id}*"))
                    if not matches:
                        raise RuntimeError("Download completed but downloaded file could not be located on disk.")
                        
                downloaded_path = str(matches[0])
                probe_data = ffmpeg_service.probe_video(downloaded_path)
                
                return {
                    "video_id": video_id,
                    "filename": Path(downloaded_path).name,
                    "title": title,
                    "duration": probe_data["duration"] or float(duration),
                    "file_path": downloaded_path,
                    "width": probe_data["width"],
                    "height": probe_data["height"],
                    "fps": probe_data["fps"],
                    "status": "ingested"
                }
                
        except yt_dlp.utils.DownloadError as e:
            err_str = str(e)
            logger.error(f"yt-dlp error: {err_str}")
            if "Sign in to confirm your age" in err_str:
                raise PermissionError("Video is age-restricted and requires YouTube login authorization.")
            elif "Private video" in err_str:
                raise PermissionError("Video is set to Private on YouTube.")
            elif "Video unavailable" in err_str:
                raise ValueError("Video is unavailable or has been removed from YouTube.")
            else:
                raise RuntimeError(f"YouTube ingestion failed: {err_str[:200]}")
        except Exception as e:
            logger.error(f"Unexpected error during YouTube ingestion: {e}")
            raise

ingestion_service = IngestionService()
