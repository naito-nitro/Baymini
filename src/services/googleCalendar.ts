import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type Auth,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { GOOGLE_CALENDAR_SCOPES } from '../config/integrations';
import type { GoogleCalendarEventPayload } from '../utils/calendarSync';
import type {
  AppointmentCalendarEventPayload,
  BusyInterval,
} from '../utils/doctors';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let cachedAccessToken: string | null = null;
let authListenerInitialized = false;

function getFirebaseAuth(): Auth {
  if (!firebaseApp) {
    firebaseApp =
      getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }
  if (!firebaseAuth) {
    firebaseAuth = getAuth(firebaseApp);
  }
  if (!authListenerInitialized) {
    authListenerInitialized = true;
    onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        cachedAccessToken = null;
      }
    });
  }
  return firebaseAuth;
}

export function hasCachedCalendarToken(): boolean {
  return Boolean(cachedAccessToken);
}

/**
 * Triggers Google Calendar authorization strictly on-demand when the user
 * chooses to sync routines, check conflicts, or manage synced appointments.
 * Access token stays in memory only.
 */
export async function requestGoogleCalendarAccessToken(
  forceReauth = false
): Promise<string> {
  if (cachedAccessToken && !forceReauth) {
    return cachedAccessToken;
  }

  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  for (const scope of GOOGLE_CALENDAR_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({ prompt: 'consent' });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Google Calendar access token was not granted.');
  }

  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
}

export function clearCachedCalendarToken(): void {
  cachedAccessToken = null;
}

function sanitizeGoogleCalendarLink(htmlLink?: string): string | undefined {
  if (typeof htmlLink !== 'string') return undefined;
  if (
    htmlLink.startsWith('https://www.google.com/calendar/') ||
    htmlLink.startsWith('https://calendar.google.com/')
  ) {
    return htmlLink;
  }
  return undefined;
}

class CalendarAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function withCalendarAuthRetry<T>(
  operation: (token: string) => Promise<T>,
  allowInteractive = true
): Promise<T> {
  let token = cachedAccessToken;
  if (!token) {
    if (!allowInteractive) {
      throw new CalendarAuthError(
        401,
        'Google Calendar is not currently connected.'
      );
    }
    token = await requestGoogleCalendarAccessToken();
  }

  try {
    return await operation(token);
  } catch (err) {
    if (err instanceof CalendarAuthError && (err.status === 401 || err.status === 403)) {
      cachedAccessToken = null;
      if (!allowInteractive) {
        throw err;
      }
      const refreshedToken = await requestGoogleCalendarAccessToken(true);
      return await operation(refreshedToken);
    }
    throw err;
  }
}

export interface CreatedCalendarEventResult {
  id: string;
  htmlLink?: string;
  summary: string;
}

export async function createGoogleCalendarEvents(
  events: GoogleCalendarEventPayload[]
): Promise<CreatedCalendarEventResult[]> {
  return withCalendarAuthRetry(async (accessToken) => {
    const results: CreatedCalendarEventResult[] = [];

    for (const event of events) {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (response.status === 401 || response.status === 403) {
        throw new CalendarAuthError(
          response.status,
          'Google Calendar permission expired or was declined.'
        );
      }

      if (!response.ok) {
        throw new Error(`Calendar API returned status ${response.status}.`);
      }

      const data = (await response.json()) as {
        id?: string;
        htmlLink?: string;
        summary?: string;
      };

      results.push({
        id: data.id || `evt-${Date.now()}`,
        htmlLink: sanitizeGoogleCalendarLink(data.htmlLink),
        summary: data.summary || event.summary,
      });
    }

    return results;
  }, true);
}

/**
 * Checks primary Google Calendar events for a given local YYYY-MM-DD date
 * and returns busy intervals so booking slots can display Free / Busy badges.
 */
export async function fetchDayBusyIntervals(
  isoDate: string,
  allowInteractive = true
): Promise<BusyInterval[]> {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return [];
  }

  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

  return withCalendarAuthRetry(async (token) => {
    const params = new URLSearchParams({
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    });

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 401 || response.status === 403) {
      throw new CalendarAuthError(
        response.status,
        'Google Calendar permission expired.'
      );
    }

    if (!response.ok) {
      throw new Error(`Calendar lookup returned status ${response.status}.`);
    }

    const data = (await response.json()) as {
      items?: Array<{
        status?: string;
        transparency?: string;
        summary?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
      }>;
    };

    const intervals: BusyInterval[] = [];
    for (const item of data.items || []) {
      if (item.status === 'cancelled' || item.transparency === 'transparent') {
        continue;
      }
      if (item.start?.dateTime && item.end?.dateTime) {
        const startMs = new Date(item.start.dateTime).getTime();
        const endMs = new Date(item.end.dateTime).getTime();
        if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
          intervals.push({
            startMs,
            endMs,
            summary: item.summary,
          });
        }
      }
    }
    return intervals;
  }, allowInteractive);
}

export async function createAppointmentCalendarEvent(
  payload: AppointmentCalendarEventPayload
): Promise<CreatedCalendarEventResult> {
  return withCalendarAuthRetry(async (token) => {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.status === 401 || response.status === 403) {
      throw new CalendarAuthError(
        response.status,
        'Google Calendar permission expired.'
      );
    }

    if (!response.ok) {
      throw new Error(`Calendar API returned status ${response.status}.`);
    }

    const data = (await response.json()) as {
      id?: string;
      htmlLink?: string;
      summary?: string;
    };

    return {
      id: data.id || `evt-${Date.now()}`,
      htmlLink: sanitizeGoogleCalendarLink(data.htmlLink),
      summary: data.summary || payload.summary,
    };
  }, true);
}

export async function updateGoogleCalendarEvent(
  eventId: string,
  payload: AppointmentCalendarEventPayload
): Promise<CreatedCalendarEventResult> {
  return withCalendarAuthRetry(async (token) => {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.status === 401 || response.status === 403) {
      throw new CalendarAuthError(
        response.status,
        'Google Calendar permission expired.'
      );
    }

    if (!response.ok) {
      throw new Error(`Calendar update returned status ${response.status}.`);
    }

    const data = (await response.json()) as {
      id?: string;
      htmlLink?: string;
      summary?: string;
    };

    return {
      id: data.id || eventId,
      htmlLink: sanitizeGoogleCalendarLink(data.htmlLink),
      summary: data.summary || payload.summary,
    };
  }, true);
}

export async function deleteGoogleCalendarEvent(eventId: string): Promise<void> {
  return withCalendarAuthRetry(async (token) => {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 401 || response.status === 403) {
      throw new CalendarAuthError(
        response.status,
        'Google Calendar permission expired.'
      );
    }

    // 404 or 410 means the event was already removed from Calendar — treat as clean success
    if (response.status === 404 || response.status === 410) {
      return;
    }

    if (!response.ok) {
      throw new Error(`Calendar delete returned status ${response.status}.`);
    }
  }, true);
}
