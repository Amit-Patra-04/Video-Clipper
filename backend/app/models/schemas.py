from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float
    confidence: float = 1.0

class SpeechSegment(BaseModel):
    id: int
    speaker: str = "Speaker 1"
    start: float
    end: float
    text: str
    words: List[WordTimestamp] = []

class SceneCut(BaseModel):
    timestamp: float
    confidence: float = 0.8
    frame_index: Optional[int] = None

class HighlightScoreBreakdown(BaseModel):
    hook_score: float = Field(..., description="Semantic curiosity and opening hook strength (0-100)")
    audio_energy_score: float = Field(..., description="Acoustic volume dynamics and speech intensity (0-100)")
    visual_pacing_score: float = Field(..., description="Scene cut frequency and visual motion (0-100)")
    topic_coherence_score: float = Field(..., description="Self-contained story arc and punchline (0-100)")

class HighlightClip(BaseModel):
    id: str
    video_id: str
    start: float
    end: float
    duration: float
    title: str
    virality_score: int = Field(..., ge=0, le=100)
    score: Optional[int] = None
    breakdown: HighlightScoreBreakdown
    reason: str
    reasons: List[str] = []
    cues: Dict[str, Any] = {}
    transcript_snippet: str
    suggested_aspect_ratio: str = "9:16"

class HighlightSegment(BaseModel):
    id: str
    video_id: str
    start: float
    end: float
    duration: float
    score: int = Field(..., ge=0, le=100)
    virality_score: Optional[int] = None
    title: str = ""
    reason: str
    reasons: List[str] = []
    cues: Dict[str, Any] = {}
    transcript_snippet: str = ""
    breakdown: Optional[HighlightScoreBreakdown] = None
    suggested_aspect_ratio: str = "9:16"

class VideoMetadata(BaseModel):
    video_id: str
    filename: str
    file_path: str
    duration: float
    width: int
    height: int
    fps: float
    format_name: str
    size_bytes: int

class PipelineProgress(BaseModel):
    video_id: str
    status: str  # "idle" | "processing" | "completed" | "failed"
    current_stage: str # "ingest" | "probing" | "audio_extract" | "stt" | "diarize" | "scene_detect" | "highlight_ranking" | "ready"
    progress: int = 0 # 0 to 100
    message: str = ""
    error: Optional[str] = None
    stages_completed: List[str] = []

class IngestResponse(BaseModel):
    video_id: str
    filename: str
    title: str
    duration: float
    file_path: str
    status: str = "ingested"

class YouTubeIngestRequest(BaseModel):
    url: str

class MetadataGenerateRequest(BaseModel):
    video_id: str
    clip_id: Optional[str] = None
    custom_context: Optional[str] = None

class YouTubeTitleVariation(BaseModel):
    title: str
    hook_type: str # e.g. "Curiosity Gap", "Bold Claim", "Contrarian", "How-To"
    estimated_ctr: str # "Very High", "High"

class ChapterItem(BaseModel):
    timestamp: str
    title: str

class MetadataGenerateResponse(BaseModel):
    video_id: str
    clip_id: Optional[str] = None
    titles: List[YouTubeTitleVariation]
    description: str
    tags: List[str]
    hashtags: List[str]
    chapters: List[ChapterItem]

class ExportRequest(BaseModel):
    video_id: str
    clip_id: Optional[str] = None
    start: float
    end: float
    aspect_ratio: str = "9:16" # "9:16", "1:1", "16:9", "original"
    transition: str = "cut" # "cut", "fade", "zoom"
    burn_captions: bool = True
    caption_preset: str = "hormozi" # "hormozi", "mrbeast", "minimal", "neon"
    font_size: int = 28
    active_color: str = "#facc15" # Yellow
    crop_x: Optional[float] = None # Horizontal crop center offset (0.0 to 1.0)
    audio_normalize: bool = True
    original_resolution: bool = False

class ExportResponse(BaseModel):
    export_id: str
    video_id: str
    download_url: str
    file_name: str
    file_size_bytes: int
    duration: float
    resolution: Optional[str] = None
    status: str = "completed"
