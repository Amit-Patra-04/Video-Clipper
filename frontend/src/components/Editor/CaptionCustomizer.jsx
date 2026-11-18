import { useState } from 'react';
import { Type, Sparkles, Download, Clock, Edit2, Check, X, Sliders } from 'lucide-react';
import { downloadVTT, sanitizeCaptionText } from '../../utils/vtt';

const PRESETS = [
  { id: 'hormozi', name: 'Alex Hormozi', tag: 'Pop & Stroke', sample: 'VIRAL HOOK' },
  { id: 'mrbeast', name: 'MrBeast', tag: 'Bouncy Energy', sample: 'CRAZY!' },
  { id: 'neon', name: 'Cyber Neon', tag: 'Glow Effect', sample: 'FUTURE' },
  { id: 'minimal', name: 'Minimal Clean', tag: 'Subtitle Bar', sample: 'Insightful' }
];

const FONTS = [
  { name: 'Modern Sans', className: 'font-sans' },
  { name: 'Impact Heavy', className: 'font-black tracking-tight' },
  { name: 'Editorial Serif', className: 'font-serif' },
  { name: 'Tech Mono', className: 'font-mono' }
];

const SIZES = [
  { label: 'S', px: 18, className: 'text-lg' },
  { label: 'M', px: 24, className: 'text-xl' },
  { label: 'L', px: 28, className: 'text-2xl' },
  { label: 'XL', px: 34, className: 'text-3xl' },
  { label: '2XL', px: 40, className: 'text-4xl' }
];

const COLORS = [
  { name: 'Gold Yellow', hex: '#facc15', tailwind: 'text-yellow-400' },
  { name: 'Electric Green', hex: '#34d399', tailwind: 'text-emerald-400' },
  { name: 'Neon Cyan', hex: '#22d3ee', tailwind: 'text-cyan-400' },
  { name: 'Vibrant Coral', hex: '#fb7185', tailwind: 'text-rose-400' },
  { name: 'Pure White', hex: '#ffffff', tailwind: 'text-white' },
  { name: 'Purple Glow', hex: '#c084fc', tailwind: 'text-purple-400' }
];

export default function CaptionCustomizer({
  config = {
    preset: 'hormozi',
    fontFamily: 'font-sans',
    fontSize: 28,
    fontSizeClass: 'text-2xl',
    textColorClass: 'text-yellow-400',
    activeColor: '#facc15',
    bgColorClass: '',
    position: 'bottom'
  },
  onChange,
  segments = [],
  onUpdateSegment
}) {
  const [editingSegId, setEditingSegId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editStart, setEditStart] = useState(0);
  const [editEnd, setEditEnd] = useState(0);

  const startEdit = (seg) => {
    setEditingSegId(seg.id);
    setEditText(seg.text);
    setEditStart(Number(seg.start || 0));
    setEditEnd(Number(seg.end || 0));
  };

  const saveEdit = (seg) => {
    if (!onUpdateSegment) return;
    const clean = sanitizeCaptionText(editText);
    const validStart = Math.max(0, Number(editStart));
    const validEnd = Math.max(validStart + 0.2, Number(editEnd));

    onUpdateSegment({
      ...seg,
      text: clean || seg.text,
      start: validStart,
      end: validEnd
    });
    setEditingSegId(null);
  };

  const cancelEdit = () => {
    setEditingSegId(null);
  };

  const handleExportVTT = () => {
    downloadVTT(segments, 'captions.vtt');
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md space-y-6">
      {/* Header with Title and VTT Export Button */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Type className="w-4 h-4 text-indigo-400" />
            Kinetic Captions & VTT Styler
          </h4>
          <p className="text-[11px] text-slate-400">Real-time Tailwind styles & interactive caption editor</p>
        </div>

        <button
          type="button"
          onClick={handleExportVTT}
          title="Export as WebVTT (.vtt) file"
          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all hover:scale-105"
        >
          <Download className="w-3.5 h-3.5" />
          Export VTT
        </button>
      </div>

      {/* Preset Selector */}
      <div>
        <label className="text-xs font-semibold text-slate-400 mb-2 block">
          Viral Caption Presets (GSAP Kinetic Animation)
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

      {/* Tailwind Typography & Font Family Options */}
      <div>
        <label className="text-xs font-semibold text-slate-400 mb-2 block">
          Font Family (Tailwind Classes)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {FONTS.map(f => {
            const isSelected = config.fontFamily === f.className;
            return (
              <button
                key={f.name}
                type="button"
                onClick={() => onChange({ ...config, fontFamily: f.className })}
                className={`py-2 px-3 rounded-lg text-xs border text-left transition-all ${f.className} ${
                  isSelected
                    ? 'bg-indigo-600/20 text-white border-indigo-500 font-bold'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {f.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tailwind Font Size Options */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
          <span>Font Size (Tailwind Class & Scale)</span>
          <span className="text-indigo-400 font-mono text-[11px]">{config.fontSize}px ({config.fontSizeClass || 'text-2xl'})</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          {SIZES.map(s => {
            const isSelected = config.fontSize === s.px;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => onChange({ ...config, fontSize: s.px, fontSizeClass: s.className })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                    : 'bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <input
          type="range"
          min="18"
          max="42"
          value={config.fontSize || 28}
          onChange={e => onChange({ ...config, fontSize: Number(e.target.value) })}
          className="w-full accent-indigo-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
        />
      </div>

      {/* Tailwind Color Options */}
      <div>
        <label className="text-xs font-semibold text-slate-400 mb-2 flex items-center justify-between">
          <span>Active Highlight Color</span>
          <span className="text-[11px] font-mono text-slate-500">{config.activeColor}</span>
        </label>
        <div className="flex items-center gap-2.5">
          {COLORS.map(c => {
            const isSelected = (config.activeColor || '').toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                type="button"
                onClick={() => onChange({ ...config, activeColor: c.hex, textColorClass: c.tailwind })}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  isSelected
                    ? 'border-white scale-110 shadow-lg'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
                title={`${c.name} (${c.tailwind})`}
              />
            );
          })}
        </div>
      </div>

      {/* Vertical Position */}
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

      {/* INTERACTIVE CAPTION SEGMENTS LIST & INLINE TIMING EDITOR */}
      <div className="border-t border-slate-800 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            Transcript Caption Segments ({segments.length})
          </label>
          <span className="text-[10px] text-slate-500">Double-click text to edit</span>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {segments.map((seg, idx) => {
            const isEditing = editingSegId === seg.id;
            return (
              <div
                key={seg.id || idx}
                className={`p-2.5 rounded-xl border text-xs transition-all ${
                  isEditing
                    ? 'bg-indigo-950/30 border-indigo-500'
                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-400">Start:</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={editStart}
                          onChange={e => setEditStart(Number(e.target.value))}
                          className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-200"
                        />
                        <label className="text-[10px] text-slate-400">End:</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={editEnd}
                          onChange={e => setEditEnd(Number(e.target.value))}
                          className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-200"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => saveEdit(seg)}
                          className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-2 flex items-center gap-0.5"
                        >
                          <Check className="w-3 h-3" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] px-1.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p
                        onDoubleClick={() => startEdit(seg)}
                        className="text-slate-200 leading-relaxed cursor-pointer hover:text-indigo-300"
                        title="Double-click to edit text"
                      >
                        &ldquo;{seg.text}&rdquo;
                      </p>
                      <button
                        type="button"
                        onClick={() => startEdit(seg)}
                        className="text-slate-500 hover:text-indigo-400 p-1 shrink-0"
                        title="Edit text and timing"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-slate-500" />
                        {Number(seg.start).toFixed(1)}s – {Number(seg.end).toFixed(1)}s
                      </span>
                      {seg.speaker && (
                        <span className="text-slate-500 font-sans">{seg.speaker}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
