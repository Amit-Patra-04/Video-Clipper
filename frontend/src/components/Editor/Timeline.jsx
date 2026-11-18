import { useRef, useState, useEffect, useCallback } from 'react';
import { Scissors, User } from 'lucide-react';

export default function Timeline({
  totalDuration = 60,
  currentTime = 0,
  trimStart = 0,
  trimEnd = 30,
  onTrimChange,
  onSeek,
  segments = []
}) {
  const containerRef = useRef(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [activeTrimHandle, setActiveTrimHandle] = useState(null); // 'start' | 'end' | null

  const getPositionPercent = time => {
    return Math.min(100, Math.max(0, (time / Math.max(1, totalDuration)) * 100));
  };

  const getTimeFromMouseEvent = useCallback(
    e => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.min(1, Math.max(0, clickX / rect.width));
      return ratio * totalDuration;
    },
    [totalDuration]
  );

  const handleMouseDown = e => {
    const time = getTimeFromMouseEvent(e);
    onSeek(time);
    setIsDraggingPlayhead(true);
  };

  useEffect(() => {
    const handleMouseMove = e => {
      if (isDraggingPlayhead) {
        const time = getTimeFromMouseEvent(e);
        onSeek(time);
      } else if (activeTrimHandle === 'start') {
        const time = Math.min(trimEnd - 2, Math.max(0, getTimeFromMouseEvent(e)));
        onTrimChange(time, trimEnd);
      } else if (activeTrimHandle === 'end') {
        const time = Math.max(trimStart + 2, Math.min(totalDuration, getTimeFromMouseEvent(e)));
        onTrimChange(trimStart, time);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingPlayhead(false);
      setActiveTrimHandle(null);
    };

    if (isDraggingPlayhead || activeTrimHandle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isDraggingPlayhead,
    activeTrimHandle,
    trimStart,
    trimEnd,
    totalDuration,
    getTimeFromMouseEvent,
    onSeek,
    onTrimChange
  ]);

  // Synthetic waveform bars (50 bars)
  const waveformBars = Array.from({ length: 60 }).map((_, i) => {
    const h = 25 + Math.sin(i * 0.4) * 20 + (i % 4) * 12;
    return Math.max(15, Math.min(90, h));
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md select-none">
      {/* Timeline Controls Header */}
      <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-indigo-400" />
            Interactive Timeline
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-indigo-300 font-mono">
            Clip Duration: {(trimEnd - trimStart).toFixed(1)}s
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px]">
          <div>
            <span className="text-slate-500">IN: </span>
            <span className="text-emerald-400 font-semibold">{trimStart.toFixed(1)}s</span>
          </div>
          <div>
            <span className="text-slate-500">OUT: </span>
            <span className="text-rose-400 font-semibold">{trimEnd.toFixed(1)}s</span>
          </div>
          <div>
            <span className="text-slate-500">TOTAL: </span>
            <span className="text-slate-300">{totalDuration.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* Main Tracks Wrapper */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="relative h-28 bg-slate-950/80 rounded-xl border border-slate-800/80 overflow-hidden cursor-pointer"
      >
        {/* Track 1: Time Ruler */}
        <div className="absolute top-0 left-0 right-0 h-5 border-b border-slate-800/60 flex items-center justify-between px-2 text-[10px] text-slate-500 font-mono">
          <span>0:00</span>
          <span>{(totalDuration * 0.25).toFixed(0)}s</span>
          <span>{(totalDuration * 0.5).toFixed(0)}s</span>
          <span>{(totalDuration * 0.75).toFixed(0)}s</span>
          <span>{totalDuration.toFixed(0)}s</span>
        </div>

        {/* Selected Clip Highlight Boundary */}
        <div
          className="absolute top-5 bottom-0 bg-indigo-500/15 border-x-2 border-indigo-400 z-10 pointer-events-none"
          style={{
            left: `${getPositionPercent(trimStart)}%`,
            width: `${getPositionPercent(trimEnd) - getPositionPercent(trimStart)}%`
          }}
        />

        {/* Trim IN Handle */}
        <div
          onMouseDown={e => {
            e.stopPropagation();
            setActiveTrimHandle('start');
          }}
          className="absolute top-5 bottom-0 w-3 -ml-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-l cursor-ew-resize z-20 flex items-center justify-center transition-colors shadow-lg"
          style={{ left: `${getPositionPercent(trimStart)}%` }}
          title="Drag to adjust IN point"
        >
          <div className="w-0.5 h-6 bg-white/80 rounded-full" />
        </div>

        {/* Trim OUT Handle */}
        <div
          onMouseDown={e => {
            e.stopPropagation();
            setActiveTrimHandle('end');
          }}
          className="absolute top-5 bottom-0 w-3 -mr-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-r cursor-ew-resize z-20 flex items-center justify-center transition-colors shadow-lg"
          style={{ left: `${getPositionPercent(trimEnd)}%` }}
          title="Drag to adjust OUT point"
        >
          <div className="w-0.5 h-6 bg-white/80 rounded-full" />
        </div>

        {/* Track 2: Waveform Track */}
        <div className="absolute top-6 left-0 right-0 h-10 flex items-center justify-between px-1 gap-0.5 opacity-60">
          {waveformBars.map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-slate-600 rounded-full transition-all"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        {/* Track 3: Diarized Speech Segments */}
        <div className="absolute bottom-2 left-0 right-0 h-8 flex items-center px-1">
          {segments && segments.length > 0 ? (
            segments.map(seg => {
              const left = getPositionPercent(seg.start);
              const width = Math.max(3, getPositionPercent(seg.end) - left);
              const isSpeaker1 = seg.speaker.includes('1');

              return (
                <div
                  key={seg.id}
                  className={`absolute h-6 rounded-md px-1.5 flex items-center gap-1 text-[10px] font-medium truncate border shadow-sm ${
                    isSpeaker1
                      ? 'bg-purple-950/70 border-purple-600/40 text-purple-300'
                      : 'bg-emerald-950/70 border-emerald-600/40 text-emerald-300'
                  }`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`
                  }}
                  title={`${seg.speaker}: "${seg.text}"`}
                >
                  <User className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{seg.text}</span>
                </div>
              );
            })
          ) : (
            <div className="text-[10px] text-slate-500 italic pl-2">
              Speech segments will render once analysis completes
            </div>
          )}
        </div>

        {/* Red Playhead Scrubber */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none"
          style={{ left: `${getPositionPercent(currentTime)}%` }}
        >
          <div className="w-3 h-3 -ml-[5px] bg-rose-500 rotate-45 rounded-sm shadow-md shadow-rose-500/50" />
        </div>
      </div>
    </div>
  );
}
