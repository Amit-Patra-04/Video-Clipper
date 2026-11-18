import { useState } from 'react';
import { Video, ArrowRight, Info, Loader2 } from 'lucide-react';

export default function YoutubeInput({ onSubmit, isLoading }) {
  const [url, setUrl] = useState('');
  const [inputError, setInputError] = useState(null);

  const handleSubmit = e => {
    e.preventDefault();
    setInputError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setInputError('Please enter a YouTube video URL.');
      return;
    }

    const isYoutube = /(youtube\.com|youtu\.be)/i.test(trimmed);
    if (!isYoutube) {
      setInputError('Only authorized YouTube URLs (youtube.com or youtu.be) are supported.');
      return;
    }

    onSubmit(trimmed);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 mb-2">
          <Video className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-slate-100">Authorized YouTube Import</h3>
        <p className="text-xs text-slate-400">
          Paste a public YouTube video or Shorts link to extract viral clips automatically
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="url"
            value={url}
            onChange={e => {
              setUrl(e.target.value);
              setInputError(null);
            }}
            placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
            className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="absolute right-2 top-2 bottom-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Fetch</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {inputError && <p className="text-xs text-rose-400">{inputError}</p>}

        <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>YouTube Policy & Processing Notice</span>
          </div>
          <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
            <li>
              Only public or authorized videos you own or have permission to clip are permitted.
            </li>
            <li>
              Age-restricted or DRM-encrypted streams require browser cookies and cannot be fetched
              directly.
            </li>
            <li>Videos over 3 hours are capped to protect processing pipeline quotas.</li>
          </ul>
        </div>
      </form>
    </div>
  );
}
