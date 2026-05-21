/**
 * Map the /api/hub/operations-routines response → CalendarGrid events.
 *
 * Emits one CalendarEvent per (routine, occurrence) pair so each
 * occurrence renders as its own tile on the Hub calendar.
 *
 * Timezone strategy: mirrors mapOperationsBlocks.ts — the server has
 * already DST-corrected each occurrence ISO via expandBetween, so we
 * extract LOCAL (browser-timezone) YYYY-MM-DD + HH:MM here. The Hub
 * renders in the browser's timezone; a routine scheduled at 8am PT
 * shows up at 11am ET for an ET viewer (correct).
 *
 * endTime intentionally omitted in v1: routine.end_time is wall-clock
 * in routine.timezone (e.g., "10:00 in PT"), and converting that to
 * the browser's wall-clock for a specific occurrence date requires
 * additional timezone math. CalendarGrid handles missing endTime
 * gracefully — defaults to a 120-minute visual block (CalendarGrid.tsx
 * around line 105). Proper end-time rendering can be a follow-up PR
 * once the timezone conversion is locked.
 */

import type { CalendarEvent } from '@/components/shared/CalendarGrid';

export interface RoutineWindowEntry {
  routine_id: string;
  name: string;
  entity_id: string;
  timezone: string;
  start_time: string | null;
  end_time: string | null;
  occurrences: string[];
}

export interface RoutinesWindowResponse {
  routines: RoutineWindowEntry[];
  truncated: boolean;
}

const ROUTINES_SOURCE = 'routines';
const ROUTINES_HREF = '/operations/routines';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC ISO → local (browser timezone) YYYY-MM-DD + HH:MM components. */
function toLocalDateAndTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function mapOperationsRoutines(response: RoutinesWindowResponse): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const routine of response.routines) {
    for (const occISO of routine.occurrences) {
      const local = toLocalDateAndTime(occISO);
      events.push({
        // Composite id: unique per (routine, occurrence) so CalendarGrid
        // doesn't collide tiles when the same routine fires multiple
        // times in the window.
        id: `routine:${routine.routine_id}:${occISO}`,
        source: ROUTINES_SOURCE,
        title: routine.name,
        startDate: local.date,
        startTime: local.time,
        isRecurring: true,
        href: ROUTINES_HREF,
      });
    }
  }

  return events;
}
