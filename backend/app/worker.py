import os
import time
import asyncio
import traceback
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.logger import logger
from app.services.metrics_service import metrics_service
from app.core.db import (
    SessionLocal,
    JobModel,
    db_update_job,
    db_save_transcript,
    db_save_scenes,
    db_save_segments
)
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
from app.services.scene_detector import scene_detector_service
from app.services.highlight_ranker import highlight_ranker

class VideoPipelineWorker:
    def __init__(self):
        self.progress_store: Dict[str, PipelineProgress] = {}
        self.metadata_store: Dict[str, VideoMetadata] = {}
        self.transcript_store: Dict[str, List[SpeechSegment]] = {}
        self.scene_store: Dict[str, List[Dict[str, Any]]] = {}
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
        if video_id in self.clips_store and self.clips_store[video_id]:
            return self.clips_store[video_id]
        with SessionLocal() as db:
            job = db.query(JobModel).filter(JobModel.video_id == video_id).order_by(JobModel.created_at.desc()).first()
            if job and job.segments_json:
                try:
                    import json
                    data = json.loads(job.segments_json)
                    return [HighlightClip(**c) for c in data]
                except Exception:
                    pass
        return self.clips_store.get(video_id, [])

    def get_transcripts(self, video_id: str) -> List[SpeechSegment]:
        return self.transcript_store.get(video_id, [])

    def get_scenes(self, video_id: str) -> List[Dict[str, Any]]:
        return self.scene_store.get(video_id, [])

    def get_metadata(self, video_id: str) -> Optional[VideoMetadata]:
        return self.metadata_store.get(video_id)

    async def execute_pipeline(
        self,
        video_id: str,
        video_path: str,
        title: str = "",
        job_id: Optional[str] = None,
        max_retries: int = 3
    ):
        """
        Asynchronously execute the full video processing pipeline with retry logic and milestone tracking.
        
        Milestones:
        1. Probing: inspect codecs and duration.
        2. Extracting Audio: 16kHz mono audio extraction.
        3. Transcribed: STT with word-level timestamps & speaker labels saved to DB.
        4. Scanned Scenes: PySceneDetect visual cut points & timecodes saved to DB.
        5. Completed: Multimodal AI highlight ranking.
        """
        progress = PipelineProgress(
            video_id=video_id,
            status="processing",
            current_stage="probing",
            progress=10,
            message="Probing video stream format and resolution...",
            stages_completed=[]
        )
        self.progress_store[video_id] = progress

        pipeline_start_time = time.time()
        metrics_service.record_job_start(video_id)

        attempt = 0
        last_error = None

        while attempt < max_retries:
            attempt += 1
            try:
                logger.info(f"[{video_id}] Starting pipeline attempt {attempt}/{max_retries} (Job: {job_id})")
                
                if job_id:
                    db_update_job(
                        job_id,
                        status="processing",
                        current_stage="Probing Video",
                        progress=10,
                        message=f"Starting analysis (attempt {attempt})...",
                        retry_count=attempt - 1
                    )

                # =================================================================
                # Stage 1: FFmpeg Probe
                # =================================================================
                logger.info(f"[{video_id}] Stage 1: Probing video metadata...")
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
                progress.current_stage = "Extracting Audio"
                progress.message = "Extracting 16kHz mono audio stream via FFmpeg..."

                if job_id:
                    db_update_job(
                        job_id,
                        current_stage="Extracting Audio",
                        progress=25,
                        message="FFmpeg extracting 16kHz mono audio..."
                    )

                # =================================================================
                # Stage 2: Audio Extraction
                # =================================================================
                logger.info(f"[{video_id}] Stage 2: Extracting audio...")
                s2_start = time.time()
                wav_path = str(settings.AUDIO_DIR / f"{video_id}.wav")
                ffmpeg_service.extract_audio(video_path, wav_path)
                metrics_service.record_stage_duration("audio_extract", time.time() - s2_start)

                progress.stages_completed.append("audio_extract")
                progress.progress = 45
                progress.current_stage = "Transcribing"
                progress.message = "Running Speech-to-Text with word timestamps..."

                if job_id:
                    db_update_job(
                        job_id,
                        current_stage="Transcribing",
                        progress=45,
                        message="Transcribing speech with word-level timestamps..."
                    )

                # =================================================================
                # Stage 3: Speech-to-Text with Word Timestamps & Speaker Labels
                # =================================================================
                logger.info(f"[{video_id}] Stage 3: Transcribing audio...")
                s3_start = time.time()
                stt_result = await stt_service.transcribe_audio(wav_path)
                segments: List[SpeechSegment] = stt_result.get("segments", [])
                
                if not segments:
                    logger.warning(f"[{video_id}] Alert: STT transcription returned 0 speech segments. Audio may be silent or corrupted.")
                    metrics_service.record_stt_warning("zero speech segments")

                metrics_service.record_stage_duration("stt", time.time() - s3_start)

                # Run diarization clustering if not already speaker-labeled
                diar_start = time.time()
                segments = diarization_service.diarize_segments(wav_path, segments)
                metrics_service.record_stage_duration("diarize", time.time() - diar_start)

                self.transcript_store[video_id] = segments

                # Milestone: Transcribed -> Save transcript JSON in DB
                transcript_payload = {
                    "text": stt_result.get("text", " ".join([s.text for s in segments])),
                    "segments": [s.model_dump() for s in segments]
                }
                if job_id:
                    db_save_transcript(job_id, transcript_payload)
                    db_update_job(
                        job_id,
                        current_stage="Transcribed",
                        progress=65,
                        message=f"Transcribed successfully ({len(segments)} segments)."
                    )

                progress.stages_completed.append("stt")
                progress.stages_completed.append("diarize")
                progress.progress = 65
                progress.current_stage = "Scanning Scenes"
                progress.message = "Running PySceneDetect to find visual cut points..."

                # =================================================================
                # Stage 4: Scene Detection (PySceneDetect)
                # =================================================================
                logger.info(f"[{video_id}] Stage 4: Running PySceneDetect for cut points...")
                s4_start = time.time()
                scenes_data = scene_detector_service.detect_scenes(video_path)
                metrics_service.record_stage_duration("scene_detect", time.time() - s4_start)
                self.scene_store[video_id] = scenes_data

                # Milestone: Scanned Scenes -> Save scene list JSON in DB
                if job_id:
                    db_save_scenes(job_id, scenes_data)
                    db_update_job(
                        job_id,
                        current_stage="Scanned Scenes",
                        progress=85,
                        message=f"Scanned scenes successfully ({len(scenes_data)} scenes found)."
                    )

                progress.stages_completed.append("scene_detect")
                progress.progress = 85
                progress.current_stage = "Ranking Highlights"
                progress.message = "Multimodal AI evaluating viral hooks and audio energy..."

                # =================================================================
                # Stage 5: Multimodal AI Highlight Ranking
                # =================================================================
                logger.info(f"[{video_id}] Stage 5: Ranking highlights...")
                s5_start = time.time()
                # Adapt scene cuts for ranker
                scene_cuts = [
                    SceneCut(timestamp=s["start_seconds"], confidence=0.85)
                    for s in scenes_data
                ]
                clips = highlight_ranker.rank_highlights(
                    video_id=video_id,
                    total_duration=meta.duration,
                    segments=segments,
                    scene_cuts=scene_cuts,
                    wav_path=wav_path,
                    min_segments=settings.MIN_HIGHLIGHT_SEGMENTS
                )
                metrics_service.record_stage_duration("highlight_ranking", time.time() - s5_start)
                self.clips_store[video_id] = clips

                # Format segments for DB persistence
                segments_payload = [
                    {
                        "id": clip.id,
                        "video_id": clip.video_id,
                        "start": clip.start,
                        "end": clip.end,
                        "duration": clip.duration,
                        "score": clip.virality_score,
                        "virality_score": clip.virality_score,
                        "title": clip.title,
                        "reason": clip.reason,
                        "reasons": clip.reasons,
                        "cues": clip.cues,
                        "transcript_snippet": clip.transcript_snippet,
                        "suggested_aspect_ratio": clip.suggested_aspect_ratio
                    }
                    for clip in clips
                ]

                if job_id:
                    db_save_segments(job_id, segments_payload)

                # =================================================================
                # Stage 6: Completion
                # =================================================================
                progress.stages_completed.append("highlight_ranking")
                progress.progress = 100
                progress.current_stage = "Completed"
                progress.status = "completed"
                progress.message = f"Analysis complete! {len(clips)} non-overlapping highlights ranked."

                total_duration = time.time() - pipeline_start_time
                metrics_service.record_job_completion(video_id, total_duration)

                if job_id:
                    db_update_job(
                        job_id,
                        status="completed",
                        current_stage="Completed",
                        progress=100,
                        message=f"Pipeline complete! {len(clips)} non-overlapping highlights ranked."
                    )

                logger.info(f"[{video_id}] Pipeline completed successfully in {total_duration:.2f}s on attempt {attempt}!")
                return True

            except Exception as e:
                last_error = e
                logger.error(
                    f"[{video_id}] Pipeline error on attempt {attempt}/{max_retries}: {e}\n{traceback.format_exc()}"
                )
                
                if attempt < max_retries:
                    backoff = settings.RETRY_BACKOFF_SECONDS * (2 ** (attempt - 1))
                    logger.warning(f"[{video_id}] Retrying in {backoff:.1f}s...")
                    if job_id:
                        db_update_job(
                            job_id,
                            message=f"Retrying after error (attempt {attempt}/{max_retries}): {str(e)[:100]}",
                            retry_count=attempt
                        )
                    await asyncio.sleep(backoff)

        # If all retries exhausted
        err_msg = str(last_error) if last_error else "Unknown pipeline failure"
        progress.status = "failed"
        progress.error = err_msg
        progress.message = f"Pipeline failed after {max_retries} attempts: {err_msg}"
        metrics_service.record_job_failure(video_id, err_msg)

        if job_id:
            db_update_job(
                job_id,
                status="failed",
                current_stage="Failed",
                error=err_msg,
                message=f"Pipeline failed: {err_msg[:200]}"
            )

        logger.error(f"[{video_id}] Pipeline permanently failed after {max_retries} retries.")
        return False

    async def execute_youtube_pipeline(
        self,
        video_id: str,
        youtube_url: str,
        title: str = "",
        job_id: Optional[str] = None
    ):
        """
        Download authorized YouTube video and then execute the full processing pipeline.
        """
        from app.services.ingestion_service import ingestion_service
        try:
            logger.info(f"[{video_id}] Starting YouTube download for {youtube_url}")
            if job_id:
                db_update_job(
                    job_id,
                    status="processing",
                    current_stage="Downloading YouTube Video",
                    progress=5,
                    message="Downloading authorized YouTube stream..."
                )

            download_result = ingestion_service.handle_youtube_download(youtube_url)
            dest_path = download_result["file_path"]
            actual_title = download_result.get("title") or title or f"YouTube {video_id}"

            if job_id:
                db_update_job(
                    job_id,
                    file_path=dest_path,
                    current_stage="Downloaded",
                    progress=15,
                    message=f"Downloaded '{actual_title}'. Enqueueing analysis pipeline..."
                )

            await self.execute_pipeline(
                video_id=video_id,
                video_path=dest_path,
                title=actual_title,
                job_id=job_id
            )
        except Exception as e:
            err_msg = str(e)
            logger.error(f"[{video_id}] YouTube ingestion failed: {err_msg}")
            if job_id:
                db_update_job(
                    job_id,
                    status="failed",
                    current_stage="Failed",
                    error=err_msg,
                    message=f"YouTube ingestion failed: {err_msg[:200]}"
                )

pipeline_worker = VideoPipelineWorker()
