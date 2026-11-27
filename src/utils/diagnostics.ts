import type { AppointmentBooking } from '../types/baymini';
import {
  buildDefaultRoutineBlocks,
  buildGoogleCalendarTemplateUrl,
  buildIcsContent,
} from './calendarSync';
import {
  ALL_TIME_SLOTS,
  SPECIALTY_OPTIONS,
  buildAppointmentCalendarTemplateUrl,
  buildAppointmentIcs,
  expandSpecialtyQuery,
  haversineDistanceKm,
  isTimeSlotPast,
  toIsoLocalDate,
} from './doctors';
import { SAMPLE_PROFILES, normalizeHealthPlan } from './healthPlan';
import {
  STORAGE_KEY,
  createInitialSessionState,
  loadSessionState,
  saveSessionState,
} from './storage';
import {
  detectClientEmergency,
  normalizeSymptomAssessment,
} from './symptoms';

export type DiagnosticStatus = 'PASS' | 'FAIL' | 'WARN';
export type DiagnosticGroup = 'logic' | 'live' | 'calendar';

export interface DiagnosticCheckResult {
  id: string;
  group: DiagnosticGroup;
  name: string;
  status: DiagnosticStatus;
  detail: string;
  durationMs?: number;
}

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

export function containsEmoji(text: string): boolean {
  return EMOJI_PATTERN.test(text);
}

export function runStoragePersistenceCheck(
  storage?: StorageAdapter
): DiagnosticCheckResult {
  const target =
    storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
  if (!target) {
    return {
      id: 'storage-persistence',
      group: 'logic',
      name: 'State & Storage Persistence',
      status: 'WARN',
      detail: 'localStorage is unavailable in this environment.',
    };
  }

  let originalRaw: string | null = null;
  try {
    originalRaw = target.getItem(STORAGE_KEY);

    const sampleProfile = SAMPLE_PROFILES[0].profile;
    const samplePlan = normalizeHealthPlan({
      intro: 'Diagnostic test wellness plan.',
      morningRoutine: {
        wakeUpHabit: 'Drink water',
        hydrationCue: '1 glass',
        breakfastLink: 'Oats and eggs',
        morningMovement: '10 min walk',
        steps: [{ time: '07:00', title: 'Wake', description: 'Hydrate' }],
      },
      afternoonRoutine: {
        middayHabits: 'Balanced lunch',
        hydrationReminder: 'Sip water',
        postureBreak: 'Stretch shoulders',
        energyGuidance: 'Short walk',
        steps: [{ time: '13:00', title: 'Lunch', description: 'Eat calmly' }],
      },
      eveningRoutine: {
        dinnerTiming: '2 hours before sleep',
        recoveryHabits: 'Light mobility',
        screenWindDown: 'Dim screens',
        relaxationCue: 'Slow breathing',
        steps: [{ time: '21:30', title: 'Wind down', description: 'Rest' }],
      },
      meals: [
        {
          slot: 'Breakfast',
          dishName: 'Boiled eggs with roti',
          portionGuidance: '2 eggs, 2 roti',
          nutritionEstimate: 'Est. ~380 kcal · 18g protein',
          localAvailabilityNote: 'Everyday local staple',
          budgetSwapTip: 'Use seasonal fruit',
        },
      ],
      shoppingList: [{ category: 'Proteins', items: ['Eggs'] }],
      exerciseOverview: {
        weeklyRhythm: '4 days/week',
        intensityGuidance: 'Moderate',
        safetyAdjustments: 'Low impact',
      },
      exercises: [
        {
          name: 'Brisk Walk',
          durationOrSets: '20 minutes',
          intensity: 'Moderate',
          guidance: 'Maintain steady pace',
          beginnerModification: 'Start with 10 minutes',
        },
      ],
      sleepAndLifestyle: {
        sleepWindow: '11:00 PM - 6:30 AM',
        sleepHygiene: ['Keep room cool'],
        hydrationGuidance: '2L daily',
        stressHabits: ['5-minute breathing'],
      },
    });

    const sampleAssessment = normalizeSymptomAssessment(
      {
        urgencyLevel: 'routine',
        urgencyTitle: 'Routine Checkup',
        urgencySummary: 'Schedule a calm clinic consultation.',
        possibleExplanations: [
          { title: 'Tension headache', explanation: 'Often linked to fatigue.' },
        ],
        selfCareGuidance: ['Rest and hydrate'],
        warningSigns: ['Sudden severe pain'],
        doctorQuestions: ['Could stress be contributing?'],
        recommendedSpecialty: 'General Physician',
        specialtyReason: 'Good starting point for primary evaluation.',
        briefSummaryForDoctor: 'Mild headache over two days.',
      },
      {
        selectedSymptoms: ['Headache'],
        customNotes: 'Mild afternoon headache',
        followUpQA: [{ question: 'Duration?', answer: '2 days' }],
        factoredProfileSummary: ['Age 28'],
      }
    );

    const sampleBooking: AppointmentBooking = {
      id: 'diag-bk-1',
      doctor: {
        id: 'diag-doc-1',
        name: 'Central Care Clinic',
        specialty: 'General Physician',
        address: 'Dhanmondi Road 27, Dhaka',
      },
      consultationType: 'in-person',
      date: '2026-12-15',
      time: '10:30',
      patientName: 'Diagnostic User',
      contact: 'diag@example.com',
      notes: 'Routine visit',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    };

    const testState = {
      ...createInitialSessionState(),
      healthProfile: sampleProfile,
      healthPlan: samplePlan,
      symptomAssessment: sampleAssessment,
      bookings: [sampleBooking],
    };

    const savedOk = saveSessionState(testState, target);
    const loaded = loadSessionState(target);

    if (
      !savedOk ||
      loaded.healthProfile?.region !== sampleProfile.region ||
      loaded.healthPlan?.intro !== samplePlan.intro ||
      loaded.symptomAssessment?.recommendedSpecialty !== 'General Physician' ||
      loaded.bookings.length !== 1 ||
      loaded.bookings[0].id !== 'diag-bk-1'
    ) {
      return {
        id: 'storage-persistence',
        group: 'logic',
        name: 'State & Storage Persistence',
        status: 'FAIL',
        detail: 'Round-trip persistence verification failed for baymini_v2_state.',
      };
    }

    // Corrupted JSON recovery
    target.setItem(STORAGE_KEY, '{corrupted-json-payload');
    const recoveredFromCorrupt = loadSessionState(target);
    if (
      recoveredFromCorrupt.healthProfile !== null ||
      recoveredFromCorrupt.bookings.length !== 0
    ) {
      return {
        id: 'storage-persistence',
        group: 'logic',
        name: 'State & Storage Persistence',
        status: 'FAIL',
        detail: 'Corrupted JSON did not reset cleanly to initial state.',
      };
    }

    // Partial object recovery
    target.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        healthProfile: {
          region: 'Dhaka',
          goals: ['Better Sleep'],
          primaryGoal: 'Better Sleep',
          dietType: 'Vegetarian',
          budget: 'Budget-Friendly',
        },
        healthPlan: {
          intro: 'Partial plan',
          morningRoutine: {},
          afternoonRoutine: {},
          eveningRoutine: {},
          meals: [],
          exercises: [],
          generatedAt: new Date().toISOString(),
        },
      })
    );
    const recoveredPartial = loadSessionState(target);
    if (
      !recoveredPartial.healthProfile ||
      typeof recoveredPartial.healthProfile.allergies !== 'string' ||
      !recoveredPartial.healthPlan ||
      !Array.isArray(recoveredPartial.healthPlan.morningRoutine.steps)
    ) {
      return {
        id: 'storage-persistence',
        group: 'logic',
        name: 'State & Storage Persistence',
        status: 'FAIL',
        detail: 'Partial JSON normalization failed to fill missing nested defaults.',
      };
    }

    return {
      id: 'storage-persistence',
      group: 'logic',
      name: 'State & Storage Persistence',
      status: 'PASS',
      detail:
        'Verified round-trip persistence (profile, plan, symptoms, bookings), corrupted JSON recovery, partial object recovery, and restored prior user state.',
    };
  } catch (err) {
    return {
      id: 'storage-persistence',
      group: 'logic',
      name: 'State & Storage Persistence',
      status: 'FAIL',
      detail: `Unexpected storage exception: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    try {
      if (originalRaw === null) {
        target.removeItem(STORAGE_KEY);
      } else {
        target.setItem(STORAGE_KEY, originalRaw);
      }
    } catch {
      // Ignore restore errors in restricted storage modes
    }
  }
}

export function runEmergencyDetectorCheck(): DiagnosticCheckResult {
  try {
    const c1 = detectClientEmergency([], 'cant breath and chest pressure');
    const c2 = detectClientEmergency([], 'face drooping');
    const c3 = detectClientEmergency([], 'mild headache');
    const c4 = detectClientEmergency(
      ['Chest discomfort', 'Shortness of breath'],
      ''
    );

    const failures: string[] = [];
    if (!c1.isEmergency) failures.push('missed "cant breath and chest pressure"');
    if (!c2.isEmergency) failures.push('missed "face drooping"');
    if (c3.isEmergency) failures.push('false positive on "mild headache"');
    if (!c4.isEmergency) {
      failures.push('missed ["Chest discomfort", "Shortness of breath"]');
    }

    if (failures.length > 0) {
      return {
        id: 'emergency-detector',
        group: 'logic',
        name: 'Emergency Red-Flag Detector',
        status: 'FAIL',
        detail: `Assertions failed: ${failures.join('; ')}.`,
      };
    }

    return {
      id: 'emergency-detector',
      group: 'logic',
      name: 'Emergency Red-Flag Detector',
      status: 'PASS',
      detail:
        '4/4 checks passed: chest/breathing phrase, stroke phrase, chest+breathing combo flagged; mild headache safely cleared.',
    };
  } catch (err) {
    return {
      id: 'emergency-detector',
      group: 'logic',
      name: 'Emergency Red-Flag Detector',
      status: 'FAIL',
      detail: `Detector threw an error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function runNormalizerResilienceCheck(): DiagnosticCheckResult {
  try {
    const plans = [
      normalizeHealthPlan(null),
      normalizeHealthPlan(undefined),
      normalizeHealthPlan({}),
      normalizeHealthPlan({
        intro: 'Bad nested shapes',
        meals: [null, { dishName: 123 }],
        exercises: ['invalid'],
        morningRoutine: 'not-an-object',
      }),
    ];

    const assessments = [
      normalizeSymptomAssessment(null, {
        selectedSymptoms: [],
        customNotes: '',
        followUpQA: [],
        factoredProfileSummary: [],
      }),
      normalizeSymptomAssessment(
        {
          urgencyLevel: 'invalid-level',
          possibleExplanations: [null, { title: 'Test' }],
          recommendedSpecialty: 'Unknown Specialty',
        },
        {
          selectedSymptoms: ['Fatigue'],
          customNotes: 'Tired',
          followUpQA: [],
          factoredProfileSummary: [],
        }
      ),
    ];

    const plansValid = plans.every(
      (p) =>
        typeof p.intro === 'string' &&
        Array.isArray(p.morningRoutine.steps) &&
        Array.isArray(p.meals) &&
        Array.isArray(p.exercises) &&
        Array.isArray(p.shoppingList) &&
        Array.isArray(p.sleepAndLifestyle.sleepHygiene)
    );

    const assessmentsValid = assessments.every(
      (a) =>
        typeof a.urgencyLevel === 'string' &&
        Array.isArray(a.possibleExplanations) &&
        Array.isArray(a.selfCareGuidance) &&
        Array.isArray(a.warningSigns) &&
        Array.isArray(a.doctorQuestions) &&
        typeof a.recommendedSpecialty === 'string'
    );

    if (!plansValid || !assessmentsValid) {
      return {
        id: 'normalizer-resilience',
        group: 'logic',
        name: 'JSON Normalizer Resilience',
        status: 'FAIL',
        detail: 'Normalizer returned invalid default structure on malformed input.',
      };
    }

    return {
      id: 'normalizer-resilience',
      group: 'logic',
      name: 'JSON Normalizer Resilience',
      status: 'PASS',
      detail:
        'normalizeHealthPlan and normalizeSymptomAssessment safely handled null, undefined, empty, and malformed inputs with valid defaults.',
    };
  } catch (err) {
    return {
      id: 'normalizer-resilience',
      group: 'logic',
      name: 'JSON Normalizer Resilience',
      status: 'FAIL',
      detail: `Normalizer threw on malformed input: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function runMapsUtilityCheck(): DiagnosticCheckResult {
  try {
    const zeroDist = haversineDistanceKm(23.7465, 90.376, 23.7465, 90.376);
    const dhanmondiToGulshan = haversineDistanceKm(
      23.7465,
      90.376,
      23.7925,
      90.4078
    );

    if (zeroDist !== 0 || dhanmondiToGulshan < 5.5 || dhanmondiToGulshan > 6.6) {
      return {
        id: 'maps-utility',
        group: 'logic',
        name: 'Maps Utility Verification',
        status: 'FAIL',
        detail: `Haversine out of tolerance (same-point=${zeroDist} km, Dhanmondi-Gulshan=${dhanmondiToGulshan} km).`,
      };
    }

    const emptySpecialties = SPECIALTY_OPTIONS.filter(
      (spec) => expandSpecialtyQuery(spec).trim().length === 0
    );
    if (emptySpecialties.length > 0) {
      return {
        id: 'maps-utility',
        group: 'logic',
        name: 'Maps Utility Verification',
        status: 'FAIL',
        detail: `Empty specialty query expansion for: ${emptySpecialties.join(', ')}.`,
      };
    }

    return {
      id: 'maps-utility',
      group: 'logic',
      name: 'Maps Utility Verification',
      status: 'PASS',
      detail: `Haversine verified (${dhanmondiToGulshan.toFixed(1)} km between Dhanmondi & Gulshan) and all ${SPECIALTY_OPTIONS.length}/11 specialty queries expanded cleanly.`,
    };
  } catch (err) {
    return {
      id: 'maps-utility',
      group: 'logic',
      name: 'Maps Utility Verification',
      status: 'FAIL',
      detail: `Maps utility error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function runCalendarIcsAndUrlCheck(): DiagnosticCheckResult {
  try {
    const dummyPlan = normalizeHealthPlan({
      intro: 'Test routine plan',
      morningRoutine: {
        wakeUpHabit: 'Drink warm water',
        hydrationCue: '1 glass',
        breakfastLink: 'Local breakfast',
        morningMovement: '10-minute walk',
        steps: [],
      },
      exercises: [
        {
          name: 'Brisk Walk',
          durationOrSets: '20 min',
          intensity: 'Moderate',
          guidance: 'Steady pace',
          beginnerModification: '10 min',
        },
      ],
      eveningRoutine: {
        dinnerTiming: '7:30 PM',
        recoveryHabits: 'Light stretch',
        screenWindDown: 'No screens 45 min before sleep',
        relaxationCue: 'Slow breathing',
        steps: [],
      },
      sleepAndLifestyle: {
        sleepWindow: '10:30 PM - 6:30 AM',
        sleepHygiene: ['Dim lights'],
        hydrationGuidance: '2L water',
        stressHabits: ['Deep breathing'],
      },
    });

    const blocks = buildDefaultRoutineBlocks(dummyPlan);
    const routineIcs = buildIcsContent(blocks, 'repeat-7-days');
    const routineUrl = buildGoogleCalendarTemplateUrl(blocks[0], 'tomorrow');

    const booking: AppointmentBooking = {
      id: 'diag-ics-1',
      doctor: {
        name: 'Green Valley Medical Center',
        specialty: 'Cardiologist',
        address: 'House 12, Road 8, Dhaka',
      },
      consultationType: 'in-person',
      date: '2026-12-20',
      time: '15:30',
      patientName: 'Test Patient',
      contact: 'patient@example.com',
      notes: 'Follow-up check',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    };
    const apptIcs = buildAppointmentIcs(booking);
    const apptUrl = buildAppointmentCalendarTemplateUrl(booking);

    const requiredHeaders = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART',
      'DTEND',
      'SUMMARY',
      'END:VCALENDAR',
    ];

    for (const header of requiredHeaders) {
      if (!routineIcs.includes(header) || !apptIcs.includes(header)) {
        return {
          id: 'calendar-ics-url',
          group: 'logic',
          name: 'Calendar .ics & Fallback URL Generator',
          status: 'FAIL',
          detail: `Missing required RFC 5545 header: ${header}.`,
        };
      }
    }

    const parsedRoutineUrl = new URL(routineUrl);
    const parsedApptUrl = new URL(apptUrl);
    if (
      parsedRoutineUrl.hostname !== 'calendar.google.com' ||
      parsedApptUrl.hostname !== 'calendar.google.com' ||
      parsedApptUrl.searchParams.get('action') !== 'TEMPLATE'
    ) {
      return {
        id: 'calendar-ics-url',
        group: 'logic',
        name: 'Calendar .ics & Fallback URL Generator',
        status: 'FAIL',
        detail: 'Fallback Google Calendar template URL structure is invalid.',
      };
    }

    if (
      containsEmoji(routineIcs) ||
      containsEmoji(apptIcs) ||
      containsEmoji(routineUrl) ||
      containsEmoji(apptUrl)
    ) {
      return {
        id: 'calendar-ics-url',
        group: 'logic',
        name: 'Calendar .ics & Fallback URL Generator',
        status: 'FAIL',
        detail: 'Detected disallowed Unicode emoji in generated .ics or template URL.',
      };
    }

    return {
      id: 'calendar-ics-url',
      group: 'logic',
      name: 'Calendar .ics & Fallback URL Generator',
      status: 'PASS',
      detail:
        'Routine and Appointment .ics files contain valid RFC 5545 headers, valid Google Calendar template URLs, and strictly zero emojis.',
    };
  } catch (err) {
    return {
      id: 'calendar-ics-url',
      group: 'logic',
      name: 'Calendar .ics & Fallback URL Generator',
      status: 'FAIL',
      detail: `Calendar generator error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function runPastSlotBlockingCheck(nowOverride?: Date): DiagnosticCheckResult {
  try {
    // Use a deterministic afternoon reference on today's date so morning slots are past
    // and evening slots are upcoming, plus verify tomorrow's slots are all enabled.
    const base = nowOverride ?? new Date();
    const referenceMidday = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      14,
      30,
      0,
      0
    );
    const todayIso = toIsoLocalDate(referenceMidday);
    const tomorrow = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + 1,
      12,
      0,
      0,
      0
    );
    const tomorrowIso = toIsoLocalDate(tomorrow);

    const morningSlotPast = isTimeSlotPast(todayIso, '09:30', referenceMidday);
    const afternoonPast = isTimeSlotPast(todayIso, '14:00', referenceMidday);
    const eveningSlotFuture = !isTimeSlotPast(todayIso, '19:00', referenceMidday);
    const allTomorrowEnabled = ALL_TIME_SLOTS.every(
      (slot) => !isTimeSlotPast(tomorrowIso, slot.value, referenceMidday)
    );

    if (
      !morningSlotPast ||
      !afternoonPast ||
      !eveningSlotFuture ||
      !allTomorrowEnabled
    ) {
      return {
        id: 'past-slot-blocking',
        group: 'logic',
        name: 'Past-Slot Blocking Check',
        status: 'FAIL',
        detail: `Slot guard mismatch (09:30 past=${morningSlotPast}, 14:00 past=${afternoonPast}, 19:00 future=${eveningSlotFuture}, tomorrowAllOpen=${allTomorrowEnabled}).`,
      };
    }

    return {
      id: 'past-slot-blocking',
      group: 'logic',
      name: 'Past-Slot Blocking Check',
      status: 'PASS',
      detail: `Past slots on today (${todayIso} at 14:30) are blocked while future slots and all ${ALL_TIME_SLOTS.length} slots for tomorrow (${tomorrowIso}) remain enabled.`,
    };
  } catch (err) {
    return {
      id: 'past-slot-blocking',
      group: 'logic',
      name: 'Past-Slot Blocking Check',
      status: 'FAIL',
      detail: `Past-slot check error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function runDomAndZeroEmojiCheck(): DiagnosticCheckResult {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return {
      id: 'dom-zero-emoji',
      group: 'logic',
      name: 'DOM & Zero-Emoji Scan',
      status: 'WARN',
      detail: 'DOM inspection requires a browser environment.',
    };
  }

  try {
    const bodyText = document.body.innerText || '';
    const hasEmoji = containsEmoji(bodyText);

    const hasThemeToggle = Boolean(
      document.querySelector('button[aria-label*="mode" i]')
    );
    const hasPrimaryNav = Boolean(document.querySelector('nav'));
    const hasFooter = Boolean(document.querySelector('footer'));
    const hasChatbotTrigger = Boolean(
      document.querySelector('button[aria-label*="Baymini Health Assistant" i]')
    );

    const scrollWidth = document.documentElement.scrollWidth;
    const innerWidth = window.innerWidth;
    const overflowPx = Math.max(0, scrollWidth - innerWidth);

    const issues: string[] = [];
    if (hasEmoji) issues.push('Unicode emoji found in rendered DOM text');
    if (!hasThemeToggle) issues.push('theme toggle button missing');
    if (!hasPrimaryNav) issues.push('navigation landmark missing');
    if (!hasFooter) issues.push('footer landmark missing');
    if (!hasChatbotTrigger) issues.push('floating chatbot trigger missing');
    if (overflowPx > 1) {
      issues.push(`horizontal overflow detected (${scrollWidth}px > ${innerWidth}px)`);
    }

    if (issues.length > 0) {
      return {
        id: 'dom-zero-emoji',
        group: 'logic',
        name: 'DOM & Zero-Emoji Scan',
        status: 'FAIL',
        detail: issues.join('; '),
      };
    }

    return {
      id: 'dom-zero-emoji',
      group: 'logic',
      name: 'DOM & Zero-Emoji Scan',
      status: 'PASS',
      detail: `Zero emojis in rendered DOM; theme toggle, navbar, footer, and chatbot trigger verified; zero horizontal overflow (${scrollWidth}px <= ${innerWidth}px).`,
    };
  } catch (err) {
    return {
      id: 'dom-zero-emoji',
      group: 'logic',
      name: 'DOM & Zero-Emoji Scan',
      status: 'FAIL',
      detail: `DOM scan error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function formatDiagnosticsReport(
  results: DiagnosticCheckResult[],
  generatedAt = new Date().toISOString()
): string {
  const passed = results.filter((r) => r.status === 'PASS').length;
  const warned = results.filter((r) => r.status === 'WARN').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  const lines: string[] = [
    'BAYMINI V2 DIAGNOSTICS REPORT',
    `Generated: ${generatedAt}`,
    `Summary: ${passed} PASS | ${warned} WARN | ${failed} FAIL (${results.length} total)`,
    '------------------------------------------------------------',
  ];

  for (const item of results) {
    const timing =
      typeof item.durationMs === 'number' ? ` (${Math.round(item.durationMs)} ms)` : '';
    lines.push(`[${item.status}] ${item.name}${timing}`);
    lines.push(`  ${item.detail}`);
  }

  return lines.join('\n');
}
