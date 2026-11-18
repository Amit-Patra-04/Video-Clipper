import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Hash,
  ListOrdered,
  FileText,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

export default function MetadataStudio({
  metadata,
  onRegenerate,
  isLoading
}) {
  const [copiedKey, setCopiedKey] = useState(null);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!metadata) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center">
        <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2 animate-pulse" />
        <h4 className="text-sm font-semibold text-slate-300">AI YouTube Studio</h4>
        <p className="text-xs text-slate-500 mt-1">
          Generating viral titles, descriptions, and hashtags...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 backdrop-blur-md space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            AI YouTube Shorts Growth Studio
          </h3>
          <p className="text-[11px] text-slate-400">Tested High-CTR Formulas & SEO Optimization</p>
        </div>

        <button
          onClick={onRegenerate}
          disabled={isLoading}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 border border-slate-700/80 transition-colors"
          title="Regenerate Titles & SEO"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Regenerate</span>
        </button>
      </div>

      {/* 1. Viral Title Variations */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>High-CTR Title Variations (A/B Test Candidates)</span>
        </label>
        <div className="space-y-2">
          {metadata.titles?.map((t, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {t.hook_type}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    CTR: {t.estimated_ctr}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-100 truncate">{t.title}</p>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard(t.title, `title-${idx}`)}
                className="p-2 rounded-lg bg-slate-900 group-hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
                title="Copy Title"
              >
                {copiedKey === `title-${idx}` ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. YouTube Shorts Description */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            SEO Description & CTA
          </span>
          <button
            onClick={() => copyToClipboard(metadata.description, 'desc')}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            {copiedKey === 'desc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>Copy Full Description</span>
          </button>
        </div>
        <textarea
          readOnly
          value={metadata.description}
          rows={4}
          className="w-full p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono resize-none focus:outline-none"
        />
      </div>

      {/* 3. Viral Hashtags */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
          <Hash className="w-3.5 h-3.5 text-indigo-400" />
          <span>Hashtags Cloud</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {metadata.hashtags?.map((tag, idx) => (
            <span
              key={idx}
              onClick={() => copyToClipboard(tag, `tag-${idx}`)}
              className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 cursor-pointer transition-colors"
              title="Click to copy"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* 4. Timestamps & Chapters */}
      {metadata.chapters && metadata.chapters.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <ListOrdered className="w-3.5 h-3.5 text-indigo-400" />
            <span>Clickable YouTube Chapters</span>
          </label>
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
            {metadata.chapters.map((chap, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <span className="text-indigo-400 font-bold">{chap.timestamp}</span>
                <span className="text-slate-500">-</span>
                <span className="text-slate-200">{chap.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
