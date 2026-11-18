import { Smartphone, Square, Tv } from 'lucide-react';

const RATIOS = [
  { id: '9:16', label: '9:16 Shorts', desc: 'TikTok, Reels, Shorts', icon: Smartphone },
  { id: '1:1', label: '1:1 Square', desc: 'Instagram, LinkedIn Feed', icon: Square },
  { id: '16:9', label: '16:9 Landscape', desc: 'YouTube, Web Video', icon: Tv }
];

export default function AspectRatioSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-xl">
      {RATIOS.map(r => {
        const Icon = r.icon;
        const isSelected = value === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isSelected
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={r.desc}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{r.label}</span>
          </button>
        );
      })}
    </div>
  );
}
