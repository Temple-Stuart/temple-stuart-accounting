/**
 * JOURNAL-01 (2026-10-13) — THE JOURNAL STOP ASKS THE MORNING'S QUESTIONS; YESTERDAY'S NUMBERS ABOVE THEM.
 *
 * The rule (src/lib/operations/journal.ts) and yesterday's tally (day/dayCard.ts
 * dayTally) are pure and DRIVEN over fixtures; the writer and the read are driven
 * over a stubbed fetch; the migration, the schema, the routes, the form and the
 * plate are anchored to their source with comments stripped (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditActionType } from '@prisma/client';
import { code, comments } from '../sourceText';
// JOURNAL-02 (2026-10-13): the rule became five answers — the retired words (QUESTION_WORDS, PAIRS, INDEPENDENT_FIELDS, pairWords,
// answerLine, pairLine, SHIPPED_HINT_WORDS, NO_YESTERDAY_WORDS) and dayCard's tallyShippedWords are deleted; their pins moved below,
// dated, and journal02.test.ts pins the new rule, the lists and the ticks.
// CLEAN-02 (2026-10-14): the journal card shows no money and no source line — yesterday's tally (dayTally and its words), todayPlanWords,
// typedAtWords, stopNameOf, journalProvenanceWords, typedWords, typedOnWords, NONE_TYPED_WORDS, JOURNAL_NOT_READ_WORDS and
// yesterdayFailedWords are deleted; their pins moved below, dated (T1, T2, T6).
import {
  ANSWER_FIELDS, ANSWER_MAX, BIDI_WORDS, BODY_WORDS, CONTROLS_WORDS, JOURNAL_LOADING_WORDS, NO_ANSWERS,
  NOTHING_TYPED_WORDS, PLAN_BLOCK_WORD, RACE_WORDS, RETIRED_FIELDS, TODAY_BLOCK_WORD, UNANSWERED_WORD, YESTERDAY_LOADING_WORDS, YESTERDAY_WORD,
  answersOf, asJournalDate, clearJournalQuestion, dayWords, journalInput, journalRowOf, journalUnchanged, noJournalWords, notStringWords,
  tooLongWords, tooManyWords,
  type Answers,
} from '../operations/journal';
import { asksAmount, dayStops, type DayCardInput } from '@/components/workbench/operations/day/dayCard';
import { journalFailedWords, readJournal } from '@/components/workbench/operations/day/dayReads';
import { CLEAR_FAILED_WORDS, SET_FAILED_WORDS, clearJournal, setJournal } from '@/components/workbench/operations/stops/journalWrites';
import { SIGNED_OUT_WORDS } from '@/components/workbench/operations/week/weekReads';
import type { DailyPlanItem } from '@/components/workbench/operations/dailyplan/types';
import type { Routine, RoutineStep, TodayRoutineEntry, TodayStatus } from '@/components/workbench/operations/routines/types';
import type { PlanLine } from '../budget/planLines';
import type { StopRecordRow } from '../operations/stopRecord';

const RULE = 'src/lib/operations/journal.ts';
const CARD_RULES = 'src/components/workbench/operations/day/dayCard.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const READS = 'src/components/workbench/operations/day/dayReads.ts';
const WRITES = 'src/components/workbench/operations/stops/journalWrites.ts';
const FORM = 'src/components/workbench/operations/stops/JournalForm.tsx';
const STOP_FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const ROUTE = 'src/app/api/operations/journal/route.ts';
const ROUTE_ID = 'src/app/api/operations/journal/[id]/route.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261013120000_journal_01_day_journals';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;
const AUDIT_LOG = 'src/app/api/audit-log/route.ts';
/** JOURNAL-01's thirteen columns and their lengths — the migration's history, fixed; JOURNAL-02 retired eleven of them and kept all thirteen in the table. */
const JOURNAL_01_COLUMNS = {
  adjustment: 280, one_thing: 120, witness: 120, blocker: 280, shipped: 500,
  plan_1_if: 160, plan_1_then: 160, plan_2_if: 160, plan_2_then: 160, plan_3_if: 160, plan_3_then: 160, obstacle_if: 160, obstacle_then: 160,
} as const;
const JOURNAL_01_PAIRS = [['plan_1_if', 'plan_1_then'], ['plan_2_if', 'plan_2_then'], ['plan_3_if', 'plan_3_then'], ['obstacle_if', 'obstacle_then']] as const;
const MIDDLEWARE = 'src/middleware.ts';

// ── FIXTURES (the day card's, daycard01.test.ts / stop01.test.ts) ────────────

const DAY = '2026-10-11';
const BKK = 'Asia/Bangkok';
/** 07:00 Bangkok on the day. */
const AT = '2026-10-11T00:00:00.000Z';
const GYM_AT = '2026-10-11T13:00:00.000Z';
/** 06:00 Bangkok on the day. */
const VISION_AT = '2026-10-10T23:00:00.000Z';
const STEP_ID = '0f2a7c1e-1111-4a2b-8c3d-000000000001';
const STRETCH_ID = '0f2a7c1e-3333-4a2b-8c3d-000000000003';
const GYM_ID = '0f2a7c1e-2222-4a2b-8c3d-000000000002';
const VISION_ID = '0f2a7c1e-4444-4a2b-8c3d-000000000004';

const step = (over: Partial<RoutineStep> & { id: string; step_order: number; activity: string }): RoutineStep => ({
  routine_id: 'morning', user_id: 'u', entity_id: 'P', time_of_day: null, sub_activity: null, location: null, duration_minutes: null,
  notes: null, created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, ...over,
});
const routine = (over: Partial<Routine> & { id: string; name: string }): Routine => ({
  user_id: 'u', entity_id: 'P', description: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0', timezone: BKK,
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: null, end_time: null, is_active: true,
  created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, budget_amount: null, coa_code: null,
  location: null, steps: [], role: 'none', ...over,
});
const entry = (r: Routine, status: TodayStatus = 'pending', expected_at: string = AT): TodayRoutineEntry => ({ routine: r, expected_at, status, completion: null });
const line = (over: Partial<PlanLine> & { address: PlanLine['address']; cents: number; label: string }): PlanLine => ({
  entityId: 'P', code: '5100', day: DAY, source: 'routine', line: null, time: null, vendor: null, ...over,
});
const item = (over: Partial<DailyPlanItem> & { id: string }): DailyPlanItem => ({
  user_id: 'u', entity_id: 'P', plan_date: `${DAY}T00:00:00.000Z`, task_id: null, ad_hoc_title: null, ad_hoc_description: null, display_order: 0,
  notes: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z', created_by: null, task: null, calendar_blocks: [], ...over,
});
const task = (id: string, title: string, status: NonNullable<DailyPlanItem['task']>['status'], actual_cost_usd: string | null, completed_at: string | null) => ({
  id, title, status, project_id: 'proj', coa_code: null, estimated_cost_usd: null, actual_cost_usd, actual_minutes: null, completed_at,
});
const record = (over: Partial<StopRecordRow> & { kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  id: `rec-${over.target_id}`, outcome: 'done', done_at: null, actual_cents: null, rating: null, note: null, actual_minutes: null, ...over,
});

const morning = routine({
  id: 'morning', name: 'Morning', steps: [
    step({ id: STRETCH_ID, step_order: 1, activity: 'Stretch', time_of_day: '1970-01-01T06:30:00.000Z' }),
    step({ id: STEP_ID, step_order: 2, activity: 'Coffee', time_of_day: '1970-01-01T07:30:00.000Z' }),
    step({ id: 'journal-step', step_order: 3, activity: 'Journal' }),
  ],
});
const gym = routine({ id: GYM_ID, name: 'Gym', role: 'place', schedule_rrule: 'FREQ=DAILY;BYHOUR=20;BYMINUTE=0' });
const vision = routine({ id: VISION_ID, name: 'Vision', role: 'journal', schedule_rrule: 'FREQ=DAILY;BYHOUR=6;BYMINUTE=0' });
const lines = [
  line({ address: { kind: 'routine_line', id: STEP_ID, instant: AT }, cents: 1000, label: 'Morning', line: 'Coffee', time: '07:30' }),
  line({ address: { kind: 'routine_line', id: STRETCH_ID, instant: AT }, cents: 800, label: 'Morning', line: 'Stretch', time: '06:30' }),
  line({ address: { kind: 'routine', id: GYM_ID, instant: GYM_AT }, cents: 2000, label: 'Gym', time: '20:00' }),
];
const items = [
  // Done on the day (12:00 Bangkok): shipped. Done the day before: done, not shipped. Open, with no actual.
  item({ id: 'i-ship', task_id: 't-ship', task: task('t-ship', 'Ship it', 'completed', '7.50', '2026-10-11T05:00:00.000Z') }),
  item({ id: 'i-old', task_id: 't-old', task: task('t-old', 'Old one', 'completed', null, '2026-10-10T05:00:00.000Z') }),
  item({ id: 'i-open', task_id: 't-open', task: task('t-open', 'Open one', 'open', null, null) }),
];
const coffee = (cents: number | null) => record({ kind: 'routine_line', target_id: STEP_ID, occurrence_at: AT, done_at: '2026-10-11T00:41:00.000Z', actual_cents: cents });
const stretch = (cents: number | null) => record({ kind: 'routine_line', target_id: STRETCH_ID, occurrence_at: AT, done_at: '2026-10-10T23:31:00.000Z', actual_cents: cents });
const gymSkipped = record({ kind: 'routine', target_id: GYM_ID, occurrence_at: GYM_AT, outcome: 'skipped', note: 'closed' });
const input = (over: Partial<DayCardInput> = {}): DayCardInput => ({
  day: DAY, entries: [entry(morning), entry(gym, 'pending', GYM_AT), entry(vision, 'pending', VISION_AT)], lines, notPlaced: [], items, viewerZone: BKK, records: null, ...over,
});

const refused = (body: unknown) => {
  const r = journalInput(body);
  assert.ok(!r.ok, `refused: ${JSON.stringify(body)}`);
  return r.ok ? null : { field: r.field, message: r.message };
};
const accepted = (body: unknown): Answers => {
  const r = journalInput(body);
  assert.ok(r.ok, `accepted: ${JSON.stringify(body)} — ${r.ok ? '' : r.message}`);
  return r.ok ? r.value.answers : NO_ANSWERS;
};

// ── T1 · THE RULE ────────────────────────────────────────────────────────────

// JOURNAL-02 (2026-10-13): the answers are five — goals, blocker, plan_steps, plan_done, shipped. Each JOURNAL-01 guarantee below is
// pinned on the live text answers (blocker, shipped) where it was pinned on a retired one; journal02.test.ts pins the lists.
test('T1 journalInput: the body, the day, each answer trimmed and collapsed; nothing filled in; the answers built from ANSWER_FIELDS alone', () => {
  for (const body of [null, 'x', 7, [DAY]]) assert.deepEqual(refused(body), { field: 'day', message: BODY_WORDS });
  for (const bad of ['2026-13-01', '2026-02-30', 'today', '2026-9-3', '', undefined]) assert.deepEqual(refused({ day: bad, blocker: 'x' }), { field: 'day', message: dayWords(bad) });
  const a = accepted({ day: DAY, blocker: '  ship   the\tPR ' });
  assert.equal(a.blocker, 'ship the PR', 'trimmed, runs of whitespace one space');
  assert.deepEqual(Object.keys(a), [...ANSWER_FIELDS], 'the five answers, in the plate’s order — and nothing else');
  assert.deepEqual([a.goals, a.plan_steps, a.plan_done, a.shipped], [[], [], [], null], 'absent lists are empty, an absent text null — never ""');
  assert.equal(accepted({ day: DAY, blocker: 'x', shipped: null }).shipped, null, 'null is absent too');
  // No key of the body passes through — not a prototype, not an id, not an owner, not a stamp.
  const smuggled = journalInput(JSON.parse(`{"day":"${DAY}","blocker":"x","__proto__":{"evil":true},"id":"mine","user_id":"someone","created_at":"1970","constructor":"c"}`));
  assert.ok(smuggled.ok);
  if (smuggled.ok) {
    const keys = Object.keys(smuggled.value.answers);
    assert.deepEqual(keys, [...ANSWER_FIELDS]);
    assert.equal(Object.getPrototypeOf(smuggled.value.answers), Object.prototype);
    for (const k of ['evil', 'id', 'user_id', 'created_at']) assert.equal(Object.hasOwn(smuggled.value.answers, k), false, `${k} does not pass through`);
    assert.equal((smuggled.value.answers as unknown as Record<string, unknown>).evil, undefined);
    assert.equal(smuggled.value.day, DAY);
  }
});

test('T1 journalInput refuses by name: a non-string, C0 and C1 controls, a lone surrogate, the bidi controls — and keeps a ZWJ emoji', () => {
  assert.deepEqual(refused({ day: DAY, shipped: 5 }), { field: 'shipped', message: notStringWords('shipped') });
  assert.deepEqual(refused({ day: DAY, blocker: ['x'] }), { field: 'blocker', message: notStringWords('blocker') });
  assert.deepEqual(refused({ day: DAY, blocker: 'a\u0007b' }), { field: 'blocker', message: CONTROLS_WORDS }, 'a C0 control');
  assert.deepEqual(refused({ day: DAY, blocker: 'a\u0085b' }), { field: 'blocker', message: CONTROLS_WORDS }, 'a C1 control');
  assert.deepEqual(refused({ day: DAY, blocker: 'a\ud83db' }), { field: 'blocker', message: CONTROLS_WORDS }, 'a high surrogate with no partner');
  assert.deepEqual(refused({ day: DAY, blocker: 'a\udc00b' }), { field: 'blocker', message: CONTROLS_WORDS }, 'a low surrogate with no partner');
  assert.deepEqual(refused({ day: DAY, shipped: 'x‮y' }), { field: 'shipped', message: BIDI_WORDS }, 'RLO reverses the plate');
  assert.deepEqual(refused({ day: DAY, shipped: '⁦x⁩' }), { field: 'shipped', message: BIDI_WORDS }, 'the isolates too');
  assert.equal(accepted({ day: DAY, blocker: '👨‍👩‍👧 family' }).blocker, '👨‍👩‍👧 family', 'a ZWJ sequence is visible — \\p{Cf} is not refused outright');
  assert.equal(accepted({ day: DAY, blocker: 'café' }).blocker, 'café');
  assert.equal(accepted({ day: DAY, blocker: 'café' }).blocker, 'café', 'a combining mark on a letter stays');
});

test('T1 journalInput: an answer that is nothing visible is unanswered; the length is in code points and the refusal says "characters"', () => {
  assert.equal(accepted({ day: DAY, blocker: 'x', shipped: '​‍‌' }).shipped, null, 'format characters alone are no answer');
  assert.equal(accepted({ day: DAY, blocker: 'x', shipped: '́̈' }).shipped, null, 'nonspacing marks alone are no answer');
  assert.equal(accepted({ day: DAY, blocker: 'x', shipped: '   ' }).shipped, null, 'a blank is no answer');
  const atColumn = accepted({ day: DAY, blocker: 'a'.repeat(280) }).blocker;
  assert.ok(atColumn !== null && [...atColumn].length === 280, 'at the column');
  assert.deepEqual(refused({ day: DAY, blocker: 'a'.repeat(281) }), { field: 'blocker', message: tooLongWords('blocker', 281) });
  assert.match(tooLongWords('blocker', 281), /characters/);
  assert.equal(accepted({ day: DAY, blocker: '😀'.repeat(280) }).blocker, '😀'.repeat(280), '280 code points (560 UTF-16 units) fit the column, which counts characters');
  assert.deepEqual(refused({ day: DAY, blocker: '😀'.repeat(281) }), { field: 'blocker', message: tooLongWords('blocker', 281) }, 'counted in code points');
  assert.deepEqual(refused({ day: DAY, shipped: 'x'.repeat(501) }), { field: 'shipped', message: tooLongWords('shipped', 501) });
  assert.deepEqual(ANSWER_MAX, { blocker: 280, shipped: 500 }, 'the two text answers; JOURNAL_01_COLUMNS keeps the retired columns’ lengths for the migration’s pins');
});

// JOURNAL-02 (2026-10-13): the "if … then …" pairs and the obstacle are RETIRED — never read from a body, so a pair is no longer refused
// half-given; the pins on the pair rule moved to "a retired key is ignored" (journal02.test.ts) and the table's pair CHECKs (T3, below).
test('T1 journalInput: all five unanswered is refused; unchanged; the row and the date', () => {
  const retiredOnly = Object.fromEntries(RETIRED_FIELDS.map((f) => [f, 'typed']));
  for (const body of [{ day: DAY }, { day: DAY, blocker: '   ' }, { day: DAY, blocker: null, shipped: '​' }, { day: DAY, goals: [], plan_steps: [], plan_done: [] }, { day: DAY, ...retiredOnly }]) {
    assert.deepEqual(refused(body), { field: 'goals', message: NOTHING_TYPED_WORDS }, JSON.stringify(body));
  }
  assert.equal(NOTHING_TYPED_WORDS, 'nothing typed — a journal is at least one answer');
  const retired = Object.fromEntries(RETIRED_FIELDS.map((f) => [f, null])) as Record<(typeof RETIRED_FIELDS)[number], string | null>;
  const row = journalRowOf({ ...NO_ANSWERS, ...retired, one_thing: 'kept', blocker: 'x', id: 'j1', day: new Date('2026-10-11T00:00:00.000Z'), updated_at: new Date('2026-10-10T23:40:00.000Z') });
  assert.deepEqual(row, { ...NO_ANSWERS, blocker: 'x', retired: { ...retired, one_thing: 'kept' }, id: 'j1', day: DAY, typed_at: '2026-10-10T23:40:00.000Z' }, 'the retired answers ride `retired`, for the audit log');
  assert.equal(journalUnchanged(row, answersOf({ blocker: 'x' })), true);
  assert.equal(journalUnchanged(row, answersOf({ blocker: 'y' })), false);
  assert.equal(journalUnchanged(row, answersOf({ blocker: 'x', shipped: 'me' })), false);
  assert.deepEqual(asJournalDate(DAY), new Date('2026-10-11T00:00:00.000Z'), 'UTC midnight — the @db.Date convention (stay.ts asDate)');
  assert.equal(code('src/lib/operations/stay.ts').includes("export const asDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);"), true);
  assert.equal(code(RULE).includes("export const asJournalDate = (day: string): Date => new Date(`${day}T00:00:00.000Z`);"), true, 'the same convention, word for word');
});

test('T1 the words — each a constant or a function, exact', () => {
  // JOURNAL-02 (2026-10-13): QUESTION_WORDS, SHIPPED_HINT_WORDS and NO_YESTERDAY_WORDS are deleted (the retired answers' labels, the old
  // shipped box's hint, and the line noJournalWords now says); answerLine, pairLine and pairWords with them. journal02.test.ts pins the new words.
  assert.equal(YESTERDAY_WORD, 'YESTERDAY');
  assert.equal(TODAY_BLOCK_WORD, 'TODAY');
  assert.equal(PLAN_BLOCK_WORD, 'PLAN');
  assert.equal(UNANSWERED_WORD, '—');
  assert.equal(JOURNAL_LOADING_WORDS, 'reading the journal…');
  // CLEAN-02 (2026-10-14): JOURNAL_NOT_READ_WORDS, yesterdayFailedWords, typedWords, typedOnWords, NONE_TYPED_WORDS and journalProvenanceWords
  // (the source line's and the tally's words) are deleted — a failed read still prints its own words on the plate (T6).
  for (const gone of ['JOURNAL_NOT_READ_WORDS', 'yesterdayFailedWords', 'typedWords', 'typedOnWords', 'NONE_TYPED_WORDS', 'journalProvenanceWords']) assert.doesNotMatch(code(RULE), new RegExp(`\\b${gone}\\b`), `${gone} is deleted`);
  assert.equal(noJournalWords('Sat Oct 11'), 'nothing typed for Sat Oct 11');
  assert.equal(YESTERDAY_LOADING_WORDS, 'reading yesterday…');
  assert.equal(clearJournalQuestion('Sat Oct 11'), 'Clear the journal for Sat Oct 11? The audit log keeps it; the card forgets it.');
  assert.equal(RACE_WORDS(DAY), `the journal for ${DAY} was written moments ago — read the day again`);
  assert.equal(BODY_WORDS, 'the body must be an object with day and the answers');
  assert.equal(CONTROLS_WORDS, 'control characters are not an answer');
  assert.equal(BIDI_WORDS, 'direction-reversing characters (U+202A–U+202E, U+2066–U+2069) are not an answer');
  // The sentences themselves — the refusals above prove the field and the function; these prove the words.
  assert.equal(dayWords('2026-13-01'), 'day "2026-13-01" is not a \'YYYY-MM-DD\' day');
  assert.equal(dayWords(undefined), 'day undefined is not a \'YYYY-MM-DD\' day');
  assert.equal(notStringWords('blocker'), 'blocker must be a string');
  assert.equal(tooLongWords('blocker', 281), 'blocker is at most 280 characters (281 given)');
  assert.equal(tooLongWords('shipped', 501), 'shipped is at most 500 characters (501 given)');
  assert.doesNotMatch(code(RULE), /\bfetch\b|new Date\(\)|Date\.now\(|@prisma\/client|from 'react'/, 'pure: no fetch, no clock, no Prisma, no React');
});

// ── T2 · YESTERDAY'S TALLY — GONE (CLEAN-02, 2026-10-14) ────────────────────

test('T2 CLEAN-02: yesterday’s tally is gone — the journal card shows no money; the day’s own rules still count, and asksAmount stays for the verdict', () => {
  // CLEAN-02 (2026-10-14) — Alex's ruling: no money on the journal card. dayTally (DayTally), tallySpentWords, tallyLargestWords,
  // tallyDoneWords, todayPlanWords, typedAtWords and stopNameOf had no other reader and are deleted; the JOURNAL-01 / PLAN-01 pins on
  // their words ("$24.50 spent · $38 planned · 4 without an amount", "▼ $3 under — Stretch", "4 of 8 done · 1 skipped — Gym", "$31
  // planned · 7 stops", "typed Oct 12 06:40") went with them. Yesterday on the card is its plan's ticks (journal02.test.ts).
  for (const gone of ['dayTally', 'DayTally', 'tallySpentWords', 'tallyLargestWords', 'tallyDoneWords', 'todayPlanWords', 'typedAtWords', 'stopNameOf', 'withoutAmount']) {
    assert.doesNotMatch(code(CARD_RULES), new RegExp(`\\b${gone}\\b`), `${gone} is deleted`);
  }
  // What the tally read is still the day's own count — unchanged by the deletion: the actuals that exist summed, the task's own among them.
  const r = dayStops(input({ records: [coffee(1200), stretch(500), gymSkipped] }));
  assert.equal(r.stops.length, 8, 'five routine stops and three tasks');
  assert.equal(r.spentCents, 1200 + 500 + 750, 'the typed actuals and the task’s own');
  assert.equal(r.withActual, 3, 'the coffee, the stretch, the task’s own');
  assert.deepEqual([r.done, r.skipped], [4, 1], 'Coffee, Stretch, Ship it, Old one done; Gym skipped');
  // asksAmount stays — the full card's verdict reads it (dayCard.ts dayVerdict, daycard01.test.ts T7).
  assert.deepEqual([asksAmount('place'), asksAmount('none'), asksAmount('journal'), asksAmount('plan'), asksAmount('execute'), asksAmount('all_day')], [true, true, false, false, false, false], 'StopForm’s asks: a place and no role ask the amount');
  assert.match(code(CARD_RULES), /export const asksAmount = \(role: StopRole\): boolean => role === 'place' \|\| role === 'none';/);
  assert.match(code(CARD_RULES), /if \(result\.stops\.some\(\(s\) => asksAmount\(s\.role\) && s\.actualCents === null\)\) return null;/, 'the verdict waits on every stop that asks an amount');
  assert.doesNotMatch(code(CARD_RULES), /\bfetch\b|new Date\(\)|Date\.now\(|from 'react'|@prisma\/client/, 'still pure');
});

// ── T3 · THE MIGRATION AND THE SCHEMA ────────────────────────────────────────

test('T3 the migration: the table column for column, the UNIQUE named, four pair CHECKs, not-blank, at-least-one, the cascade, the two ADD VALUEs — nothing written, nothing dropped, the newest', () => {
  const sql = code(MIGRATION);
  assert.match(sql, /CREATE TABLE "operations_day_journals" \(/);
  assert.match(sql, /"id"\s+UUID\s+NOT NULL DEFAULT gen_random_uuid\(\),/);
  assert.match(sql, /"user_id"\s+TEXT\s+NOT NULL,/);
  assert.match(sql, /"day"\s+DATE\s+NOT NULL,/);
  for (const [f, n] of Object.entries(JOURNAL_01_COLUMNS)) assert.match(sql, new RegExp(`"${f}"\\s+VARCHAR\\(${n}\\),`), `${f} VARCHAR(${n}), nullable`);
  assert.match(sql, /"created_at"\s+TIMESTAMPTZ\(6\) NOT NULL DEFAULT CURRENT_TIMESTAMP,/);
  assert.match(sql, /"updated_at"\s+TIMESTAMPTZ\(6\) NOT NULL,\n/, 'no DB default — @updatedAt writes it');
  assert.match(sql, /CONSTRAINT "operations_day_journals_pkey" PRIMARY KEY \("id"\),/);
  assert.match(sql, /CONSTRAINT "operations_day_journals_one_per_day" UNIQUE \("user_id", "day"\),/);
  for (const [ifField, thenField] of JOURNAL_01_PAIRS) {
    const name = ifField === 'obstacle_if' ? 'obstacle_pair' : `${ifField.replace(/_if$/, '')}_pair`;
    assert.match(sql, new RegExp(`CONSTRAINT "operations_day_journals_${name}" CHECK \\(\\("${ifField}" IS NULL\\) = \\("${thenField}" IS NULL\\)\\),`), `${ifField} with ${thenField}, both or neither`);
  }
  const notBlank = /CONSTRAINT "operations_day_journals_answers_not_blank" CHECK \(([\s\S]*?)\n  \),/.exec(sql);
  assert.ok(notBlank !== null, 'the not-blank CHECK');
  for (const f of Object.keys(JOURNAL_01_COLUMNS)) assert.ok(notBlank![1].includes(`("${f}" IS NULL OR length(btrim("${f}")) > 0)`), `${f} not blank`);
  assert.match(sql, /CONSTRAINT "operations_day_journals_at_least_one" CHECK \(\n\s*num_nonnulls\("adjustment", "one_thing", "plan_1_if", "plan_2_if", "plan_3_if", "obstacle_if", "blocker", "witness", "shipped"\) >= 1\n\s*\)/, 'the nine independent answers — each _if standing for its pair');
  assert.match(sql, /ADD CONSTRAINT "operations_day_journals_user_id_fkey"\s+FOREIGN KEY \("user_id"\) REFERENCES "users"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE;/);
  assert.match(sql, /ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_journal_set';\s*ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_journal_cleared';/);
  assert.doesNotMatch(sql, /(^|\n)\s*(UPDATE|DELETE FROM|INSERT INTO)\s+"/, 'no row is written or moved');
  assert.doesNotMatch(sql, /DROP /);
  assert.doesNotMatch(sql, /spent|planned_cents|largest|done_count/, 'the numbers are not columns');
  assert.match(comments(MIGRATION), /AUTHORED here, applied at deploy/);
  assert.match(comments(MIGRATION), /never stored/, 'why the numbers are not columns');
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  // JOURNAL-02 (2026-10-13): the simple journal's migration is newer — this one is the one before it. The pin moved; the order holds.
  assert.equal(dirs[dirs.length - 2], MIGRATION_DIR, 'the migration before the newest (JOURNAL-02 followed)');
  assert.equal(dirs[dirs.length - 1], '20261013200000_journal_02_the_simple_journal', 'the newest migration');
  assert.ok(MIGRATION_DIR.slice(0, 14) > '20261013030000', 'after ROLE-01’s');
});

test('T3 the schema: the model column for column with the SQL, the map: name equal to the SQL constraint’s, the user’s relation; the two enum values, last, known to the client, listed by the audit-log route', () => {
  const schema = code(SCHEMA);
  const sql = code(MIGRATION);
  const model = /model operations_day_journals \{([\s\S]*?)\n\}/.exec(schema);
  assert.ok(model !== null);
  const m = model![1];
  assert.match(m, /id\s+String\s+@id @default\(dbgenerated\("gen_random_uuid\(\)"\)\) @db\.Uuid/);
  assert.match(m, /user_id\s+String\n/);
  assert.match(m, /day\s+DateTime @db\.Date/);
  // JOURNAL-02 (2026-10-13): all thirteen JOURNAL-01 columns stay in the model (eleven retired, none dropped); journal02.test.ts pins the three lists.
  for (const [f, n] of Object.entries(JOURNAL_01_COLUMNS)) assert.match(m, new RegExp(`\\n\\s+${f}\\s+String\\?\\s+@db\\.VarChar\\(${n}\\)`), `${f} String? VarChar(${n})`);
  assert.match(m, /created_at\s+DateTime @default\(now\(\)\) @db\.Timestamptz\(6\)/);
  assert.match(m, /updated_at\s+DateTime @updatedAt @db\.Timestamptz\(6\)/);
  assert.match(m, /user users @relation\(fields: \[user_id\], references: \[id\], onDelete: Cascade\)/);
  const mapped = /@@unique\(\[user_id, day\], map: "([^"]+)"\)/.exec(m);
  assert.ok(mapped !== null, 'the unique is mapped by name');
  const named = /CONSTRAINT "([^"]+)" UNIQUE \("user_id", "day"\)/.exec(sql);
  assert.ok(named !== null);
  assert.equal(mapped![1], named![1], 'the map: name IS the SQL constraint name — Prisma’s default would differ and migrate diff would report drift');
  assert.match(m, /@@map\("operations_day_journals"\)/);
  assert.doesNotMatch(m, /spent|planned|largest/, 'the numbers are not columns');
  assert.match(schema, /operations_day_journals\s+operations_day_journals\[\]/, 'the user’s relation');
  const auditEnum = /enum AuditActionType \{([\s\S]*?)\}/.exec(schema);
  assert.ok(auditEnum !== null);
  const values = auditEnum![1].split(/\s+/).filter(Boolean);
  assert.deepEqual(values.slice(-2), ['operations_journal_set', 'operations_journal_cleared']);
  assert.equal(AuditActionType.operations_journal_set, 'operations_journal_set', 'prisma generate ran');
  assert.equal(AuditActionType.operations_journal_cleared, 'operations_journal_cleared');
  assert.match(code(AUDIT_LOG), /'operations_stop_set',\s*'operations_stop_cleared',\s*'operations_journal_set',\s*'operations_journal_cleared',\s*\],/);
});

// ── T4 · THE ROUTES ──────────────────────────────────────────────────────────

/** Each step found AFTER the one before it — a step that is missing, or out of order, fails by name. */
function inOrder(body: string, steps: readonly string[], what: string): void {
  let at = 0;
  for (const stepText of steps) {
    const i = body.indexOf(stepText, at);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(stepText)} comes after the step before it`);
    at = i + stepText.length;
  }
}

test('T4 the routes: GET by the caller and the day; PUT — the caller, the body, the rule, the same answers written once, the guard on updated_at, the race 409 both ways, the audit after; DELETE by the owned row', () => {
  const r = code(ROUTE);
  for (const method of ['GET', 'PUT']) assert.match(r, new RegExp(`export async function ${method}\\(`));
  assert.doesNotMatch(r, /export (?:const|(?:async )?function) (?!GET|PUT)/, 'a route file exports its handlers only — an async function too');
  const get = r.slice(r.indexOf('export async function GET('), r.indexOf('export async function PUT('));
  inOrder(get, ['getVerifiedEmail()', 'prisma.users.findFirst(', "request.nextUrl.searchParams.get('day')", 'if (!isIsoDay(day)) {', "field: 'day'", 'status: 400', 'prisma.operations_day_journals.findFirst({ where: { user_id: user.id, day: asJournalDate(day) } })', 'return NextResponse.json({ day, journal: row === null ? null : journalRowOf(row) });'], 'GET');
  const put = r.slice(r.indexOf('export async function PUT('));
  inOrder(put, [
    'getVerifiedEmail()', 'prisma.users.findFirst(', 'raw = await request.json();', 'BODY_NOT_JSON_WORDS', 'status: 400', 'journalInput(raw)', 'if (!read.ok) return NextResponse.json({ error: \'Validation\', field: read.field, message: read.message }, { status: 400 });',
    'const { day, answers } = read.value;',
    'prisma.operations_day_journals.findFirst({ where: { user_id: user.id, day: asJournalDate(day) } })',
    'if (before !== null && journalUnchanged(before, answers)) return NextResponse.json({ journal: before, changed: false });',
    'if (existing !== null) {', 'prisma.operations_day_journals.update(', "error.code === 'P2025'", 'RACE_WORDS(day)', 'status: 409',
    'prisma.operations_day_journals.create(', "error.code === 'P2002'", 'RACE_WORDS(day)', 'status: 409',
    "type: 'operations_journal_set'", 'payload: { before, after }', 'status: before === null ? 201 : 200',
  ], 'PUT');
  // ONE statement, guarded on the row as it was read and the caller's own, answering the row it wrote — no second read for `after`.
  assert.match(put, /after = journalRowOf\(await prisma\.operations_day_journals\.update\(\{ where: \{ id: existing\.id, user_id: user\.id, updated_at: existing\.updated_at \}, data: answers \}\)\);/, 'the guard: the row as it was read, the caller’s own, in the one write');
  assert.match(put, /if \(error instanceof Prisma\.PrismaClientKnownRequestError && error\.code === 'P2025'\) \{\n\s*return NextResponse\.json\(\{ error: 'Conflict', message: RACE_WORDS\(day\) \}, \{ status: 409 \}\);/, 'a row that moved or was cleared under the writer matches nothing — 409');
  assert.match(put, /after = journalRowOf\(await prisma\.operations_day_journals\.create\(\{ data: \{ user_id: user\.id, day: asJournalDate\(day\), \.\.\.answers \} \}\)\);/);
  assert.match(put, /if \(error instanceof Prisma\.PrismaClientKnownRequestError && error\.code === 'P2002'\) \{\n\s*return NextResponse\.json\(\{ error: 'Conflict', message: RACE_WORDS\(day\) \}, \{ status: 409 \}\);/);
  assert.ok(put.indexOf("type: 'operations_journal_set'") > put.lastIndexOf('prisma.operations_day_journals.create('), 'the audit after the write');
  assert.equal((put.match(/prisma\.operations_day_journals\.(?:update|updateMany|upsert|findFirst)\(/g) ?? []).length, 2, 'one read before the write, one guarded write — no re-read after it, no updateMany, no upsert');
  assert.doesNotMatch(put, /updateMany\(|upsert\(/);
  assert.doesNotMatch(put, /answers = raw|raw as /, 'the answers written are the rule’s, never the body’s');
  const i = code(ROUTE_ID);
  assert.match(i, /export async function DELETE\(/);
  assert.doesNotMatch(i, /export (?:const|(?:async )?function) (?!DELETE)/, 'a route file exports its handlers only — an async function too');
  inOrder(i, ['getVerifiedEmail()', 'prisma.users.findFirst(', 'const { id } = await params;', "if (!isValidUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });", 'prisma.operations_day_journals.findFirst({ where: { id, user_id: user.id } })', "if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });", 'const before = journalRowOf(row);', 'prisma.operations_day_journals.delete({ where: { id: row.id, user_id: user.id, updated_at: row.updated_at } })', "error.code === 'P2025'", 'RACE_WORDS(before.day)', 'status: 409', "type: 'operations_journal_cleared'", 'payload: { before, after: null }', 'return NextResponse.json({ cleared: true });'], 'DELETE');
  assert.match(i, /await prisma\.operations_day_journals\.delete\(\{ where: \{ id: row\.id, user_id: user\.id, updated_at: row\.updated_at \} \}\);/, 'the clear guarded on the row as it was read — the PUT’s own bar');
  assert.doesNotMatch(i, /deleteMany\(/);
  for (const f of [ROUTE, ROUTE_ID]) {
    const body = code(f);
    assert.equal((body.match(/getVerifiedEmail\(\)/g) ?? []).length, (body.match(/export async function/g) ?? []).length, `${f}: every handler proves the caller`);
    assert.doesNotMatch(body, /\$queryRaw|\$executeRaw/, `${f}: no raw SQL`);
    assert.equal((body.match(/failClosedResponse\(/g) ?? []).length, (body.match(/export async function/g) ?? []).length, `${f}: every handler fails closed`);
  }
  assert.doesNotMatch(/const PUBLIC_PATHS = \[([\s\S]*?)\];/.exec(code(MIDDLEWARE))![1], /journal/, 'nothing added to PUBLIC_PATHS');
});

// ── T5 · THE WRITER AND THE READ ─────────────────────────────────────────────

test('T5 the one writer: PUT / DELETE to the journal routes, every answer in words — signed out by name, no JSON by name; the read through the one reader', async () => {
  const sent: { url: string; init?: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  let answer: () => Response | Promise<Response> = () => json({ journal: { id: 'j1' }, changed: true }, 201);
  globalThis.fetch = (async (url: string, init?: RequestInit) => { sent.push({ url, init }); return answer(); }) as typeof fetch;
  const answers = answersOf({ goals: ['ship the PR'] });
  try {
    assert.deepEqual(await setJournal(DAY, answers), { ok: true });
    answer = () => json({ error: 'Validation', field: 'goals', message: tooManyWords('goals', 9) }, 400);
    assert.deepEqual(await setJournal(DAY, answers), { ok: false, message: tooManyWords('goals', 9) });
    answer = () => json({ error: 'Conflict', message: RACE_WORDS(DAY) }, 409);
    assert.deepEqual(await setJournal(DAY, answers), { ok: false, message: RACE_WORDS(DAY) });
    answer = () => new Response('', { status: 401 });
    assert.deepEqual(await setJournal(DAY, answers), { ok: false, message: SIGNED_OUT_WORDS }, 'a 401 is signed out, by name');
    answer = () => ({ type: 'opaqueredirect', status: 0, headers: new Headers(), json: async () => ({}) } as unknown as Response);
    assert.deepEqual(await setJournal(DAY, answers), { ok: false, message: SIGNED_OUT_WORDS }, 'the redirect to sign-in is signed out, by name');
    answer = () => new Response('<html>Sign in</html>', { status: 500, headers: { 'content-type': 'text/html' } });
    assert.deepEqual(await setJournal(DAY, answers), { ok: false, message: 'the route answered 500 with no JSON' }, 'never a raw SyntaxError');
    answer = () => new Response('{', { status: 200, headers: { 'content-type': 'application/json' } });
    const broken = await setJournal(DAY, answers);
    assert.ok(!broken.ok && broken.message.startsWith('the answer could not be read: '), 'a JSON header over a broken body, in words');
    answer = () => { throw new Error('boom'); };
    assert.deepEqual(await setJournal(DAY, answers), { ok: false, message: 'the request did not reach the server: boom' });
    answer = () => json({}, 500);
    assert.deepEqual(await setJournal(DAY, answers), { ok: false, message: SET_FAILED_WORDS });
    assert.equal(SET_FAILED_WORDS, 'failed to save the journal');
    assert.equal(CLEAR_FAILED_WORDS, 'failed to clear the journal');
    assert.equal(journalFailedWords('x'), 'The journal could not be read — x');
    answer = () => json({ cleared: true }, 200);
    assert.deepEqual(await clearJournal('j1'), { ok: true });
    answer = () => json({ error: 'Not found' }, 404);
    assert.deepEqual(await clearJournal('gone'), { ok: false, message: 'Not found' });
    answer = () => json({}, 500);
    assert.deepEqual(await clearJournal('j1'), { ok: false, message: CLEAR_FAILED_WORDS });
    const row = { ...answers, id: 'j1', day: DAY, typed_at: '2026-10-10T23:40:00.000Z' };
    answer = () => json({ day: DAY, journal: row }, 200);
    assert.deepEqual(await readJournal(DAY), { ok: true, value: { journal: row } });
    answer = () => json({ day: DAY, journal: null }, 200);
    assert.deepEqual(await readJournal(DAY), { ok: true, value: { journal: null } }, 'none typed is an answer');
    answer = () => json({ day: DAY }, 200);
    assert.deepEqual(await readJournal(DAY), { ok: false, words: journalFailedWords('the journal came back without its row') }, 'a body without `journal` is a failure, never "none typed"');
    answer = () => new Response('', { status: 401 });
    assert.deepEqual(await readJournal(DAY), { ok: false, words: journalFailedWords(SIGNED_OUT_WORDS) });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(sent.slice(0, 2).map((s) => [s.url, s.init?.method, s.init?.redirect]), [['/api/operations/journal', 'PUT', 'manual'], ['/api/operations/journal', 'PUT', 'manual']]);
  assert.equal(sent[0].init?.body, JSON.stringify({ day: DAY, ...answers }));
  assert.deepEqual(sent[0].init?.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(sent.filter((s) => s.init?.method === 'DELETE').map((s) => [s.url, s.init?.redirect]), [['/api/operations/journal/j1', 'manual'], ['/api/operations/journal/gone', 'manual'], ['/api/operations/journal/j1', 'manual']]);
  assert.deepEqual(sent.filter((s) => s.init?.method === undefined).map((s) => s.url), Array(4).fill(`/api/operations/journal?day=${DAY}`), 'the read, through readJson');
  const w = code(WRITES);
  assert.equal((w.match(/\bfetch\s*\(/g) ?? []).length, 2, 'two requests, in the one writer');
  assert.match(w, /if \(res\.type === 'opaqueredirect' \|\| res\.status === 401\) return \{ ok: false, message: SIGNED_OUT_WORDS \};/);
  assert.match(w, /if \(type === null \|\| !type\.includes\('application\/json'\)\) return \{ ok: false, message: `the route answered \$\{res\.status\} with no JSON` \};/);
  assert.match(w, /import \{ SIGNED_OUT_WORDS \} from '\.\.\/week\/weekReads';/);
  const reads = code(READS);
  assert.match(reads, /export async function readJournal\(day: string\): Promise<Read<JournalAnswer>>/);
  assert.match(reads, /await readJson\(`\/api\/operations\/journal\?\$\{new URLSearchParams\(\{ day \}\)\.toString\(\)\}`\)/);
  assert.match(reads, /if \(!\('journal' in read\.value\)\) return \{ ok: false, words: journalFailedWords\('the journal came back without its row'\) \};/);
  assert.equal((reads.match(/\bfetch\s*\(/g) ?? []).length, 0, 'the read goes through readJson');
});

// ── T6 · THE FORM AND THE PLATE ──────────────────────────────────────────────

// JOURNAL-02 (2026-10-13): the form is four boxes labelled with their questions — the one-box-per-answer, the plate's-order and the
// pair-on-one-line pins moved to journal02.test.ts (T5) with the boxes; every other guarantee below stands, re-pinned on the new save.
test('T6 the form: no maxLength, the route’s rule first, the one writer, clear asks and only when a journal exists, busy guard, nothing stored', () => {
  const f = code(FORM);
  assert.match(f, /^'use client';/m);
  assert.match(f, /import \{ clearJournal, setJournal \} from '\.\/journalWrites';/);
  assert.match(f, /carryTicks, clearJournalQuestion, journalInput, linesOf,/, 'the route’s own rule, imported');
  // PLAN-01 (2026-10-13): each goal line loses a pasted list's marker (stripListMarker) — the pin moved with it.
  assert.match(f, /const read = journalInput\(\{ day, goals: linesOf\(draft\.goals\)\.map\(stripListMarker\), blocker: draft\.blocker === '' \? null : draft\.blocker, plan_steps: steps, plan_done: ticks, shipped: draft\.shipped === '' \? null : draft\.shipped \}\);\n\s*if \(!read\.ok\) \{ setWords\(read\.message\); return; \}/, 'a blank box is null; a refusal is the route’s words');
  assert.match(f, /const answer = await setJournal\(day, read\.value\.answers\);\n\s*if \(!answer\.ok\) \{ setWords\(answer\.message\); return; \}\n\s*onChanged\(\);/, 'the one writer, then the caller re-reads');
  assert.doesNotMatch(f, /maxLength/, 'no maxLength — it counts UTF-16 units; the rule’s refusal is the limit');
  assert.doesNotMatch(f, /\bfetch\s*\(|\/api\//, 'the form names no route of its own');
  assert.doesNotMatch(f, /localStorage|sessionStorage|document\.cookie/, 'nothing stored');
  assert.match(f, /if \(journal === null \|\| busy \|\| !window\.confirm\(clearJournalQuestion\(dayShortWords\(day\)\)\)\) return;/, 'clear asks first');
  assert.match(f, /\{journal !== null && <button type="button" className=\{chip\} disabled=\{busy\} onClick=\{clear\} data-journal-clear>clear<\/button>\}/, 'offered only while a journal exists');
  assert.match(f, /const save = async \(\) => \{\n\s*if \(busy\) return;/, 'no double submit');
  for (const attr of ['data-journal-form', 'data-journal-field="goals"', 'data-journal-words', 'data-journal-clear']) assert.ok(f.includes(attr), `the form carries ${attr}`);
  assert.doesNotMatch(f, /\b(bg-black|bg-brand-purple|bg-panel|bg-brand-red|bg-brand-gold|bg-brand-green)\b/, 'no dark fill (the repaint law)');
  // The stop form: a journal stop asks the minutes only; the note only for a skip's reason; the shown/null invariants stand (role01 pins them).
  const s = code(STOP_FORM);
  assert.match(s, /: role === 'journal'\n\s*\? \{ amount: false, rating: false, minutes: true, note: draft\.outcome === 'skipped' \}/);
});

// JOURNAL-02 (2026-10-13): five blocks — the order, the yesterday lines and the one write moved below, dated; journal02.test.ts pins the blocks' contents.
// CLEAN-02 (2026-10-14): the journal card shows only its five blocks — the stop's own record (status, minutes), the source line, the
// tally and its try/catch are gone; yesterday is its journal alone. The pins below moved with it, dated.
test('T6 the plate: the five blocks in order, "—" for the unanswered, reads only when a journal stop exists (yesterday: its journal alone), in flight and failed as different words, the form keyed by the day and the journal', () => {
  const c = code(CARD);
  assert.match(c, /import JournalForm from '\.\.\/stops\/JournalForm';/);
  assert.match(c, /const hasJournalStop = readsDay === day && dayRead !== null && dayRead\.ok && dayRead\.value\.entries\.some\(\(e\) => e\.routine\.role === 'journal'\);/, 'the day has a journal stop — judged on the reads that landed for THIS day, so a day change fires nothing on the old day’s answer');
  assert.match(c, /setItems\(null\);\n\s*setReadsDay\(null\);/, 'a day change blanks the reads’ day with the reads');
  assert.match(c, /setItems\(i\);\n\s*setReadsDay\(day\);/, 'the reads land with their day');
  assert.match(c, /if \(day === null \|\| !hasJournalStop\) return;\n\s*let live = true;\n\s*\(async \(\) => \{\n\s*const j = await readJournal\(day\);\n\s*if \(live\) setJournal\(\{ day, read: j \}\);/, 'the journal read, only then, landing with its day under the live guard');
  assert.match(c, /\}, \[day, hasJournalStop, journalReads\]\);/, 'again after a write');
  // CLEAN-02 (2026-10-14): yesterday is read as its journal alone — the day, the report, the tasks and the records of the day before fed only the tally.
  assert.match(c, /if \(day === null \|\| !hasJournalStop\) return;\n\s*const yday = shiftDay\(day, -1\);\n\s*let live = true;\n\s*\(async \(\) => \{\n\s*const j = await readJournal\(yday\);\n\s*if \(live\) setYesterday\(\{ day, read: j \}\);/, 'yesterday’s journal, only then, landing with the card’s day');
  assert.doesNotMatch(c, /readDay\(yday\)|readDayReport\(yday|readItems\(yday|readStopRecords\(yday\)|YesterdayReads|yesterdayTally/, 'no money read for yesterday');
  assert.match(c, /const journalRead = journal !== null && journal\.day === day \? journal\.read : null;/);
  assert.match(c, /const yesterdayRead = yesterday !== null && yesterday\.day === day \? yesterday\.read : null;/);
  assert.doesNotMatch(c, /setJournal\(null\)|setYesterday\(null\)/, 'a re-read never blanks the plate first');
  assert.match(c, /\{focus\.stop\.role === 'journal' \? \(\n\s*<JournalPlate key=\{day\} day=\{day\} journal=\{journalRead\} yesterday=\{yesterdayRead\} onChanged=\{\(\) => setJournalReads\(\(n\) => n \+ 1\)\} \/>\n\s*\) : \(/, 'the plate for the journal stop, keyed by the day; a tick re-reads the journal; the plain record block for every other role');
  assert.match(c, /data-day-record>/, 'the plain record block stands');
  // PLAN-01 (2026-10-13): yesterday's steps not ticked read "not finished:" — the attribute renamed with the words.
  // CLEAN-02 (2026-10-14): YESTERDAY is its plan's ticks (data-day-yesterday-steps) and its note when typed (data-day-yesterday-note); the
  // tally's lines, TODAY's planned/stops line, the record (status, minutes) and the source line are gone from the order.
  inOrder(c, ['data-day-journal-yesterday', 'data-day-yesterday-loading', 'data-day-yesterday-journal-failed', 'data-day-yesterday-steps', 'data-day-yesterday-note', 'data-day-journal-today', 'data-day-journal-goal>', 'data-day-journal-blockers', 'data-day-journal-plan-block', 'data-day-journal-step=', 'data-day-journal-end-of-day', 'data-day-journal-loading', 'data-day-journal-failed', 'data-day-journal-none'], 'YESTERDAY, TODAY, BLOCKERS, PLAN, END OF DAY, the read’s state');
  assert.doesNotMatch(c, /data-day-journal-record|data-day-journal-status|data-day-journal-minutes|data-day-journal-provenance|data-day-journal-plan>|data-day-yesterday-(spent|largest|done|end-of-day|not-finished|records-failed|report-failed|items-failed|failed|build-failed)|typedState/, 'none of the removed parts');
  assert.match(c, /data-day-yesterday-loading>\{YESTERDAY_LOADING_WORDS\}/);
  assert.match(c, /data-day-yesterday-journal-failed>\{yesterday\.words\}/, 'yesterday’s read that failed prints its own words');
  assert.match(c, /data-day-journal-loading>\{JOURNAL_LOADING_WORDS\}/);
  assert.match(c, /data-day-journal-failed>\{journal\.words\}/, 'the read’s own sentence, once');
  assert.match(c, /data-day-journal-none>\{noJournalWords\(dayShortWords\(day\)\)\}/);
  // JOURNAL-02 (2026-10-13): yesterday with no journal said noJournalWords; CLEAN-02 (2026-10-14): yesterdayStepsWords says it — NO_JOURNAL_YESTERDAY_WORDS.
  assert.match(c, /\{yesterday !== null && yesterday\.ok && <div [^>]*data-day-yesterday-steps>\{yesterdayStepsWords\(yRow\)\}<\/div>\}/, 'yesterday’s ticks, once its read answered');
  // PLAN-01 (2026-10-13): yesterday's END OF DAY was labelled "accomplished:"; CLEAN-02 (2026-10-14): "note:", and only when one was typed.
  assert.match(c, /\{yRow !== null && yRow\.shipped !== null && <div [^>]*data-day-yesterday-note>\{noteWords\(yRow\.shipped\)\}<\/div>\}/, 'yesterday’s END OF DAY as typed, labelled note:');
  assert.doesNotMatch(c, /data-day-yesterday-shipped|tallyShippedWords|answerLine|pairLine|QUESTION_WORDS|accomplishedWords/);
  assert.match(c, /const a: Answers = answersOf\(row === null \? \{\} : row\);/);
  assert.match(c, /<JournalForm key=\{`\$\{day\}:\$\{journalRead\.value\.journal === null \? 'none' : journalRead\.value\.journal\.id\}`\} day=\{day\} journal=\{journalRead\.value\.journal\} yesterday=\{yesterdayForPrompt\} onChanged=\{\(\) => setJournalReads\(\(n\) => n \+ 1\)\} \/>/, 'keyed by the day and the journal; a write bumps the read counter; JOURNAL-02 / PLAN-01: yesterday — its open steps and its END OF DAY (CLEAN-02: its row) — for the add button and the plan prompt');
  assert.match(c, /\{loaded && focus !== null && focus\.stop\.role === 'journal' && journalRead !== null && journalRead\.ok && \(/, 'never offered while the journal could not be read');
  inOrder(c, ['data-day-card', '<StopForm', '<JournalForm', 'data-day-foot'], 'under the plate, after the record form, above the sentences');
  // JOURNAL-02 (2026-10-13): the plate's tick buttons write through the ONE writer — the card imports its set (as writeJournal) and
  // nothing else from it, and calls it once (the tick); it still fetches nothing and names no method. Narrowed, not loosened.
  assert.doesNotMatch(c, /\bfetch\s*\(|method:/, 'the card fetches nothing and names no method of its own');
  assert.equal((c.match(/from '\.\.\/stops\/journalWrites'/g) ?? []).length, 1);
  assert.match(c, /import \{ setJournal as writeJournal \} from '\.\.\/stops\/journalWrites';/, 'the one writer’s set, and only it');
  assert.doesNotMatch(c, /clearJournal/, 'the plate clears nothing');
  assert.equal((c.match(/writeJournal\(/g) ?? []).length, 1, 'one write: the tick');
});
