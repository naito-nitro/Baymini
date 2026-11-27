import type {
  ExerciseItem,
  HealthPlan,
  HealthProfile,
  MealOption,
} from '../types/baymini';
import {
  normalizeExerciseItem,
  normalizeHealthPlan,
  normalizeMealOption,
} from '../utils/healthPlan';

export async function generateHealthPlanRequest(
  profile: HealthProfile
): Promise<HealthPlan> {
  const response = await fetch('/api/health-plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    plan?: unknown;
    error?: string;
  };

  if (!response.ok || !payload.plan) {
    throw new Error(
      payload.error ||
        'We could not generate your health plan right now. Please try again.'
    );
  }

  return normalizeHealthPlan(payload.plan);
}

export async function swapMealRequest(
  profile: HealthProfile,
  currentMeal: MealOption,
  reason: string
): Promise<MealOption> {
  const response = await fetch('/api/health-plan/swap-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, currentMeal, reason }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    meal?: unknown;
    error?: string;
  };

  if (!response.ok || !payload.meal) {
    throw new Error(
      payload.error || 'Could not swap this meal right now. Please try again.'
    );
  }

  return normalizeMealOption(payload.meal, currentMeal.slot, currentMeal.id);
}

export async function swapExerciseRequest(
  profile: HealthProfile,
  currentExercise: ExerciseItem,
  reason: string
): Promise<ExerciseItem> {
  const response = await fetch('/api/health-plan/swap-exercise', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, currentExercise, reason }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    exercise?: unknown;
    error?: string;
  };

  if (!response.ok || !payload.exercise) {
    throw new Error(
      payload.error ||
        'Could not swap this exercise right now. Please try again.'
    );
  }

  return normalizeExerciseItem(payload.exercise, currentExercise.id);
}
