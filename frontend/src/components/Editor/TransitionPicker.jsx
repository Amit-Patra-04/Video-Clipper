import { SlidersHorizontal } from 'lucide-react';

const TRANSITIONS = [
  { id: 'cut', label: 'Jump Cut', desc: 'Direct snappy edit' },
  { id: 'fade', label: 'Cross Dissolve', desc: 'Smooth fade transition' },
  { id: 'zoom', label: 'Punch Zoom', desc: 'Inward kinetic push' },
  { id: 'wipe', label: 'Whip Pan', desc: 'High-energy fast pan' }
];

export default function TransitionPicker({ selected, onSelect }) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-3">
        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
          Scene Transitions
        </h4>
        <span className="text-[10px] text-slate-400">FFmpeg Render Filters</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TRANSITIONS.map(t => {
          const isSelected = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="text-xs font-semibold">{t.label}</div>
              <div className="text-[10px] text-slate-500">{t.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
