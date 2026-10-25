/**
 * ALLDAY-01 (Alex, 2026-10-19) — an all-day routine (a subscription, a
 * membership, a bill) has a date, not a clock: no time asked, a fixed clock
 * derived; the routine list is two tables, Business and Personal, each with
 * its timed rows in clock order and its all-day charges in a band below; the
 * move does not touch all-day routines.
 *
 * T1 the rule by value: ALL_DAY_CLOCK, allDayTimeInput (no time for all day,
 *    a time sent refused by name, every other role untouched), withRole, the
 *    compile with the derived clock, the list's words and the band's order.
 * T2 the readers with the new clock: the day card's reader and the band, the
 *    budget's lines, the hub's tiles, the evaluator — each on the date.
 * T3 the routes' source: the role read first, the one shared rule, the
 *    all-day branch (no time read, the window null, the compile on the
 *    derived clock), the refusal by name, the rekey path untouched; a role
 *    leaving all day needs its time.
 * T4 the forms: no TIME row for all day, the role through withRole, the row
 *    seeded through it, the times sent as null.
 * T5 the list: one table per book in the books' order, the timed rows then
 *    the ALL DAY band under the role's words, "no routines", the ENDED table
 *    once at the bottom, "+ new routine" once.
 * T6 the move: charges are not rows, listed under their own line, an entry
 *    naming one refused by name, the words and the audit say how many.
 * T7 the words: one phrasing of the role, nowhere a second.
 */

import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { code, comments } from '../sourceText';
import {
  ALL_DAY_CLOCK, ALL_DAY_NO_TIME_WORDS, allDayTimeInput, byNextDateThenName, clockOfRule, clockWords, compileFormToRRule, daysWords, formOfRule, timeWords, withRole,
} from '../operations/rruleHelpers';
import { ROLE_WORDS, STOP_ROLES, isStop } from '../operations/stopRole';
import { routineDay } from '../operations/routineDay';
import { buildRoutineBudgetLines } from '../budget/days';
import { mapOperationsRoutines } from '../hub/mapOperationsRoutines';
import { evaluateWindow } from '../../inngest/functions/routine-evaluator';
import { allDayEntryWords, allDayStayWords, isCharge, leftAlone, listRows, moveWords, planMove, type MoveRoutine } from '../operations/routineMove';
import { DEFAULT_ROUTINE_FORM, type Routine, type RoutineForm, type TodayRoutineEntry } from '@/components/workbench/operations/routines/types';
import { dayStops, type DayCardInput } from '@/components/workbench/operations/day/dayCard';
import { ALL_DAY_WORDS, routineRowsOf, routineTable } from '../operations/work'; // WORK-01 (2026-10-24): RoutineList left — THE WORK's rules; WORK-01d (2026-10-25): the routine spec's own builder

const HELPERS = 'src/lib/operations/rruleHelpers.ts';
const RULES = 'src/lib/operations/stopRole.ts';
const CREATE_ROUTE = 'src/app/api/operations/routines/route.ts';
const PATCH_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const BUILDER = 'src/components/workbench/operations/routines/RRULEBuilder.tsx';
const CREATE_FORM = 'src/components/workbench/operations/routines/RoutineCreateForm.tsx';
// WORK-01 (Alex, 2026-10-24): RoutineRow left — its edit form is RoutineEditForm (lifted, moved code); ROW names it.
const ROW = 'src/components/workbench/operations/routines/RoutineEditForm.tsx';
const SECTION_E = 'src/components/workbench/operations/SectionE_Work.tsx';
const SECTION_F = 'src/components/workbench/operations/SectionF_RoutineExpenses.tsx'; // WORK-01d (2026-10-25): the routines' table
const WORK_LIB = 'src/lib/operations/work.ts';
const PLAN = 'src/lib/operations/routineMove.ts';
const CONTROL = 'src/components/workbench/operations/stops/MoveControl.tsx';
const MOVE_ROUTE = 'src/app/api/operations/routines/move/route.ts';

const LA = 'America/Los_Angeles';
const BKK = 'Asia/Bangkok';
/** Apple storage on the 11th — the derived clock. */
const APPLE_RULE = 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=0;BYMINUTE=0;BYSECOND=0';
const form = (over: Partial<RoutineForm> = {}): RoutineForm => ({ ...DEFAULT_ROUTINE_FORM, name: 'Apple storage', entity_id: 'P', days: 'monthly', cadence_mode: 'monthly_day_of_month', monthly_day_of_month: '11', start_time: '08:00', end_time: '09:00', ...over });

test('T1 the rule by value: ALL_DAY_CLOCK, allDayTimeInput, withRole, the compile on the derived clock, the words, the band\'s order', () => {
  assert.deepEqual(ALL_DAY_CLOCK, { hour: 0, minute: 0 });
  assert.equal(clockWords(ALL_DAY_CLOCK), '00:00');
  assert.equal(ALL_DAY_NO_TIME_WORDS, 'an all-day routine has no time — it is a charge on a date, not a stop');
  // No time for all day: absent, null or blank; a time sent is refused by name, the start first, then the end.
  for (const body of [{}, { start_time: null, end_time: null }, { start_time: '', end_time: '' }, { start_time: undefined, end_time: '  ' }]) {
    assert.deepEqual(allDayTimeInput('all_day', body), { ok: true, allDay: true, start_time: '00:00' }, JSON.stringify(body));
  }
  assert.deepEqual(allDayTimeInput('all_day', { start_time: '08:00', end_time: null }), { ok: false, field: 'start_time', message: ALL_DAY_NO_TIME_WORDS });
  assert.deepEqual(allDayTimeInput('all_day', { start_time: null, end_time: '09:00' }), { ok: false, field: 'end_time', message: ALL_DAY_NO_TIME_WORDS });
  assert.deepEqual(allDayTimeInput('all_day', { start_time: '08:00', end_time: '09:00' }), { ok: false, field: 'start_time', message: ALL_DAY_NO_TIME_WORDS });
  // Every other role is untouched — the start-time rule (ROUTINE-02b) is theirs.
  for (const role of STOP_ROLES) if (isStop(role)) assert.deepEqual(allDayTimeInput(role, { start_time: '08:00', end_time: '09:00' }), { ok: true, allDay: false }, role);
  // withRole: all day blanks the times and carries the derived clock in byhour/byminute (and in a custom rule); a timed role leaves the form.
  const allDay = withRole(form(), 'all_day');
  assert.equal(allDay.role, 'all_day'); assert.equal(allDay.start_time, ''); assert.equal(allDay.end_time, ''); assert.equal(allDay.byhour, '00'); assert.equal(allDay.byminute, '00');
  assert.equal(allDay.monthly_day_of_month, '11', 'the days are its own');
  const custom = withRole(form({ days: 'custom', cadence_mode: 'custom', custom_rrule: 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15;BYHOUR=8;BYMINUTE=0' }), 'all_day');
  assert.equal(custom.custom_rrule, 'FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15;BYHOUR=0;BYMINUTE=0', 'a custom rule\'s own clock is the derived one');
  const timed = withRole(allDay, 'place');
  assert.equal(timed.role, 'place'); assert.equal(timed.start_time, '', 'the row asks it'); assert.equal(timed.byhour, '00');
  assert.deepEqual(withRole(form(), 'none'), { ...form(), role: 'none' }, 'a timed role changes the role alone');
  // The compile, given the derived clock as the routes give it: BYHOUR=0;BYMINUTE=0; the stored rule still opens Monthly and prints "11th".
  const compiled = compileFormToRRule({ ...allDay, start_time: clockWords(ALL_DAY_CLOCK) });
  assert.equal(compiled, APPLE_RULE);
  assert.deepEqual(clockOfRule(compiled), ALL_DAY_CLOCK);
  assert.equal(formOfRule(compiled, null).days, 'monthly'); assert.equal(daysWords(compiled, null), '11th');
  assert.equal(formOfRule('FREQ=MONTHLY;BYDAY=2TU;BYHOUR=0;BYMINUTE=0;BYSECOND=0', null).monthly_nth, '2'); assert.equal(daysWords('FREQ=MONTHLY;BYDAY=2TU;BYHOUR=0;BYMINUTE=0;BYSECOND=0', null), '2nd Tue');
  assert.throws(() => compileFormToRRule({ ...allDay, start_time: clockWords(ALL_DAY_CLOCK), byhour: '08' }), /byhour\/byminute 08:00 disagree with the start time 00:00/, 'a second writer of the clock is refused by name, as ROUTINE-02b has it');
  // The Time column: "—" for all day, whatever clock the rule carries; the rest as FORM-01 prints it.
  assert.equal(timeWords({ schedule_rrule: APPLE_RULE, end_time: null, role: 'all_day' }), '—');
  assert.equal(timeWords({ schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=8;BYMINUTE=0', end_time: '1970-01-01T09:00:00.000Z', role: 'all_day' }), '—', 'a legacy all-day row at 08:00 prints no time either');
  assert.equal(timeWords({ schedule_rrule: APPLE_RULE, end_time: null, role: 'place' }), '00:00');
  assert.equal(timeWords({ schedule_rrule: 'FREQ=DAILY;BYHOUR=11;BYMINUTE=0', end_time: '1970-01-01T12:00:00.000Z' }), '11:00 – 12:00', 'no role given: as before');
  // The band's order: by the next date, none last, then name.
  const rows = [
    { name: 'HBO', next_due_at: '2026-11-12T07:00:00.000Z' },
    { name: 'Phone bill', next_due_at: '2026-11-07T07:00:00.000Z' },
    { name: 'Ended one', next_due_at: null },
    { name: 'Apple storage', next_due_at: '2026-11-11T07:00:00.000Z' },
    { name: 'Also the 7th', next_due_at: new Date('2026-11-07T07:00:00.000Z') },
  ];
  assert.deepEqual([...rows].sort(byNextDateThenName).map((r) => r.name), ['Also the 7th', 'Phone bill', 'Apple storage', 'HBO', 'Ended one']);
  assert.match(comments(HELPERS), /ALLDAY-01 \(Alex, 2026-10-19\): AN ALL-DAY ROUTINE HAS A DATE, NOT A CLOCK/);
});

test('T2 the readers with the derived clock: the day card\'s reader and its band, the budget\'s lines, the hub\'s tiles, the evaluator — each on the date', () => {
  const now = new Date('2026-11-11T20:00:00.000Z');
  // The day card's reader (routineDay): Nov 11 in LA holds the occurrence at local midnight — 08:00Z (PST).
  const la = routineDay({ timezone: LA, schedule_rrule: APPLE_RULE, start_date: null, end_date: null }, '2026-11-11', now);
  assert.deepEqual(la, { kind: 'occurrence', day: '2026-11-11', expectedAt: new Date('2026-11-11T08:00:00.000Z') });
  assert.equal(routineDay({ timezone: LA, schedule_rrule: APPLE_RULE, start_date: null, end_date: null }, '2026-11-10', now).kind, 'none', 'not the day before');
  // In Bangkok the same rule is 17:00Z the day before — still Nov 11 there.
  const bkk = routineDay({ timezone: BKK, schedule_rrule: APPLE_RULE, start_date: null, end_date: null }, '2026-11-11', now);
  assert.deepEqual(bkk, { kind: 'occurrence', day: '2026-11-11', expectedAt: new Date('2026-11-10T17:00:00.000Z') });
  // The band: the card puts the entry under allDay by its role, at 00:00, with its line's amount.
  const routine: Routine = {
    id: 'apple', user_id: 'u', entity_id: 'P', name: 'Apple storage', description: null, schedule_rrule: APPLE_RULE, timezone: BKK,
    next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
    ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: null, end_time: null, is_active: true,
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z', created_by: null, budget_amount: '2.99', coa_code: '5100', location: null, steps: [], role: 'all_day',
  };
  const entry: TodayRoutineEntry = { routine, expected_at: '2026-11-10T17:00:00.000Z', status: 'pending', completion: null };
  const input: DayCardInput = {
    day: '2026-11-11', entries: [entry], items: [], notPlaced: [], viewerZone: BKK, records: null,
    lines: [{ entityId: 'P', code: '5100', day: '2026-11-11', source: 'routine', line: null, time: '00:00', vendor: null, address: { kind: 'routine', id: 'apple', instant: '2026-11-10T17:00:00.000Z' }, cents: 299, label: 'Apple storage' }],
  };
  const card = dayStops(input);
  assert.deepEqual(card.allDay.map((s) => [s.label, s.role, s.time, s.cents]), [['Apple storage', 'all_day', '00:00', 299]]);
  assert.equal(card.stops.length, 0, 'not a stop'); assert.equal(card.allDayCents, 299);
  // The budget: the line lands on Nov 11 in LA.
  const budget = buildRoutineBudgetLines([{ id: 'apple', name: 'Apple storage', entityId: 'P', entityType: 'personal', timezone: LA, scheduleRrule: APPLE_RULE, startDate: null, endDate: null, budgetAmount: '2.99', coaCode: 'P-5100', steps: [] }], '2026-11-01', '2026-11-30');
  assert.deepEqual(budget.lines.map((l) => [l.day, l.cents]), [['2026-11-11', 299]]);
  assert.equal(budget.notPlaced.length, 0);
  // The hub: a routine with no stored window is an all-day tile on its date (mapOperationsRoutines.ts, PR-Ops-5.8), not an hourly block.
  const tiles = mapOperationsRoutines({ routines: [{ routine_id: 'apple', name: 'Apple storage', entity_id: 'P', timezone: LA, start_time: null, end_time: null, occurrences: ['2026-11-11T08:00:00.000Z'], coa_code: 'P-5100', budget_amount: 2.99, cadence: 'monthly' }], truncated: false });
  assert.equal(tiles.length, 1); assert.equal(tiles[0].startDate, '2026-11-11'); assert.equal(tiles[0].startTime, undefined, 'the all-day row');
  // The evaluator: expected on the date, never a miss (TASKS-ONE-02), the next at the derived clock.
  const w = evaluateWindow({ schedule_rrule: APPLE_RULE, timezone: LA, start_date: null, end_date: null, fail_threshold_minutes: 30, role: 'all_day' }, new Date('2026-11-10T00:00:00.000Z'), now);
  assert.deepEqual(w.expected, [new Date('2026-11-11T08:00:00.000Z')]); assert.deepEqual(w.misses, []); assert.deepEqual(w.nextDueAt, new Date('2026-12-11T08:00:00.000Z'));
});

test('T3 the routes: the role first, the one shared rule, the all-day branch, the refusal by name, the window null, the compile on the derived clock, the rekey untouched; a role leaving all day needs its time', () => {
  const create = code(CREATE_ROUTE);
  for (const f of [CREATE_ROUTE, PATCH_ROUTE]) assert.match(code(f), /allDayTimeInput/, `${f} applies the shared rule`);
  assert.ok(create.indexOf('const role = roleInput(body.role);') < create.indexOf('allDayTimeInput(role.role, body)'), 'the role before the rule');
  assert.ok(create.indexOf('allDayTimeInput(role.role, body)') < create.indexOf("parseTimeOrNull(body.start_time, 'start_time')"), 'the rule before any time is read');
  assert.match(create, /if \(!allDay\.ok\) return NextResponse\.json\(\{ error: 'Validation', field: allDay\.field, message: allDay\.message \}, \{ status: 400 \}\);/);
  assert.match(create, /const startTimeResult = allDay\.allDay \? \{ value: null, error: null \} : parseTimeOrNull\(body\.start_time, 'start_time'\);/, 'no time read for all day');
  assert.match(create, /if \(!allDay\.allDay && startTimeResult\.value === null\) \{\n\s*return NextResponse\.json\(\{ error: 'Validation', field: 'start_time', message: START_TIME_REQUIRED_WORDS \}, \{ status: 400 \}\);/, 'the start time required of every other role (ROUTINE-02b)');
  assert.match(create, /const endTimeResult = allDay\.allDay \? \{ value: null, error: null \} : parseTimeOrNull\(body\.end_time, 'end_time'\);/);
  assert.match(create, /compileFormToRRule\(allDay\.allDay \? \(\{ \.\.\.body, start_time: allDay\.start_time \} as RoutineForm\) : \(body as RoutineForm\)\)/, 'the compile sees the derived clock');
  assert.match(create, /if \(!once && !allDay\.allDay && endTimeResult\.value === null\) \{/, 'no window required of all day');
  assert.match(create, /start_time: startTimeResult\.value,\n\s*end_time: endTimeResult\.value,/, 'the window as read — null for all day');
  assert.match(create, /all_day: allDay\.allDay,/, 'the audit says so');
  const patch = code(PATCH_ROUTE);
  const handler = patch.slice(patch.indexOf('export async function PATCH('), patch.indexOf('export async function DELETE('));
  assert.match(handler, /const effectiveRole = roleInput\(body\.role !== undefined \? body\.role : existing\.role\);/, 'the effective role — the body\'s, else the stored one');
  assert.match(handler, /if \(!effectiveRole\.ok\) throw new Error\(`routine \$\{id\} carries role \$\{JSON\.stringify\(existing\.role\)\} — not one of the six`\);/);
  assert.match(handler, /const wasAllDay = storedRole\.ok && !isStop\(storedRole\.role\);/);
  assert.match(handler, /const allDay = allDayTimeInput\(effectiveRole\.role, body\);\n\s*if \(!allDay\.ok\) return NextResponse\.json\(\{ error: 'Validation', field: allDay\.field, message: allDay\.message \}, \{ status: 400 \}\);/);
  assert.match(handler, /if \(allDay\.allDay\) \{\n\s*effectiveStartTime = null;\n\s*effectiveEndTime = null;\n\s*data\.start_time = null;\n\s*data\.end_time = null;\n\s*\} else \{\n\s*if \('start_time' in body\) \{/, 'the window null; else the times as ROUTINE-02b reads them');
  assert.match(handler, /if \(wasAllDay && effectiveStartTime === null\) \{\n\s*return NextResponse\.json\(\{ error: 'Validation', field: 'start_time', message: START_TIME_REQUIRED_WORDS \}, \{ status: 400 \}\);/, 'leaving all day needs its time');
  assert.match(handler, /const effectiveStartTimeStr = allDay\.allDay \? allDay\.start_time : effectiveStartTime \? effectiveStartTime\.toISOString\(\)\.slice\(11, 16\) : '';/, 'the derived clock is the effective start time');
  assert.match(handler, /compileFormToRRule\(\{ \.\.\.body, start_date: effectiveStartStr, start_time: effectiveStartTimeStr \} as RoutineForm\)/, 'the compile sees it (ROUTINE-02b\'s pin stands)');
  assert.match(handler, /\} else if \(effectiveClock !== null && !sameClock\(clockOfRule\(existing\.schedule_rrule\), effectiveClock\)\) \{\n\s*data\.schedule_rrule = withClock\(existing\.schedule_rrule, effectiveClock\);/, 'a typed clock still carried is re-clocked');
  assert.match(handler, /const clockMoved = !sameClock\(clockOfRule\(existing\.schedule_rrule\), clockOfRule\(nextRrule\)\) && clockOfRule\(nextRrule\) !== null;/, 'the rekey gate untouched — a role change to all day goes through it');
  assert.ok(handler.indexOf('allDayTimeInput(effectiveRole.role, body)') < handler.indexOf('const cadenceFieldsPresent'), 'before the compile');
  for (const f of [CREATE_ROUTE, PATCH_ROUTE]) assert.match(comments(f), /ALLDAY-01 \(Alex, 2026-10-19\)/);
  assert.doesNotMatch(patch, /existing\.role === 'all_day'|role === 'all_day'/, 'the routes ask the rule, never the value');
  assert.doesNotMatch(create, /role === 'all_day'/);
});

test('T4 the forms: no TIME row for an all-day routine, the role through withRole, the row seeded through it, the times sent as null', () => {
  const f = code(CREATE_FORM);
  const r = code(ROW);
  assert.match(f, /onChange=\{\(e\) => setCreateForm\(withRole\(createForm, e\.target\.value as StopRole\)\)\}/);
  assert.match(r, /onChange=\{\(e\) => setForm\(withRole\(form, e\.target\.value as StopRole\)\)\}/);
  assert.match(f, /<DaysField form=\{createForm\} setForm=\{setForm\} \/>\n\s*\{isStop\(createForm\.role\) && <TimeField form=\{createForm\} setForm=\{setForm\} \/>\}/, 'days, then the time row — for a stop');
  assert.match(r, /<DaysField form=\{form\} setForm=\{setForm\} \/>\n\s*\{isStop\(form\.role\) && <TimeField form=\{form\} setForm=\{setForm\} \/>\}/);
  assert.match(r, /return isStop\(r\.role\) \? seeded : withRole\(seeded, r\.role\);/, 'the row opens an all-day routine with no time');
  assert.match(f, /start_time: createForm\.start_time \|\| null,\n\s*end_time: createForm\.end_time \|\| null,/, 'blank → null: the route\'s "no time"');
  assert.match(r, /start_time: form\.start_time \|\| null,\n\s*end_time: form\.end_time \|\| null,/);
  for (const file of [CREATE_FORM, ROW]) assert.match(code(file), /import \{[^}]*\bisStop\b[^}]*\} from '@\/lib\/operations\/stopRole';/);
  for (const file of [CREATE_FORM, ROW, BUILDER]) assert.match(comments(file), /ALLDAY-01 \(Alex, 2026-10-19\)/);
  assert.doesNotMatch(f, /role === 'all_day'/); assert.doesNotMatch(r, /role === 'all_day'/);
});

test('T5 the list: WORK-01 (Alex, 2026-10-24) — one table, every book: BOOK names the book, TIME says "all day" for a charge; the per-book tables and the ALL DAY band left', () => {
  const now = new Date('2026-10-19T05:00:00.000Z');
  const books = [{ id: 'p', name: 'Personal', entity_type: 'personal' }, { id: 'b', name: 'Business', entity_type: 'sole_prop' }];
  const r = (o: Partial<Routine> & { id: string; name: string }): Routine => ({
    entity_id: 'p', schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', timezone: LA, start_time: '1970-01-01T07:00:00.000Z', end_time: '1970-01-01T07:30:00.000Z',
    is_active: true, role: 'place', steps: [], start_date: null, end_date: null, budget_amount: null, coa_code: null, ...o,
  } as Routine);
  // WORK-01d (Alex, 2026-10-25): the routines are ROUTINE EXPENSES' rows (routineRowsOf over routineTable) — the merged builder left with the KIND column.
  const rows = routineRowsOf([
    r({ id: 'apple', name: 'Apple storage', role: 'all_day', schedule_rrule: APPLE_RULE, start_time: null, end_time: null, budget_amount: '2.99' }),
    r({ id: 'dinner', name: 'Dinner', entity_id: 'b' }),
    r({ id: 'stray', name: 'Stray', entity_id: 'nobody' }),
  ], now);
  const columns = routineTable(books, {});
  const words = (id: string, key: string) => columns.find((c) => c.key === key)!.words(rows.find((x) => x.id === `routine:${id}`)!);
  // The charge's TIME is the role's own fact — all day, never a clock drawn from its derived 00:00; a timed routine shows its window.
  assert.equal(words('apple', 'time'), ALL_DAY_WORDS);
  assert.equal(ALL_DAY_WORDS, 'all day');
  assert.equal(words('dinner', 'time'), '07:00 – 07:30');
  // Every book in one table, each row naming its book; a book the tab has not listed is said, never dropped.
  assert.deepEqual([words('apple', 'book'), words('dinner', 'book'), words('stray', 'book')], ['Personal', 'Business', 'book not loaded']);
  assert.deepEqual(rows.map((x) => x.id), ['routine:apple', 'routine:dinner', 'routine:stray'], 'clock order then name — the charge\'s derived 00:00 first, the books mixed');
  // The section: no per-book tables, no band, no second classifier; "+ routine" once.
  // WORK-01d (Alex, 2026-10-25): the routines' section is SectionF_RoutineExpenses — the pins moved there; THE WORK (SectionE_Work) holds no "+ routine".
  const e = code(SECTION_F);
  assert.doesNotMatch(e, /data-all-day-band|data-routines-book|booksInOrder|allDayHeadingWords|NO_ROUTINES_WORDS|role === 'all_day'/);
  assert.equal((e.match(/ADD_ROUTINE_WORDS\}/g) ?? []).length, 1, 'the button once');
  assert.doesNotMatch(code(SECTION_E), /ADD_ROUTINE_WORDS|role === 'all_day'/);
  const w = code(WORK_LIB);
  assert.match(w, /return words === DAYS_NONE_WORDS \? ALL_DAY_WORDS : words;/, 'ROUTINE EXPENSES asks the rule (timeWords), then says all day');
  assert.doesNotMatch(w, /role === 'all_day'/);
  assert.match(comments(WORK_LIB), /ALLDAY-01/);
});

test('T6 the move leaves charges alone: not rows, listed under their own line, an entry naming one refused by name, the words and the audit say how many', () => {
  const NOW = new Date('2026-10-19T05:00:00.000Z');
  const DATE = '2026-10-22';
  const r = (o: Partial<MoveRoutine> & { id: string; name: string }): MoveRoutine => ({
    schedule_rrule: 'FREQ=DAILY;BYHOUR=21;BYMINUTE=0;BYSECOND=0', timezone: BKK, start_date: null, end_date: null,
    start_time: '1970-01-01T21:00:00.000Z', end_time: '1970-01-01T23:59:00.000Z', is_active: true, role: 'none', ...o,
  });
  const routines = [
    r({ id: 'a', name: 'Dinner', role: 'place' }),
    r({ id: 'apple', name: 'Apple storage', role: 'all_day', schedule_rrule: APPLE_RULE, timezone: LA, start_time: null, end_time: null }),
    r({ id: 'hbo', name: 'HBO', role: 'all_day', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=12;BYHOUR=8;BYMINUTE=0;BYSECOND=0', timezone: LA, start_time: '1970-01-01T08:00:00.000Z', end_time: null }),
    r({ id: 'ended', name: 'Old bill', role: 'all_day', schedule_rrule: APPLE_RULE, end_date: '2026-10-20' }),
    r({ id: 'off', name: 'Inactive bill', role: 'all_day', schedule_rrule: APPLE_RULE, is_active: false }),
  ];
  assert.equal(isCharge(routines[1]), true); assert.equal(isCharge(routines[0]), false);
  assert.throws(() => isCharge({ id: 'x', role: 'subscription' }), /carries role "subscription" — not one of the six/);
  assert.deepEqual(listRows(routines, DATE).map((row) => row.name), ['Dinner'], 'the charges are not rows');
  assert.deepEqual(leftAlone(routines, DATE), [{ id: 'apple', name: 'Apple storage' }, { id: 'hbo', name: 'HBO' }], 'the current ones, whatever clock they still carry; an ended or inactive one is not the move\'s');
  const entries = [{ id: 'a', carry: true, start_time: '21:00', end_time: '23:59' }];
  const p = planMove({ date: DATE, timezone: 'Asia/Makassar', now: NOW, stay: null, routines, entries, stays: [] });
  assert.ok(p.ok, JSON.stringify(p));
  assert.deepEqual(p.all_day, [{ id: 'apple', name: 'Apple storage' }, { id: 'hbo', name: 'HBO' }]);
  assert.deepEqual(p.ends.map((e) => e.name), ['Dinner']); assert.deepEqual(p.copies.map((c) => c.name), ['Dinner']); assert.deepEqual(p.rezoned, []);
  assert.equal(p.words, '1 routine ends 2026-10-21; 1 copy starts 2026-10-22 in Asia/Makassar; 0 re-zoned; 2 all-day charges stay as they are; no stay change');
  assert.deepEqual(planMove({ date: DATE, timezone: 'Asia/Makassar', now: NOW, stay: null, routines, entries: [...entries, { id: 'hbo', carry: true, start_time: '08:00', end_time: '09:00' }], stays: [] }), { ok: false, status: 400, field: 'routines[1].id', message: 'HBO is an all-day charge — it stays as it is and takes no entry' });
  assert.equal(allDayEntryWords('HBO'), 'HBO is an all-day charge — it stays as it is and takes no entry');
  assert.equal(allDayStayWords(1), '1 all-day charge stays as it is (they hit the account on a date, wherever you are)');
  assert.equal(allDayStayWords(3), '3 all-day charges stay as they are (they hit the account on a date, wherever you are)');
  assert.equal(moveWords({ ends: [], copies: [], rezoned: [], all_day: [1], date: DATE, day_before: '2026-10-21', timezone: 'Asia/Makassar', stay: null }), '0 routines end 2026-10-21; 0 copies start 2026-10-22 in Asia/Makassar; 0 re-zoned; 1 all-day charge stays as they are; no stay change');
  // The control: the charges under their own line, no boxes; the plan from the one rule as before.
  const c = code(CONTROL);
  assert.match(c, /const charges = date === '' \? \[\] : leftAlone\(active, date\);/);
  assert.match(c, /\{ready && charges\.length > 0 && \(\n\s*<div className="text-text-muted" data-move-all-day>\n\s*<p data-move-all-day-words>\{allDayStayWords\(charges\.length\)\}<\/p>\n\s*<ul className="pl-4 list-disc">\n\s*\{charges\.map\(\(c\) => <li key=\{c\.id\} data-move-all-day-row=\{c\.id\}>\{c\.name\}<\/li>\)\}/);
  assert.ok(c.indexOf('data-move-all-day>') > c.indexOf('</table>') && c.indexOf('data-move-all-day>') < c.indexOf('data-move-tasks>'), 'under the list, above the tasks line');
  assert.doesNotMatch(c.slice(c.indexOf('data-move-all-day>'), c.indexOf('data-move-tasks>')), /<input/, 'no box for a charge');
  // The route: the plan's charges in the answer and in the audit row; nothing written for them.
  const s = code(MOVE_ROUTE);
  assert.match(s, /all_day: plan\.all_day,/); assert.match(s, /all_day: plan\.all_day\.map\(\(a\) => a\.id\),/);
  assert.equal((s.match(/\ball_day\b/g) ?? []).length, 4, 'the route reads the charges from the plan alone — the answer and the audit row, nothing written');
  for (const f of [PLAN, CONTROL, MOVE_ROUTE]) assert.match(comments(f), /ALLDAY-01 \(Alex, 2026-10-19\)/);
  assert.match(code(PLAN), /import \{ isStop, isStopRole \} from '\.\/stopRole';/);
  assert.doesNotMatch(code(PLAN), /role === 'all_day'/, 'the plan asks the rule');
});

test('T7 the words: the role reads "all day — a charge on a date, not a stop", once, nowhere a second phrasing', () => {
  assert.equal(ROLE_WORDS.all_day, 'all day — a charge on a date, not a stop');
  assert.match(comments(RULES), /ALLDAY-01 \(Alex, 2026-10-19\): the one phrasing/);
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
  const second = walk('src').filter((p) => !p.includes('__tests__') && /a subscription or membership, not a stop/.test(code(p)));
  assert.deepEqual(second, [], 'the old phrasing is gone from the code of src (the rule\'s own dated note names it)');
});
