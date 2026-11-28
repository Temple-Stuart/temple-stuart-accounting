/**
 * EDIT-04 (Alex, 2026-11-29) — ENTITY PICKS THE CATEGORY IN THE NEW BOOK: no account number carries over by itself. Two books may give one
 * number to two different accounts; EDIT-03's move kept the number, and the account's meaning changed with nothing said before the save.
 *
 * PART 1 — the book move takes the account picked in the new book, read by the money rule for that book (src/lib/operations/bookMove.ts;
 * routines/[id]/route.ts PATCH, the move path). PART 2 — ENTITY's box lists each other book's accounts (EntityAccountSelect.tsx; ledger.ts entityPickOf,
 * the reach), and Expenses' edit form says where a book is moved. Each part's tests land in the commit that builds it.
 *
 * HERMETIC, on edit03.test.ts's model — no database, no network, no clock. The rules are DRIVEN directly over made-up plans and made-up charts
 * in which one number means two different accounts in two books; the route is anchored to its source with comments stripped (the reader law).
 * Every plan, vendor, book, chart, account and amount below is invented. No pin here names a line number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code } from '../sourceText';
import { buildRoutineBudgetLines, type RoutinePlanInput } from '../budget/days';
import type { RoutineWords } from '../budget/planLines';
import { isOnceRRule } from '../operations/rruleHelpers';
import {
  ENTITY_ACCOUNT_REACH_WORDS, ENTITY_CHART_EMPTY_WORDS, ENTITY_CHART_READING_WORDS, ENTITY_CHART_UNREAD_WORDS, ENTITY_VENDOR_REACH_WORDS, REPEATING_REACH_WORDS,
  boxTextOf, cellReachWords, entityPickOf, entityPickValue, ledgerOf, planCellWrite, planMinutesOf, routineClocksOf, type LedgerEditingPlan,
} from '../operations/ledger';
import ColumnBox from '../../components/workbench/operations/ledger/ColumnBox';
import { BOOK_FIXED_WORDS } from '../../components/workbench/operations/routines/RoutineEditForm';
import { planMoney, type PlanBook } from '../operations/planMoney';
import { MOVE_ACCOUNTS_MANY_WORDS, MOVE_NO_ACCOUNT_WORDS, MOVE_PICK_ACCOUNT_WORDS } from '../operations/linkHold';
import { bookMove, moveMoneyOf, planAccounts, type BookMoveInput, type BookMovePlan, type BookMoveVendor } from '../operations/bookMove';

Object.assign(globalThis, { React }); // PART 2 draws ENTITY's box — its JSX reads React as a global under tsx (edit01.test.ts's way)

const ROUTINE_ROUTE = 'src/app/api/operations/routines/[id]/route.ts';
const BOOK_MOVE = 'src/lib/operations/bookMove.ts';
const HOLD = 'src/lib/operations/linkHold.ts';

/** A handler's body in a route's source: from its export to the next export. */
const bodyOf = (src: string, verb: string): string => {
  const at = src.indexOf(`export async function ${verb}(`);
  if (at < 0) return assert.fail(`no ${verb} in the route`);
  const next = src.indexOf('\nexport async function ', at + 1);
  return src.slice(at, next < 0 ? undefined : next);
};
/** Each step found after the one before it. */
const inOrder = (text: string, steps: readonly string[], what: string): void => {
  let from = 0;
  for (const step of steps) {
    const i = text.indexOf(step, from);
    assert.notEqual(i, -1, `${what}: ${JSON.stringify(step)} comes after the step before it`);
    from = i + step.length;
  }
};

// ── THE FIXTURE — made-up books and charts: one number, two different accounts ──

/** The business book, as the money rule reads it: its chart saves some codes bare and some lettered; 6100 here is not the personal book's 6100. */
const BUSINESS: PlanBook = {
  id: 'B', name: 'Harbor Works', entityType: 'sole_prop', chart: [
    { code: '6100', name: 'Shop Lease', account_type: 'expense', is_archived: false },
    { code: 'B-6150', name: 'Client Meals', account_type: 'expense', is_archived: false },
    { code: '6230', name: 'Old Fees', account_type: 'expense', is_archived: true },
    { code: '1000', name: 'Till', account_type: 'asset', is_archived: false },
  ],
};
const HARBOR_P: BookMoveVendor = { id: 'v-harbor-p', vendor_name: 'Harbor Cafe', instagram_tag: 'harbor.cafe' };
/** Lunch at Harbor Cafe on the personal book: its line carries the personal book's 6100 (there, a pantry account) and 15.00. */
const LUNCH: BookMoveInput = {
  routine: { coa_code: null, budget_amount: null },
  lines: [{ id: 'lunch-line', coa_code: '6100', budget_amount: '15.00' }],
  vendorRows: [{ id: 'pv-lunch', vendor_id: 'v-harbor-p', vendor: HARBOR_P }],
  source: { entityType: 'personal' },
  target: { word: 'Business', book: BUSINESS, vendors: [] },
  picked: null,
  counts: { links: 0, coded: 0, otherBook: 0 },
};
const lunchWith = (over: Partial<BookMoveInput>): BookMoveInput => ({ ...LUNCH, ...over });
const refusal = (plan: BookMovePlan): { readonly status: number; readonly field: string; readonly words: string } => (plan.ok ? assert.fail('it moved') : { status: plan.status, field: plan.field, words: plan.words });
const moved = (plan: BookMovePlan) => (plan.ok ? plan : assert.fail(`refused: ${plan.words}`));
/** The money rule's own words for a pick, a row's amount and its column — what the move must say, unchanged. */
const ruleWords = (picked: string, amount: string | null, column: 'routine' | 'line'): string => {
  const read = planMoney({ amount, account: picked }, BUSINESS, column, { amount: 'budget_amount', account: 'coa_code' });
  return 'error' in read ? read.error.message : assert.fail(`the rule took ${picked}`);
};

// ── PART 1 — THE MOVE TAKES THE ACCOUNT PICKED (the HARD GATE) ───────────────

// ── Z1 · A PLAN WITH NO ACCOUNT (ruling 1.2, none) ──

test('Z1 a plan with no CATEGORY: a CATEGORY sent is refused by name (400, on coa_code), nothing moved; none sent — or a blank one — moves as EDIT-03 built it, the book alone', () => {
  assert.equal(MOVE_NO_ACCOUNT_WORDS, 'this plan has no CATEGORY — pick the book alone');
  const none = lunchWith({ lines: [{ id: 'lunch-line', coa_code: null, budget_amount: null }, { id: 'lunch-old-line', coa_code: ' ', budget_amount: null }] });
  assert.deepEqual(refusal(bookMove({ ...none, picked: 'B-6150' })), { status: 400, field: 'coa_code', words: MOVE_NO_ACCOUNT_WORDS });
  for (const picked of [null, '', '   ']) {
    const plan = moved(bookMove({ ...none, picked }));
    assert.equal(plan.money, null, `picked ${JSON.stringify(picked)}: no account to write`);
    assert.deepEqual(plan.lines, ['lunch-line', 'lunch-old-line'], 'every line takes the book');
    assert.deepEqual(plan.adds.map((a) => a.source.vendor_name), ['Harbor Cafe'], 'the vendor goes with it, as EDIT-03 moved it');
  }
  assert.deepEqual(planAccounts(none), [], 'no code, and a blank one, is no account');
});

// ── Z2 · A PLAN WITH ONE ACCOUNT — THE ONE PICKED (ruling 1.2, one) ──

test('Z2 a plan with one CATEGORY: none picked is refused by name (400); the CATEGORY picked is read by the money rule for the new book and its answer — the code as that chart saves it — is written on the routine and each line that carried the account, a line with none taking the book alone; "6150" and "P-6150" are one account; a number never carries over by itself', () => {
  assert.equal(MOVE_PICK_ACCOUNT_WORDS('Business'), "pick its CATEGORY in Business — the list under ENTITY holds that book's accounts");
  // None picked — refused, whatever the number.
  assert.deepEqual(refusal(bookMove(LUNCH)), { status: 400, field: 'coa_code', words: MOVE_PICK_ACCOUNT_WORDS('Business') });
  assert.deepEqual(refusal(bookMove(lunchWith({ picked: '  ' }))), { status: 400, field: 'coa_code', words: MOVE_PICK_ACCOUNT_WORDS('Business') }, 'a blank pick is none');
  // The personal 6100 lands where it is picked — the business book's own 6100 is another account, written only when picked.
  const meals = moved(bookMove(lunchWith({ picked: '6150' })));
  assert.deepEqual(meals.money, { from: '6100', coaCode: 'B-6150', routine: false, lines: ['lunch-line'] }, 'the code as the target chart saves it (B-6150), read from a bare pick');
  assert.deepEqual(moved(bookMove(lunchWith({ picked: 'b-6150' }))).money?.coaCode, 'B-6150', 'the book’s letter, any case');
  assert.deepEqual(moved(bookMove(lunchWith({ picked: '6100' }))).money, { from: '6100', coaCode: '6100', routine: false, lines: ['lunch-line'] }, 'picked: the business book’s own 6100 — its Shop Lease');
  // The routine's own account and its lines': written on each that carried it; a line with none, the book alone.
  const gym: BookMoveInput = lunchWith({
    routine: { coa_code: 'P-6100', budget_amount: '20.00' },
    lines: [{ id: 'gym-line', coa_code: '6100', budget_amount: null }, { id: 'gym-towel-line', coa_code: null, budget_amount: '2.00' }, { id: 'gym-old-line', coa_code: 'p-6100', budget_amount: '5.00' }],
    picked: 'B-6150',
  });
  assert.deepEqual(planAccounts(gym), [{ key: '6100', code: 'P-6100', routine: true, lines: ['gym-line', 'gym-old-line'] }], '"P-6100", "6100" and "p-6100" are one account by the personal book’s rule');
  const plan = moved(bookMove(gym));
  assert.deepEqual(plan.money, { from: 'P-6100', coaCode: 'B-6150', routine: true, lines: ['gym-line', 'gym-old-line'] }, 'the routine and the two lines that carried it — not the towel line');
  assert.deepEqual(plan.lines, ['gym-line', 'gym-towel-line', 'gym-old-line'], 'every line takes the book');
  // A line's account with no amount stands (the pair bends for a line alone).
  assert.equal(moved(bookMove(lunchWith({ lines: [{ id: 'lunch-line', coa_code: '6100', budget_amount: null }], picked: '6150' }))).money?.coaCode, 'B-6150');
});

// ── Z3 · A PICK THE MONEY RULE REFUSES (ruling 1.2, one) ──

test('Z3 a CATEGORY picked that the money rule refuses for the new book is refused in the rule’s own words — 400 on coa_code, nothing moved: another book’s letter, an archived account, an account of the wrong type, an account the chart does not hold, and the routine’s account with no amount', () => {
  for (const [why, picked, amount] of [
    ['another book’s letter', 'P-6150', '15.00'],
    ['an archived account', '6230', '15.00'],
    ['an account of the wrong type', '1000', '15.00'],
    ['an account the chart does not hold', '7400', '15.00'],
  ] as const) {
    assert.deepEqual(refusal(bookMove(lunchWith({ picked }))), { status: 400, field: 'coa_code', words: ruleWords(picked, amount, 'line') }, why);
  }
  assert.match(ruleWords('P-6150', '15.00', 'line'), /^code P-6150 carries the P- letter; this is a B- chart \(sole_prop\)/, 'the chart’s own words');
  assert.match(ruleWords('6230', '15.00', 'line'), /is archived in Harbor Works's chart — choose an open account$/);
  assert.match(ruleWords('1000', '15.00', 'line'), /is an asset account — a plan's money goes on an income or expense account$/);
  // The routine carries the account and no amount: an account needs its amount — the rule's refusal, the routine's column.
  const noAmount = lunchWith({ routine: { coa_code: '6100', budget_amount: null }, lines: [], picked: '6150' });
  assert.deepEqual(refusal(bookMove(noAmount)), { status: 400, field: 'coa_code', words: 'an account needs its amount — enter the amount, or clear the account' });
  // Refused: no account to write, no vendor to add — the plan returns the refusal alone.
  assert.equal(moveMoneyOf(lunchWith({ picked: '6230' })).ok, false);
});

// ── Z4 · A PLAN WITH TWO OR MORE ACCOUNTS (ruling 1.2, two or more) ──

test('Z4 a plan whose routine and lines carry two or more CATEGORYs is refused by name — 409, the codes as stored, the routine’s first, each account once — whatever is picked; nothing moved', () => {
  assert.equal(MOVE_ACCOUNTS_MANY_WORDS(['6150', '7400']), "this plan's lines carry 6150 and 7400 — give them one CATEGORY, then move it");
  const two = lunchWith({ lines: [{ id: 'a', coa_code: '6150', budget_amount: '4.00' }, { id: 'b', coa_code: '7400', budget_amount: '9.00' }, { id: 'c', coa_code: 'P-6150', budget_amount: null }] });
  for (const picked of [null, '6150']) assert.deepEqual(refusal(bookMove({ ...two, picked })), { status: 409, field: 'coa_code', words: MOVE_ACCOUNTS_MANY_WORDS(['6150', '7400']) }, `picked ${picked}`);
  const three = lunchWith({ routine: { coa_code: '6300', budget_amount: '1.00' }, lines: [{ id: 'a', coa_code: '6150', budget_amount: null }, { id: 'b', coa_code: '7400', budget_amount: null }] });
  assert.equal(refusal(bookMove(three)).words, "this plan's lines carry 6300 and 6150 and 7400 — give them one CATEGORY, then move it");
});

// ── Z5 · THE MOVE'S ORDER, AND THE ROUTE READ AS TEXT (rulings 1.1, 1.2, 1.3) ──

test('Z5 the account is decided where (c) stood — after the Books links and lines, before the other records and the vendors; the routines PATCH admits the CATEGORY beside the book, reads the plan’s own book beside the target, reads the target with the money rule’s loader inside the one transaction before any write, writes the rule’s answer beside the book, and names the account in the audit and the answer', () => {
  // The order: (a), (b), the account, (d), (e).
  const twice = [{ id: 'x', vendor_name: 'Harbor Cafe' }, { id: 'y', vendor_name: 'harbor  cafe' }];
  const all = lunchWith({ target: { word: 'Business', book: BUSINESS, vendors: twice } });
  assert.equal(refusal(bookMove({ ...all, counts: { links: 1, coded: 1, otherBook: 1 } })).status, 409, '(a) first');
  assert.equal(refusal(bookMove({ ...all, counts: { links: 0, coded: 1, otherBook: 1 } })).words.startsWith('this plan is coded on 1 line in Books'), true, '(b) before the account');
  assert.equal(refusal(bookMove({ ...all, counts: { links: 0, coded: 0, otherBook: 1 } })).words, MOVE_PICK_ACCOUNT_WORDS('Business'), 'the account before (d)');
  assert.equal(refusal(bookMove({ ...all, picked: '6150', counts: { links: 0, coded: 0, otherBook: 1 } })).words.endsWith('keeps its book; nothing was moved'), true, '(d) once the account reads');
  assert.equal(refusal(bookMove({ ...all, picked: '6150' })).words, 'Business holds two vendors named "Harbor Cafe" — nothing was moved', '(e) last');
  // (c) is gone — no code carries over by its number.
  const rule = code(BOOK_MOVE);
  assert.doesNotMatch(rule, /codesNotHeld|MOVE_ACCOUNTS_MISSING_WORDS/, 'the number alone decides nothing');
  assert.doesNotMatch(code(HOLD), /MOVE_ACCOUNTS_MISSING_WORDS/);
  inOrder(rule, ['if (counts.links > 0)', 'if (counts.coded > 0)', 'const account = moveMoneyOf(input);', 'if (!account.ok) return account;', 'if (counts.otherBook > 0)', 'MOVE_VENDOR_NAME_TWICE_WORDS(target.word'], 'bookMove');
  inOrder(rule, ["const sent = editedPlanMoney(undefined, picked, { amount: carrier.stored.budget_amount, account: carrier.stored.coa_code });", "const read = planMoney(sent, input.target.book, carrier.column, { amount: 'budget_amount', account: 'coa_code' });", "if ('error' in read) return refused(400, 'coa_code', read.error.message);", 'coaCode = read.value.coaCode;'], 'the money rule, each carrying row’s own amount as stored');
  // The route.
  const patch = bodyOf(code(ROUTINE_ROUTE), 'PATCH');
  inOrder(patch, [
    "const existing = await loadAuthorizedRoutine(id, user.id);", "if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });",
    "if ('entity_id' in body) {",
    "if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });",
    "if (Object.keys(body).some((key) => key !== 'entity_id' && key !== 'coa_code')) {",
    "return NextResponse.json({ error: 'Validation', field: 'entity_id', message: ENTITY_MOVES_ALONE_WORDS }, { status: 400 });",
    "const source = await prisma.entities.findFirst({ where: { id: existing.entity_id, userId: user.id }, select: { entity_type: true } });",
    "if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });",
    "const picked = typeof body.coa_code === 'string' ? body.coa_code.trim() : null;",
    'const move = () => prisma.$transaction(async (tx) => {',
    "const lines = await tx.operations_routine_steps.findMany({ where: { routine_id: id, user_id: user.id }, select: { id: true, coa_code: true, budget_amount: true }, orderBy: { step_order: 'asc' } });",
    'const targetBook = await loadPlanBook(tx, user.id, target.id);',
    "if (!targetBook) throw new MoveRefused(404, 'entity_id', 'Not found');",
    'const plan = bookMove({ routine: existing, lines, vendorRows, source: { entityType: source.entity_type }, target: { word, book: targetBook, vendors: held }, picked, counts: { links: linked, coded, otherBook: scheduled + scenes } });',
    'if (!plan.ok) throw new MoveRefused(plan.status, plan.field, plan.words);',
    'const money = plan.money;',
    'await tx.operations_routine_steps.updateMany({ where: { id: { in: plan.lines.filter((l) => !carried.has(l)) }, user_id: user.id }, data: { entity_id: target.id } });',
    'if (money !== null && money.lines.length > 0) await tx.operations_routine_steps.updateMany({ where: { id: { in: [...money.lines] }, user_id: user.id }, data: { entity_id: target.id, coa_code: money.coaCode } });',
    'const routine = await tx.operations_routines.update({ where: { id }, data: money !== null && money.routine ? { entity_id: target.id, coa_code: money.coaCode } : { entity_id: target.id } });',
    'account: money === null ? null : { from: money.from, to: money.coaCode } };',
    '}, { timeout: 60000 });',
    "if (error instanceof MoveRefused) return NextResponse.json({ error: error.status === 409 ? 'Conflict' : error.status === 404 ? 'Not found' : 'Validation', field: error.field, message: error.words }, { status: error.status });",
    'metadata: { book: { from: existing.entity_id, to: target.id }, lines_moved: moved.lines, account: moved.account } },',
    'vendors_added: moved.added.map((v) => v.vendor_name), account: moved.account } });',
  ], 'the routines PATCH');
  // Every read and check before the first write; the account written only from the rule's answer.
  const tx = patch.slice(patch.indexOf('const move = () => prisma.$transaction(async (tx) => {'), patch.indexOf('}, { timeout: 60000 });', patch.indexOf('const move = () => prisma.$transaction(')));
  const firstWrite = tx.search(/\.(create|update|updateMany|upsert|delete|deleteMany)\(/);
  assert.ok(tx.indexOf('const targetBook = await loadPlanBook(tx, user.id, target.id);') < firstWrite && tx.indexOf('if (!plan.ok) throw new MoveRefused(plan.status, plan.field, plan.words);') < firstWrite, 'the target book and every check before the first write');
  assert.deepEqual(tx.match(/coa_code: [^,}\s]+/g), ['coa_code: true', 'coa_code: money.coaCode', 'coa_code: money.coaCode'], 'coa_code read, then written only as the money rule answered it');
  assert.doesNotMatch(patch, /coa_code: (picked|body\.coa_code)/, 'never the code as sent');
});

// ── PART 2 — THE ENTITY BOX LISTS EACH BOOK'S ACCOUNTS ───────────────────────

const ENTITY_SELECT = 'src/components/workbench/operations/ledger/EntityAccountSelect.tsx';
const BOX = 'src/components/workbench/operations/ledger/ColumnBox.tsx';
const SECTION = 'src/components/workbench/operations/ledger/LedgerSection.tsx';
const EDIT_FORM = 'src/components/workbench/operations/routines/RoutineEditForm.tsx';
const noop = (): void => undefined;
const drawBox = (props: Parameters<typeof ColumnBox>[0]): string => renderToStaticMarkup(createElement(ColumnBox, props));
const BOOKS = [
  { id: 'P', name: 'Home', entity_type: 'personal', is_default: true },
  { id: 'B', name: 'Harbor Works', entity_type: 'sole_prop', is_default: false },
  { id: 'T', name: 'Desk', entity_type: 'trading', is_default: false },
];
/** Lunch at Harbor Cafe, a one-off on the personal book, its line on 6150 — the row's entry as the sheet builds it (made up). */
const NBO = 'Africa/Nairobi';
const THU = '2027-03-04';
const LUNCH_ROUTINE: RoutinePlanInput = {
  id: 'lunch', name: 'Lunch · 2027-03-04 12:00', scheduleRrule: 'FREQ=DAILY;COUNT=1;BYHOUR=12;BYMINUTE=0', entityId: 'P', entityType: 'personal', timezone: NBO, startDate: THU, endDate: THU,
  budgetAmount: null, coaCode: null, steps: [{ id: 'lunch-line', stepOrder: 1, budgetAmount: 15, coaCode: '6150', durationMinutes: 45, timeOfDay: null }], startTime: '1970-01-01T12:00:00.000Z', endTime: null, role: 'place',
};
const lunchLedger = ledgerOf({
  from: THU, to: THU, now: new Date('2027-03-04T15:00:00.000Z'), records: [], links: [], lines: buildRoutineBudgetLines([LUNCH_ROUTINE], THU, THU).lines, open: [], notPlaced: [],
  routines: new Map<string, RoutineWords>([['lunch', { name: LUNCH_ROUTINE.name, timezone: NBO, steps: new Map([['lunch-line', { activity: 'Lunch', timeOfDay: null }]]) }]]), roles: new Map([['lunch', 'place']]),
  locations: new Map([['lunch', null]]), once: new Map([['lunch', isOnceRRule(LUNCH_ROUTINE.scheduleRrule)]]), clocks: routineClocksOf([LUNCH_ROUTINE]), subAccounts: [], minutes: planMinutesOf([LUNCH_ROUTINE]),
  vendors: [{ id: 'pv-lunch', routine_id: null, step_id: 'lunch-line', task_id: null, occurrence_at: new Date('2027-03-04T09:00:00.000Z'), items: null, vendor: { id: 'v-harbor', vendor_name: 'Harbor Cafe', entity_id: 'P', instagram_tag: null }, routine: null, step: { activity: 'Lunch', routine_id: 'lunch', routine: { name: LUNCH_ROUTINE.name, timezone: NBO } }, task: null }],
  stays: [], accounts: [{ entityId: 'P', code: '6150', name: 'Dining Out' }], books: [{ id: 'P', entityType: 'personal' }],
});
const lunchRow = lunchLedger.sheet.find((r) => r.description === 'Lunch' && r.id === null) ?? assert.fail('no Lunch row');
const lunchEntry = ((): LedgerEditingPlan => { const e = lunchLedger.editing[lunchRow.key]; return e.plan ? e : assert.fail('Lunch has no plan'); })();

// ── Z6 · THE PICK'S VALUE AND ITS ONE READER; THE CELL'S BODY (rulings 2.1, 2.3) ──

test('Z6 an ENTITY pick names the book and the CATEGORY, read back by ONE function: a book alone is its id (the value the box opens with), a book and a code the id, a colon and the code; the cell sends { entity_id } or { entity_id, coa_code }', () => {
  assert.equal(entityPickValue('B', null), 'B');
  assert.equal(entityPickValue('B', 'B-6150'), 'B:B-6150');
  assert.deepEqual(entityPickOf('B'), { entityId: 'B', code: null }, 'a book alone');
  assert.deepEqual(entityPickOf('B:B-6150'), { entityId: 'B', code: 'B-6150' }, 'a book and a code');
  assert.deepEqual(entityPickOf('B:x:y'), { entityId: 'B', code: 'x:y' }, 'a code read whole after the first colon');
  for (const [id, c] of [['P', null], ['T', '5100'], ['B', 'B-6150']] as const) assert.deepEqual(entityPickOf(entityPickValue(id, c)), { entityId: id, code: c }, 'both ways');
  assert.equal(boxTextOf(lunchRow, 'book', lunchEntry), 'P', 'the box opens on the row’s own book — a book alone');
  // The cell's body.
  assert.deepEqual(planCellWrite(lunchRow, lunchEntry, 'book', 'B:B-6150'), { ok: true, write: { to: 'routine', routineId: 'lunch', body: { entity_id: 'B', coa_code: 'B-6150' } } });
  assert.deepEqual(planCellWrite(lunchRow, lunchEntry, 'book', 'B'), { ok: true, write: { to: 'routine', routineId: 'lunch', body: { entity_id: 'B' } } }, 'a book alone — the route refuses it for a plan with a CATEGORY, by name');
});

// ── Z7 · THE REACH (ruling 2.4) ──

test('Z7 ENTITY’s line says its reach, then — on a row with a vendor — that the vendor goes with it, then — on a row with a CATEGORY — that its CATEGORY is picked in that book; the entry’s CATEGORY is the one CATEGORY’s box opens with', () => {
  assert.equal(ENTITY_ACCOUNT_REACH_WORDS, ' — its CATEGORY is picked in that book');
  assert.equal(lunchEntry.category, '6150');
  assert.equal(lunchEntry.category, boxTextOf(lunchRow, 'accountName', lunchEntry), 'in lockstep with the box ENTITY is handed');
  const vendorless: LedgerEditingPlan = { ...lunchEntry, vendor: null };
  const uncoded: LedgerEditingPlan = { ...lunchEntry, category: '' };
  assert.equal(cellReachWords('book', lunchEntry, THU), `this row${ENTITY_VENDOR_REACH_WORDS}${ENTITY_ACCOUNT_REACH_WORDS}`, 'a vendor and a CATEGORY');
  assert.equal(cellReachWords('book', vendorless, THU), `this row${ENTITY_ACCOUNT_REACH_WORDS}`, 'a CATEGORY, no vendor');
  assert.equal(cellReachWords('book', uncoded, THU), `this row${ENTITY_VENDOR_REACH_WORDS}`, 'a vendor, no CATEGORY');
  assert.equal(cellReachWords('book', { ...uncoded, vendor: null }, THU), 'this row', 'neither');
  assert.equal(cellReachWords('book', { ...lunchEntry, once: false, routineName: 'Morning Gym' }, THU), `${REPEATING_REACH_WORDS('Morning Gym')}${ENTITY_VENDOR_REACH_WORDS}${ENTITY_ACCOUNT_REACH_WORDS}`, 'a repeating plan: every row of it');
  assert.equal(cellReachWords('book', { plan: false, words: 'no plan', trip: null }, THU), 'this row', 'a row with no plan, as EDIT-02 ruled');
  assert.equal(cellReachWords('accountName', lunchEntry, THU), 'this row', 'the other cells’ reach unchanged');
});

// ── Z8 · THE BOX, READ AS TEXT AND DRAWN (ruling 2.1) ──

test('Z8 EntityAccountSelect is ONE select: the row’s own book first by its sheet word, then a group per other book under its sheet word holding that book’s chart as CATEGORY’s box reads it, each option naming the book and the code; a group is never empty — a chart being read, read and empty, or unread, each said', () => {
  assert.equal(ENTITY_CHART_UNREAD_WORDS('Business'), "Business's chart could not be read — reload to move this row there");
  assert.equal(ENTITY_CHART_READING_WORDS('Business'), "reading Business's chart…");
  assert.equal(ENTITY_CHART_EMPTY_WORDS('Business'), "Business's chart holds no open account — add one in Books to move this row there");
  const box = code(ENTITY_SELECT);
  // The chart read as CATEGORY's box reads it — and a failed read, or an answer that is not a list, is the read's failure, said.
  assert.ok(box.includes('fetch(`/api/chart-of-accounts?entity_id=${encodeURIComponent(entityId)}`)'), 'CoaSelect’s own read');
  inOrder(box, ["if (!res.ok) throw new Error(`the chart route answered ${res.status}`);", "if (!Array.isArray(body.accounts)) throw new Error('the chart route answered no list of accounts');"], 'an answer that is not one is no chart');
  inOrder(box, ["(accounts) => { if (!cancelled) setCharts((held) => ({ ...held, [id]: { kind: 'read', accounts } })); },", "() => { if (!cancelled) setCharts((held) => ({ ...held, [id]: { kind: 'unread' } })); },"], 'read, or unread — never answered as none');
  assert.doesNotMatch(box, /accounts: \[\] \}|setAccounts\(\[\]\)/, 'CoaSelect’s silence is not copied');
  // The options: the row's own book, then each other book's group of "CODE — Name", each naming the book and the code.
  inOrder(box, ['<option value={entityPickValue(own, null)}>{wordOf(ownBook)}</option>', '<optgroup key={book.id} label={word} data-ledger-entity-book={book.id}>', 'ENTITY_CHART_READING_WORDS(word)', 'ENTITY_CHART_UNREAD_WORDS(word)', 'ENTITY_CHART_EMPTY_WORDS(word)', '<option key={a.code} value={entityPickValue(book.id, a.code)}>{`${a.code} — ${a.name}`}</option>'], 'the select');
  // Drawn by ColumnBox with the row's code: the first paint — the own book, then each other book's group, being read.
  const drawn = drawBox({ column: 'book', value: 'P', onChange: noop, books: BOOKS, code: '6150' });
  assert.match(drawn, /^<select aria-label="ENTITY" class="[^"]+" data-ledger-expense-box="book" data-ledger-entity-accounts="true">/);
  assert.ok(drawn.includes('<option value="P" selected="">Personal</option>'), 'the row’s own book first, by its sheet word, the value');
  assert.ok(drawn.indexOf('<optgroup label="Business" data-ledger-entity-book="B"><option value="" disabled="">reading Business&#x27;s chart…</option></optgroup>') > drawn.indexOf('Personal</option>'), 'Business’s group, its chart being read — never empty');
  assert.ok(drawn.includes('<optgroup label="Trading" data-ledger-entity-book="T"><option value="" disabled="">reading Trading&#x27;s chart…</option></optgroup>'));
  assert.equal((drawn.match(/<optgroup /g) ?? []).length, 2, 'a group for each OTHER book');
  assert.throws(() => drawBox({ column: 'book', value: 'nowhere', onChange: noop, books: BOOKS, code: '6150' }), /^Error: EntityAccountSelect: the row's book nowhere is not one of the books handed in$/);
});

// ── Z9 · COLUMNBOX DRAWS IT ONLY WITH A CODE; THE SECTION HANDS THE CODE (rulings 2.1, 2.2) ──

test('Z9 ColumnBox draws the accounts box only when handed the row’s code — with none (the blank row, a row with no CATEGORY) the books, as before; the section hands ENTITY’s box the row’s CATEGORY beside the books', () => {
  const books = drawBox({ column: 'book', value: 'P', onChange: noop, books: BOOKS });
  assert.equal(books, '<select aria-label="ENTITY" class="w-full min-w-[3.5rem] px-1 py-0.5 border border-border rounded text-xs bg-white" data-ledger-expense-box="book"><option value="P" selected="">Personal</option><option value="B">Business</option><option value="T">Trading</option></select>', 'the books, as the blank row draws them');
  assert.equal(drawBox({ column: 'book', value: 'P', onChange: noop, books: BOOKS, code: '' }), books, 'a row with no CATEGORY: the books');
  assert.ok(code(BOX).includes("if (code !== undefined && code !== '') return <EntityAccountSelect books={books} value={value} onChange={onChange} wordOf={bookWords} className={box} {...keys} />;"));
  assert.ok(code(SECTION).includes("if (column === 'book') return { books: entities, code: boxTextOf(row, 'accountName', editing[row.key]) };"), 'the row’s CATEGORY, as CATEGORY’s box opens with it');
});

// ── Z10 · EXPENSES' EDIT FORM SAYS WHERE A BOOK IS MOVED (ruling 2.5) ──

test('Z10 Expenses’ edit form says the book is moved on the time sheet’s ENTITY cell — its book select still disabled, sending its book unchanged', () => {
  assert.equal(BOOK_FIXED_WORDS, 'the book is moved on the time sheet — its ENTITY cell');
  const form = code(EDIT_FORM);
  assert.match(form, /disabled\n\s*title=\{BOOK_FIXED_WORDS\}\n\s*data-routine-book-select\n\s*>/, 'still disabled, titled by the words');
  assert.equal((form.match(/\{BOOK_FIXED_WORDS\}/g) ?? []).length, 2, 'drawn as its title and under the select');
  assert.doesNotMatch(form, /end it and create it there/);
});
