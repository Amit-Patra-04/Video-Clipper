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

## 3. Multimodal Highlight Virality Scoring Formula & Non-Overlapping Heuristics

### Decision
The composite Virality Score ($Score \in [50, 99]$) is computed using four multi-modal cue pillars:

$$Score = 0.30 \times S_{\text{audio}} + 0.25 \times S_{\text{rate}} + 0.20 \times S_{\text{novelty}} + 0.25 \times S_{\text{textual}}$$

### Cue Breakdown & Heuristics:
1. **$S_{\text{audio}}$ (Audio Amplitude & Word Volume — 30%)**:
   - Calculates RMS energy and peak amplitude from 16kHz mono audio slice.
   - Measures short-time RMS dynamic ratio ($\frac{\sigma_{\text{rms}}}{\mu_{\text{rms}}}$) over 100ms chunks.
   - Audio spikes (cheering, loud applause, vocal excitement surges) boost this score and attach explainable reasons: `High audio amplitude peak (vocal surge / excitement)` or `Loud applause opening`.
2. **$S_{\text{rate}}$ (Speaking Rate & Speech Pacing — 25%)**:
   - Computes words spoken per second: $\text{WPS} = \frac{\text{Word Count}}{\text{Duration}}$.
   - Optimal engagement on vertical short-form platforms is fast, energetic delivery ($2.8 \le \text{WPS} \le 4.2$).
   - Scores 95.0 for energetic speech, 86.0 for fast pacing, and penalizes sluggish delivery (< 1.6 WPS).
   - Generates reason: `Fast speaking rate (3.4 words/sec)`.
3. **$S_{\text{novelty}}$ (Visual Novelty & Scene Transitions — 20%)**:
   - Integrates scene cut points detected by PySceneDetect.
   - Evaluates cuts per minute (CPM). Optimal cut pacing for short-form retention is 10 to 28 CPM (1 cut every 2.5 to 6s).
   - Generates reason: `Visual novelty (N dynamic scene transitions)` or `Scene cut at topic transition`.
4. **$S_{\text{textual}}$ (Textual & Semantic Analysis — 25%)**:
   - **Configurable Keywords**: Scans segment text against `settings.HIGHLIGHT_KEYWORDS` (`"secret"`, `"never"`, `"revenue"`, `"mistake"`, `"growth"`, `"game changer"`, etc.).
   - **Opening Hook Check**: Analyzes question hooks (`"?"`) and curiosity gap words in the first 5 seconds.
   - **Optional LLM-based Analysis**: When `OPENAI_API_KEY` is present, prompts the LLM with the **actual transcript text** (guardrail: no hallucinations or blind links). If external keys are absent, relies on the deterministic keyword and syntax heuristic.
   - Generates reason: `Trigger keywords detected ('secret', 'revenue')` or `High-curiosity question hook`.

### Non-Overlapping & Ranking Guarantees:
- **Strictly Non-Overlapping**: Applies greedy interval selection where no candidate is accepted if $\max(s_1, s_2) < \min(e_1, e_2)$.
- **At Least 5 Segments**: Guarantees $\ge 5$ non-overlapping segments even on short videos by adaptively partitioning timeline gaps.
- **Descending Order**: Segments are strictly ordered such that $Score_1 \ge Score_2 \ge Score_3 \ge \dots$
- **Database Persistence**: Top segments are serialized into `JobModel.segments_json` in SQLite and exposed via `GET /api/jobs/{job_id}/segments`.

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

---

## 6. PySceneDetect & Cloud Speech-to-Text Pipeline Integration

### Decision
1. **Scene Boundary Detection**: Employ **PySceneDetect** with `ContentDetector(threshold=27.0)` as primary visual cut detector, returning SMPTE standard timecodes (`HH:MM:SS.mmm`) with an FFmpeg filter fallback.
2. **Dual Cloud STT Integration**: Support both **AssemblyAI v2 API** (`speaker_labels=True` for native cloud diarization) and **OpenAI Whisper API** with word timestamps (`timestamp_granularities=["word", "segment"]`).
3. **Resilient Worker Pipeline with Retries**: Execute background processing through `VideoPipelineWorker` with exponential backoff (up to 3 retries) and real-time database milestone tracking (`"Extracting Audio"`, `"Transcribed"`, `"Scanning Scenes"`, `"Scanned Scenes"`, `"Completed"`, `"Failed"`).
4. **Auto-Migrating SQLite Schema**: Automatic non-destructive column detection and addition (`ALTER TABLE jobs ADD COLUMN ...`) in `init_db()` ensuring smooth local zero-downtime upgrades.

---

## 7. Captioning System, WebVTT Generation & Real-Time Styling

### Decision
1. **Time-Coded WebVTT Export**: Provide RFC 8216 compliant WebVTT generation with standardized timecodes (`HH:MM:SS.mmm --> HH:MM:SS.mmm`) both client-side and server-side (`GET /api/clips/{video_id}/vtt`).
2. **Interactive Live Overlay & GSAP Animations**: Show captions directly on HTML5 video previews using positioned layers with entry animations (`gsap.fromTo`) and kinetic word pop-ins.
3. **Double-Click Inline Editing & Timing Dragging**: Users can double-click caption text directly on the video player or edit in the inspector list, with full timing adjustment (start/end seconds).
4. **Tailwind Class Styling**: Fonts, sizes, and colors are selected using Tailwind CSS utility classes and update the live video preview in real time.
5. **Security & Accessibility Guardrails**:
   - **XSS Sanitization**: User inputs are stripped of malicious `<script>` and HTML tags and entity-escaped before model persistence.
   - **Semantic HTML & ARIA**: Caption container implements `role="region"`, `aria-label="Synchronized Captions"`, `aria-live="polite"`, and `role="status"` with `aria-atomic="true"`.

---

## 8. Clip Editor UI, Multi-Track Canvas & FFmpeg Export Pipeline

### Decision
1. **Multi-Track Timeline with HTML5 Canvas**: Visual tracks for Video (scenes & thumbnails), Audio (interactive `<canvas>` waveform peaks), and Speech (color-coded speaker blocks), paired with dynamic trim handles and red playhead scrubber.
2. **Crop & Aspect Ratio Reframing**: Live aspect ratio selector (9:16 vertical shorts, 1:1 square, 16:9 landscape, and original resolution). Crop and trim controls immediately update the HTML5 video preview.
3. **Scene Transitions (Cut & Fade)**: Supports instant Jump Cuts (`cut`) and smooth Cross-Dissolves (`fade`), implemented with FFmpeg's `fade=t=in...` and `afade=t=in...` filters.
4. **Quality & Audio Sync Guardrails**:
   - **No Upscaling Beyond Source Quality**: Probes source resolution; clamps target crop dimensions to source bounds and encodes at visually lossless `-crf 18` with `-pix_fmt yuv420p`.
   - **Post-Export Audio Sync**: Uses `-avoid_negative_ts make_zero` and `-af aresample=async=1` to guarantee audio never drifts post-export.
   - **Progress & Error Handling**: Step-by-step progress indication with graceful error handling and direct high-quality MP4 download.

---

## 9. AI YouTube Shorts Metadata Generation & Official Policy Compliance

### Decision
1. **Title Length & Keyword Inclusion**:
   - Enforce hard limit of $\le 100$ characters per YouTube title regulations.
   - Recommended range: 50–70 characters to prevent truncation across mobile feeds and YouTube Shorts shelves.
   - Incorporate extracted core keywords directly from the clip's transcript and title, preventing generic or hallucinatory titles.
2. **Shorts Description Best Practice**:
   - Concise 1–2 sentences summarizing the specific clip's content and hook.
3. **Hashtags Policy & Constraints**:
   - Strictly up to 3 relevant hashtags recommended for YouTube Shorts (e.g., `#Shorts` + 1–2 topic tags).
   - Filter and ignore any hashtags exceeding 30 characters (ignored by YouTube).
   - Deceptive metadata guardrail: Tags must directly relate to speech transcript.
4. **Over-tagging Violation Warning (>60 Tags)**:
   - Official Citation: [YouTube Support — Hashtags on YouTube](https://support.google.com/youtube/answer/6390658).
   - "If a video has more than 60 hashtags, we'll ignore each hashtag on that video. Over-tagging may result in the removal of your video from your uploads or from search."
   - The UI and API actively flag and display alerts whenever tags exceed 60.
5. **Manual Override & User Control**:
   - Users can freely edit Title, Description, and Hashtags in the UI with live character and sentence counters.
   - Clicking "Reset to AI" allows reverting back to original AI recommendations.
   - "Save Changes" persists overrides to the client/backend metadata suite.

---

## 10. Security Hardening, Structured Logging, and Telemetry Instrumentation

### Decision
1. **Sliding-Window Rate Limiting**:
   - Heavy mutation endpoints (`/upload`, `/api/upload`, `/api/export/render`, `/api/metadata/generate`) are throttled at 20–30 requests per minute per IP.
   - Standard read routes are allocated 60–120 requests per minute per IP to avoid hindering normal creators.
   - Throttled requests receive `HTTP 429 Too Many Requests` with RFC 6585 compliant headers: `Retry-After`, `X-RateLimit-Limit`, and `X-RateLimit-Remaining: 0`.
2. **PII and Credential Sanitization**:
   - Custom `SensitiveDataFilter` in the logging pipeline scrubs Authorization tokens (`Bearer ...`), OpenAI / Google API keys (`sk-...`, `AIza...`), passwords, email addresses, and client IPv4 addresses (anonymizing the last octet: `192.168.1.xxx`).
   - Ensures zero debug log leaks of user identity, credentials, or confidential headers.
3. **Pipeline Telemetry & Prometheus Metrics**:
   - `MetricsService` instruments the video processing pipeline, exporting metrics via `GET /api/metrics` (JSON) and `GET /metrics` (Prometheus text format).
   - Tracks job durations (average, min, max), error rates percentage, active queue length, and stage durations (`audio_extract`, `stt`, `diarize`, `scene_detect`, `highlight_ranking`).
   - **Alerting**: Automated alert counters and warnings trigger if STT fails (`metrics_service.record_stt_warning`) or if requests are throttled (`metrics_service.record_rate_limit_block`).
4. **HTTPS Enforcement & Production Security Headers**:
   - Security middleware attaches `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and a restrictive `Content-Security-Policy`.
   - In production environments, non-HTTPS traffic is redirected via `HTTP 308 Permanent Redirect`.
5. **Rigorous CI Coverage Guardrail**:
   - Pytest suite configured with `--cov=app --cov-report=term-missing --cov-fail-under=80` enforcing $\ge 80\%$ test coverage on every commit.
