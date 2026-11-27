import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useBaymini } from '../../context/BayminiContext';
import type { HealthPlan } from '../../types/baymini';
import {
  buildCalendarEventsPayload,
  buildDefaultRoutineBlocks,
  buildGoogleCalendarTemplateUrl,
  buildIcsContent,
  downloadIcsFile,
  type RoutineCalendarBlock,
  type RoutineScheduleMode,
} from '../../utils/calendarSync';
import { createGoogleCalendarEvents } from '../../services/googleCalendar';
import { Modal } from '../Modal';

interface CalendarSyncModalProps {
  isOpen: boolean;
  plan: HealthPlan;
  onClose: () => void;
}

type SyncState = 'idle' | 'syncing' | 'success' | 'fallback';

export function CalendarSyncModal({
  isOpen,
  plan,
  onClose,
}: CalendarSyncModalProps) {
  const { showToast } = useBaymini();
  const [blocks, setBlocks] = useState<RoutineCalendarBlock[]>(() =>
    buildDefaultRoutineBlocks(plan)
  );
  const [scheduleMode, setScheduleMode] =
    useState<RoutineScheduleMode>('repeat-7-days');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncedCount, setSyncedCount] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setBlocks(buildDefaultRoutineBlocks(plan));
      setSyncState('idle');
      setSyncedCount(0);
    }
  }, [isOpen, plan]);

  const selectedBlocks = blocks.filter((b) => b.selected);

  const toggleBlock = (id: RoutineCalendarBlock['id']) => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === id ? { ...block, selected: !block.selected } : block
      )
    );
  };

  const updateBlockTime = (
    id: RoutineCalendarBlock['id'],
    startTime: string
  ) => {
    setBlocks((prev) =>
      prev.map((block) =>
        block.id === id ? { ...block, startTime } : block
      )
    );
  };

  const handleSyncToGoogleCalendar = async () => {
    if (selectedBlocks.length === 0) return;
    setSyncState('syncing');

    try {
      const events = buildCalendarEventsPayload(blocks, scheduleMode);
      const created = await createGoogleCalendarEvents(events);
      setSyncedCount(created.length);
      setSyncState('success');
      showToast(
        `${created.length} routine ${
          created.length === 1 ? 'reminder' : 'reminders'
        } added to Google Calendar.`
      );
    } catch {
      setSyncState('fallback');
    }
  };

  const handleDownloadIcs = () => {
    if (selectedBlocks.length === 0) return;
    const ics = buildIcsContent(blocks, scheduleMode);
    downloadIcsFile(ics, 'baymini-wellness-routine.ics');
    showToast('Routine .ics file downloaded.');
  };

  const firstSelectedBlock = selectedBlocks[0] ?? blocks[0];
  const googleTemplateUrl = firstSelectedBlock
    ? buildGoogleCalendarTemplateUrl(firstSelectedBlock, scheduleMode)
    : 'https://calendar.google.com/calendar/u/0/r';

  return (
    <Modal
      isOpen={isOpen}
      title="Sync Routine to Google Calendar"
      onClose={onClose}
    >
      {syncState === 'success' ? (
        <div className="space-y-5 py-2">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-bm-tint text-bm-confirmed flex items-center justify-center shrink-0">
              <CheckCircle2
                className="w-5 h-5"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-bm-text">
                Routine reminders saved to Google Calendar
              </p>
              <p className="mt-1 text-sm text-bm-text-muted">
                {syncedCount} daily{' '}
                {syncedCount === 1 ? 'block has' : 'blocks have'} been scheduled
                ({scheduleMode === 'repeat-7-days'
                  ? 'repeating daily for 7 days'
                  : 'scheduled for tomorrow'}
                ).
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-5 py-2 text-sm font-medium transition-colors whitespace-nowrap"
            >
              Done
            </button>
            <a
              href="https://calendar.google.com/calendar/u/0/r"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-5 py-2 text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <span>Open Google Calendar</span>
              <ExternalLink
                className="w-3.5 h-3.5"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-bm-text-muted">
            Turn your health plan into gentle calendar reminders. Google
            Calendar access is only requested when you confirm below.
          </p>

          {/* Selectable Routine Blocks */}
          <div className="space-y-2.5">
            {blocks.map((block) => (
              <div
                key={block.id}
                className={`rounded-xl border p-3.5 transition-colors ${
                  block.selected
                    ? 'border-bm-primary/40 bg-bm-tint/45'
                    : 'border-bm-border bg-bm-bg'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={block.selected}
                      onChange={() => toggleBlock(block.id)}
                      className="w-4 h-4 rounded accent-bm-primary cursor-pointer"
                    />
                    <span className="text-sm font-medium text-bm-text">
                      {block.label}
                    </span>
                  </label>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="time"
                      aria-label={`${block.label} start time`}
                      value={block.startTime}
                      disabled={!block.selected}
                      onChange={(e) => updateBlockTime(block.id, e.target.value)}
                      className="rounded-lg border border-bm-border bg-bm-surface px-2.5 py-1 text-xs font-medium text-bm-text tabular-nums disabled:opacity-50"
                    />
                    <span className="text-xs text-bm-text-muted tabular-nums whitespace-nowrap">
                      {block.durationMinutes} min
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Schedule Selector */}
          <div>
            <span className="block text-xs font-medium uppercase tracking-wider text-bm-text-muted mb-2">
              Schedule
            </span>
            <div
              role="group"
              aria-label="Routine schedule"
              className="grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                onClick={() => setScheduleMode('tomorrow')}
                aria-pressed={scheduleMode === 'tomorrow'}
                className={`rounded-full px-3.5 py-2 text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap ${
                  scheduleMode === 'tomorrow'
                    ? 'bg-bm-tint border-bm-primary/40 text-bm-primary'
                    : 'bg-bm-bg border-bm-border text-bm-text-muted hover:text-bm-text'
                }`}
              >
                Add for Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode('repeat-7-days')}
                aria-pressed={scheduleMode === 'repeat-7-days'}
                className={`rounded-full px-3.5 py-2 text-xs sm:text-sm font-medium border transition-colors whitespace-nowrap ${
                  scheduleMode === 'repeat-7-days'
                    ? 'bg-bm-tint border-bm-primary/40 text-bm-primary'
                    : 'bg-bm-bg border-bm-border text-bm-text-muted hover:text-bm-text'
                }`}
              >
                Repeat Daily for 7 Days
              </button>
            </div>
          </div>

          {/* Graceful Fallback Panel */}
          {syncState === 'fallback' && (
            <div
              role="status"
              className="rounded-xl border border-bm-border bg-bm-bg p-4 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle
                  className="w-4 h-4 text-bm-prompt shrink-0 mt-0.5"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <p className="text-xs sm:text-sm text-bm-text">
                  Direct Google Calendar sync could not be completed. You can
                  still save your routine in one click:
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadIcs}
                  disabled={selectedBlocks.length === 0}
                  className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  <Download
                    className="w-3.5 h-3.5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span>Download .ics Routine File</span>
                </button>

                <a
                  href={googleTemplateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-4 py-2 text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <span>Open in Google Calendar</span>
                  <ExternalLink
                    className="w-3.5 h-3.5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>
          )}

          {/* Primary Action Footer */}
          <div className="pt-2 flex flex-wrap items-center justify-end gap-3 border-t border-bm-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-5 py-2 text-sm font-medium transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedBlocks.length === 0 || syncState === 'syncing'}
              onClick={handleSyncToGoogleCalendar}
              className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] px-5 py-2 text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {syncState === 'syncing' ? (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Calendar
                    className="w-4 h-4"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span>Add Selected to Google Calendar</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
