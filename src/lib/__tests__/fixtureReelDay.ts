/**
 * fixtureReelDay — THE REEL KIT'S DAY, as the day card builds it (REEL-01, Alex, 2026-10-15; moved here by REEL-02, 2026-10-19).
 *
 * Alex's day in Chiang Mai, in the day card's own shapes: six routine stops (the
 * journal at 10, Brunch at Luka Café, co-working, Dinner, the Gym, Activities), a
 * priced task, two sets of records — HALF (a day half recorded, the Gym skipped)
 * and FULL (every stop that asks an amount carries one) — the stay and the
 * journal. `build` runs dayStops over them; `reelDay` composes the ReelDay
 * exactly as DayCard.tsx does. Not a test file (not *.test.ts): reel01.test.ts
 * and reel02.test.ts both drive the same day, so REEL-02's byte-for-byte pin
 * (a journal with no `next` → REEL-01's caption and script, unchanged) holds
 * against the one fixture. Nothing here is a test; it builds, and asserts nothing.
 */
import type { DailyPlanItem } from '@/components/workbench/operations/dailyplan/types';
import type { PlanLine } from '../budget/planLines';
import type { StayRow } from '../operations/stay';
import type { StopRecordRow } from '../operations/stopRecord';
import type { StopRole } from '../operations/stopRole';
import type { Routine, TodayRoutineEntry } from '@/components/workbench/operations/routines/types';
import { dayStops, dayTotals, dayVerdict, type DayCardInput, type ReelDay } from '@/components/workbench/operations/day/dayCard';
import { doneInBlocksOf } from '../operations/workBlock';

export const DAY = '2026-10-15';
export const BKK = 'Asia/Bangkok';
export const routine = (over: Partial<Routine> & { id: string; name: string; role: StopRole; schedule_rrule: string }): Routine => ({
  user_id: 'u', entity_id: 'P', description: null, timezone: BKK,
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: null, end_time: null, is_active: true,
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, budget_amount: null, coa_code: null,
  location: null, steps: [], ...over,
});
export const entry = (r: Routine, expected_at: string): TodayRoutineEntry => ({ routine: r, expected_at, status: 'pending', completion: null });
export const vendor = (name: string) => ({ id: `v-${name}`, name, entityId: 'P', grain: 'occurrence' as const });
export const line = (over: Partial<PlanLine> & { address: PlanLine['address']; cents: number; label: string }): PlanLine => ({
  entityId: 'P', code: '5100', day: DAY, source: 'routine', line: null, time: null, vendor: null, ...over,
});
export const input = (over: Partial<DayCardInput> = {}): DayCardInput => ({ day: DAY, entries: [], lines: [], notPlaced: [], items: [], viewerZone: BKK, records: [], ...over });
export const item = (over: Partial<DailyPlanItem> & { id: string }): DailyPlanItem => ({
  user_id: 'u', entity_id: 'P', plan_date: `${DAY}T00:00:00.000Z`, task_id: null, ad_hoc_title: null, ad_hoc_description: null, display_order: 0,
  notes: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', created_by: null, task: null, calendar_blocks: [], ...over,
});

/** Alex's day in Chiang Mai: the journal at 10, Brunch at Luka Café, co-working, Dinner, the Gym, Activities — and a priced task. */
export const STOPS = [
  { id: 'journal', name: 'Vision journal', role: 'journal', hour: 10, at: '2026-10-15T03:00:00.000Z', cents: null, vendor: null },
  { id: 'brunch', name: 'Brunch', role: 'place', hour: 12, at: '2026-10-15T05:00:00.000Z', cents: 2500, vendor: 'Luka Café' },
  { id: 'cowork', name: 'Co-working', role: 'execute', hour: 13, at: '2026-10-15T06:00:00.000Z', cents: null, vendor: null },
  { id: 'dinner', name: 'Dinner', role: 'place', hour: 18, at: '2026-10-15T11:00:00.000Z', cents: 3000, vendor: null },
  { id: 'gym', name: 'Gym', role: 'place', hour: 19, at: '2026-10-15T12:00:00.000Z', cents: 1500, vendor: 'Fitness First' },
  { id: 'activities', name: 'Activities', role: 'place', hour: 20, at: '2026-10-15T13:00:00.000Z', cents: 2000, vendor: null },
] as const;
export type Id = (typeof STOPS)[number]['id'];
export type Rec = { outcome: 'done' | 'skipped'; actual?: number; rating?: number; note?: string };

/** The day's records: Brunch under with stars and a note, Dinner over with stars, the Gym skipped with its reason, the journal done; Activities not recorded. */
export const HALF: Partial<Record<Id, Rec>> = {
  journal: { outcome: 'done' },
  brunch: { outcome: 'done', actual: 969, rating: 4, note: 'Eggs benedict' },
  dinner: { outcome: 'done', actual: 3500, rating: 5 },
  gym: { outcome: 'skipped', note: 'closed for a holiday' },
};
/** Every stop that asks an amount carries one — the card shows its verdict. */
export const FULL: Partial<Record<Id, Rec>> = {
  journal: { outcome: 'done' },
  brunch: { outcome: 'done', actual: 969, rating: 4, note: 'Eggs benedict' },
  cowork: { outcome: 'done' },
  dinner: { outcome: 'done', actual: 3500, rating: 5 },
  gym: { outcome: 'done', actual: 1500, rating: 3, note: 'leg day' },
  activities: { outcome: 'done', actual: 1200 },
};

export function build(recs: Partial<Record<Id, Rec>>, opts: { readonly task?: boolean; readonly taskActual?: string } = {}) {
  const records = STOPS.filter((s) => recs[s.id] !== undefined).map((s): StopRecordRow => {
    const r = recs[s.id] as Rec;
    return {
      id: `rec-${s.id}`, kind: 'routine', target_id: s.id, occurrence_at: s.at, outcome: r.outcome, done_at: r.outcome === 'done' ? s.at : null,
      actual_cents: r.actual ?? null, rating: r.rating ?? null, note: r.note ?? null, actual_minutes: null,
    };
  });
  const withTask = opts.task !== false;
  return dayStops(input({
    entries: STOPS.map((s) => entry(routine({ id: s.id, name: s.name, role: s.role, schedule_rrule: `FREQ=DAILY;BYHOUR=${s.hour};BYMINUTE=0` }), s.at)),
    lines: [
      ...STOPS.flatMap((s) => (s.cents === null ? [] : [line({ address: { kind: 'routine', id: s.id, instant: s.at }, cents: s.cents, label: s.name, vendor: s.vendor === null ? null : vendor(s.vendor) })])),
      ...(withTask ? [line({ address: { kind: 'project_task', id: 't1', instant: null }, cents: 1000, label: 'Ship REEL-01', source: 'task' })] : []),
    ],
    items: withTask ? [item({ id: 'i1', task_id: 't1', task: { id: 't1', title: 'Ship REEL-01', status: 'open', project_id: 'proj', coa_code: null, estimated_cost_usd: '10.00', actual_cost_usd: opts.taskActual ?? null, actual_minutes: null, completed_at: null } })] : [],
    records,
  }));
}

export const STAY: StayRow = { id: 's1', place: 'Chiang Mai, Thailand 🇹🇭', starts_on: '2026-10-08', ends_on: '2026-10-22' };
// REEL-02 (Alex, 2026-10-19): the reel reads `next` too — the fixture's journal has none, so the caption and the script are byte-for-byte REEL-01's (reel02.test.ts R4).
export const JOURNAL: NonNullable<ReelDay['journal']> = { goals: ['Ship the reel kit', 'Call the bank'], blocker: 'waiting on the bank', next: null };

/**
 * The ReelDay exactly as DayCard.tsx composes it: the card's stops, its TOTAL row, its verdict on the TOTAL row's BUDGET.
 * WORK-03 (Alex, 2026-10-26): and `done` — each execute stop's done tasks by the one rule (doneInBlocksOf); none here, as a day
 * with nothing ticked, so REEL-01's and REEL-02's byte-for-byte pins hold against the one fixture (Co-working, the execute stop,
 * is stepless — no length — and shows no money, so it has no scene in the full script and adds no caption line).
 */
export function reelDay(r: ReturnType<typeof build>, over: Partial<ReelDay> = {}): ReelDay {
  const totals = dayTotals(r, r.plannedCents);
  return { day: DAY, stay: STAY, stops: r.stops, totals, verdict: dayVerdict(r, totals.budgetCents), journal: JOURNAL, done: doneInBlocksOf(r.stops, DAY, []), ...over };
}
