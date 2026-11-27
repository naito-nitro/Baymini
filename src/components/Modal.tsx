import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, title, onClose, children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0D1813]/45 dark:bg-black/65 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-2xl border border-bm-border bg-white/95 dark:bg-[#14241D]/95 backdrop-blur-md shadow-[0_20px_60px_rgba(13,24,19,0.18)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.55)] overflow-hidden"
      >
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-bm-border">
          <h2
            id={titleId}
            className="text-base sm:text-lg font-semibold tracking-tight text-bm-text"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-9 h-9 rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text-muted hover:text-bm-text flex items-center justify-center transition-colors duration-150 shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-5 text-sm leading-relaxed text-bm-text-muted">
          {children}
        </div>
      </div>
    </div>
  );
}
