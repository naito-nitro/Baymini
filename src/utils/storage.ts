import type {
  ActivityLevel,
  AppointmentBooking,
  BudgetTier,
  ChatMessage,
  DietType,
  DoctorProfile,
  FitnessLevel,
  GenderOption,
  HealthPlan,
  HealthProfile,
  PersistedBayminiState,
  SleepDurationOption,
  SymptomAssessment,
  ThemeMode,
  UserLocation,
} from '../types/baymini';
import { createEmptyHealthProfile, normalizeHealthPlan } from './healthPlan';

export const STORAGE_KEY = 'baymini_v2_state';
export const THEME_STORAGE_KEY = 'baymini_v2_theme';
export const STORAGE_VERSION = 2;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createInitialSessionState(): PersistedBayminiState {
  return {
    version: STORAGE_VERSION,
    healthProfile: null,
    healthPlan: null,
    symptomAssessment: null,
    doctorSpecialtyHint: null,
    userLocation: null,
    selectedDoctor: null,
    bookings: [],
    chatMessages: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidUserLocation(value: unknown): value is UserLocation {
  if (!isRecord(value)) return false;
  return (
    typeof value.lat === 'number' &&
    Number.isFinite(value.lat) &&
    typeof value.lng === 'number' &&
    Number.isFinite(value.lng) &&
    typeof value.label === 'string'
  );
}

function isValidDoctorProfile(value: unknown): value is DoctorProfile {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === 'string' &&
    typeof value.specialty === 'string' &&
    typeof value.address === 'string'
  );
}

function isValidBooking(value: unknown): value is AppointmentBooking {
  if (!isRecord(value)) return false;
  const validStatus =
    value.status === 'upcoming' ||
    value.status === 'completed' ||
    value.status === 'cancelled';
  const validType =
    value.consultationType === 'in-person' ||
    value.consultationType === 'telehealth';

  return (
    typeof value.id === 'string' &&
    isValidDoctorProfile(value.doctor) &&
    validType &&
    typeof value.date === 'string' &&
    typeof value.time === 'string' &&
    typeof value.patientName === 'string' &&
    typeof value.contact === 'string' &&
    typeof value.notes === 'string' &&
    validStatus &&
    typeof value.createdAt === 'string'
  );
}

function isValidChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string' &&
    typeof value.timestamp === 'string'
  );
}

function normalizeStoredHealthProfile(value: unknown): HealthProfile | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.region !== 'string' ||
    !isStringArray(value.goals) ||
    typeof value.primaryGoal !== 'string' ||
    typeof value.dietType !== 'string' ||
    typeof value.budget !== 'string'
  ) {
    return null;
  }

  const defaults = createEmptyHealthProfile();
  const str = (field: unknown, fallback = ''): string =>
    typeof field === 'string' ? field : fallback;

  return {
    age:
      typeof value.age === 'number' && Number.isFinite(value.age)
        ? value.age
        : null,
    heightCm:
      typeof value.heightCm === 'number' && Number.isFinite(value.heightCm)
        ? value.heightCm
        : null,
    heightUnit: value.heightUnit === 'ft-in' ? 'ft-in' : 'cm',
    weightKg:
      typeof value.weightKg === 'number' && Number.isFinite(value.weightKg)
        ? value.weightKg
        : null,
    weightUnit: value.weightUnit === 'lbs' ? 'lbs' : 'kg',
    gender: (str(value.gender, defaults.gender) as GenderOption),
    region: value.region,
    activityLevel: (str(value.activityLevel, defaults.activityLevel) as ActivityLevel),
    fitnessLevel: (str(value.fitnessLevel, defaults.fitnessLevel) as FitnessLevel),
    sleepDuration: (str(value.sleepDuration, defaults.sleepDuration) as SleepDurationOption),
    medicalConditions: isStringArray(value.medicalConditions) && value.medicalConditions.length > 0
      ? value.medicalConditions
      : ['None'],
    medicalConditionsOther: str(value.medicalConditionsOther),
    allergies: str(value.allergies),
    medications: str(value.medications),
    injuries: str(value.injuries),
    goals: value.goals,
    primaryGoal: value.primaryGoal,
    dietType: value.dietType as DietType,
    dietTypeOther: str(value.dietTypeOther),
    budget: value.budget as BudgetTier,
    foodRestrictions: str(value.foodRestrictions),
    preferredFoods: str(value.preferredFoods),
  };
}

function normalizeStoredHealthPlan(value: unknown): HealthPlan | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.intro !== 'string' ||
    !isRecord(value.morningRoutine) ||
    !isRecord(value.afternoonRoutine) ||
    !isRecord(value.eveningRoutine) ||
    !Array.isArray(value.meals) ||
    !Array.isArray(value.exercises) ||
    typeof value.generatedAt !== 'string'
  ) {
    return null;
  }

  // Safely fill any missing nested arrays/subfields on partially persisted plans
  const normalized = normalizeHealthPlan(value);
  return {
    ...normalized,
    generatedAt: value.generatedAt,
  };
}

function isValidSymptomAssessment(value: unknown): value is SymptomAssessment {
  if (!isRecord(value)) return false;
  const validUrgency =
    value.urgencyLevel === 'emergency' ||
    value.urgencyLevel === 'prompt' ||
    value.urgencyLevel === 'routine' ||
    value.urgencyLevel === 'self-care';
  const validExplanations =
    Array.isArray(value.possibleExplanations) &&
    value.possibleExplanations.every(
      (item) =>
        isRecord(item) &&
        typeof item.title === 'string' &&
        typeof item.explanation === 'string'
    );
  const validFollowUp =
    Array.isArray(value.followUpQA) &&
    value.followUpQA.every(
      (item) =>
        isRecord(item) &&
        typeof item.question === 'string' &&
        typeof item.answer === 'string'
    );

  return (
    isStringArray(value.selectedSymptoms) &&
    typeof value.customNotes === 'string' &&
    validFollowUp &&
    validUrgency &&
    typeof value.urgencyTitle === 'string' &&
    typeof value.urgencySummary === 'string' &&
    validExplanations &&
    isStringArray(value.selfCareGuidance) &&
    isStringArray(value.warningSigns) &&
    isStringArray(value.doctorQuestions) &&
    typeof value.recommendedSpecialty === 'string' &&
    typeof value.specialtyReason === 'string' &&
    typeof value.briefSummaryForDoctor === 'string' &&
    typeof value.assessedAt === 'string'
  );
}

export function validateAndNormalizeState(raw: unknown): PersistedBayminiState {
  const initial = createInitialSessionState();
  if (!isRecord(raw)) {
    return initial;
  }

  return {
    version: STORAGE_VERSION,
    healthProfile: normalizeStoredHealthProfile(raw.healthProfile),
    healthPlan: normalizeStoredHealthPlan(raw.healthPlan),
    symptomAssessment: isValidSymptomAssessment(raw.symptomAssessment)
      ? raw.symptomAssessment
      : null,
    doctorSpecialtyHint:
      typeof raw.doctorSpecialtyHint === 'string' &&
      raw.doctorSpecialtyHint.trim().length > 0
        ? raw.doctorSpecialtyHint.trim()
        : null,
    userLocation: isValidUserLocation(raw.userLocation)
      ? raw.userLocation
      : null,
    selectedDoctor: isValidDoctorProfile(raw.selectedDoctor)
      ? raw.selectedDoctor
      : null,
    bookings: Array.isArray(raw.bookings)
      ? raw.bookings.filter(isValidBooking)
      : [],
    chatMessages: Array.isArray(raw.chatMessages)
      ? raw.chatMessages.filter(isValidChatMessage)
      : [],
  };
}

export function loadSessionState(
  storage?: Pick<StorageLike, 'getItem'>
): PersistedBayminiState {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!target) {
    return createInitialSessionState();
  }

  try {
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialSessionState();
    }
    const parsed: unknown = JSON.parse(raw);
    return validateAndNormalizeState(parsed);
  } catch {
    return createInitialSessionState();
  }
}

export function saveSessionState(
  state: PersistedBayminiState,
  storage?: Pick<StorageLike, 'setItem'>
): boolean {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!target) {
    return false;
  }

  try {
    target.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        version: STORAGE_VERSION,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function clearSessionState(
  storage?: Pick<StorageLike, 'removeItem'>
): boolean {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!target) {
    return false;
  }

  try {
    target.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function resolveInitialTheme(
  storage?: Pick<StorageLike, 'getItem'>,
  prefersDark?: boolean
): ThemeMode {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);

  try {
    const saved = target?.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore storage read errors and fall back to system preference
  }

  if (typeof prefersDark === 'boolean') {
    return prefersDark ? 'dark' : 'light';
  }

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  return 'light';
}

export function saveThemePreference(
  theme: ThemeMode,
  storage?: Pick<StorageLike, 'setItem'>
): boolean {
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!target) {
    return false;
  }

  try {
    target.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function countUpcomingBookings(bookings: AppointmentBooking[]): number {
  return bookings.filter((booking) => booking.status === 'upcoming').length;
}
