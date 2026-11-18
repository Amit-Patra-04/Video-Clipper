import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function KineticCaptions({
  currentTime,
  segments,
  preset = 'hormozi',
  fontSize = 28,
  activeColor = '#facc15',
  position = 'bottom'
}) {
  const containerRef = useRef(null);

  // Find the current active speech segment
  const activeSegment = segments?.find(s => currentTime >= s.start && currentTime <= s.end);

  // Find words in active segment
  const activeWords = activeSegment?.words || [];

  // Group words in chunks of 3-4 words for dynamic kinetic reading
  let currentChunk = [];
  let activeWordIndex = -1;

  if (activeWords.length > 0) {
    const chunkIdx = Math.floor(
      activeWords.findIndex(w => currentTime >= w.start && currentTime <= w.end) / 3
    );
    const startIdx = Math.max(0, chunkIdx * 3);
    currentChunk = activeWords.slice(startIdx, startIdx + 3);

    activeWordIndex = currentChunk.findIndex(w => currentTime >= w.start && currentTime <= w.end);
  } else if (activeSegment) {
    // Fallback if segment has no word timestamps
    currentChunk = activeSegment.text
      .split(' ')
      .slice(0, 5)
      .map((w, _i) => ({
        word: w,
        start: activeSegment.start,
        end: activeSegment.end
      }));
    activeWordIndex = 0;
  }

  // Trigger GSAP pulse animation on active word change
  useEffect(() => {
    if (containerRef.current && activeWordIndex !== -1) {
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
            { y: -8, scale: 1.2 },
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
  }, [activeWordIndex, preset]);

  if (!currentChunk.length) return null;

  // Position classes
  const positionClasses = {
    top: 'top-12',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-16'
  };

  // Preset styles
  const getPresetStyles = isActive => {
    switch (preset) {
      case 'hormozi':
        return {
          fontFamily: 'Montserrat, Impact, sans-serif',
          fontWeight: 900,
          textTransform: 'uppercase',
          color: isActive ? activeColor : '#FFFFFF',
          textShadow:
            '3px 3px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 4px 12px rgba(0,0,0,0.9)',
          display: 'inline-block'
        };
      case 'mrbeast':
        return {
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 900,
          textTransform: 'uppercase',
          color: isActive ? activeColor : '#FFFFFF',
          textShadow: '3px 3px 0px #000, -2px -2px 0px #000',
          display: 'inline-block'
        };
      case 'neon':
        return {
          fontFamily: 'Space Grotesk, sans-serif',
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
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 600,
          color: isActive ? activeColor : '#E2E8F0',
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          padding: '2px 6px',
          borderRadius: '4px',
          display: 'inline-block'
        };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`absolute left-0 right-0 ${positionClasses[position] || 'bottom-16'} z-30 flex items-center justify-center px-4 pointer-events-none select-none`}
    >
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-[85%] text-center">
        {currentChunk.map((item, idx) => {
          const isActive = idx === activeWordIndex;
          return (
            <span
              key={`${item.word}-${idx}`}
              data-word-idx={idx}
              style={{
                fontSize: `${fontSize}px`,
                ...getPresetStyles(isActive)
              }}
              className="transition-colors duration-100"
            >
              {item.word}
            </span>
          );
        })}
      </div>
    </div>
  );
}
