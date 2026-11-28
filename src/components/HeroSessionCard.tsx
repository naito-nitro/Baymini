import { useMemo } from 'react';
import {
  Activity,
  ArrowUpRight,
  Calendar,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  MapPin,
  MessageCircle,
  Stethoscope,
} from 'lucide-react';
import { useBaymini } from '../context/BayminiContext';
import {
  formatBookingSnapshotSummary,
  formatHealthPlanSnapshotSummary,
  getNextUpcomingBooking,
  getUrgencyBadgeMeta,
  hasActiveSessionSnapshot,
} from '../utils/homeSnapshot';

export function HeroSessionCard() {
  const {
    navigateTo,
    openChatbot,
    openMyBookings,
    healthProfile,
    healthPlan,
    symptomAssessment,
    bookings,
  } = useBaymini();

  const nextUpcomingBooking = useMemo(
    () => getNextUpcomingBooking(bookings),
    [bookings]
  );

  const isReturningSession = useMemo(
    () =>
      hasActiveSessionSnapshot({
        healthPlan,
        symptomAssessment,
        bookings,
      }),
    [healthPlan, symptomAssessment, bookings]
  );

  if (!isReturningSession) {
    const quickStartRows = [
      {
        key: 'health-plan',
        icon: ClipboardList,
        title: 'Build a budget meal & daily plan',
        subtitle: 'Tailored to your region, goals, and schedule',
        onClick: () => navigateTo('health-plan'),
      },
      {
        key: 'symptoms',
        icon: Activity,
        title: 'Check a symptom safely',
        subtitle: 'Adaptive AI questions with urgency & specialist match',
        onClick: () => navigateTo('symptoms'),
      },
      {
        key: 'doctors',
        icon: MapPin,
        title: 'Find a clinic or doctor nearby',
        subtitle: 'Live Google Maps search & Calendar booking',
        onClick: () => navigateTo('doctors'),
      },
      {
        key: 'assistant',
        icon: MessageCircle,
        title: 'Ask AI about sleep, diet, or stress',
        subtitle: 'Open the Baymini Health Assistant right now',
        onClick: () => openChatbot(),
      },
    ];

    return (
      <aside
        aria-label="Quick Start actions"
        className="bm-card rounded-2xl overflow-hidden shadow-[0_10px_34px_rgba(19,34,27,0.04)] dark:shadow-[0_10px_34px_rgba(0,0,0,0.32)]"
      >
        <div className="px-5 py-4 border-b border-bm-border flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-bm-text">
            Quick Start
          </h2>
          <span className="text-xs text-bm-text-muted">
            What brings you here?
          </span>
        </div>

        <div className="divide-y divide-bm-border">
          {quickStartRows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.key}
                type="button"
                onClick={row.onClick}
                className="group w-full px-5 py-3.5 text-left flex items-center gap-3 transition-colors duration-150 hover:bg-bm-surface-subtle focus-visible:outline-2 focus-visible:outline-bm-primary focus-visible:-outline-offset-2"
              >
                <div className="w-9 h-9 rounded-xl bg-bm-tint text-bm-primary flex items-center justify-center shrink-0">
                  <Icon
                    className="w-[18px] h-[18px]"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-bm-text leading-snug">
                    {row.title}
                  </p>
                  <p className="mt-0.5 text-xs text-bm-text-muted leading-snug">
                    {row.subtitle}
                  </p>
                </div>
                <ArrowUpRight
                  className="w-4 h-4 text-bm-text-muted group-hover:text-bm-primary transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 shrink-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  const urgencyBadge = symptomAssessment
    ? getUrgencyBadgeMeta(symptomAssessment.urgencyLevel)
    : null;

  const planSummary = healthPlan
    ? formatHealthPlanSnapshotSummary(healthProfile, healthPlan)
    : null;

  const bookingSummary = nextUpcomingBooking
    ? formatBookingSnapshotSummary(nextUpcomingBooking)
    : null;

  return (
    <aside
      aria-label="Your Health Snapshot"
      className="bm-card rounded-2xl overflow-hidden shadow-[0_10px_34px_rgba(19,34,27,0.04)] dark:shadow-[0_10px_34px_rgba(0,0,0,0.32)]"
    >
      <div className="px-5 py-4 border-b border-bm-border flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-bm-text">
          Your Health Snapshot
        </h2>
        <span className="inline-flex items-center rounded-full border border-bm-border bg-bm-surface-subtle px-2.5 py-0.5 text-[11px] font-medium text-bm-text-muted">
          Saved locally
        </span>
      </div>

      <div className="divide-y divide-bm-border">
        {/* 1. Active Health Plan Row */}
        <button
          type="button"
          onClick={() => navigateTo('health-plan')}
          className="group w-full px-5 py-4 text-left flex items-center gap-3.5 transition-colors duration-150 hover:bg-bm-surface-subtle focus-visible:outline-2 focus-visible:outline-bm-primary focus-visible:-outline-offset-2"
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              healthPlan
                ? 'bg-bm-tint text-bm-primary'
                : 'bg-bm-surface-subtle border border-bm-border text-bm-text-muted'
            }`}
          >
            <CalendarCheck
              className="w-[18px] h-[18px]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-semibold leading-snug ${
                healthPlan ? 'text-bm-text' : 'text-bm-text-muted'
              }`}
            >
              {healthPlan ? 'Active Health Plan' : 'Health Plan'}
            </p>
            <p className="mt-0.5 text-xs text-bm-text-muted leading-snug truncate">
              {planSummary ?? 'Not generated yet — Create your daily plan'}
            </p>
          </div>
          <ChevronRight
            className="w-4 h-4 text-bm-text-muted group-hover:text-bm-primary transition-transform duration-150 group-hover:translate-x-0.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </button>

        {/* 2. Latest Symptom Check Row */}
        <button
          type="button"
          onClick={() => navigateTo('symptoms')}
          className="group w-full px-5 py-4 text-left flex items-center gap-3.5 transition-colors duration-150 hover:bg-bm-surface-subtle focus-visible:outline-2 focus-visible:outline-bm-primary focus-visible:-outline-offset-2"
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              symptomAssessment
                ? 'bg-bm-tint text-bm-primary'
                : 'bg-bm-surface-subtle border border-bm-border text-bm-text-muted'
            }`}
          >
            <Stethoscope
              className="w-[18px] h-[18px]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`text-sm font-semibold leading-snug ${
                  symptomAssessment ? 'text-bm-text' : 'text-bm-text-muted'
                }`}
              >
                {symptomAssessment ? 'Latest Symptom Check' : 'Symptom Check'}
              </p>
              {urgencyBadge && (
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none ${urgencyBadge.className}`}
                >
                  {urgencyBadge.label}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-bm-text-muted leading-snug truncate">
              {symptomAssessment
                ? `Recommended: ${symptomAssessment.recommendedSpecialty || 'General Physician'}`
                : 'No recent check — Start a symptom check'}
            </p>
          </div>
          <ChevronRight
            className="w-4 h-4 text-bm-text-muted group-hover:text-bm-primary transition-transform duration-150 group-hover:translate-x-0.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </button>

        {/* 3. Next Upcoming Appointment Row */}
        <button
          type="button"
          onClick={() =>
            nextUpcomingBooking ? openMyBookings() : navigateTo('doctors')
          }
          className="group w-full px-5 py-4 text-left flex items-center gap-3.5 transition-colors duration-150 hover:bg-bm-surface-subtle focus-visible:outline-2 focus-visible:outline-bm-primary focus-visible:-outline-offset-2"
        >
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              nextUpcomingBooking
                ? 'bg-bm-tint text-bm-primary'
                : 'bg-bm-surface-subtle border border-bm-border text-bm-text-muted'
            }`}
          >
            <Calendar
              className="w-[18px] h-[18px]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`text-sm font-semibold leading-snug ${
                  nextUpcomingBooking ? 'text-bm-text' : 'text-bm-text-muted'
                }`}
              >
                {nextUpcomingBooking ? 'Next Appointment' : 'Appointments'}
              </p>
              {nextUpcomingBooking?.googleCalendarEventId && (
                <span className="inline-flex items-center rounded-full border border-bm-confirmed/30 bg-bm-tint px-2 py-0.5 text-[11px] font-medium leading-none text-bm-confirmed">
                  Synced
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-bm-text-muted leading-snug truncate">
              {bookingSummary ?? 'None scheduled — Find a doctor nearby'}
            </p>
          </div>
          <ChevronRight
            className="w-4 h-4 text-bm-text-muted group-hover:text-bm-primary transition-transform duration-150 group-hover:translate-x-0.5 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Compact Card Footer Action */}
      <div className="border-t border-bm-border bg-bm-surface-subtle/50">
        <button
          type="button"
          onClick={() => openChatbot()}
          className="group w-full px-5 py-3.5 text-left flex items-center justify-between gap-2.5 text-xs sm:text-[13px] font-medium text-bm-primary hover:bg-bm-tint/60 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-bm-primary focus-visible:-outline-offset-2"
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <MessageCircle
              className="w-4 h-4 shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="truncate">
              Ask Health Assistant about your plan or visit
            </span>
          </span>
          <ArrowUpRight
            className="w-3.5 h-3.5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </button>
      </div>
    </aside>
  );
}
