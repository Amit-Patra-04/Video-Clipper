import { Type, Sparkles } from 'lucide-react';

const PRESETS = [
  { id: 'hormozi', name: 'Alex Hormozi', tag: 'Pop & Stroke', sample: 'VIRAL HOOK' },
  { id: 'mrbeast', name: 'MrBeast', tag: 'Bouncy Energy', sample: 'CRAZY!' },
  { id: 'neon', name: 'Cyber Neon', tag: 'Glow Effect', sample: 'FUTURE' },
  { id: 'minimal', name: 'Minimal Clean', tag: 'Subtitle Bar', sample: 'Insightful' }
];

const COLORS = [
  { name: 'Gold Yellow', hex: '#facc15' },
  { name: 'Electric Green', hex: '#22c55e' },
  { name: 'Neon Cyan', hex: '#06b6d4' },
  { name: 'Vibrant Coral', hex: '#f43f5e' },
  { name: 'Pure White', hex: '#ffffff' }
];

export default function CaptionCustomizer({ config, onChange }) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Type className="w-4 h-4 text-indigo-400" />
          Kinetic Captions Styler (GSAP)
        </h4>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          Karaoke Mode
        </span>
      </div>

      {/* Preset Selector */}
      <div>
        <label className="text-xs font-semibold text-slate-400 mb-2 block">
          Viral Caption Styles
        </label>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(p => {
            const isSelected = config.preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange({ ...config, preset: p.id })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{p.name}</span>
                  {isSelected && <Sparkles className="w-3 h-3 text-indigo-400" />}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{p.tag}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Spoken Word Highlight Color */}
      <div>
        <label className="text-xs font-semibold text-slate-400 mb-2 flex items-center justify-between">
          <span>Active Word Color</span>
          <span className="text-[11px] font-mono text-slate-500">{config.activeColor}</span>
        </label>
        <div className="flex items-center gap-2.5">
          {COLORS.map(c => {
            const isSelected = config.activeColor.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                type="button"
                onClick={() => onChange({ ...config, activeColor: c.hex })}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  isSelected
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            );
          })}
        </div>
      </div>

      {/* Font Size Slider */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1.5">
          <span>Font Size</span>
          <span className="text-indigo-400 font-mono">{config.fontSize}px</span>
        </div>
        <input
          type="range"
          min="18"
          max="42"
          value={config.fontSize}
          onChange={e => onChange({ ...config, fontSize: Number(e.target.value) })}
          className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
        />
      </div>

      {/* Position Selector */}
      <div>
        <label className="text-xs font-semibold text-slate-400 mb-2 block">
          Vertical Screen Position
        </label>
        <div className="grid grid-cols-3 gap-2">
          {['top', 'center', 'bottom'].map(pos => {
            const isSelected = config.position === pos;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => onChange({ ...config, position: pos })}
                className={`py-2 px-3 rounded-lg text-xs font-medium capitalize border transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {pos}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
