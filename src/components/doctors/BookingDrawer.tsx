import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Video,
  X,
} from 'lucide-react';
import { useBaymini } from '../../context/BayminiContext';
import type {
  AppointmentBooking,
  ConsultationType,
  DoctorProfile,
} from '../../types/baymini';
import {
  ALL_TIME_SLOTS,
  TIME_SLOT_GROUPS,
  buildAppointmentCalendarEvent,
  buildAppointmentCalendarTemplateUrl,
  buildGoogleMapsDirectionsUrl,
  downloadAppointmentIcs,
  formatAttachedSymptomBrief,
  formatBookingDateLabel,
  formatTime24To12,
  generateNext7Days,
  hasCalendarConflict,
  isTimeSlotPast,
  toIsoLocalDate,
  validateBookingForm,
  type BookingValidationErrors,
  type BusyInterval,
} from '../../utils/doctors';
import {
  createAppointmentCalendarEvent,
  fetchDayBusyIntervals,
  hasCachedCalendarToken,
} from '../../services/googleCalendar';

interface BookingDrawerProps {
  doctor: DoctorProfile | null;
  onClose: () => void;
}

export function BookingDrawer({ doctor, onClose }: BookingDrawerProps) {
  const {
    symptomAssessment,
    addBooking,
    openBookingsDrawer,
    showToast,
  } = useBaymini();

  const next7Days = useMemo(() => generateNext7Days(), []);
  const defaultDate = useMemo(() => {
    const todayIso = next7Days[0].isoDate;
    const hasFutureToday = ALL_TIME_SLOTS.some(
      (slot) => !isTimeSlotPast(todayIso, slot.value)
    );
    return hasFutureToday ? todayIso : next7Days[1].isoDate;
  }, [next7Days]);

  const [consultationType, setConsultationType] =
    useState<ConsultationType>('in-person');
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [patientName, setPatientName] = useState('');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [attachSymptomBrief, setAttachSymptomBrief] = useState<boolean>(
    Boolean(symptomAssessment)
  );
  const [briefPreviewOpen, setBriefPreviewOpen] = useState(false);
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [errors, setErrors] = useState<BookingValidationErrors>({});

  // Calendar free/busy state (opt-in per date)
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [checkedDate, setCheckedDate] = useState<string | null>(null);
  const [busyIntervals, setBusyIntervals] = useState<BusyInterval[]>([]);
  const [conflictCheckError, setConflictCheckError] = useState<string | null>(
    null
  );

  // Submission & Confirmation state
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] =
    useState<AppointmentBooking | null>(null);
  const [calendarFallbackNotice, setCalendarFallbackNotice] = useState<
    string | null
  >(null);

  const formattedBrief = useMemo(
    () => formatAttachedSymptomBrief(symptomAssessment),
    [symptomAssessment]
  );

  // Reset form cleanly whenever a new doctor opens the drawer
  useEffect(() => {
    if (!doctor) return;
    setConsultationType('in-person');
    setSelectedDate(defaultDate);
    const firstValidSlot =
      ALL_TIME_SLOTS.find((slot) => !isTimeSlotPast(defaultDate, slot.value))
        ?.value || '10:30';
    setSelectedTime(firstValidSlot);
    setAttachSymptomBrief(Boolean(symptomAssessment));
    setBriefPreviewOpen(false);
    setSyncToCalendar(true);
    setErrors({});
    setConfirmedBooking(null);
    setCalendarFallbackNotice(null);
    setConflictCheckError(null);
    setCheckedDate(null);
    setBusyIntervals([]);
  }, [doctor, defaultDate, symptomAssessment]);

  // If the user already granted Calendar access earlier in this session, silently
  // refresh busy intervals when date changes. Never triggers a popup automatically!
  useEffect(() => {
    if (!doctor || confirmedBooking || !selectedDate) return;
    if (!hasCachedCalendarToken()) return;

    let cancelled = false;
    setCheckingConflicts(true);
    setConflictCheckError(null);
    fetchDayBusyIntervals(selectedDate, false)
      .then((intervals) => {
        if (!cancelled) {
          setBusyIntervals(intervals);
          setCheckedDate(selectedDate);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCheckedDate(null);
          setBusyIntervals([]);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingConflicts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doctor, selectedDate, confirmedBooking]);

  useEffect(() => {
    if (!doctor) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [doctor, onClose, submitting]);

  if (!doctor) return null;

  const handleDateChange = (nextDate: string) => {
    setSelectedDate(nextDate);
    setConflictCheckError(null);
    if (checkedDate !== nextDate) {
      setCheckedDate(null);
      setBusyIntervals([]);
    }
    if (selectedTime && isTimeSlotPast(nextDate, selectedTime)) {
      const firstValid =
        ALL_TIME_SLOTS.find((s) => !isTimeSlotPast(nextDate, s.value))?.value ||
        '';
      setSelectedTime(firstValid);
    }
    setErrors((prev) => ({ ...prev, date: undefined, time: undefined }));
  };

  const handleCheckCalendarConflicts = async () => {
    if (!selectedDate || checkingConflicts) return;
    setCheckingConflicts(true);
    setConflictCheckError(null);
    try {
      const intervals = await fetchDayBusyIntervals(selectedDate, true);
      setBusyIntervals(intervals);
      setCheckedDate(selectedDate);
      showToast('Google Calendar availability checked.');
    } catch {
      setConflictCheckError(
        'Could not check Google Calendar right now. You can still choose any time slot and book.'
      );
    } finally {
      setCheckingConflicts(false);
    }
  };

  const selectedSlotIsBusy =
    checkedDate === selectedDate &&
    Boolean(selectedTime) &&
    hasCalendarConflict(selectedDate, selectedTime, busyIntervals);

  const handleConfirmBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const validationErrors = validateBookingForm({
      patientName,
      contact,
      date: selectedDate,
      time: selectedTime,
    });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setCalendarFallbackNotice(null);

    const newBooking: AppointmentBooking = {
      id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      doctor,
      consultationType,
      date: selectedDate,
      time: selectedTime,
      patientName: patientName.trim(),
      contact: contact.trim(),
      notes: notes.trim(),
      ...(attachSymptomBrief && formattedBrief
        ? { attachedSymptomBrief: formattedBrief }
        : {}),
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    };

    if (syncToCalendar) {
      try {
        const calendarPayload = buildAppointmentCalendarEvent(newBooking);
        const created = await createAppointmentCalendarEvent(calendarPayload);
        newBooking.googleCalendarEventId = created.id;
        newBooking.googleCalendarLink = created.htmlLink;
        addBooking(newBooking);
        setConfirmedBooking(newBooking);
        showToast('Appointment confirmed and synced to Google Calendar.');
      } catch {
        // Never fail booking if Calendar popup is cancelled or offline
        addBooking(newBooking);
        setConfirmedBooking(newBooking);
        setCalendarFallbackNotice(
          'Your appointment is saved in Baymini. Google Calendar sync was not completed — you can open it directly in Google Calendar or download the .ics file below.'
        );
        showToast('Appointment saved locally in Baymini.');
      }
    } else {
      addBooking(newBooking);
      setConfirmedBooking(newBooking);
      showToast('Appointment confirmed and saved in Baymini.');
    }

    setSubmitting(false);
  };

  const minDateIso = toIsoLocalDate(new Date());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-black/40 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Book appointment with ${doctor.name}`}
    >
      <div className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-screen flex flex-col bg-white/95 dark:bg-[#101E17]/95 backdrop-blur-md border-t sm:border-t-0 sm:border-l border-bm-border rounded-t-3xl sm:rounded-none sm:rounded-l-2xl shadow-2xl overflow-hidden">
        {/* Drawer Header */}
        <header className="px-5 py-4 border-b border-bm-border flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-bm-tint text-bm-primary px-2.5 py-0.5 text-[11px] font-semibold">
              {doctor.specialty}
            </span>
            <h2 className="text-lg font-semibold text-bm-text mt-1 leading-snug truncate">
              {doctor.name}
            </h2>
            <p className="text-xs text-bm-text-muted mt-0.5 flex items-center gap-1 truncate">
              <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="truncate">{doctor.address}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close booking drawer"
            className="w-9 h-9 rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {confirmedBooking ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-bm-border bg-bm-surface p-5 text-center space-y-2.5">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-bm-tint text-bm-primary flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-bm-text">
                  Appointment Confirmed
                </h3>
                <p className="text-sm text-bm-text-muted">
                  Your visit with <span className="font-medium text-bm-text">{confirmedBooking.doctor.name}</span> is saved in My Bookings.
                </p>

                <div className="pt-1 flex justify-center">
                  {confirmedBooking.googleCalendarEventId ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-bm-tint text-bm-primary px-3 py-1 text-xs font-semibold">
                      <CalendarCheck className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                      <span>Synced to Google Calendar</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-bm-border bg-bm-surface-subtle text-bm-text-muted px-3 py-1 text-xs font-medium">
                      <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                      <span>Saved locally in Baymini</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Summary Card */}
              <div className="rounded-2xl border border-bm-border bg-bm-surface p-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-bm-text-muted">Date &amp; Time</span>
                  <span className="font-semibold text-bm-text text-right">
                    {formatBookingDateLabel(confirmedBooking.date)} at{' '}
                    {formatTime24To12(confirmedBooking.time)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-bm-text-muted">Consultation</span>
                  <span className="font-medium text-bm-text">
                    {confirmedBooking.consultationType === 'telehealth'
                      ? 'Online / Teleconsultation'
                      : 'In-Clinic Visit'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-bm-text-muted">Patient</span>
                  <span className="font-medium text-bm-text text-right">
                    {confirmedBooking.patientName} ({confirmedBooking.contact})
                  </span>
                </div>
                {confirmedBooking.attachedSymptomBrief && (
                  <div className="pt-2 border-t border-bm-border flex items-center gap-2 text-xs text-bm-primary font-medium">
                    <FileText className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>Baymini Pre-Visit Symptom Summary attached</span>
                  </div>
                )}
              </div>

              {/* Fallback Calendar Notice + Direct Options */}
              {calendarFallbackNotice && (
                <div className="rounded-2xl border border-bm-prompt/35 bg-bm-surface p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-bm-text-muted leading-relaxed">
                    <AlertCircle
                      className="w-4 h-4 text-bm-prompt shrink-0 mt-0.5"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <p>{calendarFallbackNotice}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={buildAppointmentCalendarTemplateUrl(confirmedBooking)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-text px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <span>Open in Google Calendar</span>
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </a>
                    <button
                      type="button"
                      onClick={() => downloadAppointmentIcs(confirmedBooking)}
                      className="rounded-full border border-bm-border bg-bm-surface-subtle hover:bg-bm-tint text-bm-text px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                      <span>Download .ics File</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Calendar / ICS links even when not synced */}
              {!calendarFallbackNotice && (
                <div className="flex flex-wrap gap-2">
                  {confirmedBooking.googleCalendarLink ? (
                    <a
                      href={confirmedBooking.googleCalendarLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <span>Open in Google Calendar</span>
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  ) : (
                    <a
                      href={buildAppointmentCalendarTemplateUrl(confirmedBooking)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <span>Open in Google Calendar</span>
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadAppointmentIcs(confirmedBooking)}
                    className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>Download .ics File</span>
                  </button>
                  <a
                    href={buildGoogleMapsDirectionsUrl(confirmedBooking.doctor)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Directions</span>
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </a>
                </div>
              )}

              {/* Primary Footer Actions */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openBookingsDrawer();
                  }}
                  className="flex-1 rounded-full bg-bm-primary hover:bg-bm-primary-hover text-white dark:text-[#0D1813] text-sm font-semibold py-2.5 px-5 transition-colors"
                >
                  View My Bookings
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text text-sm font-medium py-2.5 px-5 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirmBooking} className="space-y-6" noValidate>
              {/* 1. Consultation Type */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-bm-text-muted">
                  Consultation Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConsultationType('in-person')}
                    className={`rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                      consultationType === 'in-person'
                        ? 'border-bm-primary bg-bm-tint text-bm-primary'
                        : 'border-bm-border bg-bm-surface text-bm-text hover:bg-bm-surface-subtle'
                    }`}
                  >
                    <MapPin className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>In-Clinic Visit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultationType('telehealth')}
                    className={`rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                      consultationType === 'telehealth'
                        ? 'border-bm-primary bg-bm-tint text-bm-primary'
                        : 'border-bm-border bg-bm-surface text-bm-text hover:bg-bm-surface-subtle'
                    }`}
                  >
                    <Video className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>Online / Teleconsultation</span>
                  </button>
                </div>
              </div>

              {/* 2. Date Selector (Next 7 Days + Custom Date) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.08em] text-bm-text-muted">
                    Select Date
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-bm-text-muted">
                    <span>Custom:</span>
                    <input
                      type="date"
                      min={minDateIso}
                      value={selectedDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="rounded-lg border border-bm-border bg-bm-surface px-2 py-1 text-xs text-bm-text"
                    />
                  </label>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {next7Days.map((day) => {
                    const active = selectedDate === day.isoDate;
                    return (
                      <button
                        key={day.isoDate}
                        type="button"
                        onClick={() => handleDateChange(day.isoDate)}
                        className={`shrink-0 w-[72px] rounded-xl border py-2 px-1.5 text-center transition-colors ${
                          active
                            ? 'border-bm-primary bg-bm-primary text-white dark:text-[#0D1813]'
                            : 'border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text'
                        }`}
                      >
                        <span
                          className={`block text-[11px] font-medium ${
                            active
                              ? 'opacity-90'
                              : 'text-bm-text-muted'
                          }`}
                        >
                          {day.dayShort}
                        </span>
                        <span className="block text-base font-semibold tabular-nums mt-0.5">
                          {day.dayNum}
                        </span>
                        <span
                          className={`block text-[10px] ${
                            active ? 'opacity-85' : 'text-bm-text-muted'
                          }`}
                        >
                          {day.monthShort}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.date && (
                  <p className="text-xs text-bm-emergency dark:text-[#F27474]">
                    {errors.date}
                  </p>
                )}
              </div>

              {/* 3. Time Slots + Opt-in Calendar Free/Busy Check */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-bm-text-muted">
                    Select Time Slot
                  </span>

                  <button
                    type="button"
                    onClick={() => void handleCheckCalendarConflicts()}
                    disabled={checkingConflicts}
                    className="rounded-full border border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-primary px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
                  >
                    {checkingConflicts ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    )}
                    <span>
                      {checkedDate === selectedDate
                        ? 'Recheck calendar conflicts'
                        : 'Check my Google Calendar for conflicts'}
                    </span>
                  </button>
                </div>

                {conflictCheckError && (
                  <p className="text-xs text-bm-text-muted rounded-xl border border-bm-border bg-bm-surface-subtle px-3 py-2">
                    {conflictCheckError}
                  </p>
                )}

                <div className="space-y-3">
                  {TIME_SLOT_GROUPS.map((group) => (
                    <div key={group.period} className="space-y-1.5">
                      <p className="text-xs font-medium text-bm-text-muted flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                        <span>{group.period}</span>
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {group.slots.map((slot) => {
                          const past = isTimeSlotPast(selectedDate, slot.value);
                          const active = selectedTime === slot.value && !past;
                          const calendarChecked = checkedDate === selectedDate;
                          const isBusy =
                            calendarChecked &&
                            !past &&
                            hasCalendarConflict(
                              selectedDate,
                              slot.value,
                              busyIntervals
                            );

                          return (
                            <button
                              key={slot.value}
                              type="button"
                              disabled={past}
                              onClick={() => {
                                setSelectedTime(slot.value);
                                setErrors((prev) => ({
                                  ...prev,
                                  time: undefined,
                                }));
                              }}
                              className={`rounded-xl border px-2 py-2 text-center transition-colors ${
                                past
                                  ? 'border-bm-border bg-bm-surface-subtle/60 text-bm-text-muted/45 cursor-not-allowed line-through'
                                  : active
                                    ? 'border-bm-primary bg-bm-primary text-white dark:text-[#0D1813]'
                                    : 'border-bm-border bg-bm-surface hover:bg-bm-tint text-bm-text'
                              }`}
                            >
                              <span className="block text-xs font-semibold tabular-nums">
                                {slot.label}
                              </span>
                              {calendarChecked && !past && (
                                <span
                                  className={`mt-1 inline-block rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                                    isBusy
                                      ? active
                                        ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#0D1813]'
                                        : 'bg-bm-prompt/15 text-bm-prompt'
                                      : active
                                        ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#0D1813]'
                                        : 'bg-bm-tint text-bm-primary'
                                  }`}
                                >
                                  {isBusy ? 'Busy' : 'Free'}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedSlotIsBusy && (
                  <p className="text-xs text-bm-prompt rounded-xl border border-bm-prompt/35 bg-bm-surface px-3 py-2">
                    Heads up: this time overlaps with an event on your Google Calendar. You can still book it or select a Free slot.
                  </p>
                )}

                {errors.time && (
                  <p className="text-xs text-bm-emergency dark:text-[#F27474]">
                    {errors.time}
                  </p>
                )}

                <p className="text-[11px] leading-relaxed text-bm-text-muted">
                  Suggested appointment times for scheduling and Google Calendar reminders. Please confirm final availability directly with the clinic.
                </p>
              </div>

              {/* 4. Patient Details */}
              <div className="space-y-3.5">
                <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-bm-text-muted">
                  Patient Details
                </span>

                <div>
                  <label
                    htmlFor="booking-patient-name"
                    className="block text-xs font-medium text-bm-text mb-1"
                  >
                    Patient Full Name <span className="text-bm-emergency">*</span>
                  </label>
                  <input
                    id="booking-patient-name"
                    type="text"
                    value={patientName}
                    onChange={(e) => {
                      setPatientName(e.target.value);
                      setErrors((prev) => ({ ...prev, patientName: undefined }));
                    }}
                    placeholder="e.g., Nadia Rahman"
                    className="w-full rounded-xl border border-bm-border bg-bm-surface px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted focus:border-bm-primary transition-colors"
                  />
                  {errors.patientName && (
                    <p className="text-xs text-bm-emergency dark:text-[#F27474] mt-1">
                      {errors.patientName}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="booking-contact"
                    className="block text-xs font-medium text-bm-text mb-1"
                  >
                    Phone Number or Email <span className="text-bm-emergency">*</span>
                  </label>
                  <input
                    id="booking-contact"
                    type="text"
                    value={contact}
                    onChange={(e) => {
                      setContact(e.target.value);
                      setErrors((prev) => ({ ...prev, contact: undefined }));
                    }}
                    placeholder="e.g., +880 1711-000000 or name@example.com"
                    className="w-full rounded-xl border border-bm-border bg-bm-surface px-3.5 py-2.5 text-sm text-bm-text placeholder:text-bm-text-muted focus:border-bm-primary transition-colors"
                  />
                  {errors.contact && (
                    <p className="text-xs text-bm-emergency dark:text-[#F27474] mt-1">
                      {errors.contact}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="booking-notes"
                    className="block text-xs font-medium text-bm-text mb-1"
                  >
                    Reason for Visit / Note (Optional)
                  </label>
                  <textarea
                    id="booking-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any preference or quick context for your appointment..."
                    className="w-full rounded-xl border border-bm-border bg-bm-surface px-3.5 py-2 text-sm text-bm-text placeholder:text-bm-text-muted focus:border-bm-primary transition-colors resize-none"
                  />
                </div>
              </div>

              {/* 5. Smart Handoff from Symptom Check */}
              {symptomAssessment && formattedBrief && (
                <div className="rounded-2xl border border-bm-border bg-bm-surface p-3.5 space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attachSymptomBrief}
                      onChange={(e) => setAttachSymptomBrief(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-bm-primary"
                    />
                    <span className="text-xs sm:text-sm font-medium text-bm-text leading-snug">
                      Attach my Baymini Symptom Summary &amp; Doctor Questions
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setBriefPreviewOpen((prev) => !prev)}
                    className="text-xs font-medium text-bm-primary inline-flex items-center gap-1 hover:underline"
                  >
                    <span>
                      {briefPreviewOpen ? 'Hide brief preview' : 'Preview attached brief'}
                    </span>
                    {briefPreviewOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </button>

                  {briefPreviewOpen && (
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-bm-text-muted bg-bm-surface-subtle rounded-xl p-3 border border-bm-border">
                      {formattedBrief}
                    </pre>
                  )}
                </div>
              )}

              {/* 6. Google Calendar Sync Toggle */}
              <div className="rounded-2xl border border-bm-border bg-bm-surface p-3.5">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncToCalendar}
                    onChange={(e) => setSyncToCalendar(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded accent-bm-primary"
                  />
                  <div>
                    <span className="block text-xs sm:text-sm font-medium text-bm-text">
                      Add this appointment to my Google Calendar
                    </span>
                    <span className="block text-[11px] text-bm-text-muted mt-0.5">
                      Creates a 45-minute event with 1-hour and 15-minute reminders. Authorization happens only when you confirm.
                    </span>
                  </div>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-1 pb-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-bm-primary hover:bg-bm-primary-hover disabled:opacity-60 text-white dark:text-[#0D1813] text-sm font-semibold py-3 px-6 inline-flex items-center justify-center gap-2 transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                      <span>Saving Appointment...</span>
                    </>
                  ) : (
                    <span>
                      {syncToCalendar
                        ? 'Confirm & Sync to Calendar'
                        : 'Confirm Booking'}
                    </span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
