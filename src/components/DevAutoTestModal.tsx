import { useEffect, useId, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  Play,
  Terminal,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import { GOOGLE_CALENDAR_SCOPES } from '../config/integrations';
import { useBaymini } from '../context/BayminiContext';
import { sendChatMessageRequest } from '../services/chatbotApi';
import { fetchDayBusyIntervals } from '../services/googleCalendar';
import { geocodeLocationQuery, searchNearbyDoctors } from '../services/mapsApi';
import { toIsoLocalDate } from '../utils/doctors';
import {
  containsEmoji,
  formatDiagnosticsReport,
  runCalendarIcsAndUrlCheck,
  runDomAndZeroEmojiCheck,
  runEmergencyDetectorCheck,
  runMapsUtilityCheck,
  runNormalizerResilienceCheck,
  runPastSlotBlockingCheck,
  runStoragePersistenceCheck,
  type DiagnosticCheckResult,
  type DiagnosticStatus,
} from '../utils/diagnostics';

interface DevAutoTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_BADGE_STYLES: Record<DiagnosticStatus, string> = {
  PASS: 'border-bm-confirmed/40 bg-bm-tint text-bm-primary',
  WARN: 'border-bm-prompt/40 bg-bm-prompt/10 text-bm-prompt dark:text-[#E8A559]',
  FAIL: 'border-bm-emergency/45 bg-bm-emergency/10 text-bm-emergency dark:text-[#F27474]',
};

export function DevAutoTestModal({ isOpen, onClose }: DevAutoTestModalProps) {
  const titleId = useId();
  const { showToast } = useBaymini();

  const [results, setResults] = useState<DiagnosticCheckResult[]>([]);
  const [runningSuite, setRunningSuite] = useState<
    null | 'logic' | 'live' | 'calendar'
  >(null);
  const [copied, setCopied] = useState(false);

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

  const summary = useMemo(() => {
    return {
      pass: results.filter((r) => r.status === 'PASS').length,
      warn: results.filter((r) => r.status === 'WARN').length,
      fail: results.filter((r) => r.status === 'FAIL').length,
      total: results.length,
    };
  }, [results]);

  if (!isOpen) return null;

  const upsertGroupResults = (
    group: DiagnosticCheckResult['group'],
    nextItems: DiagnosticCheckResult[]
  ) => {
    setResults((prev) => [
      ...prev.filter((item) => item.group !== group),
      ...nextItems,
    ]);
  };

  const runIntegrationReadinessCheck =
    async (): Promise<DiagnosticCheckResult> => {
      const start = performance.now();
      try {
        const response = await fetch('/api/diagnostics/status');
        const statusData = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          geminiConfigured?: boolean;
          mapsConfigured?: boolean;
        };

        const geminiReady = Boolean(response.ok && statusData.geminiConfigured);
        const mapsReady = Boolean(response.ok && statusData.mapsConfigured);
        const firebaseReady = Boolean(
          firebaseConfig &&
            typeof firebaseConfig.projectId === 'string' &&
            firebaseConfig.projectId.trim().length > 0 &&
            typeof firebaseConfig.apiKey === 'string' &&
            firebaseConfig.apiKey.trim().length > 0 &&
            GOOGLE_CALENDAR_SCOPES.length > 0
        );

        const parts = [
          `Gemini=${geminiReady ? 'ready' : 'not-configured'}`,
          `Maps=${mapsReady ? 'ready' : 'not-configured'}`,
          `CalendarFirebase=${firebaseReady ? 'loaded' : 'missing'}`,
        ];

        const allReady = geminiReady && mapsReady && firebaseReady;
        return {
          id: 'integration-readiness',
          group: 'logic',
          name: 'Integration Readiness Check',
          status: allReady ? 'PASS' : 'WARN',
          detail: `${parts.join(' | ')} (verified without triggering OAuth popup).`,
          durationMs: performance.now() - start,
        };
      } catch (err) {
        return {
          id: 'integration-readiness',
          group: 'logic',
          name: 'Integration Readiness Check',
          status: 'FAIL',
          detail: `Could not query /api/diagnostics/status: ${err instanceof Error ? err.message : String(err)}`,
          durationMs: performance.now() - start,
        };
      }
    };

  const handleRunLogicAndUiTests = async () => {
    if (runningSuite) return;
    setRunningSuite('logic');
    setCopied(false);

    try {
      const syncChecks: DiagnosticCheckResult[] = [
        runStoragePersistenceCheck(),
        runEmergencyDetectorCheck(),
        runNormalizerResilienceCheck(),
        runMapsUtilityCheck(),
        runCalendarIcsAndUrlCheck(),
        runPastSlotBlockingCheck(),
        runDomAndZeroEmojiCheck(),
      ];
      const integrationCheck = await runIntegrationReadinessCheck();
      upsertGroupResults('logic', [...syncChecks, integrationCheck]);
    } finally {
      setRunningSuite(null);
    }
  };

  const handleRunLiveSmokeTests = async () => {
    if (runningSuite) return;
    setRunningSuite('live');
    setCopied(false);

    const liveResults: DiagnosticCheckResult[] = [];

    try {
      // 1. Live Gemini JSON Test
      const geminiStart = performance.now();
      try {
        const resp = await fetch('/api/diagnostics/gemini-smoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = (await resp.json().catch(() => ({}))) as {
          result?: { status?: string; message?: string };
          error?: string;
        };
        const elapsed = performance.now() - geminiStart;

        if (!resp.ok || !data.result) {
          liveResults.push({
            id: 'live-gemini-json',
            group: 'live',
            name: 'Live Gemini JSON Test',
            status: 'FAIL',
            detail: data.error || `Endpoint returned HTTP ${resp.status}.`,
            durationMs: elapsed,
          });
        } else {
          const msg = String(data.result.message || '').trim();
          const hasEmoji = containsEmoji(msg);
          liveResults.push({
            id: 'live-gemini-json',
            group: 'live',
            name: 'Live Gemini JSON Test',
            status: msg.length > 0 && !hasEmoji ? 'PASS' : 'FAIL',
            detail: hasEmoji
              ? 'Gemini response contained a disallowed emoji.'
              : `Structured JSON parsed cleanly: "${msg.slice(0, 90)}"`,
            durationMs: elapsed,
          });
        }
      } catch (err) {
        liveResults.push({
          id: 'live-gemini-json',
          group: 'live',
          name: 'Live Gemini JSON Test',
          status: 'FAIL',
          detail: err instanceof Error ? err.message : 'Network error.',
          durationMs: performance.now() - geminiStart,
        });
      }
      upsertGroupResults('live', [...liveResults]);

      // 2. Live Chatbot Context Test (1 health question + 1 off-topic refusal)
      const chatStart = performance.now();
      try {
        const healthResp = await sendChatMessageRequest({
          message: 'Give me one concise hydration tip for today.',
          history: [],
          sessionContext:
            'Primary goal: Better Sleep. Region: Dhaka, Bangladesh.',
          activeView: 'home',
          clientEmergencyFlag: false,
        });

        await new Promise((resolve) => setTimeout(resolve, 300));

        const offTopicResp = await sendChatMessageRequest({
          message: 'Write a Python quicksort algorithm for my coding homework.',
          history: [],
          sessionContext: '',
          activeView: 'home',
          clientEmergencyFlag: false,
        });

        const elapsed = performance.now() - chatStart;
        const combinedText = `${healthResp.reply} ${offTopicResp.reply}`;
        const hasEmoji = containsEmoji(combinedText);
        const actionsValid =
          Array.isArray(healthResp.suggestedActions) &&
          Array.isArray(offTopicResp.suggestedActions);
        const declinedOffTopic =
          !/def\s+quicksort|pivot\s*=|return\s+quicksort/i.test(
            offTopicResp.reply
          );

        liveResults.push({
          id: 'live-chatbot-context',
          group: 'live',
          name: 'Live Chatbot Context Test',
          status:
            healthResp.reply.length > 0 &&
            offTopicResp.reply.length > 0 &&
            actionsValid &&
            declinedOffTopic &&
            !hasEmoji
              ? 'PASS'
              : 'FAIL',
          detail: !declinedOffTopic
            ? 'Off-topic coding prompt was not declined as expected.'
            : hasEmoji
              ? 'Chatbot reply included a disallowed emoji.'
              : `Health reply (${healthResp.reply.length} chars, ${healthResp.suggestedActions.length} action chips) and off-topic scope refusal verified.`,
          durationMs: elapsed,
        });
      } catch (err) {
        liveResults.push({
          id: 'live-chatbot-context',
          group: 'live',
          name: 'Live Chatbot Context Test',
          status: 'FAIL',
          detail: err instanceof Error ? err.message : 'Chatbot request failed.',
          durationMs: performance.now() - chatStart,
        });
      }
      upsertGroupResults('live', [...liveResults]);

      // 3. Live Google Maps Test (Geocode Dhanmondi, Dhaka + 1 nearby clinic search)
      const mapsStart = performance.now();
      try {
        const geo = await geocodeLocationQuery('Dhanmondi, Dhaka');
        if (!geo.found || !geo.location) {
          liveResults.push({
            id: 'live-google-maps',
            group: 'live',
            name: 'Live Google Maps Test',
            status: 'FAIL',
            detail: 'Could not geocode "Dhanmondi, Dhaka".',
            durationMs: performance.now() - mapsStart,
          });
        } else {
          const search = await searchNearbyDoctors({
            lat: geo.location.lat,
            lng: geo.location.lng,
            specialty: 'General Physician',
            radiusKm: 5,
          });
          const elapsed = performance.now() - mapsStart;
          const validDistances = search.doctors.every(
            (doc) =>
              typeof doc.distanceKm === 'number' &&
              Number.isFinite(doc.distanceKm) &&
              doc.distanceKm >= 0
          );
          const anyEmoji = search.doctors.some(
            (doc) => containsEmoji(doc.name) || containsEmoji(doc.address)
          );

          liveResults.push({
            id: 'live-google-maps',
            group: 'live',
            name: 'Live Google Maps Test',
            status:
              search.doctors.length > 0 && validDistances && !anyEmoji
                ? 'PASS'
                : 'FAIL',
            detail:
              search.doctors.length === 0
                ? 'Nearby search returned 0 clinics.'
                : anyEmoji
                  ? 'Clinic listing contained a disallowed emoji.'
                  : `Geocoded "${geo.location.label}" and found ${search.doctors.length} real clinics (nearest: ${search.doctors[0].name}, ${search.doctors[0].distanceKm?.toFixed(1)} km).`,
            durationMs: elapsed,
          });
        }
      } catch (err) {
        liveResults.push({
          id: 'live-google-maps',
          group: 'live',
          name: 'Live Google Maps Test',
          status: 'FAIL',
          detail: err instanceof Error ? err.message : 'Google Maps search failed.',
          durationMs: performance.now() - mapsStart,
        });
      }
      upsertGroupResults('live', [...liveResults]);
    } finally {
      setRunningSuite(null);
    }
  };

  const handleTestCalendarAuthAndFreeBusy = async () => {
    if (runningSuite) return;
    setRunningSuite('calendar');
    setCopied(false);

    const start = performance.now();
    const todayIso = toIsoLocalDate(new Date());

    try {
      const intervals = await fetchDayBusyIntervals(todayIso, true);
      upsertGroupResults('calendar', [
        {
          id: 'live-calendar-freebusy',
          group: 'calendar',
          name: 'Google Calendar Auth & Free/Busy',
          status: 'PASS',
          detail: `OAuth handshake succeeded and Free/Busy read completed for ${todayIso} (${intervals.length} busy ${intervals.length === 1 ? 'interval' : 'intervals'} detected; 0 events created).`,
          durationMs: performance.now() - start,
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Calendar authorization failed.';
      const isCancelledOrBlocked =
        /popup-closed|cancelled|blocked|auth\/popup/i.test(message);

      upsertGroupResults('calendar', [
        {
          id: 'live-calendar-freebusy',
          group: 'calendar',
          name: 'Google Calendar Auth & Free/Busy',
          status: isCancelledOrBlocked ? 'WARN' : 'FAIL',
          detail: isCancelledOrBlocked
            ? `Authorization popup was closed or blocked (${message}). Fallback .ics and template links remain available.`
            : message,
          durationMs: performance.now() - start,
        },
      ]);
    } finally {
      setRunningSuite(null);
    }
  };

  const handleCopyReport = async () => {
    if (results.length === 0) return;
    const text = formatDiagnosticsReport(results);
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
    setCopied(true);
    showToast('Diagnostics report copied to clipboard.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0D1813]/50 dark:bg-black/70 backdrop-blur-sm"
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
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-bm-border bg-white/95 dark:bg-[#14241D]/95 backdrop-blur-md shadow-[0_20px_60px_rgba(13,24,19,0.22)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.60)] overflow-hidden"
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-bm-border flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-base sm:text-lg font-semibold tracking-tight text-bm-text truncate"
              >
                Baymini Diagnostics &amp; Auto-Test Runner
              </h2>
              <p className="text-xs text-bm-text-muted truncate">
                Hidden developer verification panel (Alt + Shift + D or ?test=1)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close diagnostics panel"
            className="w-9 h-9 rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text-muted hover:text-bm-text flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        {/* Action Controls */}
        <div className="px-6 py-4 border-b border-bm-border bg-bm-surface-subtle/60 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void handleRunLogicAndUiTests()}
              disabled={runningSuite !== null}
              className="rounded-full bg-bm-primary hover:bg-bm-primary-hover disabled:opacity-60 text-white dark:text-[#0D1813] px-4 py-2 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              {runningSuite === 'logic' ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Play className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              <span>Run Automated Logic &amp; UI Tests</span>
            </button>

            <button
              type="button"
              onClick={() => void handleRunLiveSmokeTests()}
              disabled={runningSuite !== null}
              className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint disabled:opacity-60 text-bm-text px-4 py-2 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              {runningSuite === 'live' ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Zap className="w-4 h-4 text-bm-primary" strokeWidth={1.75} aria-hidden="true" />
              )}
              <span>Run Live API Smoke Tests</span>
            </button>

            <button
              type="button"
              onClick={() => void handleTestCalendarAuthAndFreeBusy()}
              disabled={runningSuite !== null}
              className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint disabled:opacity-60 text-bm-text px-4 py-2 text-xs sm:text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              {runningSuite === 'calendar' ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Calendar className="w-4 h-4 text-bm-primary" strokeWidth={1.75} aria-hidden="true" />
              )}
              <span>Test Google Calendar Auth &amp; Free/Busy</span>
            </button>
          </div>

          {/* Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 tabular-nums">
              <span className="rounded-full border border-bm-confirmed/35 bg-bm-tint text-bm-primary px-2.5 py-0.5 font-semibold">
                PASS: {summary.pass}
              </span>
              <span className="rounded-full border border-bm-prompt/35 bg-bm-prompt/10 text-bm-prompt dark:text-[#E8A559] px-2.5 py-0.5 font-semibold">
                WARN: {summary.warn}
              </span>
              <span className="rounded-full border border-bm-emergency/35 bg-bm-emergency/10 text-bm-emergency dark:text-[#F27474] px-2.5 py-0.5 font-semibold">
                FAIL: {summary.fail}
              </span>
              <span className="text-bm-text-muted">
                Total checks run: {summary.total}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleCopyReport()}
              disabled={results.length === 0}
              className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint disabled:opacity-45 text-bm-text px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ClipboardCopy className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>{copied ? 'Report Copied' : 'Copy Test Report'}</span>
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {results.length === 0 ? (
            <div className="rounded-2xl border border-bm-border bg-bm-bg p-8 text-center space-y-2.5">
              <Activity
                className="w-6 h-6 text-bm-primary mx-auto"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-bm-text">
                Ready to run diagnostics
              </p>
              <p className="text-xs text-bm-text-muted max-w-md mx-auto leading-relaxed">
                Start with Automated Logic &amp; UI Tests (instant, zero API cost) to verify storage persistence, emergency detection, normalizers, Maps utilities, .ics generation, past-slot blocking, DOM integrity, and integration readiness.
              </p>
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-bm-border bg-bm-surface p-4 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {item.status === 'PASS' ? (
                    <CheckCircle2
                      className="w-4 h-4 text-bm-confirmed shrink-0 mt-0.5"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  ) : item.status === 'WARN' ? (
                    <AlertTriangle
                      className="w-4 h-4 text-bm-prompt dark:text-[#E8A559] shrink-0 mt-0.5"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle
                      className="w-4 h-4 text-bm-emergency dark:text-[#F27474] shrink-0 mt-0.5"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-bm-text">
                        {item.name}
                      </h3>
                      {typeof item.durationMs === 'number' && (
                        <span className="text-[11px] text-bm-text-muted tabular-nums">
                          {Math.round(item.durationMs)} ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-bm-text-muted leading-relaxed break-words">
                      {item.detail}
                    </p>
                  </div>
                </div>

                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${STATUS_BADGE_STYLES[item.status]}`}
                >
                  {item.status}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 border-t border-bm-border bg-bm-surface-subtle/60 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-bm-text-muted">
            Storage test safely restores your live session data after execution.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-4 py-1.5 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
