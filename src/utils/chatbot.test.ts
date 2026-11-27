import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSessionContextSummary,
  detectChatEmergency,
  getDynamicStarterChips,
  normalizeChatResponse,
  parseFormattedChatBlocks,
} from './chatbot.ts';
import { SAMPLE_PROFILES, normalizeHealthPlan } from './healthPlan.ts';
import { normalizeSymptomAssessment } from './symptoms.ts';

test('getDynamicStarterChips adapts to active Health Plan and Symptom Check', () => {
  const emptyChips = getDynamicStarterChips({ healthPlan: null, symptomAssessment: null });
  assert.equal(emptyChips.length, 4);
  assert.ok(!emptyChips.includes('Suggest a quicker swap for my dinner'));

  const plan = normalizeHealthPlan({});
  const assessment = normalizeSymptomAssessment({}, {
    selectedSymptoms: ['Headache'],
    customNotes: '',
    followUpQA: [],
    factoredProfileSummary: [],
  });
  const contextChips = getDynamicStarterChips({ healthPlan: plan, symptomAssessment: assessment });
  assert.equal(contextChips.length, 4);
  assert.equal(contextChips[0], 'Suggest a quicker swap for my dinner');
  assert.equal(contextChips[1], 'How should I prepare for my doctor visit?');

  const bookingChips = getDynamicStarterChips({
    healthPlan: plan,
    symptomAssessment: assessment,
    upcomingBookingsCount: 1,
  });
  assert.equal(bookingChips[0], 'How should I prepare for my upcoming doctor visit?');
});

test('buildSessionContextSummary summarizes profile, plan, symptom assessment, and upcoming bookings', () => {
  const plan = normalizeHealthPlan({
    meals: [{ slot: 'Dinner', dishName: 'Fish Curry with Rice' }],
  });
  const assessment = normalizeSymptomAssessment(
    { urgencyLevel: 'routine', recommendedSpecialty: 'Dermatologist', briefSummaryForDoctor: 'Mild rash on forearm.' },
    { selectedSymptoms: ['Skin rash'], customNotes: '', followUpQA: [], factoredProfileSummary: [] }
  );

  const summary = buildSessionContextSummary({
    healthProfile: SAMPLE_PROFILES[0].profile,
    healthPlan: plan,
    symptomAssessment: assessment,
    bookings: [
      {
        id: 'b-1',
        doctor: { name: 'Dr. Rahman', specialty: 'Dermatologist', address: 'Dhanmondi' },
        consultationType: 'in-person',
        date: '2026-12-01',
        time: '10:00',
        patientName: 'Arefin',
        contact: '01700000000',
        notes: '',
        status: 'upcoming',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.ok(summary.includes('Dhaka, Bangladesh'));
  assert.ok(summary.includes('Fish Curry with Rice'));
  assert.ok(summary.includes('Dermatologist'));
  assert.ok(summary.includes('Dr. Rahman'));
});

test('normalizeChatResponse supports JSON, plain-text fallback, and emergency chip injection', () => {
  const plain = normalizeChatResponse('Drink steady water across the day.', false);
  assert.equal(plain.reply, 'Drink steady water across the day.');
  assert.equal(plain.isEmergency, false);
  assert.equal(plain.suggestedActions.length, 0);

  const emergency = normalizeChatResponse(
    { reply: 'Please call emergency services now.', isEmergency: false, suggestedActions: [] },
    true
  );
  assert.equal(emergency.isEmergency, true);
  assert.equal(emergency.suggestedActions[0]?.targetView, 'doctors');
  assert.equal(emergency.suggestedActions[0]?.specialtyHint, 'Emergency Hospital');

  assert.equal(detectChatEmergency('I have crushing chest pain right now').isEmergency, true);
});

test('parseFormattedChatBlocks turns markdown bullets and bold text into clean structured blocks', () => {
  const blocks = parseFormattedChatBlocks(
    'Try these gentle steps:\n- **Hydrate early** after waking\n- Take a 10-minute walk\n\nRest well tonight.'
  );
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[1].type, 'list');
  if (blocks[1].type === 'list') {
    assert.equal(blocks[1].items.length, 2);
    assert.equal(blocks[1].items[0][0].bold, true);
    assert.equal(blocks[1].items[0][0].text, 'Hydrate early');
  }
  assert.equal(blocks[2].type, 'paragraph');
});
