import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Search,
  Video,
  X,
} from 'lucide-react';
import { useBaymini } from '../../context/BayminiContext';
import type { AppointmentBooking } from '../../types/baymini';
import {
  ALL_TIME_SLOTS,
  buildAppointmentCalendarEvent,
  buildGoogleMapsDirectionsUrl,
  downloadAppointmentIcs,
  formatBookingDateLabel,
  formatTime24To12,
  isBookingInPast,
  isTimeSlotPast,
  toIsoLocalDate,
} from '../../utils/doctors';
import {
  createAppointmentCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from '../../services/googleCalendar';

export function MyBookingsDrawer() {
  const {
    bookings,
    updateBooking,
    cancelBooking,
    isBookingsDrawerOpen,
    closeBookingsDrawer,
    navigateTo,
    showToast,
  } = useBaymini();

  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [needsIcsDownloadIds, setNeedsIcsDownloadIds] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    if (!isBookingsDrawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeBookingsDrawer();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isBookingsDrawerOpen, closeBookingsDrawer]);

  const { upcomingBookings, pastBookings } = useMemo(() => {
    const upcoming: AppointmentBooking[] = [];
    const past: AppointmentBooking[] = [];
    const now = new Date();

    for (const b of bookings) {
      if (b.status === 'cancelled' || b.status === 'completed' || isBookingInPast(b, now)) {
        past.push(b);
      } else {
        upcoming.push(b);
      }
    }

    upcoming.sort((a, b) =>
      `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
    );
    past.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { upcomingBookings: upcoming, pastBookings: past };
  }, [bookings]);

  if (!isBookingsDrawerOpen) return null;

  const displayedBookings = tab === 'upcoming' ? upcomingBookings : pastBookings;
  const minDateIso = toIsoLocalDate(new Date());

  const startReschedule = (booking: AppointmentBooking) => {
    setReschedulingId(booking.id);
    setRescheduleDate(booking.date);
    setRescheduleTime(booking.time);
    setRescheduleError(null);
    setConfirmCancelId(null);
  };

  const handleSaveReschedule = async (booking: AppointmentBooking) => {
    if (!rescheduleDate || !rescheduleTime) {
      setRescheduleError('Please select a new date and time.');
      return;
    }
    if (isTimeSlotPast(rescheduleDate, rescheduleTime)) {
      setRescheduleError('Please select an upcoming time slot.');
      return;
    }

    setBusyBookingId(booking.id);
    setRescheduleError(null);

    const updatedCandidate: AppointmentBooking = {
      ...booking,
      date: rescheduleDate,
      time: rescheduleTime,
    };

    if (booking.googleCalendarEventId) {
      try {
        const payload = buildAppointmentCalendarEvent(updatedCandidate);
        const patched = await updateGoogleCalendarEvent(
          booking.googleCalendarEventId,
          payload
        );
        updateBooking(booking.id, {
          date: rescheduleDate,
          time: rescheduleTime,
          googleCalendarEventId: patched.id,
          googleCalendarLink: patched.htmlLink || booking.googleCalendarLink,
        });
        setNeedsIcsDownloadIds((prev) => ({ ...prev, [booking.id]: false }));
        showToast('Appointment rescheduled and updated in Google Calendar.');
      } catch {
        updateBooking(booking.id, {
          date: rescheduleDate,
          time: rescheduleTime,
        });
        setNeedsIcsDownloadIds((prev) => ({ ...prev, [booking.id]: true }));
        showToast(
          'Appointment updated locally. Download the updated .ics file to refresh your calendar.'
        );
      }
    } else {
      updateBooking(booking.id, {
        date: rescheduleDate,
        time: rescheduleTime,
      });
      showToast('Appointment rescheduled.');
    }

    setReschedulingId(null);
    setBusyBookingId(null);
  };

  const handleConfirmCancel = async (booking: AppointmentBooking) => {
    setBusyBookingId(booking.id);

    if (booking.googleCalendarEventId) {
      try {
        await deleteGoogleCalendarEvent(booking.googleCalendarEventId);
        cancelBooking(booking.id);
        showToast('Appointment cancelled and removed from Google Calendar.');
      } catch {
        cancelBooking(booking.id);
        showToast(
          'Appointment cancelled locally. You can remove it from Google Calendar manually.'
        );
      }
    } else {
      cancelBooking(booking.id);
      showToast('Appointment cancelled.');
    }

    setConfirmCancelId(null);
    setReschedulingId(null);
    setBusyBookingId(null);
  };

  const handleSyncExistingBooking = async (booking: AppointmentBooking) => {
    setBusyBookingId(booking.id);
    try {
      const payload = buildAppointmentCalendarEvent(booking);
      const created = await createAppointmentCalendarEvent(payload);
      updateBooking(booking.id, {
        googleCalendarEventId: created.id,
        googleCalendarLink: created.htmlLink,
      });
      setNeedsIcsDownloadIds((prev) => ({ ...prev, [booking.id]: false }));
      showToast('Appointment synced to Google Calendar.');
    } catch {
      showToast(
        'Could not sync to Google Calendar right now. You can download the .ics file instead.'
      );
    } finally {
      setBusyBookingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeBookingsDrawer();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="My Bookings"
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-screen flex flex-col bg-white/95 dark:bg-[#101E17]/95 backdrop-blur-md border-t sm:border-t-0 sm:border-l border-bm-border rounded-t-3xl sm:rounded-none sm:rounded-l-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="px-5 py-4 border-b border-bm-border flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-bm-text">My Bookings</h2>
            <p className="text-xs text-bm-text-muted mt-0.5">
              Manage upcoming visits, calendar sync, and pre-visit briefs.
            </p>
          </div>
          <button
            type="button"
            onClick={closeBookingsDrawer}
            aria-label="Close My Bookings"
            className="w-9 h-9 rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        {/* Segmented Tabs */}
        <div className="px-5 pt-4 pb-3 border-b border-bm-border shrink-0">
          <div className="grid grid-cols-2 gap-1.5 rounded-full border border-bm-border bg-bm-surface-subtle p-1">
            <button
              type="button"
              onClick={() => setTab('upcoming')}
              className={`rounded-full py-1.5 px-3 text-xs font-semibold transition-colors ${
                tab === 'upcoming'
                  ? 'bg-bm-surface text-bm-primary shadow-xs'
                  : 'text-bm-text-muted hover:text-bm-text'
              }`}
            >
              Upcoming ({upcomingBookings.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('past')}
              className={`rounded-full py-1.5 px-3 text-xs font-semibold transition-colors ${
                tab === 'past'
                  ? 'bg-bm-surface text-bm-primary shadow-xs'
                  : 'text-bm-text-muted hover:text-bm-text'
              }`}
            >
              Past &amp; Cancelled ({pastBookings.length})
            </button>
          </div>
        </div>

        {/* Bookings List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          {displayedBookings.length === 0 ? (
            <div className="rounded-2xl border border-bm-border bg-bm-surface p-8 text-center space-y-3 my-4">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-bm-tint text-bm-primary flex items-center justify-center">
                <Calendar className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-bm-text">
                {tab === 'upcoming'
                  ? 'No upcoming appointments yet'
                  : 'No past or cancelled visits'}
              </h3>
              <p className="text-sm text-bm-text-muted max-w-xs mx-auto leading-relaxed">
                {tab === 'upcoming'
                  ? 'Search nearby clinics or specialists and book a visit with optional Google Calendar sync.'
                  : 'Completed or cancelled appointments will appear here for your reference.'}
              </p>
              {tab === 'upcoming' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeBookingsDrawer();
                      navigateTo('doctors');
                    }}
                    className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] text-sm font-semibold px-5 py-2.5 inline-flex items-center gap-2 transition-colors"
                  >
                    <Search className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>Find a Doctor Nearby</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            displayedBookings.map((booking) => {
              const isCancelled = booking.status === 'cancelled';
              const isPast =
                !isCancelled &&
                (booking.status === 'completed' || isBookingInPast(booking));
              const isBusy = busyBookingId === booking.id;
              const isRescheduling = reschedulingId === booking.id;
              const isConfirmingCancel = confirmCancelId === booking.id;
              const briefExpanded = expandedBriefId === booking.id;

              return (
                <article
                  key={booking.id}
                  className={`rounded-2xl border border-bm-border bg-bm-surface p-4 space-y-3 ${
                    isCancelled ? 'opacity-75' : ''
                  }`}
                >
                  {/* Top Badges & Title */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="inline-flex items-center rounded-full bg-bm-tint text-bm-primary px-2.5 py-0.5 text-[11px] font-semibold">
                          {booking.doctor.specialty}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-bm-border bg-bm-surface-subtle text-bm-text-muted px-2.5 py-0.5 text-[11px] font-medium">
                          {booking.consultationType === 'telehealth' ? (
                            <>
                              <Video className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                              <span>Online</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                              <span>In-Clinic</span>
                            </>
                          )}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-bm-text leading-snug">
                        {booking.doctor.name}
                      </h3>
                    </div>

                    {isCancelled ? (
                      <span className="rounded-full border border-bm-border bg-bm-surface-subtle text-bm-text-muted px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                        Cancelled
                      </span>
                    ) : isPast ? (
                      <span className="rounded-full border border-bm-border bg-bm-surface-subtle text-bm-text-muted px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                        Past
                      </span>
                    ) : booking.googleCalendarEventId ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-bm-tint text-bm-primary px-2.5 py-0.5 text-[11px] font-semibold shrink-0">
                        <CalendarCheck className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                        <span>Synced</span>
                      </span>
                    ) : (
                      <span className="rounded-full border border-bm-border bg-bm-surface-subtle text-bm-text-muted px-2.5 py-0.5 text-[11px] font-medium shrink-0">
                        Saved Locally
                      </span>
                    )}
                  </div>

                  {/* Date, Address & Patient */}
                  <div className="space-y-1 text-xs text-bm-text-muted">
                    <p className="font-semibold text-bm-text flex items-center gap-1.5">
                      <CalendarClock className="w-3.5 h-3.5 text-bm-primary shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span>
                        {formatBookingDateLabel(booking.date)} at{' '}
                        {formatTime24To12(booking.time)}
                      </span>
                    </p>
                    <p className="leading-relaxed">{booking.doctor.address}</p>
                    <p>
                      Patient: <span className="text-bm-text font-medium">{booking.patientName}</span> ({booking.contact})
                    </p>
                    {booking.notes && (
                      <p className="italic">Note: {booking.notes}</p>
                    )}
                  </div>

                  {/* Expandable Attached Symptom Brief */}
                  {booking.attachedSymptomBrief && (
                    <div className="rounded-xl border border-bm-border bg-bm-surface-subtle p-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBriefId(briefExpanded ? null : booking.id)
                        }
                        className="w-full flex items-center justify-between gap-2 text-xs font-medium text-bm-primary"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                          <span>Attached Symptom Summary</span>
                        </span>
                        {briefExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                        )}
                      </button>
                      {briefExpanded && (
                        <pre className="mt-2 pt-2 border-t border-bm-border whitespace-pre-wrap font-sans text-xs leading-relaxed text-bm-text-muted">
                          {booking.attachedSymptomBrief}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Inline Reschedule Panel */}
                  {isRescheduling && (
                    <div className="rounded-xl border border-bm-border bg-bm-surface-subtle p-3 space-y-2.5">
                      <p className="text-xs font-semibold text-bm-text">
                        Choose a new date &amp; time
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="date"
                          min={minDateIso}
                          value={rescheduleDate}
                          onChange={(e) => {
                            setRescheduleDate(e.target.value);
                            setRescheduleError(null);
                          }}
                          className="rounded-xl border border-bm-border bg-bm-surface px-3 py-2 text-xs text-bm-text"
                        />
                        <select
                          value={rescheduleTime}
                          onChange={(e) => {
                            setRescheduleTime(e.target.value);
                            setRescheduleError(null);
                          }}
                          className="rounded-xl border border-bm-border bg-bm-surface px-3 py-2 text-xs text-bm-text"
                        >
                          {ALL_TIME_SLOTS.map((slot) => (
                            <option
                              key={slot.value}
                              value={slot.value}
                              disabled={isTimeSlotPast(rescheduleDate, slot.value)}
                            >
                              {slot.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {rescheduleError && (
                        <p className="text-xs text-bm-emergency dark:text-[#F27474]">
                          {rescheduleError}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSaveReschedule(booking)}
                          className="rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] text-xs font-semibold px-3.5 py-1.5 inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                        >
                          {isBusy && (
                            <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                          )}
                          <span>Save New Time</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setReschedulingId(null)}
                          className="rounded-full border border-bm-border bg-bm-surface text-bm-text text-xs font-medium px-3 py-1.5"
                        >
                          Cancel Edit
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline 2-Click Cancel Confirmation */}
                  {isConfirmingCancel && (
                    <div className="rounded-xl border border-bm-emergency/35 bg-bm-emergency/5 p-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-bm-text">
                        Cancel this appointment?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleConfirmCancel(booking)}
                          className="rounded-full bg-bm-emergency text-white text-xs font-semibold px-3 py-1.5 inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60"
                        >
                          {isBusy && (
                            <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                          )}
                          <span>Confirm Cancel</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setConfirmCancelId(null)}
                          className="rounded-full border border-bm-border bg-bm-surface text-bm-text text-xs font-medium px-3 py-1.5"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Updated .ics prompt after offline reschedule */}
                  {needsIcsDownloadIds[booking.id] && !isCancelled && (
                    <button
                      type="button"
                      onClick={() => downloadAppointmentIcs(booking)}
                      className="rounded-full border border-bm-prompt/40 bg-bm-surface-subtle hover:bg-bm-tint text-bm-text px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-bm-prompt" strokeWidth={1.75} aria-hidden="true" />
                      <span>Download updated .ics</span>
                    </button>
                  )}

                  {/* Action Row */}
                  {!isCancelled && !isPast && !isRescheduling && !isConfirmingCancel && (
                    <div className="pt-1 flex flex-wrap items-center gap-2 border-t border-bm-border">
                      <a
                        href={buildGoogleMapsDirectionsUrl(booking.doctor)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-text px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        <span>Directions</span>
                        <ExternalLink className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                      </a>

                      {booking.googleCalendarLink ? (
                        <a
                          href={booking.googleCalendarLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-primary px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Open in Calendar</span>
                          <ExternalLink className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleSyncExistingBooking(booking)}
                          className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-primary px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                          ) : (
                            <Calendar className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                          )}
                          <span>Sync to Calendar</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => downloadAppointmentIcs(booking)}
                        className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-text px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1 transition-colors"
                      >
                        <Download className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                        <span>.ics</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => startReschedule(booking)}
                        className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3 py-1.5 text-xs font-medium transition-colors"
                      >
                        Reschedule
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setConfirmCancelId(booking.id);
                          setReschedulingId(null);
                        }}
                        className="rounded-full border border-bm-border bg-bm-surface hover:border-bm-emergency/45 hover:text-bm-emergency dark:hover:text-[#F27474] text-bm-text-muted px-3 py-1.5 text-xs font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
