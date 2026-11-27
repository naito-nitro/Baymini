import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectClientEmergency,
  extractProfileHealthSummary,
  formatDoctorQuestionsText,
  formatPreVisitBriefText,
  normalizeFollowUpResponse,
  normalizeSymptomAssessment,
} from './symptoms.ts';
import { SAMPLE_PROFILES } from './healthPlan.ts';

test('detectClientEmergency catches hard text red flags including typos and soft checklist combos', () => {
  const hardTypo = detectClientEmergency(['Cough'], 'I cant breath properly since morning');
  assert.equal(hardTypo.isEmergency, true);
  assert.equal(hardTypo.isHardRedFlag, true);

  const strokeText = detectClientEmergency([], 'My father has slurred speech and face drooping');
  assert.equal(strokeText.isEmergency, true);
  assert.equal(strokeText.isHardRedFlag, true);

  const softCombo = detectClientEmergency(['Chest discomfort', 'Shortness of breath'], '');
  assert.equal(softCombo.isEmergency, true);
  assert.equal(softCombo.isHardRedFlag, false);

  const softCombo2 = detectClientEmergency(['Chest discomfort', 'Dizziness'], '');
  assert.equal(softCombo2.isEmergency, true);
  assert.equal(softCombo2.isHardRedFlag, false);

  const benign = detectClientEmergency(['Headache', 'Fatigue'], 'Mild headache after long screen time');
  assert.equal(benign.isEmergency, false);
  assert.equal(benign.isHardRedFlag, false);
});

test('extractProfileHealthSummary builds compact pills and hides empty profile', () => {
  assert.equal(extractProfileHealthSummary(null).hasRelevantData, false);

  const profile = {
    ...SAMPLE_PROFILES[0].profile,
    age: 21,
    medicalConditions: ['Asthma'],
    allergies: 'Peanut allergy',
    medications: 'Albuterol inhaler',
  };
  const summary = extractProfileHealthSummary(profile);
  assert.equal(summary.hasRelevantData, true);
  assert.ok(summary.pills.includes('Age 21'));
  assert.ok(summary.pills.includes('Asthma'));
  assert.ok(summary.promptText.includes('Peanut allergy'));
});

test('normalizeFollowUpResponse strips emojis and handles malformed payloads gracefully', () => {
  const normalized = normalizeFollowUpResponse({
    isEmergency: false,
    emergencyReason: '',
    questions: [
      { id: 'q1', question: 'How long has this lasted?', type: 'single', options: ['1 day', '3+ days'] },
      { id: 'q2', question: 'Any triggers?', type: 'single', options: ['Only one option'] },
    ],
  });
  assert.equal(normalized.isEmergency, false);
  assert.equal(normalized.questions.length, 2);
  assert.equal(normalized.questions[0].type, 'single');
  assert.equal(normalized.questions[1].type, 'text');

  const fallback = normalizeFollowUpResponse(null);
  assert.equal(fallback.isEmergency, false);
  assert.ok(fallback.questions.length >= 3);
});

test('normalizeSymptomAssessment clamps specialties and formats pre-visit brief cleanly', () => {
  const assessment = normalizeSymptomAssessment(
    {
      urgencyLevel: 'prompt',
      urgencyTitle: 'See a Doctor Within 24 Hours',
      urgencySummary: 'Persistent fever and cough should be assessed soon.',
      possibleExplanations: [
        { title: 'Upper respiratory infection', explanation: 'May be associated with viral or bacterial irritation.' },
      ],
      selfCareGuidance: ['Stay hydrated with warm water'],
      warningSigns: ['Worsening shortness of breath'],
      doctorQuestions: ['Do I need a chest exam?'],
      recommendedSpecialty: 'Pulmonologist',
      specialtyReason: 'A Pulmonologist evaluates persistent respiratory symptoms.',
      briefSummaryForDoctor: 'Patient reports 3 days of cough and mild fever.',
    },
    {
      selectedSymptoms: ['Cough', 'Fever'],
      customNotes: 'Started 3 days ago',
      followUpQA: [{ question: 'Duration?', answer: '3 days' }],
      factoredProfileSummary: ['Age 21', 'Asthma'],
    }
  );

  assert.equal(assessment.urgencyLevel, 'prompt');
  assert.equal(assessment.recommendedSpecialty, 'Pulmonologist');

  const brief = formatPreVisitBriefText(assessment);
  assert.ok(brief.includes('BAYMINI PRE-VISIT SUMMARY'));
  assert.ok(brief.includes('Pulmonologist'));
  assert.ok(brief.includes('Age 21 | Asthma'));

  const questionsText = formatDoctorQuestionsText(assessment.doctorQuestions);
  assert.ok(questionsText.includes('1. Do I need a chest exam?'));
});
