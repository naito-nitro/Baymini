import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  AppointmentBooking,
  HealthPlan,
  HealthProfile,
  SymptomAssessment,
} from '../types/baymini';
import {
  formatBookingSnapshotSummary,
  formatHealthPlanSnapshotSummary,
  getNextUpcomingBooking,
  getUrgencyBadgeMeta,
  hasActiveSessionSnapshot,
} from './homeSnapshot';

const NOW = new Date(2026, 10, 27, 10, 0, 0); // Nov 27, 2026 10:00 AM

function makeBooking(overrides: Partial<AppointmentBooking>): AppointmentBooking {
  return {
    id: 'bk-1',
    doctor: {
      name: 'Dr. Farhana Rahman',
      specialty: 'Cardiologist',
      address: 'Dhanmondi, Dhaka',
    },
    consultationType: 'in-person',
    date: '2026-11-29',
    time: '10:30',
    patientName: 'Alex',
    contact: 'alex@example.com',
    notes: '',
    status: 'upcoming',
    createdAt: '2026-11-27T09:00:00.000Z',
    ...overrides,
  };
}

const SAMPLE_PLAN: HealthPlan = {
  intro: 'Balanced daily plan',
  morningRoutine: {
    wakeUpHabit: '',
    hydrationCue: '',
    breakfastLink: '',
    morningMovement: '',
    steps: [],
  },
  afternoonRoutine: {
    middayHabits: '',
    hydrationReminder: '',
    postureBreak: '',
    energyGuidance: '',
    steps: [],
  },
  eveningRoutine: {
    dinnerTiming: '',
    recoveryHabits: '',
    screenWindDown: '',
    relaxationCue: '',
    steps: [],
  },
  meals: [
    {
      id: 'm1',
      slot: 'Breakfast',
      dishName: 'Oats & Banana',
      portionGuidance: '1 bowl',
      nutritionEstimate: '320 kcal',
      localAvailabilityNote: 'Everyday',
      budgetSwapTip: 'Use puffed rice',
    },
  ],
  shoppingList: [],
  exerciseOverview: {
    weeklyRhythm: '',
    intensityGuidance: '',
    safetyAdjustments: '',
  },
  exercises: [],
  sleepAndLifestyle: {
    sleepWindow: '',
    sleepHygiene: [],
    hydrationGuidance: '',
    stressHabits: [],
  },
  generatedAt: '2026-11-27T08:00:00.000Z',
};

const SAMPLE_PROFILE: HealthProfile = {
  age: 29,
  heightCm: 172,
  heightUnit: 'cm',
  weightKg: 68,
  weightUnit: 'kg',
  gender: 'Prefer not to say',
  region: 'Dhaka, Bangladesh',
  activityLevel: 'Lightly Active',
  fitnessLevel: 'Beginner',
  sleepDuration: '6-7 hrs',
  medicalConditions: ['None'],
  medicalConditionsOther: '',
  allergies: '',
  medications: '',
  injuries: '',
  goals: ['Improve Energy', 'Eat Healthier'],
  primaryGoal: 'Improve Energy',
  dietType: 'Non-Vegetarian',
  dietTypeOther: '',
  budget: 'Budget-Friendly',
  foodRestrictions: '',
  preferredFoods: '',
};

const SAMPLE_ASSESSMENT: SymptomAssessment = {
  selectedSymptoms: ['Headache'],
  customNotes: '',
  followUpQA: [],
  urgencyLevel: 'routine',
  urgencyTitle: 'Routine Checkup',
  urgencySummary: 'Schedule a routine visit if persistent.',
  possibleExplanations: [],
  selfCareGuidance: [],
  warningSigns: [],
  doctorQuestions: [],
  recommendedSpecialty: 'General Physician',
  specialtyReason: 'Primary evaluation',
  briefSummaryForDoctor: 'Mild headache for 2 days.',
  assessedAt: '2026-11-27T08:30:00.000Z',
};

test('hasActiveSessionSnapshot distinguishes empty, cancelled/past-only, and active sessions', () => {
  assert.equal(
    hasActiveSessionSnapshot({
      healthPlan: null,
      symptomAssessment: null,
      bookings: [],
      now: NOW,
    }),
    false
  );

  // Cancelled or past bookings alone should NOT trigger State B
  assert.equal(
    hasActiveSessionSnapshot({
      healthPlan: null,
      symptomAssessment: null,
      bookings: [
        makeBooking({ id: 'past', date: '2026-11-25', time: '09:30' }),
        makeBooking({ id: 'cancelled', status: 'cancelled' }),
      ],
      now: NOW,
    }),
    false
  );

  assert.equal(
    hasActiveSessionSnapshot({
      healthPlan: SAMPLE_PLAN,
      symptomAssessment: null,
      bookings: [],
      now: NOW,
    }),
    true
  );

  assert.equal(
    hasActiveSessionSnapshot({
      healthPlan: null,
      symptomAssessment: SAMPLE_ASSESSMENT,
      bookings: [],
      now: NOW,
    }),
    true
  );

  assert.equal(
    hasActiveSessionSnapshot({
      healthPlan: null,
      symptomAssessment: null,
      bookings: [makeBooking({ id: 'future', date: '2026-11-28', time: '14:00' })],
      now: NOW,
    }),
    true
  );
});

test('getNextUpcomingBooking selects the soonest non-past upcoming booking', () => {
  const soonest = makeBooking({
    id: 'soonest',
    date: '2026-11-28',
    time: '09:30',
    doctor: { name: 'City Heart Clinic', specialty: 'Cardiologist', address: 'Dhaka' },
  });
  const later = makeBooking({
    id: 'later',
    date: '2026-12-03',
    time: '15:30',
  });
  const past = makeBooking({
    id: 'past',
    date: '2026-11-26',
    time: '11:30',
  });
  const cancelled = makeBooking({
    id: 'cancelled',
    date: '2026-11-27',
    time: '15:30',
    status: 'cancelled',
  });

  const picked = getNextUpcomingBooking([later, past, cancelled, soonest], NOW);
  assert.equal(picked?.id, 'soonest');
});

test('snapshot formatters build concise emoji-free summaries and semantic badges', () => {
  const planSummary = formatHealthPlanSnapshotSummary(SAMPLE_PROFILE, SAMPLE_PLAN);
  assert.equal(planSummary, 'Improve Energy · Budget-Friendly');

  const bookingSummary = formatBookingSnapshotSummary(
    makeBooking({ date: '2026-12-02', time: '14:00' }),
    NOW
  );
  assert.equal(bookingSummary, 'Dr. Farhana Rahman · Dec 2, 02:00 PM');

  const nextYearBooking = formatBookingSnapshotSummary(
    makeBooking({ date: '2027-01-10', time: '09:30' }),
    NOW
  );
  assert.equal(nextYearBooking, 'Dr. Farhana Rahman · Jan 10, 2027, 09:30 AM');

  assert.equal(getUrgencyBadgeMeta('emergency').label, 'Emergency');
  assert.equal(getUrgencyBadgeMeta('prompt').label, 'Prompt');
  assert.equal(getUrgencyBadgeMeta('routine').label, 'Routine');
  assert.equal(getUrgencyBadgeMeta('self-care').label, 'Self-Care');
});
