'use client';

import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer({ toasts, onClose }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none" role="region" aria-label="Notifications" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => {
          let Icon = Info;
          let bgColor = 'bg-white dark:bg-slate-900';
          let borderColor = 'border-slate-200 dark:border-slate-800';
          let iconColor = 'text-blue-500';

          switch (toast.type) {
            case 'success':
              Icon = CheckCircle2;
              iconColor = 'text-emerald-500';
              break;
            case 'warning':
              Icon = AlertTriangle;
              iconColor = 'text-amber-500';
              break;
            case 'danger':
              Icon = AlertCircle;
              iconColor = 'text-red-500';
              break;
            case 'info':
              Icon = Info;
              iconColor = 'text-sky-500';
              break;
          }

          return (
            <motion.div
              key={toast.id}
              role="alert"
              aria-atomic="true"
              layout
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border ${bgColor} ${borderColor} shadow-lg shadow-slate-100 dark:shadow-none`}
            >
              <div className={`p-1 rounded-lg bg-slate-50 dark:bg-slate-800/50 ${iconColor}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {toast.title}
                </h4>
                {toast.description && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onClose(toast.id)}
                aria-label="Dismiss notification"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}