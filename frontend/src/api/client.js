const API_BASE = '/api';

export const apiClient = {
  async checkHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  /**
   * Unified Ingestion Endpoint: POST /api/upload (or /upload)
   * Handles (a) Video file upload or (b) YouTube URL input
   */
  async uploadToEndpoint(file = null, youtubeUrl = null, allowDirectDownload = false) {
    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    }
    if (youtubeUrl) {
      formData.append('youtube_url', youtubeUrl);
    }
    if (allowDirectDownload) {
      formData.append('allow_direct_download', 'true');
    }

    let res;
    try {
      res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      });
    } catch {
      const errorObj = new Error(
        'Backend server is not reachable. Please start the FastAPI backend server on http://127.0.0.1:8000 (cd Video-Clipper/backend && python -m uvicorn app.main:app --port 8000 --reload).'
      );
      errorObj.isNetworkError = true;
      throw errorObj;
    }

    // Check for Vite dev server proxy errors (502 Bad Gateway / 504 Gateway Timeout)
    if (res.status === 502 || res.status === 504) {
      const errorObj = new Error(
        `Backend server is offline (HTTP ${res.status} Bad Gateway/Timeout). Please ensure the FastAPI backend is running on http://127.0.0.1:8000.`
      );
      errorObj.status = res.status;
      errorObj.isNetworkError = true;
      throw errorObj;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      let detailMsg = 'Upload failed';
      if (typeof data.detail === 'string') {
        detailMsg = data.detail;
      } else if (Array.isArray(data.detail)) {
        detailMsg = data.detail.map(d => d.msg || JSON.stringify(d)).join(', ');
      }

      const errorObj = new Error(detailMsg);
      errorObj.status = res.status;
      errorObj.detail = detailMsg;
      errorObj.isPolicyWarning = res.status === 403;
      throw errorObj;
    }

    return data;
  },

  async getJobStatus(jobId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    if (!res.ok) throw new Error('Failed to retrieve job status');
    return res.json();
  },

  async getJobSegments(jobId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/segments`);
    if (!res.ok) throw new Error('Failed to fetch job segments');
    return res.json();
  },

  async listRecentJobs() {
    const res = await fetch(`${API_BASE}/jobs`);
    if (!res.ok) throw new Error('Failed to retrieve jobs');
    return res.json();
  },

  async uploadVideo(file) {
    return this.uploadToEndpoint(file, null);
  },

  async ingestYoutube(url) {
    return this.uploadToEndpoint(null, url);
  },

  async getPipelineStatus(videoId) {
    const res = await fetch(`${API_BASE}/pipeline/${videoId}/status`);
    if (!res.ok) throw new Error('Failed to fetch pipeline status');
    return res.json();
  },

  async getClips(videoId) {
    const res = await fetch(`${API_BASE}/clips/${videoId}`);
    if (!res.ok) throw new Error('Failed to fetch clips');
    return res.json();
  },

  async getTranscripts(videoId) {
    const res = await fetch(`${API_BASE}/clips/${videoId}/transcripts`);
    if (!res.ok) throw new Error('Failed to fetch transcripts');
    return res.json();
  },

  async updateCaptions(videoId, segments) {
    const res = await fetch(`${API_BASE}/clips/${videoId}/captions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(segments)
    });
    if (!res.ok) throw new Error('Failed to update captions');
    return res.json();
  },

  async getVTTUrl(videoId) {
    return `${API_BASE}/clips/${videoId}/vtt`;
  },

  async getVideoMetadata(videoId) {
    const res = await fetch(`${API_BASE}/clips/${videoId}/metadata`);
    if (!res.ok) throw new Error('Failed to fetch video metadata');
    return res.json();
  },

  async generateMetadata(videoId, clipId = null, customContext = null) {
    const res = await fetch(`${API_BASE}/metadata/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        clip_id: clipId,
        custom_context: customContext
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Metadata generation failed' }));
      throw new Error(err.detail || 'Metadata generation failed');
    }
    return res.json();
  },

  async renderExport(payload) {
    const res = await fetch(`${API_BASE}/export/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Export rendering failed' }));
      throw new Error(err.detail || 'Export rendering failed');
    }
    return res.json();
  }
};
