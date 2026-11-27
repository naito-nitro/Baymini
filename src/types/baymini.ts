export type ActiveView = 'home' | 'health-plan' | 'symptoms' | 'doctors';

export type ThemeMode = 'light' | 'dark';

export type UrgencyLevel = 'emergency' | 'prompt' | 'routine' | 'self-care';

export type HeightUnit = 'cm' | 'ft-in';

export type WeightUnit = 'kg' | 'lbs';

export type GenderOption =
  | 'Male'
  | 'Female'
  | 'Non-binary'
  | 'Prefer not to say'
  | '';

export type ActivityLevel =
  | 'Sedentary'
  | 'Lightly Active'
  | 'Moderately Active'
  | 'Very Active';

export type FitnessLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type SleepDurationOption =
  | 'Less than 5 hrs'
  | '5-6 hrs'
  | '6-7 hrs'
  | '7-8 hrs'
  | '8+ hrs';

export type DietType =
  | 'Non-Vegetarian'
  | 'Vegetarian'
  | 'Vegan'
  | 'Pescatarian'
  | 'Other';

export type BudgetTier = 'Budget-Friendly' | 'Moderate' | 'Flexible';

export interface HealthProfile {
  age: number | null;
  heightCm: number | null;
  heightUnit: HeightUnit;
  weightKg: number | null;
  weightUnit: WeightUnit;
  gender: GenderOption;
  region: string;
  activityLevel: ActivityLevel;
  fitnessLevel: FitnessLevel;
  sleepDuration: SleepDurationOption;
  medicalConditions: string[];
  medicalConditionsOther: string;
  allergies: string;
  medications: string;
  injuries: string;
  goals: string[];
  primaryGoal: string;
  dietType: DietType | '';
  dietTypeOther: string;
  budget: BudgetTier | '';
  foodRestrictions: string;
  preferredFoods: string;
}

export interface RoutineStep {
  time: string;
  title: string;
  description: string;
}

export interface MorningRoutineSection {
  wakeUpHabit: string;
  hydrationCue: string;
  breakfastLink: string;
  morningMovement: string;
  steps: RoutineStep[];
}

export interface AfternoonRoutineSection {
  middayHabits: string;
  hydrationReminder: string;
  postureBreak: string;
  energyGuidance: string;
  steps: RoutineStep[];
}

export interface EveningRoutineSection {
  dinnerTiming: string;
  recoveryHabits: string;
  screenWindDown: string;
  relaxationCue: string;
  steps: RoutineStep[];
}

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface MealOption {
  id: string;
  slot: MealSlot;
  dishName: string;
  portionGuidance: string;
  nutritionEstimate: string;
  localAvailabilityNote: string;
  budgetSwapTip: string;
}

export interface ShoppingListCategory {
  category: string;
  items: string[];
}

export interface ExerciseOverview {
  weeklyRhythm: string;
  intensityGuidance: string;
  safetyAdjustments: string;
}

export type ExerciseIntensity = 'Gentle' | 'Moderate' | 'Steady';

export interface ExerciseItem {
  id: string;
  name: string;
  durationOrSets: string;
  intensity: ExerciseIntensity;
  guidance: string;
  beginnerModification: string;
}

export interface SleepAndLifestyleSection {
  sleepWindow: string;
  sleepHygiene: string[];
  hydrationGuidance: string;
  stressHabits: string[];
}

export interface HealthPlan {
  intro: string;
  morningRoutine: MorningRoutineSection;
  afternoonRoutine: AfternoonRoutineSection;
  eveningRoutine: EveningRoutineSection;
  meals: MealOption[];
  shoppingList: ShoppingListCategory[];
  exerciseOverview: ExerciseOverview;
  exercises: ExerciseItem[];
  sleepAndLifestyle: SleepAndLifestyleSection;
  generatedAt: string;
}

export interface SymptomFollowUpQA {
  question: string;
  answer: string;
}

export type SymptomQuestionType = 'single' | 'multi' | 'text';

export interface SymptomFollowUpQuestion {
  id: string;
  question: string;
  type: SymptomQuestionType;
  options: string[];
}

export interface SymptomExplanation {
  title: string;
  explanation: string;
}

export interface SymptomAssessment {
  selectedSymptoms: string[];
  customNotes: string;
  followUpQA: SymptomFollowUpQA[];
  factoredProfileSummary?: string[];
  urgencyLevel: UrgencyLevel;
  urgencyTitle: string;
  urgencySummary: string;
  possibleExplanations: SymptomExplanation[];
  selfCareGuidance: string[];
  warningSigns: string[];
  doctorQuestions: string[];
  recommendedSpecialty: string;
  specialtyReason: string;
  briefSummaryForDoctor: string;
  assessedAt: string;
}

export interface UserLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface DoctorProfile {
  id?: string;
  name: string;
  specialty: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  lat?: number;
  lng?: number;
  distanceKm?: number;
  isOpen?: boolean;
}

export type ConsultationType = 'in-person' | 'telehealth';

export type BookingStatus = 'upcoming' | 'completed' | 'cancelled';

export interface AppointmentBooking {
  id: string;
  doctor: DoctorProfile;
  consultationType: ConsultationType;
  date: string;
  time: string;
  patientName: string;
  contact: string;
  notes: string;
  attachedSymptomBrief?: string;
  status: BookingStatus;
  googleCalendarEventId?: string;
  googleCalendarLink?: string;
  createdAt: string;
}

export interface ChatSuggestedAction {
  label: string;
  targetView: ActiveView;
  specialtyHint?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  contextView?: ActiveView;
  isEmergency?: boolean;
  suggestedActions?: ChatSuggestedAction[];
}

export interface PersistedBayminiState {
  version: number;
  healthProfile: HealthProfile | null;
  healthPlan: HealthPlan | null;
  symptomAssessment: SymptomAssessment | null;
  doctorSpecialtyHint: string | null;
  userLocation: UserLocation | null;
  selectedDoctor: DoctorProfile | null;
  bookings: AppointmentBooking[];
  chatMessages: ChatMessage[];
}

export interface ToastItem {
  id: string;
  message: string;
}
