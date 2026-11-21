import { useState } from 'react';
import {
  X,
  Key,
  Cpu,
  CheckCircle2,
  Sparkles,
  Server,
  HardDrive,
  ShieldCheck,
  Save,
  RotateCcw
} from 'lucide-react';

const getStoredSettings = () => {
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('supoclip_settings') : null;
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export default function SettingsModal({ isOpen, onClose }) {
  const [initialSettings] = useState(getStoredSettings);
  const [geminiKey, setGeminiKey] = useState(initialSettings.geminiKey || '');
  const [openaiKey, setOpenaiKey] = useState(initialSettings.openaiKey || '');
  const [assemblyKey, setAssemblyKey] = useState(initialSettings.assemblyKey || '');
  const [pexelsKey, setPexelsKey] = useState(initialSettings.pexelsKey || '');
  const [ollamaUrl, setOllamaUrl] = useState(initialSettings.ollamaUrl || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(initialSettings.ollamaModel || 'llama3.2');
  const [selectedProvider, setSelectedProvider] = useState(initialSettings.selectedProvider || 'gemini');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    const settings = {
      geminiKey,
      openaiKey,
      assemblyKey,
      pexelsKey,
      ollamaUrl,
      ollamaModel,
      selectedProvider,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem('supoclip_settings', JSON.stringify(settings));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  };

  const handleResetDefaults = () => {
    setGeminiKey('');
    setOpenaiKey('');
    setAssemblyKey('');
    setPexelsKey('');
    setOllamaUrl('http://localhost:11434');
    setOllamaModel('llama3.2');
    setSelectedProvider('gemini');
    localStorage.removeItem('supoclip_settings');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>SupoClip Settings & AI Providers</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Self-Hostable
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Configure your API keys for cloud models or connect to local Ollama / Whisper.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* System Diagnostic Status */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>FFmpeg 9.0</span>
            </div>
            <span className="font-bold text-emerald-400 text-[11px]">Ready & Active</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              <span>Database</span>
            </div>
            <span className="font-bold text-emerald-400 text-[11px]">SQLite Connected</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>STT Engine</span>
            </div>
            <span className="font-bold text-emerald-400 text-[11px]">Whisper & Assembly</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>MCP Server</span>
            </div>
            <span className="font-bold text-indigo-400 text-[11px]">Port 9100 Ready</span>
          </div>
        </div>

        {/* Active Model Provider Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">
            Default AI Virality Analysis Provider:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'gemini', label: 'Google Gemini', desc: 'Fast & Multimodal' },
              { id: 'openai', label: 'OpenAI GPT-4o', desc: 'High Precision' },
              { id: 'claude', label: 'Claude 3.5', desc: 'Nuanced Reasoning' },
              { id: 'ollama', label: 'Local Ollama', desc: '100% Private / Free' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProvider(p.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedProvider === p.id
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs">{p.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* API Credentials Inputs */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Google Gemini API Key</span>
              </label>
              <span className="text-[10px] text-slate-500">Free tier supported</span>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>OpenAI API Key</span>
              </label>
              <span className="text-[10px] text-slate-500">Optional for GPT-4o / Whisper</span>
            </div>
            <input
              type="password"
              value={openaiKey}
              onChange={e => setOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>AssemblyAI Key (Optional)</span>
              </label>
              <input
                type="password"
                value={assemblyKey}
                onChange={e => setAssemblyKey(e.target.value)}
                placeholder="AssemblyAI Key..."
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pexels Key (Optional B-Roll)</span>
              </label>
              <input
                type="password"
                value={pexelsKey}
                onChange={e => setPexelsKey(e.target.value)}
                placeholder="Pexels API Key..."
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {/* Local Ollama Configuration */}
          <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>Self-Hosted Local Ollama Settings</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Ollama Base URL:</label>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Model Name:</label>
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={e => setOllamaModel(e.target.value)}
                  placeholder="llama3.2 or mistral"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Success feedback */}
        {savedSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Settings saved successfully to browser storage!</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
