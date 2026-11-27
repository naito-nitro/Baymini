import type {
  HealthProfile,
  SymptomAssessment,
  SymptomExplanation,
  SymptomFollowUpQA,
  SymptomFollowUpQuestion,
  SymptomQuestionType,
  UrgencyLevel,
} from '../types/baymini';
import { stripEmojis } from './healthPlan';

export type SymptomIconKey =
  | 'brain'
  | 'thermometer'
  | 'wind'
  | 'mic-off'
  | 'battery-low'
  | 'compass'
  | 'waves'
  | 'droplets'
  | 'circle-dot'
  | 'activity'
  | 'lungs'
  | 'heart-pulse'
  | 'user'
  | 'bone'
  | 'sparkles'
  | 'plus-circle';

export interface SymptomOption {
  id: string;
  label: string;
  icon: SymptomIconKey;
}

export const SYMPTOM_OPTIONS: SymptomOption[] = [
  { id: 'headache', label: 'Headache', icon: 'brain' },
  { id: 'fever', label: 'Fever', icon: 'thermometer' },
  { id: 'cough', label: 'Cough', icon: 'wind' },
  { id: 'sore-throat', label: 'Sore throat', icon: 'mic-off' },
  { id: 'fatigue', label: 'Fatigue', icon: 'battery-low' },
  { id: 'dizziness', label: 'Dizziness', icon: 'compass' },
  { id: 'nausea', label: 'Nausea', icon: 'waves' },
  { id: 'vomiting', label: 'Vomiting', icon: 'droplets' },
  { id: 'stomach-pain', label: 'Stomach pain', icon: 'circle-dot' },
  { id: 'diarrhea', label: 'Diarrhea', icon: 'activity' },
  { id: 'shortness-of-breath', label: 'Shortness of breath', icon: 'lungs' },
  { id: 'chest-discomfort', label: 'Chest discomfort', icon: 'heart-pulse' },
  { id: 'body-aches', label: 'Body aches', icon: 'user' },
  { id: 'joint-pain', label: 'Joint pain', icon: 'bone' },
  { id: 'skin-rash', label: 'Skin rash', icon: 'sparkles' },
  { id: 'other-symptoms', label: 'Other symptoms', icon: 'plus-circle' },
];

export const VALID_SPECIALTIES = [
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Pulmonologist',
  'Gastroenterologist',
  'ENT Specialist',
  'Orthopedic',
  'Neurologist',
  'Pediatrician',
  'Emergency Hospital',
] as const;

export interface EmergencyCheckResult {
  isEmergency: boolean;
  isHardRedFlag: boolean;
  reason: string;
}

interface RedFlagRule {
  pattern: RegExp;
  reason: string;
}

const HARD_TEXT_RED_FLAGS: RedFlagRule[] = [
  {
    pattern:
      /\b(chest\s*(pain|press?ure|tightness|squeez\w*|heaviness)|crushing\s*chest|tight\s*chest)\b/i,
    reason:
      'Chest pain, pressure, or tightness can signal a serious cardiac or pulmonary emergency.',
  },
  {
    pattern:
      /\b(can'?t\s*breat?h\w*|cant\s*breat?h\w*|cannot\s*breat?h\w*|hard\s*to\s*breat?h\w*|trouble\s*breath\w*|difficulty\s*breath\w*|struggl\w*\s*to\s*breath\w*|gasping|unable\s*to\s*breat?h\w*|choking)\b/i,
    reason:
      'Severe difficulty breathing or gasping requires immediate emergency evaluation.',
  },
  {
    pattern:
      /\b(face\s*droop\w*|facial\s*droop\w*|slur+\w*\s*speech|weakness\s*on\s*one\s*side|numbness\s*on\s*one\s*side|one\s*side\s*(weak|numb|paralyz\w*)|sudden\s*confusion|stroke)\b/i,
    reason:
      'Facial drooping, slurred speech, or one-sided weakness may be warning signs of a stroke.',
  },
  {
    pattern:
      /\b(passed\s*out|faint(ed|ing)?|unconscious|unresponsive|not\s*waking\s*up|lost\s*consciousness|blacked\s*out)\b/i,
    reason:
      'Fainting, blacking out, or loss of consciousness should be evaluated immediately.',
  },
  {
    pattern:
      /\b((severe|heavy|uncontrolled|won'?t\s*stop)\s*bleed\w*|cough\w*\s*(up\s*)?blood|vomit\w*\s*blood|throwing\s*up\s*blood|blood\s*in\s*vomit)\b/i,
    reason:
      'Severe bleeding or coughing/vomiting blood requires urgent emergency medical care.',
  },
  {
    pattern: /\b(seizur\w*|convuls\w*)\b/i,
    reason: 'Seizures or convulsions require immediate medical attention.',
  },
  {
    pattern:
      /\b(suicid\w*|want\s*to\s*die|kill\s*myself|end\s*my\s*life|self[\s-]?harm|overdos\w*)\b/i,
    reason:
      'If you are experiencing a crisis, self-harm thoughts, or a possible overdose, please seek immediate emergency support right now.',
  },
  {
    pattern:
      /\b(swollen\s*tongue|tongue\s*swell\w*|throat\s*clos\w*|throat\s*swell\w*|anaphylax\w*|lips?\s*turning\s*blue|blue\s*lips?)\b/i,
    reason:
      'Swelling of the tongue or throat, or blue lips, can indicate a severe allergic or airway emergency.',
  },
];

export function detectClientEmergency(
  selectedSymptoms: string[],
  customNotes: string
): EmergencyCheckResult {
  const normalizedNotes = customNotes.trim().replace(/\s+/g, ' ');

  if (normalizedNotes.length > 0) {
    for (const rule of HARD_TEXT_RED_FLAGS) {
      if (rule.pattern.test(normalizedNotes)) {
        return {
          isEmergency: true,
          isHardRedFlag: true,
          reason: rule.reason,
        };
      }
    }
  }

  const lowerSet = new Set(selectedSymptoms.map((s) => s.toLowerCase()));
  const hasChest = lowerSet.has('chest discomfort');
  const hasShortBreath = lowerSet.has('shortness of breath');
  const hasDizziness = lowerSet.has('dizziness');

  if (hasChest && hasShortBreath) {
    return {
      isEmergency: true,
      isHardRedFlag: false,
      reason:
        'Chest discomfort paired with shortness of breath should be assessed urgently to rule out a cardiac or breathing emergency.',
    };
  }

  if (hasChest && hasDizziness) {
    return {
      isEmergency: true,
      isHardRedFlag: false,
      reason:
        'Chest discomfort paired with dizziness can signal a serious circulation or heart concern and warrants prompt urgent evaluation.',
    };
  }

  return {
    isEmergency: false,
    isHardRedFlag: false,
    reason: '',
  };
}

export interface ProfileHealthContextSummary {
  hasRelevantData: boolean;
  pills: string[];
  promptText: string;
}

export function extractProfileHealthSummary(
  profile: HealthProfile | null
): ProfileHealthContextSummary {
  if (!profile) {
    return { hasRelevantData: false, pills: [], promptText: '' };
  }

  const pills: string[] = [];
  const promptLines: string[] = [];

  if (typeof profile.age === 'number' && Number.isFinite(profile.age) && profile.age > 0) {
    pills.push(`Age ${profile.age}`);
    promptLines.push(`Age: ${profile.age}`);
  }

  const conditions = [
    ...profile.medicalConditions.filter((c) => c && c.toLowerCase() !== 'none'),
    ...(profile.medicalConditionsOther.trim()
      ? [profile.medicalConditionsOther.trim()]
      : []),
  ];
  if (conditions.length > 0) {
    conditions.slice(0, 3).forEach((c) => pills.push(c));
    if (conditions.length > 3) {
      pills.push(`+${conditions.length - 3} more`);
    }
    promptLines.push(`Existing medical conditions: ${conditions.join(', ')}`);
  }

  const allergies = profile.allergies.trim();
  if (allergies) {
    const shortAllergy =
      allergies.length > 28 ? `${allergies.slice(0, 26)}...` : allergies;
    pills.push(`Allergy: ${shortAllergy}`);
    promptLines.push(`Allergies: ${allergies}`);
  }

  const medications = profile.medications.trim();
  if (medications) {
    const shortMed =
      medications.length > 26 ? `${medications.slice(0, 24)}...` : medications;
    pills.push(`Meds: ${shortMed}`);
    promptLines.push(`Current medications: ${medications}`);
  }

  return {
    hasRelevantData: pills.length > 0,
    pills,
    promptText: promptLines.join('\n'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = stripEmojis(value).trim();
  return cleaned || fallback;
}

function cleanStringList(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => cleanText(item))
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

export interface NormalizedFollowUpResponse {
  isEmergency: boolean;
  emergencyReason: string;
  questions: SymptomFollowUpQuestion[];
}

export function normalizeFollowUpResponse(raw: unknown): NormalizedFollowUpResponse {
  const rec = isRecord(raw) ? raw : {};
  const isEmergency = Boolean(rec.isEmergency);
  const emergencyReason = cleanText(
    rec.emergencyReason,
    isEmergency
      ? 'Your reported symptoms may indicate a medical emergency that needs immediate in-person evaluation.'
      : ''
  );

  const rawQuestions = Array.isArray(rec.questions) ? rec.questions : [];
  const questions: SymptomFollowUpQuestion[] = [];

  for (let i = 0; i < rawQuestions.length && questions.length < 6; i++) {
    const item = rawQuestions[i];
    if (!isRecord(item)) continue;
    const questionText = cleanText(item.question);
    if (!questionText) continue;

    const rawType = cleanText(item.type).toLowerCase();
    let type: SymptomQuestionType =
      rawType === 'single' || rawType === 'multi' || rawType === 'text'
        ? rawType
        : 'single';

    const options = cleanStringList(item.options).slice(0, 6);
    if ((type === 'single' || type === 'multi') && options.length < 2) {
      type = 'text';
    }

    questions.push({
      id: cleanText(item.id, `q-${i + 1}`),
      question: questionText,
      type,
      options: type === 'text' ? [] : options,
    });
  }

  if (!isEmergency && questions.length === 0) {
    questions.push(
      {
        id: 'q-duration',
        question: 'How long have you been experiencing these symptoms?',
        type: 'single',
        options: [
          'Started today',
          '1 to 3 days',
          '4 to 7 days',
          'More than a week',
        ],
      },
      {
        id: 'q-severity',
        question: 'How would you describe the overall severity right now?',
        type: 'single',
        options: [
          'Mild and manageable',
          'Moderate, affecting daily routine',
          'Strong or worsening',
        ],
      },
      {
        id: 'q-triggers',
        question: 'Have you noticed anything that makes the symptoms better or worse?',
        type: 'text',
        options: [],
      }
    );
  }

  return {
    isEmergency,
    emergencyReason,
    questions,
  };
}

function normalizeUrgencyLevel(value: unknown): UrgencyLevel {
  const raw = cleanText(value).toLowerCase();
  if (raw === 'emergency') return 'emergency';
  if (raw === 'prompt') return 'prompt';
  if (raw === 'routine') return 'routine';
  if (raw === 'self-care' || raw === 'self_care' || raw === 'selfcare') {
    return 'self-care';
  }
  return 'routine';
}

function defaultUrgencyMeta(level: UrgencyLevel): { title: string; summary: string } {
  switch (level) {
    case 'emergency':
      return {
        title: 'Seek Immediate Emergency Care',
        summary:
          'Based on the symptoms described, immediate evaluation at an emergency department or via local emergency services is strongly advised.',
      };
    case 'prompt':
      return {
        title: 'See a Doctor Within 24 Hours',
        summary:
          'These symptoms warrant a timely medical assessment within the next 24 hours, or sooner if anything worsens.',
      };
    case 'routine':
      return {
        title: 'Schedule a Medical Checkup',
        summary:
          'A routine appointment with a healthcare professional can help clarify the cause and guide safe next steps.',
      };
    case 'self-care':
      return {
        title: 'Monitor Safely at Home',
        summary:
          'Your symptoms appear mild right now. Rest, gentle self-care, and monitoring for any changes are reasonable first steps.',
      };
  }
}

export function normalizeSpecialty(value: unknown, urgency: UrgencyLevel): string {
  if (urgency === 'emergency') {
    return 'Emergency Hospital';
  }
  const raw = cleanText(value);
  if (!raw) return 'General Physician';

  const exact = VALID_SPECIALTIES.find(
    (spec) => spec.toLowerCase() === raw.toLowerCase()
  );
  if (exact) return exact;

  const partial = VALID_SPECIALTIES.find(
    (spec) =>
      raw.toLowerCase().includes(spec.toLowerCase()) ||
      spec.toLowerCase().includes(raw.toLowerCase())
  );
  return partial ?? 'General Physician';
}

export function normalizeSymptomAssessment(
  raw: unknown,
  input: {
    selectedSymptoms: string[];
    customNotes: string;
    followUpQA: SymptomFollowUpQA[];
    factoredProfileSummary: string[];
  }
): SymptomAssessment {
  const rec = isRecord(raw) ? raw : {};
  const urgencyLevel = normalizeUrgencyLevel(rec.urgencyLevel);
  const defaults = defaultUrgencyMeta(urgencyLevel);

  const rawExplanations = Array.isArray(rec.possibleExplanations)
    ? rec.possibleExplanations
    : [];
  const possibleExplanations: SymptomExplanation[] = [];

  for (const item of rawExplanations) {
    if (possibleExplanations.length >= 4) break;
    if (isRecord(item)) {
      const title = cleanText(item.title);
      const explanation = cleanText(item.explanation);
      if (title && explanation) {
        possibleExplanations.push({ title, explanation });
      }
    } else if (typeof item === 'string') {
      const text = cleanText(item);
      if (text) {
        possibleExplanations.push({
          title: 'Possible Factor',
          explanation: text,
        });
      }
    }
  }

  if (possibleExplanations.length === 0) {
    possibleExplanations.push({
      title: 'General Non-Specific Cause',
      explanation:
        'Symptoms like these may be associated with several everyday or medical factors that a clinician can evaluate in person.',
    });
  }

  const recommendedSpecialty = normalizeSpecialty(
    rec.recommendedSpecialty,
    urgencyLevel
  );

  const selfCareGuidance = cleanStringList(
    rec.selfCareGuidance ?? rec.selfCareSteps,
    urgencyLevel === 'emergency'
      ? [
          'Do not drive yourself if you feel faint, short of breath, or in severe pain.',
          'Keep a list of current medications and allergies ready for emergency responders.',
        ]
      : [
          'Rest and stay comfortably hydrated with water or clear fluids.',
          'Keep a brief log of when symptoms change, improve, or worsen.',
        ]
  );

  const warningSigns = cleanStringList(rec.warningSigns, [
    'Sudden chest pain, pressure, or shortness of breath',
    'High or persistent fever that does not respond to rest',
    'Confusion, fainting, severe weakness, or rapidly worsening symptoms',
  ]);

  const doctorQuestions = cleanStringList(rec.doctorQuestions, [
    'What are the most likely causes of these symptoms based on my history?',
    'Are any tests or examinations recommended at this visit?',
    'What warning signs should prompt me to seek urgent care?',
  ]);

  const symptomListText =
    input.selectedSymptoms.length > 0
      ? input.selectedSymptoms.join(', ')
      : 'reported symptoms';

  return {
    selectedSymptoms: input.selectedSymptoms,
    customNotes: cleanText(input.customNotes),
    followUpQA: input.followUpQA
      .map((qa) => ({
        question: cleanText(qa.question),
        answer: cleanText(qa.answer),
      }))
      .filter((qa) => qa.question && qa.answer),
    factoredProfileSummary: input.factoredProfileSummary,
    urgencyLevel,
    urgencyTitle: cleanText(rec.urgencyTitle, defaults.title),
    urgencySummary: cleanText(rec.urgencySummary, defaults.summary),
    possibleExplanations,
    selfCareGuidance,
    warningSigns,
    doctorQuestions,
    recommendedSpecialty,
    specialtyReason: cleanText(
      rec.specialtyReason,
      urgencyLevel === 'emergency'
        ? 'An emergency department is best equipped for rapid evaluation and urgent stabilization.'
        : `A ${recommendedSpecialty} is well suited to evaluate these symptoms and coordinate care.`
    ),
    briefSummaryForDoctor: cleanText(
      rec.briefSummaryForDoctor,
      `Patient reports ${symptomListText}${
        input.customNotes.trim() ? ` (${cleanText(input.customNotes)})` : ''
      }. Seeking clinical evaluation and guidance.`
    ),
    assessedAt: new Date().toISOString(),
  };
}

export function formatDoctorQuestionsText(questions: string[]): string {
  return [
    'Questions to Ask My Doctor (Baymini)',
    '',
    ...questions.map((q, idx) => `${idx + 1}. ${stripEmojis(q)}`),
  ].join('\n');
}

export function formatPreVisitBriefText(assessment: SymptomAssessment): string {
  const dateLabel = new Date(assessment.assessedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const lines: string[] = [
    'BAYMINI PRE-VISIT SUMMARY',
    `Generated: ${dateLabel}`,
    `Urgency Guidance: ${assessment.urgencyTitle} (${assessment.urgencyLevel.toUpperCase()})`,
    `Recommended Specialty: ${assessment.recommendedSpecialty}`,
    '',
    'REPORTED SYMPTOMS',
    assessment.selectedSymptoms.length > 0
      ? assessment.selectedSymptoms.join(', ')
      : 'Described in patient notes',
    '',
    'CLINICAL SUMMARY FOR DOCTOR',
    assessment.briefSummaryForDoctor,
  ];

  if (assessment.followUpQA.length > 0) {
    lines.push('', 'KEY FOLLOW-UP ANSWERS');
    assessment.followUpQA.forEach((qa) => {
      lines.push(`- ${qa.question}: ${qa.answer}`);
    });
  }

  if (
    assessment.factoredProfileSummary &&
    assessment.factoredProfileSummary.length > 0
  ) {
    lines.push('', 'RELEVANT BACKGROUND');
    lines.push(assessment.factoredProfileSummary.join(' | '));
  }

  if (assessment.doctorQuestions.length > 0) {
    lines.push('', 'QUESTIONS TO ASK THE DOCTOR');
    assessment.doctorQuestions.forEach((q, idx) => {
      lines.push(`${idx + 1}. ${q}`);
    });
  }

  lines.push(
    '',
    'Note: Generated by Baymini for pre-visit organization only. Not a medical diagnosis.'
  );

  return stripEmojis(lines.join('\n'));
}
