import os
import shutil
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AutoClip AI Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    ALLOW_YOUTUBE_DOWNLOAD: bool = False
    
    # Storage paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage"
    UPLOAD_DIR: Path = STORAGE_DIR / "uploads"
    AUDIO_DIR: Path = STORAGE_DIR / "audio"
    CLIPS_DIR: Path = STORAGE_DIR / "clips"
    EXPORTS_DIR: Path = STORAGE_DIR / "exports"
    
    # Ingestion constraints
    MAX_UPLOAD_SIZE_BYTES: int = 500 * 1024 * 1024  # 500 MB
    MAX_VIDEO_DURATION_SECONDS: int = 10800  # 3 hours max
    ALLOWED_EXTENSIONS: set = {".mp4", ".mov", ".webm", ".mkv"}
    ALLOWED_MIME_TYPES: set = {
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/x-matroska",
        "application/octet-stream"  # Some browsers send this for mkv/webm
    }
    
    # External APIs
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ASSEMBLYAI_API_KEY: str = os.getenv("ASSEMBLYAI_API_KEY", "")

    # Timeout & Retry settings
    SUBPROCESS_TIMEOUT_SECONDS: int = 120
    HTTP_TIMEOUT_SECONDS: float = 120.0
    MAX_WORKER_RETRIES: int = 3
    RETRY_BACKOFF_SECONDS: float = 2.0

    # Highlight Ranking Configuration
    MIN_HIGHLIGHT_SEGMENTS: int = 5
    HIGHLIGHT_KEYWORDS: list = [
        "secret", "never", "insane", "truth", "revealed", "stop", "mistake",
        "warning", "why", "nobody", "crazy", "fail", "shocking", "proof",
        "rule", "hacks", "money", "viral", "revenue", "growth", "key",
        "strategy", "lesson", "how to", "best", "worst", "game changer",
        "applause", "laughter", "breakthrough", "problem", "solution"
    ]
    
    # FFmpeg executable resolution
    FFMPEG_PATH: str = ""
    FFPROBE_PATH: str = ""
    
    # Security / CORS
    ALLOWED_ORIGINS: list = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]
    
    def get_ffmpeg_path(self) -> str:
        """Resolve the path to the ffmpeg executable."""
        if self.FFMPEG_PATH and os.path.exists(self.FFMPEG_PATH):
            return self.FFMPEG_PATH
            
        env_path = os.getenv("FFMPEG_PATH")
        if env_path and os.path.exists(env_path):
            return env_path
            
        which_path = shutil.which("ffmpeg")
        if which_path:
            return which_path
            
        # Check WinGet Gyan installation directory
        winget_path = Path(os.path.expanduser("~")) / "AppData" / "Local" / "Microsoft" / "WinGet" / "Packages"
        if winget_path.exists():
            matches = list(winget_path.glob("**/ffmpeg.exe"))
            if matches:
                return str(matches[0])
                
        # Fall back to imageio_ffmpeg bundled binary
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return "ffmpeg"
            
    def get_ffprobe_path(self) -> str:
        """Resolve the path to the ffprobe executable."""
        if self.FFPROBE_PATH and os.path.exists(self.FFPROBE_PATH):
            return self.FFPROBE_PATH
            
        env_path = os.getenv("FFPROBE_PATH")
        if env_path and os.path.exists(env_path):
            return env_path
            
        which_path = shutil.which("ffprobe")
        if which_path:
            return which_path
            
        ffmpeg_exe = self.get_ffmpeg_path()
        candidate = Path(ffmpeg_exe).parent / ("ffprobe.exe" if os.name == "nt" else "ffprobe")
        if candidate.exists():
            return str(candidate)
            
        return "ffprobe"

    class Config:
        case_sensitive = True
        extra = "ignore"
        env_file = ".env"

settings = Settings()

# Ensure directories exist
for directory in [settings.UPLOAD_DIR, settings.AUDIO_DIR, settings.CLIPS_DIR, settings.EXPORTS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
