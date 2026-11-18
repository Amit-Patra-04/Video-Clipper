import React from 'react';
import { Scissors, Sparkles, Video, Film, GitBranch } from 'lucide-react';

export default function Header({ currentStage, onReset }) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3 cursor-pointer" onClick={onReset}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <Scissors className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              AutoClip AI
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Pro Studio
            </span>
          </div>
          <p className="text-xs text-slate-400">AI Video Highlights & Kinetic Shorts Engine</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {currentStage && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400">Current Mode:</span>
            <span className="font-semibold text-slate-200 capitalize">{currentStage}</span>
          </div>
        )}

        <button
          onClick={onReset}
          className="text-xs font-medium px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition-colors"
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
