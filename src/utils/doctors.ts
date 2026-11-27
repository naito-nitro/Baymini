import type {
  AppointmentBooking,
  ConsultationType,
  DoctorProfile,
  SymptomAssessment,
} from '../types/baymini';
import { stripEmojis } from './healthPlan';

export const SPECIALTY_OPTIONS = [
  'All Clinics',
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Pulmonologist',
  'Gastroenterologist',
  'ENT Specialist',
  'Orthopedic',
  'Neurologist',
  'Pediatrician',
  'Emergency Hospital',
] as const;

export type SpecialtyOption = (typeof SPECIALTY_OPTIONS)[number];

export const RADIUS_OPTIONS = [3, 5, 10] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];

export interface TimeSlotOption {
  value: string; // HH:MM (24-hour)
  label: string; // e.g., 09:30 AM
}

export interface TimeSlotGroup {
  period: 'Morning' | 'Afternoon' | 'Evening';
  slots: TimeSlotOption[];
}

export const TIME_SLOT_GROUPS: ReadonlyArray<TimeSlotGroup> = [
  {
    period: 'Morning',
    slots: [
      { value: '09:30', label: '09:30 AM' },
      { value: '10:30', label: '10:30 AM' },
      { value: '11:30', label: '11:30 AM' },
    ],
  },
  {
    period: 'Afternoon',
    slots: [
      { value: '14:00', label: '02:00 PM' },
      { value: '15:30', label: '03:30 PM' },
      { value: '16:30', label: '04:30 PM' },
    ],
  },
  {
    period: 'Evening',
    slots: [
      { value: '18:00', label: '06:00 PM' },
      { value: '19:00', label: '07:00 PM' },
      { value: '20:00', label: '08:00 PM' },
    ],
  },
];

export const ALL_TIME_SLOTS: ReadonlyArray<TimeSlotOption> =
  TIME_SLOT_GROUPS.flatMap((group) => group.slots);

export const APPOINTMENT_DURATION_MINUTES = 45;

export function normalizeSpecialtyHint(hint: string | null | undefined): SpecialtyOption {
  if (!hint || !hint.trim()) return 'All Clinics';
  const lowered = hint.trim().toLowerCase();

  for (const option of SPECIALTY_OPTIONS) {
    if (option.toLowerCase() === lowered) {
      return option;
    }
  }

  if (
    lowered.includes('emergency') ||
    lowered.includes('urgent') ||
    /\ber\b/.test(lowered)
  ) {
    return 'Emergency Hospital';
  }
  if (lowered.includes('cardio') || lowered.includes('heart')) return 'Cardiologist';
  if (lowered.includes('derma') || lowered.includes('skin')) return 'Dermatologist';
  if (lowered.includes('pulmo') || lowered.includes('chest') || lowered.includes('lung')) {
    return 'Pulmonologist';
  }
  if (lowered.includes('gastro') || lowered.includes('stomach') || lowered.includes('digest')) {
    return 'Gastroenterologist';
  }
  if (lowered.includes('ent') || lowered.includes('ear') || lowered.includes('throat')) {
    return 'ENT Specialist';
  }
  if (lowered.includes('ortho') || lowered.includes('bone') || lowered.includes('joint')) {
    return 'Orthopedic';
  }
  if (lowered.includes('neuro') || lowered.includes('brain')) return 'Neurologist';
  if (lowered.includes('pediat') || lowered.includes('child')) return 'Pediatrician';
  if (lowered.includes('general') || lowered.includes('primary') || lowered.includes('family') || lowered.includes('internal')) {
    return 'General Physician';
  }

  return 'All Clinics';
}

export function expandSpecialtyQuery(specialty: string): string {
  const normalized = normalizeSpecialtyHint(specialty);
  switch (normalized) {
    case 'All Clinics':
      return 'medical clinic OR hospital OR doctor chamber';
    case 'General Physician':
      return 'general physician OR family medicine clinic OR medical clinic';
    case 'Cardiologist':
      return 'cardiologist OR heart hospital OR cardiac clinic';
    case 'Dermatologist':
      return 'dermatologist OR skin clinic';
    case 'Pulmonologist':
      return 'pulmonologist OR chest specialist OR respiratory clinic';
    case 'Gastroenterologist':
      return 'gastroenterologist OR gastro clinic OR digestive clinic';
    case 'ENT Specialist':
      return 'ENT specialist OR ear nose throat clinic';
    case 'Orthopedic':
      return 'orthopedic clinic OR bone and joint hospital';
    case 'Neurologist':
      return 'neurologist OR neurology clinic';
    case 'Pediatrician':
      return 'pediatrician OR children hospital OR child clinic';
    case 'Emergency Hospital':
      return 'emergency hospital OR 24 hour emergency room';
    default:
      return 'medical clinic OR hospital';
  }
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function buildGoogleMapsDirectionsUrl(doctor: DoctorProfile): string {
  const params = new URLSearchParams({ api: '1' });
  if (typeof doctor.lat === 'number' && typeof doctor.lng === 'number') {
    params.set('destination', `${doctor.lat},${doctor.lng}`);
  } else {
    params.set(
      'destination',
      `${doctor.name}${doctor.address ? `, ${doctor.address}` : ''}`
    );
  }
  if (doctor.id) {
    params.set('destination_place_id', doctor.id);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function formatDistanceKm(distanceKm?: number): string {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) {
    return '';
  }
  if (distanceKm < 0.1) {
    return '0.1 km away';
  }
  return `${distanceKm.toFixed(1)} km away`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toIsoLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export interface DayChoice {
  isoDate: string;
  dayShort: string;
  dayNum: string;
  monthShort: string;
  isToday: boolean;
  label: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
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
];

export function generateNext7Days(baseDate = new Date()): DayChoice[] {
  const days: DayChoice[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate() + offset
    );
    const dayShort = DAY_NAMES[d.getDay()];
    const monthShort = MONTH_NAMES[d.getMonth()];
    const dayNum = String(d.getDate());
    days.push({
      isoDate: toIsoLocalDate(d),
      dayShort: offset === 0 ? 'Today' : dayShort,
      dayNum,
      monthShort,
      isToday: offset === 0,
      label: `${dayShort}, ${monthShort} ${dayNum}`,
    });
  }
  return days;
}

export function parseSlotToDate(isoDate: string, time24h: string): Date | null {
  const dateParts = isoDate.split('-').map(Number);
  const timeParts = time24h.split(':').map(Number);
  if (
    dateParts.length !== 3 ||
    timeParts.length < 2 ||
    dateParts.some((n) => !Number.isFinite(n)) ||
    timeParts.some((n) => !Number.isFinite(n))
  ) {
    return null;
  }
  return new Date(
    dateParts[0],
    dateParts[1] - 1,
    dateParts[2],
    timeParts[0],
    timeParts[1],
    0,
    0
  );
}

export function isTimeSlotPast(
  isoDate: string,
  time24h: string,
  now = new Date()
): boolean {
  const slotDate = parseSlotToDate(isoDate, time24h);
  if (!slotDate) return false;
  return slotDate.getTime() <= now.getTime();
}

export interface BusyInterval {
  startMs: number;
  endMs: number;
  summary?: string;
}

export function hasCalendarConflict(
  isoDate: string,
  time24h: string,
  busyIntervals: BusyInterval[],
  durationMinutes = APPOINTMENT_DURATION_MINUTES
): boolean {
  if (busyIntervals.length === 0) return false;
  const start = parseSlotToDate(isoDate, time24h);
  if (!start) return false;
  const slotStart = start.getTime();
  const slotEnd = slotStart + durationMinutes * 60_000;

  return busyIntervals.some(
    (interval) => slotStart < interval.endMs && slotEnd > interval.startMs
  );
}

export function formatTime24To12(time24h: string): string {
  const existing = ALL_TIME_SLOTS.find((s) => s.value === time24h);
  if (existing) return existing.label;
  const [hRaw, mRaw] = time24h.split(':').map(Number);
  if (!Number.isFinite(hRaw) || !Number.isFinite(mRaw)) return time24h;
  const suffix = hRaw >= 12 ? 'PM' : 'AM';
  const h12 = hRaw % 12 === 0 ? 12 : hRaw % 12;
  return `${pad2(h12)}:${pad2(mRaw)} ${suffix}`;
}

export function formatBookingDateLabel(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return isoDate;
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function isBookingInPast(
  booking: Pick<AppointmentBooking, 'date' | 'time'>,
  now = new Date()
): boolean {
  const dt = parseSlotToDate(booking.date, booking.time);
  if (!dt) return false;
  return dt.getTime() + APPOINTMENT_DURATION_MINUTES * 60_000 < now.getTime();
}

export interface BookingValidationErrors {
  patientName?: string;
  contact?: string;
  date?: string;
  time?: string;
}

export function validateBookingForm(input: {
  patientName: string;
  contact: string;
  date: string;
  time: string;
  now?: Date;
}): BookingValidationErrors {
  const errors: BookingValidationErrors = {};
  const name = input.patientName.trim();
  const contact = input.contact.trim();

  if (name.length < 2) {
    errors.patientName = 'Please enter the patient full name.';
  }
  if (contact.length < 5) {
    errors.contact = 'Please enter a valid phone number or email address.';
  }
  if (!input.date) {
    errors.date = 'Please choose an appointment date.';
  }
  if (!input.time) {
    errors.time = 'Please choose an available time slot.';
  } else if (input.date && isTimeSlotPast(input.date, input.time, input.now)) {
    errors.time = 'This time slot has already passed. Please select an upcoming time.';
  }

  return errors;
}

export function formatAttachedSymptomBrief(
  assessment: SymptomAssessment | null
): string {
  if (!assessment) return '';
  const lines: string[] = [];
  if (assessment.selectedSymptoms.length > 0) {
    lines.push(`Reported symptoms: ${assessment.selectedSymptoms.join(', ')}`);
  }
  lines.push(`Urgency level: ${assessment.urgencyTitle}`);
  if (assessment.briefSummaryForDoctor) {
    lines.push(`Summary: ${assessment.briefSummaryForDoctor}`);
  }
  if (assessment.doctorQuestions.length > 0) {
    lines.push('Questions for the doctor:');
    assessment.doctorQuestions.slice(0, 4).forEach((q, idx) => {
      lines.push(`${idx + 1}. ${q}`);
    });
  }
  return stripEmojis(lines.join('\n'));
}

function formatLocalIsoDateTime(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());

  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMin);
  const offH = pad2(Math.floor(absOffset / 60));
  const offM = pad2(absOffset % 60);

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${sign}${offH}:${offM}`;
}

function formatIcsLocalDateTime(date: Date): string {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}${pad2(date.getMinutes())}00`
  );
}

function formatIcsUtcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(value: string): string {
  return stripEmojis(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export interface AppointmentCalendarEventPayload {
  summary: string;
  location?: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  reminders: {
    useDefault: boolean;
    overrides: Array<{ method: 'popup'; minutes: number }>;
  };
}

export function buildAppointmentDescription(booking: {
  doctor: DoctorProfile;
  consultationType: ConsultationType;
  patientName: string;
  contact: string;
  notes?: string;
  attachedSymptomBrief?: string;
}): string {
  const modeLabel =
    booking.consultationType === 'telehealth'
      ? 'Online / Teleconsultation'
      : 'In-Clinic Visit';

  const lines: string[] = [
    `Clinic / Doctor: ${booking.doctor.name}`,
    `Specialty: ${booking.doctor.specialty}`,
    `Consultation Type: ${modeLabel}`,
    `Patient: ${booking.patientName} (${booking.contact})`,
  ];

  if (booking.doctor.address) {
    lines.push(`Address: ${booking.doctor.address}`);
  }
  if (booking.doctor.phone) {
    lines.push(`Clinic Phone: ${booking.doctor.phone}`);
  }
  if (booking.notes?.trim()) {
    lines.push(`Patient Notes: ${booking.notes.trim()}`);
  }
  if (booking.attachedSymptomBrief?.trim()) {
    lines.push('');
    lines.push('--- Baymini Pre-Visit Symptom Summary ---');
    lines.push(booking.attachedSymptomBrief.trim());
  }
  lines.push('');
  lines.push(
    'Booked via Baymini. Please confirm slot availability directly with the clinic if needed.'
  );

  return stripEmojis(lines.join('\n'));
}

export function buildAppointmentCalendarEvent(
  booking: {
    doctor: DoctorProfile;
    consultationType: ConsultationType;
    date: string;
    time: string;
    patientName: string;
    contact: string;
    notes?: string;
    attachedSymptomBrief?: string;
  },
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
): AppointmentCalendarEventPayload {
  const start = parseSlotToDate(booking.date, booking.time) || new Date();
  const end = new Date(start.getTime() + APPOINTMENT_DURATION_MINUTES * 60_000);

  return {
    summary: stripEmojis(`Doctor Visit: ${booking.doctor.name}`),
    ...(booking.consultationType === 'in-person' && booking.doctor.address
      ? { location: stripEmojis(booking.doctor.address) }
      : {}),
    description: buildAppointmentDescription(booking),
    start: {
      dateTime: formatLocalIsoDateTime(start),
      timeZone,
    },
    end: {
      dateTime: formatLocalIsoDateTime(end),
      timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
  };
}

export function buildAppointmentIcs(
  booking: AppointmentBooking,
  stampDate = new Date()
): string {
  const start = parseSlotToDate(booking.date, booking.time) || stampDate;
  const end = new Date(start.getTime() + APPOINTMENT_DURATION_MINUTES * 60_000);
  const description = buildAppointmentDescription(booking);
  const location =
    booking.consultationType === 'in-person' && booking.doctor.address
      ? booking.doctor.address
      : 'Online / Teleconsultation';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Baymini//Doctor Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:baymini-booking-${booking.id}@baymini.app`,
    `DTSTAMP:${formatIcsUtcStamp(stampDate)}`,
    `DTSTART:${formatIcsLocalDateTime(start)}`,
    `DTEND:${formatIcsLocalDateTime(end)}`,
    `SUMMARY:${escapeIcsText(`Doctor Visit: ${booking.doctor.name}`)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Upcoming doctor visit in 1 hour',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Upcoming doctor visit in 15 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.join('\r\n')}\r\n`;
}

export function downloadAppointmentIcs(booking: AppointmentBooking): void {
  const ics = buildAppointmentIcs(booking);
  const safeName = booking.doctor.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const filename = `baymini-visit-${safeName || 'appointment'}-${booking.date}.ics`;
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildAppointmentCalendarTemplateUrl(
  booking: Pick<
    AppointmentBooking,
    | 'doctor'
    | 'consultationType'
    | 'date'
    | 'time'
    | 'patientName'
    | 'contact'
    | 'notes'
    | 'attachedSymptomBrief'
  >
): string {
  const start = parseSlotToDate(booking.date, booking.time) || new Date();
  const end = new Date(start.getTime() + APPOINTMENT_DURATION_MINUTES * 60_000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: stripEmojis(`Doctor Visit: ${booking.doctor.name}`),
    dates: `${formatIcsLocalDateTime(start)}/${formatIcsLocalDateTime(end)}`,
    details: buildAppointmentDescription(booking),
  });
  if (booking.consultationType === 'in-person' && booking.doctor.address) {
    params.set('location', stripEmojis(booking.doctor.address));
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function formatApproximateLocationLabel(
  city?: string,
  region?: string,
  country?: string
): string {
  const cleanCity = stripEmojis(city || '').trim();
  const cleanRegion = stripEmojis(region || '').trim();
  const cleanCountry = stripEmojis(country || '').trim();

  const placeParts: string[] = [];
  if (cleanCity) {
    placeParts.push(cleanCity);
  } else if (cleanRegion) {
    placeParts.push(cleanRegion);
  }
  if (cleanCountry && cleanCountry.toLowerCase() !== placeParts[0]?.toLowerCase()) {
    placeParts.push(cleanCountry);
  }

  return placeParts.length > 0
    ? `Approximate area: ${placeParts.join(', ')}`
    : 'Approximate area';
}

export interface GeolocationErrorLike {
  code?: number;
  message?: string;
}

export function describeGeolocationFailure(
  error: GeolocationErrorLike | null | undefined
): string {
  const rawMessage = (error?.message || '').toLowerCase();
  const isBlockedByFramePolicy =
    rawMessage.includes('permissions policy') ||
    rawMessage.includes('feature policy') ||
    rawMessage.includes('disallowed') ||
    rawMessage.includes('does not have permission') ||
    rawMessage.includes('only secure origins');

  if (isBlockedByFramePolicy) {
    return 'Browser location is blocked by this preview frame policy. Open the site permissions icon in your browser address bar to allow location, or type your neighborhood above.';
  }

  if (error?.code === 1) {
    return 'Location permission is blocked for this site. Click the lock or location icon in your browser address bar to allow location, or type your neighborhood above.';
  }

  if (error?.code === 2) {
    return 'Your device could not determine a location right now. Check location permissions in your browser address bar, or type your neighborhood above.';
  }

  if (error?.code === 3) {
    return 'Location detection timed out. Check location permissions in your browser address bar, or type your neighborhood above.';
  }

  return 'Could not detect your location automatically. Allow location access in your browser address bar, or type your neighborhood above.';
}

