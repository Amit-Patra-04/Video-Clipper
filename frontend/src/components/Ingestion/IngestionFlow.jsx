import { useState, useRef } from 'react';
import {
  Upload,
  Video,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  PlayCircle
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function IngestionFlow({ onSuccess, onDemoLoad }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'youtube'
  const [selectedFile, setSelectedFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [targetDuration, setTargetDuration] = useState('auto'); // 'auto' | '30s' | '60s' | '90s'
  const [aiProvider, setAiProvider] = useState('gemini'); // 'gemini' | 'openai' | 'claude' | 'ollama'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [errorTitle, setErrorTitle] = useState('Validation Error');
  const [policyWarning, setPolicyWarning] = useState(null);
  const [jobResponse, setJobResponse] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // File validation
  const validateAndSelect = file => {
    setErrorMessage(null);
    setErrorTitle('Validation Error');
    setPolicyWarning(null);
    setJobResponse(null);

    if (!file) return;

    const allowedExtensions = /\.(mp4|mov|webm|mkv)$/i;
    if (!allowedExtensions.test(file.name)) {
      setErrorTitle('Unsupported File Format');
      setErrorMessage('Please select a valid video file (.mp4, .mov, .webm, .mkv).');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setErrorTitle('File Size Exceeded');
      setErrorMessage('File size exceeds the 500 MB limit.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrag = e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  // Submit Handler for either file upload or YouTube URL
  const handleSubmit = async e => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorTitle('Validation Error');
    setPolicyWarning(null);
    setJobResponse(null);
    setIsSubmitting(true);

    try {
      if (activeTab === 'upload') {
        if (!selectedFile) {
          setErrorTitle('File Required');
          setErrorMessage('Please choose a video file first.');
          setIsSubmitting(false);
          return;
        }

        const data = await apiClient.uploadToEndpoint(selectedFile, null);
        setJobResponse(data);
        if (onSuccess) {
          onSuccess(data);
        }
      } else {
        if (!youtubeUrl.trim()) {
          setErrorTitle('URL Required');
          setErrorMessage('Please enter a YouTube video URL.');
          setIsSubmitting(false);
          return;
        }

        const isYoutubeFormat = /(youtube\.com|youtu\.be)/i.test(youtubeUrl);
        if (!isYoutubeFormat) {
          setErrorTitle('Invalid YouTube URL');
          setErrorMessage('Invalid URL format. Please provide a youtube.com or youtu.be link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...).');
          setIsSubmitting(false);
          return;
        }

        const data = await apiClient.uploadToEndpoint(null, youtubeUrl.trim());
        setJobResponse(data);
        if (onSuccess) {
          onSuccess(data);
        }
      }
    } catch (err) {
      if (err.isPolicyWarning || err.status === 403) {
        // Display warning per policy (do NOT download programmatically)
        setPolicyWarning(
          err.detail ||
            'YouTube Policy Warning: Automated downloading is disallowed without OAuth authorization.'
        );
      } else if (err.isNetworkError || err.status === 502 || err.status === 504) {
        setErrorTitle('Backend Server Offline');
        setErrorMessage(
          err.message ||
            'Backend server is not reachable on http://127.0.0.1:8000. Please start the backend with: cd Video-Clipper/backend && python -m uvicorn app.main:app --port 8000 --reload'
        );
      } else {
        setErrorTitle('Submission Error');
        setErrorMessage(err.detail || err.message || 'Submission failed. Please check inputs.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-6">
      {/* Mode Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setActiveTab('upload');
            setErrorMessage(null);
            setPolicyWarning(null);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'upload'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>(a) Video File Upload (.mp4)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('youtube');
            setErrorMessage(null);
            setPolicyWarning(null);
          }}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'youtube'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>(b) YouTube URL Input</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* TAB 1: File Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
                className="hidden"
                onChange={e => e.target.files && validateAndSelect(e.target.files[0])}
              />

              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
                <Upload className="w-7 h-7" />
              </div>

              {selectedFile ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-100">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span>{selectedFile.name}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload to sandbox
                    storage
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-slate-200">
                    Drag and drop your <span className="text-indigo-400 font-bold">.mp4</span>{' '}
                    video, or click to browse
                  </p>
                  <p className="text-xs text-slate-500">
                    Supported: MP4, MOV, WebM, MKV • Max 500 MB • Sandbox Local Storage
                  </p>
                </div>
              )}
            </div>

            {/* Security Note */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Security Guardrail Active:</strong> Uploads undergo malware inspection and
                container magic byte signature validation.
              </span>
            </div>
          </div>
        )}

        {/* TAB 2: YouTube URL Input */}
        {activeTab === 'youtube' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Enter YouTube Video / Shorts URL:
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={e => {
                    setYoutubeUrl(e.target.value);
                    setErrorMessage(null);
                    setPolicyWarning(null);
                  }}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* YouTube Policy Notice */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>YouTube API & Policy Guardrail Notice</span>
              </div>
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Per YouTube Terms of Service, automated programmatic downloading of third-party
                video streams is strictly disallowed. Only authorized content from authenticated
                channel-owner OAuth accounts is permitted. If OAuth permissions are unconfigured, a
                policy warning will be triggered without attempting download.
              </p>
            </div>
          </div>
        )}

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-bold text-rose-300">{errorTitle}</p>
              <p className="text-rose-400/90 leading-relaxed font-mono text-[11px] whitespace-pre-wrap break-words">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Policy Warning Feedback */}
        {policyWarning && (
          <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200 space-y-1.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Policy Restriction Warning</span>
            </div>
            <p className="text-[11px] text-amber-300/90 leading-relaxed">{policyWarning}</p>
            <div className="pt-1 text-[11px] text-slate-400">
              👉 <em>Recommendation:</em> Switch to <strong>(a) Video File Upload</strong> to
              process user-owned MP4 videos directly.
            </div>
          </div>
        )}

        {/* Success Feedback Banner with Job ID */}
        {jobResponse && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{jobResponse.message || 'Upload successful, job queued'}</span>
              </div>
              <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Status: {jobResponse.status}
              </span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-lg border border-emerald-500/20 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Job ID:</span>
                <span className="text-indigo-400 font-bold">{jobResponse.job_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Video ID:</span>
                <span className="text-slate-300">{jobResponse.video_id}</span>
              </div>
              {jobResponse.filename && (
                <div className="flex justify-between">
                  <span className="text-slate-400">File:</span>
                  <span className="text-slate-300">{jobResponse.filename}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SupoClip AI Clipping Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Target Clip Duration</span>
              <span className="text-[10px] text-indigo-400 font-mono">OpusClip Style</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'auto', label: 'Auto' },
                { id: '30s', label: '< 30s' },
                { id: '60s', label: '30-60s' },
                { id: '90s', label: '60-90s' }
              ].map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setTargetDuration(d.id)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                    targetDuration === d.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>AI Virality Model</span>
              <span className="text-[10px] text-emerald-400 font-mono">Multi-Provider</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'gemini', label: 'Gemini' },
                { id: 'openai', label: 'GPT-4o' },
                { id: 'claude', label: 'Claude' },
                { id: 'ollama', label: 'Ollama' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAiProvider(p.id)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                    aiProvider === p.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={
              isSubmitting ||
              (activeTab === 'upload' && !selectedFile) ||
              (activeTab === 'youtube' && !youtubeUrl.trim())
            }
            className="w-full sm:flex-1 py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>POST /api/upload...</span>
              </>
            ) : (
              <>
                <span>Submit to Ingestion Pipeline</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onDemoLoad}
            disabled={isSubmitting}
            className="w-full sm:w-auto py-3.5 px-4 rounded-xl font-medium text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center justify-center gap-2 transition-colors"
          >
            <PlayCircle className="w-4 h-4 text-emerald-400" />
            <span>Try Sample Video</span>
          </button>
        </div>
      </form>
    </div>
  );
}
