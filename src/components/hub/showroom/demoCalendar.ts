/**
 * demoCalendar — the LIVING DEMO seed for the home-page master calendar
 * (PR-HCR-DEMO). When a visitor is logged out, HubCalendar renders THIS static
 * list instead of fetching the owner's real calendar — so a logged-out guest
 * triggers ZERO personal-route calls (the data is fake by construction).
 *
 * Mirrors the Operations showroom seed convention
 * (workbench/operations/content/showroom/demoData.ts): PURE STATIC DATA — no
 * fetch, no effect, no server import — just typed literals. Every id is
 * `demo-cal-*` prefixed and every name is made up. Nothing here is real.
 *
 * Shape: the SAME `CalendarEvent` the grid renders (CalendarGrid.tsx:11-31),
 * already merged across the three sources the Hub shows — `trip`, `routines`,
 * and `operations` — so HubCalendar can drop it straight into CalendarGrid with
 * no mapper. The `_check` at the bottom proves it stays assignable to that type.
 */

import type { CalendarEvent } from '@/components/shared/CalendarGrid';

// Anchor the pretend events to the CURRENT month so the demo always looks alive
// on first view. Computed ONCE at import — pure date math, never any I/O.
const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth(); // 0-based
const pad = (n: number) => String(n).padStart(2, '0');
/** A YYYY-MM-DD string for `day` in the current month. */
const d = (day: number) => `${Y}-${pad(M + 1)}-${pad(day)}`;

// ── One pretend trip (multi-day) ────────────────────────────────────────────
const demoTrip: CalendarEvent[] = [
  {
    id: 'demo-cal-trip-lisbon',
    source: 'trip',
    title: 'Lisbon Getaway',
    icon: '✈️',
    startDate: d(12),
    endDate: d(16),
    location: 'Lisbon, Portugal',
    budgetAmount: 1850,
  },
];

// ── Pretend routines (recurring) — a few occurrences across the month so the
//    grid reads as a real week, not one lonely tile. ──────────────────────────
const workoutDays = [2, 4, 9, 11, 18, 23, 25];
const deepWorkDays = [3, 5, 10, 17, 24];
const windDownDays = [6, 13, 20];

const demoRoutines: CalendarEvent[] = [
  ...workoutDays.map((day) => ({
    id: `demo-cal-routine-workout-${pad(day)}`,
    source: 'routines',
    title: 'Morning Workout',
    icon: '🔁',
    startDate: d(day),
    startTime: '06:30',
    endTime: '07:15',
    isRecurring: true,
  })),
  ...deepWorkDays.map((day) => ({
    id: `demo-cal-routine-deepwork-${pad(day)}`,
    source: 'routines',
    title: 'Deep Work',
    icon: '🔁',
    startDate: d(day),
    startTime: '09:00',
    endTime: '11:00',
    isRecurring: true,
  })),
  ...windDownDays.map((day) => ({
    id: `demo-cal-routine-winddown-${pad(day)}`,
    source: 'routines',
    title: 'Wind Down',
    icon: '🔁',
    startDate: d(day),
    startTime: '21:30',
    endTime: '22:00',
    isRecurring: true,
  })),
];

// ── A pretend operations block or two (the daily-plan layer) ────────────────
const demoOperations: CalendarEvent[] = [
  {
    id: 'demo-cal-ops-week-plan',
    source: 'operations',
    title: 'Plan the week',
    icon: '🎯',
    startDate: d(8),
    startTime: '08:00',
    endTime: '08:30',
    details: ['Personal · weekly review', '30 min'],
  },
  {
    id: 'demo-cal-ops-budget',
    source: 'operations',
    title: 'Tidy the budget',
    icon: '🎯',
    startDate: d(15),
    startTime: '14:00',
    endTime: '14:45',
    details: ['Money · 45 min'],
  },
];

/** The full pretend calendar — merged, ready to drop into CalendarGrid. */
export const demoCalendar: CalendarEvent[] = [
  ...demoTrip,
  ...demoRoutines,
  ...demoOperations,
];

// Type-conformance proof: this line fails to compile if the seed drifts from the
// shape the grid renders. Not exported; erased by the compiler.
const _check: CalendarEvent[] = demoCalendar;
void _check;
