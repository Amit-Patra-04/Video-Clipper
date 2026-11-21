import { useState } from 'react';
import { Sparkles, Flame, Clock, Play, ChevronDown, ChevronUp, Table, LayoutGrid, CheckCircle } from 'lucide-react';
import ViralityScoreCard from './ViralityScoreCard';

export default function HighlightLeaderboard({ clips = [], selectedClipId, onSelectClip }) {
  const [expandedClipId, setExpandedClipId] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

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

  // Sort descending by score
  const sortedClips = [...clips].sort((a, b) => {
    const scoreA = a.virality_score ?? a.score ?? 0;
    const scoreB = b.virality_score ?? b.score ?? 0;
    return scoreB - scoreA;
  });

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md space-y-4">
      {/* Header with Title and Mode Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-rose-500" />
            AI Highlight Leaderboard
          </h3>
          <p className="text-[11px] text-slate-400">Non-overlapping moments ranked by viral retention</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-0.5 flex items-center">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Cards View"
              className={`p-1 rounded-md text-xs transition-colors ${
                viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Segments Table View (Times & Scores)"
              className={`p-1 rounded-md text-xs transition-colors ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
            {sortedClips.length} Segments
          </span>
        </div>
      </div>

      {/* VIEW MODE 1: COMPACT TABLE (Just Times, Scores, & Explainable Reasons) */}
      {viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/50">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Time Range</th>
                <th className="py-2.5 px-3">Score</th>
                <th className="py-2.5 px-3">Explainable Reason</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {sortedClips.map((clip, index) => {
                const score = clip.virality_score ?? clip.score ?? 0;
                const isSelected = selectedClipId === clip.id;
                const startSec = Number(clip.start || 0).toFixed(1);
                const endSec = Number(clip.end || 0).toFixed(1);
                const durSec = Number(clip.duration || (clip.end - clip.start) || 0).toFixed(0);

                return (
                  <tr
                    key={clip.id}
                    onClick={() => onSelectClip && onSelectClip(clip)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-600/20 text-white font-medium' : 'hover:bg-slate-900/50'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                      #{index + 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      <span className="text-indigo-400 font-semibold">{startSec}s</span>
                      <span className="text-slate-500 mx-1">–</span>
                      <span className="text-indigo-400 font-semibold">{endSec}s</span>
                      <span className="text-slate-500 text-[10px] ml-1.5">({durSec}s)</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center font-bold px-2 py-0.5 rounded-full text-[11px] border ${
                          score >= 85
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        🔥 {score} / 100
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate text-[11px]" title={clip.reason}>
                      {clip.reason || 'Optimal multi-cue viral balance'}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectClip) onSelectClip(clip);
                        }}
                        className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold transition-colors"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* VIEW MODE 2: RICH STUDIO CARDS */
        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {sortedClips.map((clip, index) => {
            const isSelected = selectedClipId === clip.id;
            const isExpanded = expandedClipId === clip.id;
            const score = clip.virality_score ?? clip.score ?? 0;
            const startSec = Number(clip.start || 0).toFixed(1);
            const endSec = Number(clip.end || 0).toFixed(1);
            const durSec = Number(clip.duration || (clip.end - clip.start) || 0).toFixed(0);

            return (
              <div
                key={clip.id}
                onClick={() => onSelectClip && onSelectClip(clip)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500 shadow-lg'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-[11px] font-black text-indigo-300 flex items-center justify-center shrink-0">
                      #{index + 1}
                    </span>
                    <h4 className="text-xs font-bold text-slate-100 line-clamp-1">{clip.title || `Segment ${index + 1}`}</h4>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${
                        score >= 85
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      }`}
                    >
                      🔥 {score} / 100
                    </span>
                  </div>
                </div>

                {/* 4-Factor Mini Gauges (SupoClip Style) */}
                <div className="grid grid-cols-4 gap-1.5 mt-2.5 p-2 bg-slate-900/60 rounded-lg border border-slate-800/80 text-[10px]">
                  <div className="text-center">
                    <span className="text-slate-400 block text-[9px]">Hook</span>
                    <span className="font-mono font-bold text-amber-400">{Math.round(clip.breakdown?.hook_score ?? score)}%</span>
                  </div>
                  <div className="text-center border-l border-slate-800">
                    <span className="text-slate-400 block text-[9px]">Engage</span>
                    <span className="font-mono font-bold text-yellow-400">{Math.round(clip.breakdown?.engagement_score ?? clip.breakdown?.audio_energy_score ?? score)}%</span>
                  </div>
                  <div className="text-center border-l border-slate-800">
                    <span className="text-slate-400 block text-[9px]">Value</span>
                    <span className="font-mono font-bold text-cyan-400">{Math.round(clip.breakdown?.value_score ?? clip.breakdown?.topic_coherence_score ?? score)}%</span>
                  </div>
                  <div className="text-center border-l border-slate-800">
                    <span className="text-slate-400 block text-[9px]">Share</span>
                    <span className="font-mono font-bold text-purple-400">{Math.round(clip.breakdown?.shareability_score ?? clip.breakdown?.visual_pacing_score ?? score)}%</span>
                  </div>
                </div>

                {clip.transcript_snippet && (
                  <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                    &ldquo;{clip.transcript_snippet}&rdquo;
                  </p>
                )}

                {/* Explainable Reason pill / reason explanation */}
                {clip.reason && (
                  <div className="mt-2 text-[11px] text-indigo-300 bg-indigo-950/30 border border-indigo-900/40 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span><strong className="text-indigo-200">Why chosen:</strong> {clip.reason}</span>
                  </div>
                )}

                {/* Tag Pills for Specific Cues */}
                {clip.reasons && clip.reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {clip.reasons.map((r, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-slate-900 text-slate-300 border border-slate-800 px-2 py-0.5 rounded-md"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-2 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-300 font-semibold">
                      {startSec}s – {endSec}s
                    </span>
                    <span className="text-slate-500">({durSec}s)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {clip.breakdown && (
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
                    )}

                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Play className="w-2.5 h-2.5 fill-white" />
                      Load
                    </button>
                  </div>
                </div>

                {isExpanded && clip.breakdown && (
                  <div className="mt-3 pt-2">
                    <ViralityScoreCard
                      breakdown={clip.breakdown}
                      score={score}
                      reason={clip.reason}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
