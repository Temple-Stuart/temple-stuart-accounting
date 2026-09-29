/**
 * INTAKE-01 (2026-09-28) — a plan's money is checked when it is saved.
 *
 * One rule (src/lib/operations/planMoney.ts) decides the account and the amount
 * of every routine, routine line and project task; one loader
 * (src/lib/operations/loadPlanBook.ts) reads the book it is checked against.
 * The rule, the edit and assign pairs and the loader are DRIVEN over fixtures.
 * The seven writers cannot run outside a Next request scope (getVerifiedEmail
 * reads next/headers cookies), so — the repo's TEST-TRUTH-01 way — each one is
 * anchored to its source, comments stripped: the rule runs before the first
 * write, a refusal is a 400 naming the field, and what is written is what the
 * rule returned. A last pin fails when a new writer of these columns skips it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { code, comments } from '../sourceText';
import {
  PLAN_COLUMN_DIGITS, assignedPlanMoney, carriesPlanMoney, editedPlanMoney, isBlankPlanValue, planMoney,
  type PlanBook, type PlanChartRow, type PlanMoneySent,
} from '../operations/planMoney';
import { PLAN_CHART_SELECT, loadPlanBook } from '../operations/loadPlanBook';

const W1 = 'src/app/api/operations/routines/route.ts';
const W2 = 'src/app/api/operations/routines/[id]/route.ts';
const W3 = 'src/app/api/operations/routines/[id]/steps/route.ts';
const W4 = 'src/app/api/operations/routines/steps/[stepId]/route.ts';
const W5 = 'src/app/api/operations/projects/[id]/tasks/route.ts';
const W6 = 'src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts';
const W7 = 'src/app/api/operations/tasks/[id]/assign/route.ts';
const WRITERS = [W1, W2, W3, W4, W5, W6, W7];
const REPORT = 'src/app/api/budget/report/route.ts';

const row = (code: string, name: string, account_type: string, is_archived = false): PlanChartRow => ({ code, name, account_type, is_archived });

/** A sole proprietorship's book: rows saved bare AND lettered, every family, an archived row, a collision, an unreadable row. */
const BIZ: PlanBook = {
  id: 'e_biz',
  name: 'Temple Stuart LLC',
  entityType: 'sole_prop',
  chart: [
    row('5100', 'Software', 'expense'),
    row('B-6240', 'Subscriptions', 'expense'),
    row('4000', 'Consulting income', 'revenue'),
    row('1000', 'Checking', 'asset'),
    row('2000', 'Card', 'liability'),
    row('3000', 'Owner equity', 'equity'),
    row('6110', 'Old tools', 'expense', true),
    row('6300', 'Hosting', 'expense'),
    row('B-6300', 'Hosting (dup)', 'expense'),
    row('X-9999', 'Unreadable', 'expense'),
  ],
};
const ROUTINE = { amount: 'budget_amount', account: 'coa_code' };
const TASK = { amount: 'estimated_cost_usd', account: 'coa_code' };

const ok = (sent: PlanMoneySent, column: 'routine' | 'task' = 'routine', book: PlanBook = BIZ) => {
  const r = planMoney(sent, book, column, column === 'routine' ? ROUTINE : TASK);
  assert.ok('value' in r, `expected acceptance, got ${JSON.stringify(r)}`);
  return r.value;
};
const refused = (sent: PlanMoneySent, column: 'routine' | 'task' = 'routine', book: PlanBook = BIZ) => {
  const r = planMoney(sent, book, column, column === 'routine' ? ROUTINE : TASK);
  assert.ok('error' in r, `expected a refusal, got ${JSON.stringify(r)}`);
  return r.error;
};

// ── T1 · THE RULE ────────────────────────────────────────────────────────────

test('T1 the account: bare, lettered and lowercase input are one account; what is stored is the chart row as saved', () => {
  assert.deepEqual(ok({ amount: '12.50', account: '5100' }), { amount: '12.50', coaCode: '5100' });
  assert.deepEqual(ok({ amount: '12.50', account: 'B-5100' }), { amount: '12.50', coaCode: '5100' });
  assert.deepEqual(ok({ amount: '12.50', account: ' b-5100 ' }), { amount: '12.50', coaCode: '5100' }, 'typed lowercase, saved bare → bare');
  assert.deepEqual(ok({ amount: '220', account: '6240' }), { amount: '220', coaCode: 'B-6240' }, 'typed bare, saved lettered → lettered');
  assert.deepEqual(ok({ amount: '220', account: 'b-6240' }), { amount: '220', coaCode: 'B-6240' });
  // Income is planned the same way as spending (ruling G).
  assert.deepEqual(ok({ amount: '5000', account: 'B-4000' }), { amount: '5000', coaCode: '4000' });
});

test('T1 the account: refusals in the chart\'s words, every account shown as its account string', () => {
  // (a) the chart's rule, verbatim — a wrong book letter, and a code outside the scheme.
  assert.deepEqual(refused({ amount: '5', account: 'P-5100' }), { field: 'coa_code', message: 'code P-5100 carries the P- letter; this is a B- chart (sole_prop) — enter B-5100 or 5100' });
  assert.deepEqual(refused({ amount: '5', account: 'Software' }), { field: 'coa_code', message: 'code "SOFTWARE" is not in the scheme — four digits (6250) or the entity letter and four digits (B-6250)' });
  // (b) not in the chart; two rows that read as one account, each saved code named.
  assert.deepEqual(refused({ amount: '5', account: '7777' }), { field: 'coa_code', message: "B-7777 is not an account in Temple Stuart LLC's chart" });
  assert.deepEqual(refused({ amount: '5', account: '6300' }), { field: 'coa_code', message: `B-6300 is 2 accounts in Temple Stuart LLC's chart — code "6300", "Hosting" and code "B-6300", "Hosting (dup)" — fix the chart in Books first` });
  // A chart row the rule cannot read is no account — never matched by a guess.
  assert.equal(refused({ amount: '5', account: '9999' }).message, "B-9999 is not an account in Temple Stuart LLC's chart");
  // (c) archived.
  assert.deepEqual(refused({ amount: '5', account: 'B-6110' }), { field: 'coa_code', message: "B-6110 Old tools is archived in Temple Stuart LLC's chart — choose an open account" });
  // (d) asset, liability and equity are not where a plan's money goes.
  assert.deepEqual(refused({ amount: '5', account: '1000' }), { field: 'coa_code', message: "B-1000 Checking is an asset account — a plan's money goes on an income or expense account" });
  assert.equal(refused({ amount: '5', account: '2000' }).message, "B-2000 Card is a liability account — a plan's money goes on an income or expense account");
  assert.equal(refused({ amount: '5', account: '3000' }).message, "B-3000 Owner equity is an equity account — a plan's money goes on an income or expense account");
});

test('T1 the amount: exact to the cent, never negative, never rounded, and it fits its column', () => {
  const rule = 'must be a non-negative amount with at most 2 decimals';
  for (const bad of ['1.005', '-1', '1e3', 'twelve', 0.1 + 0.2, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(refused({ amount: bad, account: '5100' }), { field: 'budget_amount', message: rule }, JSON.stringify(bad));
  }
  assert.deepEqual(ok({ amount: 12.5, account: '5100' }), { amount: '12.5', coaCode: '5100' }, 'a number that is exact in two decimals');
  assert.deepEqual(ok({ amount: ' 0 ', account: '5100' }), { amount: '0', coaCode: '5100' }, 'zero is an amount; blank is not');
  // Decimal(12,2): 10 digits before the point on a routine or line; Decimal(15,2): 13 on a task.
  assert.deepEqual(PLAN_COLUMN_DIGITS, { routine: 10, task: 13 });
  assert.equal(ok({ amount: '1234567890.99', account: '5100' }).amount, '1234567890.99');
  assert.deepEqual(refused({ amount: '12345678901', account: '5100' }), { field: 'budget_amount', message: "12345678901 is too large — a routine's amount holds at most 10 digits before the point" });
  assert.equal(ok({ amount: '000000000001', account: '5100' }).amount, '000000000001', 'leading zeros are not digits the column holds');
  assert.equal(ok({ amount: '1234567890123.45', account: '5100' }, 'task').amount, '1234567890123.45');
  assert.deepEqual(refused({ amount: '12345678901234', account: '5100' }, 'task'), { field: 'estimated_cost_usd', message: "12345678901234 is too large — a task's amount holds at most 13 digits before the point" });
});

test('T1 the pair: an amount needs its account, an account needs its amount; both blank is no money', () => {
  assert.deepEqual(refused({ amount: '45', account: '' }), { field: 'coa_code', message: 'an amount needs its account — choose the income or expense account this money goes on' });
  assert.deepEqual(refused({ amount: '45', account: null }, 'task'), { field: 'coa_code', message: 'an amount needs its account — choose the income or expense account this money goes on' });
  assert.deepEqual(refused({ amount: '  ', account: '5100' }), { field: 'budget_amount', message: 'an account needs its amount — enter the amount, or clear the account' });
  assert.deepEqual(refused({ amount: undefined, account: '5100' }, 'task'), { field: 'estimated_cost_usd', message: 'an account needs its amount — enter the amount, or clear the account' });
  for (const [amount, account] of [[undefined, undefined], [null, null], ['', ''], ['  ', ' ']] as const) {
    assert.deepEqual(planMoney({ amount, account }, null, 'routine', ROUTINE), { value: { amount: null, coaCode: null } }, 'no money → no book needed, never 0');
    assert.equal(carriesPlanMoney({ amount, account }), false);
  }
  assert.equal(carriesPlanMoney({ amount: '5', account: '' }), true);
  assert.equal(carriesPlanMoney({ amount: '', account: '5100' }), true);
  assert.equal(isBlankPlanValue(0), false, 'zero is not blank');
  // A line's refusal names the line.
  assert.deepEqual(planMoney({ amount: '5', account: '1000' }, BIZ, 'routine', { amount: 'lines[2].budget_amount', account: 'lines[2].coa_code' }),
    { error: { field: 'lines[2].coa_code', message: "B-1000 Checking is an asset account — a plan's money goes on an income or expense account" } });
  // Money without its book is the caller's bug — thrown, never a pass.
  assert.throws(() => planMoney({ amount: '5', account: '5100' }, null, 'routine', ROUTINE), /without its book/);
});

test('T1 a book whose type has no letter: digits only, and no letter drawn in its messages', () => {
  const plain: PlanBook = { id: 'e_x', name: 'Holdings', entityType: 'llc', chart: [row('5100', 'Fees', 'expense')] };
  assert.deepEqual(ok({ amount: '1', account: '5100' }, 'routine', plain), { amount: '1', coaCode: '5100' });
  assert.equal(refused({ amount: '1', account: '5200' }, 'routine', plain).message, "5200 is not an account in Holdings's chart");
  assert.equal(refused({ amount: '1', account: 'B-5100' }, 'routine', plain).message, 'this entity (llc) has no code letter — enter the four digits only');
});

// ── T2 · THE LOADER ──────────────────────────────────────────────────────────

interface Store {
  entities: { id: string; userId: string; name: string; entity_type: string }[];
  chart: (PlanChartRow & { entity_id: string })[];
  calls: { entities: unknown[]; chart: unknown[] };
}

function fakeDb(s: Store): Pick<PrismaClient, 'entities' | 'chart_of_accounts'> {
  const db = {
    entities: {
      findFirst: async (args: { where: { id: string; userId: string } }) => {
        s.calls.entities.push(args);
        const e = s.entities.find((x) => x.id === args.where.id && x.userId === args.where.userId);
        return e ? { id: e.id, name: e.name, entity_type: e.entity_type } : null;
      },
    },
    chart_of_accounts: {
      findMany: async (args: { where: { entity_id: string; entity: { userId: string } } }) => {
        s.calls.chart.push(args);
        return s.chart
          .filter((c) => c.entity_id === args.where.entity_id && s.entities.some((e) => e.id === c.entity_id && e.userId === args.where.entity.userId))
          .map(({ code: c, name, account_type, is_archived }) => ({ code: c, name, account_type, is_archived }));
      },
    },
  };
  return db as unknown as Pick<PrismaClient, 'entities' | 'chart_of_accounts'>;
}

test('T2 loadPlanBook: the budget report\'s scope (entity AND entity.userId), archived rows included, another user\'s entity → null', async () => {
  const s: Store = {
    entities: [{ id: 'e1', userId: 'u1', name: 'Mine', entity_type: 'sole_prop' }, { id: 'e2', userId: 'u2', name: 'Theirs', entity_type: 'personal' }],
    chart: [
      { entity_id: 'e1', ...row('5100', 'Software', 'expense') },
      { entity_id: 'e1', ...row('6110', 'Old tools', 'expense', true) },
      { entity_id: 'e2', ...row('6100', 'Theirs', 'expense') },
    ],
    calls: { entities: [], chart: [] },
  };
  const book = await loadPlanBook(fakeDb(s), 'u1', 'e1');
  assert.deepEqual(book, { id: 'e1', name: 'Mine', entityType: 'sole_prop', chart: [row('5100', 'Software', 'expense'), row('6110', 'Old tools', 'expense', true)] });
  assert.deepEqual(s.calls.entities, [{ where: { id: 'e1', userId: 'u1' }, select: { id: true, name: true, entity_type: true } }]);
  assert.deepEqual(s.calls.chart, [{ where: { entity_id: 'e1', entity: { userId: 'u1' } }, select: PLAN_CHART_SELECT }], 'no is_archived filter — an archived account is refused by name');
  assert.deepEqual(PLAN_CHART_SELECT, { code: true, name: true, account_type: true, is_archived: true });
  assert.equal(await loadPlanBook(fakeDb(s), 'u1', 'e2'), null, 'another user\'s entity');
  assert.equal(await loadPlanBook(fakeDb(s), 'u1', 'e_none'), null);
  // The report's own scope, the same two conditions.
  assert.match(code(REPORT), /where: \{ entity_id: \{ in: entityIds \}, entity: \{ userId: user\.id \} \},/);
  assert.match(code('src/lib/operations/loadPlanBook.ts'), /where: \{ entity_id: entityId, entity: \{ userId \} \},/);
});

// ── T3 · EACH WRITER: THE RULE BEFORE THE FIRST WRITE ────────────────────────

/** The writer's handler source, from its export to the next export (or the end). */
function handler(file: string, verb: string): string {
  const s = code(file);
  const at = s.indexOf(`export async function ${verb}(`);
  assert.ok(at >= 0, `${file} ${verb}`);
  const next = s.indexOf('export async function ', at + 10);
  return s.slice(at, next < 0 ? undefined : next);
}

/** Index of needle, asserted present exactly once. */
function once(hay: string, needle: string, what: string): number {
  const at = hay.indexOf(needle);
  assert.ok(at >= 0, `${what}: not found — ${needle}`);
  assert.equal(hay.indexOf(needle, at + 1), -1, `${what}: more than once — ${needle}`);
  return at;
}

const REFUSE = (v: string) => `if ('error' in ${v}) return NextResponse.json({ error: 'Validation', ...${v}.error }, { status: 400 });`;
const LOAD = (entity: string) => `book = await loadPlanBook(prisma, user.id, ${entity});\n`;
const NOT_FOUND = "if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 });";

const WRITER_PINS: { file: string; verb: string; entity: string; calls: string[]; refusals: string[]; firstWrite: string; writes: string[] }[] = [
  {
    file: W1, verb: 'POST', entity: 'entityId',
    calls: ["planMoney(routineSent, book, 'routine', { amount: 'budget_amount', account: 'coa_code' })", "planMoney(lineSent[i], book, 'routine', { amount: `lines[${i}].budget_amount`, account: `lines[${i}].coa_code` })"],
    refusals: ['routineMoney', 'm'],
    firstWrite: 'await prisma.$transaction(',
    writes: ['budget_amount: routineMoney.value.amount,', 'coa_code: routineMoney.value.coaCode,', 'budget_amount: lineMoney[i].amount,', 'coa_code: lineMoney[i].coaCode,'],
  },
  {
    file: W2, verb: 'PATCH', entity: 'existing.entity_id',
    calls: ["planMoney(sent, book, 'routine', { amount: 'budget_amount', account: 'coa_code' })"],
    refusals: ['money'],
    firstWrite: 'await prisma.operations_routines.update(',
    writes: ['data.budget_amount = money.value.amount;', 'data.coa_code = money.value.coaCode;'],
  },
  {
    file: W3, verb: 'POST', entity: 'routine.entity_id',
    calls: ["planMoney(sent, book, 'routine', { amount: 'budget_amount', account: 'coa_code' })"],
    refusals: ['money'],
    firstWrite: 'await prisma.operations_routine_steps.create(',
    writes: ['budget_amount: money.value.amount,', 'coa_code: money.value.coaCode,'],
  },
  {
    file: W4, verb: 'PATCH', entity: 'existing.entity_id',
    calls: ["planMoney(sent, book, 'routine', { amount: 'budget_amount', account: 'coa_code' })"],
    refusals: ['money'],
    firstWrite: 'await prisma.operations_routine_steps.update(',
    writes: ['data.budget_amount = money.value.amount;', 'data.coa_code = money.value.coaCode;'],
  },
  {
    file: W5, verb: 'POST', entity: 'project.entity_id',
    calls: ["planMoney(sent, book, 'task', { amount: 'estimated_cost_usd', account: 'coa_code' })"],
    refusals: ['money'],
    firstWrite: 'await prisma.operations_project_tasks.create(',
    writes: ['const estimated_cost_usd = money.value.amount;', 'const coa_code = money.value.coaCode;'],
  },
  {
    file: W6, verb: 'PATCH', entity: 'existing.entity_id',
    calls: ["planMoney(sent, book, 'task', { amount: 'estimated_cost_usd', account: 'coa_code' })"],
    refusals: ['money'],
    firstWrite: 'await prisma.$transaction(',
    writes: ['data.estimated_cost_usd = money.value.amount;', 'data.coa_code = money.value.coaCode;'],
  },
  {
    file: W7, verb: 'POST', entity: 'task.entity_id',
    calls: ["planMoney(sent, book, 'task', { amount: 'estimated_cost_usd', account: 'coa_code' })"],
    refusals: ['money'],
    firstWrite: 'prisma.$transaction(',
    writes: ['{ coa_code: taskMoney.coaCode, estimated_cost_usd: taskMoney.amount }'],
  },
];

test('T3 each of W1–W7: the book is read only with money, the rule runs before the first write, a refusal is a 400 naming its field, and what is written is what the rule returned', () => {
  for (const w of WRITER_PINS) {
    const h = handler(w.file, w.verb);
    const load = once(h, LOAD(w.entity), `${w.file} book`);
    once(h, NOT_FOUND, `${w.file} book 404`);
    const gate = h.lastIndexOf('if (carriesPlanMoney(', load);
    assert.ok(gate >= 0 && h.slice(gate, load).split('\n').length <= 3, `${w.file}: the book is read only when the pair carries money`);
    const write = once(h, w.firstWrite, `${w.file} first write`);
    for (const c of w.calls) assert.ok(once(h, c, `${w.file} rule`) < write, `${w.file}: the rule runs before the first write`);
    for (const r of w.refusals) assert.ok(once(h, REFUSE(r), `${w.file} refusal`) < write, `${w.file}: the refusal returns before the first write`);
    assert.ok(load < write);
    for (const wr of w.writes) once(h, wr, `${w.file} writes the rule's answer`);
    // No other write of these columns in the handler: every assignment reads the rule's answer.
    const assignments = h.match(/\b(budget_amount|coa_code|estimated_cost_usd)\s*(=(?!=)|:(?!\s*(true|false)\b))[^,;\n]*/g) ?? [];
    for (const a of assignments) {
      assert.match(a, /(money|Money)|^coa_code: \{ not: null \}|^budget_amount: \{ not: null \}/, `${w.file}: ${a}`);
    }
  }
  // The old ad-hoc checks are gone.
  assert.doesNotMatch(code(W1), /budgetAmount = n;|const coaCode = typeof body\.coa_code/);
  assert.doesNotMatch(code(W2), /data\.budget_amount = n;/);
  assert.doesNotMatch(code(W5), /new Prisma\.Decimal\(body\.estimated_cost_usd/);
  assert.doesNotMatch(code(W6), /new Prisma\.Decimal\(v\.trim\(\)\);\s*\} else if \(typeof v === 'number'\) \{\s*data\.estimated_cost_usd/);
  assert.doesNotMatch(code(W7), /const coaCodeRaw|let estCost/);
  for (const f of [W5, W6]) assert.doesNotMatch(code(f), /userId_entity_id_code/, `${f}: the saved-string lookup is gone`);
});

test('T3 the edits and assign derive their pair through the one helper each', () => {
  for (const [f, call] of [
    [W2, 'editedPlanMoney(body.budget_amount, body.coa_code, { amount: existing.budget_amount, account: existing.coa_code })'],
    [W4, 'editedPlanMoney(body.budget_amount, body.coa_code, { amount: existing.budget_amount, account: existing.coa_code })'],
    [W6, 'editedPlanMoney(body.estimated_cost_usd, body.coa_code, { amount: existing.estimated_cost_usd, account: existing.coa_code })'],
    [W7, 'assignedPlanMoney(body.estimated_cost_usd, body.coa_code, { amount: task.estimated_cost_usd, account: task.coa_code })'],
  ] as const) {
    once(code(f), `const sent = ${call};`, f);
    once(code(f), 'if (sent !== null) {', f);
  }
  for (const f of [W1, W3, W5]) assert.doesNotMatch(code(f), /editedPlanMoney|assignedPlanMoney/, `${f} creates — no stored pair`);
  // A line's book is its routine's: both line writers copy the routine's entity, and the routine's never changes.
  assert.match(code(W1), /routine_id: created\.id,\s*user_id: user\.id,\s*entity_id: entityId,/);
  assert.match(code(W3), /entity_id: routine\.entity_id,/);
  assert.doesNotMatch(handler(W2, 'PATCH'), /data\.entity_id|\bentity_id\s*:/, 'the routine edit never writes entity_id');
  assert.doesNotMatch(handler(W2, 'PATCH'), /body\.entity_id/, 'nor reads one from the body');
});

// ── T4 · THE EDIT RULE ───────────────────────────────────────────────────────

const dec = (s: string) => ({ toString: () => s });

test('T4 an edit checks the EFFECTIVE pair; a stored lowercase code re-resolves to the chart\'s string; neither key → nothing read', () => {
  const stored = { amount: dec('45'), account: '5100' };
  // The account alone → checked with the stored amount.
  const accountOnly = editedPlanMoney(undefined, 'B-6240', stored)!;
  assert.deepEqual(accountOnly, { amount: '45', account: 'B-6240' });
  assert.deepEqual(ok(accountOnly), { amount: '45', coaCode: 'B-6240' });
  // The amount alone → checked with the stored account.
  const amountOnly = editedPlanMoney('60.10', undefined, stored)!;
  assert.deepEqual(amountOnly, { amount: '60.10', account: '5100' });
  assert.deepEqual(ok(amountOnly), { amount: '60.10', coaCode: '5100' });
  // A stored "b-5100" (saved before this rule) re-resolves to the chart's saved string on edit.
  assert.deepEqual(ok(editedPlanMoney('45', undefined, { amount: dec('45'), account: 'b-5100' })!), { amount: '45', coaCode: '5100' });
  // Clearing the account while an amount is stored → refused: a plan /budget cannot place is not saved.
  assert.equal(refused(editedPlanMoney(undefined, '', stored)!).field, 'coa_code');
  // Clearing both → no money, both columns written null.
  assert.deepEqual(planMoney(editedPlanMoney('', null, stored)!, null, 'routine', ROUTINE), { value: { amount: null, coaCode: null } });
  // A legacy row with an amount and no account is refused when its money is edited.
  assert.equal(refused(editedPlanMoney('45', undefined, { amount: null, account: null })!).message, 'an amount needs its account — choose the income or expense account this money goes on');
  // Neither key → null: the route skips the rule, the chart is not read, nothing is written.
  assert.equal(editedPlanMoney(undefined, undefined, stored), null);
  for (const f of [W2, W4, W6]) {
    const h = code(f);
    assert.ok(h.indexOf('if (sent !== null) {') < h.indexOf('loadPlanBook('), `${f}: the chart is read only inside the edit of the pair`);
  }
});

// ── T5 · THE ASSIGN ROUTE ────────────────────────────────────────────────────

test('T5 assign: an unchecked account is refused; the pair checked is the one that will be stored', () => {
  // The account sent is checked — the old route stored it unread.
  assert.equal(refused(assignedPlanMoney('20', 'Software', { amount: null, account: null })!, 'task').field, 'coa_code');
  assert.equal(refused(assignedPlanMoney('20', 'B-1000', { amount: null, account: null })!, 'task').message, "B-1000 Checking is an asset account — a plan's money goes on an income or expense account");
  // The stored cost is kept, never overwritten — so it is the cost checked, not the one sent.
  assert.deepEqual(assignedPlanMoney('999', '5100', { amount: dec('20'), account: null }), { account: '5100', amount: '20' });
  assert.deepEqual(ok(assignedPlanMoney('999', '5100', { amount: dec('20'), account: null })!, 'task'), { amount: '20', coaCode: '5100' });
  // No stored cost → the cost sent; no account sent → the stored one.
  assert.deepEqual(assignedPlanMoney('20', undefined, { amount: null, account: 'B-6240' }), { account: 'B-6240', amount: '20' });
  // An account sent onto a task with no cost and none sent → refused (the pair).
  assert.equal(refused(assignedPlanMoney(undefined, '5100', { amount: null, account: null })!, 'task').field, 'estimated_cost_usd');
  // A bad cost is refused by the one amount rule.
  assert.equal(refused(assignedPlanMoney('-5', '5100', { amount: null, account: null })!, 'task').message, 'must be a non-negative amount with at most 2 decimals');
  // Blank counts as not sent, as the route always read it: nothing sent → nothing checked or written.
  assert.equal(assignedPlanMoney('', '  ', { amount: dec('20'), account: '5100' }), null);
  assert.equal(assignedPlanMoney(undefined, undefined, { amount: null, account: null }), null);
  // The route stores the checked pair whole, inside the transaction, only when checked.
  const h = code(W7);
  const checked = once(h, 'taskMoney = money.value;', 'W7 checked');
  const stores = once(h, "if (taskMoney !== null) {\n        const taskData: Prisma.operations_project_tasksUpdateInput = { coa_code: taskMoney.coaCode, estimated_cost_usd: taskMoney.amount };", 'W7 stores');
  assert.ok(checked < h.indexOf('const runAssignTxn') && h.indexOf('const runAssignTxn') < stores);
});

// ── T6 · NO WRITER SKIPS THE RULE ────────────────────────────────────────────

function srcFiles(dir = 'src'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(resolve(process.cwd(), rel)).isDirectory()) {
      if (name !== '__tests__') out.push(...srcFiles(rel));
    } else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

test('T6 every file under src that writes a plan\'s money calls the rule — and they are exactly W1–W7', () => {
  const WRITE = /\b(operations_routines|operations_routine_steps|operations_project_tasks)\.(create|createMany|update|updateMany|upsert)\(/;
  const MONEY = /\b(budget_amount|coa_code|estimated_cost_usd)\s*(=(?!=)|:(?!\s*(true|false)\b))/;
  const writers = srcFiles().filter((f) => { const s = code(f); return WRITE.test(s) && MONEY.test(s); }).sort();
  assert.deepEqual(writers, [...WRITERS].sort(), 'a new writer of these columns must be added here AND call planMoney');
  for (const f of writers) assert.match(code(f), /\bplanMoney\(/, `${f} writes a plan's money without the rule`);
  // No raw SQL writes these tables anywhere under src.
  const raw = srcFiles().filter((f) => /(INSERT INTO|UPDATE)\s+"?(operations_routines|operations_routine_steps|operations_project_tasks)\b/i.test(code(f)));
  assert.deepEqual(raw, []);
  // The stale promise is gone: the API takes any string, so the route checks it.
  assert.doesNotMatch(comments('src/lib/operations/routineInput.ts'), /a code never arrives typed/);
  assert.match(comments('src/lib/operations/routineInput.ts'), /the API takes any string/);
  assert.match(code('src/lib/operations/routineInput.ts'), /export function parseBudgetAmountOrNull\(/, 'the one amount rule still lives here');
});
