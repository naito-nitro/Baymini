import type { SymptomAssessment, SymptomFollowUpQA } from '../types/baymini';
import {
  normalizeFollowUpResponse,
  normalizeSymptomAssessment,
  type NormalizedFollowUpResponse,
} from '../utils/symptoms';

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON error response
  }
  if (!response.ok) {
    const msg =
      typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : 'Unable to reach Baymini AI right now. Please try again.';
    throw new Error(msg);
  }
  return data;
}

export async function fetchSymptomQuestions(params: {
  selectedSymptoms: string[];
  customNotes: string;
  profileContext: string;
}): Promise<NormalizedFollowUpResponse> {
  const response = await fetch('/api/symptoms/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await parseJsonResponse(response);
  return normalizeFollowUpResponse(data.result);
}

export async function fetchSymptomAssessment(params: {
  selectedSymptoms: string[];
  customNotes: string;
  followUpQA: SymptomFollowUpQA[];
  profileContext: string;
  factoredProfileSummary: string[];
}): Promise<SymptomAssessment> {
  const response = await fetch('/api/symptoms/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selectedSymptoms: params.selectedSymptoms,
      customNotes: params.customNotes,
      followUpQA: params.followUpQA,
      profileContext: params.profileContext,
    }),
  });
  const data = await parseJsonResponse(response);
  return normalizeSymptomAssessment(data.assessment, {
    selectedSymptoms: params.selectedSymptoms,
    customNotes: params.customNotes,
    followUpQA: params.followUpQA,
    factoredProfileSummary: params.factoredProfileSummary,
  });
}
