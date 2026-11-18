import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import {
  FileVideo,
  AudioWaveform,
  MessageSquareText,
  Users,
  Film,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertCircle
} from 'lucide-react';

const STAGES = [
  { id: 'probing', label: 'Probing & Inspection', icon: FileVideo, desc: 'Probing video stream, fps, and codecs' },
  { id: 'audio_extract', label: 'FFmpeg Audio Extraction', icon: AudioWaveform, desc: 'Extracting 16kHz mono PCM stream' },
  { id: 'stt', label: 'Speech-to-Text Transcribe', icon: MessageSquareText, desc: 'Whisper word-level timestamp alignment' },
  { id: 'diarize', label: 'Speaker Diarization', icon: Users, desc: 'Clustering dialogue turns & speakers' },
  { id: 'scene_detect', label: 'Visual Scene Cuts', icon: Film, desc: 'FFmpeg scene change sensitivity filter' },
  { id: 'highlight_ranking', label: 'AI Virality Scoring', icon: Sparkles, desc: 'Hook strength & acoustic energy ranking' }
];

export default function PipelineStatus({ progress, onRetry }) {
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);

  useEffect(() => {
    if (progressBarRef.current) {
      gsap.to(progressBarRef.current, {
        width: `${progress.progress}%`,
        duration: 0.6,
        ease: 'power2.out'
      });
    }
  }, [progress.progress]);

  const getCurrentIndex = () => {
    const idx = STAGES.findIndex((s) => s.id === progress.current_stage);
    return idx === -1 ? 0 : idx;
  };

  const activeIdx = getCurrentIndex();
  const isFailed = progress.status === 'failed';

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
            <span>Pipeline Processing Engine</span>
            {progress.status === 'completed' ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Complete
              </span>
            ) : isFailed ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                Failed
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {progress.message || 'Executing end-to-end automated multimodal analysis'}
          </p>
        </div>

        <div className="text-right">
          <span className="text-2xl font-black text-indigo-400 font-mono">
            {progress.progress}%
          </span>
        </div>
      </div>

      {/* Main Progress Bar */}
      <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden mb-8 border border-slate-800">
        <div
          ref={progressBarRef}
          className={`h-full transition-all duration-300 ${
            isFailed
              ? 'bg-rose-500'
              : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/50'
          }`}
          style={{ width: `${progress.progress}%` }}
        />
      </div>

      {/* Stage Stepper List */}
      <div className="space-y-3">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isDone = progress.stages_completed?.includes(stage.id) || idx < activeIdx;
          const isCurrent = progress.current_stage === stage.id && !isFailed && progress.status !== 'completed';

          return (
            <div
              key={stage.id}
              className={`flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 ${
                isCurrent
                  ? 'bg-indigo-500/10 border-indigo-500/40 text-white shadow-md'
                  : isDone
                  ? 'bg-slate-950/40 border-slate-800/80 text-slate-300'
                  : 'bg-slate-950/20 border-slate-900 text-slate-500'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isDone
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : isCurrent
                    ? 'bg-indigo-600 text-white animate-pulse'
                    : 'bg-slate-800/60 text-slate-600'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold truncate">{stage.label}</h4>
                  {isCurrent && (
                    <span className="text-[11px] font-mono text-indigo-400 animate-pulse">Running...</span>
                  )}
                  {isDone && (
                    <span className="text-[11px] text-emerald-400 font-medium">Done</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate">{stage.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {isFailed && (
        <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-rose-300">
            <p className="font-semibold">Pipeline encountered an error</p>
            <p className="mt-0.5 text-rose-400/90">{progress.error || 'Unknown failure'}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors"
              >
                Retry Analysis
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
