import type { ActiveView, ChatMessage } from '../types/baymini';
import {
  normalizeChatResponse,
  type NormalizedChatReply,
} from '../utils/chatbot';

export async function sendChatMessageRequest(params: {
  message: string;
  history: ChatMessage[];
  sessionContext: string;
  activeView: ActiveView;
  clientEmergencyFlag: boolean;
}): Promise<NormalizedChatReply> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
      history: params.history.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      sessionContext: params.sessionContext,
      activeView: params.activeView,
    }),
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const msg =
      typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : 'I could not send a reply right now. Please try again.';
    throw new Error(msg);
  }

  return normalizeChatResponse(data.result, params.clientEmergencyFlag);
}
