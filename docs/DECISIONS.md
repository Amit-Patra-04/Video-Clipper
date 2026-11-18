# Architectural Decisions & Technical Rationale

This document outlines key technical decisions made during the design and implementation of AutoClip AI.

---

## 1. Choice of Speech-to-Text (STT) Engine

### Decision
Support a multi-tiered STT architecture:
1. **OpenAI Whisper API** (`whisper-1`) with `timestamp_granularities=["word", "segment"]` for cloud execution.
2. **Google Gemini Multimodal Audio** when `GEMINI_API_KEY` is present.
3. **Built-in Acoustic VAD & Pacing Engine** as a reliable offline baseline.

### Rationale
- **Why word-level timestamps matter**: Modern short-form video requires kinetic, karaoke-style subtitles where each word pops or highlights at the exact fraction of a second it is spoken (e.g. Alex Hormozi or MrBeast style). Standard segment-level transcripts are insufficient.
- **Why an acoustic fallback**: Requiring third-party API keys or massive multi-gigabyte PyTorch models upfront creates high friction for local development and CI testing. The built-in acoustic VAD engine analyzes RMS energy, silence intervals, and syllable frequency to generate accurate speech intervals without external network dependencies.

---

## 2. Audio Extraction: 16kHz Mono 16-Bit PCM WAV

### Decision
Extract audio using:
```bash
ffmpeg -y -i input.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 output.wav
```

### Rationale
- 16,000 Hz (16kHz) mono is the native sample rate expected by Whisper, wav2vec2, and speaker diarization models.
- Downmixing stereo to mono eliminates spatial panning artifacts and cuts file size and memory requirements in half during speech recognition.

---

## 3. Multimodal Highlight Virality Scoring Formula

### Decision
The composite Virality Score ($V \in [0, 100]$) is computed using four weighted pillars:

$$V = 0.35 \times S_{\text{hook}} + 0.25 \times S_{\text{audio}} + 0.20 \times S_{\text{visual}} + 0.20 \times S_{\text{topic}}$$

### Breakdown & Weightings:
1. **$S_{\text{hook}}$ (Opening 3-5 Second Hook Strength — 35%)**:
   - Retention on YouTube Shorts and TikTok is heavily determined in the first 3 seconds.
   - Evaluates curiosity gaps, contrarian statements, emotional trigger words (e.g., *"secret", "never", "mistake", "warning", "insane"*), and question syntax.
2. **$S_{\text{audio}}$ (Audio Energy & Vocal Dynamics — 25%)**:
   - Computes standard deviation and peak-to-average ratio of short-time RMS energy.
   - High dynamic range indicates expressive vocal modulation and passion, whereas flat volume indicates monotone delivery that leads to viewer drop-off.
3. **$S_{\text{visual}}$ (Visual Pacing & Scene Cuts — 20%)**:
   - Evaluates cuts per minute (CPM).
   - The optimal pacing for mobile shorts is 1 cut every 2.5 to 5.0 seconds (12–24 CPM).
4. **$S_{\text{topic}}$ (Topic Arc & Punchline Coherence — 20%)**:
   - Ensures the clip starts cleanly at a sentence boundary and resolves with a punchy insight rather than trailing off mid-thought.

---

## 4. Speaker Diarization Strategy

### Decision
Implement spectral centroid and pause clustering to assign speaker identities (`Speaker 1`, `Speaker 2`).

### Rationale
- Heavy neural diarization frameworks (e.g., `pyannote.audio`) require HuggingFace token authorization and heavy GPU dependencies that fail on standard lightweight environments.
- Calculating the spectral centroid (the center of mass of the frequency spectrum) provides a reliable metric for distinguishing differing vocal timbres (e.g., deeper vs higher-pitched voices), enabling dialogue turns to be grouped cleanly for visual styling and timeline segment tracks.

---

## 5. Subtitle Rendering: GSAP Frontend + FFmpeg ASS Burn-in

### Decision
- **In-Browser Preview**: Render live interactive kinetic subtitles using **GSAP (GreenSock Animation Platform)**.
- **Exported Video**: Compile timestamps into an **Advanced SubStation Alpha (`.ass`)** subtitle file with `\k` karaoke centisecond tags and burn directly into the video stream with FFmpeg's `ass` video filter.

### Rationale
- CSS transitions struggle with sub-frame synchronization when scrubbing or playing video at variable frame rates. GSAP's timeline and easing functions (`back.out(2)`, `bounce.out`) provide the exact punchy, bouncy animations popularized by top short-form creators.
- Burning ASS subtitles with FFmpeg ensures that the rendered exported MP4 file looks identical across all social media platforms without relying on platform subtitle support.
