const API_BASE = '/api';

export const apiClient = {
  async checkHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async uploadVideo(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/ingest/upload`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return res.json();
  },

  async ingestYoutube(url) {
    const res = await fetch(`${API_BASE}/ingest/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'YouTube import failed' }));
      throw new Error(err.detail || 'YouTube import failed');
    }
    return res.json();
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
