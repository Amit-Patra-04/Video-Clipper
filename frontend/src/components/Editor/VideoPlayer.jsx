import { useRef, useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Smartphone, Users, Sparkles, Layers } from 'lucide-react';
import KineticCaptions from './KineticCaptions';

export default function VideoPlayer({
  videoSrc,
  currentTime,
  onTimeUpdate,
  trimStart = 0,
  trimEnd = 60,
  segments = [],
  onUpdateSegment,
  captionConfig = {
    preset: 'hormozi',
    fontFamily: 'font-sans',
    fontSize: 26,
    fontSizeClass: 'text-2xl',
    textColorClass: 'text-yellow-400',
    activeColor: '#facc15',
    bgColorClass: '',
    position: 'bottom'
  },
  aspectRatio = '9:16'
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [_duration, setDuration] = useState(60);
  const [reframeMode, setReframeMode] = useState('auto-center'); // 'auto-center' | 'split' | 'blur-bg' | 'fit'

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
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
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
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
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
      {/* Video Canvas Container (Smartphone Bezel for 9:16) */}
      <div
        ref={containerRef}
        className={`relative ${getAspectRatioClasses()} rounded-[28px] overflow-hidden bg-black shadow-2xl border-4 ${
          aspectRatio === '9:16' ? 'border-slate-800 ring-1 ring-slate-700/50 shadow-indigo-500/10' : 'border-slate-800'
        } transition-all duration-300 flex items-center justify-center`}
      >
        {/* Dynamic Island / Notch Mockup for 9:16 Smartphone */}
        {aspectRatio === '9:16' && (
          <div className="absolute top-2.5 z-30 w-20 h-4 bg-slate-950 rounded-full border border-slate-800/80 shadow-md flex items-center justify-center pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-800 mr-2" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
          </div>
        )}

        {/* Blurred Background Fill if Reframe Mode is blur-bg */}
        {aspectRatio === '9:16' && reframeMode === 'blur-bg' && (
          <video
            src={videoSrc}
            className="absolute inset-0 w-full h-full object-cover filter blur-xl scale-125 opacity-40 pointer-events-none"
            muted
            playsInline
          />
        )}

        <video
          ref={videoRef}
          src={videoSrc}
          className={`w-full h-full ${reframeMode === 'fit' ? 'object-contain' : 'object-cover'} relative z-10`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 60)}
          onClick={togglePlay}
          playsInline
        />

        {/* Live Kinetic Captions Overlay */}
        <div className="relative z-20">
          <KineticCaptions
            currentTime={currentTime}
            segments={segments}
            onUpdateSegment={onUpdateSegment}
            preset={captionConfig.preset}
            fontFamily={captionConfig.fontFamily}
            fontSize={captionConfig.fontSize}
            fontSizeClass={captionConfig.fontSizeClass}
            textColorClass={captionConfig.textColorClass}
            activeColor={captionConfig.activeColor}
            bgColorClass={captionConfig.bgColorClass}
            position={captionConfig.position}
          />
        </div>

        {/* Framing Guides for 9:16 Preview */}
        {aspectRatio === '9:16' && (
          <div className="absolute inset-0 pointer-events-none border border-white/10 rounded-[24px] z-20">
            <div className="absolute top-8 left-3 px-2 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] font-mono text-slate-300">
              9:16 Shorts Safe Zone
            </div>

            {/* Social Action Icons Mockup (Right Side) */}
            <div className="absolute right-2.5 bottom-16 flex flex-col gap-3 text-white/50 text-[10px] items-center pointer-events-none">
              <div className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-xs">❤️</div>
              <div className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-xs">💬</div>
              <div className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-xs">↗️</div>
            </div>
          </div>
        )}

        {/* Play / Pause Big Center Overlay when paused */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer z-30"
          >
            <div className="w-16 h-16 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl shadow-indigo-600/40 transition-transform transform hover:scale-105">
              <Play className="w-7 h-7 ml-1 fill-white" />
            </div>
          </div>
        )}
      </div>

      {/* Smart Reframe Crop Selector */}
      {aspectRatio === '9:16' && (
        <div className="mt-3 flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl text-xs">
          {[
            { id: 'auto-center', label: 'Speaker Auto', icon: Smartphone },
            { id: 'split', label: 'Split Screen', icon: Users },
            { id: 'blur-bg', label: 'Blurred BG', icon: Sparkles },
            { id: 'fit', label: 'Fit Original', icon: Layers }
          ].map(m => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setReframeMode(m.id)}
                className={`py-1 px-2.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  reframeMode === m.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      )}

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
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5 fill-white" />
          )}
        </button>

        <button
          onClick={toggleMute}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
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
