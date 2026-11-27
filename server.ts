import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
const FAST_GEMINI_MODEL = 'gemini-3.1-flash-lite';

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const error = new Error(
      'Gemini API key is not configured. Please check or select an API key in Settings > Secrets.'
    ) as Error & { status?: number };
    error.status = 503;
    throw error;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateStructuredJson(params: {
  contents: string;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
  preferFast?: boolean;
}): Promise<unknown> {
  const ai = getGeminiClient();
  const attempts: Array<{ model: string; thinkingLevel?: ThinkingLevel; delayMs?: number }> =
    params.preferFast
      ? [
          { model: FAST_GEMINI_MODEL },
          { model: PRIMARY_GEMINI_MODEL, thinkingLevel: ThinkingLevel.LOW, delayMs: 600 },
          { model: FAST_GEMINI_MODEL, delayMs: 1200 },
        ]
      : [
          { model: PRIMARY_GEMINI_MODEL, thinkingLevel: ThinkingLevel.LOW },
          { model: FAST_GEMINI_MODEL, delayMs: 600 },
          { model: FAST_GEMINI_MODEL, delayMs: 1200 },
        ];

  let lastError: unknown;
  for (let idx = 0; idx < attempts.length; idx++) {
    const attempt = attempts[idx];
    if (attempt.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, attempt.delayMs));
    }
    try {
      const response = await ai.models.generateContent({
        model: attempt.model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          ...(attempt.thinkingLevel
            ? { thinkingConfig: { thinkingLevel: attempt.thinkingLevel } }
            : {}),
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
        },
      });
      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('Received an empty response from Gemini.');
      }
      return JSON.parse(rawText);
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? Number((err as { status?: unknown }).status)
          : 0;
      const msg = err instanceof Error ? err.message : '';
      const isRetryable =
        status === 429 ||
        status === 503 ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('UNAVAILABLE');
      if (!isRetryable || idx === attempts.length - 1) {
        throw err;
      }
    }
  }

  throw lastError;
}

function formatGeminiError(err: unknown, fallbackMessage: string): {
  status: number;
  message: string;
} {
  const status =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 500;
  const raw = err instanceof Error ? err.message : '';

  if (
    raw.includes('GEMINI_API_KEY') ||
    raw.includes('Settings > Secrets') ||
    raw.includes('not configured')
  ) {
    return {
      status: 503,
      message:
        'Gemini API key is not configured yet. Please check Settings > Secrets and try again.',
    };
  }
  if (
    status === 503 ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('overloaded') ||
    raw.includes('high demand')
  ) {
    return {
      status: 503,
      message:
        'Gemini is temporarily experiencing high demand. Please wait a moment and try again.',
    };
  }
  if (
    status === 400 ||
    status === 403 ||
    raw.includes('API_KEY_INVALID') ||
    raw.includes('PERMISSION_DENIED')
  ) {
    return {
      status: 403,
      message:
        'Gemini API access could not be authorized. Please check your API key in Settings > Secrets.',
    };
  }
  if (status === 429 || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Gemini API quota limit reached. Please wait a moment or check your billing-enabled API key in Settings > Secrets.',
    };
  }
  return { status: 500, message: fallbackMessage };
}

function stripEmojis(text: string): string {
  return text.replace(/\p{Extended_Pictographic}/gu, '').replace(/\uFE0F/g, '').trim();
}

function deepStripEmojis<T>(value: T): T {
  if (typeof value === 'string') {
    return stripEmojis(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepStripEmojis(item)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepStripEmojis(v);
    }
    return out as T;
  }
  return value;
}

function safeString(value: unknown, maxLen = 240): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function safeStringArray(value: unknown, maxItems = 15, maxLen = 100): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function formatProfileForPrompt(rawProfile: Record<string, unknown>): string {
  const age = typeof rawProfile.age === 'number' ? rawProfile.age : 'Not specified';
  const heightCm =
    typeof rawProfile.heightCm === 'number' ? `${Math.round(rawProfile.heightCm)} cm` : 'Not specified';
  const weightKg =
    typeof rawProfile.weightKg === 'number' ? `${Math.round(rawProfile.weightKg)} kg` : 'Not specified';
  const gender = safeString(rawProfile.gender, 40) || 'Prefer not to say';
  const region = safeString(rawProfile.region, 120) || 'General';
  const activityLevel = safeString(rawProfile.activityLevel, 60) || 'Lightly Active';
  const fitnessLevel = safeString(rawProfile.fitnessLevel, 40) || 'Beginner';
  const sleepDuration = safeString(rawProfile.sleepDuration, 40) || '6-7 hrs';
  const goals = safeStringArray(rawProfile.goals);
  const primaryGoal = safeString(rawProfile.primaryGoal, 80) || goals[0] || 'Overall Health & Wellness';
  const dietType =
    safeString(rawProfile.dietType, 40) === 'Other'
      ? safeString(rawProfile.dietTypeOther, 80) || 'Other'
      : safeString(rawProfile.dietType, 40) || 'Non-Vegetarian';
  const budget = safeString(rawProfile.budget, 40) || 'Budget-Friendly';
  const medicalConditions = safeStringArray(rawProfile.medicalConditions);
  const medicalConditionsOther = safeString(rawProfile.medicalConditionsOther, 160);
  const allergies = safeString(rawProfile.allergies, 180);
  const medications = safeString(rawProfile.medications, 180);
  const injuries = safeString(rawProfile.injuries, 180);
  const foodRestrictions = safeString(rawProfile.foodRestrictions, 180);
  const preferredFoods = safeString(rawProfile.preferredFoods, 200);

  return [
    `Age: ${age}`,
    `Height: ${heightCm}`,
    `Weight: ${weightKg}`,
    `Gender: ${gender}`,
    `Country / Region: ${region}`,
    `Activity Level: ${activityLevel}`,
    `Fitness Level: ${fitnessLevel}`,
    `Average Sleep Duration: ${sleepDuration}`,
    `Primary Goal: ${primaryGoal}`,
    `All Selected Goals: ${goals.join(', ') || primaryGoal}`,
    `Diet Type: ${dietType}`,
    `Food Budget: ${budget}`,
    `Medical Conditions: ${[...medicalConditions, medicalConditionsOther].filter(Boolean).join(', ') || 'None reported'}`,
    `Allergies: ${allergies || 'None reported'}`,
    `Current Medications: ${medications || 'None reported'}`,
    `Previous Injuries: ${injuries || 'None reported'}`,
    `Food Allergies / Restrictions: ${foodRestrictions || 'None reported'}`,
    `Preferred Everyday Foods: ${preferredFoods || 'Local everyday staples'}`,
  ].join('\n');
}

const healthPlanResponseSchema = {
  type: Type.OBJECT,
  properties: {
    intro: {
      type: Type.STRING,
      description: 'Concise 2-sentence introduction tailored to the user primary goal and context. Plain text, zero emojis.',
    },
    morningRoutine: {
      type: Type.OBJECT,
      properties: {
        wakeUpHabit: { type: Type.STRING },
        hydrationCue: { type: Type.STRING },
        breakfastLink: { type: Type.STRING },
        morningMovement: { type: Type.STRING },
        steps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ['time', 'title', 'description'],
          },
        },
      },
      required: ['wakeUpHabit', 'hydrationCue', 'breakfastLink', 'morningMovement', 'steps'],
    },
    afternoonRoutine: {
      type: Type.OBJECT,
      properties: {
        middayHabits: { type: Type.STRING },
        hydrationReminder: { type: Type.STRING },
        postureBreak: { type: Type.STRING },
        energyGuidance: { type: Type.STRING },
        steps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ['time', 'title', 'description'],
          },
        },
      },
      required: ['middayHabits', 'hydrationReminder', 'postureBreak', 'energyGuidance', 'steps'],
    },
    eveningRoutine: {
      type: Type.OBJECT,
      properties: {
        dinnerTiming: { type: Type.STRING },
        recoveryHabits: { type: Type.STRING },
        screenWindDown: { type: Type.STRING },
        relaxationCue: { type: Type.STRING },
        steps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              time: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ['time', 'title', 'description'],
          },
        },
      },
      required: ['dinnerTiming', 'recoveryHabits', 'screenWindDown', 'relaxationCue', 'steps'],
    },
    meals: {
      type: Type.ARRAY,
      description: 'Exactly 4 daily meals: Breakfast, Lunch, Dinner, and Snack tailored strictly to local cuisine and budget.',
      items: {
        type: Type.OBJECT,
        properties: {
          slot: { type: Type.STRING, description: 'One of: Breakfast, Lunch, Dinner, Snack' },
          dishName: { type: Type.STRING },
          portionGuidance: { type: Type.STRING },
          nutritionEstimate: {
            type: Type.STRING,
            description: 'Explicit estimate string, e.g. "Est. ~420 kcal · 18g protein · 52g carbs"',
          },
          localAvailabilityNote: { type: Type.STRING },
          budgetSwapTip: { type: Type.STRING },
        },
        required: [
          'slot',
          'dishName',
          'portionGuidance',
          'nutritionEstimate',
          'localAvailabilityNote',
          'budgetSwapTip',
        ],
      },
    },
    shoppingList: {
      type: Type.ARRAY,
      description: 'Categorized everyday grocery items directly extracted from the generated meals (Produce, Proteins, Staples & Pantry).',
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['category', 'items'],
      },
    },
    exerciseOverview: {
      type: Type.OBJECT,
      properties: {
        weeklyRhythm: { type: Type.STRING },
        intensityGuidance: { type: Type.STRING },
        safetyAdjustments: { type: Type.STRING },
      },
      required: ['weeklyRhythm', 'intensityGuidance', 'safetyAdjustments'],
    },
    exercises: {
      type: Type.ARRAY,
      description: '4 to 5 practical, injury-safe exercises matching fitness level and goals.',
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          durationOrSets: { type: Type.STRING },
          intensity: { type: Type.STRING, description: 'One of: Gentle, Moderate, Steady' },
          guidance: { type: Type.STRING },
          beginnerModification: { type: Type.STRING },
        },
        required: ['name', 'durationOrSets', 'intensity', 'guidance', 'beginnerModification'],
      },
    },
    sleepAndLifestyle: {
      type: Type.OBJECT,
      properties: {
        sleepWindow: { type: Type.STRING },
        sleepHygiene: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        hydrationGuidance: { type: Type.STRING },
        stressHabits: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ['sleepWindow', 'sleepHygiene', 'hydrationGuidance', 'stressHabits'],
    },
  },
  required: [
    'intro',
    'morningRoutine',
    'afternoonRoutine',
    'eveningRoutine',
    'meals',
    'shoppingList',
    'exerciseOverview',
    'exercises',
    'sleepAndLifestyle',
  ],
};

const singleMealSchema = {
  type: Type.OBJECT,
  properties: {
    slot: { type: Type.STRING },
    dishName: { type: Type.STRING },
    portionGuidance: { type: Type.STRING },
    nutritionEstimate: { type: Type.STRING },
    localAvailabilityNote: { type: Type.STRING },
    budgetSwapTip: { type: Type.STRING },
  },
  required: [
    'slot',
    'dishName',
    'portionGuidance',
    'nutritionEstimate',
    'localAvailabilityNote',
    'budgetSwapTip',
  ],
};

const singleExerciseSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    durationOrSets: { type: Type.STRING },
    intensity: { type: Type.STRING },
    guidance: { type: Type.STRING },
    beginnerModification: { type: Type.STRING },
  },
  required: ['name', 'durationOrSets', 'intensity', 'guidance', 'beginnerModification'],
};

function createApp() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/diagnostics/status', (_req, res) => {
    const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
    const geminiConfigured = Boolean(geminiKey && geminiKey !== 'MY_GEMINI_API_KEY');
    const mapsKey = (
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      ''
    ).trim();
    const mapsConfigured = Boolean(mapsKey && mapsKey !== 'MY_GOOGLE_MAPS_API_KEY');
    res.json({
      ok: true,
      geminiConfigured,
      mapsConfigured,
    });
  });

  app.post('/api/diagnostics/gemini-smoke', async (_req, res) => {
    try {
      const smokeSchema = {
        type: Type.OBJECT,
        properties: {
          status: { type: Type.STRING, description: 'Return "ok".' },
          message: {
            type: Type.STRING,
            description: 'One short plain-text wellness confirmation sentence with zero emojis.',
          },
        },
        required: ['status', 'message'],
      };

      const parsed = await generateStructuredJson({
        contents: 'Return status "ok" and a 6-word calm wellness greeting with zero emojis.',
        systemInstruction:
          'Return valid JSON matching the schema. Strictly zero emojis anywhere.',
        responseSchema: smokeSchema,
        preferFast: true,
      });

      res.json({ result: deepStripEmojis(parsed) });
    } catch (err: unknown) {
      const formatted = formatGeminiError(
        err,
        'Gemini smoke test failed right now.'
      );
      console.error('Error in Gemini smoke test:', err instanceof Error ? err.message : err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/health-plan/generate', async (req, res) => {
    try {
      const profile = req.body?.profile;
      if (!profile || typeof profile !== 'object') {
        res.status(400).json({ error: 'A valid health profile is required.' });
        return;
      }

      const age = Number(profile.age);
      const region = safeString(profile.region, 120);
      const goals = safeStringArray(profile.goals);
      if (!Number.isFinite(age) || age < 13 || age > 110 || !region || goals.length === 0) {
        res.status(400).json({
          error: 'Please provide a valid age, country or region, and at least one health goal.',
        });
        return;
      }

      const profileSummary = formatProfileForPrompt(profile as Record<string, unknown>);

      const parsed = await generateStructuredJson({
        contents: `Create a realistic, calm, practical daily personal wellness plan for the following user profile:\n\n${profileSummary}`,
        systemInstruction: [
          'You are Baymini, a calm, evidence-informed personal wellness planner.',
          'STRICT RULES:',
          '1. Use strictly ZERO emojis anywhere in your response.',
          '2. Local food personalization is critical: tailor all 4 meals (Breakfast, Lunch, Dinner, Snack) strictly to the user Country/Region and Food Budget using affordable, everyday local ingredients. For example, for a budget user in Bangladesh, prioritize local staples such as steamed rice, masoor dal, eggs, local fish (rui, pangash, tilapia), seasonal leafy greens, chira, peanuts, banana, and guava instead of expensive imported foods.',
          '3. Respect ALL listed medical conditions, allergies, food restrictions, medications, and previous injuries. Never suggest unsafe high-impact moves when joint/back injuries or medical conditions apply.',
          '4. Never claim to diagnose, treat, or cure any medical condition. Never recommend extreme diets or unverified supplements.',
          '5. Explicitly label all calorie and macronutrient figures as estimates starting with "Est. ~" (e.g., "Est. ~420 kcal · 18g protein · 52g carbs").',
          '6. Build shoppingList with 3 clear categories (Produce, Proteins, Staples & Pantry) containing practical everyday ingredients extracted directly from the 4 generated meals.',
          '7. Keep copy concise, calm, practical, and easy to scan.',
        ].join('\n'),
        responseSchema: healthPlanResponseSchema,
      });

      res.json({ plan: deepStripEmojis(parsed) });
    } catch (err: unknown) {
      const formatted = formatGeminiError(
        err,
        'We could not generate your health plan right now. Please try again in a moment.'
      );
      console.error('Error generating health plan:', err instanceof Error ? err.message : err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/health-plan/swap-meal', async (req, res) => {
    try {
      const profile = req.body?.profile;
      const currentMeal = req.body?.currentMeal;
      const reason = safeString(req.body?.reason, 120) || 'Different balanced local option';

      if (!profile || typeof profile !== 'object' || !currentMeal || typeof currentMeal !== 'object') {
        res.status(400).json({ error: 'Profile and current meal details are required.' });
        return;
      }

      const slot = safeString(currentMeal.slot, 30) || 'Breakfast';
      const dishName = safeString(currentMeal.dishName, 140);

      const profileSummary = formatProfileForPrompt(profile as Record<string, unknown>);

      const parsed = await generateStructuredJson({
        contents: [
          `User Profile:\n${profileSummary}`,
          `\nCurrent ${slot} to replace: "${dishName}"`,
          `Swap preference: "${reason}"`,
          `\nGenerate ONE fresh replacement ${slot} that is clearly different from "${dishName}", fits the exact region, diet type, allergies, and food budget, and follows all safety rules.`,
        ].join('\n'),
        systemInstruction: [
          'You are Baymini, a calm personal wellness meal planner.',
          'STRICT RULES:',
          '1. Return strictly ONE meal replacement JSON object for the requested meal slot.',
          '2. Strictly ZERO emojis anywhere.',
          '3. Use everyday affordable local ingredients authentic to the user Country/Region and Food Budget.',
          '4. Strictly avoid all listed allergies, food restrictions, and medical contraindications.',
          '5. Format nutritionEstimate starting with "Est. ~" (e.g., "Est. ~390 kcal · 16g protein · 48g carbs").',
        ].join('\n'),
        responseSchema: singleMealSchema,
      });

      res.json({ meal: deepStripEmojis(parsed) });
    } catch (err: unknown) {
      const formatted = formatGeminiError(
        err,
        'Could not swap this meal right now. Please try again.'
      );
      console.error('Error swapping meal:', err instanceof Error ? err.message : err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/health-plan/swap-exercise', async (req, res) => {
    try {
      const profile = req.body?.profile;
      const currentExercise = req.body?.currentExercise;
      const reason = safeString(req.body?.reason, 120) || 'Injury-safe alternative';

      if (
        !profile ||
        typeof profile !== 'object' ||
        !currentExercise ||
        typeof currentExercise !== 'object'
      ) {
        res.status(400).json({ error: 'Profile and current exercise details are required.' });
        return;
      }

      const currentName = safeString(currentExercise.name, 140);
      const profileSummary = formatProfileForPrompt(profile as Record<string, unknown>);

      const parsed = await generateStructuredJson({
        contents: [
          `User Profile:\n${profileSummary}`,
          `\nCurrent exercise to replace: "${currentName}"`,
          `Swap preference: "${reason}"`,
          `\nGenerate ONE fresh replacement exercise that is clearly different from "${currentName}", safe for any listed injuries or medical conditions, and appropriate for the user fitness level.`,
        ].join('\n'),
        systemInstruction: [
          'You are Baymini, a calm, safety-first personal fitness planner.',
          'STRICT RULES:',
          '1. Return strictly ONE replacement exercise JSON object.',
          '2. Strictly ZERO emojis anywhere.',
          '3. Respect all listed injuries, medical conditions, and fitness level.',
          '4. Always include a practical beginnerModification.',
          '5. Set intensity to one of: Gentle, Moderate, or Steady.',
        ].join('\n'),
        responseSchema: singleExerciseSchema,
      });

      res.json({ exercise: deepStripEmojis(parsed) });
    } catch (err: unknown) {
      const formatted = formatGeminiError(
        err,
        'Could not swap this exercise right now. Please try again.'
      );
      console.error('Error swapping exercise:', err instanceof Error ? err.message : err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const symptomQuestionsSchema = {
    type: Type.OBJECT,
    properties: {
      isEmergency: {
        type: Type.BOOLEAN,
        description:
          'Set to true ONLY if the user symptoms or notes in any language indicate an acute medical emergency requiring immediate emergency care.',
      },
      emergencyReason: {
        type: Type.STRING,
        description: 'Brief plain-text explanation populated only when isEmergency is true; empty string otherwise.',
      },
      questions: {
        type: Type.ARRAY,
        description: '4 to 6 targeted clinical follow-up questions when isEmergency is false.',
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            question: { type: Type.STRING },
            type: {
              type: Type.STRING,
              description: 'One of: single, multi, text',
            },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 to 5 concise answer choices for single or multi; empty array for text.',
            },
          },
          required: ['id', 'question', 'type', 'options'],
        },
      },
    },
    required: ['isEmergency', 'emergencyReason', 'questions'],
  };

  const symptomAssessmentSchema = {
    type: Type.OBJECT,
    properties: {
      urgencyLevel: {
        type: Type.STRING,
        description: 'One of: emergency, prompt, routine, self-care',
      },
      urgencyTitle: { type: Type.STRING },
      urgencySummary: { type: Type.STRING },
      possibleExplanations: {
        type: Type.ARRAY,
        description: '2 to 4 cautious, non-diagnostic possibilities.',
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ['title', 'explanation'],
        },
      },
      selfCareGuidance: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      warningSigns: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      doctorQuestions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      recommendedSpecialty: {
        type: Type.STRING,
        description:
          'Exactly one of: General Physician, Cardiologist, Dermatologist, Pulmonologist, Gastroenterologist, ENT Specialist, Orthopedic, Neurologist, Pediatrician, Emergency Hospital',
      },
      specialtyReason: { type: Type.STRING },
      briefSummaryForDoctor: {
        type: Type.STRING,
        description: 'Clean 2 to 3 sentence plain-English clinical summary of symptoms, timeline, severity, and relevant context.',
      },
    },
    required: [
      'urgencyLevel',
      'urgencyTitle',
      'urgencySummary',
      'possibleExplanations',
      'selfCareGuidance',
      'warningSigns',
      'doctorQuestions',
      'recommendedSpecialty',
      'specialtyReason',
      'briefSummaryForDoctor',
    ],
  };

  const chatbotResponseSchema = {
    type: Type.OBJECT,
    properties: {
      reply: {
        type: Type.STRING,
        description: 'Concise, warm plain-text health response in the user language. Strictly zero emojis.',
      },
      isEmergency: {
        type: Type.BOOLEAN,
        description: 'True only if the user describes acute life-threatening or emergency symptoms.',
      },
      suggestedActions: {
        type: Type.ARRAY,
        description: '0 to 2 optional navigation chips.',
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            targetView: {
              type: Type.STRING,
              description: 'One of: health-plan, symptoms, doctors',
            },
            specialtyHint: {
              type: Type.STRING,
              description: 'Optional medical specialty when targetView is doctors, otherwise empty string.',
            },
          },
          required: ['label', 'targetView', 'specialtyHint'],
        },
      },
    },
    required: ['reply', 'isEmergency', 'suggestedActions'],
  };

  app.post('/api/symptoms/questions', async (req, res) => {
    try {
      const selectedSymptoms = safeStringArray(req.body?.selectedSymptoms, 20, 60);
      const customNotes = safeString(req.body?.customNotes, 800);
      const profileContext = safeString(req.body?.profileContext, 600);

      if (selectedSymptoms.length === 0 && !customNotes) {
        res.status(400).json({
          error: 'Please select at least one symptom or describe how you feel.',
        });
        return;
      }

      const promptParts = [
        `Selected symptoms: ${selectedSymptoms.join(', ') || 'None selected from checklist'}`,
        `User description / notes: ${customNotes || 'None provided'}`,
      ];
      if (profileContext) {
        promptParts.push(`Relevant Health Profile context (user opted in):\n${profileContext}`);
      } else {
        promptParts.push('Health Profile context: Not included.');
      }

      const parsed = await generateStructuredJson({
        contents: `${promptParts.join('\n\n')}\n\nEvaluate for acute emergency first. If not an emergency, generate 4 to 6 concise, targeted clinical follow-up questions.`,
        systemInstruction: [
          'You are Baymini, a calm, safety-first health triage guide.',
          'STRICT RULES:',
          '1. Strictly ZERO emojis anywhere in your response.',
          '2. LAYER 3 EMERGENCY OVERRIDE: If the symptoms or free-text notes (in ANY language, including English, Bengali, or romanized Bengali) describe an acute life-threatening emergency (such as crushing chest pain, severe shortness of breath, stroke signs, severe bleeding, unconsciousness, anaphylaxis, overdose, or self-harm), immediately set isEmergency: true, provide a clear calm emergencyReason, and return an empty questions array.',
          '3. Otherwise set isEmergency: false, emergencyReason: "", and return 4 to 6 targeted follow-up questions covering duration, severity, progression, triggers, or key red-flag rule-outs.',
          '4. Mix question types cleanly: use mostly "single" (2-5 short options) and "multi" (3-5 short options), and at most 1 "text" question (options: []).',
          '5. Never diagnose or prescribe. Keep wording calm, empathetic, and easy to scan.',
        ].join('\n'),
        responseSchema: symptomQuestionsSchema,
      });

      res.json({ result: deepStripEmojis(parsed) });
    } catch (err: unknown) {
      const formatted = formatGeminiError(
        err,
        'We could not generate follow-up questions right now. Please try again.'
      );
      console.error('Error generating symptom questions:', err instanceof Error ? err.message : err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/symptoms/assess', async (req, res) => {
    try {
      const selectedSymptoms = safeStringArray(req.body?.selectedSymptoms, 20, 60);
      const customNotes = safeString(req.body?.customNotes, 800);
      const profileContext = safeString(req.body?.profileContext, 600);
      const rawQA = Array.isArray(req.body?.followUpQA) ? req.body.followUpQA : [];
      const followUpQA: Array<{ question: string; answer: string }> = rawQA
        .filter(
          (item: unknown): item is { question: string; answer: string } =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as Record<string, unknown>).question === 'string' &&
            typeof (item as Record<string, unknown>).answer === 'string'
        )
        .map((item: { question: string; answer: string }) => ({
          question: safeString(item.question, 220),
          answer: safeString(item.answer, 320),
        }))
        .filter((item: { question: string; answer: string }) => item.question && item.answer)
        .slice(0, 10);

      if (selectedSymptoms.length === 0 && !customNotes) {
        res.status(400).json({
          error: 'Symptom details are required before generating guidance.',
        });
        return;
      }

      const qaText =
        followUpQA.length > 0
          ? followUpQA.map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n')
          : 'No follow-up answers provided.';

      const promptParts = [
        `Selected symptoms: ${selectedSymptoms.join(', ') || 'Described in notes'}`,
        `User notes: ${customNotes || 'None provided'}`,
        `Follow-up Q&A:\n${qaText}`,
      ];
      if (profileContext) {
        promptParts.push(`Relevant Health Profile context (user opted in):\n${profileContext}`);
      } else {
        promptParts.push('Health Profile context: Not included.');
      }

      const parsed = await generateStructuredJson({
        contents: `${promptParts.join('\n\n')}\n\nProvide structured, cautious, safety-first wellness triage guidance and a specialist recommendation.`,
        systemInstruction: [
          'You are Baymini, a calm, safety-first personal health guidance assistant.',
          'STRICT RULES:',
          '1. Strictly ZERO emojis anywhere in your response.',
          '2. Never diagnose any condition or prescribe medications. Always use cautious, non-diagnostic language in possibleExplanations (e.g., "may be associated with", "can sometimes relate to").',
          '3. LAYER 3 EMERGENCY OVERRIDE: If any reported symptom, note (in any language), or follow-up answer indicates a medical emergency, set urgencyLevel to "emergency" and recommendedSpecialty to "Emergency Hospital".',
          '4. Choose urgencyLevel strictly from: "emergency", "prompt", "routine", or "self-care".',
          '5. Choose recommendedSpecialty strictly from: "General Physician", "Cardiologist", "Dermatologist", "Pulmonologist", "Gastroenterologist", "ENT Specialist", "Orthopedic", "Neurologist", "Pediatrician", or "Emergency Hospital".',
          '6. Provide 2-4 possibleExplanations, 3-5 practical low-risk selfCareGuidance steps, 3-5 specific warningSigns requiring urgent care, 3-4 helpful doctorQuestions, a 1-sentence specialtyReason, and a crisp 2-3 sentence plain-English briefSummaryForDoctor suitable to share with a clinician.',
          '7. Respect any allergies, medications, or medical conditions provided in the Health Profile context.',
        ].join('\n'),
        responseSchema: symptomAssessmentSchema,
      });

      res.json({ assessment: deepStripEmojis(parsed) });
    } catch (err: unknown) {
      const formatted = formatGeminiError(
        err,
        'We could not complete your symptom guidance right now. Please try again.'
      );
      console.error('Error assessing symptoms:', err instanceof Error ? err.message : err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const message = safeString(req.body?.message, 1200);
      if (!message) {
        res.status(400).json({ error: 'Please enter a health or wellness question.' });
        return;
      }

      const sessionContext = safeString(req.body?.sessionContext, 1800);
      const activeView = safeString(req.body?.activeView, 40) || 'home';
      const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
      const history: Array<{ role: string; content: string }> = rawHistory
        .filter(
          (item: unknown): item is { role: string; content: string } =>
            typeof item === 'object' &&
            item !== null &&
            ((item as Record<string, unknown>).role === 'user' ||
              (item as Record<string, unknown>).role === 'assistant') &&
            typeof (item as Record<string, unknown>).content === 'string'
        )
        .slice(-8)
        .map((item: { role: string; content: string }) => ({
          role: item.role,
          content: safeString(item.content, 500),
        }));

      const historyBlock =
        history.length > 0
          ? history
              .map((h) => `${h.role === 'user' ? 'User' : 'Baymini'}: ${h.content}`)
              .join('\n')
          : 'No prior messages.';

      const contents = [
        `Current page: ${activeView}`,
        sessionContext
          ? `User Session Context:\n${sessionContext}`
          : 'User Session Context: No saved health plan, symptom check, or bookings yet.',
        `Recent Conversation:\n${historyBlock}`,
        `Latest User Message:\n${message}`,
      ].join('\n\n');

      const systemInstruction = [
        'You are the Baymini Health Assistant — a warm, concise, evidence-informed personal wellness guide.',
        'STRICT RULES:',
        '1. Strictly ZERO emojis anywhere in your reply or action labels.',
        '2. MULTILINGUAL: Always reply naturally in the exact same language or script the user writes in (for example, English, Bengali script, or romanized Bengali/Banglish). Keep suggestedActions labels short and clear.',
        '3. STRICT HEALTH SCOPE: Only answer personal health, nutrition, exercise, sleep, stress, wellness, or symptom navigation questions. If the user asks about unrelated topics (coding, homework, movies, trivia, politics, general chat), politely decline in 1-2 sentences and invite a health or wellness question instead.',
        '4. SAFETY: Never diagnose medical conditions, never prescribe medications, and never recommend extreme diets.',
        '5. EMERGENCY PRIORITY: If the user mentions acute emergency symptoms (chest pain, difficulty breathing, stroke signs, severe bleeding, fainting, anaphylaxis, overdose, or self-harm) in any language, set isEmergency: true, advise immediate local emergency care right away, and include a suggestedAction { label: "Find Emergency Hospitals", targetView: "doctors", specialtyHint: "Emergency Hospital" }.',
        '6. CONTEXT AWARENESS: Use the User Session Context naturally when relevant (e.g., reference their saved meals, goals, symptom specialty, or upcoming bookings).',
        '7. ACTIONABLE CHIPS: Include 0 to 2 concise suggestedActions ONLY when genuinely helpful (targetView must be "health-plan", "symptoms", or "doctors"; set specialtyHint only when targetView is "doctors", else "").',
        '8. Keep replies concise (around 2-5 short sentences or brief bullet points) and easy to read in a compact chat drawer.',
      ].join('\n');

      let parsed: unknown;
      try {
        parsed = await generateStructuredJson({
          contents,
          systemInstruction,
          responseSchema: chatbotResponseSchema,
          preferFast: true,
        });
      } catch (innerErr: unknown) {
        // Fallback if JSON.parse failed on an otherwise valid model text reply
        if (innerErr instanceof SyntaxError) {
          const ai = getGeminiClient();
          const fallbackResp = await ai.models.generateContent({
            model: FAST_GEMINI_MODEL,
            contents,
            config: { systemInstruction },
          });
          parsed = {
            reply: stripEmojis((fallbackResp.text ?? '').trim()),
            isEmergency: false,
            suggestedActions: [],
          };
        } else {
          throw innerErr;
        }
      }

      res.json({ result: deepStripEmojis(parsed) });
    } catch (err: unknown) {
      const formatted = formatGeminiError(
        err,
        'I could not send a reply right now. Please try again.'
      );
      console.error('Error in health chat:', err instanceof Error ? err.message : err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // -----------------------------------------------------------------
  // Google Maps Platform Server-Side Routes (Geocoding & Places New)
  // -----------------------------------------------------------------
  const MAPS_SOLUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';
  const PLACES_FIELD_MASK = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.rating',
    'places.userRatingCount',
    'places.nationalPhoneNumber',
    'places.internationalPhoneNumber',
    'places.websiteUri',
    'places.currentOpeningHours.openNow',
    'places.primaryTypeDisplayName',
  ].join(',');

  function getMapsApiKey(): string {
    const raw =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      '';
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'MY_GOOGLE_MAPS_API_KEY') {
      return '';
    }
    return trimmed;
  }

  function serverHaversineKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  function expandServerSpecialtyQuery(specialty: string): string {
    const lowered = specialty.trim().toLowerCase();
    if (!lowered || lowered === 'all clinics') {
      return 'medical clinic OR hospital OR doctor chamber';
    }
    if (lowered.includes('emergency')) {
      return 'emergency hospital OR 24 hour emergency room';
    }
    if (lowered.includes('cardio')) {
      return 'cardiologist OR heart hospital OR cardiac clinic';
    }
    if (lowered.includes('derma')) {
      return 'dermatologist OR skin clinic';
    }
    if (lowered.includes('pulmo')) {
      return 'pulmonologist OR chest specialist OR respiratory clinic';
    }
    if (lowered.includes('gastro')) {
      return 'gastroenterologist OR gastro clinic OR digestive clinic';
    }
    if (lowered.includes('ent')) {
      return 'ENT specialist OR ear nose throat clinic';
    }
    if (lowered.includes('ortho')) {
      return 'orthopedic clinic OR bone and joint hospital';
    }
    if (lowered.includes('neuro')) {
      return 'neurologist OR neurology clinic';
    }
    if (lowered.includes('pediat')) {
      return 'pediatrician OR children hospital OR child clinic';
    }
    if (lowered.includes('general')) {
      return 'general physician OR family medicine clinic OR medical clinic';
    }
    return `${specialty.trim()} clinic OR hospital`;
  }

  interface RawGooglePlace {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    currentOpeningHours?: { openNow?: boolean };
    primaryTypeDisplayName?: { text?: string };
  }

  function mapGooglePlaceToDoctor(
    place: RawGooglePlace,
    originLat: number,
    originLng: number,
    fallbackSpecialty: string
  ) {
    const name = stripEmojis(place.displayName?.text || '').trim();
    const address = stripEmojis(place.formattedAddress || '').trim();
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    if (!name || typeof lat !== 'number' || typeof lng !== 'number') {
      return null;
    }

    const phone = stripEmojis(
      place.internationalPhoneNumber || place.nationalPhoneNumber || ''
    ).trim();
    const rawWebsite = (place.websiteUri || '').trim();
    const website =
      rawWebsite.startsWith('https://') || rawWebsite.startsWith('http://')
        ? rawWebsite
        : undefined;
    const primaryType = stripEmojis(
      place.primaryTypeDisplayName?.text || ''
    ).trim();
    const specialtyLabel =
      fallbackSpecialty && fallbackSpecialty !== 'All Clinics'
        ? fallbackSpecialty
        : primaryType || 'Medical Clinic';

    return {
      id: place.id || `${lat.toFixed(5)},${lng.toFixed(5)}`,
      name,
      specialty: specialtyLabel,
      address: address || 'Address available in Google Maps',
      lat,
      lng,
      distanceKm: serverHaversineKm(originLat, originLng, lat, lng),
      ...(typeof place.rating === 'number' ? { rating: place.rating } : {}),
      ...(typeof place.userRatingCount === 'number'
        ? { reviewCount: place.userRatingCount }
        : {}),
      ...(phone ? { phone } : {}),
      ...(website ? { website } : {}),
      ...(typeof place.currentOpeningHours?.openNow === 'boolean'
        ? { isOpen: place.currentOpeningHours.openNow }
        : {}),
    };
  }

  async function runPlacesTextSearch(params: {
    apiKey: string;
    textQuery: string;
    lat: number;
    lng: number;
    radiusMeters: number;
  }): Promise<{ places: RawGooglePlace[]; quotaExceeded?: boolean; error?: string }> {
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': params.apiKey,
          'X-Goog-FieldMask': PLACES_FIELD_MASK,
          'X-Goog-Maps-Solution-ID': MAPS_SOLUTION_ID,
        },
        body: JSON.stringify({
          textQuery: params.textQuery,
          pageSize: 15,
          locationBias: {
            circle: {
              center: {
                latitude: params.lat,
                longitude: params.lng,
              },
              radius: Math.min(50000, Math.max(500, params.radiusMeters)),
            },
          },
        }),
      }
    );

    const payload = (await response.json().catch(() => ({}))) as {
      places?: RawGooglePlace[];
      error?: { status?: string; message?: string; code?: number };
    };

    const errorStatus = payload.error?.status || '';
    const errorMsg = payload.error?.message || '';
    if (
      response.status === 429 ||
      errorStatus === 'RESOURCE_EXHAUSTED' ||
      errorMsg.toLowerCase().includes('quota')
    ) {
      return {
        places: [],
        quotaExceeded: true,
        error: 'Google Maps daily quota limit reached.',
      };
    }

    if (!response.ok) {
      return {
        places: [],
        error:
          errorMsg || `Places search returned status ${response.status}.`,
      };
    }

    return { places: Array.isArray(payload.places) ? payload.places : [] };
  }

  app.get('/api/maps/config', (_req, res) => {
    const apiKey = getMapsApiKey();
    res.json({
      configured: Boolean(apiKey),
      apiKey,
    });
  });

  app.post('/api/maps/geocode', async (req, res) => {
    try {
      const apiKey = getMapsApiKey();
      if (!apiKey) {
        res.status(503).json({
          error: 'Google Maps API key is not configured yet.',
        });
        return;
      }

      const query = safeString(req.body?.query, 160);
      if (query.length < 2) {
        res.status(400).json({
          error: 'Please enter an area, neighborhood, or city name.',
        });
        return;
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      const data = (await response.json().catch(() => ({}))) as {
        status?: string;
        error_message?: string;
        results?: Array<{
          formatted_address?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        }>;
      };

      if (
        response.status === 429 ||
        data.status === 'OVER_QUERY_LIMIT' ||
        data.status === 'OVER_DAILY_LIMIT'
      ) {
        res.status(429).json({
          error: 'Google Maps geocoding quota exceeded.',
          quotaExceeded: true,
        });
        return;
      }

      if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
        res.json({ found: false, location: null });
        return;
      }

      if (data.status !== 'OK') {
        res.status(502).json({
          error:
            data.error_message ||
            'Could not look up that location right now. Please try another area name.',
        });
        return;
      }

      const top = data.results[0];
      const lat = top.geometry?.location?.lat;
      const lng = top.geometry?.location?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        res.json({ found: false, location: null });
        return;
      }

      res.json({
        found: true,
        location: {
          lat,
          lng,
          label: stripEmojis(top.formatted_address || query).trim(),
        },
      });
    } catch (err: unknown) {
      console.error('Error geocoding address:', err instanceof Error ? err.message : err);
      res.status(500).json({
        error: 'Unable to look up that location right now. Please try again.',
      });
    }
  });

  app.post('/api/maps/reverse-geocode', async (req, res) => {
    try {
      const apiKey = getMapsApiKey();
      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        res.status(400).json({ error: 'Valid latitude and longitude are required.' });
        return;
      }

      if (!apiKey) {
        res.json({ label: 'Current Location' });
        return;
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url);
      const data = (await response.json().catch(() => ({}))) as {
        status?: string;
        results?: Array<{
          formatted_address?: string;
          address_components?: Array<{
            long_name?: string;
            types?: string[];
          }>;
        }>;
      };

      if (
        response.status === 429 ||
        data.status === 'OVER_QUERY_LIMIT' ||
        data.status === 'OVER_DAILY_LIMIT'
      ) {
        res.status(429).json({
          error: 'Google Maps geocoding quota exceeded.',
          quotaExceeded: true,
        });
        return;
      }

      const first = data.results?.[0];
      let label = 'Current Location';
      if (first?.address_components?.length) {
        const findPart = (types: string[]) =>
          first.address_components?.find((c) =>
            types.some((t) => c.types?.includes(t))
          )?.long_name;
        const area =
          findPart(['sublocality_level_1', 'sublocality', 'neighborhood']) || '';
        const city =
          findPart(['locality', 'administrative_area_level_2']) || '';
        const country = findPart(['country']) || '';
        const parts = [area, city, country].filter(Boolean);
        if (parts.length > 0) {
          label = Array.from(new Set(parts)).join(', ');
        } else if (first.formatted_address) {
          label = first.formatted_address;
        }
      } else if (first?.formatted_address) {
        label = first.formatted_address;
      }

      res.json({ label: stripEmojis(label).trim() || 'Current Location' });
    } catch (err: unknown) {
      console.error('Error reverse geocoding:', err instanceof Error ? err.message : err);
      res.json({ label: 'Current Location' });
    }
  });

  app.post('/api/maps/search-places', async (req, res) => {
    try {
      const apiKey = getMapsApiKey();
      if (!apiKey) {
        res.status(503).json({
          error: 'Google Maps API key is not configured yet.',
        });
        return;
      }

      const lat = Number(req.body?.lat);
      const lng = Number(req.body?.lng);
      const radiusKmRaw = Number(req.body?.radiusKm);
      const radiusKm =
        Number.isFinite(radiusKmRaw) && radiusKmRaw >= 1 && radiusKmRaw <= 25
          ? radiusKmRaw
          : 5;
      const specialty = safeString(req.body?.specialty, 80) || 'All Clinics';

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        res.status(400).json({ error: 'Valid search coordinates are required.' });
        return;
      }

      const radiusMeters = radiusKm * 1000;
      const primaryQuery = expandServerSpecialtyQuery(specialty);

      const primaryResult = await runPlacesTextSearch({
        apiKey,
        textQuery: primaryQuery,
        lat,
        lng,
        radiusMeters,
      });

      if (primaryResult.quotaExceeded) {
        res.status(429).json({
          error: primaryResult.error || 'Google Maps quota exceeded.',
          quotaExceeded: true,
        });
        return;
      }

      if (primaryResult.error) {
        res.status(502).json({ error: primaryResult.error });
        return;
      }

      const seenIds = new Set<string>();
      const primaryMapped = primaryResult.places
        .map((p) => mapGooglePlaceToDoctor(p, lat, lng, specialty))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .filter((item) => {
          if (seenIds.has(item.id)) return false;
          seenIds.add(item.id);
          return true;
        });

      const withinRadiusPrimary = primaryMapped.filter(
        (d) => (d.distanceKm ?? Infinity) <= radiusKm + 0.5
      );

      let combined = primaryMapped;
      let broadened = false;

      // Automatic Graceful Broadening: if fewer than 3 matches within radius for a specialty,
      // run ONE fallback broader medical clinic / hospital search around the same coordinates.
      if (
        withinRadiusPrimary.length < 3 &&
        specialty !== 'All Clinics'
      ) {
        const fallbackResult = await runPlacesTextSearch({
          apiKey,
          textQuery: 'medical clinic OR hospital',
          lat,
          lng,
          radiusMeters,
        });

        if (fallbackResult.quotaExceeded) {
          res.status(429).json({
            error: fallbackResult.error || 'Google Maps quota exceeded.',
            quotaExceeded: true,
          });
          return;
        }

        if (!fallbackResult.error && fallbackResult.places.length > 0) {
          const fallbackMapped = fallbackResult.places
            .map((p) => mapGooglePlaceToDoctor(p, lat, lng, 'All Clinics'))
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .filter((item) => {
              if (seenIds.has(item.id)) return false;
              seenIds.add(item.id);
              return true;
            });

          if (fallbackMapped.length > 0) {
            broadened = true;
            combined = [...primaryMapped, ...fallbackMapped];
          }
        }
      }

      // Filter strictly to reasonable bounds around radius (up to 1.5x radius for edge clinics,
      // prioritizing within-radius clinics first, sorted by distance ascending)
      const maxAllowableKm = Math.max(radiusKm * 1.5, radiusKm + 2);
      const filtered = combined
        .filter((d) => (d.distanceKm ?? Infinity) <= maxAllowableKm)
        .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
        .slice(0, 15);

      res.json({
        doctors: filtered,
        broadened,
        specialtySearched: specialty,
      });
    } catch (err: unknown) {
      console.error('Error searching places:', err instanceof Error ? err.message : err);
      res.status(500).json({
        error: 'Unable to load nearby clinics right now. Please try again.',
      });
    }
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Baymini server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Baymini server:', err);
  process.exit(1);
});
