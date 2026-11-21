import { Flame, Zap, Lightbulb, Share2 } from 'lucide-react';

export default function ViralityScoreCard({ breakdown, score, reason }) {
  if (!breakdown) return null;

  // SupoClip 4-Factor Virality Pillars
  const hookScore = Math.round(breakdown.hook_score ?? 85);
  const engagementScore = Math.round(breakdown.engagement_score ?? breakdown.audio_energy_score ?? 80);
  const valueScore = Math.round(breakdown.value_score ?? breakdown.topic_coherence_score ?? 82);
  const shareabilityScore = Math.round(breakdown.shareability_score ?? breakdown.visual_pacing_score ?? 84);

  const metrics = [
    {
      label: 'Hook Strength',
      sublabel: 'Opening 3-5s grab',
      val: hookScore,
      icon: Flame,
      color: 'text-amber-400',
      barColor: 'bg-gradient-to-r from-amber-500 to-rose-500'
    },
    {
      label: 'Engagement',
      sublabel: 'Vocal energy & pacing',
      val: engagementScore,
      icon: Zap,
      color: 'text-yellow-400',
      barColor: 'bg-gradient-to-r from-yellow-400 to-amber-500'
    },
    {
      label: 'Value / Epiphany',
      sublabel: 'Punchline & takeaway',
      val: valueScore,
      icon: Lightbulb,
      color: 'text-cyan-400',
      barColor: 'bg-gradient-to-r from-cyan-400 to-blue-500'
    },
    {
      label: 'Shareability',
      sublabel: 'Relatable & debate',
      val: shareabilityScore,
      icon: Share2,
      color: 'text-purple-400',
      barColor: 'bg-gradient-to-r from-purple-400 to-pink-500'
    }
  ];

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          <span>OpusClip Virality Breakdown</span>
        </span>
        <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
          {score}/100
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metrics.map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-slate-200">
                  <Icon className={`w-3 h-3 ${m.color}`} />
                  {m.label}
                </span>
                <span className="font-mono text-[10px] font-bold text-slate-300">{m.val}%</span>
              </div>
              <div className="text-[9px] text-slate-400 truncate">{m.sublabel}</div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${m.barColor}`} style={{ width: `${m.val}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {reason && (
        <p className="text-[11px] text-slate-300 leading-relaxed italic border-t border-slate-800/80 pt-2 bg-slate-950/40 p-2 rounded-lg">
          &ldquo;{reason}&rdquo;
        </p>
      )}
    </div>
  );
}
