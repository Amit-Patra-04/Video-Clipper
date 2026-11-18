import { useState, useRef } from 'react';
import { Upload, Film, AlertTriangle, PlayCircle, Loader2 } from 'lucide-react';

export default function UploadModal({ onUpload, onDemoLoad, isUploading }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = e => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSelect = file => {
    setError(null);
    if (!file) return;

    const allowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
    const isExtensionValid = /\.(mp4|mov|webm|mkv)$/i.test(file.name);

    if (!allowed.includes(file.type) && !isExtensionValid) {
      setError('Please upload a valid video file (.mp4, .mov, .webm, .mkv)');
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      setError('File size exceeds the 500 MB limit.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = e => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm">
      <div className="text-center mb-5">
        <h3 className="text-lg font-bold text-slate-100 mb-1">Direct Video Upload</h3>
        <p className="text-xs text-slate-400">
          Upload any podcast, interview, speech, or tutorial video (MP4, MOV, WebM, MKV)
        </p>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
          dragActive
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
          className="hidden"
          onChange={e => e.target.files && validateAndSelect(e.target.files[0])}
        />

        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
          <Upload className="w-7 h-7" />
        </div>

        {selectedFile ? (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-200">{selectedFile.name}</p>
            <p className="text-xs text-slate-400">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to analyze
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-300">
              Drag & drop your video here, or{' '}
              <span className="text-indigo-400 font-semibold underline">browse</span>
            </p>
            <p className="text-xs text-slate-500">
              Max size 500 MB • Up to 4K resolution supported
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={handleUploadSubmit}
          disabled={!selectedFile || isUploading}
          className="w-full sm:flex-1 py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing Video Pipeline...</span>
            </>
          ) : (
            <>
              <Film className="w-4 h-4" />
              <span>Start AI Clipping Engine</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onDemoLoad}
          disabled={isUploading}
          className="w-full sm:w-auto py-3 px-4 rounded-xl font-medium text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 flex items-center justify-center gap-2 transition-colors"
        >
          <PlayCircle className="w-4 h-4 text-emerald-400" />
          <span>Try Sample Video</span>
        </button>
      </div>
    </div>
  );
}
