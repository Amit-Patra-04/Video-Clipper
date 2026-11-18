import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Scissors, GitBranch } from 'lucide-react';

export default function Header({ currentStage, onReset }) {
  const headerRef = useRef(null);
  const logoIconRef = useRef(null);
  const titleRef = useRef(null);
  const badgeRef = useRef(null);
  const actionsRef = useRef(null);

  // GSAP Demo Animation runs immediately on initial load
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from(headerRef.current, {
        y: -30,
        opacity: 0,
        duration: 0.6
      })
        .from(
          logoIconRef.current,
          {
            scale: 0,
            rotation: -45,
            duration: 0.5,
            ease: 'back.out(1.7)'
          },
          '-=0.3'
        )
        .from(
          titleRef.current,
          {
            x: -20,
            opacity: 0,
            duration: 0.4
          },
          '-=0.2'
        )
        .from(
          badgeRef.current,
          {
            scale: 0.8,
            opacity: 0,
            duration: 0.35,
            ease: 'elastic.out(1, 0.5)'
          },
          '-=0.2'
        )
        .from(
          actionsRef.current?.children || [],
          {
            y: -10,
            opacity: 0,
            stagger: 0.1,
            duration: 0.4
          },
          '-=0.2'
        );
    }, headerRef);

    return () => ctx.revert();
  }, []);

  return (
    <header
      ref={headerRef}
      className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between"
    >
      <div className="flex items-center gap-3 cursor-pointer select-none" onClick={onReset}>
        <div
          ref={logoIconRef}
          className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25"
        >
          <Scissors className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              ref={titleRef}
              className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent font-display"
            >
              AutoClip AI
            </span>
            <span
              ref={badgeRef}
              className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
            >
              Pro Studio
            </span>
          </div>
          <p className="text-xs text-slate-400">AI Video Highlights & Kinetic Shorts Engine</p>
        </div>
      </div>

      <div ref={actionsRef} className="flex items-center gap-3">
        {/* GSAP Active Status Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>GSAP Engine Active</span>
        </div>

        {currentStage && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400">Mode:</span>
            <span className="font-semibold text-slate-200 capitalize">{currentStage}</span>
          </div>
        )}

        <button
          onClick={onReset}
          className="text-xs font-medium px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition-colors shadow-sm"
        >
          New Project
        </button>

        <a
          href="https://github.com/Amit-Patra-04/Video-Clipper"
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          title="GitHub Repository"
        >
          <GitBranch className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
}
