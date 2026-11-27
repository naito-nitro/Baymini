import { CheckCircle2, X } from 'lucide-react';
import { useBaymini } from '../context/BayminiContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useBaymini();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="no-print fixed bottom-5 left-5 z-50 flex flex-col gap-2 max-w-[calc(100vw-6rem)]"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="bm-glass border border-bm-border rounded-full pl-4 pr-2.5 py-2.5 shadow-[0_8px_28px_rgba(19,34,27,0.12)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.45)] flex items-center gap-2.5 text-sm text-bm-text"
        >
          <CheckCircle2
            className="w-4 h-4 text-bm-confirmed shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="w-7 h-7 rounded-full hover:bg-bm-tint text-bm-text-muted hover:text-bm-text flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
