# AutoClip AI — REST API Specification

Base URL: `http://localhost:8000/api`

Interactive Swagger Docs: `http://localhost:8000/api/docs`  
Interactive ReDoc: `http://localhost:8000/api/redoc`

---

## 1. Ingestion Endpoints

### `POST /api/ingest/upload`
Upload a raw video file from client.

**Request:** `multipart/form-data`
- `file`: Video binary (`.mp4`, `.mov`, `.webm`, `.mkv`)

**Response:** `200 OK`
```json
{
  "video_id": "a1b2c3d4e5f6",
  "filename": "podcast_interview.mp4",
  "title": "Podcast Interview",
  "duration": 182.4,
  "file_path": ".../storage/uploads/a1b2c3d4e5f6_podcast_interview.mp4",
  "status": "ingested"
}
```

### `POST /api/ingest/youtube`
Download and process an authorized YouTube video link.

**Request:** `application/json`
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response:** `200 OK`
```json
{
  "video_id": "yt_dQw4w9WgXcQ_123456",
  "filename": "yt_dQw4w9WgXcQ_Rick_Astley.mp4",
  "title": "Rick Astley - Never Gonna Give You Up",
  "duration": 212.0,
  "file_path": ".../storage/uploads/yt_dQw4w9WgXcQ.mp4",
  "status": "ingested"
}
```

---

## 2. Pipeline Endpoints

### `GET /api/pipeline/{video_id}/status`
Poll the progress of video analysis.

**Response:** `200 OK`
```json
{
  "video_id": "a1b2c3d4e5f6",
  "status": "processing",
  "current_stage": "stt",
  "progress": 65,
  "message": "Running Speech-to-Text with word-level timestamps...",
  "stages_completed": ["probing", "audio_extract"],
  "error": null
}
```

---

## 3. Highlights & Transcripts Endpoints

### `GET /api/clips/{video_id}`
Retrieve ranked viral candidate clips.

**Response:** `200 OK`
```json
[
  {
    "id": "clip_8f3d91a2",
    "video_id": "a1b2c3d4e5f6",
    "start": 14.5,
    "end": 44.2,
    "duration": 29.7,
    "title": "🔥 The 1 Secret Behind Virality...",
    "virality_score": 96,
    "breakdown": {
      "hook_score": 98.0,
      "audio_energy_score": 94.0,
      "visual_pacing_score": 92.0,
      "topic_coherence_score": 95.0
    },
    "reason": "Exceptional curiosity gap opening hook coupled with high acoustic energy burst in first 3 seconds.",
    "transcript_snippet": "The secret reason why everyone fails at virality revealed...",
    "suggested_aspect_ratio": "9:16"
  }
]
```

### `GET /api/clips/{video_id}/transcripts`
Retrieve diarized speech segments and word timestamps.

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "speaker": "Speaker 1",
    "start": 0.0,
    "end": 5.4,
    "text": "The secret reason why everyone fails at virality revealed.",
    "words": [
      { "word": "The", "start": 0.0, "end": 0.3, "confidence": 0.95 },
      { "word": "secret", "start": 0.3, "end": 0.9, "confidence": 0.92 }
    ]
  }
]
```

---

## 4. Metadata Endpoints

### `POST /api/metadata/generate`
Generate viral title candidates, SEO descriptions, tags, and chapters.

**Request:** `application/json`
```json
{
  "video_id": "a1b2c3d4e5f6",
  "clip_id": "clip_8f3d91a2"
}
```

**Response:** `200 OK`
```json
{
  "video_id": "a1b2c3d4e5f6",
  "clip_id": "clip_8f3d91a2",
  "titles": [
    {
      "title": "The 1 Secret About Virality That Changes Everything 🤯",
      "hook_type": "Curiosity Gap",
      "estimated_ctr": "Very High (11-14%)"
    }
  ],
  "description": "Here is what happens when you understand the exact secret...",
  "tags": ["virality tips", "growth", "shorts"],
  "hashtags": ["#Shorts", "#viral", "#trending"],
  "chapters": [
    { "timestamp": "0:00", "title": "The Critical Hook" }
  ]
}
```

---

## 5. Export Endpoints

### `POST /api/export/render`
Render a clipped video with aspect ratio reframing, audio normalization, and optional burned kinetic subtitles.

**Request:** `application/json`
```json
{
  "video_id": "a1b2c3d4e5f6",
  "clip_id": "clip_8f3d91a2",
  "start": 14.5,
  "end": 44.2,
  "aspect_ratio": "9:16",
  "burn_captions": true,
  "caption_preset": "hormozi",
  "font_size": 28,
  "active_color": "#facc15",
  "audio_normalize": true
}
```

**Response:** `200 OK`
```json
{
  "export_id": "exp_4b9a1e0f",
  "video_id": "a1b2c3d4e5f6",
  "download_url": "/api/export/exp_4b9a1e0f/download",
  "file_name": "exp_4b9a1e0f_9x16.mp4",
  "file_size_bytes": 14250000,
  "duration": 29.7,
  "status": "completed"
}
```

### `GET /api/export/{export_id}/download`
Download the rendered MP4 file.
