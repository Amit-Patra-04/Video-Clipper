import { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Hash,
  ListOrdered,
  FileText,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Info,
  RotateCcw,
  Plus,
  X
} from 'lucide-react';

export default function MetadataStudio({
  metadata,
  onRegenerate,
  isLoading = false,
  onSaveMetadata = null
}) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showOverTagDemo, setShowOverTagDemo] = useState(false);

  // Editable user override state
  const [prevMetadata, setPrevMetadata] = useState(metadata);
  const [userTitle, setUserTitle] = useState(null);
  const [userDescription, setUserDescription] = useState(null);
  const [userHashtags, setUserHashtags] = useState(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Sync state during render when metadata prop changes (React recommended pattern)
  if (prevMetadata !== metadata) {
    setPrevMetadata(metadata);
    setUserTitle(null);
    setUserDescription(null);
    setUserHashtags(null);
    setIsSaved(false);
  }

  const title = userTitle !== null ? userTitle : (metadata?.primary_title || metadata?.titles?.[0]?.title || '');
  const description = userDescription !== null ? userDescription : (metadata?.description || '');
  const hashtags = userHashtags !== null ? userHashtags : (metadata?.hashtags || []);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAll = () => {
    const fullText = `${title}\n\n${description}\n\n${hashtags.join(' ')}`;
    copyToClipboard(fullText, 'copy-all');
  };

  const handleApplyVariation = variationTitle => {
    setUserTitle(variationTitle);
    setIsSaved(false);
  };

  const handleResetToAI = () => {
    setUserTitle(null);
    setUserDescription(null);
    setUserHashtags(null);
    setIsSaved(false);
  };

  const handleAddHashtag = e => {
    e.preventDefault();
    const clean = newTagInput.trim().replace(/^#/, '');
    if (!clean) return;
    const formatted = `#${clean}`;
    if (!hashtags.includes(formatted)) {
      setUserHashtags([...hashtags, formatted]);
      setIsSaved(false);
    }
    setNewTagInput('');
  };

  const handleRemoveHashtag = indexToRemove => {
    setUserHashtags(hashtags.filter((_, idx) => idx !== indexToRemove));
    setIsSaved(false);
  };

  const handleSaveChanges = () => {
    const updated = {
      ...metadata,
      primary_title: title,
      character_count: title.length,
      description,
      hashtags,
      hashtag_count: hashtags.length,
      is_user_edited: true
    };
    if (onSaveMetadata) {
      onSaveMetadata(updated);
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Calculations for constraints
  const titleCharCount = title.length;
  const isTitleOverLimit = titleCharCount > 100;
  const isTitleOptimal = titleCharCount >= 40 && titleCharCount <= 70;

  // Sentence count calculation
  const sentenceList = description.trim()
    ? description
        .trim()
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean)
    : [];
  const sentenceCount = sentenceList.length;
  const isDescriptionOverLimit = sentenceCount > 2;

  // Hashtag constraint calculations
  const isHashtagsOverCount = hashtags.length > 3;
  const longHashtags = hashtags.filter(tag => tag.replace(/^#/, '').length > 30);
  const effectiveTagsCount = (showOverTagDemo ? 65 : 0) + hashtags.length + (metadata?.tags?.length || 0);
  const isOverTaggingViolation = effectiveTagsCount > 60 || !!metadata?.over_tagging_warning;

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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              AI YouTube Shorts Growth Studio
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              YouTube Policy Compliant
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Official YouTube Shorts metadata optimization with real-time policy checks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuidelines(!showGuidelines)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 border border-slate-700/80 transition-colors"
            title="Official YouTube Guidelines"
          >
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Policies</span>
          </button>

          <button
            type="button"
            onClick={onRegenerate}
            disabled={isLoading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 border border-slate-700/80 transition-colors"
            title="Regenerate Titles & SEO"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Regenerate</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAll}
            className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
            title="Copy All Metadata"
          >
            {copiedKey === 'copy-all' ? (
              <Check className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Copy All</span>
          </button>
        </div>
      </div>

      {/* Official YouTube Support Citation Banner */}
      {showGuidelines && (
        <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Official YouTube Shorts Best Practices
            </span>
            <a
              href="https://support.google.com/youtube/answer/6390658"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline underline-offset-2"
            >
              YouTube Support Citation
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <ul className="text-slate-300 space-y-1 pl-4 list-disc text-[11px]">
            <li>
              <strong className="text-white">Title:</strong> Maximum 100 characters. 50–70 characters
              recommended for Shorts to avoid mobile feed truncation.
            </li>
            <li>
              <strong className="text-white">Description:</strong> 1–2 concise sentences summarizing
              clip content.
            </li>
            <li>
              <strong className="text-white">Hashtags:</strong> Maximum 3 relevant hashtags
              recommended. The first 3 appear above the title or in the Shorts shelf. Tags &gt; 30
              chars are ignored.
            </li>
            <li>
              <strong className="text-white">Over-tagging Policy:</strong> Adding &gt; 60 hashtags
              causes YouTube to ignore every hashtag on that video and risks removal for spam.
            </li>
          </ul>
        </div>
      )}

      {/* Over-tagging Violation Warning Alert (>60 tags rule) */}
      {isOverTaggingViolation && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold text-amber-300">
              YouTube Over-tagging Policy Violation (&gt;60 Tags)
            </div>
            <p className="text-slate-300 mt-0.5 leading-relaxed">
              Official YouTube policy states that if a video has more than 60 hashtags, YouTube will
              ignore every hashtag on that video. Over-tagging may result in video removal under spam
              policies.
            </p>
            <a
              href="https://support.google.com/youtube/answer/6390658"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 mt-1 font-semibold underline"
            >
              Learn more on YouTube Support
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* 1. Primary Title with Manual Override & Live Character Counter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="youtube-title-input"
            className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Title (Editable / Manual Override)</span>
          </label>

          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                isTitleOverLimit
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-bold'
                  : isTitleOptimal
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {titleCharCount} / 100 chars
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(title, 'title-active')}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Copy Title"
            >
              {copiedKey === 'title-active' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <input
          id="youtube-title-input"
          type="text"
          value={title}
          onChange={e => {
            setUserTitle(e.target.value);
            setIsSaved(false);
          }}
          placeholder="Enter YouTube title (contains clip keywords)..."
          className={`w-full px-3 py-2.5 rounded-xl bg-slate-950/70 border text-xs text-white font-medium focus:outline-none transition-all ${
            isTitleOverLimit
              ? 'border-rose-500 focus:border-rose-400'
              : 'border-slate-800 focus:border-indigo-500'
          }`}
        />

        {isTitleOverLimit && (
          <p className="text-[11px] text-rose-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Title exceeds YouTube 100 character limit! It will be truncated or rejected.
          </p>
        )}
      </div>

      {/* A/B Test Title Variations */}
      <div>
        <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI High-CTR Variations (Click to Apply)</span>
          </span>
          <span className="text-[10px] text-slate-500">Includes clip keywords</span>
        </label>
        <div className="space-y-1.5">
          {metadata.titles?.map((t, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-xl bg-slate-950/60 border transition-all flex items-center justify-between gap-3 group cursor-pointer ${
                title === t.title
                  ? 'border-indigo-500/60 bg-indigo-950/20'
                  : 'border-slate-800/80 hover:border-slate-700'
              }`}
              onClick={() => handleApplyVariation(t.title)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {t.hook_type}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    CTR: {t.estimated_ctr}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    ({t.title.length} chars)
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-100 truncate">{t.title}</p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    copyToClipboard(t.title, `title-${idx}`);
                  }}
                  className="p-1.5 rounded-lg bg-slate-900 group-hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Copy Title"
                >
                  {copiedKey === `title-${idx}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleApplyVariation(t.title);
                  }}
                  className="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors"
                >
                  Use
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. YouTube Shorts Description with Live Sentence Counter */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
          <label htmlFor="youtube-desc-input" className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Shorts Description (1–2 Sentences)</span>
          </label>

          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                isDescriptionOverLimit
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {sentenceCount} / 2 sentences
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(description, 'desc')}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              {copiedKey === 'desc' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>Copy</span>
            </button>
          </div>
        </div>

        <textarea
          id="youtube-desc-input"
          value={description}
          onChange={e => {
            setUserDescription(e.target.value);
            setIsSaved(false);
          }}
          rows={3}
          className="w-full p-3 bg-slate-950/70 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-slate-200 resize-none focus:outline-none font-sans leading-relaxed"
          placeholder="Concise 1-2 sentence description summarizing clip..."
        />

        {isDescriptionOverLimit && (
          <p className="text-[11px] text-amber-400 flex items-center gap-1 mt-1">
            <AlertTriangle className="w-3 h-3" />
            YouTube Shorts best practice: Keep descriptions to 1–2 concise sentences.
          </p>
        )}
      </div>

      {/* 3. Viral Hashtags Cloud (Up to 3, <=30 chars) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-indigo-400" />
            <span>Hashtags (Max 3 Recommended)</span>
          </label>

          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                isHashtagsOverCount
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {hashtags.length} / 3 hashtags
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(hashtags.join(' '), 'tags-cloud')}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              {copiedKey === 'tags-cloud' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>Copy Tags</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          {hashtags.map((tag, idx) => {
            const isLong = tag.replace(/^#/, '').length > 30;
            return (
              <span
                key={idx}
                className={`text-xs font-mono font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-colors ${
                  isLong
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/20'
                }`}
              >
                <span
                  onClick={() => copyToClipboard(tag, `tag-${idx}`)}
                  className="cursor-pointer"
                  title="Click to copy"
                >
                  {tag}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveHashtag(idx)}
                  className="text-slate-400 hover:text-rose-400 transition-colors"
                  title="Remove hashtag"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>

        {/* Add new hashtag form */}
        <form onSubmit={handleAddHashtag} className="flex gap-2 pt-1">
          <input
            type="text"
            value={newTagInput}
            onChange={e => setNewTagInput(e.target.value)}
            placeholder="Add hashtag (e.g. Shorts, Viral)..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>

        {isHashtagsOverCount && (
          <p className="text-[11px] text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            YouTube Shorts recommends at most 3 hashtags. Extra hashtags will be hidden from the Shorts shelf.
          </p>
        )}

        {longHashtags.length > 0 && (
          <p className="text-[11px] text-rose-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Hashtags longer than 30 characters are ignored by YouTube: {longHashtags.join(', ')}
          </p>
        )}
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

      {/* Bottom Actions: Save Manual Overrides & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
        <button
          type="button"
          onClick={() => setShowOverTagDemo(!showOverTagDemo)}
          className="text-[11px] text-slate-400 hover:text-slate-200 underline underline-offset-2 flex items-center gap-1"
        >
          {showOverTagDemo ? 'Hide >60 Tags Demo' : 'Test >60 Tags Policy Warning'}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToAI}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to AI</span>
          </button>

          <button
            type="button"
            onClick={handleSaveChanges}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Changes</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
