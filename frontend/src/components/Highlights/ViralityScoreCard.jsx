import React from 'react';
import { Flame, Zap, Eye, BookOpen } from 'lucide-react';

export default function ViralityScoreCard({ breakdown, score, reason }) {
  if (!breakdown) return null;

  const metrics = [
    { label: 'Opening Hook', val: breakdown.hook_score, icon: Flame, color: 'text-amber-400', weight: '35%' },
    { label: 'Audio Energy', val: breakdown.audio_energy_score, icon: Zap, color: 'text-yellow-400', weight: '25%' },
    { label: 'Visual Pacing', val: breakdown.visual_pacing_score, icon: Eye, color: 'text-cyan-400', weight: '20%' },
    { label: 'Story Arc', val: breakdown.topic_coherence_score, icon: BookOpen, color: 'text-purple-400', weight: '20%' }
  ];

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300">Virality Factors</span>
        <span className="text-xs font-mono font-bold text-indigo-400">{score}/100</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span className="flex items-center gap-1 font-medium text-slate-300">
                  <Icon className={`w-3 h-3 ${m.color}`} />
                  {m.label}
                </span>
                <span className="font-mono text-slate-400">{m.val}%</span>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${m.val}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {reason && (
        <p className="text-[11px] text-slate-400 leading-relaxed italic border-t border-slate-800/80 pt-2">
          "{reason}"
        </p>
      )}
    </div>
  );
}
