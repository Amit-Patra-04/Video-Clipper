import { useRef, useState, useEffect, useCallback } from 'react';
import { Scissors, User, Film, Volume2, Split } from 'lucide-react';

export default function Timeline({
  totalDuration = 60,
  currentTime = 0,
  trimStart = 0,
  trimEnd = 30,
  onTrimChange,
  onSeek,
  segments = [],
  scenes = [],
  transition = 'cut'
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [activeTrimHandle, setActiveTrimHandle] = useState(null); // 'start' | 'end' | null

  const getPositionPercent = (time) => {
    return Math.min(100, Math.max(0, (time / Math.max(1, totalDuration)) * 100));
  };

  const getTimeFromMouseEvent = useCallback(
    (e) => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.min(1, Math.max(0, clickX / rect.width));
      return ratio * totalDuration;
    },
    [totalDuration]
  );

  const handleMouseDown = (e) => {
    const time = getTimeFromMouseEvent(e);
    if (onSeek) onSeek(time);
    setIsDraggingPlayhead(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingPlayhead) {
        const time = getTimeFromMouseEvent(e);
        if (onSeek) onSeek(time);
      } else if (activeTrimHandle === 'start') {
        const time = Math.min(trimEnd - 1.5, Math.max(0, getTimeFromMouseEvent(e)));
        if (onTrimChange) onTrimChange(time, trimEnd);
      } else if (activeTrimHandle === 'end') {
        const time = Math.max(trimStart + 1.5, Math.min(totalDuration, getTimeFromMouseEvent(e)));
        if (onTrimChange) onTrimChange(trimStart, time);
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

  // Render HTML5 Canvas Waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Number of bars
    const barCount = 100;
    const barWidth = width / barCount;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#818cf8');
    gradient.addColorStop(0.5, '#6366f1');
    gradient.addColorStop(1, '#4338ca');

    ctx.fillStyle = gradient;

    for (let i = 0; i < barCount; i++) {
      // Dynamic simulated amplitude with natural audio variance
      const progress = i / barCount;
      const barTime = progress * totalDuration;
      const isInTrim = barTime >= trimStart && barTime <= trimEnd;

      const base = 0.25 + 0.35 * Math.sin(i * 0.3) * Math.cos(i * 0.15);
      const spike = (i % 7 === 0 || i % 11 === 0) ? 0.35 : 0;
      const amp = Math.min(0.95, Math.max(0.12, base + spike));
      const barH = amp * (height - 4);
      const y = (height - barH) / 2;

      ctx.fillStyle = isInTrim ? '#a5b4fc' : '#475569';
      ctx.fillRect(i * barWidth + 1, y, Math.max(1, barWidth - 1.5), barH);
    }
  }, [totalDuration, trimStart, trimEnd]);

  // Generate synthetic scene blocks if scenes prop is empty
  const sceneBlocks = scenes.length > 0 ? scenes : [
    { start_seconds: 0.0, end_seconds: totalDuration * 0.35, title: 'Scene 1' },
    { start_seconds: totalDuration * 0.35, end_seconds: totalDuration * 0.72, title: 'Scene 2' },
    { start_seconds: totalDuration * 0.72, end_seconds: totalDuration, title: 'Scene 3' }
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md select-none space-y-3">
      {/* Timeline Controls Header */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-indigo-400" />
            Interactive Timeline & Multi-Track Studio
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-indigo-300 font-mono">
            Selected Duration: {(trimEnd - trimStart).toFixed(1)}s
          </span>
          {transition && (
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700 flex items-center gap-1">
              <Split className="w-2.5 h-2.5 text-indigo-400" />
              Transition: {transition.toUpperCase()}
            </span>
          )}
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

      {/* Main Multi-Track Wrapper */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="relative h-36 bg-slate-950/90 rounded-xl border border-slate-800/80 overflow-hidden cursor-pointer"
      >
        {/* Track 1: Time Ruler */}
        <div className="absolute top-0 left-0 right-0 h-5 border-b border-slate-800/60 flex items-center justify-between px-2 text-[10px] text-slate-500 font-mono bg-slate-900/40">
          <span>0:00</span>
          <span>{(totalDuration * 0.25).toFixed(0)}s</span>
          <span>{(totalDuration * 0.5).toFixed(0)}s</span>
          <span>{(totalDuration * 0.75).toFixed(0)}s</span>
          <span>{totalDuration.toFixed(0)}s</span>
        </div>

        {/* Selected Clip Highlight Boundary Overlay */}
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

        {/* Track 2: Video Scenes & Thumbnails Track */}
        <div className="absolute top-6 left-0 right-0 h-7 flex items-center border-b border-slate-800/40">
          <div className="absolute left-1 top-1 text-[9px] text-slate-500 flex items-center gap-1 z-0">
            <Film className="w-2.5 h-2.5" /> Video Track
          </div>
          {sceneBlocks.map((sc, idx) => {
            const startSec = Number(sc.start_seconds || sc.start || 0);
            const endSec = Number(sc.end_seconds || sc.end || totalDuration);
            const left = getPositionPercent(startSec);
            const width = Math.max(4, getPositionPercent(endSec) - left);

            return (
              <div
                key={idx}
                className="absolute top-1 bottom-1 rounded border border-slate-700/60 bg-slate-900/80 px-1.5 flex items-center justify-between text-[9px] text-slate-300 font-mono overflow-hidden"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`Scene ${idx + 1}: ${startSec.toFixed(1)}s – ${endSec.toFixed(1)}s`}
              >
                <span className="truncate">Scene {idx + 1}</span>
                {idx > 0 && (
                  <span className="text-[8px] px-1 py-0.2 bg-indigo-900/60 text-indigo-300 rounded border border-indigo-700/40">
                    {transition}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Track 3: Audio Waveform Track (HTML5 Canvas) */}
        <div className="absolute top-14 left-0 right-0 h-10 px-1 flex items-center">
          <div className="absolute left-1 top-0.5 text-[9px] text-slate-500 flex items-center gap-1 pointer-events-none">
            <Volume2 className="w-2.5 h-2.5" /> Audio Waveform
          </div>
          <canvas
            ref={canvasRef}
            width={600}
            height={36}
            className="w-full h-full block rounded opacity-80"
          />
        </div>

        {/* Track 4: Diarized Speech Segments Track */}
        <div className="absolute bottom-1 left-0 right-0 h-8 flex items-center px-1">
          {segments && segments.length > 0 ? (
            segments.map((seg, idx) => {
              const left = getPositionPercent(seg.start);
              const width = Math.max(3, getPositionPercent(seg.end) - left);
              const isSpeaker1 = (seg.speaker || '').includes('1');

              return (
                <div
                  key={seg.id || idx}
                  className={`absolute h-6 rounded-md px-1.5 flex items-center gap-1 text-[10px] font-medium truncate border shadow-sm ${
                    isSpeaker1
                      ? 'bg-purple-950/70 border-purple-600/40 text-purple-300'
                      : 'bg-emerald-950/70 border-emerald-600/40 text-emerald-300'
                  }`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`
                  }}
                  title={`${seg.speaker || 'Speech'}: "${seg.text}"`}
                >
                  <User className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{seg.text}</span>
                </div>
              );
            })
          ) : (
            <div className="text-[10px] text-slate-500 italic pl-2">
              Transcript speech cues will align here
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
