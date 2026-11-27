import type { HealthPlan } from '../types/baymini';
import { stripEmojis } from './healthPlan';

export type RoutineScheduleMode = 'tomorrow' | 'repeat-7-days';

export interface RoutineCalendarBlock {
  id: 'morning' | 'midday' | 'evening';
  label: string;
  selected: boolean;
  startTime: string; // HH:MM (24-hour)
  durationMinutes: number;
  description: string;
}

export interface GoogleCalendarEventPayload {
  summary: string;
  description: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  recurrence?: string[];
}

export function buildDefaultRoutineBlocks(
  plan: HealthPlan
): RoutineCalendarBlock[] {
  return [
    {
      id: 'morning',
      label: 'Morning Routine & Movement',
      selected: true,
      startTime: '07:30',
      durationMinutes: 30,
      description: stripEmojis(
        [
          plan.morningRoutine.wakeUpHabit,
          plan.morningRoutine.hydrationCue,
          plan.morningRoutine.morningMovement,
        ]
          .filter(Boolean)
          .join(' ')
      ),
    },
    {
      id: 'midday',
      label: 'Midday Hydration & Posture Break',
      selected: true,
      startTime: '13:30',
      durationMinutes: 15,
      description: stripEmojis(
        [
          plan.afternoonRoutine.hydrationReminder,
          plan.afternoonRoutine.postureBreak,
          plan.afternoonRoutine.energyGuidance,
        ]
          .filter(Boolean)
          .join(' ')
      ),
    },
    {
      id: 'evening',
      label: 'Evening Wind-Down & Sleep Prep',
      selected: true,
      startTime: '22:00',
      durationMinutes: 30,
      description: stripEmojis(
        [
          plan.eveningRoutine.screenWindDown,
          plan.eveningRoutine.relaxationCue,
          plan.sleepAndLifestyle.sleepWindow,
        ]
          .filter(Boolean)
          .join(' ')
      ),
    },
  ];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function getTomorrowDate(baseDate: Date): Date {
  const d = new Date(baseDate.getTime());
  d.setDate(d.getDate() + 1);
  d.setSeconds(0, 0);
  return d;
}

function parseTime(hhmm: string): { hours: number; minutes: number } {
  const [hStr, mStr] = hhmm.split(':');
  const hours = Math.min(23, Math.max(0, Number(hStr) || 0));
  const minutes = Math.min(59, Math.max(0, Number(mStr) || 0));
  return { hours, minutes };
}

function formatLocalIsoDateTime(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());

  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMin);
  const offH = pad2(Math.floor(absOffset / 60));
  const offM = pad2(absOffset % 60);

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${sign}${offH}:${offM}`;
}

function formatIcsLocalDateTime(date: Date): string {
  return (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}` +
    `T${pad2(date.getHours())}${pad2(date.getMinutes())}00`
  );
}

function formatIcsUtcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

function escapeIcsText(value: string): string {
  return stripEmojis(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function buildCalendarEventsPayload(
  blocks: RoutineCalendarBlock[],
  scheduleMode: RoutineScheduleMode,
  baseDate = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
): GoogleCalendarEventPayload[] {
  const tomorrow = getTomorrowDate(baseDate);

  return blocks
    .filter((block) => block.selected)
    .map((block) => {
      const { hours, minutes } = parseTime(block.startTime);
      const start = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth(),
        tomorrow.getDate(),
        hours,
        minutes,
        0
      );
      const end = new Date(start.getTime() + block.durationMinutes * 60_000);

      const payload: GoogleCalendarEventPayload = {
        summary: `Baymini: ${stripEmojis(block.label)}`,
        description: stripEmojis(
          `${block.description}\n\nCreated with Baymini Personal Wellness Plan.`
        ),
        start: {
          dateTime: formatLocalIsoDateTime(start),
          timeZone,
        },
        end: {
          dateTime: formatLocalIsoDateTime(end),
          timeZone,
        },
      };

      if (scheduleMode === 'repeat-7-days') {
        payload.recurrence = ['RRULE:FREQ=DAILY;COUNT=7'];
      }

      return payload;
    });
}

export function buildIcsContent(
  blocks: RoutineCalendarBlock[],
  scheduleMode: RoutineScheduleMode,
  baseDate = new Date()
): string {
  const tomorrow = getTomorrowDate(baseDate);
  const dtStamp = formatIcsUtcStamp(baseDate);
  const selected = blocks.filter((b) => b.selected);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Baymini//Personal Wellness Routine//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  selected.forEach((block, index) => {
    const { hours, minutes } = parseTime(block.startTime);
    const start = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      hours,
      minutes,
      0
    );
    const end = new Date(start.getTime() + block.durationMinutes * 60_000);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:baymini-${block.id}-${baseDate.getTime()}-${index}@baymini.app`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART:${formatIcsLocalDateTime(start)}`);
    lines.push(`DTEND:${formatIcsLocalDateTime(end)}`);
    if (scheduleMode === 'repeat-7-days') {
      lines.push('RRULE:FREQ=DAILY;COUNT=7');
    }
    lines.push(`SUMMARY:${escapeIcsText(`Baymini: ${block.label}`)}`);
    lines.push(
      `DESCRIPTION:${escapeIcsText(
        `${block.description} (Created with Baymini Personal Wellness Plan)`
      )}`
    );
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function downloadIcsFile(
  icsContent: string,
  filename = 'baymini-wellness-routine.ics'
): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildGoogleCalendarTemplateUrl(
  block: RoutineCalendarBlock,
  scheduleMode: RoutineScheduleMode,
  baseDate = new Date()
): string {
  const tomorrow = getTomorrowDate(baseDate);
  const { hours, minutes } = parseTime(block.startTime);
  const start = new Date(
    tomorrow.getFullYear(),
    tomorrow.getMonth(),
    tomorrow.getDate(),
    hours,
    minutes,
    0
  );
  const end = new Date(start.getTime() + block.durationMinutes * 60_000);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Baymini: ${stripEmojis(block.label)}`,
    dates: `${formatIcsLocalDateTime(start)}/${formatIcsLocalDateTime(end)}`,
    details: stripEmojis(
      `${block.description}\n\nCreated with Baymini Personal Wellness Plan.`
    ),
  });

  if (scheduleMode === 'repeat-7-days') {
    params.set('recur', 'RRULE:FREQ=DAILY;COUNT=7');
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
