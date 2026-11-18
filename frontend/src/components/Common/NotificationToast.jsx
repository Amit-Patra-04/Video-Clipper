import React from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export default function NotificationToast({ notification, onClose }) {
  if (!notification) return null;

  const isSuccess = notification.type === 'success';

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom duration-300">
      {isSuccess ? (
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
      )}
      <div className="text-sm text-slate-200 pr-2">{notification.message}</div>
      <button
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
