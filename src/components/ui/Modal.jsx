'use client';

import { useEffect, useId, useRef } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container) {
  const nodes = Array.from(
    container.querySelectorAll(FOCUSABLE_SELECTOR),
  );
  return nodes.filter(el => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  variant = 'static',
  showCloseButton = true,
  scrollable = false,
  children,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement;

    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusContainer = panelRef.current;
    if (focusContainer) {
      const focusables = getFocusable(focusContainer);
      if (focusables.length > 0) {
        focusables[0].focus({ preventScroll: true });
      } else {
        focusContainer.focus({ preventScroll: true });
      }
      focusContainer.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = getFocusable(panelRef.current);
        if (focusables.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !panelRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !panelRef.current.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      const prev = previouslyFocusedRef.current;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const backdropClasses = scrollable
    ? 'custom-modal-backdrop fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto'
    : 'custom-modal-backdrop fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overscroll-contain';

  const cardClasses = `custom-modal-card bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl ${SIZE_CLASS[size]} w-full`;

  const renderCard = () => {
    if (variant === 'animated') {
      const animatedCardClasses = scrollable
        ? `${cardClasses} my-8`
        : `${cardClasses} max-h-full`;
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className={animatedCardClasses}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
        >
          <div className="custom-modal-header p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 flex justify-between items-center">
            <div>
              <h3 id={titleId} className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
              {description && (
                <p id={descriptionId} className="text-xs text-slate-500 mt-1">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain">{children}</div>
        </motion.div>
      );
    }

    return (
      <div
        className={`${cardClasses} max-h-full flex flex-col overflow-hidden`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 p-6 pb-4 shrink-0">
          <h3 id={titleId} className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="p-6 pt-4 space-y-4 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    );
  };

  return (
    <div
      className={backdropClasses}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {renderCard()}
    </div>
  );
}

export default Modal;