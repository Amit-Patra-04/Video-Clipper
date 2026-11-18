import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import KineticCaptions from './KineticCaptions';

export default function VideoPlayer({
  videoSrc,
  currentTime,
  onTimeUpdate,
  trimStart = 0,
  trimEnd = 60,
  segments = [],
  captionConfig = {
    preset: 'hormozi',
    fontSize: 26,
    activeColor: '#facc15',
    position: 'bottom'
  },
  aspectRatio = '9:16'
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(60);

  // Sync external currentTime changes (e.g. from timeline scrubbing)
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.4) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    
    // Auto-loop within trim in/out range
    if (curr >= trimEnd) {
      videoRef.current.currentTime = trimStart;
      onTimeUpdate(trimStart);
    } else {
      onTimeUpdate(curr);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (videoRef.current.currentTime < trimStart || videoRef.current.currentTime >= trimEnd) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const resetToTrimStart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = trimStart;
    onTimeUpdate(trimStart);
    if (!isPlaying) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Aspect ratio styling container
  const getAspectRatioClasses = () => {
    switch (aspectRatio) {
      case '9:16':
        return 'w-[290px] h-[516px] sm:w-[330px] sm:h-[586px]';
      case '1:1':
        return 'w-[360px] h-[360px] sm:w-[420px] sm:h-[420px]';
      case '16:9':
      default:
        return 'w-[520px] h-[292px] sm:w-[640px] sm:h-[360px]';
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Video Canvas Container */}
      <div
        ref={containerRef}
        className={`relative ${getAspectRatioClasses()} rounded-2xl overflow-hidden bg-black shadow-2xl border border-slate-800 transition-all duration-300 flex items-center justify-center`}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 60)}
          onClick={togglePlay}
          playsInline
        />

        {/* Live Kinetic Captions Overlay */}
        <KineticCaptions
          currentTime={currentTime}
          segments={segments}
          preset={captionConfig.preset}
          fontSize={captionConfig.fontSize}
          activeColor={captionConfig.activeColor}
          position={captionConfig.position}
        />

        {/* Framing Guides for 9:16 Preview */}
        {aspectRatio === '9:16' && (
          <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-2xl">
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] font-mono text-slate-300">
              9:16 Shorts Safe Zone
            </div>
          </div>
        )}

        {/* Play / Pause Big Center Overlay when paused */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/40 transition-transform transform hover:scale-105">
              <Play className="w-7 h-7 ml-1 fill-white" />
            </div>
          </div>
        )}
      </div>

      {/* Media Controls Bar */}
      <div className="mt-4 flex items-center gap-4 bg-slate-900/90 border border-slate-800 px-5 py-2.5 rounded-xl shadow-lg backdrop-blur-md">
        <button
          onClick={resetToTrimStart}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Jump to Clip Start"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={togglePlay}
          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 fill-white" />}
        </button>

        <button
          onClick={toggleMute}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <div className="text-xs font-mono text-slate-300 flex items-center gap-1">
          <span className="text-indigo-400 font-semibold">{currentTime.toFixed(1)}s</span>
          <span className="text-slate-600">/</span>
          <span>{trimEnd.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}
