import os
import re
import uuid
import numpy as np
from scipy.io import wavfile
from typing import List, Dict, Any, Tuple
from app.core.logger import logger
from app.models.schemas import (
    SpeechSegment,
    SceneCut,
    HighlightClip,
    HighlightScoreBreakdown
)

class HighlightRanker:
    """
    Multimodal AI Highlight Ranking Engine.
    
    Scores video segments (15s to 60s) for virality potential based on:
    1. Hook Strength (Semantic analysis: curiosity gaps, contrarian hooks, emotional intensity)
    2. Audio Energy (Acoustic RMS variance, vocal excitement spikes, absence of long silences)
    3. Visual Pacing (Optimal scene transition density of 1 cut per 3-6 seconds)
    4. Topic Coherence (Self-contained narrative arc and punchy payoff)
    
    Formula:
    ViralityScore = 0.35 * Hook + 0.25 * AudioEnergy + 0.20 * VisualPacing + 0.20 * TopicArc
    """

    HOOK_TRIGGER_WORDS = {
        "secret": 18, "never": 15, "insane": 16, "truth": 15, "revealed": 16,
        "stop": 14, "mistake": 17, "warning": 15, "why": 12, "nobody": 16,
        "crazy": 14, "fail": 15, "shocking": 18, "proof": 14, "rule": 13,
        "hacks": 15, "money": 13, "viral": 14, "percent": 12, "worst": 15
    }

    def rank_highlights(
        self,
        video_id: str,
        total_duration: float,
        segments: List[SpeechSegment],
        scene_cuts: List[SceneCut],
        wav_path: str,
        target_clip_min_duration: float = 18.0,
        target_clip_max_duration: float = 55.0,
        max_clips: int = 5
    ) -> List[HighlightClip]:
        """Generate and rank viral video candidate clips."""
        logger.info(f"Ranking highlights for video_id={video_id}, duration={total_duration:.1f}s")
        
        # Candidate window generation
        candidate_windows = self._generate_candidate_windows(
            total_duration,
            segments,
            scene_cuts,
            target_clip_min_duration,
            target_clip_max_duration
        )

        ranked_clips: List[HighlightClip] = []
        for start, end in candidate_windows:
            # 1. Semantic Hook Score
            hook_score, hook_summary = self._evaluate_hook_strength(start, end, segments)
            
            # 2. Audio Energy Score
            audio_score = self._evaluate_audio_energy(start, end, wav_path)
            
            # 3. Visual Pacing Score
            visual_score = self._evaluate_visual_pacing(start, end, scene_cuts)
            
            # 4. Topic Coherence Score
            topic_score, snippet = self._evaluate_topic_coherence(start, end, segments)
            
            # Composite Virality Score
            composite = (
                0.35 * hook_score +
                0.25 * audio_score +
                0.20 * visual_score +
                0.20 * topic_score
            )
            virality_score = int(np.clip(round(composite), 50, 99))
            
            # Generate descriptive clip title
            clip_title = self._generate_clip_title(snippet, hook_summary)
            
            reason = (
                f"High-retention opening ({hook_summary}) paired with {audio_score:.0f}% vocal dynamics "
                f"and ideal {visual_score:.0f}% scene pacing for YouTube Shorts/TikTok."
            )

            breakdown = HighlightScoreBreakdown(
                hook_score=round(hook_score, 1),
                audio_energy_score=round(audio_score, 1),
                visual_pacing_score=round(visual_score, 1),
                topic_coherence_score=round(topic_score, 1)
            )

            clip = HighlightClip(
                id=f"clip_{str(uuid.uuid4())[:8]}",
                video_id=video_id,
                start=round(start, 2),
                end=round(end, 2),
                duration=round(end - start, 2),
                title=clip_title,
                virality_score=virality_score,
                breakdown=breakdown,
                reason=reason,
                transcript_snippet=snippet,
                suggested_aspect_ratio="9:16"
            )
            ranked_clips.append(clip)

        # Sort descending by virality score
        ranked_clips.sort(key=lambda c: c.virality_score, reverse=True)
        return ranked_clips[:max_clips]

    def _generate_candidate_windows(
        self,
        duration: float,
        segments: List[SpeechSegment],
        scene_cuts: List[SceneCut],
        min_dur: float,
        max_dur: float
    ) -> List[Tuple[float, float]]:
        """Find candidate window timestamps aligned with speech boundaries or scene cuts."""
        windows = []
        if not segments:
            # Fallback if no segments: sliding windows across duration
            step = 30.0
            t = 0.0
            while t + min_dur <= duration:
                windows.append((t, min(duration, t + min(45.0, duration - t))))
                t += step
            return windows

        # Anchor windows at sentence start points
        for i, seg in enumerate(segments):
            start = seg.start
            if start + min_dur > duration:
                continue
                
            # Find an end segment within min_dur and max_dur
            for j in range(i, len(segments)):
                end = segments[j].end
                dur = end - start
                if dur >= min_dur and dur <= max_dur:
                    # Check if close to a scene cut to snap
                    for cut in scene_cuts:
                        if abs(cut.timestamp - end) < 1.0 and cut.timestamp > start + min_dur:
                            end = cut.timestamp
                            break
                    windows.append((start, end))
                    break

        # If too few windows found, generate interval slices
        if len(windows) < 3:
            slice_dur = min(duration * 0.4, 40.0)
            if slice_dur >= 10.0:
                windows.append((0.0, slice_dur))
                if duration > slice_dur * 1.5:
                    mid = duration * 0.3
                    windows.append((mid, min(duration, mid + slice_dur)))
                if duration > slice_dur * 2:
                    windows.append((duration - slice_dur, duration))

        return windows

    def _evaluate_hook_strength(self, start: float, end: float, segments: List[SpeechSegment]) -> Tuple[float, str]:
        """Score the opening 5 seconds of the clip for psychological hook triggers."""
        opening_text = ""
        for seg in segments:
            if seg.start >= start and seg.start <= start + 6.0:
                opening_text += " " + seg.text

        opening_lower = opening_text.lower()
        score = 60.0
        triggers_found = []

        for word, weight in self.HOOK_TRIGGER_WORDS.items():
            if re.search(rf"\b{word}\b", opening_lower):
                score += weight
                triggers_found.append(word)

        if "?" in opening_text:
            score += 15.0
            triggers_found.append("question hook")

        score = float(np.clip(score, 45.0, 98.0))
        summary = f"Strong hook via '{', '.join(triggers_found[:2])}'" if triggers_found else "Steady opening narrative"
        return score, summary

    def _evaluate_audio_energy(self, start: float, end: float, wav_path: str) -> float:
        """Measure acoustic volume variance, dynamic peaks, and vocal intensity."""
        if not os.path.exists(wav_path):
            return 75.0

        try:
            sr, data = wavfile.read(wav_path)
            if data.dtype == np.int16:
                data = data.astype(np.float32) / 32768.0
            if len(data.shape) > 1:
                data = data.mean(axis=1)

            start_idx = int(start * sr)
            end_idx = min(len(data), int(end * sr))
            clip_data = data[start_idx:end_idx]

            if len(clip_data) < sr:
                return 70.0

            # Compute RMS in 100ms chunks
            chunk_size = int(0.1 * sr)
            num_chunks = len(clip_data) // chunk_size
            rms_vals = [
                np.sqrt(np.mean(clip_data[c * chunk_size : (c + 1) * chunk_size] ** 2))
                for c in range(num_chunks)
            ]

            rms_mean = np.mean(rms_vals)
            rms_std = np.std(rms_vals)
            # High standard deviation = expressive voice dynamics
            dynamic_range_score = 65.0 + (rms_std / (rms_mean + 1e-4)) * 30.0
            return float(np.clip(dynamic_range_score, 50.0, 96.0))

        except Exception as e:
            logger.warning(f"Audio energy evaluation fallback: {e}")
            return 78.0

    def _evaluate_visual_pacing(self, start: float, end: float, scene_cuts: List[SceneCut]) -> float:
        """Score based on scene cut density (ideal: 1 cut every 2.5 to 5.0 seconds)."""
        duration = max(1.0, end - start)
        cuts_in_range = [c for c in scene_cuts if start <= c.timestamp <= end]
        num_cuts = len(cuts_in_range)
        
        # Cuts per minute
        cpm = (num_cuts / duration) * 60.0
        # Optimal CPM for shorts is between 12 and 24 cuts/min (a cut every 2.5 to 5s)
        if 10.0 <= cpm <= 26.0:
            return 92.0
        elif 5.0 <= cpm < 10.0 or 26.0 < cpm <= 35.0:
            return 80.0
        else:
            return 68.0

    def _evaluate_topic_coherence(self, start: float, end: float, segments: List[SpeechSegment]) -> Tuple[float, str]:
        """Verify the clip text forms a coherent concept rather than being cut off mid-thought."""
        clip_texts = [s.text for s in segments if s.start >= start and s.end <= end]
        full_text = " ".join(clip_texts).strip()

        if not full_text:
            return 70.0, "Highlights from the most engaging segment of the video."

        score = 75.0
        # Ends with proper punctuation
        if full_text.endswith((".", "!", "?")):
            score += 15.0
        # Optimal word count for short form (60-150 words)
        words = full_text.split()
        if 40 <= len(words) <= 180:
            score += 10.0

        return float(np.clip(score, 55.0, 95.0)), full_text[:140] + ("..." if len(full_text) > 140 else "")

    def _generate_clip_title(self, snippet: str, hook_summary: str) -> str:
        """Generate high-impact concise clip title."""
        words = snippet.replace('"', '').replace('.', '').split()
        if len(words) >= 5:
            candidate = " ".join(words[:6]).title()
            return f"🔥 {candidate}..."
        return f"💡 Viral Insight ({hook_summary})"

highlight_ranker = HighlightRanker()
