/**
 * ROUTINE-02b (Alex, 2026-10-18) — ONE TIME PER ROUTINE: THE START TIME IS THE
 * CLOCK; A TIME OR ZONE EDIT MOVES THE ROUTINE'S HISTORY WITH IT; COA EDITABLE;
 * THE BOOK IS NOT.
 *
 * B1 the clock (rruleHelpers.ts) and the rekey rule (routineRekey.ts) are
 * DRIVEN by value; the builder, the forms, the row, the two routes, the
 * completions' writer, the migration, the enum and the audit list are anchored
 * to their source with comments stripped (TEST-TRUTH-01).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditActionType } from '@prisma/client';
import { code, comments } from '../sourceText';
import { ValidationError } from '../errors/ValidationError';
import {
  END_TIME_REQUIRED_WORDS, START_TIME_REQUIRED_WORDS, clockDisagreeWords, clockOfRule, clockOfTime, clockWords, compileFormToRRule, sameClock, withClock,
} from '../operations/rruleHelpers';
import { RekeyRefused, noOccurrenceWords, occupiedWords, oldZoneUnreadWords, rekeyPlan, rekeyedWords, type RekeySchedule } from '../operations/routineRekey';
import { DEFAULT_ROUTINE_FORM } from '@/components/workbench/operations/routines/types';
import { MISSED_AFTER_WORDS, withStartTime } from '@/components/workbench/operations/routines/RRULEBuilder';
import { BOOK_FIXED_WORDS, COA_NEEDS_AMOUNT_WORDS, COA_ON_LINES_WORDS } from '@/components/workbench/operations/routines/RoutineEditForm'; // WORK-01 (2026-10-24)

const HELPERS = 'src/lib/operations/rruleHelpers.ts';
const REKEY = 'src/lib/operations/routineRekey.ts';
const COMPLETION = 'src/lib/operations/routineCompletion.ts';
const CREATE_ROUTE = 'src/app/api/operations/routines/route.ts';
const PATCH_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const LINE_ROUTE = 'src/app/api/operations/routines/steps/[stepId]/route.ts';
const BUILDER = 'src/components/workbench/operations/routines/RRULEBuilder.tsx';
const CREATE_FORM = 'src/components/workbench/operations/routines/RoutineCreateForm.tsx';
// WORK-01 (Alex, 2026-10-24): RoutineRow left — its edit form is RoutineEditForm (lifted, moved code); ROW names it.
const ROW = 'src/components/workbench/operations/routines/RoutineEditForm.tsx';
const LINES = 'src/components/workbench/operations/routines/RoutineStepList.tsx';
const COA_SELECT = 'src/components/workbench/operations/routines/CoaSelect.tsx';
const LEDGER = 'src/lib/operations/ledger.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATIONS = 'prisma/migrations';
const MIGRATION_DIR = '20261018120000_routine_02b_rekeyed_audit_type';
const AUDIT_ROUTE = 'src/app/api/audit-log/route.ts';

const BKK = 'Asia/Bangkok';
const DAILY_1730 = 'FREQ=DAILY;BYHOUR=17;BYMINUTE=30;BYSECOND=0';
const ANCHOR = new Date('2026-10-12T00:00:00.000Z');
const NOW = new Date('2026-10-18T12:00:00.000Z');
const at = (iso: string) => new Date(iso);
const iso = (ds: readonly Date[]) => ds.map((d) => d.toISOString());

// ── T1 · THE CLOCK ───────────────────────────────────────────────────────────

test('T1 the start time IS the clock: the compiler derives BYHOUR/BYMINUTE from it, requires it, and refuses a byhour/byminute or a custom rule that disagrees — by name', () => {
  assert.deepEqual(clockOfTime('17:30'), { hour: 17, minute: 30 });
  assert.deepEqual(clockOfTime(' 07:05 '), { hour: 7, minute: 5 });
  for (const no of ['', '24:00', '7:30', '17:60', null, undefined, 1730]) assert.equal(clockOfTime(no), null, `${JSON.stringify(no)} is no time`);
  assert.deepEqual(clockOfRule(DAILY_1730), { hour: 17, minute: 30 });
  assert.deepEqual(clockOfRule('FREQ=DAILY;BYHOUR=7'), { hour: 7, minute: 0 }, 'BYHOUR alone: minute 0, rrule’s own default');
  assert.equal(clockOfRule('FREQ=DAILY'), null);
  assert.equal(clockWords({ hour: 7, minute: 5 }), '07:05');
  assert.ok(sameClock({ hour: 7, minute: 5 }, { hour: 7, minute: 5 }) && !sameClock({ hour: 7, minute: 5 }, { hour: 7, minute: 6 }) && !sameClock(null, { hour: 7, minute: 5 }));
  assert.equal(withClock(DAILY_1730, { hour: 18, minute: 0 }), 'FREQ=DAILY;BYHOUR=18;BYMINUTE=0;BYSECOND=0', 'the clock parts replaced, the rest untouched');
  assert.equal(withClock('FREQ=WEEKLY;BYDAY=MO', { hour: 9, minute: 15 }), 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=15', 'appended when the rule names none');
  // The compiler: the clock from the start time, for every mode.
  const daily = { ...DEFAULT_ROUTINE_FORM, cadence_mode: 'daily' as const, start_time: '17:30', end_time: '18:30', byhour: '17', byminute: '30' };
  assert.equal(compileFormToRRule(daily), DAILY_1730);
  assert.equal(compileFormToRRule({ ...daily, byhour: '', byminute: '' }), DAILY_1730, 'byhour/byminute not sent: derived');
  assert.equal(compileFormToRRule({ ...daily, cadence_mode: 'weekly', weekly_byday: ['MO', 'WE'] }), 'FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=17;BYMINUTE=30;BYSECOND=0');
  assert.equal(compileFormToRRule({ ...daily, cadence_mode: 'once', start_date: '2026-10-14' }), 'FREQ=DAILY;COUNT=1;BYHOUR=17;BYMINUTE=30;BYSECOND=0', 'a one-off’s clock is its start time too');
  assert.throws(() => compileFormToRRule({ ...daily, start_time: '' }), (e: unknown) => e instanceof ValidationError && e.message === START_TIME_REQUIRED_WORDS, 'required');
  assert.throws(() => compileFormToRRule({ ...daily, byhour: '08', byminute: '00' }), (e: unknown) => e instanceof ValidationError && e.message === clockDisagreeWords('byhour/byminute', '08:00', '17:30'), 'a second writer that disagrees — refused by name');
  assert.equal(clockDisagreeWords('byhour/byminute', '08:00', '17:30'), "byhour/byminute 08:00 disagree with the start time 17:30 — the start time is the routine's time; send one or make them agree");
  // ONEOFF-01's order kept: a one-off without its date is refused by its date before its time.
  assert.throws(() => compileFormToRRule({ ...daily, cadence_mode: 'once', start_date: '', start_time: '' }), /needs its date/);
  // Custom: appended when the rule names no clock; kept when it agrees; refused when it disagrees.
  const custom = { ...daily, cadence_mode: 'custom' as const, start_time: '09:15', byhour: '', byminute: '' };
  assert.equal(compileFormToRRule({ ...custom, custom_rrule: 'FREQ=WEEKLY;BYDAY=MO' }), 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=15');
  assert.equal(compileFormToRRule({ ...custom, custom_rrule: 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=15' }), 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=15');
  assert.throws(() => compileFormToRRule({ ...custom, custom_rrule: 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=10;BYMINUTE=0' }), (e: unknown) => e instanceof ValidationError && e.message === clockDisagreeWords("the raw rule's BYHOUR/BYMINUTE", '10:00', '09:15'));
  // The ledger's "+ expense" (outside this PR) sends an agreeing pair with its start time — accepted as before.
  assert.match(code(LEDGER), /byhour: v\.time\.slice\(0, 2\), byminute: v\.time\.slice\(3, 5\), timezone: v\.zone,/);
  assert.match(code(LEDGER), /start_time: v\.time, end_time: '', is_active: true,/, 'a one-off with no end time — its window is its day');
  assert.equal(END_TIME_REQUIRED_WORDS, 'end time is required when a start time is set — the window');
  assert.match(code(HELPERS), /if \(form\.cadence_mode === 'once'\) \{\n\s*requireOnceDate\(form\);\n\s*\}\n\s*const clock = requireClock\(form\);/, 'the date, then the clock');
  assert.match(comments(HELPERS), /ROUTINE-02b \(Alex, 2026-10-18\) — ONE TIME PER ROUTINE/);
});

// ── T2 · THE REKEY RULE ──────────────────────────────────────────────────────

test('T2 history follows the time: day by day, old instant → the new rule’s occurrence on the SAME local day; a zone change the same; a row off the old clock stays; a day with no occurrence refuses by name', () => {
  const before: RekeySchedule = { timezone: BKK, schedule_rrule: DAILY_1730, start_date: ANCHOR, end_date: null };
  const after: RekeySchedule = { ...before, schedule_rrule: withClock(DAILY_1730, { hour: 18, minute: 0 }) };
  const onClock = ['2026-10-14T10:30:00.000Z', '2026-10-15T10:30:00.000Z', '2026-10-16T10:30:00.000Z'].map(at);
  const stray = at('2026-10-14T12:00:00.000Z');
  const plan = rekeyPlan(before, after, [...onClock, stray, onClock[0]], NOW);
  assert.ok(plan.ok);
  assert.deepEqual(plan.moves.map((m) => [m.day, m.from.toISOString(), m.to.toISOString()]), [
    ['2026-10-14', '2026-10-14T10:30:00.000Z', '2026-10-14T11:00:00.000Z'],
    ['2026-10-15', '2026-10-15T10:30:00.000Z', '2026-10-15T11:00:00.000Z'],
    ['2026-10-16', '2026-10-16T10:30:00.000Z', '2026-10-16T11:00:00.000Z'],
  ], '17:30 → 18:00 Bangkok on each day; a duplicate instant is one move');
  assert.deepEqual(iso(plan.notOnOldClock), ['2026-10-14T12:00:00.000Z'], 'the stray stays');
  // The zone: 18:00 Bangkok (11:00Z) → 18:00 Makassar (10:00Z) on the same days.
  const bkk18: RekeySchedule = after;
  const mks18: RekeySchedule = { ...after, timezone: 'Asia/Makassar' };
  const zoned = rekeyPlan(bkk18, mks18, ['2026-10-14T11:00:00.000Z', '2026-10-15T11:00:00.000Z'].map(at), NOW);
  assert.ok(zoned.ok);
  assert.deepEqual(zoned.moves.map((m) => [m.day, m.to.toISOString()]), [['2026-10-14', '2026-10-14T10:00:00.000Z'], ['2026-10-15', '2026-10-15T10:00:00.000Z']]);
  // A zone that only changed its spelling, or a day the clock change does not touch: no move.
  const spelled = rekeyPlan(bkk18, { ...bkk18, timezone: 'asia/bangkok' }, ['2026-10-14T11:00:00.000Z'].map(at), NOW);
  assert.ok(spelled.ok && spelled.moves.length === 0 && spelled.notOnOldClock.length === 0);
  // Before the start date: not on the old clock, left.
  const early = rekeyPlan(before, after, [at('2026-10-10T10:30:00.000Z')], NOW);
  assert.ok(early.ok && early.moves.length === 0 && iso(early.notOnOldClock)[0] === '2026-10-10T10:30:00.000Z');
  // A day the new rule has no occurrence on (BYDAY changed): refused by name — nothing is planned.
  const weekly: RekeySchedule = { ...before, schedule_rrule: 'FREQ=WEEKLY;BYDAY=TU,WE,TH;BYHOUR=17;BYMINUTE=30;BYSECOND=0' };
  const noWed: RekeySchedule = { ...weekly, schedule_rrule: 'FREQ=WEEKLY;BYDAY=TU,TH;BYHOUR=18;BYMINUTE=0;BYSECOND=0' };
  const refused = rekeyPlan(weekly, noWed, ['2026-10-14T10:30:00.000Z', '2026-10-15T10:30:00.000Z'].map(at), NOW);
  assert.deepEqual(refused, { ok: false, status: 400, message: noOccurrenceWords('2026-10-14', 1) });
  assert.equal(noOccurrenceWords('2026-10-14', 2), "cannot move the routine's history: the new rule has no occurrence on 2026-10-14, where 2 rows sit — keep that day in the rule, or clear those rows first");
  // An old zone Intl cannot read: refused by name.
  const unread = rekeyPlan({ ...before, timezone: 'Not/AZone' }, after, onClock, NOW);
  assert.equal(unread.ok, false);
  assert.match((unread as { message: string }).message, /^cannot move the routine's history: its zone "Not\/AZone" is not one Intl reads/);
  assert.equal(oldZoneUnreadWords('X/Y', 'why'), "cannot move the routine's history: its zone \"X/Y\" is not one Intl reads (why) — pick a listed zone first");
  // The words.
  assert.equal(occupiedWords('stop_records', at('2026-10-14T11:00:00.000Z'), BKK), "cannot move the routine's history: a stop record already sits at 2026-10-14 18:00 Asia/Bangkok — clear one of the two first");
  assert.equal(rekeyedWords('Yoga', '17:30', '18:00', BKK, BKK, { days: 3, completions: 3, stop_records: 3, plan_vendors: 1, plan_links: 0, not_on_old_clock: 1 }), 'Moved the history of routine "Yoga" with its time: 17:30 Asia/Bangkok → 18:00 Asia/Bangkok — 3 stop records, 3 completions, 1 plan vendors, 0 plan links on 3 days; 1 not on the old clock, left');
  const refusal = new RekeyRefused(409, 'x');
  assert.ok(refusal instanceof Error && refusal.status === 409 && refusal.name === 'RekeyRefused');
  assert.doesNotMatch(code(REKEY), /prisma|fetch\(|new Date\(\)/, 'pure');
  assert.match(comments(REKEY), /ROUTINE-02b, Alex, 2026-10-18/);
});

// ── T3 · THE ROUTES ──────────────────────────────────────────────────────────

test('T3 the routes: start time required, end time with it (a one-off excepted); a start-time edit rewrites the rule; the move in ONE transaction, proven empty before any write, 400/409 by name, audited once plus RETRO-01’s precedent per record; the answer counts', () => {
  const post = code(CREATE_ROUTE);
  // ALLDAY-01 (2026-10-19): required of every role but all day, which has no time (allday01 T3).
  assert.match(post, /if \(!allDay\.allDay && startTimeResult\.value === null\) \{\n\s*return NextResponse\.json\(\{ error: 'Validation', field: 'start_time', message: START_TIME_REQUIRED_WORDS \}, \{ status: 400 \}\);/);
  assert.match(post, /if \(!once && !allDay\.allDay && endTimeResult\.value === null\) \{\n\s*return NextResponse\.json\(\{ error: 'Validation', field: 'end_time', message: END_TIME_REQUIRED_WORDS \}, \{ status: 400 \}\);/);
  const patch = code(PATCH_ROUTE);
  const handler = patch.slice(patch.indexOf('export async function PATCH('), patch.indexOf('export async function DELETE('));
  assert.match(handler, /if \(r\.value === null\) return NextResponse\.json\(\{ error: 'Validation', field: 'start_time', message: START_TIME_REQUIRED_WORDS \}, \{ status: 400 \}\);/, 'a blank start time is refused');
  assert.ok(handler.indexOf("if ('start_time' in body)") < handler.indexOf('const cadenceFieldsPresent'), 'the times are read before the cadence compile');
  assert.match(handler, /compileFormToRRule\(\{ \.\.\.body, start_date: effectiveStartStr, start_time: effectiveStartTimeStr \} as RoutineForm\)/, 'the compile sees the effective start time');
  assert.match(handler, /\} else if \(effectiveClock !== null && !sameClock\(clockOfRule\(existing\.schedule_rrule\), effectiveClock\)\) \{\n\s*data\.schedule_rrule = withClock\(existing\.schedule_rrule, effectiveClock\);\n\s*scheduleChanged = true;\n\s*\}/, 'a start-time edit with no cadence field rewrites the rule’s clock');
  assert.match(handler, /if \(\('start_time' in body \|\| 'end_time' in body\) && effectiveStartTime !== null && effectiveEndTime === null && !isOnceRRule\(nextRrule\)\) \{\n\s*return NextResponse\.json\(\{ error: 'Validation', field: 'end_time', message: END_TIME_REQUIRED_WORDS \}, \{ status: 400 \}\);/);
  // The move: gated on the clock or the zone; the transaction in order; proven empty; the routine's row in it.
  assert.match(handler, /const clockMoved = !sameClock\(clockOfRule\(existing\.schedule_rrule\), clockOfRule\(nextRrule\)\) && clockOfRule\(nextRrule\) !== null;/);
  assert.match(handler, /const zoneMoved = canonicalZone\(existing\.timezone\) !== canonicalZone\(nextTz\);/);
  const steps = [
    'if (clockMoved || zoneMoved) {',
    'await prisma.$transaction(async (tx) => {',
    'await lockRoutine(tx, id, user.id);',
    'tx.operations_routine_steps.findMany({ where: { routine_id: id, user_id: user.id }, select: { id: true } })',
    'tx.operations_routine_completions.findMany({ where: { routine_id: id, user_id: user.id }',
    'tx.operations_stop_records.findMany({ where: { user_id: user.id, OR: planOr } })',
    'tx.planned_item_vendors.findMany({ where: { user_id: user.id, occurrence_at: { not: null }, OR: planOr }',
    'tx.planned_item_links.findMany({ where: { user_id: user.id, target_instant: { not: null }, OR: linkOr }',
    'const plan = rekeyPlan(before, after, instants, now);',
    'if (!plan.ok) throw new RekeyRefused(plan.status, plan.message);',
    "throw new RekeyRefused(409, occupiedWords('completions', to, nextTz))",
    "throw new RekeyRefused(409, occupiedWords('stop_records', to, nextTz))",
    "throw new RekeyRefused(409, occupiedWords('plan_vendors', to, nextTz))",
    'counts.completions = await moveCompletions(tx, { userId: user.id, routineId: id, to: toOf });',
    'tx.operations_stop_records.update({ where: { id: r.id }, data: { occurrence_at: to } })',
    'tx.planned_item_vendors.update({ where: { id: v.id }, data: { occurrence_at: to } })',
    'tx.planned_item_links.update({ where: { id: l.id }, data: { target_instant: to } })',
    'const row = await tx.operations_routines.update({ where: { id }, data });',
    '}, { timeout: 60000 });',
    'if (error instanceof RekeyRefused) {',
    "error.status === 409 ? 'Conflict' : 'Validation'",
    "error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'",
    "type: 'operations_routine_rekeyed'",
    'rekeyedWords(existing.name,',
    "type: 'operations_stop_moved', description: movedWords(m.before, m.before.occurrence_at, m.after.occurrence_at)",
    "moved_with: 'operations_routine_rekeyed'",
    'return NextResponse.json({ routine, rekeyed });',
  ];
  let pos = 0;
  for (const s of steps) { const i = handler.indexOf(s, pos); assert.ok(i > pos, `in order: ${s.slice(0, 70)}`); pos = i; }
  assert.ok(handler.indexOf("occupiedWords('completions'") < handler.indexOf('counts.completions = await moveCompletions('), 'every target proven empty before any write');
  assert.doesNotMatch(handler, /operations_routine_completions\.update\(/, 'the completions move through their one writer');
  assert.match(code(COMPLETION), /export async function moveCompletions\(tx: Tx, input: \{ readonly userId: string; readonly routineId: string; readonly to: ReadonlyMap<number, Date> \}\): Promise<number> \{/);
  assert.match(comments(PATCH_ROUTE), /ROUTINE-02b \(Alex, 2026-10-18\): ONE TIME; HISTORY FOLLOWS IT/);
  assert.match(comments(CREATE_ROUTE), /ROUTINE-02b \(Alex, 2026-10-18\): ONE TIME/);
});

// ── T4 · THE BUILDER AND THE FORMS ───────────────────────────────────────────

test('T4 the builder: start time (required) and end time in place of the hour and minute boxes, "count as missed after N minutes"; the start time fills byhour/byminute and a custom rule’s clock; the forms have no time input of their own; the row seeds from the rule’s clock', () => {
  const b = code(BUILDER);
  assert.doesNotMatch(b, /hour \(00–23\)|minute \(00–59\)|value=\{form\.byhour\}|value=\{form\.byminute\}|fail threshold \(min\)/, 'the boxes and the old label are gone');
  assert.match(b, /<input\n\s*type="time"\n\s*value=\{form\.start_time\}\n\s*onChange=\{\(e\) => setForm\(withStartTime\(form, e\.target\.value\)\)\}\n\s*className=\{inputClass\}\n\s*required\n\s*data-routine-start-time\n\s*\/>/);
  assert.match(b, /<input\n\s*type="time"\n\s*value=\{form\.end_time\}\n\s*onChange=\{\(e\) => setForm\(\{ \.\.\.form, end_time: e\.target\.value \}\)\}\n\s*className=\{inputClass\}\n\s*required\n\s*data-routine-end-time\n\s*\/>/);
  // FORM-01 (2026-10-19): the field moved from the builder into the forms' "more" block — the same field, its words (the builder is days and time).
  assert.match(code(ROW), /<div className=\{labelClass\}>\{MISSED_AFTER_WORDS\}<\/div>\n\s*<input\n\s*type="number"\n\s*min=\{0\}\n\s*value=\{form\.fail_threshold_minutes\}/, 'the same field, its words');
  assert.match(code(CREATE_FORM), /<div className=\{labelClass\}>\{MISSED_AFTER_WORDS\}<\/div>\n\s*<input\n\s*type="number"\n\s*min=\{0\}\n\s*value=\{createForm\.fail_threshold_minutes\}/, 'the same field, its words');
  assert.equal(MISSED_AFTER_WORDS, 'count as missed after N minutes');
  // FORM-01 (2026-10-19): a one-off's date is asked in the days control itself (DaysField, data-routine-once-date) — the note went with the old cadence select.
  assert.match(b, /data-routine-once-date/);
  // withStartTime: the clock fills byhour/byminute and rewrites a custom rule's clock; a partial value only moves the field.
  const form = { ...DEFAULT_ROUTINE_FORM, cadence_mode: 'custom' as const, custom_rrule: 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=8;BYMINUTE=0' };
  const typed = withStartTime(form, '17:30');
  assert.deepEqual([typed.start_time, typed.byhour, typed.byminute, typed.custom_rrule], ['17:30', '17', '30', 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=17;BYMINUTE=30']);
  const daily = withStartTime({ ...DEFAULT_ROUTINE_FORM, cadence_mode: 'daily' }, '09:05');
  assert.deepEqual([daily.start_time, daily.byhour, daily.byminute, daily.custom_rrule], ['09:05', '09', '05', '']);
  const partial = withStartTime(form, '');
  assert.deepEqual([partial.start_time, partial.byhour, partial.custom_rrule], ['', DEFAULT_ROUTINE_FORM.byhour, form.custom_rrule]);
  // The forms: no time input but the builder's.
  assert.doesNotMatch(code(CREATE_FORM), /type="time"|byhour: v\.slice/);
  const row = code(ROW);
  assert.doesNotMatch(row, /type="time"|byhour: v\.slice/);
  assert.match(row, /const clock = clockOfRule\(r\.schedule_rrule\);/);
  assert.match(row, /start_time: clock !== null \? clockWords\(clock\) : r\.start_time \? r\.start_time\.slice\(11, 16\) : '',/, 'the clock in force seeds the start time');
  assert.match(row, /\.\.\.\(clock !== null \? \{ byhour: String\(clock\.hour\)\.padStart\(2, '0'\), byminute: String\(clock\.minute\)\.padStart\(2, '0'\) \} : \{\}\),/, 'byhour/byminute agree with it');
  assert.match(comments(BUILDER), /ROUTINE-02b \(Alex, 2026-10-18\): ONE TIME/);
  assert.match(comments(CREATE_FORM), /ROUTINE-02b \(Alex, 2026-10-18\)/);
});

// ── T5 · THE COA AND THE BOOK ────────────────────────────────────────────────

test('T5 the COA: the routine-level select is disabled, and says why, when a line carries the money; otherwise it works and the pair rule is said before the save; a line’s own COA is editable in its row; the book is not changeable, and says so', () => {
  const row = code(ROW);
  assert.match(row, /<CoaSelect\n\s*entityId=\{form\.entity_id\}\n\s*value=\{form\.coa_code \?\? ''\}\n\s*onChange=\{\(code\) => setForm\(\{ \.\.\.form, coa_code: code \}\)\}\n\s*className=\{inputClass\}\n\s*disabled=\{planned\.from === 'lines'\}\n\s*data-routine-coa\n\s*\/>/);
  assert.match(row, /\{planned\.from === 'lines'\n\s*\? <div className="text-text-faint text-\[10px\] mt-1" data-routine-coa-lines>\{COA_ON_LINES_WORDS\}<\/div>\n\s*: \(form\.coa_code \?\? ''\) !== '' && \(form\.budget_amount \?\? ''\)\.trim\(\) === '' && <div className="text-amber-800 text-\[10px\] mt-1" data-routine-coa-needs-amount>\{COA_NEEDS_AMOUNT_WORDS\}<\/div>\}/);
  assert.equal(COA_ON_LINES_WORDS, 'the lines carry the money — set the account on each line');
  assert.equal(COA_NEEDS_AMOUNT_WORDS, 'an account needs its amount — enter the amount, or clear the account');
  assert.match(code('src/lib/operations/planMoney.ts'), /'an account needs its amount — enter the amount, or clear the account'/, 'the route’s own words');
  assert.match(code(COA_SELECT), /disabled\?: boolean;/);
  assert.match(code(COA_SELECT), /<select value=\{value\} onChange=\{\(e\) => onChange\(e\.target\.value\)\} className=\{className\} disabled=\{disabled\} \{\.\.\.rest\}>/);
  // The book: disabled stays; the sentence beside it.
  assert.match(row, /disabled\n\s*title=\{BOOK_FIXED_WORDS\}\n\s*data-routine-book-select\n\s*>/);
  assert.match(row, /<div className="text-text-faint text-\[10px\] mt-1" data-routine-book-fixed>\{BOOK_FIXED_WORDS\}<\/div>/);
  assert.equal(BOOK_FIXED_WORDS, 'to move a routine to another book, end it and create it there');
  assert.doesNotMatch(code(PATCH_ROUTE), /body\.entity_id|data\.entity_id/, 'the PATCH takes no entity');
  // A line's own COA: the line's row edits it (RoutineStepList inputCells) through the lines route, the same pair rule.
  assert.match(code(LINES), /<CoaSelect\n\s*entityId=\{routine\.entity_id\}\n\s*value=\{form\.coa_code\}\n\s*onChange=\{\(code\) => setForm\(\{ \.\.\.form, coa_code: code \}\)\}\n\s*className=\{inputClass\}\n\s*\/>/, 'the line’s select, enabled');
  assert.match(code(LINE_ROUTE), /const sent = editedPlanMoney\(body\.budget_amount, body\.coa_code, \{ amount: existing\.budget_amount, account: existing\.coa_code \}\);/);
  assert.match(comments(ROW), /ROUTINE-02b \(Alex, 2026-10-18\)/);
});

// ── T6 · THE AUDIT TYPE ──────────────────────────────────────────────────────

test('T6 the audit type: the enum value last, the one ADD VALUE line applied at deploy (the RETRO-01 precedent), the client knows it, the audit log lists it', () => {
  const schema = code(SCHEMA);
  const auditEnum = /enum AuditActionType \{([\s\S]*?)\}/.exec(schema);
  assert.ok(auditEnum !== null);
  const values = auditEnum[1].split(/\s+/).filter(Boolean);
  // MOVE-01 (2026-10-19): one more value follows (operations_routines_moved) — the tail moved by one.
  // LEDGER-03 (Alex, 2026-10-19): planned_item_linked and planned_item_unlinked were appended after MOVE-01's value — every position below moved by two.
  assert.equal(values[values.length - 4], 'operations_routine_rekeyed');
  assert.equal(values.filter((v) => v === 'operations_routine_rekeyed').length, 1);
  assert.equal(AuditActionType.operations_routine_rekeyed, 'operations_routine_rekeyed', 'prisma generate ran');
  const dirs = readdirSync(resolve(process.cwd(), MIGRATIONS)).filter((d) => /^\d{14}_/.test(d)).sort();
  // MOVE-01 (2026-10-19): one more audit-type migration followed (the newest); the order below moved by one.
  // DOCUMENTS-02 (Alex, 2026-10-30): the reconciliation's supersession — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 11], MIGRATION_DIR, 'the migration before the newest (MOVE-01 followed)');
  // JOURNAL-04 (2026-10-19): the evening answers' migration followed (the newest); the order below moved by one.
  assert.equal(dirs[dirs.length - 10], '20261019090000_move_01_moved_audit_type', 'the migration before the newest (JOURNAL-04 followed)');
  assert.equal(dirs[dirs.length - 9], '20261019210000_journal_04_evening_answers', 'the migration before the newest (LEDGER-03 followed)');
  // LEDGER-03 (Alex, 2026-10-19): two audit values for the planned-item link — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 8], '20261019230000_ledger_03_planned_item_link_audit', 'the migration before the newest (BACKLOG-01 followed)');
  // BACKLOG-01 (Alex, 2026-10-20): the capture's columns and the four statuses — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 7], '20261020120000_backlog_01_capture', 'the migration before the newest (BACKLOG-01b followed)');
  // BACKLOG-01b (Alex, 2026-10-20): the brief's three columns — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 6], '20261020140000_backlog_01b_brief', 'the migration before the newest (JOURNAL-06 followed)');
  // JOURNAL-06 (Alex, 2026-10-20): the evening's five columns, the two CHECKs re-made — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 5], '20261020150000_journal_06_reflection', 'the migration before the newest (BACKLOG-02 followed)');
  // BACKLOG-02 (Alex, 2026-10-20): the reorder route's one audit value — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 4], '20261020160000_backlog_02_reranked', 'the migration before the newest (DOCUMENTS-01 followed)');
  // DOCUMENTS-01 (Alex, 2026-10-28): source_documents, the receipt on its posting — the newest; every position above moved by one.
  assert.equal(dirs[dirs.length - 3], '20261028120000_documents_01_source_documents', 'the migration before the newest (DOCUMENTS-02 followed)');
  assert.equal(dirs[dirs.length - 2], '20261030120000_documents_02_reconciliation_supersession', 'the migration before the newest (FX-01 followed)');
  // FX-01 (2026-10-30): the transactions currency migration followed — every pin above moved by one.
  assert.equal(dirs[dirs.length - 1], '20261030150000_fx_01_transactions_currency', 'the newest migration');
  assert.equal(dirs[dirs.length - 12], '20261016120000_retro_01_stop_moved_audit_type');
  const sql = code(`${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`);
  assert.equal(sql.trim(), `ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_rekeyed';`, 'one line and nothing else');
  assert.match(comments(`${MIGRATIONS}/${MIGRATION_DIR}/migration.sql`), /applied at deploy/);
  // MOVE-01 (2026-10-19): the moved type follows the rekeyed type in the list.
  assert.match(code(AUDIT_ROUTE), /'operations_stop_moved',\s*'operations_routine_rekeyed',\s*'operations_routines_moved',\s*\],/);
  assert.match(comments(SCHEMA), /ROUTINE-02b \(Alex, 2026-10-18\): a routine's history moved with its time/);
});
