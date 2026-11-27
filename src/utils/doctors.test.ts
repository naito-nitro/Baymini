import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAppointmentCalendarEvent,
  buildAppointmentCalendarTemplateUrl,
  buildAppointmentIcs,
  buildGoogleMapsDirectionsUrl,
  describeGeolocationFailure,
  expandSpecialtyQuery,
  formatApproximateLocationLabel,
  formatAttachedSymptomBrief,
  generateNext7Days,
  hasCalendarConflict,
  haversineDistanceKm,
  isTimeSlotPast,
  normalizeSpecialtyHint,
  validateBookingForm,
} from './doctors.ts';
import { normalizeSymptomAssessment } from './symptoms.ts';

test('haversineDistanceKm computes realistic local distance', () => {
  // Dhanmondi to Gulshan in Dhaka (~5.5-6.5 km)
  const dist = haversineDistanceKm(23.7461, 90.3742, 23.7925, 90.4078);
  assert.ok(dist > 5 && dist < 7.5, `Expected ~6.2 km, got ${dist}`);
  assert.equal(haversineDistanceKm(23.7461, 90.3742, 23.7461, 90.3742), 0);
});

test('specialty expansion and hint normalization map accurately', () => {
  assert.equal(normalizeSpecialtyHint('dermatology'), 'Dermatologist');
  assert.equal(normalizeSpecialtyHint('Emergency Hospital'), 'Emergency Hospital');
  assert.equal(normalizeSpecialtyHint('heart specialist'), 'Cardiologist');
  assert.equal(normalizeSpecialtyHint('unknown'), 'All Clinics');

  assert.ok(expandSpecialtyQuery('Dermatologist').includes('skin clinic'));
  assert.ok(expandSpecialtyQuery('Cardiologist').includes('heart hospital'));
  assert.ok(
    expandSpecialtyQuery('Emergency Hospital').includes('24 hour emergency room')
  );
});

test('time slots disable past times on today and detect calendar conflicts', () => {
  const fixedNow = new Date(2026, 10, 26, 14, 15, 0); // 02:15 PM local
  const days = generateNext7Days(fixedNow);
  assert.equal(days.length, 7);
  assert.equal(days[0].isToday, true);
  assert.equal(days[0].isoDate, '2026-11-26');

  assert.equal(isTimeSlotPast('2026-11-26', '09:30', fixedNow), true);
  assert.equal(isTimeSlotPast('2026-11-26', '14:00', fixedNow), true);
  assert.equal(isTimeSlotPast('2026-11-26', '15:30', fixedNow), false);
  assert.equal(isTimeSlotPast('2026-11-27', '09:30', fixedNow), false);

  const busyStart = new Date(2026, 10, 26, 15, 0, 0).getTime();
  const busyEnd = new Date(2026, 10, 26, 16, 0, 0).getTime();
  assert.equal(
    hasCalendarConflict('2026-11-26', '15:30', [{ startMs: busyStart, endMs: busyEnd }]),
    true
  );
  assert.equal(
    hasCalendarConflict('2026-11-26', '16:30', [{ startMs: busyStart, endMs: busyEnd }]),
    false
  );
});

test('validateBookingForm catches missing fields and past slots', () => {
  const fixedNow = new Date(2026, 10, 26, 15, 0, 0);
  const invalid = validateBookingForm({
    patientName: 'A',
    contact: '12',
    date: '2026-11-26',
    time: '09:30',
    now: fixedNow,
  });
  assert.ok(invalid.patientName);
  assert.ok(invalid.contact);
  assert.ok(invalid.time);

  const valid = validateBookingForm({
    patientName: 'Nadia Rahman',
    contact: '+8801711000000',
    date: '2026-11-27',
    time: '10:30',
    now: fixedNow,
  });
  assert.equal(Object.keys(valid).length, 0);
});

test('appointment calendar event, ICS file, directions URL, and attached brief stay clean and emoji-free', () => {
  const assessment = normalizeSymptomAssessment(
    {
      urgencyLevel: 'routine',
      urgencyTitle: 'Routine Consultation',
      recommendedSpecialty: 'Dermatologist',
      briefSummaryForDoctor: 'Mild forearm skin rash for 4 days without fever.',
      doctorQuestions: ['Could this be contact dermatitis?', 'What topical care is safe?'],
    },
    {
      selectedSymptoms: ['Skin rash'],
      customNotes: '',
      followUpQA: [],
      factoredProfileSummary: [],
    }
  );

  const brief = formatAttachedSymptomBrief(assessment);
  assert.ok(brief.includes('Skin rash'));
  assert.ok(brief.includes('Could this be contact dermatitis?'));

  const booking = {
    id: 'bk-100',
    doctor: {
      id: 'place_123',
      name: 'Green Life Medical Centre',
      specialty: 'Dermatologist',
      address: '32 Bir Uttam Shafiullah Sarak, Dhaka',
      lat: 23.744,
      lng: 90.386,
      phone: '+880 2-9612345',
    },
    consultationType: 'in-person' as const,
    date: '2026-11-28',
    time: '10:30',
    patientName: 'Nadia Rahman',
    contact: 'nadia@example.com',
    notes: 'Prefer morning check-in',
    attachedSymptomBrief: brief,
    status: 'upcoming' as const,
    createdAt: '2026-11-26T00:00:00.000Z',
  };

  const eventPayload = buildAppointmentCalendarEvent(booking, 'Asia/Dhaka');
  assert.equal(eventPayload.summary, 'Doctor Visit: Green Life Medical Centre');
  assert.equal(eventPayload.reminders.overrides.length, 2);
  assert.ok(eventPayload.description.includes('Baymini Pre-Visit Symptom Summary'));

  const ics = buildAppointmentIcs(booking, new Date('2026-11-26T00:00:00.000Z'));
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('SUMMARY:Doctor Visit: Green Life Medical Centre'));
  assert.ok(!/\p{Extended_Pictographic}/u.test(ics));

  const templateUrl = buildAppointmentCalendarTemplateUrl(booking);
  assert.ok(templateUrl.startsWith('https://calendar.google.com/calendar/render?'));

  const dirUrl = buildGoogleMapsDirectionsUrl(booking.doctor);
  assert.ok(dirUrl.includes('destination=23.744%2C90.386'));
  assert.ok(dirUrl.includes('destination_place_id=place_123'));
});

test('approximate location labels and geolocation failure diagnostics distinguish all error causes cleanly', () => {
  assert.equal(
    formatApproximateLocationLabel('Dhaka', 'Dhaka Division', 'Bangladesh'),
    'Approximate area: Dhaka, Bangladesh'
  );
  assert.equal(
    formatApproximateLocationLabel('', 'California', 'United States'),
    'Approximate area: California, United States'
  );
  assert.equal(formatApproximateLocationLabel('', '', ''), 'Approximate area');

  const iframeMsg = describeGeolocationFailure({
    code: 1,
    message: 'Geolocation has been disabled in this document by permissions policy.',
  });
  assert.ok(iframeMsg.toLowerCase().includes('frame policy'));

  const deniedMsg = describeGeolocationFailure({ code: 1, message: 'User denied Geolocation' });
  assert.ok(deniedMsg.toLowerCase().includes('address bar'));

  const unavailableMsg = describeGeolocationFailure({ code: 2, message: 'Position unavailable' });
  assert.ok(unavailableMsg.toLowerCase().includes('could not determine'));

  const timeoutMsg = describeGeolocationFailure({ code: 3, message: 'Timeout expired' });
  assert.ok(timeoutMsg.toLowerCase().includes('timed out'));

  for (const msg of [iframeMsg, deniedMsg, unavailableMsg, timeoutMsg]) {
    assert.equal(/\p{Extended_Pictographic}/u.test(msg), false);
  }
});

