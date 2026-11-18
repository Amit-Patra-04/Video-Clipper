import os
import asyncio
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.logger import logger
from app.models.schemas import (
    PipelineProgress,
    VideoMetadata,
    SpeechSegment,
    SceneCut,
    HighlightClip
)
from app.services.ffmpeg_service import ffmpeg_service
from app.services.stt_service import stt_service
from app.services.diarization_service import diarization_service
from app.services.highlight_ranker import highlight_ranker

class VideoPipelineWorker:
    def __init__(self):
        # In-memory session stores (can be easily replaced with Redis / DB)
        self.progress_store: Dict[str, PipelineProgress] = {}
        self.metadata_store: Dict[str, VideoMetadata] = {}
        self.transcript_store: Dict[str, List[SpeechSegment]] = {}
        self.scene_store: Dict[str, List[SceneCut]] = {}
        self.clips_store: Dict[str, List[HighlightClip]] = {}

    def get_progress(self, video_id: str) -> PipelineProgress:
        return self.progress_store.get(
            video_id,
            PipelineProgress(
                video_id=video_id,
                status="idle",
                current_stage="idle",
                progress=0,
                message="Not started"
            )
        )

    def get_clips(self, video_id: str) -> List[HighlightClip]:
        return self.clips_store.get(video_id, [])

    def get_transcripts(self, video_id: str) -> List[SpeechSegment]:
        return self.transcript_store.get(video_id, [])

    def get_metadata(self, video_id: str) -> Optional[VideoMetadata]:
        return self.metadata_store.get(video_id)

    async def execute_pipeline(self, video_id: str, video_path: str, title: str = ""):
        """Asynchronously orchestrate the entire multi-stage AI pipeline."""
        progress = PipelineProgress(
            video_id=video_id,
            status="processing",
            current_stage="probing",
            progress=10,
            message="Probing video stream format and resolution...",
            stages_completed=[]
        )
        self.progress_store[video_id] = progress

        try:
            # Stage 1: FFmpeg Probe
            logger.info(f"[{video_id}] Stage 1: Probing video...")
            probe_data = ffmpeg_service.probe_video(video_path)
            meta = VideoMetadata(
                video_id=video_id,
                filename=os.path.basename(video_path),
                file_path=video_path,
                duration=probe_data["duration"],
                width=probe_data["width"],
                height=probe_data["height"],
                fps=probe_data["fps"],
                format_name=probe_data["format_name"],
                size_bytes=probe_data["size_bytes"]
            )
            self.metadata_store[video_id] = meta
            progress.stages_completed.append("probing")
            progress.progress = 25
            progress.current_stage = "audio_extract"
            progress.message = "Extracting 16kHz mono audio stream..."

            # Stage 2: Audio Extraction
            logger.info(f"[{video_id}] Stage 2: Extracting audio...")
            wav_path = str(settings.AUDIO_DIR / f"{video_id}.wav")
            ffmpeg_service.extract_audio(video_path, wav_path)
            progress.stages_completed.append("audio_extract")
            progress.progress = 45
            progress.current_stage = "stt"
            progress.message = "Running Speech-to-Text with word-level timestamps..."

            # Stage 3: STT (Speech-to-Text)
            logger.info(f"[{video_id}] Stage 3: Running STT...")
            segments = await stt_service.transcribe_audio(wav_path)
            progress.stages_completed.append("stt")
            progress.progress = 65
            progress.current_stage = "diarize"
            progress.message = "Diarizing speakers and dialogue turns..."

            # Stage 4: Diarization
            logger.info(f"[{video_id}] Stage 4: Diarizing speakers...")
            segments = diarization_service.diarize_segments(wav_path, segments)
            self.transcript_store[video_id] = segments
            progress.stages_completed.append("diarize")
            progress.progress = 75
            progress.current_stage = "scene_detect"
            progress.message = "Detecting visual scene boundaries and transitions..."

            # Stage 5: Scene Detection
            logger.info(f"[{video_id}] Stage 5: Detecting visual scene transitions...")
            scene_cuts = ffmpeg_service.detect_scenes(video_path)
            self.scene_store[video_id] = scene_cuts
            progress.stages_completed.append("scene_detect")
            progress.progress = 88
            progress.current_stage = "highlight_ranking"
            progress.message = "AI Highlight Ranker evaluating virality and hooks..."

            # Stage 6: Highlight Ranking
            logger.info(f"[{video_id}] Stage 6: Ranking highlights...")
            clips = highlight_ranker.rank_highlights(
                video_id=video_id,
                total_duration=meta.duration,
                segments=segments,
                scene_cuts=scene_cuts,
                wav_path=wav_path
            )
            self.clips_store[video_id] = clips
            progress.stages_completed.append("highlight_ranking")
            progress.progress = 100
            progress.current_stage = "ready"
            progress.status = "completed"
            progress.message = f"Analysis complete! {len(clips)} viral clips generated and ranked."
            logger.info(f"[{video_id}] Pipeline completed successfully with {len(clips)} clips.")

        except Exception as e:
            logger.error(f"[{video_id}] Pipeline failure: {e}", exc_info=True)
            progress.status = "failed"
            progress.error = str(e)
            progress.message = f"Pipeline error: {str(e)}"

pipeline_worker = VideoPipelineWorker()
