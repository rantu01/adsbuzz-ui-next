'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  loadingLabel = 'Working...',
}) {
  const [confirming, setConfirming] = useState(false);

  const isBusy = loading || confirming;

  const handleConfirm = async () => {
    if (isBusy) return;
    try {
      setConfirming(true);
      await onConfirm?.();
    } finally {
      setConfirming(false);
    }
  };

  const accent =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700'
      : variant === 'warning'
        ? 'bg-amber-500 hover:bg-amber-600'
        : 'bg-brand-blue hover:bg-[#154673]';

  const iconAccent =
    variant === 'danger'
      ? 'text-rose-500 bg-rose-50 dark:bg-rose-500/10'
      : variant === 'warning'
        ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10'
        : 'text-brand-blue bg-blue-50 dark:bg-blue-500/10';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        {message && (
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconAccent}`}>
              <AlertTriangle size={16} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">{message}</p>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isBusy}
            className={`text-xs font-bold px-3.5 py-2 rounded-xl text-white disabled:opacity-60 cursor-pointer transition-colors ${accent}`}
          >
            {isBusy ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
