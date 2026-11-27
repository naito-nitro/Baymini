import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardCopy, Printer, X } from 'lucide-react';
import type { SymptomAssessment, UrgencyLevel } from '../../types/baymini';
import { formatPreVisitBriefText } from '../../utils/symptoms';

interface PreVisitBriefModalProps {
  isOpen: boolean;
  assessment: SymptomAssessment | null;
  onClose: () => void;
  onCopied: () => void;
}

const URGENCY_BADGE_STYLES: Record<
  UrgencyLevel,
  { label: string; className: string }
> = {
  emergency: {
    label: 'Emergency',
    className:
      'border-bm-emergency/35 bg-bm-emergency/10 text-bm-emergency dark:text-[#F27474]',
  },
  prompt: {
    label: 'Prompt Attention',
    className:
      'border-bm-prompt/35 bg-bm-prompt/10 text-bm-prompt dark:text-[#E8A559]',
  },
  routine: {
    label: 'Routine Checkup',
    className:
      'border-bm-routine/35 bg-bm-routine/10 text-bm-routine dark:text-[#5DC2BF]',
  },
  'self-care': {
    label: 'General Self-Care',
    className: 'border-bm-confirmed/35 bg-bm-tint text-bm-primary',
  },
};

export function PreVisitBriefModal({
  isOpen,
  assessment,
  onClose,
  onCopied,
}: PreVisitBriefModalProps) {
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

    const handleAfterPrint = () => {
      document.body.classList.remove('printing-brief');
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('printing-brief');
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !assessment || typeof document === 'undefined') {
    return null;
  }

  const urgencyBadge = URGENCY_BADGE_STYLES[assessment.urgencyLevel];
  const formattedDate = new Date(assessment.assessedAt).toLocaleString(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  );

  const handleCopyFullBrief = async () => {
    const text = formatPreVisitBriefText(assessment);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    onCopied();
  };

  const handlePrintBrief = () => {
    document.body.classList.add('printing-brief');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-brief');
    }, 500);
  };

  return createPortal(
    <div
      className="brief-print-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0D1813]/45 dark:bg-black/65 backdrop-blur-sm"
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
        className="brief-print-sheet w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-bm-border bg-white/95 dark:bg-[#14241D]/95 backdrop-blur-md shadow-[0_20px_60px_rgba(13,24,19,0.20)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.58)] overflow-hidden"
      >
        {/* Top Modal Action Bar (Hidden in Print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-bm-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyFullBrief}
              className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <ClipboardCopy className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>Copy Full Brief</span>
            </button>
            <button
              type="button"
              onClick={handlePrintBrief}
              className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>Print / Save PDF</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pre-visit brief"
            className="w-8 h-8 rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text-muted hover:text-bm-text flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {/* Printable 1-Page Clinical Handoff Sheet */}
        <div className="overflow-y-auto px-6 sm:px-8 py-6 space-y-6">
          <header className="pb-5 border-b border-bm-border">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-bm-text-muted">
                  Clinical Handoff Sheet
                </p>
                <h2
                  id={titleId}
                  className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-bm-text"
                >
                  Baymini Pre-Visit Summary
                </h2>
                <p className="mt-1 text-xs text-bm-text-muted">
                  Generated {formattedDate}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${urgencyBadge.className}`}
                >
                  {urgencyBadge.label}
                </span>
                <span className="rounded-full border border-bm-border bg-bm-surface-subtle px-3 py-1 text-xs font-medium text-bm-text">
                  {assessment.recommendedSpecialty}
                </span>
              </div>
            </div>
          </header>

          {/* Reported Symptoms & Clinical Summary */}
          <section className="space-y-2.5 print-break-avoid">
            <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-bm-text-muted">
              Reported Symptoms & Clinical Summary
            </h3>
            {assessment.selectedSymptoms.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {assessment.selectedSymptoms.map((symptom) => (
                  <span
                    key={symptom}
                    className="rounded-full border border-bm-border bg-bm-surface-subtle px-2.5 py-0.5 text-xs font-medium text-bm-text"
                  >
                    {symptom}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm leading-relaxed text-bm-text">
              {assessment.briefSummaryForDoctor}
            </p>
          </section>

          {/* Key Follow-Up Answers */}
          {assessment.followUpQA.length > 0 && (
            <section className="space-y-2.5 print-break-avoid">
              <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-bm-text-muted">
                Key Follow-Up Answers
              </h3>
              <ul className="space-y-2">
                {assessment.followUpQA.map((qa, idx) => (
                  <li
                    key={`${qa.question}-${idx}`}
                    className="text-sm leading-relaxed text-bm-text border-l-2 border-bm-border pl-3"
                  >
                    <span className="font-medium text-bm-text">{qa.question}</span>
                    <span className="text-bm-text-muted"> — {qa.answer}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Relevant Background (Only if Health Profile was factored in) */}
          {assessment.factoredProfileSummary &&
            assessment.factoredProfileSummary.length > 0 && (
              <section className="space-y-2 print-break-avoid">
                <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-bm-text-muted">
                  Relevant Background
                </h3>
                <div className="flex flex-wrap gap-2">
                  {assessment.factoredProfileSummary.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-bm-border bg-bm-tint/60 px-3 py-1 text-xs font-medium text-bm-text"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            )}

          {/* Questions to Ask the Doctor */}
          {assessment.doctorQuestions.length > 0 && (
            <section className="space-y-2.5 print-break-avoid">
              <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-bm-text-muted">
                Questions to Ask the Doctor
              </h3>
              <ol className="space-y-1.5 list-decimal list-inside text-sm leading-relaxed text-bm-text">
                {assessment.doctorQuestions.map((question, idx) => (
                  <li key={`${question}-${idx}`}>{question}</li>
                ))}
              </ol>
            </section>
          )}

          <footer className="pt-4 border-t border-bm-border text-xs leading-relaxed text-bm-text-muted">
            Prepared with Baymini for personal visit organization. AI-generated wellness summary only; not a clinical diagnosis or medical record.
          </footer>
        </div>

        {/* Bottom Close Footer (Hidden in Print) */}
        <div className="no-print flex justify-end px-6 py-3.5 border-t border-bm-border bg-bm-surface-subtle/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-5 py-1.5 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
