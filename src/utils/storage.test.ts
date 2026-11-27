import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  THEME_STORAGE_KEY,
  clearSessionState,
  countUpcomingBookings,
  createInitialSessionState,
  loadSessionState,
  resolveInitialTheme,
  saveSessionState,
  saveThemePreference,
  validateAndNormalizeState,
} from './storage';
import type { AppointmentBooking } from '../types/baymini';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

test('loadSessionState returns clean initial state when storage is empty or corrupted', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(loadSessionState(storage), createInitialSessionState());

  storage.setItem(STORAGE_KEY, '{not-valid-json');
  assert.deepEqual(loadSessionState(storage), createInitialSessionState());
});

test('validateAndNormalizeState filters malformed items while keeping valid data', () => {
  const validBooking: AppointmentBooking = {
    id: 'bk-1',
    doctor: {
      name: 'Dr. Elena Rostova',
      specialty: 'Family Medicine',
      address: '120 Pine Street',
    },
    consultationType: 'in-person',
    date: '2026-12-01',
    time: '10:30',
    patientName: 'Jordan Lee',
    contact: 'jordan@example.com',
    notes: 'Annual checkup',
    status: 'upcoming',
    createdAt: '2026-11-25T10:00:00Z',
  };

  const normalized = validateAndNormalizeState({
    version: 2,
    userLocation: { lat: 37.77, lng: -122.41, label: 'San Francisco' },
    selectedDoctor: { invalid: true },
    bookings: [validBooking, { id: 123, status: 'unknown' }],
    chatMessages: [
      { id: 'm1', role: 'user', content: 'Hello', timestamp: '2026-11-25T10:00:00Z' },
      { id: 'm2', role: 'system', content: 'Invalid role', timestamp: '2026-11-25T10:00:00Z' },
    ],
  });

  assert.deepEqual(normalized.userLocation, {
    lat: 37.77,
    lng: -122.41,
    label: 'San Francisco',
  });
  assert.equal(normalized.selectedDoctor, null);
  assert.equal(normalized.bookings.length, 1);
  assert.equal(normalized.bookings[0].id, 'bk-1');
  assert.equal(normalized.chatMessages.length, 1);
  assert.equal(normalized.chatMessages[0].id, 'm1');
});

test('clearSessionState removes session data while preserving theme preference', () => {
  const storage = createMemoryStorage();
  saveThemePreference('dark', storage);

  const state = createInitialSessionState();
  state.userLocation = { lat: 40.71, lng: -74.0, label: 'New York' };
  saveSessionState(state, storage);

  assert.equal(loadSessionState(storage).userLocation?.label, 'New York');

  clearSessionState(storage);

  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem(THEME_STORAGE_KEY), 'dark');
  assert.equal(resolveInitialTheme(storage, false), 'dark');
});

test('resolveInitialTheme falls back to system preference when no saved theme exists', () => {
  const storage = createMemoryStorage();
  assert.equal(resolveInitialTheme(storage, true), 'dark');
  assert.equal(resolveInitialTheme(storage, false), 'light');

  saveThemePreference('light', storage);
  assert.equal(resolveInitialTheme(storage, true), 'light');
});

test('countUpcomingBookings counts only upcoming appointments', () => {
  const baseDoctor = {
    name: 'Dr. A. Patel',
    specialty: 'Internal Medicine',
    address: '450 Oak Ave',
  };
  const bookings: AppointmentBooking[] = [
    {
      id: '1',
      doctor: baseDoctor,
      consultationType: 'in-person',
      date: '2026-12-02',
      time: '09:00',
      patientName: 'Sam',
      contact: 'sam@example.com',
      notes: '',
      status: 'upcoming',
      createdAt: '2026-11-25T10:00:00Z',
    },
    {
      id: '2',
      doctor: baseDoctor,
      consultationType: 'telehealth',
      date: '2026-11-20',
      time: '14:00',
      patientName: 'Sam',
      contact: 'sam@example.com',
      notes: '',
      status: 'completed',
      createdAt: '2026-11-18T10:00:00Z',
    },
    {
      id: '3',
      doctor: baseDoctor,
      consultationType: 'in-person',
      date: '2026-12-05',
      time: '11:00',
      patientName: 'Sam',
      contact: 'sam@example.com',
      notes: '',
      status: 'cancelled',
      createdAt: '2026-11-25T11:00:00Z',
    },
  ];

  assert.equal(countUpcomingBookings(bookings), 1);
});

test('validateAndNormalizeState recovers partial healthProfile and healthPlan without missing-field crashes', () => {
  const normalized = validateAndNormalizeState({
    version: 2,
    healthProfile: {
      region: 'Dhaka, Bangladesh',
      goals: ['Better Sleep'],
      primaryGoal: 'Better Sleep',
      dietType: 'Vegetarian',
      budget: 'Budget-Friendly',
    },
    healthPlan: {
      intro: 'Partial saved plan.',
      morningRoutine: {},
      afternoonRoutine: {},
      eveningRoutine: {},
      meals: [],
      exercises: [],
      generatedAt: '2026-11-25T10:00:00Z',
    },
  });

  assert.ok(normalized.healthProfile);
  assert.equal(normalized.healthProfile.allergies, '');
  assert.equal(normalized.healthProfile.medications, '');
  assert.equal(normalized.healthProfile.injuries, '');
  assert.deepEqual(normalized.healthProfile.medicalConditions, ['None']);

  assert.ok(normalized.healthPlan);
  assert.ok(Array.isArray(normalized.healthPlan.morningRoutine.steps));
  assert.ok(Array.isArray(normalized.healthPlan.sleepAndLifestyle.sleepHygiene));
  assert.ok(Array.isArray(normalized.healthPlan.shoppingList));
});

