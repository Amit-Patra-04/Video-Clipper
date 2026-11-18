# AutoClip AI — Product Roadmap (MVP to Production)

This roadmap outlines the evolution of AutoClip AI from the current functional MVP to a scalable, distributed cloud platform.

---

## Phase 1: MVP (Completed)
- [x] Full-stack architecture: React 19 + Vite + Tailwind CSS + GSAP + FastAPI backend.
- [x] Ingestion engine: User video uploads (MP4, MOV, WebM, MKV) with file integrity checks.
- [x] Authorized YouTube import with duration caps, policy notices, and yt-dlp error handling.
- [x] FFmpeg integration: 16kHz audio extraction, metadata probing, and 9:16 vertical / 1:1 reframing.
- [x] Speech-to-Text with word-level timestamps (OpenAI Whisper + acoustic fallback).
- [x] Speaker Diarization identifying speech turns and speakers.
- [x] Visual Scene Change Detection using FFmpeg filters.
- [x] Multimodal AI Virality Scoring Engine (Hook, Audio Energy, Visual Pacing, Topic Arc).
- [x] Interactive Editor with multi-aspect ratio video canvas, trim handles, playhead scrubber, and waveform.
- [x] GSAP-powered kinetic captions with presets (Alex Hormozi, MrBeast, Minimal, Cyber Neon).
- [x] AI YouTube Metadata Studio (5 viral title variations, descriptions, tags, chapters).
- [x] Export rendering with burned ASS kinetic subtitles and EBU R128 audio normalization.
- [x] Pytest backend test suite (15 tests) & Vitest frontend test suite.
- [x] GitHub Actions CI workflow & Docker Compose configuration.

---

## Phase 2: Production Hardening (Next Milestone)
- [ ] **Distributed Task Queue**:
  - Replace in-memory worker with Redis + Celery / ARQ worker queue.
  - Implement task cancellation and real-time progress broadcast via WebSockets.
- [ ] **GPU Acceleration**:
  - Enable NVIDIA NVENC (`h264_nvenc`) in FFmpeg for 10x faster export encoding.
  - Run local Whisper `large-v3` on CUDA.
- [ ] **Facial Recognition & Active Speaker Tracking**:
  - Implement YOLOv8-face / MediaPipe face tracking to dynamically pan the 9:16 vertical crop to keep the active speaker centered.
- [ ] **Object Storage**:
  - Integrate AWS S3 / Cloudflare R2 / Google Cloud Storage for scalable video asset hosting.
  - Generate presigned URLs for client-side direct uploads.

---

## Phase 3: Advanced Studio & Publishing (Enterprise Scale)
- [ ] **One-Click Social Publishing**:
  - Direct OAuth2 integration with YouTube Data API v3 (auto-upload to YouTube Shorts).
  - TikTok and Instagram Reels publishing API integration.
- [ ] **Custom Brand Kit**:
  - Custom font uploads (OTF/TTF).
  - Custom brand color palettes, watermark logos, and intro/outro video clips.
- [ ] **B-Roll Auto-Insertion**:
  - AI semantic B-Roll search to automatically insert relevant stock video overlays (Pexels / Storyblocks) during long monologue pauses.
- [ ] **Multi-User Collaboration & Teams**:
  - Workspace sharing, editor role-based permissions, and client approval links.
