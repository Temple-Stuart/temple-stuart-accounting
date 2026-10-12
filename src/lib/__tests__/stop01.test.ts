/**
 * STOP-01 (2026-10-12) — THE RECORD AT A STOP: what happened at one stop of one
 * day — done at an instant or skipped with the reason, what was paid, a rating
 * against its rubric, a note, the minutes; the day card shows it on the row, on
 * the step card and in its spent line; the form under the plate writes it.
 *
 * The rules (src/lib/operations/stopRecord.ts, day/dayCard.ts) are pure and
 * DRIVEN over cases; the writer is driven over a stubbed fetch; the migration,
 * the schema, the routes, the form and the plate are anchored to their source
 * with comments stripped (TEST-TRUTH-01, through code() — the reader law).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditActionType } from '@prisma/client';
import { code, comments } from '../sourceText';
import type { PlanLine } from '../budget/planLines';
import {
  ARCHIVED_LINE_WORDS, BODY_NOT_JSON_WORDS, CENTS_MAX, DONE_AT_SKEW_MS, INACTIVE_ROUTINE_WORDS, LINES_WORDS, MINUTES_MAX, NEGATIVE_AMOUNT_WORDS, NOTE_MAX, RACE_WORDS, RATING_WORDS,
  ROUTINE_DONE_WORDS, ROUTINE_MISSED_WORDS, SKIP_REASON_WORDS, STOP_KINDS, STOP_OUTCOMES, TASK_DONE_WORDS, TASK_OPEN_WORDS, WHEN_WORDS, amountWords, clearStopQuestion, doneWords, instantOf,
  lateWords, minutesTypedWords, noStopWords, planOf, ratingWords, recordKey, recordWindow, refusedWords, skippedWords, starsWords, stopInput, stopRecordRowOf, unchanged, type StopRecordRow,
} from '../operations/stopRecord';
import type { DailyPlanItem } from '@/components/workbench/operations/dailyplan/types';
import type { Routine, RoutineStep, TodayRoutineEntry, TodayStatus } from '@/components/workbench/operations/routines/types';
import {
  ACTUAL_WORD, ON_PLAN_WORDS, RECORDS_NOT_READ_WORDS, SPENT_WORD, completenessWords, dayStops, deltaWords, doneOfWords, focusStop, minutesLine, monthDayWords, notRecordedWords,
  recordsUnplacedWords, recordsWithoutStopWords, rowActualWords, skippedCountWords, spentLineWords, spentSoFarWords, spentWords, statusWords, withoutAmountWords,
  type DayCardInput, type Stop,
} from '@/components/workbench/operations/day/dayCard';
import { readStopRecords, stopRecordsFailedWords } from '@/components/workbench/operations/day/dayReads';
import { clearStopRecord, setStopRecord } from '@/components/workbench/operations/stops/stopWrites';

const RULES = 'src/lib/operations/stopRecord.ts';
const CARD_RULES = 'src/components/workbench/operations/day/dayCard.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const READS = 'src/components/workbench/operations/day/dayReads.ts';
const ROUTE = 'src/app/api/operations/stops/route.ts';
const ROUTE_ID = 'src/app/api/operations/stops/[id]/route.ts';
const WRITES = 'src/components/workbench/operations/stops/stopWrites.ts';
const FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const ITEMS_ROUTE = 'src/app/api/operations/daily-plan/items/route.ts';
const ITEM_TYPES = 'src/components/workbench/operations/dailyplan/types.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261012140000_stop_01_operations_stop_records';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const AUDIT_LOG = 'src/app/api/audit-log/route.ts';

// ── FIXTURES (the day card's, daycard01.test.ts) ─────────────────────────────

const DAY = '2026-10-11';
const BKK = 'Asia/Bangkok';
/** The route's clock when the rule runs — 10:00 Bangkok on the day. */
const NOW = new Date('2026-10-11T03:00:00.000Z');
/** 07:00 Bangkok on the day. */
const AT = '2026-10-11T00:00:00.000Z';
const GYM_AT = '2026-10-11T13:00:00.000Z';
const STEP_ID = '0f2a7c1e-1111-4a2b-8c3d-000000000001';
const GYM_ID = '0f2a7c1e-2222-4a2b-8c3d-000000000002';

const step = (over: Partial<RoutineStep> & { id: string; step_order: number; activity: string }): RoutineStep => ({
  routine_id: 'morning', user_id: 'u', entity_id: 'P', time_of_day: null, sub_activity: null, location: null, duration_minutes: null,
  notes: null, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, ...over,
});
const routine = (over: Partial<Routine> & { id: string; name: string }): Routine => ({
  user_id: 'u', entity_id: 'P', description: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', timezone: BKK,
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: null, end_time: null, is_active: true,
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, budget_amount: null, coa_code: null,
  location: null, steps: [], ...over,
});
const entry = (r: Routine, status: TodayStatus = 'pending', expected_at: string = AT): TodayRoutineEntry => ({ routine: r, expected_at, status, completion: null });
const line = (over: Partial<PlanLine> & { address: PlanLine['address']; cents: number; label: string }): PlanLine => ({
  entityId: 'P', code: '5100', day: DAY, source: 'routine', line: null, time: null, vendor: null, ...over,
});
const item = (over: Partial<DailyPlanItem> & { id: string }): DailyPlanItem => ({
  user_id: 'u', entity_id: 'P', plan_date: `${DAY}T00:00:00.000Z`, task_id: null, ad_hoc_title: null, ad_hoc_description: null, display_order: 0,
  notes: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', created_by: null, task: null, calendar_blocks: [], ...over,
});
const block = (scheduled_start: string, status: DailyPlanItem['calendar_blocks'][number]['status'] = 'scheduled') => ({
  id: `b-${scheduled_start}`, scheduled_start, scheduled_end: scheduled_start, actual_start: null, actual_end: null, status, notes: null,
});
const task = (id: string, title: string, status: NonNullable<DailyPlanItem['task']>['status'] = 'open', actual_cost_usd: string | null = null, actual_minutes: number | null = null) => ({
  id, title, status, project_id: 'proj', coa_code: null, estimated_cost_usd: null, actual_cost_usd, actual_minutes, completed_at: null,
});
const morning = routine({
  id: 'morning', name: 'Morning', location: 'Home', steps: [
    step({ id: STEP_ID, step_order: 2, activity: 'Coffee', time_of_day: '1970-01-01T07:30:00.000Z', location: 'Roots Thonglor', duration_minutes: 30 }),
    step({ id: 'stretch', step_order: 1, activity: 'Stretch', time_of_day: '1970-01-01T06:30:00.000Z' }),
    step({ id: 'journal', step_order: 3, activity: 'Journal' }),
  ],
});
const gym = routine({ id: GYM_ID, name: 'Gym', location: 'Fitness First', schedule_rrule: 'FREQ=DAILY;BYHOUR=20;BYMINUTE=0' });
const input = (over: Partial<DayCardInput> = {}): DayCardInput => ({ day: DAY, entries: [], lines: [], notPlaced: [], items: [], viewerZone: BKK, records: null, ...over });

const record = (over: Partial<StopRecordRow> & { kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  id: `rec-${over.target_id}`, outcome: 'done', done_at: null, actual_cents: null, rating: null, note: null, actual_minutes: null, ...over,
});
/** Coffee, done 07:41 Bangkok (11 min late), $12 against a $10 plan, four stars. */
const coffeeDone = record({ kind: 'routine_line', target_id: STEP_ID, occurrence_at: AT, done_at: '2026-10-11T00:41:00.000Z', actual_cents: 1200, rating: 4, note: 'the oat milk', actual_minutes: 42 });
const coffeeLine = line({ address: { kind: 'routine_line', id: STEP_ID, instant: AT }, cents: 1000, label: 'Morning', line: 'Coffee', time: '07:30' });

// ── T1 · THE INPUT RULE ──────────────────────────────────────────────────────

test('T1 stopInput: the kind, the id, the instant, the outcome; done_at when done and never when skipped; cents 0 or more; rating 1–5; a note trimmed, 1–280, required when skipped; minutes within a day — the first bad field named, nothing filled in', () => {
  const base = { kind: 'routine_line', id: STEP_ID, instant: AT, outcome: 'done', done_at: '2026-10-11T00:41:00.000Z' };
  const ok = stopInput({ ...base, actual_cents: 1200, rating: 4, note: '  the  oat milk ', actual_minutes: 42 }, NOW);
  assert.ok(ok.ok);
  assert.deepEqual(ok.value, { kind: 'routine_line', id: STEP_ID, instant: new Date(AT), outcome: 'done', doneAt: new Date('2026-10-11T00:41:00.000Z'), actualCents: 1200, rating: 4, note: 'the oat milk', actualMinutes: 42 });
  const bare = stopInput(base, NOW);
  assert.ok(bare.ok);
  assert.deepEqual([bare.value.actualCents, bare.value.rating, bare.value.note, bare.value.actualMinutes], [null, null, null, null], 'absent is null — never 0, never ""');
  const nulls = stopInput({ ...base, actual_cents: null, rating: null, note: null, actual_minutes: null }, NOW);
  assert.ok(nulls.ok && nulls.value.actualCents === null, 'null is absent too');
  assert.ok(stopInput({ ...base, actual_cents: 0 }, NOW).ok, '0 cents is a price — a free thing');
  assert.ok(stopInput({ ...base, actual_cents: CENTS_MAX }, NOW).ok);
  const skipped = stopInput({ kind: 'routine', id: GYM_ID, instant: GYM_AT, outcome: 'skipped', note: 'closed' }, NOW);
  assert.ok(skipped.ok);
  assert.deepEqual([skipped.value.outcome, skipped.value.doneAt, skipped.value.note], ['skipped', null, 'closed']);
  const blankNote = stopInput({ ...base, note: '   ' }, NOW);
  assert.ok(blankNote.ok && blankNote.value.note === null, 'a blank note is no note');
  assert.ok(stopInput({ ...base, instant: '2026-10-11T07:00:00+07:00' }, NOW).ok, 'an offset instant parses');
  assert.ok(stopInput({ ...base, done_at: new Date(NOW.getTime() + DONE_AT_SKEW_MS).toISOString() }, NOW).ok, 'a done-at up to the skew ahead of the server is the browser’s clock');
  assert.equal(DONE_AT_SKEW_MS, 10 * 60_000);
  assert.deepEqual(['2026-10-11T07:00+07:00', '2026-10-11T07:00:00-05:00', '2026-10-11T23:59:59.999Z', '2026-10-11T07:00:00.1Z'].map((x) => instantOf(x)?.toISOString()), ['2026-10-11T00:00:00.000Z', '2026-10-11T12:00:00.000Z', '2026-10-11T23:59:59.999Z', '2026-10-11T07:00:00.100Z']);
  assert.equal(instantOf('2026-10-11T24:00:00Z'), null);
  assert.equal(instantOf(''), null);
  for (const [body, field, words] of [
    [null, 'kind', 'the body must be an object'],
    [[], 'kind', 'the body must be an object'],
    [{ ...base, kind: 'project_task' }, 'kind', 'kind must be one of routine_line, routine'],
    [{ ...base, id: '' }, 'id', 'required'],
    [{ ...base, id: 7 }, 'id', 'required'],
    [{ ...base, instant: 'yesterday' }, 'instant', 'instant "yesterday" is not an ISO instant'],
    [{ ...base, instant: 1760000000000 }, 'instant', 'is not an ISO instant'],
    [{ ...base, instant: '2026-10-11T07:00' }, 'instant', 'is not an ISO instant'],
    [{ ...base, instant: '2026-10-11' }, 'instant', 'is not an ISO instant'],
    [{ ...base, instant: 'Oct 11 2026' }, 'instant', 'is not an ISO instant'],
    [{ ...base, instant: '+010000-01-01T00:00:00Z' }, 'instant', 'is not an ISO instant'],
    [{ ...base, instant: '0000-01-01T00:00:00Z' }, 'instant', 'is not an ISO instant'],
    [{ ...base, instant: '2026-02-30T00:00:00Z' }, 'instant', 'is not an ISO instant'],
    [{ ...base, instant: '2026-10-11T07:00:00+0700' }, 'instant', 'is not an ISO instant'],
    [{ ...base, done_at: '2026-10-11T03:11:00.000Z' }, 'done_at', 'done_at 2026-10-11T03:11:00.000Z is in the future'],
    [{ ...base, done_at: '2099-01-01T00:00:00Z' }, 'done_at', 'is in the future'],
    [{ ...base, outcome: 'missed' }, 'outcome', 'outcome must be one of done, skipped'],
    [{ ...base, done_at: undefined }, 'done_at', 'a done stop says when'],
    [{ ...base, done_at: 'noon' }, 'done_at', 'done_at "noon" is not an ISO instant'],
    [{ kind: 'routine', id: GYM_ID, instant: GYM_AT, outcome: 'skipped', note: 'closed', done_at: GYM_AT }, 'done_at', 'a skipped stop has no done_at'],
    [{ ...base, actual_cents: 12.5 }, 'actual_cents', 'is not a whole number of cents, 0 or more'],
    [{ ...base, actual_cents: -1 }, 'actual_cents', 'is not a whole number of cents, 0 or more'],
    [{ ...base, actual_cents: '1200' }, 'actual_cents', 'is not a whole number of cents'],
    [{ ...base, actual_cents: CENTS_MAX + 1 }, 'actual_cents', "is past the column's range (2147483647)"],
    [{ ...base, rating: 0 }, 'rating', 'rating 0 is not 1 to 5'],
    [{ ...base, rating: 6 }, 'rating', 'is not 1 to 5'],
    [{ ...base, rating: 3.5 }, 'rating', 'is not 1 to 5'],
    [{ ...base, rating: '4' }, 'rating', 'is not 1 to 5'],
    [{ ...base, note: 7 }, 'note', 'note must be a string'],
    [{ ...base, note: 'a\u0000b' }, 'note', 'control characters are not a note'],
    [{ ...base, note: 'a\u0085b' }, 'note', 'control characters are not a note'],
    [{ ...base, note: 'a\ud800b' }, 'note', 'control characters are not a note'],
    [{ ...base, actual_minutes: '42' }, 'actual_minutes', 'is not 0 to 1440'],
    [{ ...base, note: 'x'.repeat(281) }, 'note', 'note is at most 280 characters (281 given)'],
    [{ kind: 'routine', id: GYM_ID, instant: GYM_AT, outcome: 'skipped' }, 'note', SKIP_REASON_WORDS],
    [{ kind: 'routine', id: GYM_ID, instant: GYM_AT, outcome: 'skipped', note: '  ' }, 'note', 'a skipped stop needs its reason (note)'],
    [{ ...base, actual_minutes: -1 }, 'actual_minutes', 'is not 0 to 1440'],
    [{ ...base, actual_minutes: 1441 }, 'actual_minutes', 'is not 0 to 1440'],
    [{ ...base, actual_minutes: 2.5 }, 'actual_minutes', 'is not 0 to 1440'],
  ] as const) {
    const r = stopInput(body, NOW);
    assert.ok(!r.ok, JSON.stringify(body));
    assert.equal(r.field, field, JSON.stringify(body));
    assert.ok(r.message.includes(words), `${JSON.stringify(body)} → ${r.message}`);
  }
  assert.deepEqual([NOTE_MAX, MINUTES_MAX, CENTS_MAX], [280, 1440, 2_147_483_647]);
  assert.deepEqual([...STOP_KINDS], ['routine_line', 'routine']);
  assert.deepEqual([...STOP_OUTCOMES], ['done', 'skipped']);
  assert.ok(stopInput({ ...base, note: 'x'.repeat(280) }, NOW).ok, '280 is allowed');
  assert.ok(stopInput({ ...base, actual_minutes: 1440 }, NOW).ok, '1440 is allowed');
});

test('T1 rows, keys, the plan columns, unchanged, the window', () => {
  const db = { id: 'r1', routine_id: null, step_id: STEP_ID, occurrence_at: new Date(AT), outcome: 'done', done_at: new Date('2026-10-11T00:41:00.000Z'), actual_cents: 1200, rating: 4, note: 'the oat milk', actual_minutes: 42 };
  assert.deepEqual(stopRecordRowOf(db), { id: 'r1', kind: 'routine_line', target_id: STEP_ID, occurrence_at: AT, outcome: 'done', done_at: '2026-10-11T00:41:00.000Z', actual_cents: 1200, rating: 4, note: 'the oat milk', actual_minutes: 42 });
  assert.equal(stopRecordRowOf({ ...db, step_id: null, routine_id: GYM_ID, outcome: 'skipped', done_at: null }).kind, 'routine');
  assert.throws(() => stopRecordRowOf({ ...db, routine_id: GYM_ID }), /names two plans/, 'both columns set is the database’s error');
  assert.throws(() => stopRecordRowOf({ ...db, step_id: null }), /names no plan/);
  assert.throws(() => stopRecordRowOf({ ...db, outcome: 'missed' }), /not done or skipped/);
  assert.equal(recordKey(coffeeDone), `line:${STEP_ID}:${AT}`, 'the card’s own key words');
  assert.equal(recordKey(record({ kind: 'routine', target_id: GYM_ID, occurrence_at: GYM_AT })), `routine:${GYM_ID}:${GYM_AT}`);
  assert.deepEqual(planOf('routine_line', STEP_ID), { routine_id: null, step_id: STEP_ID });
  assert.deepEqual(planOf('routine', GYM_ID), { routine_id: GYM_ID, step_id: null });
  const v = (stopInput({ kind: 'routine_line', id: STEP_ID, instant: AT, outcome: 'done', done_at: '2026-10-11T00:41:00.000Z', actual_cents: 1200, rating: 4, note: 'the oat milk', actual_minutes: 42 }, NOW) as { ok: true; value: Parameters<typeof unchanged>[1] }).value;
  assert.equal(unchanged(coffeeDone, v), true);
  assert.equal(unchanged(coffeeDone, { ...v, actualCents: 1250 }), false);
  assert.equal(unchanged(coffeeDone, { ...v, note: null }), false);
  assert.equal(unchanged(coffeeDone, { ...v, doneAt: new Date('2026-10-11T00:42:00.000Z') }), false);
  assert.equal(unchanged(coffeeDone, { ...v, rating: 5 }), false, 'a rating-only edit is a change');
  assert.equal(unchanged(coffeeDone, { ...v, actualMinutes: 43 }), false);
  assert.equal(unchanged(coffeeDone, { ...v, outcome: 'skipped', doneAt: null }), false);
  assert.equal(unchanged(coffeeDone, { ...v, outcome: 'skipped' }), false, 'the outcome alone is a change (unchanged compares, it does not validate)');
  assert.equal(unchanged(coffeeDone, { ...v, rating: null }), false);
  // The window: a local day in any zone — UTC+14 starts it at D−1 10:00Z, UTC−12 ends it at D+1 12:00Z.
  assert.deepEqual(recordWindow('2026-10-11'), { gte: new Date('2026-10-10T10:00:00.000Z'), lt: new Date('2026-10-12T12:00:00.000Z') });
  assert.throws(() => recordWindow('nope'), /is not a day/);
});

// ── T2 · THE CARD'S RULES WITH RECORDS ───────────────────────────────────────

test('T2 a line with a record of its own takes its status, actual, done-at, lateness, rating and minutes from it; one without keeps the routine’s status and says so', () => {
  const r = dayStops(input({ entries: [entry(morning, 'completed')], lines: [coffeeLine], records: [coffeeDone] }));
  const coffee = r.stops.find((s) => s.line === 'Coffee')!;
  assert.equal(coffee.status, 'done');
  assert.equal(coffee.statusSource, 'record');
  assert.equal(coffee.record, coffeeDone);
  assert.deepEqual([coffee.actualCents, coffee.actualSource], [1200, 'typed']);
  assert.deepEqual(coffee.doneAt, { day: DAY, time: '07:41' }, 'the done-at in the routine’s zone');
  assert.equal(coffee.lateMinutes, 11, '07:41 against the line’s own 07:30 — not the occurrence’s 07:00');
  assert.equal(coffee.actualMinutes, 42);
  assert.deepEqual(coffee.address, { kind: 'routine_line', id: STEP_ID, instant: AT });
  assert.equal(coffee.zone, BKK);
  const stretch = r.stops.find((s) => s.line === 'Stretch')!;
  assert.deepEqual([stretch.status, stretch.statusSource, stretch.record, stretch.actualCents, stretch.doneAt, stretch.lateMinutes], ['done', 'routine', null, null, null, null], 'the routine’s completion, labelled as such');
  assert.equal(statusWords(stretch, DAY), ROUTINE_DONE_WORDS, 'said as the routine’s — never printed as the line’s own done');
  assert.equal(statusWords(coffee, DAY), 'done 07:41 · 11 min late');
  const missed = dayStops(input({ entries: [entry(morning, 'missed')], records: [] })).stops[0];
  assert.equal(statusWords(missed, DAY), ROUTINE_MISSED_WORDS);
  assert.equal(statusWords(dayStops(input({ entries: [entry(morning, 'pending')], records: [] })).stops[0], DAY), 'open');
  assert.equal(statusWords(dayStops(input({ entries: [entry(morning, 'upcoming')], records: [] })).stops[0], DAY), 'later');
  // The done-at and the planned instant are the ROUTINE's zone, whatever the viewer's: a Los Angeles viewer sees the Bangkok clock.
  const la = dayStops(input({ entries: [entry(morning, 'completed')], lines: [coffeeLine], records: [coffeeDone], viewerZone: 'America/Los_Angeles' })).stops.find((s) => s.line === 'Coffee')!;
  assert.deepEqual([la.doneAt, la.lateMinutes], [{ day: DAY, time: '07:41' }, 11]);
  // A record at the same line but another instant is NOT this stop's — named as matching no stop, nothing matched by nearness.
  const movedRecord = { ...coffeeDone, id: 'moved', occurrence_at: '2026-10-11T01:00:00.000Z' };
  const mv = dayStops(input({ entries: [entry(morning)], lines: [coffeeLine], records: [movedRecord] }));
  assert.equal(mv.stops.find((s) => s.line === 'Coffee')!.record, null);
  assert.deepEqual(mv.recordsWithoutStop, [movedRecord]);
  // Whole minutes: done at 07:30:40 against a 07:30 line is on time, not "1 min late".
  const seconds = { ...coffeeDone, done_at: '2026-10-11T00:30:40.000Z' };
  assert.equal(dayStops(input({ entries: [entry(morning)], records: [seconds] })).stops.find((s) => s.line === 'Coffee')!.lateMinutes, 0);
  assert.equal(dayStops(input({ entries: [entry(morning)], records: [{ ...coffeeDone, done_at: '2026-10-11T00:29:59.000Z' }] })).stops.find((s) => s.line === 'Coffee')!.lateMinutes, -1);
  // Lateness for a line with no time of day is against the occurrence (07:00).
  const journalDone = record({ kind: 'routine_line', target_id: 'journal', occurrence_at: AT, done_at: '2026-10-10T23:50:00.000Z' });
  const j = dayStops(input({ entries: [entry(morning)], records: [journalDone] })).stops.find((s) => s.line === 'Journal')!;
  assert.equal(j.lateMinutes, -10, '06:50 against 07:00 — early');
  assert.deepEqual(j.doneAt, { day: DAY, time: '06:50' });
  // A stepless routine's record, by the routine's key; done after midnight is another local day, said so.
  const gymLate = record({ kind: 'routine', target_id: GYM_ID, occurrence_at: GYM_AT, done_at: '2026-10-11T17:30:00.000Z', actual_cents: 0 });
  const g = dayStops(input({ entries: [entry(gym, 'missed', GYM_AT)], records: [gymLate] })).stops[0];
  assert.deepEqual([g.status, g.statusSource, g.actualCents, g.actualSource, g.lateMinutes], ['done', 'record', 0, 'typed', 270]);
  assert.deepEqual(g.doneAt, { day: '2026-10-12', time: '00:30' });
  assert.equal(statusWords(g, DAY), 'done Oct 12 00:30 · 270 min late');
  // Skipped: the status, no done-at, the reason in the words.
  const skipped = record({ kind: 'routine', target_id: GYM_ID, occurrence_at: GYM_AT, outcome: 'skipped', note: 'closed' });
  const s = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], records: [skipped] })).stops[0];
  assert.deepEqual([s.status, s.statusSource, s.doneAt, s.lateMinutes, s.actualCents], ['skipped', 'record', null, null, null]);
  assert.equal(statusWords(s, DAY), 'skipped — closed');
  // The record's done-at is the record's: a record done by the routine's rule but with no done_at is the database's error.
  const broken = { ...coffeeDone, done_at: null };
  const b = dayStops(input({ entries: [entry(morning)], records: [broken] })).stops.find((st) => st.line === 'Coffee')!;
  assert.equal(b.doneAt, null);
  assert.throws(() => statusWords(b, DAY), /done by its record but has no done-at/);
  const noReason = record({ kind: 'routine', target_id: GYM_ID, occurrence_at: GYM_AT, outcome: 'skipped', note: null });
  assert.throws(() => statusWords(dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], records: [noReason] })).stops[0], DAY), /skipped by its record but carries no reason/, 'never a blank reason');
});

test('T2 a task’s actual is the task’s own; the records not read → every record field null and the sums unknown; two records at one key is the database’s error', () => {
  const t = dayStops(input({ items: [item({ id: 'i1', task_id: 't1', task: task('t1', 'Ship it', 'completed', '12.50', 25) })], records: [] })).stops[0];
  assert.deepEqual([t.status, t.statusSource, t.actualCents, t.actualSource, t.actualMinutes, t.record, t.address, t.zone, t.doneAt, t.lateMinutes], ['done', 'task', 1250, 'task', 25, null, null, null, null, null]);
  assert.equal(statusWords(t, DAY), TASK_DONE_WORDS, 'completed with no completed_at: the word alone');
  // The task's own completed_at is its done-at, drawn in the VIEWER's zone (as its block's time); no lateness is drawn for a task.
  const done = dayStops(input({ viewerZone: 'America/Los_Angeles', items: [item({ id: 'i1', task_id: 't1', task: { ...task('t1', 'Ship it', 'completed'), completed_at: '2026-10-11T21:05:00.000Z' }, calendar_blocks: [block('2026-10-11T20:00:00.000Z')] })], records: [] })).stops[0];
  assert.deepEqual([done.doneAt, done.lateMinutes], [{ day: DAY, time: '14:05' }, null]);
  assert.equal(statusWords(done, DAY), 'task done 14:05');
  const open = dayStops(input({ items: [item({ id: 'i1', task_id: 't1', task: { ...task('t1', 'Ship it'), completed_at: '2026-10-11T21:05:00.000Z' } })], records: [] })).stops[0];
  assert.equal(open.doneAt, null, 'an open task’s stale completed_at is not a done-at');
  assert.equal(statusWords(dayStops(input({ items: [item({ id: 'i2', task_id: 't2', task: task('t2', 'Open') })] })).stops[0], DAY), TASK_OPEN_WORDS);
  assert.throws(() => dayStops(input({ items: [item({ id: 'i3', task_id: 't3', task: task('t3', 'Bad', 'open', '12.345') })] })), /cannot be read as cents/, 'a task actual with three decimals is the database’s error, never a figure');
  const unread = dayStops(input({ entries: [entry(morning, 'completed')], lines: [coffeeLine] }));
  assert.deepEqual([unread.spentCents, unread.withoutActual, unread.notRecorded, unread.recordsWithoutStop], [null, 0, 0, []], 'not read is unknown — no sum, no counts');
  assert.deepEqual(unread.stops.map((s) => [s.statusSource, s.record]), [['routine', null], ['routine', null], ['routine', null]]);
  assert.equal(focusStop(unread, 1)!.spentSoFarCents, null);
  assert.throws(() => dayStops(input({ entries: [entry(morning)], records: [coffeeDone, { ...coffeeDone, id: 'dup' }] })), /two records at line:/);
});

test('T2 the day’s spent is the sum of the actuals that exist, the stops without one counted beside it; done, skipped, not recorded; a record matching no stop is named', () => {
  const gymDone = record({ kind: 'routine', target_id: GYM_ID, occurrence_at: GYM_AT, done_at: '2026-10-11T13:05:00.000Z', actual_cents: 1500 });
  const orphan = record({ kind: 'routine_line', target_id: 'archived-step', occurrence_at: AT, done_at: AT, actual_cents: 300 });
  const r = dayStops(input({
    entries: [entry(morning, 'pending'), entry(gym, 'pending', GYM_AT)],
    lines: [coffeeLine, line({ address: { kind: 'routine', id: GYM_ID, instant: GYM_AT }, cents: 1500, label: 'Gym' })],
    items: [item({ id: 'i1', task_id: 't1', task: task('t1', 'Ship it', 'completed', '20', null) })],
    records: [coffeeDone, gymDone, orphan],
  }));
  assert.equal(r.stops.length, 5, 'three lines, the gym, the task');
  assert.equal(r.spentCents, 1200 + 1500 + 2000, 'the coffee, the gym, the task — the two unrecorded lines are not zero');
  assert.equal(r.withoutActual, 2, 'Stretch and Journal');
  assert.deepEqual([r.done, r.skipped, r.notRecorded], [3, 0, 2]);
  assert.deepEqual(r.recordsWithoutStop, [orphan], 'the record at an archived line is named, never dropped');
  assert.equal(r.plannedCents, 2500, 'the hero is still the Budget’s');
  // The focus: planned and spent so far, with the count of stops up to it that have no amount.
  const idx = r.stops.findIndex((s) => s.line === 'Coffee') + 1;
  const f = focusStop(r, idx)!;
  assert.equal(f.spentSoFarCents, 1200, 'Stretch, Journal (nothing) and Coffee ($12)');
  assert.equal(f.withoutActualSoFar, 2);
  assert.equal(focusStop(r, 5)!.spentSoFarCents, 4700);
  assert.equal(focusStop(r, 5)!.withoutActualSoFar, 2);
  // Skipped counts.
  const skipped = record({ kind: 'routine', target_id: GYM_ID, occurrence_at: GYM_AT, outcome: 'skipped', note: 'closed' });
  const sk = dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], records: [skipped] }));
  assert.deepEqual([sk.done, sk.skipped, sk.notRecorded, sk.withoutActual, sk.spentCents], [0, 1, 0, 1, 0]);
  assert.equal(completenessWords(sk, 0, { day: true, report: true, records: true }), '1 not priced · 1 skipped');
  // The done count is the marks' — a line done by its routine's completion counts (its row wears ✓); a task without an actual counts as without.
  const byRoutine = dayStops(input({ entries: [entry(morning, 'completed')], items: [item({ id: 'i1', task_id: 't1', task: task('t1', 'Ship it') })], records: [] }));
  assert.deepEqual([byRoutine.done, byRoutine.withoutActual, byRoutine.notRecorded], [3, 4, 3]);
  // A routine-kind orphan is named like a line-kind one.
  const routineOrphan = record({ kind: 'routine', target_id: 'gone-routine', occurrence_at: GYM_AT });
  assert.deepEqual(dayStops(input({ entries: [entry(gym, 'pending', GYM_AT)], records: [routineOrphan] })).recordsWithoutStop, [routineOrphan]);
});

// ── T3 · THE WORDS, EXACT ────────────────────────────────────────────────────

test('T3 the record’s words: the rubric, the stars, the status with its source, the delta, the spent lines, the counts', () => {
  assert.deepEqual(RATING_WORDS, { 5: 'would plan it again at this price', 4: 'again, but cheaper exists', 3: 'fine', 2: 'not again', 1: 'should not have paid' });
  assert.equal(starsWords(4), '★★★★☆');
  assert.equal(starsWords(1), '★☆☆☆☆');
  assert.equal(starsWords(5), '★★★★★');
  assert.throws(() => starsWords(0), /a rating is 1 to 5/);
  assert.throws(() => starsWords(2.5), /a rating is 1 to 5/);
  assert.equal(ratingWords(4), '★★★★☆ · again, but cheaper exists');
  assert.equal(doneWords('12:41'), 'done 12:41');
  assert.equal(skippedWords('closed'), 'skipped — closed');
  assert.equal(lateWords(11), '11 min late');
  assert.equal(lateWords(-8), '8 min early');
  assert.equal(lateWords(0), 'on time');
  assert.equal(ROUTINE_DONE_WORDS, 'routine marked done');
  assert.equal(ROUTINE_MISSED_WORDS, 'routine missed');
  assert.equal(TASK_DONE_WORDS, 'task done');
  assert.equal(TASK_OPEN_WORDS, 'task open');
  assert.equal(LINES_WORDS, 'the routine has lines — record each line, not the routine');
  assert.equal(ARCHIVED_LINE_WORDS, 'the line is archived — it has no stop');
  assert.equal(INACTIVE_ROUTINE_WORDS, 'the routine is inactive — it has no stop');
  assert.equal(SKIP_REASON_WORDS, 'a skipped stop needs its reason (note)');
  assert.equal(BODY_NOT_JSON_WORDS, 'the body is not JSON');
  assert.equal(NEGATIVE_AMOUNT_WORDS, 'an amount is 0 or more');
  assert.equal(RACE_WORDS(AT), `a record at ${AT} was written moments ago — read the day again`);
  assert.equal(noStopWords(AT, DAY, null), `no stop at ${AT} — the routine has no stop on ${DAY}`);
  assert.equal(noStopWords('2026-10-11T01:00:00.000Z', DAY, AT), `no stop at 2026-10-11T01:00:00.000Z — on ${DAY} the routine's stop is at ${AT}`);
  assert.equal(refusedWords('timezone not recognised', '"Mars/Olympus": bad'), 'the routine\'s day cannot be read — timezone not recognised: "Mars/Olympus": bad');
  assert.equal(clearStopQuestion('done 07:41 · 11 min late'), "Clear this stop's record (done 07:41 · 11 min late)? The audit log keeps it; the card forgets it.");
  assert.equal(WHEN_WORDS, 'say when it was done (HH:MM)');
  assert.equal(amountWords('12,5'), '"12,5" is not an amount (dollars, at most two decimals)');
  assert.equal(minutesTypedWords('a while'), '"a while" is not a number of minutes');
  // The card's.
  assert.equal(ACTUAL_WORD, 'ACTUAL');
  assert.equal(SPENT_WORD, 'spent');
  assert.equal(RECORDS_NOT_READ_WORDS, 'records not read');
  assert.equal(ON_PLAN_WORDS, 'on plan');
  assert.deepEqual(deltaWords(1200, 1000), { text: '▲ $2 over', over: true });
  assert.deepEqual(deltaWords(725, 1000), { text: '▼ $2.75 under', over: false });
  assert.deepEqual(deltaWords(1000, 1000), { text: 'on plan', over: false });
  assert.deepEqual(deltaWords(null, 1000), { text: '—', over: null });
  assert.deepEqual(deltaWords(1200, null), { text: '—', over: null });
  assert.equal(rowActualWords(1200, 1000), '$12 ▲ $2');
  assert.equal(rowActualWords(725, 1000), '$7.25 ▼ $2.75');
  assert.equal(rowActualWords(1000, 1000), '$10 on plan');
  assert.equal(rowActualWords(1200, null), '$12');
  assert.equal(withoutAmountWords(2), '2 without an amount');
  assert.equal(spentWords(5425, 0), 'spent $54.25');
  assert.equal(spentWords(5425, 2), 'spent $54.25 · 2 without an amount');
  assert.equal(spentWords(0, 7), 'spent $0 · 7 without an amount', 'nothing typed yet is $0 WITH the count — never a bare $0');
  assert.equal(spentWords(null, 0), 'spent — · records not read');
  assert.equal(spentSoFarWords(1200, 2), 'spent so far $12 · 2 without an amount');
  assert.equal(spentSoFarWords(null, 0), 'spent so far — · records not read');
  assert.equal(doneOfWords(6, 7), '6 of 7 done');
  assert.equal(skippedCountWords(1), '1 skipped');
  assert.equal(notRecordedWords(3), '3 not recorded');
  assert.equal(spentLineWords(5425, 2, 6, 7), 'spent $54.25 · 2 without an amount · 6 of 7 done');
  assert.equal(spentLineWords(5425, 0, 6, null), 'spent $54.25', 'the stops unknown (the day read failed) — no done count');
  assert.equal(minutesLine(30, 42), '30 min planned · 42 min');
  assert.equal(minutesLine(30, null), '30 min planned');
  assert.equal(minutesLine(null, 42), '42 min');
  assert.equal(minutesLine(null, null), null);
  assert.equal(monthDayWords('2026-10-12'), 'Oct 12');
  assert.equal(recordsWithoutStopWords([record({ kind: 'routine_line', target_id: 'archived-step', occurrence_at: AT, actual_cents: 300 })]),
    `1 record of the day matches no stop — routine_line archived-step at ${AT}: done, $3.00`, 'the facts; no guessed cause');
  assert.equal(recordsWithoutStopWords([record({ kind: 'routine', target_id: 'g', occurrence_at: AT, outcome: 'skipped', note: 'x' }), record({ kind: 'routine', target_id: 'h', occurrence_at: AT })]).split(' — ')[0], '2 records of the day match no stop');
  assert.equal(recordsUnplacedWords([{ record: record({ kind: 'routine', target_id: 'g', occurrence_at: AT }), detail: 'the routine\'s day cannot be read — timezone not recognised: "Mars/Olympus"' }]),
    `1 record could not be placed in a day — routine g at ${AT}: the routine's day cannot be read — timezone not recognised: "Mars/Olympus"`);
  assert.equal(stopRecordsFailedWords('x'), 'The stop records could not be read — x');
  assert.doesNotMatch(code(RULES), /\bfetch\b|new Date\(\)|Date\.now\(|@prisma\/client|from 'react'|\.get(Day|Month|Date|FullYear|Hours)\(|new Date\(\s*\w+\s*,/, 'pure, and never the process’s zone');
  assert.equal((code(RULES).match(/Date\.parse\(/g) ?? []).length, 2, 'Date.parse twice: behind the strict regex, and on the window’s own fixed-format day — never on a caller’s text as given');
});

// ── T4 · THE MIGRATION AND THE SCHEMA ────────────────────────────────────────

test('T4 the migration: the table with its CHECKs, three cascades, two partial unique indexes, the two ADD VALUEs — and it is the newest', () => {
  const sql = code(MIGRATION);
  assert.match(sql, /CREATE TABLE "operations_stop_records" \(/);
  assert.match(sql, /"routine_id"\s+UUID,/);
  assert.match(sql, /"step_id"\s+UUID,/);
  assert.match(sql, /"occurrence_at"\s+TIMESTAMPTZ\(6\)\s+NOT NULL/);
  assert.match(sql, /"outcome"\s+VARCHAR\(10\)\s+NOT NULL/);
  assert.match(sql, /"done_at"\s+TIMESTAMPTZ\(6\),/);
  assert.match(sql, /"actual_cents"\s+INTEGER,/);
  assert.match(sql, /"rating"\s+SMALLINT,/);
  assert.match(sql, /"note"\s+VARCHAR\(280\),/);
  assert.match(sql, /"actual_minutes"\s+INTEGER,/);
  assert.match(sql, /CONSTRAINT "operations_stop_records_one_plan" CHECK \(num_nonnulls\("routine_id", "step_id"\) = 1\)/);
  assert.match(sql, /CONSTRAINT "operations_stop_records_outcome" CHECK \("outcome" IN \('done', 'skipped'\)\)/);
  assert.match(sql, /CONSTRAINT "operations_stop_records_done_at_iff_done" CHECK \(\("done_at" IS NOT NULL\) = \("outcome" = 'done'\)\)/);
  assert.match(sql, /CONSTRAINT "operations_stop_records_skip_has_reason" CHECK \("outcome" <> 'skipped' OR "note" IS NOT NULL\)/);
  assert.match(sql, /CONSTRAINT "operations_stop_records_note_not_blank" CHECK \("note" IS NULL OR length\(btrim\("note"\)\) > 0\)/);
  assert.match(sql, /CONSTRAINT "operations_stop_records_cents_not_negative" CHECK \("actual_cents" IS NULL OR "actual_cents" >= 0\)/);
  assert.match(sql, /CONSTRAINT "operations_stop_records_rating_1_to_5" CHECK \("rating" IS NULL OR \("rating" BETWEEN 1 AND 5\)\)/);
  assert.match(sql, /CONSTRAINT "operations_stop_records_minutes_in_a_day" CHECK \("actual_minutes" IS NULL OR \("actual_minutes" BETWEEN 0 AND 1440\)\)/);
  for (const [col, table] of [['user_id', 'users'], ['routine_id', 'operations_routines'], ['step_id', 'operations_routine_steps']]) {
    assert.match(sql, new RegExp(`FOREIGN KEY \\("${col}"\\) REFERENCES "${table}"\\("id"\\) ON DELETE CASCADE ON UPDATE CASCADE`), `${col} cascades`);
  }
  assert.match(sql, /CREATE INDEX "operations_stop_records_user_id_occurrence_at_idx" ON "operations_stop_records"\("user_id", "occurrence_at"\)/);
  assert.match(sql, /CREATE UNIQUE INDEX "operations_stop_records_routine_occurrence_key" ON "operations_stop_records"\("routine_id", "occurrence_at"\) WHERE "routine_id" IS NOT NULL;/);
  assert.match(sql, /CREATE UNIQUE INDEX "operations_stop_records_step_occurrence_key" ON "operations_stop_records"\("step_id", "occurrence_at"\) WHERE "step_id" IS NOT NULL;/);
  assert.match(sql, /ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_stop_set';\s*ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_stop_cleared';/);
  assert.doesNotMatch(sql, /(^|\n)\s*(UPDATE|DELETE FROM|INSERT INTO)\s+"/, 'no row is written or moved');
  assert.doesNotMatch(sql, /DROP |task_id/, 'no task column — a task’s record is the task');
  assert.match(comments(MIGRATION), /AUTHORED here, applied at deploy/);
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
  assert.ok(MIGRATION_DIR.slice(0, 14) > '20261012090000', 'after STAY-01’s');
});

test('T4 the schema: the model column for column with the SQL; three relations; the two enum values, last, known to the client, listed by the audit-log route; the task summary carries completed_at', () => {
  const schema = code(SCHEMA);
  const model = /model operations_stop_records \{([\s\S]*?)\n\}/.exec(schema);
  assert.ok(model !== null);
  const m = model[1];
  assert.match(m, /id\s+String\s+@id @default\(dbgenerated\("gen_random_uuid\(\)"\)\) @db\.Uuid/);
  assert.match(m, /user_id\s+String\n/);
  assert.match(m, /routine_id\s+String\?\s+@db\.Uuid/);
  assert.match(m, /step_id\s+String\?\s+@db\.Uuid/);
  assert.match(m, /occurrence_at\s+DateTime\s+@db\.Timestamptz\(6\)/);
  assert.match(m, /outcome\s+String\s+@db\.VarChar\(10\)/);
  assert.match(m, /done_at\s+DateTime\?\s+@db\.Timestamptz\(6\)/);
  assert.match(m, /actual_cents\s+Int\?\n/);
  assert.match(m, /rating\s+Int\?\s+@db\.SmallInt/);
  assert.match(m, /note\s+String\?\s+@db\.VarChar\(280\)/);
  assert.match(m, /actual_minutes Int\?\n/);
  assert.match(m, /user\s+users\s+@relation\(fields: \[user_id\], references: \[id\], onDelete: Cascade\)/);
  assert.match(m, /routine operations_routines\?\s+@relation\(fields: \[routine_id\], references: \[id\], onDelete: Cascade\)/);
  assert.match(m, /step\s+operations_routine_steps\? @relation\(fields: \[step_id\], references: \[id\], onDelete: Cascade\)/);
  assert.match(m, /@@index\(\[user_id, occurrence_at\]\)/);
  assert.match(m, /@@map\("operations_stop_records"\)/);
  assert.doesNotMatch(m, /task/);
  assert.match(schema, /operations_stop_records\s+operations_stop_records\[\]/, 'the user’s relation');
  assert.equal((schema.match(/\n\s+stop_records\s+operations_stop_records\[\]/g) ?? []).length, 2, 'the routine’s and the line’s relations');
  const auditEnum = /enum AuditActionType \{([\s\S]*?)\}/.exec(schema);
  assert.ok(auditEnum !== null);
  const values = auditEnum[1].split(/\s+/).filter(Boolean);
  assert.deepEqual(values.slice(-2), ['operations_stop_set', 'operations_stop_cleared']);
  assert.equal(AuditActionType.operations_stop_set, 'operations_stop_set', 'prisma generate ran');
  assert.equal(AuditActionType.operations_stop_cleared, 'operations_stop_cleared');
  assert.match(code(AUDIT_LOG), /'operations_stay_set',\s*'operations_stay_deleted',\s*'operations_stop_set',\s*'operations_stop_cleared',\s*\],/);
  // The items route hands the card the task's own done-at; the summary type names it.
  assert.match(code(ITEMS_ROUTE), /actual_cost_usd: true,\s*actual_minutes: true,\s*completed_at: true,/);
  assert.match(code(ITEM_TYPES), /actual_minutes: number \| null;\s*completed_at: string \| null;/);
});

// ── T5 · THE ROUTES ──────────────────────────────────────────────────────────

test('T5 the routes: the caller proven, the day placed by each routine’s zone; the plan proven, the instant the day’s own stop, the same values written once, the race read back as 409, the audit after; DELETE by the owned row', () => {
  const r = code(ROUTE);
  for (const method of ['GET', 'POST']) assert.match(r, new RegExp(`export async function ${method}\\(`));
  assert.doesNotMatch(r, /export (const|function) (?!GET|POST)/, 'a route file exports its handlers only');
  const get = r.slice(r.indexOf('export async function GET('), r.indexOf('export async function POST('));
  assert.ok(get.indexOf('getVerifiedEmail()') < get.indexOf('prisma.users.findFirst('), 'the cookie first');
  assert.match(get, /if \(!isIsoDay\(day\)\) \{\n\s*return NextResponse\.json\(\{ error: 'Validation', field: 'day', message: `day \$\{JSON\.stringify\(day\)\} is not a 'YYYY-MM-DD' day` \}, \{ status: 400 \}\);/, 'the day is required, named when missing or not a day');
  assert.match(get, /where: \{ user_id: user\.id, occurrence_at: recordWindow\(day\) \}/, 'the caller’s rows in the any-zone window');
  assert.match(get, /const zone = row\.step !== null \? row\.step\.routine\.timezone : row\.routine !== null \? row\.routine\.timezone : null;/);
  assert.match(get, /localDay = instantToZoned\(row\.occurrence_at, zone\)\.date;/, 'placed by the routine’s own zone — the today read’s placing');
  assert.match(get, /unplaced\.push\(\{ record, detail: refusedWords\('timezone not recognised'/, 'an unreadable zone is named, never UTC');
  assert.match(get, /if \(localDay === day\) records\.push\(record\);/);
  assert.match(get, /return NextResponse\.json\(\{ day, records, unplaced \}\);/);
  const post = r.slice(r.indexOf('export async function POST('));
  const order = [
    'getVerifiedEmail()', 'prisma.users.findFirst(', 'raw = await request.json();', 'BODY_NOT_JSON_WORDS', 'status: 400', 'const now = new Date();', 'stopInput(raw, now)', 'if (!isValidUuid(v.id)) return NextResponse.json({ error: \'Not found\' }, { status: 404 });',
    "if (v.kind === 'routine_line')", 'prisma.operations_routine_steps.findFirst(', 'routine: { user_id: user.id }', 'if (!step.is_active) return', 'ARCHIVED_LINE_WORDS',
    'prisma.operations_routines.findFirst(', 'where: { id: v.id, user_id: user.id }', 'if (r.steps.length > 0) return', 'LINES_WORDS',
    'if (!routine.is_active) return', 'INACTIVE_ROUTINE_WORDS',
    'instantToZoned(v.instant, routine.timezone).date', 'routineDay(routine, localDay, now)', "if (that.kind === 'refused')", "if (that.kind === 'none')", 'noStopWords(instant, localDay, null)',
    'if (that.expectedAt.getTime() !== v.instant.getTime())', 'noStopWords(instant, localDay, that.expectedAt.toISOString())',
    'prisma.operations_stop_records.findFirst({ where: { user_id: user.id, routine_id: plan.routine_id, step_id: plan.step_id, occurrence_at: v.instant } })',
    'if (before !== null && unchanged(before, v)) return NextResponse.json({ record: before, changed: false });',
    'prisma.operations_stop_records.update({ where: { id: existing.id }, data })', 'prisma.operations_stop_records.create(', "error.code === 'P2002'", 'RACE_WORDS(instant)', 'status: 409',
    "type: 'operations_stop_set'", 'payload: { before, after }', 'status: before === null ? 201 : 200',
  ];
  let at = -1;
  for (const stepText of order) { const i = post.indexOf(stepText); assert.ok(i > at, `POST: ${stepText} comes after the step before it (at ${i}, previous ${at})`); at = i; }
  assert.match(post, /data: \{ user_id: user\.id, routine_id: plan\.routine_id, step_id: plan\.step_id, occurrence_at: v\.instant, \.\.\.data \}/, 'the write is the rule’s answer at the plan’s address');
  assert.match(post, /const data = \{ outcome: v\.outcome, done_at: v\.doneAt, actual_cents: v\.actualCents, rating: v\.rating, note: v\.note, actual_minutes: v\.actualMinutes \};/);
  assert.doesNotMatch(post, /project_task|operations_project_tasks/, 'a task has no record here');
  assert.equal((post.match(/is_active: true/g) ?? []).length, 4, 'the line’s flag, the routine’s flag in both branches, and the active-lines filter');
  assert.equal((post.match(/new Date\(\)/g) ?? []).length, 1, 'one clock for the rule and the day');
  // [id]: DELETE by { id, user_id }, the UUID gate before any query, delete then audit before → null.
  const i = code(ROUTE_ID);
  assert.match(i, /export async function DELETE\(/);
  assert.doesNotMatch(i, /export (const|function) (?!DELETE)/);
  assert.match(i, /if \(!isValidUuid\(id\)\) return NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\);/);
  assert.match(i, /prisma\.operations_stop_records\.findFirst\(\{ where: \{ id, user_id: user\.id \} \}\)/, 'the caller’s own row, proven in the handler');
  assert.ok(i.indexOf('prisma.operations_stop_records.delete({ where: { id: row.id } })') < i.indexOf("type: 'operations_stop_cleared'"), 'delete, then audit');
  assert.match(i, /payload: \{ before, after: null \}/);
  for (const f of [ROUTE, ROUTE_ID]) {
    const body = code(f);
    assert.equal((body.match(/getVerifiedEmail\(\)/g) ?? []).length, (body.match(/export async function/g) ?? []).length, `${f}: every handler proves the caller`);
    assert.doesNotMatch(body, /\$queryRaw|\$executeRaw/, `${f}: no raw SQL`);
    assert.match(body, /failClosedResponse\(/);
  }
});

// ── T6 · THE WRITER, THE READ, THE FORM AND THE PLATE ────────────────────────

test('T6 the one writer: POST / DELETE to the stops routes, the answer read as the week’s writer reads its own; the read through the one reader', async () => {
  const sent: { url: string; init?: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  let answer: () => Response = () => new Response(JSON.stringify({ record: { id: 'r1' }, changed: true }), { status: 201, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = (async (url: string, init?: RequestInit) => { sent.push({ url, init }); return answer(); }) as typeof fetch;
  const body = { kind: 'routine_line' as const, id: STEP_ID, instant: AT, outcome: 'done' as const, done_at: '2026-10-11T00:41:00.000Z', actual_cents: 1200, rating: 4, note: 'the oat milk', actual_minutes: 42 };
  try {
    assert.deepEqual(await setStopRecord(body), { ok: true });
    answer = () => new Response(JSON.stringify({ error: 'Validation', field: 'instant', message: `no stop at ${AT} — the routine has no stop on ${DAY}` }), { status: 400, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await setStopRecord(body), { ok: false, message: `no stop at ${AT} — the routine has no stop on ${DAY}` });
    answer = () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await clearStopRecord('gone'), { ok: false, message: 'Not found' });
    answer = () => new Response(JSON.stringify({}), { status: 500, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await clearStopRecord('r1'), { ok: false, message: 'failed to clear the stop record' });
    answer = () => new Response(JSON.stringify({ day: DAY, records: [coffeeDone], unplaced: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await readStopRecords(DAY), { ok: true, value: { records: [coffeeDone], unplaced: [] } });
    answer = () => new Response(JSON.stringify({ records: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    assert.deepEqual(await readStopRecords(DAY), { ok: false, words: 'The stop records could not be read — the records came back without their list' });
    answer = () => new Response('', { status: 401 });
    assert.deepEqual(await readStopRecords(DAY), { ok: false, words: 'The stop records could not be read — You are signed out — sign in to see this week.' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(sent.map((s) => [s.url, s.init?.method]), [
    ['/api/operations/stops', 'POST'], ['/api/operations/stops', 'POST'], ['/api/operations/stops/gone', 'DELETE'], ['/api/operations/stops/r1', 'DELETE'],
    [`/api/operations/stops?day=${DAY}`, undefined], [`/api/operations/stops?day=${DAY}`, undefined], [`/api/operations/stops?day=${DAY}`, undefined],
  ]);
  assert.equal(sent[0].init?.body, JSON.stringify(body));
  assert.deepEqual(sent[0].init?.headers, { 'Content-Type': 'application/json' });
  assert.equal((code(WRITES).match(/\bfetch\s*\(/g) ?? []).length, 2, 'two requests, in the one writer');
  assert.match(code(READS), /export async function readStopRecords\(day: string\)/);
  assert.equal((code(READS).match(/\bfetch\s*\(/g) ?? []).length, 0, 'the read goes through readJson');
});

test('T6 the form: under the plate on the step view, for a line or a routine only, keyed by the stop and its record; done now is one tap; the amount by the Budget’s rule; a refusal is the route’s own words; a clear asks first', () => {
  const f = code(FORM);
  assert.match(f, /^'use client';/m);
  assert.match(f, /import \{ clearStopRecord, setStopRecord, type StopBody \} from '\.\/stopWrites';/);
  assert.doesNotMatch(f, /\bfetch\s*\(|\/api\//, 'the form names no route and fetches nothing of its own');
  assert.doesNotMatch(f, /localStorage|sessionStorage|document\.cookie/, 'nothing stored');
  assert.match(f, /if \(stop\.address === null \|\| stop\.zone === null\) return null;/, 'a task has no form — its record is the task');
  assert.match(f, /const at = instantToZoned\(new Date\(\), zone\);\n\s*const d: Draft = \{ \.\.\.draft, outcome: 'done', doneDay: at\.date, doneTime: at\.time \};\n\s*setDraft\(d\);\n\s*save\(d\);/, 'done now: this moment in the routine’s zone, saved at once');
  assert.match(f, /doneAt = zonedToInstant\(d\.doneDay, d\.doneTime, zone\)\.toISOString\(\);/, 'the typed time is a wall clock in the routine’s zone');
  assert.match(f, /if \(!TIME_RE\.test\(d\.doneTime\)\) return \{ ok: false, message: WHEN_WORDS \};/);
  assert.match(f, /read = centsFromDecimalString\(d\.amount\);/, 'the amount by the Budget’s rule — string arithmetic');
  assert.match(f, /if \(!read\.ok\) return \{ ok: false, message: amountWords\(d\.amount\) \};/);
  assert.match(f, /if \(!\/\^\\d\+\$\/\.test\(d\.minutes\.trim\(\)\)\) return \{ ok: false, message: minutesTypedWords\(d\.minutes\) \};/);
  assert.match(f, /if \(read\.cents < 0\) return \{ ok: false, message: NEGATIVE_AMOUNT_WORDS \};/, 'a negative amount refused before any request');
  assert.match(f, /if \(d\.outcome === 'skipped' && note === ''\) return \{ ok: false, message: SKIP_REASON_WORDS \};/, 'a skipped stop without its reason refused before any request');
  assert.equal((f.match(/if \(!answer\.ok\) \{ setWords\(answer\.message\); return; \}/g) ?? []).length, 2, 'a refusal is the route’s own words — on save AND on clear');
  assert.match(f, /if \(r === null \|\| busy \|\| !window\.confirm\(clearStopQuestion\(statusWords\(stop, day\)\)\)\) return;/, 'a clear asks first, in the rules’ words');
  assert.match(f, /if \(busy\) return;\n\s*const read = bodyOf\(d\);/, 'no double submit');
  assert.match(f, /title=\{RATING_WORDS\[n\]\}/, 'each star carries its sentence');
  for (const attr of ['data-stop-form', 'data-stop-done-now', 'data-stop-outcome=', 'data-stop-time', 'data-stop-amount', 'data-stop-rating', 'data-stop-minutes', 'data-stop-note', 'data-stop-clear', 'data-stop-words']) assert.ok(f.includes(attr), `the form carries ${attr}`);
  assert.doesNotMatch(f, /\b(bg-black|bg-brand-purple|bg-panel|bg-brand-red|bg-brand-gold|bg-brand-green)\b/, 'no dark fill (the repaint law)');
  // The plate: the records read with their day, the form keyed by the stop and its record, the spent line, the step card's record block.
  const c = code(CARD);
  assert.match(c, /useState<\{ readonly day: string; readonly read: Read<StopRecordsAnswer> \} \| null>\(null\)/);
  assert.match(c, /if \(live\) setRecords\(\{ day, read: r \}\);/, 'the read lands with its day, under the live guard');
  assert.match(c, /const recordsRead = records !== null && records\.day === day \? records\.read : null;/);
  assert.match(c, /const recordRows = recordsRead !== null && recordsRead\.ok \? recordsRead\.value\.records : null;/, 'not read is null — unknown, never none');
  assert.match(c, /const loaded = dayRead !== null && report !== null && items !== null && recordsRead !== null;/, 'the plate waits for the records too');
  assert.doesNotMatch(c, /setRecords\(null\)/, 'a re-read never blanks the plate first');
  assert.match(c, /dayStops\(\{ day, entries, lines, notPlaced, items: dayItems, viewerZone: zone, records: recordRows \}\)/);
  assert.match(c, /<StopForm key=\{`\$\{focus\.stop\.key\}:\$\{focus\.stop\.record === null \? 'none' : focus\.stop\.record\.id\}`\} stop=\{focus\.stop\} day=\{day\} onChanged=\{\(\) => setRecordReads\(\(n\) => n \+ 1\)\} \/>/);
  assert.ok(c.indexOf('data-day-card') < c.indexOf('<StopForm'), 'the form sits under the plate');
  assert.ok(c.indexOf('<StopForm') < c.indexOf('data-day-foot'), '— above the sentences');
  assert.match(c, /\{loaded && recordsOk && focus !== null && focus\.stop\.address !== null && \(/, 'on the step view, for a stop that has an address — never while the records could not be read');
  assert.match(c, /data-day-spent>\{spentLineWords\(result\.spentCents, result\.withoutActual, result\.done, dayFailed \? null : N\)\}/, 'the spent line under the hook');
  assert.match(c, /data-day-status>\{statusWords\(focus\.stop, day\)\}/);
  assert.match(c, /data-day-actual>\{planDollars\(focus\.stop\.actualCents\)\}/);
  assert.match(c, /\{delta !== null && delta\.over !== null && <div className=\{`font-semibold tabular-nums \$\{actualTone\(delta\.over\)\}`\} style=\{\{ fontSize: 23, lineHeight: 1\.1 \}\} data-day-delta>\{delta\.text\}<\/div>\}/, 'the delta only when both figures are known');
  assert.match(c, /data-day-rating>\{ratingWords\(focus\.stop\.record\.rating\)\}/);
  assert.match(c, /data-day-spent-so-far>\{spentSoFarWords\(focus\.spentSoFarCents, focus\.withoutActualSoFar\)\}/);
  assert.match(c, /if \(status === 'skipped'\) return <span className="text-text-muted" aria-label="skipped">–<\/span>;/);
  assert.match(c, /const actualTone = \(over: boolean \| null\): string => \(over === null \? 'text-text-muted' : over \? 'text-brand-red' : 'text-brand-green'\);/);
  assert.match(c, /data-day-records-without-stop>\{recordsWithoutStopWords\(result\.recordsWithoutStop\)\}/);
  assert.match(c, /data-day-records-unplaced>\{recordsUnplacedWords\(unplacedRecords\)\}/);
  assert.match(c, /data-day-records-failed>\{recordsRead\.words\}/);
  assert.doesNotMatch(code(CARD_RULES), /sum \+ \(s\.actualCents === null \? 0/, 'an unknown is never summed as zero');
  assert.match(code(CARD_RULES), /stops\.map\(\(s\) => s\.actualCents\)\.filter\(\(c\): c is number => c !== null\)\.reduce/, 'the sum is over the actuals that exist');
  // A Stop carries what the form and the plate need, nothing the lines law forbids the day folder.
  const keys: (keyof Stop)[] = ['kind', 'key', 'time', 'label', 'line', 'place', 'minutes', 'cents', 'status', 'statusSource', 'address', 'zone', 'record', 'actualCents', 'actualSource', 'doneAt', 'lateMinutes', 'actualMinutes'];
  const sample = dayStops(input({ entries: [entry(morning)], records: [coffeeDone] })).stops[0];
  assert.deepEqual(Object.keys(sample).sort(), [...keys].sort());
});
