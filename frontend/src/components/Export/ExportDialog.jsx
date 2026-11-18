import React, { useState } from 'react';
import {
  Download,
  Film,
  Sparkles,
  Volume2,
  CheckCircle2,
  X,
  Loader2,
  Check
} from 'lucide-react';
import { apiClient } from '../../api/client';

export default function ExportDialog({
  isOpen,
  onClose,
  videoId,
  clipId,
  trimStart,
  trimEnd,
  aspectRatio,
  captionConfig
}) {
  const [burnCaptions, setBurnCaptions] = useState(true);
  const [audioNormalize, setAudioNormalize] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [renderResult, setRenderResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    setIsRendering(true);
    setError(null);

    try {
      const payload = {
        video_id: videoId,
        clip_id: clipId,
        start: trimStart,
        end: trimEnd,
        aspect_ratio: aspectRatio,
        burn_captions: burnCaptions,
        caption_preset: captionConfig.preset,
        font_size: captionConfig.fontSize,
        active_color: captionConfig.activeColor,
        audio_normalize: audioNormalize
      };

      const result = await apiClient.renderExport(payload);
      setRenderResult(result);
    } catch (err) {
      setError(err.message || 'Export rendering failed');
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white">Export & Render Clip</h3>
            <p className="text-xs text-slate-400">FFmpeg 1080p H.264 High Profile Encoding</p>
          </div>
        </div>

        {renderResult ? (
          <div className="space-y-5 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-bold text-white">Rendering Complete!</h4>
              <p className="text-xs text-slate-400">
                Duration: {renderResult.duration}s • File Size: {(renderResult.file_size_bytes / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>

            <a
              href={renderResult.download_url}
              download
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Download MP4 Video</span>
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary specifications */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Aspect Ratio:</span>
                <span className="font-semibold text-indigo-400">{aspectRatio}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trim Range:</span>
                <span className="font-mono text-slate-200">
                  {trimStart.toFixed(1)}s - {trimEnd.toFixed(1)}s ({(trimEnd - trimStart).toFixed(1)}s)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Caption Style:</span>
                <span className="font-semibold text-slate-200 capitalize">{captionConfig.preset}</span>
              </div>
            </div>

            {/* Burn-in captions toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">Burn Kinetic Captions</div>
                  <div className="text-[10px] text-slate-500">Hardcode animated karaoke ASS subtitles</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={burnCaptions}
                onChange={(e) => setBurnCaptions(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Audio Normalization toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-slate-800">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">EBU R128 Audio Normalization</div>
                  <div className="text-[10px] text-slate-500">Standardize loudness (-16 LUFS) for mobile feeds</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={audioNormalize}
                onChange={(e) => setAudioNormalize(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 cursor-pointer"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
                {error}
              </div>
            )}

            <button
              onClick={handleStartRender}
              disabled={isRendering}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Encoding with FFmpeg...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Start FFmpeg Render</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
