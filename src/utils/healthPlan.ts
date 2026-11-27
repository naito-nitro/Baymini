import type {
  ExerciseIntensity,
  ExerciseItem,
  HealthPlan,
  HealthProfile,
  MealOption,
  MealSlot,
  RoutineStep,
  ShoppingListCategory,
} from '../types/baymini';

export const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Non-binary',
  'Prefer not to say',
] as const;

export const ACTIVITY_LEVEL_OPTIONS = [
  'Sedentary',
  'Lightly Active',
  'Moderately Active',
  'Very Active',
] as const;

export const FITNESS_LEVEL_OPTIONS = [
  'Beginner',
  'Intermediate',
  'Advanced',
] as const;

export const SLEEP_DURATION_OPTIONS = [
  'Less than 5 hrs',
  '5-6 hrs',
  '6-7 hrs',
  '7-8 hrs',
  '8+ hrs',
] as const;

export const MEDICAL_CONDITION_OPTIONS = [
  'None',
  'Diabetes',
  'Hypertension',
  'Asthma',
  'Thyroid',
  'Joint/Back Issues',
  'Other',
] as const;

export const HEALTH_GOAL_OPTIONS = [
  {
    id: 'Muscle Building',
    label: 'Muscle Building',
    subtitle: 'Progressive strength & adequate protein',
  },
  {
    id: 'Weight Management',
    label: 'Weight Management',
    subtitle: 'Sustainable portions & steady movement',
  },
  {
    id: 'Longevity & Healthy Aging',
    label: 'Longevity & Healthy Aging',
    subtitle: 'Mobility, heart health & daily balance',
  },
  {
    id: 'Overall Health & Wellness',
    label: 'Overall Health & Wellness',
    subtitle: 'Consistent everyday energy & nutrition',
  },
  {
    id: 'Better Sleep',
    label: 'Better Sleep',
    subtitle: 'Calmer evenings & regular rest windows',
  },
  {
    id: 'Improved Stamina & Fitness',
    label: 'Improved Stamina & Fitness',
    subtitle: 'Cardio endurance & active recovery',
  },
  {
    id: 'Stress Management',
    label: 'Stress Management',
    subtitle: 'Breathing cues, breaks & gentle recovery',
  },
] as const;

export const DIET_TYPE_OPTIONS = [
  'Non-Vegetarian',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Other',
] as const;

export const BUDGET_TIER_OPTIONS = [
  'Budget-Friendly',
  'Moderate',
  'Flexible',
] as const;

export function createEmptyHealthProfile(): HealthProfile {
  return {
    age: null,
    heightCm: null,
    heightUnit: 'cm',
    weightKg: null,
    weightUnit: 'kg',
    gender: '',
    region: '',
    activityLevel: 'Lightly Active',
    fitnessLevel: 'Beginner',
    sleepDuration: '6-7 hrs',
    medicalConditions: ['None'],
    medicalConditionsOther: '',
    allergies: '',
    medications: '',
    injuries: '',
    goals: [],
    primaryGoal: '',
    dietType: '',
    dietTypeOther: '',
    budget: '',
    foodRestrictions: '',
    preferredFoods: '',
  };
}

export interface SampleProfilePreset {
  id: string;
  label: string;
  profile: HealthProfile;
}

export const SAMPLE_PROFILES: ReadonlyArray<SampleProfilePreset> = [
  {
    id: 'university-student-dhaka',
    label: 'University Student (Dhaka — Stamina & Budget Diet)',
    profile: {
      age: 21,
      heightCm: 171,
      heightUnit: 'cm',
      weightKg: 64,
      weightUnit: 'kg',
      gender: 'Male',
      region: 'Dhaka, Bangladesh',
      activityLevel: 'Lightly Active',
      fitnessLevel: 'Beginner',
      sleepDuration: '6-7 hrs',
      medicalConditions: ['None'],
      medicalConditionsOther: '',
      allergies: '',
      medications: '',
      injuries: '',
      goals: ['Improved Stamina & Fitness', 'Overall Health & Wellness'],
      primaryGoal: 'Improved Stamina & Fitness',
      dietType: 'Non-Vegetarian',
      dietTypeOther: '',
      budget: 'Budget-Friendly',
      foodRestrictions: '',
      preferredFoods: 'Steamed rice, masoor dal, eggs, local fish, banana, chira, peanuts',
    },
  },
  {
    id: 'desk-professional',
    label: 'Desk Professional (Stress Relief & Better Sleep)',
    profile: {
      age: 34,
      heightCm: 168,
      heightUnit: 'cm',
      weightKg: 72,
      weightUnit: 'kg',
      gender: 'Female',
      region: 'Austin, USA',
      activityLevel: 'Sedentary',
      fitnessLevel: 'Intermediate',
      sleepDuration: '5-6 hrs',
      medicalConditions: ['Joint/Back Issues'],
      medicalConditionsOther: '',
      allergies: '',
      medications: '',
      injuries: 'Mild lower-back stiffness from desk work',
      goals: ['Stress Management', 'Better Sleep', 'Longevity & Healthy Aging'],
      primaryGoal: 'Stress Management',
      dietType: 'Pescatarian',
      dietTypeOther: '',
      budget: 'Moderate',
      foodRestrictions: 'Avoid late caffeine after 2 PM',
      preferredFoods: 'Oats, eggs, salmon, leafy greens, Greek yogurt, lentils, berries',
    },
  },
  {
    id: 'beginner-fitness',
    label: 'Beginner Fitness (Weight Management & Home Workouts)',
    profile: {
      age: 29,
      heightCm: 165,
      heightUnit: 'cm',
      weightKg: 78,
      weightUnit: 'kg',
      gender: 'Prefer not to say',
      region: 'Toronto, Canada',
      activityLevel: 'Sedentary',
      fitnessLevel: 'Beginner',
      sleepDuration: '6-7 hrs',
      medicalConditions: ['None'],
      medicalConditionsOther: '',
      allergies: 'Peanuts',
      medications: '',
      injuries: 'Occasional right knee tenderness on jumping',
      goals: ['Weight Management', 'Overall Health & Wellness'],
      primaryGoal: 'Weight Management',
      dietType: 'Vegetarian',
      dietTypeOther: '',
      budget: 'Budget-Friendly',
      foodRestrictions: 'Peanut-free',
      preferredFoods: 'Chickpeas, tofu, whole wheat roti, seasonal vegetables, yogurt, apples',
    },
  },
];

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  const totalInches = Math.max(0, feet) * 12 + Math.max(0, inches);
  return Math.round(totalInches * 2.54 * 10) / 10;
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 10) / 10;
}

export interface HealthProfileErrors {
  age?: string;
  heightCm?: string;
  weightKg?: string;
  region?: string;
  goals?: string;
  dietType?: string;
  budget?: string;
}

export function validateHealthProfileForm(
  profile: HealthProfile
): HealthProfileErrors {
  const errors: HealthProfileErrors = {};

  if (
    profile.age === null ||
    !Number.isFinite(profile.age) ||
    profile.age < 13 ||
    profile.age > 110
  ) {
    errors.age = 'Enter an age between 13 and 110.';
  }

  if (
    profile.heightCm === null ||
    !Number.isFinite(profile.heightCm) ||
    profile.heightCm < 90 ||
    profile.heightCm > 250
  ) {
    errors.heightCm = 'Enter a valid height (90 to 250 cm).';
  }

  if (
    profile.weightKg === null ||
    !Number.isFinite(profile.weightKg) ||
    profile.weightKg < 25 ||
    profile.weightKg > 300
  ) {
    errors.weightKg = 'Enter a valid weight (25 to 300 kg).';
  }

  if (!profile.region.trim()) {
    errors.region = 'Enter your city, country, or region for local food tailoring.';
  }

  if (!profile.goals.length) {
    errors.goals = 'Select at least one health goal.';
  }

  if (!profile.dietType) {
    errors.dietType = 'Select a diet preference.';
  } else if (profile.dietType === 'Other' && !profile.dietTypeOther.trim()) {
    errors.dietType = 'Briefly describe your diet preference.';
  }

  if (!profile.budget) {
    errors.budget = 'Select a food budget tier.';
  }

  return errors;
}

export function stripEmojis(text: string): string {
  return text.replace(/\p{Extended_Pictographic}/gu, '').replace(/\uFE0F/g, '').trim();
}

function asCleanString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = stripEmojis(value);
  return cleaned || fallback;
}

function asCleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => stripEmojis(item))
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRoutineSteps(raw: unknown): RoutineStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((item) => ({
      time: asCleanString(item.time, 'Flexible'),
      title: asCleanString(item.title, 'Daily step'),
      description: asCleanString(item.description, ''),
    }))
    .filter((step) => Boolean(step.title || step.description));
}

function normalizeMealSlot(value: unknown, fallback: MealSlot): MealSlot {
  if (typeof value !== 'string') return fallback;
  const lower = value.toLowerCase();
  if (lower.includes('breakfast')) return 'Breakfast';
  if (lower.includes('lunch')) return 'Lunch';
  if (lower.includes('dinner')) return 'Dinner';
  if (lower.includes('snack')) return 'Snack';
  return fallback;
}

export function normalizeMealOption(
  raw: unknown,
  fallbackSlot: MealSlot,
  id?: string
): MealOption {
  const rec = isRecord(raw) ? raw : {};
  const slot = normalizeMealSlot(rec.slot, fallbackSlot);
  const rawEst = asCleanString(
    rec.nutritionEstimate,
    'Est. balanced everyday portion'
  );
  const nutritionEstimate = /^est\./i.test(rawEst) ? rawEst : `Est. ${rawEst}`;

  return {
    id: id || `meal-${slot.toLowerCase()}-${Date.now()}`,
    slot,
    dishName: asCleanString(rec.dishName, `${slot} balanced plate`),
    portionGuidance: asCleanString(
      rec.portionGuidance,
      'Moderate everyday home portion tailored to your appetite.'
    ),
    nutritionEstimate,
    localAvailabilityNote: asCleanString(
      rec.localAvailabilityNote,
      'Prepared from everyday local market staples.'
    ),
    budgetSwapTip: asCleanString(
      rec.budgetSwapTip,
      'Swap in seasonal local vegetables or pantry protein to keep costs low.'
    ),
  };
}

function normalizeIntensity(value: unknown): ExerciseIntensity {
  if (typeof value !== 'string') return 'Gentle';
  const lower = value.toLowerCase();
  if (lower.includes('moderate')) return 'Moderate';
  if (lower.includes('steady') || lower.includes('brisk')) return 'Steady';
  return 'Gentle';
}

export function normalizeExerciseItem(
  raw: unknown,
  id?: string
): ExerciseItem {
  const rec = isRecord(raw) ? raw : {};
  return {
    id: id || `exercise-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: asCleanString(rec.name, 'Guided mobility movement'),
    durationOrSets: asCleanString(rec.durationOrSets, '10-15 minutes'),
    intensity: normalizeIntensity(rec.intensity),
    guidance: asCleanString(
      rec.guidance,
      'Move at a comfortable, controlled pace and breathe steadily throughout.'
    ),
    beginnerModification: asCleanString(
      rec.beginnerModification,
      'Shorten the range of motion or pause for extra rest as needed.'
    ),
  };
}

function normalizeShoppingList(raw: unknown): ShoppingListCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((group) => ({
      category: asCleanString(group.category, 'Everyday Items'),
      items: asCleanStringArray(group.items),
    }))
    .filter((group) => group.items.length > 0);
}

const DEFAULT_MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function normalizeHealthPlan(raw: unknown): HealthPlan {
  const rec = isRecord(raw) ? raw : {};
  const morning = isRecord(rec.morningRoutine) ? rec.morningRoutine : {};
  const afternoon = isRecord(rec.afternoonRoutine) ? rec.afternoonRoutine : {};
  const evening = isRecord(rec.eveningRoutine) ? rec.eveningRoutine : {};
  const exerciseOverview = isRecord(rec.exerciseOverview)
    ? rec.exerciseOverview
    : {};
  const sleep = isRecord(rec.sleepAndLifestyle) ? rec.sleepAndLifestyle : {};

  const rawMeals = Array.isArray(rec.meals) ? rec.meals : [];
  const meals: MealOption[] =
    rawMeals.length > 0
      ? rawMeals.map((m, idx) =>
          normalizeMealOption(
            m,
            DEFAULT_MEAL_SLOTS[idx % DEFAULT_MEAL_SLOTS.length],
            `meal-${idx + 1}`
          )
        )
      : [];

  const rawExercises = Array.isArray(rec.exercises) ? rec.exercises : [];
  const exercises: ExerciseItem[] = rawExercises.map((ex, idx) =>
    normalizeExerciseItem(ex, `exercise-${idx + 1}`)
  );

  return {
    intro: asCleanString(
      rec.intro,
      'This plan brings together realistic daily habits, affordable local meals, and steady movement tailored to your goals.'
    ),
    morningRoutine: {
      wakeUpHabit: asCleanString(
        morning.wakeUpHabit,
        'Wake up at a consistent time and get a few minutes of natural light.'
      ),
      hydrationCue: asCleanString(
        morning.hydrationCue,
        'Drink a full glass of plain water soon after waking.'
      ),
      breakfastLink: asCleanString(
        morning.breakfastLink,
        'Enjoy your balanced local breakfast within 1 to 2 hours of waking.'
      ),
      morningMovement: asCleanString(
        morning.morningMovement,
        'Spend 10 minutes on gentle joint mobility or a relaxed walk.'
      ),
      steps: normalizeRoutineSteps(morning.steps),
    },
    afternoonRoutine: {
      middayHabits: asCleanString(
        afternoon.middayHabits,
        'Take a calm midday meal break away from screens when possible.'
      ),
      hydrationReminder: asCleanString(
        afternoon.hydrationReminder,
        'Refill your water glass steadily across the afternoon.'
      ),
      postureBreak: asCleanString(
        afternoon.postureBreak,
        'Stand, roll your shoulders, and walk for 3 to 5 minutes every hour.'
      ),
      energyGuidance: asCleanString(
        afternoon.energyGuidance,
        'Pair a light local snack with water instead of relying on late caffeine.'
      ),
      steps: normalizeRoutineSteps(afternoon.steps),
    },
    eveningRoutine: {
      dinnerTiming: asCleanString(
        evening.dinnerTiming,
        'Aim to finish dinner 2 to 3 hours before bedtime for comfortable digestion.'
      ),
      recoveryHabits: asCleanString(
        evening.recoveryHabits,
        'Do a brief light stretch or unhurried walk after your evening meal.'
      ),
      screenWindDown: asCleanString(
        evening.screenWindDown,
        'Dim bright lights and reduce phone or laptop screens 45 minutes before bed.'
      ),
      relaxationCue: asCleanString(
        evening.relaxationCue,
        'Spend 5 minutes on slow breathing or reading to signal rest.'
      ),
      steps: normalizeRoutineSteps(evening.steps),
    },
    meals,
    shoppingList: normalizeShoppingList(rec.shoppingList),
    exerciseOverview: {
      weeklyRhythm: asCleanString(
        exerciseOverview.weeklyRhythm,
        'Aim for 3 to 5 short, sustainable movement sessions spread across the week.'
      ),
      intensityGuidance: asCleanString(
        exerciseOverview.intensityGuidance,
        'Keep effort comfortable enough to hold a brief conversation while building consistency.'
      ),
      safetyAdjustments: asCleanString(
        exerciseOverview.safetyAdjustments,
        'Stop any movement that causes sharp pain and prioritize controlled form over speed.'
      ),
    },
    exercises,
    sleepAndLifestyle: {
      sleepWindow: asCleanString(
        sleep.sleepWindow,
        'Aim for a steady 7 to 8 hour sleep window with consistent bed and wake times.'
      ),
      sleepHygiene: asCleanStringArray(sleep.sleepHygiene),
      hydrationGuidance: asCleanString(
        sleep.hydrationGuidance,
        'Sip water regularly from morning through early evening.'
      ),
      stressHabits: asCleanStringArray(sleep.stressHabits),
    },
    generatedAt: asCleanString(rec.generatedAt, new Date().toISOString()),
  };
}

export function countShoppingListItems(
  shoppingList: ShoppingListCategory[]
): number {
  return shoppingList.reduce((sum, group) => sum + group.items.length, 0);
}

export function formatShoppingListForClipboard(
  shoppingList: ShoppingListCategory[],
  region?: string
): string {
  const heading = region
    ? `Baymini Local Shopping List (${region})`
    : 'Baymini Local Shopping List';
  const sections = shoppingList.map(
    (group) =>
      `${group.category}\n${group.items.map((item) => `- ${item}`).join('\n')}`
  );
  return [heading, ...sections].join('\n\n');
}
