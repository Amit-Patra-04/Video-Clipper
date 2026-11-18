import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { sanitizeCaptionText } from '../../utils/vtt';
import { Check, X, Clock, Edit2 } from 'lucide-react';

export default function KineticCaptions({
  currentTime,
  segments = [],
  onUpdateSegment,
  preset = 'hormozi',
  fontFamily = 'font-sans',
  fontSize = 28,
  fontSizeClass = '',
  textColorClass = '',
  activeColor = '#facc15',
  bgColorClass = '',
  position = 'bottom'
}) {
  const containerRef = useRef(null);
  const captionBoxRef = useRef(null);

  // Editing state for double-click edit
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editStart, setEditStart] = useState(0);
  const [editEnd, setEditEnd] = useState(0);

  // Find the current active speech segment based on currentTime
  const activeSegment = segments?.find(
    s => currentTime >= Number(s.start) && currentTime <= Number(s.end)
  );

  const prevSegmentIdRef = useRef(null);

  // Find words in active segment if available
  const activeWords = activeSegment?.words || [];

  // Group words in chunks of 3-4 words for dynamic reading
  let currentChunk = [];
  let activeWordIndex = -1;

  if (activeWords.length > 0) {
    const wordIdx = activeWords.findIndex(w => currentTime >= w.start && currentTime <= w.end);
    const chunkIdx = Math.max(0, Math.floor((wordIdx >= 0 ? wordIdx : 0) / 3));
    const startIdx = chunkIdx * 3;
    currentChunk = activeWords.slice(startIdx, startIdx + 3);
    activeWordIndex = currentChunk.findIndex(w => currentTime >= w.start && currentTime <= w.end);
  } else if (activeSegment) {
    const rawWords = (activeSegment.text || '').split(' ');
    currentChunk = rawWords.map(w => ({
      word: w,
      start: activeSegment.start,
      end: activeSegment.end
    }));
    activeWordIndex = 0;
  }

  const activeSegmentId = activeSegment?.id;

  // GSAP Animation: Entry Animation on Caption Segment Change (Fade-in + Smooth Slide)
  useEffect(() => {
    if (captionBoxRef.current && activeSegmentId && activeSegmentId !== prevSegmentIdRef.current) {
      prevSegmentIdRef.current = activeSegmentId;
      gsap.fromTo(
        captionBoxRef.current,
        { opacity: 0, y: 10, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.24, ease: 'power2.out' }
      );
    }
  }, [activeSegmentId]);

  // GSAP Kinetic pulse animation on active word change
  useEffect(() => {
    if (containerRef.current && activeWordIndex !== -1 && !isEditing) {
      const activeEl = containerRef.current.querySelector(`[data-word-idx="${activeWordIndex}"]`);
      if (activeEl) {
        if (preset === 'hormozi') {
          gsap.fromTo(
            activeEl,
            { scale: 1.25, rotate: -2 },
            { scale: 1.1, rotate: 0, duration: 0.18, ease: 'back.out(2)' }
          );
        } else if (preset === 'mrbeast') {
          gsap.fromTo(
            activeEl,
            { y: -6, scale: 1.2 },
            { y: 0, scale: 1.1, duration: 0.2, ease: 'bounce.out' }
          );
        } else if (preset === 'neon') {
          gsap.fromTo(
            activeEl,
            { opacity: 0.6, filter: 'brightness(1.8)' },
            { opacity: 1, filter: 'brightness(1)', duration: 0.2 }
          );
        }
      }
    }
  }, [activeWordIndex, preset, isEditing]);

  // Double Click Handler to enter edit mode
  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (!activeSegment) return;
    setEditText(activeSegment.text);
    setEditStart(Number(activeSegment.start || 0));
    setEditEnd(Number(activeSegment.end || 0));
    setIsEditing(true);
  };

  const handleSaveEdit = (e) => {
    if (e) e.stopPropagation();
    if (!activeSegment || !onUpdateSegment) {
      setIsEditing(false);
      return;
    }

    // Guardrail: Sanitize user edit to prevent XSS
    const cleanText = sanitizeCaptionText(editText);
    const validStart = Math.max(0, Number(editStart));
    const validEnd = Math.max(validStart + 0.2, Number(editEnd));

    const updated = {
      ...activeSegment,
      text: cleanText || activeSegment.text,
      start: validStart,
      end: validEnd
    };

    onUpdateSegment(updated);
    setIsEditing(false);
  };

  const handleCancelEdit = (e) => {
    if (e) e.stopPropagation();
    setIsEditing(false);
  };

  if (!activeSegment && !isEditing) return null;

  // Position classes
  const positionClasses = {
    top: 'top-12',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-16'
  };

  // Preset styles fallback
  const getPresetStyles = isActive => {
    switch (preset) {
      case 'hormozi':
        return {
          fontWeight: 900,
          textTransform: 'uppercase',
          color: isActive ? activeColor : '#FFFFFF',
          textShadow:
            '3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 12px rgba(0,0,0,0.9)',
          display: 'inline-block'
        };
      case 'mrbeast':
        return {
          fontWeight: 900,
          textTransform: 'uppercase',
          color: isActive ? activeColor : '#FFFFFF',
          textShadow: '3px 3px 0px #000, -2px -2px 0px #000',
          display: 'inline-block'
        };
      case 'neon':
        return {
          fontWeight: 700,
          color: isActive ? activeColor : '#FFFFFF',
          textShadow: isActive
            ? `0 0 12px ${activeColor}, 0 0 24px ${activeColor}`
            : '0 2px 8px rgba(0,0,0,0.8)',
          display: 'inline-block'
        };
      case 'minimal':
      default:
        return {
          fontWeight: 600,
          color: isActive ? activeColor : '#E2E8F0',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          padding: '2px 8px',
          borderRadius: '4px',
          display: 'inline-block'
        };
    }
  };

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Synchronized Captions"
      aria-live="polite"
      className={`absolute left-0 right-0 ${positionClasses[position] || 'bottom-16'} z-30 flex items-center justify-center px-4 select-none pointer-events-auto`}
    >
      {isEditing ? (
        /* INLINE CAPTION & TIMING EDITOR */
        <div
          role="dialog"
          aria-label="Edit Caption Text and Timing"
          className="bg-slate-950/95 border-2 border-indigo-500 rounded-xl p-3 shadow-2xl backdrop-blur-md max-w-[92%] w-full text-left space-y-2.5 z-40"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1">
              <Edit2 className="w-3 h-3" />
              Edit Caption & Timing
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSaveEdit}
                title="Save Caption Edit"
                className="p-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs flex items-center gap-0.5 px-2"
              >
                <Check className="w-3 h-3" />
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                title="Cancel Edit"
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-1.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 block mb-1">
              Caption Text (Speech-accurate, XSS sanitized)
            </label>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                <Clock className="w-2.5 h-2.5" /> Start (sec)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={editStart}
                onChange={e => setEditStart(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                <Clock className="w-2.5 h-2.5" /> End (sec)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={editEnd}
                onChange={e => setEditEnd(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
              />
            </div>
          </div>
        </div>
      ) : (
        /* LIVE OVERLAID CAPTIONS WITH GSAP & TAILWIND STYLING */
        <div
          ref={captionBoxRef}
          role="status"
          aria-atomic="true"
          title="Double-click to edit caption text & timing"
          onDoubleClick={handleDoubleClick}
          className={`flex flex-wrap items-center justify-center gap-2 max-w-[88%] text-center cursor-pointer transition-all hover:ring-2 hover:ring-indigo-400/50 rounded-lg p-1.5 ${fontFamily} ${fontSizeClass} ${textColorClass} ${bgColorClass}`}
        >
          {currentChunk.map((item, idx) => {
            const isActive = idx === activeWordIndex;
            return (
              <span
                key={`${item.word}-${idx}`}
                data-word-idx={idx}
                style={{
                  fontSize: fontSize ? `${fontSize}px` : undefined,
                  ...getPresetStyles(isActive)
                }}
                className="transition-colors duration-100"
              >
                {item.word}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
