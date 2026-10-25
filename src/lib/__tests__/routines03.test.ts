/**
 * ROUTINES-03 (Alex, 2026-10-25) — ROUTINE EXPENSES CARRIES ITS COLUMNS, IN ALEX'S ORDER.
 *
 * Ruling A: START · END · KIND · BOOK · ACCOUNT · ACCOUNT NAME · SUB ACCOUNT NAME ·
 * VENDOR · ROUTINE · TIME · DAYS · CADENCE · NEXT · BUDGET · THIS MONTH · TO DATE ·
 * ACTUAL · MATCH · VARIANCE · STATUS · ID — the head words the task ledger's
 * wherever the fact is the same. Ruling B: the cells. Ruling C: ONE new read
 * route, GET /api/operations/routines/month?as_of=, a thin route over the pure
 * rule src/lib/operations/routineMonth.ts, which REUSES the /budget rule, the
 * ledger's placing and match, links.ts variance and the plan-vendor grain rule.
 * Ruling D: a failed read is said, never a partial table. Ruling E: the pins.
 *
 * The rule is driven over fixtures; the screens, the route and the law are
 * pinned to their source with comments stripped (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import {
  AS_OF_WORDS, BY_OCCURRENCE_WORDS, ROUTINE_MONTH_CALCULATED, monthLineKey, monthRangeOf, routineMonthOf, type RoutineMonthInput,
} from '../operations/routineMonth';
import {
  KIND_WORDS, ROUTINE_COLUMNS, ROUTINE_HEAD_WORDS, ROUTINE_TOOLTIPS, accountCellsOf, dayWords, routineIdOf, routineKindOf, routineNextOf, routineRowsOf,
  routineSubAccountOf, routineTable, withoutMonthWords, type RoutineMonthMap, type WorkBook, type WorkCharts,
} from '../operations/work';
import { LEDGER_HEAD_WORDS } from '../operations/ledger';
import { planLinesOn, planHoldsOf, type PlanVendorRow } from '../budget/planLines';
import type { RoutinePlanInput } from '../budget/days';
import type { StopRecordRow } from '../operations/stopRecord';
import type { LedgerLinkInput } from '../operations/ledger';
import { tableCsv } from '../table/csv';
import { BLANK } from '../table/words';
import type { Routine, RoutineStep } from '@/components/workbench/operations/routines/types';

const OPS = 'src/components/workbench/operations';
const SECTION_F = `${OPS}/SectionF_RoutineExpenses.tsx`;
const WORK_LIB = 'src/lib/operations/work.ts';
const RULE = 'src/lib/operations/routineMonth.ts';
const ROUTE = 'src/app/api/operations/routines/month/route.ts';
const LEDGER_ROUTE = 'src/app/api/operations/ledger/route.ts';
const PLAN_LINES = 'src/lib/budget/planLines.ts';
const LOADER = 'src/lib/operations/routineBudgetInputs.ts';
const MIDDLEWARE = 'src/middleware.ts';
const TABLE = 'src/components/table/DataTable.tsx';
const COLUMNS = 'src/lib/table/columns.ts';

// ── THE RULE'S FIXTURES (DO 1) ───────────────────────────────────────────────

const BKK = 'Asia/Bangkok';
const plan = (o: Partial<RoutinePlanInput> & { id: string; name: string }): RoutinePlanInput => ({
  entityId: 'p', entityType: 'personal', timezone: BKK, scheduleRrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', startDate: null, endDate: null,
  budgetAmount: null, coaCode: null, steps: [], ...o,
});
/** A daily $10 line (October 2026 has 31 days). */
const DAILY = plan({ id: 'daily', name: 'Daily', steps: [{ id: 's1', stepOrder: 1, budgetAmount: '10', coaCode: '6150' }] });
/** A stepless routine with no record — ACTUAL and VARIANCE stay null. */
const QUIET = plan({ id: 'quiet', name: 'Quiet', budgetAmount: '3', coaCode: '6150' });
/** A once routine on the 20th (ONEOFF-01: FREQ=DAILY;COUNT=1 on its start date). */
const ONCE = plan({ id: 'once', name: 'Once', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0', startDate: '2026-10-20', endDate: '2026-10-20', budgetAmount: '40', coaCode: '6150' });
/** Ended on the 5th (ROUTINE-02a) — still computes: five $5 days. */
const ENDED = plan({ id: 'ended', name: 'Ended', endDate: '2026-10-05', budgetAmount: '5', coaCode: '6150' });
/** A plan found holding both grains. */
const BOTH = plan({ id: 'both', name: 'Both', budgetAmount: '1', coaCode: '6150' });
const record = (o: Partial<StopRecordRow> & { id: string; kind: 'routine' | 'routine_line'; target_id: string; occurrence_at: string }): StopRecordRow => ({
  outcome: 'done', done_at: o.occurrence_at, actual_cents: null, rating: null, note: null, actual_minutes: null, ...o,
});
const link = (o: Partial<LedgerLinkInput> & { journalEntryId: string; instant: string; amountCents: number | null }): LedgerLinkInput => ({ kind: 'routine_line', targetId: 's1', ...o });
const vendor = (o: Partial<PlanVendorRow> & { id: string }): PlanVendorRow => ({
  routine_id: null, step_id: null, task_id: null, occurrence_at: null, vendor: { id: 'v1', vendor_name: 'Luka Café', entity_id: 'p' }, routine: null, step: null, task: null, ...o,
});
// 07:00 Bangkok on the 2nd, 3rd, 4th and 20th — the daily line's occurrence instants (the rule places each in the routine's zone).
const at = (day: string) => `${day}T00:00:00.000Z`;
const EVERY = vendor({ id: 'pv-every', step_id: 's1', step: { activity: 'Coffee', routine_id: 'daily', routine: { name: 'Daily', timezone: BKK } } });
const ONCE_OCC = vendor({ id: 'pv-once', routine_id: 'once', occurrence_at: new Date('2026-10-20T07:00:00.000Z'), vendor: { id: 'v2', vendor_name: 'Dentist Co', entity_id: 'p' }, routine: { name: 'Once', timezone: BKK } });
const BOTH_EVERY = vendor({ id: 'pv-b1', routine_id: 'both', routine: { name: 'Both', timezone: BKK } });
const BOTH_OCC = vendor({ id: 'pv-b2', routine_id: 'both', occurrence_at: new Date(at('2026-10-03')), vendor: { id: 'v3', vendor_name: 'Other Co', entity_id: 'p' }, routine: { name: 'Both', timezone: BKK } });
const INPUT: RoutineMonthInput = {
  asOf: '2026-10-10',
  routines: [DAILY, QUIET, ONCE, ENDED, BOTH],
  records: [
    record({ id: 'r1', kind: 'routine_line', target_id: 's1', occurrence_at: at('2026-10-02'), actual_cents: 900 }),
    record({ id: 'r2', kind: 'routine_line', target_id: 's1', occurrence_at: at('2026-10-03'), actual_cents: 1100 }),
    record({ id: 'r3', kind: 'routine_line', target_id: 's1', occurrence_at: at('2026-10-04'), actual_cents: null }),
    // The 20th is after as_of — outside the to-date window, never counted.
    record({ id: 'r4', kind: 'routine_line', target_id: 's1', occurrence_at: at('2026-10-20'), actual_cents: 5000 }),
  ],
  links: [link({ journalEntryId: 'je1', instant: at('2026-10-02'), amountCents: 950 }), link({ journalEntryId: 'je2', instant: at('2026-10-03'), amountCents: 1050 })],
  vendors: [EVERY, ONCE_OCC, BOTH_EVERY, BOTH_OCC],
};
const RESULT = routineMonthOf(INPUT);
const lineOf = (routineId: string, stepId: string | null) => {
  assert.ok(RESULT.ok, 'the rule read');
  const l = RESULT.lines.find((x) => x.routine_id === routineId && x.step_id === stepId);
  assert.ok(l !== undefined, `${routineId}/${stepId} has a line`);
  return l;
};

test('R1 the month: as_of\'s calendar month — the 1st (the model\'s own day-view start) to the last day; a bad as_of refused by name', () => {
  assert.deepEqual(monthRangeOf('2026-10-10'), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(monthRangeOf('2026-02-14'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(monthRangeOf('2028-02-01'), { from: '2028-02-01', to: '2028-02-29' });
  assert.throws(() => monthRangeOf('2026-02-30'), /is not a 'YYYY-MM-DD' day/);
  assert.equal(AS_OF_WORDS, 'as_of must be a real day written YYYY-MM-DD');
  assert.equal(monthLineKey('r', null), 'routine:r');
  assert.equal(monthLineKey('r', 's'), 'routine:r:s');
  assert.ok(RESULT.ok);
  assert.deepEqual([RESULT.as_of, RESULT.from, RESULT.to], ['2026-10-10', '2026-10-01', '2026-10-31']);
});

test('R2 a daily $10 line in a 31-day month, as_of the 10th → THIS MONTH 31000, TO DATE 10000; records 900 / 1100 / null → ACTUAL 2000 of 3 records; two links → MATCH their sum; VARIANCE = TO DATE − ACTUAL', () => {
  const daily = lineOf('daily', 's1');
  assert.equal(daily.budget_month_cents, 31000);
  assert.equal(daily.budget_to_date_cents, 10000);
  assert.equal(daily.actual_cents, 2000);
  assert.equal(daily.actual_records, 3, 'the record with no amount is a record; the one on the 20th is outside the window');
  assert.equal(daily.match_cents, 2000);
  assert.equal(daily.match_links, 2);
  assert.equal(daily.match_unreadable, 0);
  assert.equal(daily.variance_cents, 8000);
  assert.equal(daily.vendor_words, 'Luka Café', 'an every-occurrence vendor: its name');
});

test('R2 no record → ACTUAL null and VARIANCE null, never 0; a once routine → its one occurrence in its month, blank in another; an ended routine still computes', () => {
  const quiet = lineOf('quiet', null);
  assert.deepEqual([quiet.budget_month_cents, quiet.budget_to_date_cents, quiet.actual_cents, quiet.actual_records, quiet.match_cents, quiet.match_links, quiet.variance_cents], [9300, 3000, null, 0, null, 0, null]);
  const once = lineOf('once', null);
  assert.equal(once.budget_month_cents, 4000, 'the one occurrence, on the 20th');
  assert.equal(once.budget_to_date_cents, null, 'the 20th is after as_of — the rule yields no line to date, so blank, never 0');
  assert.equal(once.vendor_words, BY_OCCURRENCE_WORDS, 'occurrence rows only: "by occurrence"');
  const november = routineMonthOf({ ...INPUT, asOf: '2026-11-10' });
  assert.ok(november.ok);
  const onceInNovember = november.lines.find((l) => l.routine_id === 'once')!;
  assert.equal(onceInNovember.budget_month_cents, null, 'blank in another month');
  assert.equal(november.lines.find((l) => l.routine_id === 'daily')!.budget_month_cents, 30000, 'November has 30 days');
  const ended = lineOf('ended', null);
  assert.equal(ended.budget_month_cents, 2500, 'five $5 days to the end date — STATUS says ended elsewhere');
  assert.equal(ended.budget_to_date_cents, 2500);
});

test('R2 a plan found holding both grains → the planLines.ts refusal\'s words on its line, never one picked; the whole read fails only on a row the database should not hold', () => {
  const both = lineOf('both', null);
  const direct = planLinesOn({ days: ['2026-10-03'], lines: [], routines: new Map(), tasks: new Map(), vendors: [BOTH_EVERY, BOTH_OCC] });
  assert.ok(!direct.ok && direct.code === 'plan-vendor-both-grains');
  assert.equal(both.vendor_words, direct.message, 'the same words planLinesOn refuses with');
  assert.match(both.vendor_words!, /^plan routine:both holds "Luka Café" for every occurrence AND "Other Co" at 2026-10-03T00:00:00\.000Z — a plan holds one grain; this is never resolved by picking one$/);
  // The lifted rule: planHoldsOf records every refusal in row order; planLinesOn fails on the first — unchanged behaviour (budget02, budgetPlanLines).
  const read = planHoldsOf([BOTH_EVERY, BOTH_OCC]);
  assert.deepEqual(read.refusals.map((r) => [r.plan, r.code]), [['routine:both', 'plan-vendor-both-grains']]);
  assert.equal(read.holds.get('routine:both')!.every, BOTH_EVERY);
  const twoPlans = routineMonthOf({ ...INPUT, vendors: [vendor({ id: 'pv-x', routine_id: 'daily', step_id: 's1' })] });
  assert.ok(!twoPlans.ok && twoPlans.code === 'plan-vendor-unreadable');
  assert.match(twoPlans.message, /plan-vendor row pv-x names 2 plans — a row names exactly one/);
  assert.match(code(PLAN_LINES), /const read = planHoldsOf\(input\.vendors\);\n\s*if \(read\.refusals\.length > 0\) return fail\(read\.refusals\[0\]\.code, read\.refusals\[0\]\.message\);\n\s*const holds = read\.holds;/, 'planLinesOn reads the lifted rule');
  assert.equal((code(PLAN_LINES).match(/a plan holds one grain; this is never resolved by picking one/g) ?? []).length, 1, 'the words live once');
});

test('R2 what cannot be placed or read is SAID, never dropped: a record of a line the route did not read, a zone Intl cannot read, an unreadable posting', () => {
  const said = routineMonthOf({
    ...INPUT,
    routines: [DAILY, plan({ id: 'mars', name: 'Mars', timezone: 'Mars/Olympus', budgetAmount: '1', coaCode: '6150' })],
    records: [record({ id: 'r9', kind: 'routine_line', target_id: 'ghost', occurrence_at: at('2026-10-02'), actual_cents: 1 }), record({ id: 'r10', kind: 'routine', target_id: 'mars', occurrence_at: at('2026-10-02'), actual_cents: 1 })],
    links: [link({ journalEntryId: 'je9', instant: at('2026-10-02'), amountCents: null }), link({ journalEntryId: 'je10', instant: at('2026-10-03'), amountCents: 700 })],
    vendors: [],
  });
  assert.ok(said.ok);
  assert.ok(said.said.some((w) => /record r9 names routine_line ghost, which the route did not read/.test(w)), JSON.stringify(said.said));
  assert.ok(said.said.some((w) => /record r10: .*timezone not recognised.*"Mars\/Olympus"/.test(w)), JSON.stringify(said.said));
  assert.ok(said.said.some((w) => /\/budget could not place — routine:mars: timezone not recognised/.test(w)), 'the budget rule\'s notPlaced, in words');
  assert.ok(said.said.some((w) => /1 posting is linked but carry no readable amount — MATCH is blank on those lines/.test(w)), JSON.stringify(said.said));
  const daily = said.lines.find((l) => l.routine_id === 'daily')!;
  assert.deepEqual([daily.match_cents, daily.match_links, daily.match_unreadable], [null, 2, 1], 'LEDGER-03: any unreadable posting — no readable sum');
  assert.equal(daily.actual_cents, null, 'the ghost record is no line\'s');
});

test('R3 the rule imports buildRoutineBudgetLines, the placing, the match, variance and the grain rule rather than restating them; the route reads links through linkInputOf (amountCentsOf)', () => {
  const rule = code(RULE);
  assert.match(rule, /import \{ buildRoutineBudgetLines, isIsoDay, readOccurrenceKey, type RoutinePlanInput \} from '@\/lib\/budget\/days';/);
  assert.match(rule, /import \{ planHoldsOf, type PlanVendorRow \} from '@\/lib\/budget\/planLines';/);
  assert.match(rule, /import \{ matchOf, readableMatchCents, type LedgerLinkInput \} from '@\/lib\/operations\/ledger';/);
  assert.match(rule, /import \{ variance \} from '@\/lib\/calendar\/links';/);
  assert.match(rule, /import \{ instantToZoned \} from '@\/lib\/time';/);
  assert.match(rule, /const built = buildRoutineBudgetLines\(input\.routines, from, to\);/);
  assert.match(rule, /variance_cents: variance\(budgetToDate, actual\.cents\),/);
  assert.match(rule, /match_cents: readableMatchCents\(match\),/);
  assert.match(rule, /day = instantToZoned\(new Date\(instant\), routine\.timezone\)\.date;/);
  assert.match(rule, /const \{ rangeFrom \} = viewRange\(\{ kind: 'day', day: asOf \}\);/, 'the month\'s start is the model\'s own');
  assert.doesNotMatch(rule, /function variance|planned - actual|entry_type|expandBetween|rrulestr|new Map<string, PlanHolds>/, 'no rule restated');
  assert.doesNotMatch(rule, /\bfetch\b|@prisma\/client|from 'react'|from 'next|new Date\(\)/, 'pure — no clock, no client');
  const route = code(ROUTE);
  assert.match(route, /import \{ linkInputOf \} from '@\/lib\/operations\/ledger';/);
  assert.match(route, /links: linkRows\.map\(linkInputOf\)/);
  assert.match(route, /import \{ loadRoutineBudgetInputs \} from '@\/lib\/operations\/routineBudgetInputs';/);
  assert.match(route, /rows: await loadRoutineBudgetInputs\(prisma, user\.id, e\.id, \{ includeInactive: true \}\)/, 'ruling C: active and not — the one loader, grown by an option');
  assert.match(route, /toRoutinePlanInput\(row, bookOf\(group\.entityId\)\)/, 'the one mapper');
  assert.match(route, /records: recordRows\.map\(stopRecordRowOf\)/);
  assert.match(route, /const window = \{ gte: recordWindow\(from\)\.gte, lt: recordWindow\(to\)\.lt \};/, 'stopRecord.ts recordWindow\'s rule over the span');
  assert.match(code(LOADER), /\.\.\.\(options\.includeInactive === true \? \{\} : \{ is_active: true \}\)/, 'the default is the active ones, as every other caller reads');
  assert.doesNotMatch(route, /amountCentsOf\(|function linkInputOf|is_active: true/);
  assert.match(code(LEDGER_ROUTE), /links: linkRows\.map\(linkInputOf\),/, 'the ledger route reads links the same way');
  assert.deepEqual(Object.keys(ROUTINE_MONTH_CALCULATED), ['budget_month_cents', 'budget_to_date_cents', 'actual_cents', 'match_cents', 'variance_cents']);
  for (const words of Object.values(ROUTINE_MONTH_CALCULATED)) assert.match(words, /^calculated: /);
  assert.match(route, /calculated: ROUTINE_MONTH_CALCULATED/, 'labelled so in the response');
});

test('R4 the route: the caller first (a verified cookie or 401, the user or 404), as_of validated and refused by name, every query user-scoped, no paid call, not in PUBLIC_PATHS', () => {
  const route = code(ROUTE);
  const gate = [
    "export async function GET(request: NextRequest) { try {",
    "const userEmail = await getVerifiedEmail();",
    "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
    "const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });",
    "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    "const asOf = request.nextUrl.searchParams.get('as_of');",
    "if (!isIsoDay(asOf)) return NextResponse.json({ error: 'Validation', field: 'as_of', message: AS_OF_WORDS }, { status: 400 });",
  ].join(' ');
  assert.ok(route.replace(/\s+/g, ' ').includes(gate), 'the gate, then as_of, before any read');
  assert.ok(route.indexOf('isIsoDay(asOf)') < route.indexOf('prisma.entities.findMany'), 'as_of refused before the first read');
  for (const m of route.matchAll(/\bprisma\.(\w+)\.(\w+)\s*\(/g)) {
    if (m[1] === 'users') continue;
    const call = route.slice(m.index!, route.indexOf(']);', m.index!) + 1);
    assert.match(call, /user\.id|userId: user\.id/, `${m[1]}.${m[2]} names the caller`);
  }
  assert.match(route, /prisma\.operations_stop_records\.findMany\(\{\n\s*where: \{ user_id: user\.id, occurrence_at: window \},/);
  assert.match(route, /prisma\.planned_item_links\.findMany\(\{\n\s*where: \{ user_id: user\.id, target_kind: \{ in: \['routine', 'routine_line'\] \}, target_instant: window, journal_entry: \{ userId: user\.id \} \},/);
  assert.match(route, /prisma\.planned_item_vendors\.findMany\(\{\n\s*where: \{ user_id: user\.id, OR: \[\{ routine_id: \{ not: null \} \}, \{ step_id: \{ not: null \} \}\] \},/, 'every plan-vendor row of the caller\'s routines and lines, any instant');
  assert.match(route, /prisma\.entities\.findMany\(\{ where: \{ userId: user\.id \}/);
  assert.doesNotMatch(route, /status: 403/, 'another user\'s row is never confirmed');
  assert.doesNotMatch(route, /\bfetch\(|openai|anthropic|plaid|stripe|liteapi|viator/i, 'no paid service');
  assert.match(route, /return failClosedResponse\('Routine month GET', 'Failed to load the routines\\' month', error\);/);
  assert.equal((route.match(/export async function/g) ?? []).length, 1, 'GET alone');
  // '/routines' (the public deck's redirect page) is listed; '/api/operations/routines/month' is not, and no prefix of it is.
  const publicList = /const PUBLIC_PATHS = \[([\s\S]*?)\];/.exec(code(MIDDLEWARE))![1];
  const listed = [...publicList.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(listed.includes('/routines'), 'the deck\'s redirect page stays public');
  assert.ok(!listed.some((p) => '/api/operations/routines/month' === p || '/api/operations/routines/month'.startsWith(`${p}/`)), 'not public — the middleware sends a guest away before the route sees it');
});

// ── THE SPEC (rulings A–B) ────────────────────────────────────────────────────

const BOOKS: WorkBook[] = [{ id: 'p', name: 'Personal', entity_type: 'personal' }];
const CHARTS: WorkCharts = { p: [{ code: '8180', name: 'Streaming & Subscriptions', account_type: 'expense', entity_id: 'p' }] };
const step = (o: Partial<RoutineStep> & { id: string; activity: string; step_order: number }): RoutineStep => ({
  routine_id: 'r', user_id: 'u', entity_id: 'p', time_of_day: null, sub_activity: null, location: null, duration_minutes: null, notes: null,
  created_at: '', updated_at: '', created_by: null, ...o,
});
const routine = (o: Partial<Routine> & { id: string; name: string }): Routine => ({
  user_id: 'u', entity_id: 'p', description: null, schedule_rrule: 'FREQ=DAILY;BYHOUR=7;BYMINUTE=0;BYSECOND=0', timezone: BKK,
  next_due_at: null, last_evaluated_at: null, last_completed_at: null, consecutive_completion_streak: 0, consecutive_miss_streak: 0,
  ideal_time_label: null, fail_threshold_minutes: 30, start_date: null, end_date: null, start_time: '1970-01-01T07:00:00.000Z', end_time: '1970-01-01T07:30:00.000Z',
  is_active: true, created_at: '', updated_at: '', created_by: null, budget_amount: null, coa_code: null, role: 'place', steps: [], ...o,
});
const APPLE = routine({ id: 'apple', name: 'Apple storage', role: 'all_day', timezone: 'America/Los_Angeles', schedule_rrule: 'FREQ=MONTHLY;BYMONTHDAY=11;BYHOUR=0;BYMINUTE=0;BYSECOND=0', start_time: null, end_time: null, budget_amount: '10', coa_code: '8180', next_due_at: '2026-11-11T08:00:00.000Z', start_date: '2026-01-11T00:00:00.000Z' });
const TWO = routine({ id: 'two', name: 'Two lines', end_date: '2026-12-31T00:00:00.000Z', steps: [step({ id: 'l1', activity: 'First', step_order: 1, budget_amount: '2', coa_code: '8180' }), step({ id: 'l2', activity: 'Second', step_order: 2 })] });
const DENTIST = routine({ id: 'dentist', name: 'Dentist', schedule_rrule: 'FREQ=DAILY;COUNT=1;BYHOUR=14;BYMINUTE=0;BYSECOND=0', start_date: '2026-11-03T00:00:00.000Z', end_date: '2026-11-03T00:00:00.000Z', next_due_at: '2026-11-03T07:00:00.000Z' });
const MARS = routine({ id: 'mars', name: 'Mars', timezone: 'Mars/Olympus', next_due_at: '2026-11-03T07:00:00.000Z' });
const NOW = new Date('2026-10-25T06:00:00.000Z');
const ROWS = routineRowsOf([APPLE, TWO, DENTIST, MARS], NOW);
const MONTH: RoutineMonthMap = new Map([
  [monthLineKey('apple', null), { routine_id: 'apple', step_id: null, vendor_words: 'Apple', budget_month_cents: 1000, budget_to_date_cents: 1000, actual_cents: 1000, actual_records: 1, match_cents: 1000, match_links: 1, match_unreadable: 0, variance_cents: 0 }],
  [monthLineKey('two', 'l1'), { routine_id: 'two', step_id: 'l1', vendor_words: BY_OCCURRENCE_WORDS, budget_month_cents: 6200, budget_to_date_cents: 5000, actual_cents: 5100, actual_records: 25, match_cents: null, match_links: 0, match_unreadable: 0, variance_cents: -100 }],
  [monthLineKey('two', 'l2'), { routine_id: 'two', step_id: 'l2', vendor_words: null, budget_month_cents: null, budget_to_date_cents: null, actual_cents: null, actual_records: 0, match_cents: null, match_links: 0, match_unreadable: 0, variance_cents: null }],
]);
const COLS = routineTable(BOOKS, CHARTS, MONTH);
const cell = (id: string, key: typeof ROUTINE_COLUMNS[number]) => COLS.find((c) => c.key === key)!.words(ROWS.find((r) => r.id === id)!);
const csvOf = (id: string, key: typeof ROUTINE_COLUMNS[number]) => COLS.find((c) => c.key === key)!.csv(ROWS.find((r) => r.id === id)!);

test('A the 21 heads in Alex\'s order — the task ledger\'s words wherever the fact is the same', () => {
  assert.deepEqual([...ROUTINE_COLUMNS], ['start', 'end', 'kind', 'book', 'account', 'account_name', 'sub_account', 'vendor', 'routine', 'time', 'days', 'cadence', 'next', 'budget', 'this_month', 'to_date', 'actual', 'match', 'variance', 'status', 'id']);
  assert.deepEqual(COLS.map((c) => c.label), ['START', 'END', 'KIND', 'BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'ROUTINE', 'TIME', 'DAYS', 'CADENCE', 'NEXT', 'BUDGET', 'THIS MONTH', 'TO DATE', 'ACTUAL', 'MATCH', 'VARIANCE', 'STATUS', 'ID']);
  assert.deepEqual(COLS.map((c) => c.label), ROUTINE_COLUMNS.map((k) => ROUTINE_HEAD_WORDS[k]));
  for (const word of ['BOOK', 'ACCOUNT', 'ACCOUNT NAME', 'SUB ACCOUNT NAME', 'VENDOR', 'BUDGET', 'ACTUAL', 'VARIANCE', 'MATCH']) assert.ok((LEDGER_HEAD_WORDS as readonly string[]).includes(word), `${word} is the ledger's word`);
  assert.deepEqual(Object.fromEntries(COLS.map((c) => [c.key, c.kind])), {
    start: 'value', end: 'value', kind: 'value', book: 'value', account: 'value', account_name: 'value', sub_account: 'text', vendor: 'value', routine: 'text', time: 'value', days: 'value',
    cadence: 'value', next: 'value', budget: 'money', this_month: 'money', to_date: 'money', actual: 'money', match: 'money', variance: 'money', status: 'value', id: 'text',
  });
  // The CSV header is the 21 heads; the tooltips name the rule on the five CALCULATED columns and no other.
  assert.equal(tableCsv(COLS, []).trim(), 'START,END,KIND,BOOK,ACCOUNT,ACCOUNT NAME,SUB ACCOUNT NAME,VENDOR,ROUTINE,TIME,DAYS,CADENCE,NEXT,BUDGET,THIS MONTH,TO DATE,ACTUAL,MATCH,VARIANCE,STATUS,ID');
  assert.deepEqual(COLS.filter((c) => c.title !== undefined).map((c) => c.key), ['this_month', 'to_date', 'actual', 'match', 'variance']);
  assert.deepEqual(ROUTINE_TOOLTIPS, {
    this_month: 'calculated: occurrences in the month × amount — the /budget rule',
    to_date: 'calculated: occurrences from the 1st to today × amount — the /budget rule',
    actual: 'calculated: recorded at the stops, the 1st to today',
    match: 'calculated: postings linked in Books, the 1st to today',
    variance: 'calculated: TO DATE − ACTUAL',
  });
  assert.match(code(TABLE), /aria-label=\{sortLabelWords\(h\)\} title=\{c\.title\}/, 'the head word carries the tooltip');
  assert.match(code(COLUMNS), /readonly title\?: string;/);
});

test('B the cells: START · END drawn and ISO under; KIND once | repeated; ACCOUNT split from ACCOUNT NAME; SUB ACCOUNT NAME for a line and a stepless routine; VENDOR; ROUTINE alone; NEXT in the zone; the money; ID', () => {
  assert.equal(cell('routine:apple', 'start'), dayWords('2026-01-11'));
  assert.equal(csvOf('routine:apple', 'start'), '2026-01-11');
  assert.equal(cell('routine:apple', 'end'), BLANK);
  assert.equal(csvOf('routine:two:l1', 'end'), '2026-12-31');
  assert.equal(dayWords('2026-01-11'), new Date('2026-01-11T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }), 'formatDate, at local midnight — no zone shifts the day');
  assert.deepEqual(['routine:apple', 'routine:dentist'].map((id) => cell(id, 'kind')), [KIND_WORDS.repeated, KIND_WORDS.once]);
  assert.equal(routineKindOf(ROWS.find((r) => r.id === 'routine:dentist')!), 'once');
  assert.equal(cell('routine:apple', 'book'), 'Personal');
  assert.equal(cell('routine:apple', 'account'), 'P-8180');
  assert.equal(cell('routine:apple', 'account_name'), 'Streaming & Subscriptions');
  assert.deepEqual(accountCellsOf(BOOKS, CHARTS, 'p', '8180'), { account: 'P-8180', name: 'Streaming & Subscriptions' });
  assert.deepEqual(accountCellsOf(BOOKS, CHARTS, 'p', '6999'), { account: 'P-6999', name: 'not in the chart' });
  assert.deepEqual(accountCellsOf(BOOKS, {}, 'p', '8180'), { account: 'P-8180', name: 'chart not read' });
  assert.deepEqual(accountCellsOf([], CHARTS, 'p', '8180'), { account: null, name: 'book not loaded' }, 'the helper\'s non-account state prints under ACCOUNT NAME');
  assert.deepEqual(accountCellsOf(BOOKS, CHARTS, 'p', null), { account: null, name: null });
  assert.equal(cell('routine:apple', 'sub_account'), 'Apple storage', 'a stepless routine: its own name');
  assert.deepEqual(['routine:two:l1', 'routine:two:l2'].map((id) => cell(id, 'sub_account')), ['First', 'Second'], 'a line: its activity');
  assert.deepEqual(['routine:two:l1', 'routine:two:l2'].map((id) => cell(id, 'routine')), ['Two lines', 'Two lines'], 'ROUTINE the same on both rows');
  assert.equal(routineSubAccountOf(ROWS.find((r) => r.id === 'routine:two:l1')!), 'First');
  assert.deepEqual(['routine:apple', 'routine:two:l1', 'routine:two:l2', 'routine:dentist'].map((id) => cell(id, 'vendor')), ['Apple', BY_OCCURRENCE_WORDS, BLANK, BLANK]);
  assert.deepEqual([cell('routine:apple', 'time'), cell('routine:apple', 'days'), cell('routine:apple', 'cadence')], ['all day', '11th', 'monthly']);
  // NEXT: 2026-11-11T08:00Z is the 11th at 00:00 in Los Angeles; 2026-11-03T07:00Z is the 3rd at 14:00 in Bangkok; none → "—"; a zone Intl cannot read is said.
  assert.equal(csvOf('routine:apple', 'next'), '2026-11-11');
  assert.equal(cell('routine:apple', 'next'), dayWords('2026-11-11'));
  assert.equal(csvOf('routine:dentist', 'next'), '2026-11-03');
  assert.equal(cell('routine:two:l1', 'next'), BLANK);
  assert.deepEqual(routineNextOf(ROWS.find((r) => r.id === 'routine:two:l1')!), { day: null, words: null });
  const mars = routineNextOf(ROWS.find((r) => r.id === 'routine:mars')!);
  assert.equal(mars.day, null);
  assert.match(mars.words!, /^zone "Mars\/Olympus" not recognised: .* — pick one from the list$/);
  assert.equal(cell('routine:mars', 'next'), mars.words);
  // The money: BUDGET the line's own; the five CALCULATED from the month's record by row id; a line the route did not return is blank.
  assert.deepEqual(['budget', 'this_month', 'to_date', 'actual', 'match', 'variance'].map((k) => cell('routine:apple', k as typeof ROUTINE_COLUMNS[number])), ['$10.00', '$10.00', '$10.00', '$10.00', '$10.00', '$0.00']);
  assert.deepEqual(['budget', 'this_month', 'to_date', 'actual', 'match', 'variance'].map((k) => cell('routine:two:l1', k as typeof ROUTINE_COLUMNS[number])), ['$2.00', '$62.00', '$50.00', '$51.00', BLANK, '−$1.00']);
  assert.deepEqual(['budget', 'this_month', 'to_date', 'actual', 'match', 'variance'].map((k) => cell('routine:two:l2', k as typeof ROUTINE_COLUMNS[number])), [BLANK, BLANK, BLANK, BLANK, BLANK, BLANK]);
  assert.deepEqual(['budget', 'this_month', 'to_date', 'actual', 'match', 'variance'].map((k) => cell('routine:dentist', k as typeof ROUTINE_COLUMNS[number])), [BLANK, BLANK, BLANK, BLANK, BLANK, BLANK], 'no record from the route: blank, counted under the table');
  assert.equal(csvOf('routine:two:l1', 'variance'), '-1.00', 'the CSV the bare cents');
  assert.equal(csvOf('routine:apple', 'this_month'), '10.00');
  assert.equal(withoutMonthWords(1), '1 line without month figures');
  assert.equal(withoutMonthWords(2), '2 lines without month figures');
  assert.deepEqual(['routine:apple', 'routine:two:l1', 'routine:dentist'].map((id) => cell(id, 'id')), ['apple', 'l1', 'dentist']);
  assert.equal(routineIdOf(ROWS.find((r) => r.id === 'routine:two:l2')!), 'l2');
  assert.equal(cell('routine:apple', 'status'), 'active');
  // The CSV: every column in order, dates ISO, money bare, the full id.
  assert.equal(tableCsv(COLS, ROWS.filter((r) => r.id === 'routine:apple')).split('\r\n')[1],
    `2026-01-11,,repeated,Personal,P-8180,Streaming & Subscriptions,Apple storage,Apple,Apple storage,all day,11th,monthly,2026-11-11,10.00,10.00,10.00,10.00,10.00,0.00,active,apple`);
});

// ── THE SECTION (rulings C–D) ────────────────────────────────────────────────

test('C/D the section reads the routines and their month beside each other, as_of the viewer\'s local day; either failing fails the table in words; the figures land by row id; the unreturned are counted', () => {
  const f = code(SECTION_F);
  assert.match(f, /const \[body, monthBody\] = await Promise\.all\(\[\n\s*readJson\('\/api\/operations\/routines', 'routines'\),\n\s*readJson\(`\/api\/operations\/routines\/month\?as_of=\$\{localToday\(\)\}`, 'the routines’ month'\),\n\s*\]\);/);
  assert.match(f, /month: new Map\(lines\.map\(\(l\) => \[monthLineKey\(l\.routine_id, l\.step_id\), l\]\)\),/);
  assert.match(f, /\} catch \(e\) \{\n\s*setRead\(\{ kind: 'failed', words: e instanceof Error \? e\.message : String\(e\) \}\);/, 'one catch for both reads — the table fails whole');
  assert.match(f, /\{read\.kind === 'failed' && <div [^>]*\{\.\.\.dataAttr\(name, 'failed'\)\}>\{routineExpensesFailedWords\(read\.words\)\}<\/div>\}/);
  assert.match(f, /routineTable\(entities, charts, month\), \[entities, charts, month\]\)/);
  assert.match(f, /const withoutMonth = rows\.filter\(\(r\) => !month\.has\(r\.id\)\)\.length;/);
  assert.match(f, /\{withoutMonth > 0 && <span \{\.\.\.dataAttr\(name, 'without-month'\)\}> · \{withoutMonthWords\(withoutMonth\)\}<\/span>\}/);
  assert.match(f, /\{read\.kind === 'loaded' && read\.said\.length > 0 && \(/, 'what the route said is shown');
  assert.match(f, /tableClassName="min-w-\[150rem\]"/, 'a 21-column table scrolls as the ledger\'s does');
  assert.doesNotMatch(f, /localStorage|sessionStorage|document\.cookie|degraded|partial/);
  // Unchanged by ROUTINES-03: the chip, "+ routine", the editor, the controls, the CSV name, the three-table page.
  assert.match(f, /\{statusChipWords\(statusDroppedOf\(filters\), ROUTINE_DEFAULT\)\} \{CLEAR_CHIP_MARK\}/);
  assert.match(f, /<RoutineCreateForm\n\s*entities=\{entities\}/);
  assert.match(f, /<RoutineEditForm routine=\{routine\} end=\{end\} entities=\{entities\} onChanged=\{onChanged\} onClose=\{\(\) => setEditing\(false\)\} \/>/);
  assert.match(f, /\{ name: routineExpensesCsvFileName\(localToday\(\)\) \}/);
  assert.match(code('src/app/tasks/page.tsx'), /<SectionE_Work \/>\n\s*<Suspense>\n\s*<SectionD_ProjectBacklog \/>\n\s*<\/Suspense>\n\s*<SectionF_RoutineExpenses \/>/);
  assert.match(comments(WORK_LIB), /ROUTINES-03 \(Alex, 2026-10-25, rulings A–B\) — the columns, in Alex's order/);
  assert.match(comments(SECTION_F), /ROUTINES-03, Alex, 2026-10-25, ruling A/);
  assert.match(comments(RULE), /ROUTINES-03 \(Alex, 2026-10-25\) — THE MONTH BEHIND ROUTINE EXPENSES, PURE/);
});
