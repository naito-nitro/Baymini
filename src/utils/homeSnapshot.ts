import type {
  AppointmentBooking,
  HealthPlan,
  HealthProfile,
  SymptomAssessment,
  UrgencyLevel,
} from '../types/baymini';
import { formatTime24To12, isBookingInPast } from './doctors';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export interface UrgencyBadgeMeta {
  label: string;
  className: string;
}

export function getNextUpcomingBooking(
  bookings: AppointmentBooking[],
  now = new Date()
): AppointmentBooking | null {
  const upcoming = bookings.filter(
    (booking) =>
      booking.status === 'upcoming' && !isBookingInPast(booking, now)
  );
  if (upcoming.length === 0) return null;

  upcoming.sort((a, b) =>
    `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)
  );
  return upcoming[0];
}

export function hasActiveSessionSnapshot(params: {
  healthPlan: HealthPlan | null;
  symptomAssessment: SymptomAssessment | null;
  bookings: AppointmentBooking[];
  now?: Date;
}): boolean {
  if (params.healthPlan) return true;
  if (params.symptomAssessment) return true;
  return getNextUpcomingBooking(params.bookings, params.now) !== null;
}

export function formatHealthPlanSnapshotSummary(
  healthProfile: HealthProfile | null,
  healthPlan: HealthPlan
): string {
  const primaryGoal =
    healthProfile?.primaryGoal?.trim() ||
    healthProfile?.goals?.find((goal) => goal.trim().length > 0)?.trim() ||
    'Personalized Daily Plan';

  const budget = healthProfile?.budget?.trim() || '';
  const diet =
    healthProfile?.dietType === 'Other'
      ? healthProfile.dietTypeOther?.trim() || ''
      : healthProfile?.dietType?.trim() || '';

  const secondary =
    budget ||
    diet ||
    (healthPlan.meals.length > 0
      ? `${healthPlan.meals.length} daily meals`
      : '');

  return secondary ? `${primaryGoal} · ${secondary}` : primaryGoal;
}

export function getUrgencyBadgeMeta(level: UrgencyLevel): UrgencyBadgeMeta {
  switch (level) {
    case 'emergency':
      return {
        label: 'Emergency',
        className:
          'border-[#C93B3B]/35 bg-[#C93B3B]/10 dark:bg-[#C93B3B]/20 text-[#C93B3B] dark:text-[#F27474]',
      };
    case 'prompt':
      return {
        label: 'Prompt',
        className:
          'border-[#C47A2C]/35 bg-[#C47A2C]/10 dark:bg-[#C47A2C]/20 text-[#A86219] dark:text-[#E8A559]',
      };
    case 'routine':
      return {
        label: 'Routine',
        className:
          'border-[#2B7A78]/35 bg-[#2B7A78]/10 dark:bg-[#2B7A78]/20 text-[#226462] dark:text-[#66C7C4]',
      };
    case 'self-care':
    default:
      return {
        label: 'Self-Care',
        className:
          'border-[#2D6A4F]/30 dark:border-[#68C294]/35 bg-[#E3EFE8] dark:bg-[#1B3127] text-[#2D6A4F] dark:text-[#68C294]',
      };
  }
}

export function formatShortBookingDate(
  isoDate: string,
  now = new Date()
): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return isoDate;
  }
  const [year, month, day] = parts;
  const monthLabel = SHORT_MONTHS[month - 1];
  if (!monthLabel) return isoDate;

  if (year === now.getFullYear()) {
    return `${monthLabel} ${day}`;
  }
  return `${monthLabel} ${day}, ${year}`;
}

export function formatBookingSnapshotSummary(
  booking: AppointmentBooking,
  now = new Date()
): string {
  const doctorName = booking.doctor.name.trim() || 'Clinic Visit';
  const dateLabel = formatShortBookingDate(booking.date, now);
  const timeLabel = formatTime24To12(booking.time);
  return `${doctorName} · ${dateLabel}, ${timeLabel}`;
}
