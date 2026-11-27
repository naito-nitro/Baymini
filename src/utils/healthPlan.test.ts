import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAMPLE_PROFILES,
  cmToFeetInches,
  countShoppingListItems,
  createEmptyHealthProfile,
  feetInchesToCm,
  formatShoppingListForClipboard,
  kgToLbs,
  lbsToKg,
  normalizeExerciseItem,
  normalizeHealthPlan,
  normalizeMealOption,
  stripEmojis,
  validateHealthProfileForm,
} from './healthPlan';
import {
  buildCalendarEventsPayload,
  buildDefaultRoutineBlocks,
  buildGoogleCalendarTemplateUrl,
  buildIcsContent,
} from './calendarSync';

test('unit conversions convert accurately between metric and imperial', () => {
  const { feet, inches } = cmToFeetInches(175);
  assert.equal(feet, 5);
  assert.equal(inches, 9);
  assert.ok(Math.abs(feetInchesToCm(5, 9) - 175.3) < 0.2);

  const lbs = kgToLbs(70);
  assert.ok(Math.abs(lbs - 154.3) < 0.2);
  assert.ok(Math.abs(lbsToKg(lbs) - 70) < 0.2);
});

test('validateHealthProfileForm flags missing required fields and accepts valid presets', () => {
  const emptyErrors = validateHealthProfileForm(createEmptyHealthProfile());
  assert.ok(emptyErrors.age);
  assert.ok(emptyErrors.heightCm);
  assert.ok(emptyErrors.weightKg);
  assert.ok(emptyErrors.region);
  assert.ok(emptyErrors.goals);
  assert.ok(emptyErrors.dietType);
  assert.ok(emptyErrors.budget);

  for (const preset of SAMPLE_PROFILES) {
    const errors = validateHealthProfileForm(preset.profile);
    assert.deepEqual(errors, {});
  }
});

test('normalizeHealthPlan safely handles malformed payloads and strips emojis', () => {
  const normalized = normalizeHealthPlan({
    intro: 'Calm daily plan for Dhaka',
    meals: [
      {
        slot: 'breakfast',
        dishName: 'Chira with banana and peanuts',
        nutritionEstimate: '~380 kcal · 12g protein',
      },
    ],
    shoppingList: [
      { category: 'Produce', items: ['Banana', 'Spinach'] },
      { category: 'EmptyGroup', items: [] },
    ],
    exercises: [{ name: 'Brisk walking', intensity: 'moderate' }],
  });

  assert.equal(normalized.meals.length, 1);
  assert.equal(normalized.meals[0].slot, 'Breakfast');
  assert.ok(normalized.meals[0].nutritionEstimate.startsWith('Est.'));
  assert.equal(normalized.shoppingList.length, 1);
  assert.equal(countShoppingListItems(normalized.shoppingList), 2);
  assert.equal(normalized.exercises[0].intensity, 'Moderate');
  assert.ok(normalized.morningRoutine.wakeUpHabit.length > 0);
  assert.equal(stripEmojis('Plain text'), 'Plain text');
});

test('normalizeMealOption and normalizeExerciseItem preserve fallback ids and slots', () => {
  const meal = normalizeMealOption({ dishName: 'Masoor dal & rice' }, 'Lunch', 'meal-2');
  assert.equal(meal.id, 'meal-2');
  assert.equal(meal.slot, 'Lunch');
  assert.equal(meal.dishName, 'Masoor dal & rice');

  const ex = normalizeExerciseItem({ name: 'Wall push-ups', intensity: 'gentle' }, 'ex-1');
  assert.equal(ex.id, 'ex-1');
  assert.equal(ex.intensity, 'Gentle');
});

test('formatShoppingListForClipboard builds clean copyable text', () => {
  const text = formatShoppingListForClipboard(
    [
      { category: 'Produce', items: ['Spinach', 'Guava'] },
      { category: 'Proteins', items: ['Eggs', 'Masoor dal'] },
    ],
    'Dhaka, Bangladesh'
  );
  assert.ok(text.includes('Baymini Local Shopping List (Dhaka, Bangladesh)'));
  assert.ok(text.includes('- Spinach'));
  assert.ok(text.includes('- Masoor dal'));
});

test('calendarSync builds valid Google Calendar payloads, .ics files, and template URLs', () => {
  const plan = normalizeHealthPlan({});
  const blocks = buildDefaultRoutineBlocks(plan);
  assert.equal(blocks.length, 3);

  const baseDate = new Date('2026-11-25T10:00:00Z');
  const events7 = buildCalendarEventsPayload(blocks, 'repeat-7-days', baseDate, 'UTC');
  assert.equal(events7.length, 3);
  assert.deepEqual(events7[0].recurrence, ['RRULE:FREQ=DAILY;COUNT=7']);

  const eventsTomorrow = buildCalendarEventsPayload(blocks, 'tomorrow', baseDate, 'UTC');
  assert.equal(eventsTomorrow[0].recurrence, undefined);

  const ics = buildIcsContent(blocks, 'repeat-7-days', baseDate);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.includes('RRULE:FREQ=DAILY;COUNT=7'));
  assert.ok(ics.includes('END:VCALENDAR\r\n'));

  const url = buildGoogleCalendarTemplateUrl(blocks[0], 'repeat-7-days', baseDate);
  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'));
  assert.ok(url.includes('action=TEMPLATE'));
  assert.ok(url.includes('RRULE%3AFREQ%3DDAILY%3BCOUNT%3D7'));
});
