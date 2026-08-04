import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getErrorMessage } from '@/utils/api';

export default function ErrorBanner({ error, onRetry, title = 'Something went wrong' }) {
  if (!error) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 p-3.5 animate-fade-in">
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-rose-700 dark:text-rose-400">{title}</p>
          <p className="text-[11px] text-rose-600 dark:text-rose-500/80 mt-0.5 break-words">
            {getErrorMessage(error)}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 flex-shrink-0 text-[11px] font-bold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors"
        >
          <RefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}