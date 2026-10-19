/**
 * ROLE-01 (2026-10-13) — THE ROUTINE'S ROLE: what kind of stop it is on the day
 * card. One field on the routine, set once on the Tasks tab; an all-day routine
 * is in the day's plan but not a stop (the plate's "also today" band); the form
 * under the plate asks what the stop's role asks; a place stop plans its vendor
 * there.
 * VENDOR-02 (2026-10-14): every priced stop plans its vendor now, whatever its
 * role, in the VENDOR row above the record row (stops/StopVendor.tsx); T4's
 * vendor pins moved there, and vendor02.test.ts drives the rule.
 *
 * The rules (src/lib/operations/stopRole.ts, day/dayCard.ts) are pure and
 * DRIVEN over cases; the migration, the schema, the routes, the Tasks tab's
 * forms, the step form and the plate are anchored to their source with
 * comments stripped (TEST-TRUTH-01, through code() — the reader law).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import type { PlanLine } from '../budget/planLines';
import {
  ALSO_TODAY_WORDS, DEFAULT_ROLE, NOTE_PROMPT_WORDS, NOT_A_STOP_RECORD_WORDS, NOT_A_STOP_WORDS, NO_AMOUNT_NO_VENDOR_WORDS, REPORT_NOT_READ_NO_VENDOR_WORDS, ROLE_FIELD_WORDS, ROLE_SHORT_WORDS,
  ROLE_TITLE_WORDS, ROLE_WORDS, STOP_ROLES, UNMATCHED_NO_VENDOR_WORDS, VENDOR_LABEL_WORDS, allDayBandWords, allDayCentsWords, isStop, isStopRole, roleInput,
} from '../operations/stopRole';
import type { StopRecordRow } from '../operations/stopRecord';
import type { DailyPlanItem } from '@/components/workbench/operations/dailyplan/types';
import type { Routine, RoutineStep, TodayRoutineEntry, TodayStatus } from '@/components/workbench/operations/routines/types';
import { DEFAULT_ROUTINE_FORM } from '@/components/workbench/operations/routines/types';
import { bandNameOf, completenessWords, dayStops, focusStop, type DayCardInput } from '@/components/workbench/operations/day/dayCard';

const RULES = 'src/lib/operations/stopRole.ts';
const CARD_RULES = 'src/components/workbench/operations/day/dayCard.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
// VENDOR-02 (2026-10-14): the vendor box left the form for its own child, mounted by the card above the record row.
const VENDOR = 'src/components/workbench/operations/stops/StopVendor.tsx';
const ROUTE_CREATE = 'src/app/api/operations/routines/route.ts';
const ROUTE_PATCH = 'src/app/api/operations/routines/[id]/route.ts';
const CREATE_FORM = 'src/components/workbench/operations/routines/RoutineCreateForm.tsx';
const ROW = 'src/components/workbench/operations/routines/RoutineRow.tsx';
const TODAY_ROUTE = 'src/app/api/operations/routines/today/route.ts';
const STOPS_ROUTE = 'src/app/api/operations/stops/route.ts';
const TYPES = 'src/components/workbench/operations/routines/types.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261013030000_role_01_routine_role';
const MIGRATION = `${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`;

// ── FIXTURES (the day card's) ────────────────────────────────────────────────

const DAY = '2026-10-11';
const BKK = 'Asia/Bangkok';
const AT = '2026-10-11T00:00:00.000Z';
const HBO_AT = '2026-10-11T01:00:00.000Z';
const GYM_AT = '2026-10-11T13:00:00.000Z';
const HBO_ID = '0f2a7c1e-3333-4a2b-8c3d-000000000003';

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
const record = (over: Partial<StopRecordRow> & { kind: StopRecordRow['kind']; target_id: string; occurrence_at: string }): StopRecordRow => ({
  id: `rec-${over.target_id}`, outcome: 'done', done_at: null, actual_cents: null, rating: null, note: null, actual_minutes: null, ...over,
});
const input = (over: Partial<DayCardInput> = {}): DayCardInput => ({ day: DAY, entries: [], lines: [], notPlaced: [], items: [], viewerZone: BKK, records: null, ...over });

/** Alex's day: the journal, the plan, an execute block, brunch (a place), HBO (all day, at 08:00 on its rrule), dinner. */
const journal = routine({ id: 'journal', name: 'Daily Vision - Journal', role: 'journal' });
const plan = routine({ id: 'plan', name: 'Task List - Execution Plan', role: 'plan', schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=30' });
const brunch = routine({ id: 'brunch', name: 'Brunch', role: 'place', schedule_rrule: 'FREQ=DAILY;BYHOUR=12;BYMINUTE=30' });
const hbo = routine({ id: HBO_ID, name: 'HBO Subscription', role: 'all_day', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=8;BYMINUTE=0' });
const gym = routine({ id: 'gym', name: 'Gym', role: 'none', schedule_rrule: 'FREQ=DAILY;BYHOUR=20;BYMINUTE=0' });
const BRUNCH_AT = '2026-10-11T05:30:00.000Z';
const PLAN_AT = '2026-10-11T00:30:00.000Z';
const hboLine = line({ address: { kind: 'routine', id: HBO_ID, instant: HBO_AT }, cents: 1100, label: 'HBO Subscription', time: '08:00' });
const brunchLine = line({ address: { kind: 'routine', id: 'brunch', instant: BRUNCH_AT }, cents: 1000, label: 'Brunch', time: '12:30' });

// ── T1 · THE RULE ────────────────────────────────────────────────────────────

test('T1 the six roles; roleInput takes one by name or the default when absent, and refuses anything else; all_day is not a stop', () => {
  assert.deepEqual([...STOP_ROLES], ['journal', 'plan', 'execute', 'place', 'all_day', 'none']);
  assert.equal(DEFAULT_ROLE, 'none');
  assert.deepEqual(roleInput(undefined), { ok: true, role: 'none' });
  for (const r of STOP_ROLES) assert.deepEqual(roleInput(r), { ok: true, role: r });
  for (const bad of [null, '', 'Place', 'allday', 'subscription', 7, {}, ['place']]) {
    const read = roleInput(bad);
    assert.ok(!read.ok, JSON.stringify(bad));
    assert.equal(read.field, 'role');
    assert.equal(read.message, 'role must be one of journal, plan, execute, place, all_day, none');
  }
  assert.equal(isStopRole('place'), true);
  assert.equal(isStopRole('x'), false);
  assert.deepEqual(STOP_ROLES.map(isStop), [true, true, true, true, false, true]);
  assert.equal(DEFAULT_ROUTINE_FORM.role, 'none', 'a new routine starts as none');
  assert.doesNotMatch(code(RULES), /\bfetch\b|new Date|@prisma\/client|from 'react'/, 'pure');
});

test('T1 the words, exact', () => {
  assert.deepEqual(ROLE_WORDS, {
    journal: 'journal — the morning questions',
    plan: 'plan — the vision in, the plan out',
    execute: 'execute — a work block; what got finished',
    place: 'place — somewhere you go and pay',
    all_day: 'all day — a charge on a date, not a stop', // ALLDAY-01 (2026-10-19): the one phrasing (was 'a subscription or membership, not a stop')
    none: 'none — the plain record',
  });
  assert.deepEqual(ROLE_SHORT_WORDS, { journal: 'journal', plan: 'plan', execute: 'execute', place: 'place', all_day: 'all day', none: '' });
  assert.equal(ALSO_TODAY_WORDS, 'also today');
  assert.equal(NOT_A_STOP_WORDS, "in the day's plan, not a stop");
  // DECK-01 (Alex, 2026-10-16): TAP_A_STOP_WORDS is gone — the hint under the deck is dayCard.ts SWIPE_HINT_WORDS (deck01.test.ts).
  assert.doesNotMatch(code('src/lib/operations/stopRole.ts'), /\bTAP_A_STOP_WORDS\b|'tap a stop to record it'/, 'TAP_A_STOP_WORDS is deleted');
  assert.equal(NO_AMOUNT_NO_VENDOR_WORDS, 'give this line an amount on the Tasks tab to plan its vendor');
  assert.equal(REPORT_NOT_READ_NO_VENDOR_WORDS, "the day's amounts could not be read — no vendor can be planned until they are");
  assert.equal(UNMATCHED_NO_VENDOR_WORDS, "the Budget's line for this stop is at another instant (named under the plate) — no vendor can be planned on it here");
  assert.equal(NOT_A_STOP_RECORD_WORDS, 'the routine is all day — not a stop, so it takes no record');
  assert.equal(allDayBandWords(0), "in the day's plan, not a stop");
  assert.equal(allDayBandWords(1), "in the day's plan, not a stop · 1 with no amount, not in the plan");
  assert.equal(allDayBandWords(2), "in the day's plan, not a stop · 2 with no amount, not in the plan");
  assert.equal(allDayCentsWords('$11'), '$11 all day');
  assert.deepEqual([VENDOR_LABEL_WORDS, ROLE_FIELD_WORDS, ROLE_TITLE_WORDS], ['Vendor', 'on the day card', 'role on the day card']);
  assert.deepEqual(NOTE_PROMPT_WORDS, { journal: "today's vision — one line", plan: 'the plan — one line', execute: 'finished up to here', place: 'why the delta', none: 'note' });
});

// ── T2 · THE CARD'S RULES ────────────────────────────────────────────────────

test('T2 every stop carries its routine’s role; an all-day routine is in the plan (the hero) but not a stop: in allDay, unnumbered, uncounted, unrecorded', () => {
  const r = dayStops(input({
    entries: [entry(journal, 'completed'), entry(plan, 'pending', PLAN_AT), entry(brunch, 'pending', BRUNCH_AT), entry(hbo, 'pending', HBO_AT), entry(gym, 'pending', GYM_AT)],
    lines: [hboLine, brunchLine],
    records: [],
  }));
  assert.deepEqual(r.stops.map((s) => [s.label, s.role, s.time]), [
    ['Daily Vision - Journal', 'journal', '07:00'], ['Task List - Execution Plan', 'plan', '07:30'], ['Brunch', 'place', '12:30'], ['Gym', 'none', '20:00'],
  ], 'four stops, in clock order, each with its role — HBO is not one of them');
  assert.deepEqual(r.allDay.map((s) => [s.label, s.role, s.cents, s.time]), [['HBO Subscription', 'all_day', 1100, '08:00']], 'HBO is in the band, with its amount and its clock');
  assert.equal(r.plannedCents, 2100, 'the hero is the Budget’s day — HBO’s $11 is in it');
  assert.equal(r.notPriced, 3, 'the journal, the plan and the gym — HBO is not counted among the stops');
  assert.deepEqual([r.done, r.withoutActual, r.notRecorded], [1, 4, 4], 'over the stops only');
  // CLEAN-01 (2026-10-14): the hook carries no stop count now (hookWords is gone) — the count it printed is the stops', never the band's.
  assert.equal(r.stops.length, 4, 'four stops — HBO is not one');
  assert.equal(focusStop(r, 4)!.stop.label, 'Gym');
  assert.equal(focusStop(r, 5), null, 'HBO has no step');
  assert.equal(r.stops.find((s) => s.label === 'Brunch')!.planLine, brunchLine, 'the matched line rides on the stop — the vendor box plans on it');
  assert.equal(r.stops.find((s) => s.label === 'Gym')!.planLine, null);
  // VENDOR-02 (2026-10-14): completenessWords lost its stranded count (Alex's ruling — stranded vendors are Budget's to show); the words stand.
  assert.equal(completenessWords(r, { day: true, report: true, records: true }), '3 not priced · 4 not recorded');
  // A record written at an all-day routine (by the API — the card offers no form) is named as matching no stop, never applied.
  const hboRecord = record({ kind: 'routine', target_id: HBO_ID, occurrence_at: HBO_AT, done_at: HBO_AT, actual_cents: 1100 });
  const withRecord = dayStops(input({ entries: [entry(hbo, 'pending', HBO_AT)], lines: [hboLine], records: [hboRecord] }));
  assert.deepEqual(withRecord.recordsWithoutStop, [hboRecord]);
  assert.equal(withRecord.allDay[0].record, null);
  assert.equal(withRecord.spentCents, 0, 'HBO’s record is not the stops’ spent');
  // A routine with lines: every line takes the routine's role; an all-day routine's lines all go to the band.
  const lined = routine({ id: 'lined', name: 'Memberships', role: 'all_day', steps: [step({ id: 'gym-m', step_order: 1, activity: 'Gym membership' }), step({ id: 'hbo-m', step_order: 2, activity: 'HBO' })] });
  const l = dayStops(input({ entries: [entry(lined)], records: [] }));
  assert.deepEqual(l.stops, []);
  assert.deepEqual(l.allDay.map((s) => [s.line, s.role]), [['Gym membership', 'all_day'], ['HBO', 'all_day']]);
  const placeLined = routine({ id: 'out', name: 'Out', role: 'place', steps: [step({ id: 'coffee', step_order: 1, activity: 'Coffee' })] });
  assert.equal(dayStops(input({ entries: [entry(placeLined)], records: [] })).stops[0].role, 'place');
  // A task stop has no role of its own.
  assert.equal(dayStops(input({ items: [item({ id: 'i1', ad_hoc_title: 'Ship it' })] })).stops[0].role, 'none');
  // The band keeps clock order.
  const late = routine({ id: 'late', name: 'A late one', role: 'all_day', schedule_rrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0' });
  const two = dayStops(input({ entries: [entry(late, 'pending', '2026-10-11T02:00:00.000Z'), entry(hbo, 'pending', HBO_AT)] }));
  assert.deepEqual(two.allDay.map((s) => s.label), ['HBO Subscription', 'A late one']);
  const same = routine({ id: 'same', name: 'Apple TV', role: 'all_day', schedule_rrule: 'FREQ=DAILY;BYHOUR=8;BYMINUTE=0' });
  assert.deepEqual(dayStops(input({ entries: [entry(hbo, 'pending', HBO_AT), entry(same, 'pending', HBO_AT)] })).allDay.map((s) => s.label), ['Apple TV', 'HBO Subscription'], 'the same clock: by name');
  assert.doesNotMatch(code(CARD_RULES), /role === 'all_day'|=== 'all_day'/, 'the card asks the rule (isStop), never the value');
  // The counts never touch the band: a done all-day routine is not "done", an unpriced one not "not priced", a missed one not skipped or missed.
  const doneHbo = dayStops(input({ entries: [entry(hbo, 'completed', HBO_AT), entry(gym, 'pending', GYM_AT)], records: [] }));
  assert.deepEqual([doneHbo.done, doneHbo.skipped, doneHbo.notRecorded, doneHbo.withoutActual, doneHbo.notPriced, doneHbo.stops.length, doneHbo.allDay.length], [0, 0, 1, 1, 1, 1, 1]);
  const unpriced = dayStops(input({ entries: [entry(hbo, 'missed', HBO_AT)], records: [] }));
  assert.deepEqual([unpriced.notPriced, unpriced.plannedCents, unpriced.allDayCents, unpriced.allDay[0].cents, completenessWords(unpriced, { day: true, report: true, records: true })], [0, 0, 0, null, null], 'an unpriced all-day line is not a count on the plate — the band says it has no amount');
  assert.equal(dayStops(input({ entries: [entry(hbo, 'pending', HBO_AT)], lines: [hboLine] })).allDayCents, 1100, 'the band’s money, for the step card’s denominator');
  assert.equal(bandNameOf(l.allDay[0]), 'Memberships — Gym membership', 'the band names the routine and its line');
  assert.equal(bandNameOf(r.allDay[0]), 'HBO Subscription');
  // The plan-line state says why a stop has no line: matched / unmatched (the Budget lists one at another instant) / none.
  assert.equal(r.stops.find((s) => s.label === 'Brunch')!.planLineState, 'matched');
  assert.equal(r.stops.find((s) => s.label === 'Gym')!.planLineState, 'none');
  const moved = dayStops(input({ entries: [entry(brunch, 'pending', BRUNCH_AT)], lines: [{ ...brunchLine, address: { ...brunchLine.address, instant: '2026-10-11T06:30:00.000Z' } }] })).stops[0];
  assert.deepEqual([moved.planLine, moved.planLineState, moved.cents], [null, 'unmatched', null]);
  // A role outside the six on the wire is the read's error, never a work stop.
  assert.throws(() => dayStops(input({ entries: [entry({ ...gym, role: 'subscription' as never })] })), /carries role "subscription" — not one of the six/);
  assert.throws(() => dayStops(input({ entries: [entry({ ...gym, role: undefined as never })] })), /not one of the six/, 'a read that strips the column is caught, not read as none');
});

// ── T3 · THE MIGRATION, THE SCHEMA, THE ROUTES, THE TASKS TAB ────────────────

test('T3 the migration: one column, NOT NULL default none, the six-value CHECK, no row rewritten — and it is the newest; the schema column with it', () => {
  const sql = code(MIGRATION);
  assert.match(sql, /ALTER TABLE "operations_routines"\s+ADD COLUMN "role" VARCHAR\(10\) NOT NULL DEFAULT 'none';/);
  assert.match(sql, /ADD CONSTRAINT "operations_routines_role" CHECK \("role" IN \('journal', 'plan', 'execute', 'place', 'all_day', 'none'\)\);/);
  assert.doesNotMatch(sql, /(^|\n)\s*(UPDATE|DELETE FROM|INSERT INTO)\s+"/, 'no row is written or moved');
  assert.doesNotMatch(sql, /DROP |routine_steps/, 'the line takes its routine’s role — no second column');
  assert.match(comments(MIGRATION), /AUTHORED here, applied at deploy/);
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  // JOURNAL-01 (2026-10-13): the journal migration is newer — this one is the one before it. The pin moved; the order holds.
  // JOURNAL-02 (2026-10-13): the simple journal's migration is newer still — every index moved one; the order holds.
  // TASKS-ONE-02 (2026-10-14): the completion audit types' migration is newer still — every index moved one; the order holds.
  // RETRO-01 (Alex, 2026-10-16): the stop-moved audit type's migration is newer still — every index moved one; the order holds.
  // ROUTINE-02b (2026-10-18): one more audit-type migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 8], MIGRATION_DIR, 'the migration five before the newest (JOURNAL-01, JOURNAL-02, TASKS-ONE-02, then RETRO-01, ROUTINE-02b followed)');
  assert.equal(dirs[dirs.length - 7], '20261013120000_journal_01_day_journals');
  assert.equal(dirs[dirs.length - 6], '20261013200000_journal_02_the_simple_journal');
  assert.equal(dirs[dirs.length - 5], '20261014090000_tasks_one_02_completion_audit_types');
  assert.equal(dirs[dirs.length - 4], '20261016120000_retro_01_stop_moved_audit_type', 'the migration before the newest (ROUTINE-02b followed)');
  // MOVE-01 (2026-10-19): one more audit-type migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 3], '20261018120000_routine_02b_rekeyed_audit_type', 'the migration before the newest (MOVE-01 followed)');
  // JOURNAL-04 (2026-10-19): the evening answers' migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 2], '20261019090000_move_01_moved_audit_type', 'the migration before the newest (JOURNAL-04 followed)');
  assert.equal(dirs[dirs.length - 1], '20261019210000_journal_04_evening_answers', 'the newest migration');
  assert.ok(MIGRATION_DIR.slice(0, 14) > '20261012140000', 'after STOP-01’s');
  const model = /model operations_routines \{([\s\S]*?)\n\}/.exec(code(SCHEMA));
  assert.ok(model !== null);
  assert.match(model[1], /role\s+String\s+@default\("none"\) @db\.VarChar\(10\)/);
  assert.doesNotMatch(/model operations_routine_steps \{([\s\S]*?)\n\}/.exec(code(SCHEMA))![1], /\brole\b/);
  assert.match(code(TYPES), /role: StopRole;\n/, 'the Routine type names it');
  assert.match(code(TYPES), /import type \{ StopRole \} from '@\/lib\/operations\/stopRole';/);
});

test('T3 the routes read the role by the one rule: the create route writes it (absent → none), the PATCH writes it only when sent; the Tasks tab offers the six and shows the one set', () => {
  const create = code(ROUTE_CREATE);
  assert.match(create, /const role = roleInput\(body\.role\);\n\s*if \(!role\.ok\) return NextResponse\.json\(\{ error: 'Validation', field: role\.field, message: role\.message \}, \{ status: 400 \}\);/);
  assert.match(create, /fail_threshold_minutes: failThreshold,\n\s*role: role\.role,/, 'written with the routine');
  assert.ok(create.indexOf('roleInput(body.role)') < create.indexOf('tx.operations_routines.create('), 'read before the write');
  const patch = code(ROUTE_PATCH);
  assert.match(patch, /if \(body\.role !== undefined\) \{\n\s*const role = roleInput\(body\.role\);\n\s*if \(!role\.ok\) return NextResponse\.json\(\{ error: 'Validation', field: role\.field, message: role\.message \}, \{ status: 400 \}\);\n\s*data\.role = role\.role;\n\s*\}/, 'not sent → untouched; sent → by name');
  // ALLDAY-01 (2026-10-19): the PATCH also asks isStop — was it all day before this edit (a role leaving all day needs its time).
  assert.match(code(ROUTE_CREATE), /import \{ roleInput \} from '@\/lib\/operations\/stopRole';/);
  assert.match(code(ROUTE_PATCH), /import \{ isStop, roleInput \} from '@\/lib\/operations\/stopRole';/);
  // The two reads the card and the week stand on hand the routine over whole — no select strips the column.
  assert.match(code(TODAY_ROUTE), /prisma\.operations_routines\.findMany\(\{\n\s*where: \{ user_id: user\.id, is_active: true \},\n\s*orderBy: \{ name: 'asc' \},\n\s*include: \{\n\s*steps: \{ where: \{ is_active: true \}, orderBy: \{ step_order: 'asc' \} \},\n\s*\},\n\s*\}\);/, 'the today read: the whole routine, with its active lines');
  const list = /prisma\.operations_routines\.findMany\(\{([\s\S]*?)\}\);/.exec(code(ROUTE_CREATE));
  assert.ok(list !== null && !/\bselect:/.test(list[1].split('include')[0]), 'the routines list: the whole routine');
  // The stops route: an all-day routine takes no record; a role outside the six is the database’s error.
  const stops = code(STOPS_ROUTE);
  assert.match(stops, /if \(!isStopRole\(routine\.role\)\) throw new Error\(`stops POST: routine \$\{routine\.id\} carries role \$\{JSON\.stringify\(routine\.role\)\} — not one of the six`\);\n\s*if \(!isStop\(routine\.role\)\) return NextResponse\.json\(\{ error: 'Validation', field: 'id', message: NOT_A_STOP_RECORD_WORDS \}, \{ status: 400 \}\);/);
  assert.ok(stops.indexOf('NOT_A_STOP_RECORD_WORDS }') < stops.indexOf('routineDay(routine, localDay, now)'), 'refused before the instant is judged');
  assert.match(code(CREATE_FORM), /useState<RoutineForm>\(\{\n\s*\.\.\.DEFAULT_ROUTINE_FORM,/, 'a new routine starts from the default — none');
  assert.doesNotMatch(/useState<RoutineForm>\(\{([\s\S]*?)\}\)/.exec(code(CREATE_FORM))![1], /\brole\b/, 'the create form never seeds a role of its own');
  // The create form and the edit form: one select over STOP_ROLES, each option its sentence; the row's small print shows a set role.
  const form = code(CREATE_FORM);
  // ALLDAY-01 (2026-10-19): the role goes through withRole (rruleHelpers.ts) — all day blanks the time; the select and its options are as before.
  assert.match(form, /<select\n\s*value=\{createForm\.role\}\n\s*onChange=\{\(e\) => setCreateForm\(withRole\(createForm, e\.target\.value as StopRole\)\)\}\n\s*className=\{inputClass\}\n\s*data-routine-role\n\s*>\n\s*\{STOP_ROLES\.map\(\(r\) => \(\n\s*<option key=\{r\} value=\{r\}>\{ROLE_WORDS\[r\]\}<\/option>/);
  const row = code(ROW);
  assert.match(row, /<select\n\s*value=\{form\.role\}\n\s*onChange=\{\(e\) => setForm\(withRole\(form, e\.target\.value as StopRole\)\)\}\n\s*className=\{inputClass\}\n\s*data-routine-role-select\n\s*>\n\s*\{STOP_ROLES\.map\(\(r\) => \(\n\s*<option key=\{r\} value=\{r\}>\{ROLE_WORDS\[r\]\}<\/option>/);
  assert.match(row, /    role: r\.role,\n/, 'routineToForm carries it, so an edit never resets it');
  assert.match(row, /\{routine\.role !== 'none' && <span title=\{ROLE_TITLE_WORDS\} data-routine-role=\{routine\.role\}>\{ROLE_SHORT_WORDS\[routine\.role\]\}<\/span>\}/);
  assert.equal((form.match(/\{ROLE_FIELD_WORDS\}/g) ?? []).length, 1);
  assert.equal((row.match(/\{ROLE_FIELD_WORDS\}/g) ?? []).length, 1);
  assert.match(form, /body: JSON\.stringify\(\{\n\s*\.\.\.createForm,/, 'the form is sent whole — the role rides with it');
  assert.match(row, /body: JSON\.stringify\(\{\n\s*\.\.\.form,/);
});

// ── T4 · THE FORM AND THE PLATE ──────────────────────────────────────────────

// VENDOR-02 (2026-10-14): the title said "a place stop plans its vendor on its matched line" — every priced stop does now, in its own child.
test('T4 the form asks what the role asks; the vendor box is the card’s child, not the form’s; the plate’s band and hint', () => {
  const f = code(FORM);
  assert.match(f, /if \(stop\.role === 'all_day'\) throw new Error\(`StopForm: \$\{stop\.key\} is an all-day line — it takes no record`\);\n\s*const role: Exclude<StopRole, 'all_day'> = stop\.role;/, 'an all-day line is never this form’s — the rule, not a case');
  assert.match(f, /const differs = typedCents !== null && \(stop\.cents === null \|\| typedCents !== stop\.cents\);/, '"why" once the amount differs from the plan — or whenever the plan is unknown');
  assert.match(f, /try \{ const r = centsFromDecimalString\(draft\.amount\); return r\.ok \? r\.cents : null; \} catch \{ return null; \}/, 'a non-amount typed is no amount yet — never a render crash');
  // A field the role does not ask is shown while it holds a value; what is not shown is sent as null — never carried unseen.
  assert.match(f, /const shown = \{\n\s*amount: asks\.amount \|\| draft\.amount !== '',\n\s*rating: asks\.rating \|\| draft\.rating !== null,\n\s*minutes: asks\.minutes \|\| draft\.minutes !== '',\n\s*note: asks\.note \|\| draft\.note !== '',\n\s*\};/);
  assert.match(f, /if \(shown\.amount && d\.amount\.trim\(\) !== ''\) \{/);
  assert.match(f, /if \(shown\.minutes && d\.minutes\.trim\(\) !== ''\) \{/);
  assert.match(f, /const note = shown\.note \? d\.note\.trim\(\) : '';/);
  assert.match(f, /rating: shown\.rating \? d\.rating : null/);
  // JOURNAL-01 (2026-10-13): a journal stop asks the minutes only — its words are the journal's own questions; the note only for a skip's reason. The pin moved; the shown/null invariants above stand.
  assert.match(f, /const asks = role === 'place'\n\s*\? \{ amount: true, rating: true, minutes: false, note: draft\.outcome === 'skipped' \|\| differs \}\n\s*: role === 'none'\n\s*\? \{ amount: true, rating: true, minutes: true, note: true \}\n\s*: role === 'journal'\n\s*\? \{ amount: false, rating: false, minutes: true, note: draft\.outcome === 'skipped' \}\n\s*: \{ amount: false, rating: false, minutes: true, note: true \};/);
  for (const ask of ['shown.amount', 'shown.rating', 'shown.minutes', 'shown.note']) assert.ok(f.includes(`{${ask} && (`), `${ask} gates its field`);
  assert.doesNotMatch(f, /\{asks\.\w+ && \(/, 'the screen gates on shown, never on asks alone');
  assert.match(f, /placeholder=\{draft\.outcome === 'skipped' \? 'why — required' : NOTE_PROMPT_WORDS\[role\]\}/, 'the note is prompted by the role');
  // VENDOR-02 (2026-10-14) — Alex's ruling: the vendor box shows for EVERY priced stop, whatever its role, directly above the
  // record row. Moved, never loosened: PlaceVendor left the form (its place-only mount with it); the child is
  // stops/StopVendor.tsx, its choice the rule day/dayCard.ts vendorSlot (driven in vendor02.test.ts). The directory is still
  // read once, inside the box's own child — now only while the box is shown, not while a reason is.
  assert.doesNotMatch(f, /PlaceVendor|VendorBox|useDirectory|VENDOR_LABEL_WORDS|data-stop-vendor/, 'the form holds no vendor box now');
  const v = code(VENDOR);
  assert.match(v, /function Box\(\{ line, bookName, reload \}: \{ line: PlanLine; bookName: string; reload: \(\) => void \}\) \{\n\s*const directory = useDirectory\(\);/, 'the directory is read inside the box child only');
  assert.equal((v.match(/useDirectory\(\)/g) ?? []).length, 1);
  const rules = code(CARD_RULES);
  assert.match(rules, /return \{ kind: 'reason', words: !reportRead \? REPORT_NOT_READ_NO_VENDOR_WORDS : stop\.planLineState === 'unmatched' \? UNMATCHED_NO_VENDOR_WORDS : NO_AMOUNT_NO_VENDOR_WORDS \};/, 'one reason per cause — the report unread, the line at another instant, no amount');
  assert.match(v, /\{slot\.kind === 'box'\n\s*\? <Box line=\{slot\.line\} bookName=\{bookName\} reload=\{reload\} \/>\n\s*: <span className="text-text-muted" data-stop-no-vendor>\{slot\.words\}<\/span>\}/, 'Budget’s own vendor box on the matched plan line, else the reason');
  assert.match(v, /import \{ VendorBox, useDirectory \} from '@\/components\/budget\/DayPlanDrill';/);
  assert.match(v, /\{VENDOR_LABEL_WORDS\}/);
  assert.doesNotMatch(f, /\bfetch\s*\(|\/api\//, 'the form still names no route of its own');
  const c = code(CARD);
  assert.doesNotMatch(c, /VendorBox|useDirectory|vendor-directory|plan-vendors/, 'the day folder names no vendor box — the stops folder does');
  // VENDOR-02 (2026-10-14): the card mounts the stops folder's child — it still names no box, no directory and no route.
  assert.match(c, /import StopVendor from '\.\.\/stops\/StopVendor';/);
  assert.match(c, /\{result\.allDay\.length > 0 && \(\n\s*<div className="flex flex-col" style=\{\{ gap: 4 \}\} data-day-all-day>/, 'the band, on the plate, after the rows');
  assert.match(c, /\{ALSO_TODAY_WORDS\.toUpperCase\(\)\}/);
  assert.match(c, /data-day-all-day-amount>\{planDollars\(s\.cents\)\}/);
  assert.match(c, /\{bandNameOf\(s\)\}<\/span>/, 'the routine and its line');
  assert.match(c, /data-day-all-day-words>\{allDayBandWords\(result\.allDay\.filter\(\(s\) => s\.cents === null\)\.length\)\}/, 'the band’s words count its lines with no amount');
  // DECK-01 (Alex, 2026-10-16): N counts the deck's stops — the day's stops with the journal excepted (its card is under the deck); never the band.
  assert.match(c, /const deckStops = result\.stops\.map\(\(stop, j\) => \(\{ stop, at: j \+ 1 \}\)\)\.filter\(\(x\) => x\.stop\.role !== 'journal'\);/);
  assert.match(c, /const N = deckStops\.length;/, 'the stops, never the band');
  // PLAN-01 (2026-10-13): the line is the PLAN bar's words — soFarWords became planSoFarWords; the band's share stays on it.
  // TOTALS-01 amendment II (Alex, 2026-10-15): moved, not loosened — the line is of the TOTAL row's BUDGET now, which the band is not in; the
  // "· $N all day" note beside it is unchanged (its own condition, plannedCents and the band), and still names the band's money.
  // DECK-01 (Alex, 2026-10-16): the line is each stop card's (stopPlate(f)). Moved, not loosened.
  assert.match(c, /data-day-plan-so-far>\{planSoFarWords\(totals\.budgetCents === null \? null : f\.soFarCents, totals\.budgetCents\)\}\{plannedCents !== null && result\.allDayCents > 0 && <span className="font-medium text-text-muted" data-day-so-far-all-day> · \{allDayCentsWords\(planDollars\(result\.allDayCents\)\)\}<\/span>\}/, 'the step card names the band’s money beside its line');
  assert.match(c, /setItems\(null\);\n[\s\S]*?setReportReads\(0\);/, 'a new day resets the re-read counter — one report read per day change');
  // CLEAN-01 (2026-10-14): the plate's foot left the plate (its lines are the fine print under it) — the band is the full card's last part.
  // DECK-01 (Alex, 2026-10-16): the full card's body is fullPlate, which ends at `const under` — the band is its last part.
  assert.ok(c.indexOf('data-day-stops') < c.indexOf('data-day-all-day') && c.indexOf('data-day-all-day') < c.indexOf('const under = ') && c.indexOf('data-day-all-day') < c.indexOf('data-day-fine-print'), 'after the rows, the last of the full card — on the plate, above the fine print');
  // PLAN-01 (2026-10-13): the hint's width is the plate's — PLATE_WIDTH, the one constant.
  // DECK-01 (2026-10-16): the hint says the deck's way in (SWIPE_HINT_WORDS), at the plate's width or the screen's (`under`) — still under the full card, outside it.
  assert.match(c, /\{loaded && focus === null && N > 0 && <p className="mx-auto text-xs text-text-muted" style=\{under\} data-day-hint>\{SWIPE_HINT_WORDS\}<\/p>\}/, 'the hint, under the full plate, outside it');
  assert.ok(c.indexOf('data-day-card') < c.indexOf('data-day-hint'), 'outside the recorded box');
  assert.match(c, /const bookNameOf = \(entityId: string\): string => \{\n\s*const book = report !== null && report\.ok \? report\.value\.report\.books\.find\(\(b\) => b\.entityId === entityId\) : undefined;\n\s*return book === undefined \? ACCOUNT_CELL_WORDS\.bookNotLoaded : book\.entityName;\n\s*\};/, 'the book by name from the report’s own books, else said as not loaded');
  assert.match(c, /if \(day === null \|\| today === null \|\| reportReads === 0\) return;\n[\s\S]*?const r = await readDayReport\(day, today\);\n\s*if \(live\) setReport\(r\);/, 'the report read again in place after a vendor write — never blanked first');
  const reread = /if \(day === null \|\| today === null \|\| reportReads === 0\) return;([\s\S]*?)\}, \[day, today, reportReads\]\);/.exec(c);
  assert.ok(reread !== null, 'the re-read effect, keyed on reportReads');
  assert.doesNotMatch(reread[1], /setReport\(null\)|setDayRead|setItems/, 'the re-read touches the report only, and never blanks it first');
});
