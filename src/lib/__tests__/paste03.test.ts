/**
 * PASTE-03 (Alex, 2026-11-28) — THE PASTE TAKES HIS SHEET AS IT IS: A STOP MAY HAVE NO BUDGET, AND A ROW WITH NO START TIME IS A
 * CHARGE ON ITS DATE.
 *
 * Until this change a stop existed only where money was: the time sheet's rows were /budget's lines, /budget builds a line only for
 * an AMOUNT, and a vendor could sit only on a line that carried one. Here: a routine's LINE may name its account with no amount
 * (src/lib/operations/planMoney.ts — the pair bends one way, for a line only); such a line's occurrences are built beside the
 * Budget's lines with NO figure (src/lib/budget/openLines.ts); a vendor may be planned at one (planVendor.ts); the day's plan does
 * not call one stranded (planLines.ts); the time sheet lists it with BUDGET blank (ledger.ts); "+ expense" and the paste take a
 * stop with no budget.
 *
 * HERMETIC, on paste02.test.ts's model — no database, no network, and the only clock is the `now` handed in. The rules are DRIVEN
 * directly over made-up plans and rows; the writers' routes and the files that must not change are anchored to their source with
 * comments stripped (the reader law). Every name, day, account and amount below is invented. No pin here names a line number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code } from '../sourceText';
import { BLANK } from '../budget/format';
import { markLines } from '../budget/report';
import { BudgetDaysError, buildRoutineBudgetLines, occurrenceKey, wholeRoutineKey, type RoutinePlanInput } from '../budget/days';
import { accountOnlyLinesOf, buildRoutineOpenLines } from '../budget/openLines';
import { STRANDED_WORDS, dayPlanOf, type PlanVendorRow, type RoutineWords } from '../budget/planLines';
import { PLAN_COLUMN_DIGITS, planMoney, type PlanBook, type PlanColumn, type PlanMoneySent } from '../operations/planMoney';
import { moneyIsHere, occurrenceIn, occurrenceWindow, type PlanFacts } from '../operations/planVendor';
import { NOT_RECORDED_WORDS, type StopRecordRow } from '../operations/stopRecord';
import { NOT_A_STOP_RECORD_WORDS, ROLE_SHORT_WORDS } from '../operations/stopRole';
import { ALL_DAY_CLOCK, allDayTimeInput, clockWords, compileFormToRRule } from '../operations/rruleHelpers';
import { zonedToInstant } from '../time';
import {
  AMOUNT_ZERO_WORDS, EMPTY_EXPENSE, PLANNED_WORD, RECORD_CHARGE_WORDS, cellWordsOf, chargeFieldWords, expenseInput, ledgerOf, ledgerTotals, notRecordedWords, oneOffBody, oneOffRoutineName, outcomeWords, planMinutesOf, timeTypedWords,
  type ExpenseDraft, type LedgerInput, type LedgerPlanRow, type LedgerRecordInput, type LedgerRecording, type LedgerSheetRow, type LedgerVendorRow,
} from '../operations/ledger';
import {
  CHARGE_NOTES_WORDS, CHARGE_TOTAL_WORDS, END_NO_START_WORDS, ITEMS_CHARGE_STANDS_WORDS, ITEMS_NO_VENDOR_WORDS, ITEMS_OTHER_VENDOR_WORDS, ONE_OFF_ZERO_BUDGET_WORDS, ON_TIME_SHEET_KEYS, PASTE_READ_HEADS,
  chargeTwiceWords, chargeWords, countsWords, itemsStandWords, kindKeyOf, manyNamedWords, onChargeWords, pasteShown, placePaste, readPaste, stopTakenWords, vendorNotWrittenWords,
  type Paste, type PasteContext, type PasteHead, type PastePick, type PastePlacement,
} from '../operations/pasteRows';
import { pasteWritesOf, runPaste, type PasteWriters } from '../operations/pasteSave';

const DAYS = 'src/lib/budget/days.ts';
const OPEN = 'src/lib/budget/openLines.ts';
const API = 'src/app/api/operations/';

const countOf = (text: string, word: RegExp): number => (text.match(word) ?? []).length;
type Refused = { readonly ok: false; readonly status: number; readonly error: string; readonly message: string };
const refusal = (r: { readonly ok: boolean }): Refused => {
  if (r.ok) return assert.fail('expected a refusal');
  return r as unknown as Refused;
};

// ── THE PLANS — every name, day, account and amount made up ─────────────────

const NBO = 'Africa/Nairobi'; // three hours ahead of UTC the year round
const MON = '2027-08-09';
const TUE = '2027-08-10';
const WED = '2027-08-11';
/** Tuesday noon in the zone: Monday and Tuesday's morning are past; Wednesday is ahead. */
const NOW = new Date('2027-08-10T09:00:00.000Z');
const at = (day: string, clock: string): string => new Date(`${day}T${clock}:00.000+03:00`).toISOString();

const routine = (over: Partial<RoutinePlanInput> & { id: string; name: string }): RoutinePlanInput => ({
  entityId: 'P', entityType: 'personal', timezone: NBO, scheduleRrule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0', startDate: null, endDate: null,
  budgetAmount: null, coaCode: null, startTime: null, endTime: null, role: 'place', steps: [], ...over,
});
type Step = RoutinePlanInput['steps'][number];
const step = (id: string, stepOrder: number, budgetAmount: string | null, coaCode: string | null, over: Partial<Step> = {}): Step => ({ id, stepOrder, budgetAmount, coaCode, durationMinutes: null, timeOfDay: null, ...over });
/** A daily 09:00 routine: Walk names its account and NO amount; Soup is costed. */
const WALKS = routine({ id: 'walks', name: 'Walks', steps: [step('walk', 0, null, '6200', { durationMinutes: 30 }), step('soup', 1, '8.00', '6150')] });
const walkKey = (day: string): string => occurrenceKey({ routineId: 'walks', lineId: 'walk', instant: new Date(at(day, '09:00')) });
const soupKey = (day: string): string => occurrenceKey({ routineId: 'walks', lineId: 'soup', instant: new Date(at(day, '09:00')) });

// ── T1 · THE PAIR, BY COLUMN (ruling 1.1) ────────────────────────────────────

const BOOK: PlanBook = {
  id: 'P', name: 'Home', entityType: 'personal',
  chart: [
    { code: '6150', name: 'Dining Out', account_type: 'expense', is_archived: false },
    { code: 'P-6200', name: 'Recreation', account_type: 'expense', is_archived: false },
    { code: '6900', name: 'Old hobby', account_type: 'expense', is_archived: true },
    { code: '1000', name: 'Cash', account_type: 'asset', is_archived: false },
  ],
};
const FIELDS = { amount: 'budget_amount', account: 'coa_code' };
const money = (sent: PlanMoneySent, column: PlanColumn, book: PlanBook | null = BOOK) => planMoney(sent, book, column, FIELDS);
const AMOUNT_NEEDS_ACCOUNT = { field: 'coa_code', message: 'an amount needs its account — choose the income or expense account this money goes on' };
const ACCOUNT_NEEDS_AMOUNT = { field: 'budget_amount', message: 'an account needs its amount — enter the amount, or clear the account' };

test('T1 the pair, by column: an amount needs its account in every column; an account needs its amount for a routine and a task — and for a LINE it does not: the account is read by the chart’s rule exactly as before and saved with a null amount, never 0', () => {
  for (const column of ['routine', 'line', 'task'] as const) {
    // Neither: no money, nothing read.
    assert.deepEqual(money({ amount: '', account: '  ' }, column, null), { value: { amount: null, coaCode: null } }, column);
    // An amount with no account: refused, in every column.
    assert.deepEqual(money({ amount: '12.50', account: '' }, column), { error: AMOUNT_NEEDS_ACCOUNT }, column);
    // Both: as before.
    assert.deepEqual(money({ amount: '12.50', account: '6200' }, column), { value: { amount: '12.50', coaCode: 'P-6200' } }, column);
  }
  // An account with no amount: the routine's own figure and a task still need the pair.
  assert.deepEqual(money({ amount: '', account: '6150' }, 'routine'), { error: ACCOUNT_NEEDS_AMOUNT });
  assert.deepEqual(money({ amount: null, account: '6150' }, 'task'), { error: ACCOUNT_NEEDS_AMOUNT });
  // A LINE's account with no amount: taken — the chart row's code as saved, and a null amount.
  assert.deepEqual(money({ amount: '', account: '6150' }, 'line'), { value: { amount: null, coaCode: '6150' } });
  assert.deepEqual(money({ amount: undefined, account: 'p-6200' }, 'line'), { value: { amount: null, coaCode: 'P-6200' } }, 'typed lowercase, saved lettered → lettered');
  // …read by R2 exactly as any account: not in the chart, archived, not an income or expense account, a letter of another book — each refused in its words.
  assert.deepEqual(money({ amount: '', account: '6300' }, 'line'), { error: { field: 'coa_code', message: "P-6300 is not an account in Home's chart" } });
  assert.deepEqual(money({ amount: '', account: '6900' }, 'line'), { error: { field: 'coa_code', message: "P-6900 Old hobby is archived in Home's chart — choose an open account" } });
  assert.deepEqual(money({ amount: '', account: '1000' }, 'line'), { error: { field: 'coa_code', message: "P-1000 Cash is an asset account — a plan's money goes on an income or expense account" } });
  assert.deepEqual(money({ amount: '', account: 'B-6150' }, 'line'), { error: { field: 'coa_code', message: 'code B-6150 carries the B- letter; this is a P- chart (personal) — enter P-6150 or 6150' } });
  // An account still comes with its book — a line's account with no amount is money to check, and a missing book is the writer's bug.
  assert.throws(() => money({ amount: '', account: '6150' }, 'line', null), /planMoney: a plan carrying money was checked without its book/);
  // The columns' digits: a line holds what a routine holds; the too-large words say "a routine's" for a line, as they did.
  assert.deepEqual(PLAN_COLUMN_DIGITS, { routine: 10, line: 10, task: 13 });
  assert.deepEqual(money({ amount: '12345678901', account: '6150' }, 'line'), { error: { field: 'budget_amount', message: "12345678901 is too large — a routine's amount holds at most 10 digits before the point" } });
  assert.deepEqual(money({ amount: '12345678901234', account: '6150' }, 'task'), { error: { field: 'budget_amount', message: "12345678901234 is too large — a task's amount holds at most 13 digits before the point" } });
  // A typed 0 is an amount — the line keeps it as typed.
  assert.deepEqual(money({ amount: '0', account: '6150' }, 'line'), { value: { amount: '0', coaCode: '6150' } });
});

// ── T2 · THE WRITERS (ruling 1.1) ────────────────────────────────────────────

test('T2 the four writers of a LINE name the line’s column; the three writers of a routine’s own figure and the three of a task keep theirs — ten calls, four of them a line’s', () => {
  const calls = (file: string): string[] => [...code(file).matchAll(/planMoney\((\w+(?:\[i\])?), book, '(\w+)', /g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(calls(`${API}routines/route.ts`), ['routineSent:routine', 'lineSent[i]:line'], 'the create: the routine’s figure, then the lines’ loop');
  assert.deepEqual(calls(`${API}routines/[id]/route.ts`), ['sent:routine'], 'the routine’s edit');
  assert.deepEqual(calls(`${API}routines/[id]/steps/route.ts`), ['sent:line'], 'a line’s create');
  assert.deepEqual(calls(`${API}routines/steps/[stepId]/route.ts`), ['sent:line'], 'a line’s edit');
  assert.deepEqual(calls(`${API}routines/move/route.ts`), ['routineSent:routine', 'lineSent[i]:line'], 'the move: the routine’s figure, then the lines’ loop');
  for (const task of ['projects/[id]/tasks/route.ts', 'projects/[id]/tasks/[taskId]/route.ts', 'tasks/[id]/assign/route.ts']) assert.deepEqual(calls(`${API}${task}`), ['sent:task'], task);
});

// ── T3 · THE LINES THAT NAME AN ACCOUNT AND NO AMOUNT (ruling 1.2) ───────────

test('T3 accountOnlyLinesOf: the active lines with an account and no amount, in their order — a costed line is not one, nor a line with neither, nor an inactive line; none while the routine’s own figure is in force', () => {
  assert.deepEqual(accountOnlyLinesOf(WALKS), [{ id: 'walk', coaCode: '6200' }]);
  const three = routine({ id: 'r', name: 'R', steps: [step('b', 2, null, ' 6150 '), step('a', 1, null, '6200'), step('c', 3, null, null), step('d', 4, '0', '6150')] });
  assert.deepEqual(accountOnlyLinesOf(three), [{ id: 'a', coaCode: '6200' }, { id: 'b', coaCode: '6150' }], 'by step order; the code as the leaf reads it — trimmed; a $0 line is costed');
  assert.deepEqual(accountOnlyLinesOf(routine({ id: 'r', name: 'R', steps: [step('a', 0, null, '6200', { isActive: false })] })), [], 'an inactive line');
  // The routine's own figure in force (no line costed, the routine priced): its money is the routine's, and so is its vendor.
  assert.deepEqual(accountOnlyLinesOf(routine({ id: 'r', name: 'R', budgetAmount: '30', coaCode: '6150', steps: [step('a', 0, null, '6200')] })), []);
  // A routine whose lines carry no amount at all, its own figure blank: its account-only lines are its lines.
  assert.deepEqual(accountOnlyLinesOf(routine({ id: 'r', name: 'R', steps: [step('a', 0, null, '6200')] })), [{ id: 'a', coaCode: '6200' }]);
});

// ── T4 · THE OCCURRENCES THAT CARRY NO MONEY (ruling 1.2) ────────────────────

test('T4 buildRoutineOpenLines: one line an occurrence of each account-only line, by the money builder’s own expansion, day and key — with NO cents; a costed line beside it is the Budget’s alone; the end date; a code the chart refuses; a routine that cannot be read listed only when no line carries money; the range’s throws; an all-day one-off; the order', () => {
  const built = buildRoutineBudgetLines([WALKS], MON, WED);
  const opened = buildRoutineOpenLines([WALKS], MON, WED);
  assert.deepEqual(opened.open, [MON, TUE, WED].map((day) => ({ entityId: 'P', code: '6200', day, source: 'routine', sourceId: walkKey(day) })));
  assert.ok(opened.open.every((line) => !('cents' in line)), 'no cents field — nothing here can be summed');
  assert.deepEqual(opened.notPlaced, []);
  // The costed line is the Budget's, and only the Budget's; the two builders never hold one occurrence twice.
  assert.deepEqual(built.lines.map((l) => [l.sourceId, l.cents]), [MON, TUE, WED].map((day) => [soupKey(day), 800]));
  assert.ok(!opened.open.some((o) => built.lines.some((l) => l.sourceId === o.sourceId)));
  // The routine's own figure in force: no open line, though a line names an account and no amount.
  assert.deepEqual(buildRoutineOpenLines([routine({ id: 'r', name: 'R', budgetAmount: '30', coaCode: '6150', steps: [step('a', 0, null, '6200')] })], MON, WED), { open: [], notPlaced: [] });
  // An inactive line, and a routine with no account-only line: nothing.
  assert.deepEqual(buildRoutineOpenLines([routine({ id: 'r', name: 'R', steps: [step('a', 0, null, '6200', { isActive: false }), step('b', 1, null, null)] })], MON, WED), { open: [], notPlaced: [] });
  // The end date: an occurrence after it is not one.
  assert.deepEqual(buildRoutineOpenLines([{ ...WALKS, endDate: MON }], MON, WED).open.map((o) => o.day), [MON]);
  // A code the chart's rule refuses: that occurrence, that day, the rule's own reason and words — cents null, there being no amount to say.
  const lettered = buildRoutineOpenLines([routine({ id: 'r', name: 'R', steps: [step('a', 0, null, 'B-6200')] })], MON, MON);
  assert.deepEqual(lettered.open, []);
  assert.deepEqual(lettered.notPlaced, [{
    source: 'routine', sourceId: occurrenceKey({ routineId: 'r', lineId: 'a', instant: new Date(at(MON, '09:00')) }), entityId: 'P', label: 'R', cents: null, day: MON,
    reason: 'account code not recognised', detail: '"B-6200" — code B-6200 carries the B- letter; this is a P- chart (personal) — enter P-6200 or 6200',
  }]);
  // A routine that cannot be read: listed under the whole routine's key ONLY when none of its lines carries money — the money builder lists the others, never both.
  const mars = routine({ id: 'r', name: 'R', timezone: 'Mars/Olympus', steps: [step('a', 0, null, '6200')] });
  const unread = buildRoutineOpenLines([mars], MON, WED);
  assert.deepEqual([unread.open, unread.notPlaced.map((n) => [n.sourceId, n.cents, n.day, n.reason])], [[], [[wholeRoutineKey('r'), null, null, 'timezone not recognised']]]);
  assert.equal(buildRoutineBudgetLines([mars], MON, WED).notPlaced.length, 0, 'a routine with no money: the money builder lists nothing (ruling 2026-09-27, unchanged)');
  const marsCosted = { ...mars, steps: [...mars.steps, step('b', 1, '5.00', '6150')] };
  assert.deepEqual(buildRoutineOpenLines([marsCosted], MON, WED), { open: [], notPlaced: [] });
  assert.deepEqual(buildRoutineBudgetLines([marsCosted], MON, WED).notPlaced.map((n) => n.sourceId), [wholeRoutineKey('r')], 'listed once — by the money builder');
  assert.equal(buildRoutineOpenLines([routine({ id: 'r', name: 'R', scheduleRrule: 'FREQ=SOMETIMES', steps: [step('a', 0, null, '6200')] })], MON, WED).notPlaced[0].reason, 'schedule does not parse');
  // A bad call: the codes and the words days.ts uses.
  for (const [from, to] of [['Aug 9', WED], [MON, '2027-02-30'], [WED, MON]]) {
    assert.throws(() => buildRoutineOpenLines([WALKS], from, to), (e: unknown) => e instanceof BudgetDaysError && e.code === 'bad-range', `${from}..${to}`);
  }
  assert.throws(() => buildRoutineOpenLines([{ ...WALKS, endDate: 'soon' }], MON, WED), (e: unknown) => e instanceof BudgetDaysError && e.code === 'bad-end-date' && e.message === `BUDGET DAYS: routine walks endDate "soon" is not a 'YYYY-MM-DD' day`);
  // An all-day one-off: its one occurrence, on its date, at the day's start in its zone — the clock an all-day routine carries.
  const fee = routine({ id: 'fee', name: 'Club fee', role: 'all_day', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=0;BYMINUTE=0;BYSECOND=0', startDate: TUE, steps: [step('due', 0, null, '6200')] });
  assert.deepEqual(buildRoutineOpenLines([fee], MON, WED).open, [{ entityId: 'P', code: '6200', day: TUE, source: 'routine', sourceId: occurrenceKey({ routineId: 'fee', lineId: 'due', instant: new Date(at(TUE, '00:00')) }) }]);
  // The order: by day, then key — whatever order the routines come in.
  const both = buildRoutineOpenLines([fee, WALKS], MON, WED).open.map((o) => o.sourceId);
  assert.deepEqual(both, [walkKey(MON), ...[occurrenceKey({ routineId: 'fee', lineId: 'due', instant: new Date(at(TUE, '00:00')) }), walkKey(TUE)].sort(), walkKey(WED)]);
});

// ── T5 · THE VENDOR GOES WHERE THE ACCOUNT IS (ruling 1.3) ───────────────────

test('T5 moneyIsHere: a line that names its account and no amount takes a vendor — beside a costed line or with none costed; a line with neither still does not; nor does one while the routine’s own figure is in force; a routine is still refused when its money is on its lines', () => {
  const line = (r: RoutinePlanInput, lineId: string): PlanFacts => ({ kind: 'routine_line', routine: r, lineId });
  assert.deepEqual(moneyIsHere(line(WALKS, 'walk')), { ok: true }, 'beside a costed line');
  assert.deepEqual(moneyIsHere(line(WALKS, 'soup')), { ok: true }, 'the costed line, as before');
  const uncosted = routine({ id: 'r', name: 'R', steps: [step('a', 0, null, '6200'), step('b', 1, null, null)] });
  assert.deepEqual(moneyIsHere(line(uncosted, 'a')), { ok: true }, 'no line costed, the routine’s own figure blank');
  assert.deepEqual(refusal(moneyIsHere(line(uncosted, 'b'))), { ok: false, status: 409, error: 'no-money', message: 'this line carries no amount — a vendor is who a plan\'s money is paid to' }, 'neither amount nor account');
  const routineFigure = routine({ id: 'r', name: 'R', budgetAmount: '30', coaCode: '6150', steps: [step('a', 0, null, '6200')] });
  assert.equal(refusal(moneyIsHere(line(routineFigure, 'a'))).message, 'this line carries no amount — a vendor is who a plan\'s money is paid to; this routine\'s own figure is in force — its vendor goes on the routine');
  // The routine itself: the vendor goes on its lines when its money is there — an account-only line changes nothing of that.
  assert.equal(refusal(moneyIsHere({ kind: 'routine', routine: uncosted })).error, 'no-money');
  assert.equal(refusal(moneyIsHere({ kind: 'routine', routine: WALKS })).error, 'money-on-lines');
});

// ── T6 · AN OCCURRENCE THE NEW BUILDER BUILDS (ruling 1.3) ───────────────────

test('T6 occurrenceIn: the exact occurrence among the built lines, then among the open ones, then the not-placed — an instant that is none is still refused; the route hands it the open occurrences beside the builder’s own, its gates untouched', () => {
  const ask = (instant: Date, withOpen: boolean) => {
    const w = occurrenceWindow(instant);
    return occurrenceIn(buildRoutineBudgetLines([WALKS], w.rangeFrom, w.rangeTo), WALKS, { kind: 'routine_line', id: 'walk', instant }, withOpen ? buildRoutineOpenLines([WALKS], w.rangeFrom, w.rangeTo).open : []);
  };
  const monday = new Date(at(MON, '09:00'));
  assert.deepEqual(ask(monday, true), { ok: true, day: MON });
  assert.equal(refusal(ask(monday, false)).error, 'not-an-occurrence', 'without the open occurrences it is no occurrence the builder holds');
  assert.deepEqual(refusal(ask(new Date(at(MON, '09:01')), true)), { ok: false, status: 409, error: 'not-an-occurrence', message: `"Walks" has no occurrence at ${new Date(at(MON, '09:01')).toISOString()} — /budget builds none at that instant` });
  // The costed line is found among the built lines, as before.
  const w = occurrenceWindow(monday);
  assert.deepEqual(occurrenceIn(buildRoutineBudgetLines([WALKS], w.rangeFrom, w.rangeTo), WALKS, { kind: 'routine_line', id: 'soup', instant: monday }, []), { ok: true, day: MON });
  // A routine the builder cannot place is refused first, in its words.
  const mars = routine({ id: 'r', name: 'R', timezone: 'Mars/Olympus', steps: [step('a', 0, null, '6200'), step('b', 1, '5.00', '6150')] });
  const wm = occurrenceWindow(monday);
  assert.equal(refusal(occurrenceIn(buildRoutineBudgetLines([mars], wm.rangeFrom, wm.rangeTo), mars, { kind: 'routine_line', id: 'a', instant: monday }, buildRoutineOpenLines([mars], wm.rangeFrom, wm.rangeTo).open)).error, 'cannot-place');
  // The route: one call more, beside the builder's own, over the same window — and its gates as they were, in their order.
  const route = code(`${API}plan-vendors/route.ts`);
  assert.match(route, /const built = buildRoutineBudgetLines\(\[routineInput\], window\.rangeFrom, window\.rangeTo\);\n\s*const occurrence = occurrenceIn\(built, routineInput, \{ \.\.\.address, instant: address\.instant \}, buildRoutineOpenLines\(\[routineInput\], window\.rangeFrom, window\.rangeTo\)\.open\);/);
  const order = ['const userEmail = await getVerifiedEmail();', 'const read = readPlanAddress(', 'const money = moneyIsHere(plan);', 'const occurrence = occurrenceIn(', 'const fits = vendorFits(', 'const grain = grainAllows('].map((s) => route.indexOf(s));
  assert.ok(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])), 'the checks (a) to (h) in their order');
});

// ── T7 · NOT STRANDED (ruling 1.4) ───────────────────────────────────────────

const WORDS = new Map<string, RoutineWords>([['walks', { name: 'Walks', timezone: NBO, steps: new Map([['walk', { activity: 'Walk', timeOfDay: null }], ['soup', { activity: 'Soup', timeOfDay: null }]]) }]]);
const occurrenceVendor = (id: string, instant: string): PlanVendorRow => ({
  id, routine_id: null, step_id: 'walk', task_id: null, occurrence_at: new Date(instant), vendor: { id: 'v-trail', vendor_name: 'Trail Co', entity_id: 'P' },
  routine: null, step: { activity: 'Walk', routine_id: 'walks', routine: { name: 'Walks', timezone: NBO } }, task: null,
});

test('T7 dayPlanOf: an occurrence vendor at an occurrence that carries no money is not stranded — the open occurrences are ones the view built; one at an instant that is no occurrence still is; the open occurrence is listed as no plan line', () => {
  const built = buildRoutineBudgetLines([WALKS], MON, MON);
  const open = buildRoutineOpenLines([WALKS], MON, MON).open;
  const vendors = [occurrenceVendor('pv-on', at(MON, '09:00')), occurrenceVendor('pv-off', at(MON, '09:30'))];
  const plan = (withOpen: boolean) => {
    const read = dayPlanOf({ view: { kind: 'day', day: MON }, lines: markLines(built.lines, new Map()), notPlaced: built.notPlaced, open: withOpen ? open : [], routines: WORDS, tasks: new Map(), vendors });
    if (!read.ok || !read.plan.listed) return assert.fail(`dayPlanOf: ${read.ok ? 'not listed' : read.message}`);
    return read.plan;
  };
  assert.deepEqual(plan(true).stranded.map((s) => [s.address.instant, s.reason]), [[at(MON, '09:30'), STRANDED_WORDS]], 'only the vendor at no occurrence');
  assert.deepEqual(plan(false).stranded.map((s) => s.address.instant), [at(MON, '09:00'), at(MON, '09:30')], 'without them, both');
  assert.deepEqual(plan(true).lines.map((l) => [l.line, l.cents]), [['Soup', 800]], 'the day’s plan lists the Budget’s lines alone');
});

// ── T8 · THE TIME SHEET (ruling 1.5) ─────────────────────────────────────────

const record = (over: Partial<StopRecordRow> & { id: string; target_id: string; occurrence_at: string }): StopRecordRow => ({
  kind: 'routine_line', outcome: 'done', done_at: over.occurrence_at, actual_cents: null, rating: null, note: null, notes: null, actual_minutes: null, ...over,
});
/** Monday's walk: recorded went, $5. */
const WALK_MON = record({ id: 'r-walk', target_id: 'walk', occurrence_at: at(MON, '09:00'), actual_cents: 500 });
const RECORDS: LedgerRecordInput[] = [{ record: WALK_MON, routineId: 'walks', routineName: 'Walks', zone: NBO, role: 'place', activity: 'Walk', timeOfDay: null, durationMinutes: 30 }];
const TRAIL: LedgerVendorRow = {
  id: 'pv-walk', routine_id: null, step_id: 'walk', task_id: null, occurrence_at: null, items: 'water and a hat', vendor: { id: 'v-trail', vendor_name: 'Trail Co', entity_id: 'P', instagram_tag: null },
  routine: null, step: { activity: 'Walk', routine_id: 'walks', routine: { name: 'Walks', timezone: NBO } }, task: null,
};
const BUILT = buildRoutineBudgetLines([WALKS], MON, WED);
const OPENED = buildRoutineOpenLines([WALKS], MON, WED);
const sheetInput = (over: Partial<LedgerInput> = {}): LedgerInput => ({
  from: MON, to: WED, now: NOW, records: RECORDS, links: [], lines: BUILT.lines, open: OPENED.open, notPlaced: [...BUILT.notPlaced, ...OPENED.notPlaced], routines: WORDS,
  roles: new Map([['walks', 'place']]), locations: new Map([['walks', null]]), subAccounts: [], minutes: planMinutesOf([WALKS]), vendors: [TRAIL], stays: [],
  accounts: [{ entityId: 'P', code: '6150', name: 'Dining Out' }, { entityId: 'P', code: '6200', name: 'Recreation' }], books: [{ id: 'P', entityType: 'personal' }], ...over,
});

test('T8 ledgerOf: a plan row on a line that names no amount holds cents null — BUDGET blank, never 0 — with its vendor, its planned items and its codes by the one rule; a recorded row matched to one is ‘matched’, cents and variance null; the keys; the totals sum only the figures there are; the note counts every stop past with no record; a key that is no occurrence’s, or one handed in twice, is thrown by name', () => {
  const ledger = ledgerOf(sheetInput());
  const walk = (day: string): LedgerSheetRow => {
    const row = ledger.sheet.find((r) => r.day === day && r.description === 'Walk');
    return row === undefined ? assert.fail(`no Walk row on ${day}`) : row;
  };
  // Monday's walk: the record, on its line — matched, and no figure on either side of it.
  const monday = walk(MON);
  assert.deepEqual([monday.id, monday.key, monday.id !== null && monday.budgetState, monday.cents, monday.actualCents, monday.varianceCents], ['r-walk', `line:walk:${at(MON, '09:00')}`, 'matched', null, 500, null]);
  assert.deepEqual([monday.vendor, monday.segments === null ? null : monday.segments.code, cellWordsOf(monday, 'budget'), cellWordsOf(monday, 'variance')], ['Trail Co', 'P-6200', BLANK, BLANK]);
  // Tuesday's and Wednesday's: plan rows — no figure, the vendor and its planned items by the plan's grain, past and ahead by the clock.
  for (const [day, went] of [[TUE, NOT_RECORDED_WORDS], [WED, PLANNED_WORD]] as const) {
    const row = walk(day) as LedgerPlanRow;
    assert.deepEqual([row.id, row.key, row.cents, row.varianceCents, row.vendor, row.plannedItems, row.went, row.plannedMinutes, cellWordsOf(row, 'budget')], [null, `line:walk:${at(day, '09:00')}`, null, null, 'Trail Co', 'water and a hat', went, 30, BLANK], day);
    assert.equal((ledger.recording[row.key] as Extract<LedgerRecording, { takes: true }>).takes, true, 'it takes its record, as any stop');
  }
  // The costed line beside it: its figure, as before.
  assert.deepEqual(ledger.sheet.filter((r) => r.description === 'Soup').map((r) => r.cents), [800, 800, 800]);
  // The totals: only the figures there are — the soup's budgets, the walk's actual; no variance, no row carrying both.
  const totals = ledgerTotals(ledger.sheet);
  assert.deepEqual([totals.budgetCents, totals.actualCents, totals.varianceCents, totals.withVariance], [2400, 500, null, 0]);
  // The note: Tuesday's walk and the two soups before the clock — a stop with no budget is counted as any.
  assert.equal(ledger.said.notRecorded, 3);
  assert.equal(notRecordedWords(ledger.said.notRecorded), '3 stops planned in the period, already past, with no record');
  assert.equal(notRecordedWords(1), '1 stop planned in the period, already past, with no record');
  // With no open occurrences the walk is on no line: the record is its own row, no line matching it — what a stop whose line named no amount was until now.
  const without = ledgerOf(sheetInput({ open: [] }));
  assert.deepEqual(without.sheet.filter((r) => r.description === 'Walk').map((r) => [r.id, r.id !== null && r.budgetState]), [['r-walk', 'none']]);
  // A key that is no routine occurrence's, and an occurrence handed in as both a budget line and an open one: the caller's error, thrown by name.
  assert.throws(() => ledgerOf(sheetInput({ open: [{ entityId: 'P', code: '6200', day: MON, source: 'routine', sourceId: 'task:t-1' }] })), /ledger: open line "task:t-1" is no routine occurrence's key/);
  assert.throws(() => ledgerOf(sheetInput({ open: [...OPENED.open, { entityId: 'P', code: '6150', day: MON, source: 'routine', sourceId: soupKey(MON) }] })), new RegExp(`ledger: ${soupKey(MON).replace(/[.]/g, '\\.')} is handed in as a budget line AND as an open line`));
});

// ── T9 · "+ EXPENSE" (ruling 1.6) ────────────────────────────────────────────

const DRAFT: ExpenseDraft = { ...EMPTY_EXPENSE, day: MON, time: '12:30', name: 'Picnic', amount: '', coa: '6200', book: 'P' };

test('T9 “+ expense”: a blank AMOUNT is a stop with no budget — the value holds none and the one-off’s line is sent with its account and no amount; a typed amount is read as before, and a 0 is still refused', () => {
  const read = expenseInput(DRAFT, NBO, NOW);
  assert.ok(read.ok);
  assert.equal(read.value.amount, '');
  assert.deepEqual(oneOffBody(read.value).lines, [{ activity: 'Picnic', budget_amount: '', coa_code: '6200' }]);
  assert.deepEqual(expenseInput({ ...DRAFT, amount: '   ' }, NBO, NOW), read, 'spaces are a blank');
  const priced = expenseInput({ ...DRAFT, amount: '12.5' }, NBO, NOW);
  assert.ok(priced.ok && priced.value.amount === '12.5' && oneOffBody(priced.value).lines[0].budget_amount === '12.5');
  assert.deepEqual(expenseInput({ ...DRAFT, amount: '0' }, NBO, NOW), { ok: false, field: 'amount', message: AMOUNT_ZERO_WORDS });
  assert.deepEqual(expenseInput({ ...DRAFT, amount: '0.00' }, NBO, NOW), { ok: false, field: 'amount', message: 'an expense has an amount above 0' });
  assert.deepEqual(expenseInput({ ...DRAFT, amount: 'ten' }, NBO, NOW), { ok: false, field: 'amount', message: '"ten" is not an amount (dollars, at most two decimals)' });
  // The account is still required — a stop with no budget still names its account.
  assert.deepEqual(expenseInput({ ...DRAFT, coa: '' }, NBO, NOW), { ok: false, field: 'coa', message: 'CATEGORY is required' });
});

// ── T10 · THE PASTE: A ROW WITH NO BUDGET (ruling 1.6) ───────────────────────

const TAB = '\t';
type Typed = Partial<Record<PasteHead, string>>;
const pasteOf = (...rows: readonly Typed[]): Paste => {
  const read = readPaste([PASTE_READ_HEADS.join(TAB), ...rows.map((typed) => PASTE_READ_HEADS.map((head) => (head in typed ? typed[head] : '')).join(TAB))].join('\n'));
  if (!read.ok) return assert.fail(`refused: ${read.words}`);
  return read.value;
};
const CONTEXT: PasteContext = {
  books: [{ id: 'P', name: 'Home', entityType: 'personal' }], sheet: [], recording: {}, charts: { P: [{ id: 'acct-6200', code: '6200', name: 'Recreation' }] }, subAccounts: { P: [] },
  vendors: [], zone: NBO, now: NOW,
};
const placedAll = (paste: Paste, pick: PastePick, context: PasteContext = CONTEXT): PastePlacement[] => {
  const picks: Record<string, PastePick> = {};
  for (const row of paste.rows) if (row.kind === 'read') picks[kindKeyOf(row.cells)] = pick;
  return placePaste(paste, picks, context);
};
const ONE_OFF: PastePick = { kind: 'oneOff', code: '6200' };
const KAYAK: Typed = { 'Start Date': '8/9/27', 'Start Time': '3:00 PM', Category: 'Recreation', Entity: 'Personal', Type: 'Kayak' };

test('T10 the paste: a blank Budget (USD) places a new one-off whose budget is none — the form’s rule handed a blank AMOUNT, the preview’s BUDGET the sheet’s blank, a write to save; a Budget (USD) of 0 is refused by name; the same row pasted over the sheet that holds it lands on its stop, nothing new and nothing to save', () => {
  const paste = pasteOf(KAYAK);
  const [placement] = placedAll(paste, ONE_OFF);
  if (placement.kind !== 'oneOff') return assert.fail(`placed: ${placement.kind}${placement.kind === 'refused' ? ` — ${placement.why}` : ''}`);
  assert.deepEqual([placement.budgetCents, placement.values.amount, placement.values.coa, oneOffBody(placement.values).lines], [null, '', '6200', [{ activity: 'Kayak', budget_amount: '', coa_code: '6200' }]]);
  const [shown] = pasteShown(paste, [placement]);
  assert.equal(shown.sheet[ON_TIME_SHEET_KEYS.indexOf('budget')], BLANK);
  assert.equal(shown.lands, 'a one-off at 15:00, under P-6200 Recreation · not recorded: no Total (USD)');
  assert.deepEqual(pasteWritesOf(paste.rows, [placement]).map((w) => w.kind), ['oneOff']);
  // A Budget (USD) of 0 is no budget typed — refused, in its own words; a Budget above 0 is the stop's budget, as before.
  const [zero] = placedAll(pasteOf({ ...KAYAK, 'Budget (USD)': '$0' }), ONE_OFF);
  assert.deepEqual(zero.kind === 'refused' && [zero.head, zero.why], ['Budget (USD)', ONE_OFF_ZERO_BUDGET_WORDS]);
  const [priced] = placedAll(pasteOf({ ...KAYAK, 'Budget (USD)': '40' }), ONE_OFF);
  assert.deepEqual(priced.kind === 'oneOff' && [priced.budgetCents, priced.values.amount], [4000, '40.00']);
  // Saved, the stop is on the sheet with no budget; the same row pasted again lands on it — no new one-off, nothing to save.
  const instant = at(MON, '15:00');
  const stop: LedgerPlanRow = {
    id: null, key: `line:kayak-line:${instant}`, address: { kind: 'routine_line', id: 'kayak-line', instant }, match: null, day: MON, time: '15:00', place: null, book: 'Personal', location: null,
    segments: { entity: 'P', location: null, category: '6200', type: null, code: 'P-6200' }, coa: { account: 'P-6200', name: 'Recreation' }, vendor: null, instagramTag: null, description: 'Kayak',
    rating: null, note: null, plannedItems: null, notes: null, cents: null, outcome: null, actualCents: null, varianceCents: null, plannedMinutes: null, loggedMinutes: null, allDay: false, went: NOT_RECORDED_WORDS,
  };
  const saved: PasteContext = { ...CONTEXT, sheet: [stop], recording: { [stop.key]: { takes: true, plannedAt: instant, held: null, vendor: { kind: 'none' } } } };
  const again = placedAll(paste, ONE_OFF, saved);
  assert.deepEqual(again[0].kind === 'plan' && [again[0].standing, again[0].stop.key], [true, stop.key]);
  assert.equal(pasteShown(paste, again)[0].sheet[ON_TIME_SHEET_KEYS.indexOf('budget')], BLANK);
  assert.equal(countsWords(again), '1 row read · 0 on a plan · 1 one-off (0 new) · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 0 dates with nothing on them');
  assert.deepEqual(pasteWritesOf(paste.rows, again), []);
});

// ── T11 · WHAT DOES NOT CHANGE (rulings 1.2, 1.4) ────────────────────────────

test('T11 days.ts is as it stood on main — its exports, its length, its skip of a routine with no money; the new builder is pure; no sum, budget line or report figure reads it — the Budget’s report hands its keys to the day plan alone', () => {
  const days = code(DAYS);
  assert.equal(days.replace(/\n$/, '').split('\n').length, 657, 'days.ts keeps its 657 lines');
  assert.deepEqual([...days.matchAll(/^export (?:const|function|class|interface|type) (\w+)/gm)].map((m) => m[1]), [
    'NotPlacedReason', 'NOT_PLACED_REASONS', 'NotPlaced', 'OccurrenceKind', 'OccurrenceAddress', 'OccurrenceOf', 'occurrenceKey', 'wholeRoutineKey', 'readOccurrenceKey', 'BudgetDaysErrorCode',
    'BudgetDaysError', 'isIsoDay', 'within', 'dayWindow', 'ParsedCode', 'parseBudgetCode', 'CentsResult', 'centsFromDecimalString', 'centsFromDollars', 'RoutineLinePlanInput', 'RoutinePlanInput',
    'DayRuleResult', 'RoutineOccurrences', 'routineOccurrencesOf', 'buildRoutineBudgetLines', 'RoutineSupersession', 'routineSupersessionOf', 'TaskStatus', 'BlockStatus', 'PLAN_TASK_STATUSES',
    'EXCLUDED_TASK_STATUSES', 'TaskPlanItemInput', 'TaskPlanInput', 'ExcludedByStatus', 'TaskDayRuleResult', 'buildTaskBudgetLines',
  ]);
  assert.equal(countOf(days, /\n {4}if \(planned\.from === 'none'\) continue;\n/g), 1, 'a routine with no money contributes nothing and lists nothing');
  assert.doesNotMatch(days, /openLines/);
  // The new builder: pure, and holding no figure.
  const open = code(OPEN);
  assert.doesNotMatch(open, /@prisma\/client|from 'next|\bfetch\s*\(|Date\.now\(|new Date\(\s*\)|process\.env/);
  assert.match(open, /open\.push\(\{ entityId: routine\.entityId, code: code\.code, day, source: 'routine', sourceId \}\);/, 'the line it builds holds no cents');
  assert.equal(countOf(open, /\bcents: /g), 2, 'the two not-placed entries say cents null — there is no amount to say');
  assert.equal(countOf(open, /\bcents: null\b/g), 2);
  // Its readers: the vendor route, the report's day plan, the time sheet's answer — and the time sheet's rule its type. The Budget's model reads none of it.
  const readers = ['src/app/api/operations/plan-vendors/route.ts', 'src/lib/budget/reportInputs.ts', 'src/lib/operations/ledgerAnswer.ts', 'src/lib/operations/ledger.ts'];
  for (const file of readers) assert.match(code(file), /from '@\/lib\/budget\/openLines'/, file);
  for (const file of ['src/lib/budget/report.ts', 'src/lib/budget/days.ts', 'src/lib/budget/planLines.ts']) assert.doesNotMatch(code(file), /openLines/, `${file} reads no open line`);
  assert.equal(countOf(code('src/lib/budget/reportInputs.ts'), /buildRoutineOpenLines\(/g), 1, 'the report builds them once — for the day plan’s `open`');
  assert.match(code('src/lib/budget/reportInputs.ts'), /notPlaced: \[\.\.\.routines\.notPlaced, \.\.\.tasks\.notPlaced\], open: buildRoutineOpenLines\(routineInputs, rangeFrom, rangeTo\)\.open,/);
});

// ── T12 · "+ EXPENSE": NO TIME IS A CHARGE ON ITS DATE (ruling 2.1) ──────────

test('T12 “+ expense”: a blank TIME is a stop ALL DAY — a charge on its date, at the day’s start in the zone by ALL_DAY_CLOCK’s own words, ahead read against it; ACTUAL, STARS and ITEMS refused by name before their own reading, ahead or not; its routine named for its day alone; its one-off an all-day routine with no clock, which the create route’s rule takes', () => {
  const charge = expenseInput({ ...DRAFT, time: '' }, NBO, NOW);
  assert.ok(charge.ok);
  assert.deepEqual([charge.value.allDay, charge.value.time, charge.value.instant, charge.value.ahead], [true, '', at(MON, '00:00'), false]);
  assert.equal(clockWords(ALL_DAY_CLOCK), '00:00');
  assert.equal(charge.value.instant, zonedToInstant(MON, clockWords(ALL_DAY_CLOCK), NBO).toISOString(), 'the clock every all-day routine carries');
  assert.deepEqual(expenseInput({ ...DRAFT, time: '   ' }, NBO, NOW), charge, 'spaces are a blank');
  const wednesday = expenseInput({ ...DRAFT, day: WED, time: '' }, NBO, NOW);
  assert.ok(wednesday.ok && wednesday.value.ahead && wednesday.value.instant === at(WED, '00:00'), 'ahead of the clock: planned');
  // A typed TIME is read as before.
  const timed = expenseInput(DRAFT, NBO, NOW);
  assert.ok(timed.ok && !timed.value.allDay && timed.value.time === '12:30' && timed.value.instant === at(MON, '12:30'));
  assert.deepEqual(expenseInput({ ...DRAFT, time: '9:30' }, NBO, NOW), { ok: false, field: 'time', message: timeTypedWords('9:30') });
  // A charge takes no record: each box of the record, typed, refused by name — before its own reading, and before the ahead refusal.
  const boxes: readonly (readonly [Partial<ExpenseDraft>, 'actual' | 'stars' | 'note'])[] = [
    [{ actual: '5' }, 'actual'], [{ actual: 'lots' }, 'actual'], [{ stars: '4' }, 'stars'], [{ stars: '9' }, 'stars'], [{ note: 'by the lake' }, 'note'], [{ note: 'so\u0000up' }, 'note'], [{ actual: '5', stars: '4', note: 'x' }, 'actual'],
  ];
  for (const [over, field] of boxes) {
    for (const day of [MON, WED]) assert.deepEqual(expenseInput({ ...DRAFT, ...over, day, time: '' }, NBO, NOW), { ok: false, field, message: chargeFieldWords(field) }, `${JSON.stringify(over)} on ${day}`);
  }
  assert.equal(chargeFieldWords('actual'), "ACTUAL is the record's, and with no TIME this is a charge on its date — it takes no record; give it a TIME, or leave this blank");
  assert.equal(chargeFieldWords('note'), "ITEMS is the record's, and with no TIME this is a charge on its date — it takes no record; give it a TIME, or leave this blank");
  // The routine's name: its day alone; a timed one keeps its time.
  assert.equal(oneOffRoutineName(charge.value), `Picnic · ${MON}`);
  assert.equal(oneOffRoutineName(timed.value), `Picnic · ${MON} 12:30`);
  // Its one-off: an all-day routine, no clock sent — no hour, no minute, no start or end time; a timed one as before.
  const body = oneOffBody(charge.value);
  assert.deepEqual([body.role, body.byhour, body.byminute, body.start_time, body.end_time, body.name, body.cadence_mode, body.start_date, body.timezone], ['all_day', '', '', '', '', `Picnic · ${MON}`, 'once', MON, NBO]);
  assert.deepEqual(body.lines, [{ activity: 'Picnic', budget_amount: '', coa_code: '6200' }]);
  const timedBody = oneOffBody(timed.value);
  assert.deepEqual([timedBody.role, timedBody.byhour, timedBody.byminute, timedBody.start_time], ['place', '12', '30', '12:30']);
  // The create route's own rule takes it: no time sent, the clock derived; the compile anchors its one occurrence at that clock.
  assert.deepEqual(allDayTimeInput('all_day', body), { ok: true, allDay: true, start_time: '00:00' });
  assert.match(compileFormToRRule({ ...body, start_time: '00:00' }), /^FREQ=DAILY;COUNT=1;/);
  assert.match(compileFormToRRule({ ...body, start_time: '00:00' }), /BYHOUR=0;BYMINUTE=0/);
  // In the source: the instant names the clock's one home — no clock typed in the rule.
  const rule = code('src/lib/operations/ledger.ts');
  assert.match(rule, /const instant = zonedToInstant\(draft\.day, allDay \? clockWords\(ALL_DAY_CLOCK\) : draft\.time, zone\);/);
  assert.doesNotMatch(rule.slice(rule.indexOf('export function expenseInput('), rule.indexOf('export const oneOffBody')), /'00:00'/);
});

// ── T13 · THE FORM (ruling 2.2) ──────────────────────────────────────────────

test('T13 the form: a charge’s record step is not asked — it reads “the record — a charge on its date takes no record”, and the stops route is never called for it; the line the registry cites holds', () => {
  assert.equal(RECORD_CHARGE_WORDS, 'a charge on its date takes no record');
  assert.equal(outcomeWords({ step: 'record', state: 'charge', words: '' }), 'the record — a charge on its date takes no record');
  const form = code('src/components/workbench/operations/ledger/ExpenseForm.tsx');
  assert.match(form, /if \(v\.allDay\) \{\n\s*done\.push\(\{ step: 'record', state: 'charge', words: '' \}\);\n\s*\} else if \(v\.ahead\) \{\n\s*done\.push\(\{ step: 'record', state: 'ahead', words: '' \}\);\n\s*\} else \{/);
  assert.equal(countOf(form, /\bsetStopRecord\(/g), 1, 'one call');
  assert.ok(form.indexOf('setStopRecord(') > form.indexOf('} else if (v.ahead) {'), 'in the branch that asks the record — after the charge and the stop ahead');
  assert.match(form.split('\n')[86], /const created = await createOneOff\(oneOffBody\(v\)\);/, 'ExpenseForm.tsx:87 — the line the registry cites');
});

// ── T14 · THE PASTE: A NEW CHARGE ON ITS DATE (ruling 2.3) ───────────────────

const MUSEUM: Typed = { 'Start Date': '8/9/27', Category: 'Recreation', Entity: 'Personal', Type: 'Museum' };
/** The same row with everything a charge may carry, and the three it takes no box for. */
const MUSEUM_FULL: Typed = { ...MUSEUM, Vendor: 'Gallery One', 'Instagram Tag': 'gallery.one', Items: 'two tickets', Notes: 'free on Mondays', 'Total (USD)': '12', 'End Time': '5:00 PM' };
const CHARGE_SAID = [CHARGE_TOTAL_WORDS, CHARGE_NOTES_WORDS, END_NO_START_WORDS];

test('T14 the paste: a row with no Start Time is a NEW CHARGE on its date — at the day’s start, never went; its Total (USD), Notes and End Time each said; the vendor, the tag and the planned items placed as for a timed row that makes no record; START all day; two of one name on one day refused, naming the first; the save writes it by the steps it has — no record asked', async () => {
  const paste = pasteOf(MUSEUM_FULL);
  const [placement] = placedAll(paste, ONE_OFF);
  if (placement.kind !== 'oneOff') return assert.fail(`placed: ${placement.kind}${placement.kind === 'refused' ? ` — ${placement.head}: ${placement.why}` : ''}`);
  assert.deepEqual([placement.start, placement.end, placement.minutes, placement.values.allDay, placement.values.time, placement.instant, placement.happened, placement.budgetCents], [null, null, null, true, '', at(MON, '00:00'), { kind: 'not recorded' }, null]);
  assert.deepEqual([placement.vendor, placement.tag, placement.items], [{ kind: 'new', name: 'Gallery One' }, { vendorId: null, tag: 'gallery.one' }, 'two tickets']);
  assert.deepEqual(placement.notWritten, CHARGE_SAID);
  assert.deepEqual(CHARGE_SAID, [
    'Total (USD) — not written: the row has no Start Time, so it is a charge on its date — and a charge on a date takes no record',
    'Notes — not written: the row has no Start Time, so it is a charge on its date — notes sit on a record',
    'End Time — not written: the row has no Start Time',
  ]);
  const [shown] = pasteShown(paste, [placement]);
  const cell = (key: (typeof ON_TIME_SHEET_KEYS)[number]): string => shown.sheet[ON_TIME_SHEET_KEYS.indexOf(key)];
  assert.deepEqual([cell('start'), cell('end'), cell('budget')], [ROLE_SHORT_WORDS.all_day, BLANK, BLANK]);
  assert.equal(shown.lands, `${chargeWords('P-6200', 'Recreation')} · vendor: new to Personal · tag: @gallery.one · not recorded: no Total (USD) · items: planned · ${CHARGE_SAID.join(' · ')}`);
  assert.equal(chargeWords('P-6200', 'Recreation'), 'a new charge on its date, all day — no Start Time — under P-6200 Recreation');
  // Still ahead: planned — never went.
  const [ahead] = placedAll(pasteOf({ ...MUSEUM_FULL, 'Start Date': '8/11/27' }), ONE_OFF);
  assert.deepEqual(ahead.kind === 'oneOff' && [ahead.happened, ahead.instant], [{ kind: 'planned' }, at(WED, '00:00')]);
  // No vendor named: its Items said, as a timed row's.
  const [bare] = placedAll(pasteOf({ ...MUSEUM, Items: 'two tickets' }), ONE_OFF);
  assert.deepEqual(bare.kind === 'oneOff' && [bare.items, bare.notWritten], [null, [ITEMS_NO_VENDOR_WORDS]]);
  // Two rows of one name on one day with no Start Time: the second refused on Type, naming the first; a timed one of the name is another stop.
  const twice = placedAll(pasteOf(MUSEUM, { ...MUSEUM, Notes: 'again' }, { ...MUSEUM, 'Start Time': '2:00 PM' }), ONE_OFF);
  assert.deepEqual(twice.map((p) => p.kind), ['oneOff', 'refused', 'oneOff']);
  assert.deepEqual(twice[1].kind === 'refused' && [twice[1].head, twice[1].why], ['Type', chargeTwiceWords(2, 'Museum')]);
  assert.equal(chargeTwiceWords(2, 'Museum'), 'row 2 of the paste is already a new charge named "Museum" on this day — a second one needs a Start Time');
  // The save: the stop, its line, the vendor added and set with its planned items, its tag — no minutes and no record.
  const calls: string[] = [];
  const bodies: unknown[] = [];
  const writers: PasteWriters = {
    createOneOff: async (b) => { calls.push('createOneOff'); bodies.push(b); return { ok: true, value: { routineId: 'rt-1' } }; },
    readOneOffLine: async () => { calls.push('readOneOffLine'); return { ok: true, value: { lineId: 'line-1' } }; },
    setLineMinutes: async () => { calls.push('setLineMinutes'); return { ok: true, value: null }; },
    addVendor: async () => { calls.push('addVendor'); return { ok: true, value: { vendorId: 'v-1' } }; },
    setVendor: async (b) => { calls.push('setVendor'); bodies.push(b); return { ok: true, value: null }; },
    setVendorTag: async () => { calls.push('setVendorTag'); return { ok: true, value: null }; },
    addSubAccount: async () => { calls.push('addSubAccount'); return { ok: true, value: null }; },
    setRecord: async () => { calls.push('setRecord'); return { ok: true }; },
  };
  const outcomes = await runPaste(pasteWritesOf(paste.rows, [placement]), writers, () => undefined, []);
  assert.deepEqual(outcomes, [{ row: 2, state: 'written', steps: ['stop', 'line', 'directory', 'vendor', 'items', 'tag'] }]);
  assert.deepEqual(calls, ['createOneOff', 'readOneOffLine', 'addVendor', 'setVendor', 'setVendorTag']);
  assert.deepEqual([(bodies[0] as { readonly role: string }).role, bodies[1]], ['all_day', { kind: 'routine_line', id: 'line-1', instant: at(MON, '00:00'), vendorId: 'v-1', items: 'two tickets' }]);
});

// ── T15 · A ROW ON A CHARGE THAT STANDS (ruling 2.4) ─────────────────────────

/** A charge on a date as the sheet lists it: an all-day plan row — no time, no WENT, no budget; it takes no record. */
const chargeRow = (over: Partial<LedgerPlanRow> = {}): LedgerPlanRow => {
  const instant = at(over.day ?? MON, '00:00');
  return {
    id: null, key: `line:museum-line:${instant}`, address: { kind: 'routine_line', id: 'museum-line', instant }, match: null, day: MON, time: null, place: null, book: 'Personal', location: null,
    segments: { entity: 'P', location: null, category: '6200', type: null, code: 'P-6200' }, coa: { account: 'P-6200', name: 'Recreation' }, vendor: null, instagramTag: null, description: 'Museum',
    rating: null, note: null, plannedItems: null, notes: null, cents: null, outcome: null, actualCents: null, varianceCents: null, plannedMinutes: null, loggedMinutes: null, allDay: true, went: null, ...over,
  };
};
const onSheet = (rows: readonly LedgerPlanRow[], over: Partial<PasteContext> = {}): PasteContext => ({
  ...CONTEXT, sheet: rows, recording: Object.fromEntries(rows.map((r): [string, LedgerRecording] => [r.key, { takes: false, words: NOT_A_STOP_RECORD_WORDS }])), ...over,
});
const landOn = (context: PasteContext, ...typed: readonly Typed[]) => {
  const paste = pasteOf(...typed);
  const placements = placedAll(paste, ONE_OFF, context);
  return { placements, shown: pasteShown(paste, placements), writes: pasteWritesOf(paste.rows, placements) };
};
const said = (placement: PastePlacement): readonly string[] => (placement.kind === 'plan' || placement.kind === 'oneOff' ? placement.notWritten : assert.fail(`placed: ${placement.kind}`));

test('T15 a row on the charge of its own name that stands — that book, that day, an all-day row of that name — lands on it, at its own instant, never with a record: an earlier row there refuses it; its vendor stands or the row’s is set; its planned items by the four branches; its Total (USD), Notes and End Time said; two of the name refuse it; a plan picked onto it is still refused; a timed row is another stop; the same rows again are nothing new and nothing to save', () => {
  // The charge plans no vendor and prints no items: the row's vendor is set, with its planned items; the rest said.
  const fresh = landOn(onSheet([chargeRow()]), MUSEUM_FULL);
  const on = fresh.placements[0];
  if (on.kind !== 'plan') return assert.fail(`placed: ${on.kind}`);
  assert.deepEqual([on.standing, on.stop.key, on.instant, on.record, on.happened, on.vendor, on.items, on.tag], [true, chargeRow().key, at(MON, '00:00'), null, { kind: 'not recorded' }, { kind: 'new', name: 'Gallery One' }, 'two tickets', { vendorId: null, tag: 'gallery.one' }]);
  assert.deepEqual(on.notWritten, CHARGE_SAID);
  assert.equal(fresh.shown[0].lands, `${onChargeWords('Museum')} · vendor: new to Personal · tag: @gallery.one · not recorded: no Total (USD) · items: planned · ${CHARGE_SAID.join(' · ')}`);
  assert.equal(onChargeWords('Museum'), 'on the charge "Museum", all day, already on the time sheet');
  assert.deepEqual(fresh.writes.map((w) => [w.kind, w.vendor.kind, w.items, w.kind === 'stop' ? w.record : 'one-off']), [['stop', 'new', 'two tickets', null]]);
  assert.equal(countsWords(fresh.placements), '1 row read · 0 on a plan · 1 one-off (0 new) · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 0 dates with nothing on them');
  // An earlier row of the paste on it: the second is refused, naming the first.
  const two = landOn(onSheet([chargeRow()]), MUSEUM, MUSEUM);
  assert.deepEqual(two.placements[1].kind === 'refused' && [two.placements[1].head, two.placements[1].why], ['Type', stopTakenWords(2, 'Museum')]);
  // Its vendor stands: the same name is nothing to write; another is said.
  const vendored = onSheet([chargeRow({ vendor: 'Gallery One' })]);
  const same = landOn(vendored, { ...MUSEUM, Vendor: 'gallery  ONE' }).placements[0];
  assert.deepEqual(same.kind === 'plan' && [same.vendor, same.notWritten], [{ kind: 'none' }, []]);
  assert.deepEqual(said(landOn(vendored, { ...MUSEUM, Vendor: 'Other Hall' }).placements[0]), [vendorNotWrittenWords('Gallery One')]);
  // Its planned items — it prints some: the same quiet, others said.
  const printed = onSheet([chargeRow({ vendor: 'Gallery One', plannedItems: 'two tickets' })]);
  assert.deepEqual(said(landOn(printed, { ...MUSEUM, Items: 'two tickets' }).placements[0]), []);
  assert.deepEqual(said(landOn(printed, { ...MUSEUM, Items: 'three tickets' }).placements[0]), [itemsStandWords('two tickets')]);
  // …it prints none and plans no vendor: the row names none — said.
  assert.deepEqual(said(landOn(onSheet([chargeRow()]), { ...MUSEUM, Items: 'two tickets' }).placements[0]), [ITEMS_NO_VENDOR_WORDS]);
  // …it prints none and its vendor stands: another vendor named — the Items’ sentence, then the vendor’s; none or the same — the charge stands with its own.
  assert.deepEqual(said(landOn(vendored, { ...MUSEUM, Vendor: 'Other Hall', Items: 'two tickets' }).placements[0]), [ITEMS_OTHER_VENDOR_WORDS, vendorNotWrittenWords('Gallery One')]);
  assert.deepEqual(said(landOn(vendored, { ...MUSEUM, Items: 'two tickets' }).placements[0]), [ITEMS_CHARGE_STANDS_WORDS]);
  assert.deepEqual(said(landOn(vendored, { ...MUSEUM, Vendor: 'Gallery One', Items: 'two tickets' }).placements[0]), [ITEMS_CHARGE_STANDS_WORDS]);
  assert.equal(ITEMS_CHARGE_STANDS_WORDS, 'Items — not written: this charge already stands with its vendor');
  // Ahead of the clock: planned — never went.
  const wed = landOn(onSheet([chargeRow({ day: WED })]), { ...MUSEUM, 'Start Date': '8/11/27' }).placements[0];
  assert.deepEqual(wed.kind === 'plan' && [wed.happened, wed.instant], [{ kind: 'planned' }, at(WED, '00:00')]);
  // Two charges of the name that day: the paste cannot tell which.
  const doubled = landOn(onSheet([chargeRow(), chargeRow({ key: 'line:museum-two', address: { kind: 'routine_line', id: 'museum-two', instant: at(MON, '00:00') } })]), MUSEUM).placements[0];
  assert.deepEqual(doubled.kind === 'refused' && [doubled.head, doubled.why], ['Type', manyNamedWords('Museum')]);
  // A plan picked onto the charge is still refused, in its own words — only the row's own name takes it.
  const asPlan = placePaste(pasteOf(MUSEUM), { [kindKeyOf({ entity: 'Personal', category: 'Recreation', type: 'Museum' })]: { kind: 'plan', plan: 'Museum' } }, onSheet([chargeRow()]))[0];
  assert.deepEqual(asPlan.kind === 'refused' && [asPlan.head, asPlan.why], ['Type', NOT_A_STOP_RECORD_WORDS]);
  // A timed row of the name is another stop: a new one-off.
  assert.equal(landOn(onSheet([chargeRow()]), { ...MUSEUM, 'Start Time': '10:00 AM' }).placements[0].kind, 'oneOff');
  // THE SAME ROWS AGAIN, over the sheet and the directory that hold what the save wrote: on the charge, nothing new, nothing to save — what it takes no box for still said.
  const saved = onSheet([chargeRow({ vendor: 'Gallery One', plannedItems: 'two tickets' })], { vendors: [{ id: 'v-gallery', vendor_name: 'Gallery One', entity_id: 'P', instagram_tag: 'gallery.one' }] });
  const again = landOn(saved, MUSEUM_FULL);
  assert.deepEqual(again.placements[0].kind === 'plan' && [again.placements[0].vendor, again.placements[0].items, again.placements[0].tag, again.placements[0].notWritten], [{ kind: 'none' }, null, null, CHARGE_SAID]);
  assert.deepEqual(again.writes, []);
  assert.equal(countsWords(again.placements), '1 row read · 0 on a plan · 1 one-off (0 new) · 0 bookings · 0 waiting for a pick · 0 that cannot be placed · 0 dates with nothing on them');
});
