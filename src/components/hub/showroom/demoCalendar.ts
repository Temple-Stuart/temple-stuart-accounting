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
 * already merged across the four layers the Hub shows — `trip`, `project`,
 * `routines`, and `trade` — so HubCalendar can drop it straight into CalendarGrid
 * with no mapper. The `_check` at the bottom proves it stays assignable to that type.
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

// ── A pretend project block or two (the Projects layer — PR-HCR-LAYERS) ──────
const demoProjects: CalendarEvent[] = [
  {
    id: 'demo-cal-project-week-plan',
    source: 'project',
    title: 'Plan the week',
    icon: '🎯',
    startDate: d(8),
    startTime: '08:00',
    endTime: '08:30',
    details: ['Personal · weekly review', '30 min'],
  },
  {
    id: 'demo-cal-project-budget',
    source: 'project',
    title: 'Tidy the budget',
    icon: '🎯',
    startDate: d(15),
    startTime: '14:00',
    endTime: '14:45',
    details: ['Money · 45 min'],
  },
];

// ── A few pretend trades (the Trade layer, PR-HCR-TRADE) — made up, NOT real
//    positions or account data. Real trade wiring comes later. ────────────────
const demoTrades: CalendarEvent[] = [
  {
    id: 'demo-cal-trade-msft-condor',
    source: 'trade',
    title: 'MSFT Iron Condor',
    icon: '📈',
    startDate: d(7),
    details: ['Options · opened', '30 days out'],
  },
  {
    id: 'demo-cal-trade-nvda-signal',
    source: 'trade',
    title: 'Scanner: NVDA signal',
    icon: '📈',
    startDate: d(14),
    startTime: '09:30',
    details: ['Watchlist · high IV'],
  },
  {
    id: 'demo-cal-trade-aapl-expiry',
    source: 'trade',
    title: 'AAPL covered call expiry',
    icon: '📈',
    startDate: d(21),
    details: ['Options · expires'],
  },
];

/** The full pretend calendar — merged, ready to drop into CalendarGrid. */
export const demoCalendar: CalendarEvent[] = [
  ...demoTrip,
  ...demoRoutines,
  ...demoProjects,
  ...demoTrades,
];

// Type-conformance proof: this line fails to compile if the seed drifts from the
// shape the grid renders. Not exported; erased by the compiler.
const _check: CalendarEvent[] = demoCalendar;
void _check;
