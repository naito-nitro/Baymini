import type {
  ActiveView,
  AppointmentBooking,
  ChatSuggestedAction,
  HealthPlan,
  HealthProfile,
  SymptomAssessment,
} from '../types/baymini';
import { stripEmojis } from './healthPlan';
import { detectClientEmergency } from './symptoms';

export interface SessionContextInput {
  healthProfile: HealthProfile | null;
  healthPlan: HealthPlan | null;
  symptomAssessment: SymptomAssessment | null;
  bookings: AppointmentBooking[];
}

export function buildSessionContextSummary(input: SessionContextInput): string {
  const sections: string[] = [];

  if (input.healthPlan || input.healthProfile) {
    const parts: string[] = [];
    if (input.healthProfile) {
      if (input.healthProfile.primaryGoal) {
        parts.push(`Primary Goal: ${input.healthProfile.primaryGoal}`);
      }
      if (input.healthProfile.region) {
        parts.push(`Region: ${input.healthProfile.region}`);
      }
      if (input.healthProfile.budget) {
        parts.push(`Budget: ${input.healthProfile.budget}`);
      }
      if (input.healthProfile.dietType) {
        const diet =
          input.healthProfile.dietType === 'Other'
            ? input.healthProfile.dietTypeOther || 'Custom'
            : input.healthProfile.dietType;
        parts.push(`Diet: ${diet}`);
      }
      const conditions = [
        ...input.healthProfile.medicalConditions.filter(
          (c) => c && c.toLowerCase() !== 'none'
        ),
        ...(input.healthProfile.medicalConditionsOther.trim()
          ? [input.healthProfile.medicalConditionsOther.trim()]
          : []),
      ];
      if (conditions.length > 0) {
        parts.push(`Conditions: ${conditions.join(', ')}`);
      }
      if (input.healthProfile.allergies.trim()) {
        parts.push(`Allergies: ${input.healthProfile.allergies.trim()}`);
      }
    }

    if (input.healthPlan) {
      const mealNames = input.healthPlan.meals
        .map((m) => `${m.slot}: ${m.dishName}`)
        .join('; ');
      if (mealNames) {
        parts.push(`Daily Meals: ${mealNames}`);
      }
      const workoutNames = input.healthPlan.exercises
        .slice(0, 4)
        .map((e) => e.name)
        .join(', ');
      if (workoutNames) {
        parts.push(`Exercises: ${workoutNames}`);
      }
    }

    if (parts.length > 0) {
      sections.push(`Active Health Plan & Profile:\n${parts.join(' | ')}`);
    }
  }

  if (input.symptomAssessment) {
    const s = input.symptomAssessment;
    const parts = [
      `Symptoms: ${s.selectedSymptoms.join(', ') || 'Described in notes'}`,
      `Urgency: ${s.urgencyLevel} (${s.urgencyTitle})`,
      `Recommended Specialty: ${s.recommendedSpecialty}`,
      `Brief Summary: ${s.briefSummaryForDoctor}`,
    ];
    sections.push(`Latest Symptom Check:\n${parts.join(' | ')}`);
  }

  const upcoming = input.bookings.filter((b) => b.status === 'upcoming');
  if (upcoming.length > 0) {
    const list = upcoming
      .slice(0, 3)
      .map((b) => {
        const mode =
          b.consultationType === 'telehealth'
            ? 'Teleconsultation'
            : 'In-Clinic Visit';
        const briefNote = b.attachedSymptomBrief
          ? ' [Symptom brief attached]'
          : '';
        return `${b.doctor.name} (${b.doctor.specialty}) on ${b.date} at ${b.time} (${mode})${briefNote}`;
      })
      .join('; ');
    sections.push(`Upcoming Bookings:\n${list}`);
  }

  return stripEmojis(sections.join('\n\n'));
}

const DEFAULT_STARTER_CHIPS = [
  'How can I improve my sleep routine?',
  'Healthy budget-friendly snacks?',
  'How much water should I drink daily?',
  'Simple ways to lower daily stress?',
];

export function getDynamicStarterChips(input: {
  healthPlan: HealthPlan | null;
  symptomAssessment: SymptomAssessment | null;
  upcomingBookingsCount?: number;
}): string[] {
  const chips: string[] = [];

  if ((input.upcomingBookingsCount ?? 0) > 0) {
    chips.push('How should I prepare for my upcoming doctor visit?');
  }
  if (input.healthPlan) {
    chips.push('Suggest a quicker swap for my dinner');
  }
  if (input.symptomAssessment && (input.upcomingBookingsCount ?? 0) === 0) {
    chips.push('How should I prepare for my doctor visit?');
  }

  for (const fallback of DEFAULT_STARTER_CHIPS) {
    if (chips.length >= 4) break;
    if (!chips.includes(fallback)) {
      chips.push(fallback);
    }
  }

  return chips.slice(0, 4);
}

export function detectChatEmergency(message: string): {
  isEmergency: boolean;
  reason: string;
} {
  const result = detectClientEmergency([], message);
  return {
    isEmergency: result.isEmergency,
    reason: result.reason,
  };
}

export interface NormalizedChatReply {
  reply: string;
  isEmergency: boolean;
  suggestedActions: ChatSuggestedAction[];
}

function isValidTargetView(value: unknown): value is ActiveView {
  return (
    value === 'health-plan' ||
    value === 'symptoms' ||
    value === 'doctors' ||
    value === 'home'
  );
}

export function normalizeChatResponse(
  raw: unknown,
  clientEmergencyFlag = false
): NormalizedChatReply {
  let reply = '';
  let modelEmergency = false;
  const actions: ChatSuggestedAction[] = [];

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        return normalizeChatResponse(parsed, clientEmergencyFlag);
      } catch {
        reply = stripEmojis(trimmed);
      }
    } else {
      reply = stripEmojis(trimmed);
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    reply =
      typeof rec.reply === 'string' ? stripEmojis(rec.reply).trim() : '';
    modelEmergency = Boolean(rec.isEmergency);

    if (Array.isArray(rec.suggestedActions)) {
      for (const item of rec.suggestedActions) {
        if (actions.length >= 2) break;
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const a = item as Record<string, unknown>;
        const label =
          typeof a.label === 'string' ? stripEmojis(a.label).trim() : '';
        const targetView = a.targetView;
        const specialtyHint =
          typeof a.specialtyHint === 'string'
            ? stripEmojis(a.specialtyHint).trim()
            : undefined;
        if (label && isValidTargetView(targetView) && targetView !== 'home') {
          actions.push({
            label: label.slice(0, 48),
            targetView,
            ...(specialtyHint ? { specialtyHint: specialtyHint.slice(0, 60) } : {}),
          });
        }
      }
    }
  }

  const isEmergency = Boolean(clientEmergencyFlag || modelEmergency);

  if (!reply) {
    reply = isEmergency
      ? 'This sounds urgent. Please call your local emergency number or go to the nearest emergency hospital immediately.'
      : 'I am here to help with your daily wellness, nutrition, sleep, or symptom questions. What would you like to focus on?';
  }

  if (isEmergency) {
    const hasEmergencyChip = actions.some(
      (a) =>
        a.targetView === 'doctors' &&
        a.specialtyHint?.toLowerCase().includes('emergency')
    );
    if (!hasEmergencyChip) {
      actions.unshift({
        label: 'Find Emergency Hospitals',
        targetView: 'doctors',
        specialtyHint: 'Emergency Hospital',
      });
    }
  }

  return {
    reply,
    isEmergency,
    suggestedActions: actions.slice(0, 2),
  };
}

export type FormattedChatBlock =
  | { type: 'paragraph'; segments: Array<{ text: string; bold: boolean }> }
  | { type: 'list'; items: Array<Array<{ text: string; bold: boolean }>> };

function parseInlineBold(line: string): Array<{ text: string; bold: boolean }> {
  const cleaned = stripEmojis(line);
  const parts: Array<{ text: string; bold: boolean }> = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIdx) {
      parts.push({
        text: cleaned.slice(lastIdx, match.index).replace(/\*/g, ''),
        bold: false,
      });
    }
    parts.push({ text: match[1].replace(/\*/g, ''), bold: true });
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < cleaned.length) {
    parts.push({
      text: cleaned.slice(lastIdx).replace(/\*/g, ''),
      bold: false,
    });
  }

  return parts.filter((p) => p.text.length > 0);
}

export function parseFormattedChatBlocks(content: string): FormattedChatBlock[] {
  const lines = stripEmojis(content)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim());

  const blocks: FormattedChatBlock[] = [];
  let currentList: Array<Array<{ text: string; bold: boolean }>> = [];

  const flushList = () => {
    if (currentList.length > 0) {
      blocks.push({ type: 'list', items: currentList });
      currentList = [];
    }
  };

  for (const line of lines) {
    if (!line) {
      flushList();
      continue;
    }

    const bulletMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (bulletMatch) {
      const segs = parseInlineBold(bulletMatch[1]);
      if (segs.length > 0) {
        currentList.push(segs);
      }
      continue;
    }

    flushList();
    const cleanedHeading = line.replace(/^#{1,4}\s+/, '');
    const segs = parseInlineBold(cleanedHeading);
    if (segs.length > 0) {
      blocks.push({ type: 'paragraph', segments: segs });
    }
  }

  flushList();
  return blocks;
}
