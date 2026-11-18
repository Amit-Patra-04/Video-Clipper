import { useState } from 'react';
import { Sparkles, Flame, Clock, Play, ChevronDown, ChevronUp } from 'lucide-react';
import ViralityScoreCard from './ViralityScoreCard';

export default function HighlightLeaderboard({ clips = [], selectedClipId, onSelectClip }) {
  const [expandedClipId, setExpandedClipId] = useState(null);

  const toggleExpand = (clipId, e) => {
    e.stopPropagation();
    setExpandedClipId(expandedClipId === clipId ? null : clipId);
  };

  if (!clips || clips.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center">
        <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-300">No Highlights Available</h4>
        <p className="text-xs text-slate-500 mt-1">
          Upload and run the AI pipeline to rank viral moments.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-rose-500" />
            AI Highlight Leaderboard
          </h3>
          <p className="text-[11px] text-slate-400">Ranked by Viral Retention Probability</p>
        </div>
        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
          {clips.length} Clips Found
        </span>
      </div>

      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {clips.map((clip, index) => {
          const isSelected = selectedClipId === clip.id;
          const isExpanded = expandedClipId === clip.id;

          return (
            <div
              key={clip.id}
              onClick={() => onSelectClip(clip)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600/15 border-indigo-500 shadow-lg'
                  : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-center shrink-0">
                    #{index + 1}
                  </span>
                  <h4 className="text-xs font-bold text-slate-100 line-clamp-1">{clip.title}</h4>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      clip.virality_score >= 85
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    🔥 {clip.virality_score} / 100
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                &ldquo;{clip.transcript_snippet}&rdquo;
              </p>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-2 font-mono">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>
                    {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s
                  </span>
                  <span className="text-slate-600">({clip.duration.toFixed(0)}s)</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={e => toggleExpand(clip.id, e)}
                    className="text-[10px] text-slate-400 hover:text-indigo-400 flex items-center gap-0.5"
                  >
                    <span>Factors</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  <button
                    type="button"
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-2.5 h-2.5 fill-white" />
                    Load
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-2">
                  <ViralityScoreCard
                    breakdown={clip.breakdown}
                    score={clip.virality_score}
                    reason={clip.reason}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
