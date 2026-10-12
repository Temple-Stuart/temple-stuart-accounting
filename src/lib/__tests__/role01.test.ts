/**
 * ROLE-01 (2026-10-13) — THE ROUTINE'S ROLE: what kind of stop it is on the day
 * card. One field on the routine, set once on the Tasks tab; an all-day routine
 * is in the day's plan but not a stop (the plate's "also today" band); the form
 * under the plate asks what the stop's role asks; a place stop plans its vendor
 * there.
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
  ALSO_TODAY_WORDS, DEFAULT_ROLE, NOTE_PROMPT_WORDS, NOT_A_STOP_WORDS, NO_AMOUNT_NO_VENDOR_WORDS, ROLE_SHORT_WORDS, ROLE_WORDS, STOP_ROLES, TAP_A_STOP_WORDS, isStop, isStopRole, roleInput,
} from '../operations/stopRole';
import type { StopRecordRow } from '../operations/stopRecord';
import type { DailyPlanItem } from '@/components/workbench/operations/dailyplan/types';
import type { Routine, RoutineStep, TodayRoutineEntry, TodayStatus } from '@/components/workbench/operations/routines/types';
import { DEFAULT_ROUTINE_FORM } from '@/components/workbench/operations/routines/types';
import { completenessWords, dayStops, focusStop, hookWords, type DayCardInput } from '@/components/workbench/operations/day/dayCard';

const RULES = 'src/lib/operations/stopRole.ts';
const CARD_RULES = 'src/components/workbench/operations/day/dayCard.ts';
const CARD = 'src/components/workbench/operations/day/DayCard.tsx';
const FORM = 'src/components/workbench/operations/stops/StopForm.tsx';
const ROUTE_CREATE = 'src/app/api/operations/routines/route.ts';
const ROUTE_PATCH = 'src/app/api/operations/routines/[id]/route.ts';
const CREATE_FORM = 'src/components/workbench/operations/routines/RoutineCreateForm.tsx';
const ROW = 'src/components/workbench/operations/routines/RoutineRow.tsx';
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
    all_day: 'all day — a subscription or membership, not a stop',
    none: 'none — the plain record',
  });
  assert.deepEqual(ROLE_SHORT_WORDS, { journal: 'journal', plan: 'plan', execute: 'execute', place: 'place', all_day: 'all day', none: '' });
  assert.equal(ALSO_TODAY_WORDS, 'also today');
  assert.equal(NOT_A_STOP_WORDS, "in the day's plan, not a stop");
  assert.equal(TAP_A_STOP_WORDS, 'tap a stop to record it');
  assert.equal(NO_AMOUNT_NO_VENDOR_WORDS, 'give this line an amount on the Tasks tab to plan its vendor');
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
  assert.equal(hookWords(r.stops.length), '4 stops · under or over?');
  assert.equal(focusStop(r, 4)!.stop.label, 'Gym');
  assert.equal(focusStop(r, 5), null, 'HBO has no step');
  assert.equal(r.stops.find((s) => s.label === 'Brunch')!.planLine, brunchLine, 'the matched line rides on the stop — the vendor box plans on it');
  assert.equal(r.stops.find((s) => s.label === 'Gym')!.planLine, null);
  assert.equal(completenessWords(r, 0, { day: true, report: true, records: true }), '3 not priced · 4 not recorded');
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
  assert.doesNotMatch(code(CARD_RULES), /role === 'all_day'|=== 'all_day'/, 'the card asks the rule (isStop), never the value');
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
  assert.equal(dirs[dirs.length - 1], MIGRATION_DIR, 'the newest migration');
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
  for (const f of [ROUTE_CREATE, ROUTE_PATCH]) assert.match(code(f), /import \{ roleInput \} from '@\/lib\/operations\/stopRole';/);
  // The create form and the edit form: one select over STOP_ROLES, each option its sentence; the row's small print shows a set role.
  const form = code(CREATE_FORM);
  assert.match(form, /<select\n\s*value=\{createForm\.role\}\n\s*onChange=\{\(e\) => setCreateForm\(\{ \.\.\.createForm, role: e\.target\.value as StopRole \}\)\}\n\s*className=\{inputClass\}\n\s*data-routine-role\n\s*>\n\s*\{STOP_ROLES\.map\(\(r\) => \(\n\s*<option key=\{r\} value=\{r\}>\{ROLE_WORDS\[r\]\}<\/option>/);
  const row = code(ROW);
  assert.match(row, /<select\n\s*value=\{form\.role\}\n\s*onChange=\{\(e\) => setForm\(\{ \.\.\.form, role: e\.target\.value as StopRole \}\)\}\n\s*className=\{inputClass\}\n\s*data-routine-role-select\n\s*>\n\s*\{STOP_ROLES\.map\(\(r\) => \(\n\s*<option key=\{r\} value=\{r\}>\{ROLE_WORDS\[r\]\}<\/option>/);
  assert.match(row, /    role: r\.role,\n/, 'routineToForm carries it, so an edit never resets it');
  assert.match(row, /\{routine\.role !== 'none' && <span title="role on the day card" data-routine-role=\{routine\.role\}>\{ROLE_SHORT_WORDS\[routine\.role\]\}<\/span>\}/);
  assert.match(form, /body: JSON\.stringify\(\{\n\s*\.\.\.createForm,/, 'the form is sent whole — the role rides with it');
  assert.match(row, /body: JSON\.stringify\(\{\n\s*\.\.\.form,/);
});

// ── T4 · THE FORM AND THE PLATE ──────────────────────────────────────────────

test('T4 the form asks what the role asks; a place stop plans its vendor on its matched line; the plate’s band and hint', () => {
  const f = code(FORM);
  assert.match(f, /const role = stop\.role === 'all_day' \? 'none' : stop\.role;/);
  assert.match(f, /const differs = typedCents !== null && stop\.cents !== null && typedCents !== stop\.cents;/, '"why" only once the amount differs from the plan');
  assert.match(f, /const asks = role === 'place'\n\s*\? \{ amount: true, rating: true, minutes: false, note: draft\.outcome === 'skipped' \|\| differs \}\n\s*: role === 'none'\n\s*\? \{ amount: true, rating: true, minutes: true, note: true \}\n\s*: \{ amount: false, rating: false, minutes: true, note: true \};/);
  for (const ask of ['asks.amount', 'asks.rating', 'asks.minutes', 'asks.note']) assert.ok(f.includes(`{${ask} && (`), `${ask} gates its field`);
  assert.match(f, /placeholder=\{draft\.outcome === 'skipped' \? 'why — required' : NOTE_PROMPT_WORDS\[role\]\}/, 'the note is prompted by the role');
  assert.match(f, /\{role === 'place' && \(\n\s*<div className="flex flex-wrap items-center gap-1\.5 text-xs" data-stop-vendor>/);
  assert.match(f, /\{stop\.planLine !== null\n\s*\? <VendorBox line=\{stop\.planLine\} bookName=\{bookName\} directory=\{directory\} reload=\{onPlanChanged\} \/>\n\s*: <span className="text-text-muted" data-stop-no-vendor>\{NO_AMOUNT_NO_VENDOR_WORDS\}<\/span>\}/, 'Budget’s own vendor box on the matched plan line; no line, no vendor — said so');
  assert.match(f, /import \{ VendorBox, useDirectory \} from '@\/components\/budget\/DayPlanDrill';/);
  assert.match(f, /const directory = useDirectory\(\);/);
  assert.doesNotMatch(f, /\bfetch\s*\(|\/api\//, 'the form still names no route of its own');
  const c = code(CARD);
  assert.doesNotMatch(c, /VendorBox|useDirectory|vendor-directory|plan-vendors/, 'the day folder names no vendor box — the stops folder does');
  assert.match(c, /\{result\.allDay\.length > 0 && \(\n\s*<div className="flex flex-col" style=\{\{ gap: 4 \}\} data-day-all-day>/, 'the band, on the plate, after the rows');
  assert.match(c, /\{ALSO_TODAY_WORDS\.toUpperCase\(\)\}/);
  assert.match(c, /data-day-all-day-amount>\{planDollars\(s\.cents\)\}/);
  assert.match(c, /\{NOT_A_STOP_WORDS\}<\/div>/);
  assert.ok(c.indexOf('data-day-stops') < c.indexOf('data-day-all-day') && c.indexOf('data-day-all-day') < c.indexOf('data-day-plate-foot'), 'between the rows and the plate’s foot');
  assert.match(c, /\{loaded && focus === null && N > 0 && <p className="mx-auto text-xs text-text-muted" style=\{\{ width: 540 \}\} data-day-hint>\{TAP_A_STOP_WORDS\}<\/p>\}/, 'the hint, under the full plate, outside it');
  assert.ok(c.indexOf('data-day-card') < c.indexOf('data-day-hint'), 'outside the recorded box');
  assert.match(c, /const bookNameOf = \(entityId: string\): string => \{\n\s*const book = report !== null && report\.ok \? report\.value\.report\.books\.find\(\(b\) => b\.entityId === entityId\) : undefined;\n\s*return book === undefined \? ACCOUNT_CELL_WORDS\.bookNotLoaded : book\.entityName;\n\s*\};/, 'the book by name from the report’s own books, else said as not loaded');
  assert.match(c, /if \(day === null \|\| today === null \|\| reportReads === 0\) return;\n[\s\S]*?const r = await readDayReport\(day, today\);\n\s*if \(live\) setReport\(r\);/, 'the report read again in place after a vendor write — never blanked first');
  const reread = /if \(day === null \|\| today === null \|\| reportReads === 0\) return;([\s\S]*?)\}, \[day, today, reportReads\]\);/.exec(c);
  assert.ok(reread !== null, 'the re-read effect, keyed on reportReads');
  assert.doesNotMatch(reread[1], /setReport\(null\)|setDayRead|setItems/, 'the re-read touches the report only, and never blanks it first');
});
