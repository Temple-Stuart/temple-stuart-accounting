/**
 * SYNC-01 (Alex, 2026-11-11 12:40: "my bank trannies were not pulling for like not everything... we need to get this
 * working 100% today" · 12:54: "lets get the sync fixed. so everything pulls") — THE RUN.
 *
 * Hermetic. The REAL paging loop and the REAL walk (src/lib/plaid/syncRun.ts) over fakes: a fake bank that answers
 * like /transactions/get (newest first, sliced by offset and count), the shared fake arrivals store (fakeLanding.ts),
 * a fake domain table — and the REAL page parser (src/lib/arrivals/plaidTransactionsPage.ts runTransactionsPage)
 * between them, so `added`, `unheld` and the rows are what the parser really writes. No clock but the one each test
 * hands in; no Plaid, no database, no network.
 *
 *   T1  1,200 objects at 250 a page, 200 of them already in the app → asks at 0, 250, 500, 750, 1000; pulled 1,200
 *       of 1,200; added 1,000 (landed is 1,200: a row the app already had lands in the store for the first time);
 *   T2  the clock stops the run after the first ask → `more` at offset 250 with the counts so far; the browser sends
 *       it back; the second request asks 250, 500, 750 and 1000 only; the two requests together land and write
 *       exactly what one uninterrupted run does — same arrivals, same rows, same counts;
 *   T3  a clock already spent at the start still makes one ask — the run always moves;
 *   T4  the walk: a resume at (B, investments) runs B's investments and holdings and every later item — never A,
 *       never B's transactions; a stop between stages says "<stage> next" and lists what finished;
 *   T5  a link with no accounts: no ask is made; the outcome is idle, and it decides nothing about the status;
 *   T6  an object for an account not held: unheld 1, no domain write, the arrival landed and read; the note names
 *       Plaid's account (the mask left out when Plaid states none);
 *   T7  an empty page under a larger total: one ask, a declared failure, no loop — at offset 0 and mid-run;
 *   T8  a page that rolls back and an ask that throws: each a declared failure; what landed before stays;
 *   T9  the resume point a browser sends back: good → accepted; another user's or an unknown link → the 404 words;
 *       a bad stage, offset or counts and a non-JSON body → the 400 words; an empty body → a fresh run;
 *   T10 two live links of one bank get dated labels; a failure names that label once;
 *   T11 the 202 body as written, the progress lines, the two constants;
 *   T12 the route binds the loop: the three gates stand before the resume point is read, the one page size in
 *       both paged stages, the same range, a link with no accounts not asked; the run module is pure;
 *   T13 SYNC-02: a stage of 1,000 objects — four full pages — asks at 0, 250, 500 and 750 and pulls 1,000 of 1,000;
 *       no fifth ask is made.
 *
 * SYNC-02 (Alex, 2026-11-11 16:25) — the page is 250 objects, not Plaid's 500: a 500-row page of Wells Fargo
 * transactions crossed the 1,048,576 bytes one stored answer may hold (src/lib/plaid/syncRun.ts SYNC_PAGE_SIZE). Every
 * figure here that comes from the page size was re-derived for 250 — T1's and T3's asks, T2's `more` point and its
 * counts, T7's and T8's second page, T11's pin and its pageOf examples — and T12's words for the page size. What each
 * test proves did not change. T13 is new.
 *
 * PENDING-03 (Alex, 2026-11-11) — a pending row the bank no longer lists is cleared: the page's SECOND pending step
 * (src/lib/arrivals/plaidTransactionsPage.ts pageWindow, DomainDb.clearUnlistedPending) runs on every page that has a
 * window — more than one day, newest first — and every page of these histories is that. The fake domain answers it
 * over its own table; no row here is pending, so it answers 0 and 0, and a transactions stage's counts gain
 * `pending_unlisted: 0, pending_unlisted_left: 0` — T1's, T2's `more` point and T13's whole-count pins say so. What
 * each test proves did not change. The rule itself is held in arrivalsLand.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Transaction } from 'plaid';
import { FakeLanding, snapshotClient } from './fakeLanding';
import { runTransactionsPage, type DomainDb, type ExistingTxn } from '../arrivals/plaidTransactionsPage';
import { bankLine, failedLine, itemStatus, stageFailed, stageOk, syncItemsEnvelope, type StageOutcome } from '../plaid/failLoud';
import { itemFailure } from '../plaid/reconnect';
import {
  IDLE_NO_ACCOUNTS, LINK_NOT_FOUND, RESUME_REFUSED, SYNC_BUDGET_MS, SYNC_PAGE_SIZE, SYNC_STAGES,
  askOnce, linkLabels, moreEnvelope, pageOf, pagedStage, progressLine, readResume, runBudget, unheldNotes, walkItems,
  type ListedAccount, type PageAnswer, type PagedPorts, type StageStart, type SyncMore, type WalkStage,
} from '../plaid/syncRun';
import { code } from '../sourceText';

// ── the fakes ────────────────────────────────────────────────────────────────

type Upsert = { where: { transactionId: string }; create: Record<string, unknown>; update: Record<string, unknown> };

/** The domain table as the parser writes it: what `transactions` would hold, keyed by transactionId. */
class FakeDomain implements DomainDb {
  upserts: Upsert[] = [];
  links = 0;
  rows = new Map<string, Record<string, unknown>>();
  constructor(private throwOn: string | null = null) {}
  transactions = {
    upsert: async (args: Upsert) => {
      if (this.throwOn && args.where.transactionId === this.throwOn) throw new Error('parser: amount is not a number');
      this.upserts.push(args);
      const prev = this.rows.get(args.where.transactionId);
      this.rows.set(args.where.transactionId, prev ? { ...prev, ...args.update } : { ...args.create });
      return {};
    },
    updateMany: async () => { this.links += 1; return {}; },
  };
  // PENDING-01 (2026-11-11): the parser's same-amount delete is gone (this fake's deleteMany went with it). The page's
  // one pending step runs only when a posted object names a pending charge — no object of these histories does, so a
  // call here is a fault of the test, said out loud (arrivalsLand.test.ts holds the step).
  clearReplacedPending = async (): Promise<never> => { throw new Error('syncRun01: no object here names a pending charge — the pending step must not run'); };
  // PENDING-03 (2026-11-11): the page's SECOND pending step runs on every page that has a window, so this fake must
  // answer it. It does so over its own table, with the step's rule (arrivalsLand.test.ts holds the rule): a row that is
  // PENDING, on one of the accounts, dated strictly inside the page's two days, that the page does not account for,
  // is deleted and counted. This table holds no commit, no posting and no link, so nothing is ever left in place. No
  // row of these histories is pending — every object is posted, and the rows the app already holds state no
  // `pending` — so the answer is 0 and 0 on every page; every call is counted.
  unlistedCalls = 0;
  clearUnlistedPending = async (args: { accountIds: string[]; newestDay: string; oldestDay: string; accountedIds: string[] }) => {
    this.unlistedCalls += 1;
    let pending_unlisted = 0;
    for (const [id, row] of [...this.rows]) {
      if (row.pending !== true || !args.accountIds.includes(String(row.accountId)) || args.accountedIds.includes(id)) continue;
      const day = (row.date as Date).toISOString().slice(0, 10);
      if (!(day > args.oldestDay && day < args.newestDay)) continue;
      this.rows.delete(id);
      pending_unlisted += 1;
    }
    return { pending_unlisted, pending_unlisted_left: 0 };
  };
}

const LINK = 'link_wf';
const HELD = [{ id: 'acc_db_1', accountId: 'acc_plaid_1' }];
const CHECKING: ListedAccount = { account_id: 'acc_plaid_1', name: 'Checking', mask: '0000', type: 'depository' };
const day = (i: number) => new Date(Date.UTC(2026, 10, 9) - Math.floor(i / 2) * 86_400_000).toISOString().slice(0, 10);
const txn = (id: string, extra: Partial<Transaction> = {}): Transaction => ({
  transaction_id: id, account_id: 'acc_plaid_1', amount: 12.5, date: '2026-11-09', name: `Coffee ${id}`, pending: false,
  iso_currency_code: 'USD', unofficial_currency_code: null, category: ['Food'], category_id: '1', location: {} as Transaction['location'],
  payment_meta: {} as Transaction['payment_meta'], account_owner: null, pending_transaction_id: null, authorized_date: null, authorized_datetime: null,
  datetime: null, payment_channel: 'in store', transaction_code: null, ...extra,
} as Transaction);
/** 1,200 objects, newest first — t0000 is Nov 9, 2026. */
const HISTORY = Array.from({ length: 1200 }, (_, i) => txn(`t${String(i).padStart(4, '0')}`, { date: day(i), amount: 1 + i }));
/** The 200 the app already holds: every sixth object — half of them complete (the parser's skip), half not (an update). */
const HELD_ALREADY = HISTORY.filter((_, i) => i % 6 === 0);
const isComplete = (id: string) => Number(id.slice(1)) % 12 === 0;

type Answer = PageAnswer & { transactions: Transaction[]; accounts: ListedAccount[] };

/** A fake bank: answers like /transactions/get — `count` objects from `offset`, and its own total. Every ask is recorded. */
function bank(all: Transaction[], accounts: ListedAccount[] = [CHECKING], total: number = all.length) {
  const asked: number[] = [];
  return {
    asked,
    ask: (offset: number): Answer => {
      asked.push(offset);
      const page = all.slice(offset, offset + SYNC_PAGE_SIZE);
      return { objects: page.length, total, transactions: page, accounts };
    },
  };
}

/** The database between requests: the arrivals store and the domain table, with the rows the app already had. */
function database(already: Transaction[] = HELD_ALREADY, throwOn: string | null = null) {
  const landing = new FakeLanding();
  const domain = new FakeDomain(throwOn);
  for (const t of already) {
    domain.rows.set(t.transaction_id, { transactionId: t.transaction_id, accountId: 'acc_db_1', amount: t.amount, name: t.name, date: new Date(t.date), personal_finance_category: isComplete(t.transaction_id) ? { primary: 'FOOD' } : null });
  }
  return { landing, domain };
}
type Database = ReturnType<typeof database>;

/** The route's batch lookup, as each request does it: the rows the app holds NOW for the link's accounts. */
const existingOf = (db: Database): Map<string, ExistingTxn> =>
  new Map([...db.domain.rows].map(([id, row]) => [id, { transactionId: id, personal_finance_category: row.personal_finance_category ?? null }]));

/** The newest date the domain table holds — what the route reads once, when the stage completes. */
const newestDate = (db: Database): string | null => {
  const dates = [...db.domain.rows.values()].map((row) => (row.date as Date).toISOString().slice(0, 10)).sort();
  return dates.length > 0 ? dates[dates.length - 1] : null;
};

/** The transactions stage's ports, bound to the fakes the way the route binds Prisma and Plaid — with the REAL page parser. */
function ports(db: Database, plaid: ReturnType<typeof bank>, hooks: string[] = []): PagedPorts<Answer> {
  const existing = existingOf(db);
  return {
    stage: 'transactions',
    ask: async (offset) => plaid.ask(offset),
    first: async () => { hooks.push('first'); },
    land: async (answer, page) => {
      const result = await runTransactionsPage(snapshotClient(db.landing), () => ({ landing: db.landing, domain: db.domain }), {
        page, userId: 'user_1', connection: 'item_abc', accounts: HELD, existing,
        wire: { body: Buffer.from(JSON.stringify({ page, n: answer.transactions.length }), 'utf8'), asked: new Date('2026-11-11T10:00:00Z'), arrived: new Date('2026-11-11T10:00:01Z') },
        httpStatus: 200, transactions: answer.transactions, now: () => new Date('2026-11-11T10:00:02Z'),
      });
      return result.ok ? { ok: true, counts: { ...result.counts } } : { ok: false, failure: result.failure };
    },
    answered: async () => { hooks.push('answered'); },
    through: async () => { hooks.push('through'); return newestDate(db); },
    notes: (last) => unheldNotes(last.accounts, HELD.map((account) => account.accountId)),
    declare: async (error) => { hooks.push('declare'); return stageFailed('transactions', error); },
  };
}

const FRESH: StageStart = { offset: 0, counts: {} };
/** A clock that never runs out. */
const unhurried = () => runBudget(() => 0);
/** What the store and the table hold, without the ids each run mints for itself. */
const held = (db: Database) => ({
  arrivals: [...db.landing.arrivals.keys()].sort(),
  read: [...db.landing.arrivals.values()].filter((a) => a.status === 'done').length,
  responses: db.landing.responses.length,
  rows: [...db.domain.rows].map(([id, row]) => [id, row.accountId, row.amount, row.name, (row.date as Date).toISOString()]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
});
const stageOf = (step: Awaited<ReturnType<typeof pagedStage>>): StageOutcome => { assert.equal(step.kind, 'done'); if (step.kind !== 'done') throw new Error('not done'); return step.outcome; };

// ── T1 ───────────────────────────────────────────────────────────────────────

test('T1 1,200 objects at 250 a page, 200 of them already in the app: asks at 0, 250, 500, 750 and 1000; pulled 1,200 of 1,200; added 1,000', async () => {
  const db = database();
  const plaid = bank(HISTORY);
  const hooks: string[] = [];
  const step = await pagedStage(ports(db, plaid, hooks), FRESH, unhurried());
  assert.deepEqual(plaid.asked, [0, 250, 500, 750, 1000], 'five asks, SYNC_PAGE_SIZE objects each — the last answers the 200 that are left');
  const outcome = stageOf(step);
  assert.deepEqual(outcome, {
    stage: 'transactions', ok: true,
    // landed is 1,200 — every object is a first arrival in the store, the 200 the app already had among them. added is not that number.
    // PENDING-03: every page has a window, so the unlisted step ran on each — and cleared nothing: no row here is pending.
    counts: { landed: 1200, already_landed: 0, corrected: 0, synced: 1200, skipped: 100, unheld: 0, added: 1000, pending_unlisted: 0, pending_unlisted_left: 0, pulled: 1200, plaid_total: 1200 },
    through: '2026-11-09',
  });
  assert.equal(db.domain.unlistedCalls, 5, 'PENDING-03: the unlisted step ran once on each of the five pages');
  assert.equal(db.domain.rows.size, 1200, 'the table holds every object');
  assert.equal(db.domain.upserts.length, 1100, '1,000 new rows written and the 100 incomplete ones updated; the 100 complete ones are linked, not rewritten');
  assert.equal(db.domain.links, 100);
  assert.equal(db.landing.arrivals.size, 1200);
  assert.equal(db.landing.responses.length, 5, 'one answer landed per ask');
  assert.deepEqual(hooks, ['first', 'answered', 'through'], 'the first answer once; Plaid answered; the newest date read once, at the end');
  assert.equal('notes' in step, false, 'every account Plaid lists is held — no note');
});

// ── T2 ───────────────────────────────────────────────────────────────────────

test('T2 the clock stops the run after the first ask: `more` at offset 250 with the counts so far; the second request asks 250, 500, 750 and 1000 only; together they land and write exactly what one uninterrupted run does', async () => {
  // one uninterrupted run
  const whole = database();
  const wholeStep = await pagedStage(ports(whole, bank(HISTORY)), FRESH, unhurried());
  const wholeOutcome = stageOf(wholeStep);

  // the same run, cut: request 1 — its budget is spent once it has asked
  const db = database();
  const item = { id: LINK, name: 'Wells Fargo' };
  const hooks: string[] = [];
  const first = bank(HISTORY);
  const walk = (plaid: ReturnType<typeof bank>, resume: SyncMore | null, budget: ReturnType<typeof runBudget>) => walkItems({
    items: [item], key: (i) => i.id, label: (i) => i.name, idle: () => false,
    stages: [['transactions', (_i, from, clock) => pagedStage(ports(db, plaid, hooks), from, clock)]],
    resume, budget,
  });
  const one = await walk(first, null, runBudget(() => (first.asked.length === 0 ? 0 : SYNC_BUDGET_MS)));
  assert.deepEqual(first.asked, [0], 'one ask, then the budget is spent');
  assert.ok(one.more !== null);
  if (one.more === null) return;
  // the first 250 objects: 42 of them the app already held (every sixth) — 21 complete (skipped), 21 updated — and 208 new
  assert.deepEqual(one.more, { item: LINK, stage: 'transactions', offset: 250, counts: { landed: 250, already_landed: 0, corrected: 0, synced: 250, skipped: 21, unheld: 0, added: 208, pending_unlisted: 0, pending_unlisted_left: 0 } }, 'the point it stopped at, with the counts so far — PENDING-03: the first page\'s unlisted step among them, at zero');
  assert.equal(one.progress, 'Still pulling — Wells Fargo: transactions 250 of 1,200');
  assert.deepEqual(one.items, [], 'no stage finished in this request, so no outcome is listed yet');
  assert.equal(db.landing.arrivals.size, 250, 'the first page is landed and stays');

  // the browser sends the point back, unchanged; the route checks it whole
  const sent = readResume(JSON.stringify({ resume: one.more }), [LINK]);
  assert.deepEqual(sent, { ok: true, resume: one.more });
  if (!sent.ok || sent.resume === null) return;

  // request 2 — a fresh budget, a fresh lookup; it continues exactly there
  const second = bank(HISTORY);
  const two = await walk(second, sent.resume, unhurried());
  assert.deepEqual(second.asked, [250, 500, 750, 1000], 'never offset 0 again — nothing is asked twice');
  assert.equal(two.more, null, 'the run is done');
  assert.equal(two.items.length, 1);
  assert.equal(two.items[0].key, LINK);
  assert.deepEqual(two.items[0].stages, [wholeOutcome], 'the same outcome — the same counts, the same newest date — as the run that was never cut');
  assert.deepEqual(held(db), held(whole), 'the same arrivals, every one read, the same answers landed and the same rows');
  assert.deepEqual(hooks, ['first', 'answered', 'answered', 'through'], 'the first answer is the first request\'s alone; Plaid answered in both; the newest date is read once, when the stage completes');
});

// ── T3 ───────────────────────────────────────────────────────────────────────

test('T3 a clock already spent at the start still makes one ask — every request moves the run', async () => {
  const db = database();
  const plaid = bank(HISTORY);
  let reads = 0;
  const spent = runBudget(() => (reads++ === 0 ? 0 : 10 * SYNC_BUDGET_MS));
  const step = await pagedStage(ports(db, plaid), FRESH, spent);
  assert.deepEqual(plaid.asked, [0], 'one ask');
  assert.equal(step.kind, 'more');
  if (step.kind !== 'more') return;
  assert.equal(step.offset, 250);
  assert.equal(step.total, 1200);
  assert.equal(spent.asks(), 1);
  // and a budget that is NOT spent asks on: the same clock rule, the other way
  const all = bank(HISTORY);
  assert.equal((await pagedStage(ports(database(), all), FRESH, runBudget(() => 0, 1))).kind, 'done');
  assert.deepEqual(all.asked, [0, 250, 500, 750, 1000]);
});

// ── T4 ───────────────────────────────────────────────────────────────────────

interface Bank { id: string; name: string; accounts: number }
const A: Bank = { id: 'link_a', name: 'Ally', accounts: 2 };
const B: Bank = { id: 'link_b', name: 'Robinhood', accounts: 1 };
const C: Bank = { id: 'link_c', name: 'Wells Fargo', accounts: 3 };

/** Three recording stages: each call is `<bank>:<stage>@<offset>`; `stopAt` makes that one hand back "budget spent". */
function recording(stopAt: string | null = null) {
  const calls: string[] = [];
  const starts: StageStart[] = [];
  const stage = (name: (typeof SYNC_STAGES)[number]): WalkStage<Bank> => [name, async (item, from) => {
    const call = `${item.name}:${name}@${from.offset}`;
    calls.push(call);
    starts.push(from);
    if (call === stopAt) return { kind: 'more', offset: from.offset, counts: from.counts, total: null };
    return { kind: 'done', outcome: stageOk(name, { synced: 1 }) };
  }];
  return { calls, starts, stages: SYNC_STAGES.map(stage) };
}
const walkOf = (items: Bank[], r: ReturnType<typeof recording>, resume: SyncMore | null) =>
  walkItems({ items, key: (i) => i.id, label: (i) => i.name, idle: (i) => i.accounts === 0, stages: r.stages, resume, budget: unhurried() });

test('T4 the walk: a resume at (B, investments) runs B\'s investments and holdings and every later item — never A, never B\'s transactions; a stop between stages lists what finished and says what is next', async () => {
  const r = recording();
  const point: SyncMore = { item: B.id, stage: 'investments', offset: 300, counts: { synced: 300, added: 12 } };
  const resumed = await walkOf([A, B, C], r, point);
  assert.deepEqual(r.calls, ['Robinhood:investments@300', 'Robinhood:holdings@0', 'Wells Fargo:transactions@0', 'Wells Fargo:investments@0', 'Wells Fargo:holdings@0']);
  assert.deepEqual(r.starts[0], { offset: 300, counts: { synced: 300, added: 12 } }, 'that stage continues from that offset with those counts');
  for (const later of r.starts.slice(1)) assert.deepEqual(later, { offset: 0, counts: {} }, 'every later stage starts fresh');
  assert.equal(resumed.more, null);
  assert.deepEqual(resumed.items.map((i) => [i.institution, i.key, i.stages.map((s) => s.stage)]), [
    ['Robinhood', 'link_b', ['investments', 'holdings']],
    ['Wells Fargo', 'link_c', ['transactions', 'investments', 'holdings']],
  ], 'A is not in this request\'s answer at all');

  // a fresh run walks everything, in the order given
  const fresh = recording();
  await walkOf([A, B, C], fresh, null);
  assert.deepEqual(fresh.calls, ['Ally', 'Robinhood', 'Wells Fargo'].flatMap((n) => SYNC_STAGES.map((s) => `${n}:${s}@0`)));

  // the budget runs out before C's investments: C is listed with the one stage it finished, and the line says what is next
  const cut = recording('Wells Fargo:investments@0');
  const stopped = await walkOf([A, B, C], cut, point);
  assert.ok(stopped.more !== null);
  if (stopped.more === null) return;
  assert.deepEqual(stopped.more, { item: 'link_c', stage: 'investments', offset: 0, counts: {} });
  assert.equal(stopped.progress, 'Still pulling — Wells Fargo: investments next');
  assert.deepEqual(stopped.items.map((i) => [i.institution, i.stages.map((s) => s.stage)]), [['Robinhood', ['investments', 'holdings']], ['Wells Fargo', ['transactions']]]);
  assert.equal(cut.calls.includes('Wells Fargo:holdings@0'), false, 'nothing after the stop runs in this request');

  // a stop before a link's first stage lists nothing for that link
  const early = recording('Robinhood:transactions@0');
  const before = await walkOf([A, B, C], early, null);
  assert.deepEqual(before.items.map((i) => i.institution), ['Ally']);
  assert.deepEqual(before.more, { item: 'link_b', stage: 'transactions', offset: 0, counts: {} });

  // a resume point the walk cannot place is a fault, never a fresh start
  await assert.rejects(walkOf([A, C], recording(), point), /names a link this run does not hold/);

  // the one-ask stage looks at the clock too
  let ran = 0;
  let reads = 0;
  const spent = runBudget(() => (reads++ === 0 ? 0 : SYNC_BUDGET_MS));
  spent.asked();
  assert.deepEqual(await askOnce(spent, async () => { ran += 1; return stageOk('holdings', {}); }), { kind: 'more', offset: 0, counts: {}, total: null });
  assert.equal(ran, 0, 'not asked');
  const open = unhurried();
  assert.deepEqual(await askOnce(open, async () => { ran += 1; return stageOk('holdings', { holdings: 14 }); }), { kind: 'done', outcome: { stage: 'holdings', ok: true, counts: { holdings: 14 } } });
  assert.equal(ran, 1);
  assert.equal(open.asks(), 1);
});

// ── T5 ───────────────────────────────────────────────────────────────────────

test('T5 a link with no accounts: no ask is made; the outcome is idle — and an idle link decides nothing about the status', async () => {
  const empty: Bank = { id: 'link_e', name: 'Chase', accounts: 0 };
  const r = recording();
  const run = await walkOf([empty, C], r, null);
  assert.deepEqual(r.calls, ['Wells Fargo:transactions@0', 'Wells Fargo:investments@0', 'Wells Fargo:holdings@0'], 'the link with no accounts is never asked');
  assert.deepEqual(run.items[0], { institution: 'Chase', key: 'link_e', stages: [], idle: IDLE_NO_ACCOUNTS });
  assert.equal(IDLE_NO_ACCOUNTS, 'holds no accounts in this app — nothing was asked of Plaid');
  assert.equal(syncItemsEnvelope(run.items).status, 200, 'the live link synced; the idle one is neither ok nor failed');
  const dead: StageOutcome = stageFailed('transactions', new Error('boom'));
  assert.equal(syncItemsEnvelope([run.items[0], { institution: 'Wells Fargo', key: 'link_c', stages: [dead] }]).status, 500, 'every LIVE link failed — the idle one does not soften it');
  // only idle links: nothing to ask, nothing failed
  const only = await walkOf([empty], recording(), null);
  assert.equal(only.more, null);
  assert.equal(syncItemsEnvelope(only.items).status, 200);
  // a resume point may name it (it is one of the caller's live links): it is still not asked, and the walk goes on
  const again = recording();
  const resumed = await walkOf([A, empty, C], again, { item: 'link_e', stage: 'transactions', offset: 0, counts: {} });
  assert.deepEqual(resumed.items.map((i) => i.institution), ['Chase', 'Wells Fargo']);
  assert.equal(again.calls.some((c) => c.startsWith('Chase') || c.startsWith('Ally')), false);
});

// ── T6 ───────────────────────────────────────────────────────────────────────

test('T6 an object for an account the link holds no row for: unheld 1, no domain write, the arrival landed and read; the note names Plaid\'s account', async () => {
  const db = database([]);
  const SAVINGS: ListedAccount = { account_id: 'acc_plaid_other', name: 'Savings', mask: '4321', type: 'depository' };
  const NO_MASK: ListedAccount = { account_id: 'acc_plaid_ira', name: 'Rollover IRA', mask: null, type: 'investment' };
  const plaid = bank([txn('t1'), txn('t2', { account_id: 'acc_plaid_other' })], [CHECKING, SAVINGS, NO_MASK]);
  const step = await pagedStage(ports(db, plaid), FRESH, unhurried());
  const outcome = stageOf(step);
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.deepEqual(outcome.counts, { landed: 2, already_landed: 0, corrected: 0, synced: 1, skipped: 0, unheld: 1, added: 1, pulled: 2, plaid_total: 2 }, 'the object is counted — not dropped without a word');
  assert.deepEqual(db.domain.upserts.map((u) => u.where.transactionId), ['t1'], 'nothing is written for the account the link does not hold');
  assert.equal(db.domain.rows.has('t2'), false);
  const arrival = db.landing.rowsFor('t2');
  assert.equal(arrival.length, 1, 'its arrival landed');
  assert.equal(arrival[0].status, 'done', 'and is read');
  assert.equal(step.kind === 'done' && 'notes' in step, true);
  if (step.kind !== 'done') return;
  assert.deepEqual(step.notes, ['Savings ••4321 (depository)', 'Rollover IRA (investment)'], 'one note per account Plaid lists that the link holds no row for; no mask is invented');
  // the walk carries the notes onto the link's outcome
  const run = await walkItems({ items: [C], key: (i) => i.id, label: (i) => i.name, idle: () => false, stages: [['transactions', async () => step]], resume: null, budget: unhurried() });
  assert.deepEqual(run.items[0].notes, ['Savings ••4321 (depository)', 'Rollover IRA (investment)']);
  assert.deepEqual(unheldNotes([CHECKING], ['acc_plaid_1']), [], 'every listed account held → no note');
});

// ── T7 ───────────────────────────────────────────────────────────────────────

test('T7 an empty page under a larger total: one ask, a declared failure, no loop — at offset 0 and mid-run', async () => {
  const db = database([]);
  const hollow = bank([], [CHECKING], 10);
  const hooks: string[] = [];
  const outcome = stageOf(await pagedStage(ports(db, hollow, hooks), FRESH, unhurried()));
  assert.deepEqual(hollow.asked, [0], 'asked once — never again');
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.stage, 'transactions');
  assert.equal(outcome.message, 'Plaid answered an empty page at 0 of 10');
  assert.equal(outcome.page, 1);
  assert.equal(db.landing.responses.length, 1, 'the answer itself is kept — it is evidence of the ask');
  assert.equal(db.landing.arrivals.size, 0);
  assert.deepEqual(hooks, ['first', 'answered'], 'Plaid answered; the stage did not complete, so no newest date is read');

  // mid-run: Plaid's total says 1,200, the second page is empty
  const short = database([]);
  const stalled = bank(HISTORY.slice(0, 250), [CHECKING], 1200);
  const second = stageOf(await pagedStage(ports(short, stalled), FRESH, unhurried()));
  assert.deepEqual(stalled.asked, [0, 250]);
  assert.equal(second.ok, false);
  if (second.ok) return;
  assert.equal(second.message, 'Plaid answered an empty page at 250 of 1,200');
  assert.equal(second.page, 2);
  assert.equal(short.landing.arrivals.size, 250, 'the page that came before stays landed');
  assert.equal(failedLine('Wells Fargo', second), 'Wells Fargo — transactions page 2: Plaid answered an empty page at 250 of 1,200');

  // a total that is reached is not an empty page: zero objects and zero total is a clean, complete stage
  const none = stageOf(await pagedStage(ports(database([]), bank([])), FRESH, unhurried()));
  assert.deepEqual(none, { stage: 'transactions', ok: true, counts: { landed: 0, already_landed: 0, corrected: 0, synced: 0, skipped: 0, unheld: 0, added: 0, pulled: 0, plaid_total: 0 } }, 'and with no row held there is no newest date to state');
});

// ── T8 ───────────────────────────────────────────────────────────────────────

test('T8 a page that rolls back and an ask that throws are each a declared failure; what landed before stays', async () => {
  // the parser throws on an object of page 2: that page rolls back, page 1 stays, the stage declares page 2
  const db = database([], 't0350');
  const plaid = bank(HISTORY);
  const hooks: string[] = [];
  const outcome = stageOf(await pagedStage(ports(db, plaid, hooks), FRESH, unhurried()));
  assert.deepEqual(plaid.asked, [0, 250], 'the failed page ends the stage — the third page is not asked');
  assert.equal(outcome.ok, false);
  if (outcome.ok) return;
  assert.equal(outcome.page, 2);
  assert.match(outcome.message, /amount is not a number/);
  assert.equal(db.landing.arrivals.size, 250, 'page 1 landed; page 2 rolled back whole');
  assert.equal(db.landing.responses.length, 1);
  assert.deepEqual(hooks, ['first', 'answered'], 'Plaid answered — a page failure is ours, not the link\'s state');

  // the ask itself throws: declared through the port (the route names the link and records an ITEM_ERROR there)
  const dead = database([]);
  const calls: string[] = [];
  const refusing: PagedPorts<Answer> = { ...ports(dead, bank(HISTORY), calls), ask: async () => { throw new Error('Request failed with status code 400'); } };
  const refused = stageOf(await pagedStage(refusing, FRESH, unhurried()));
  assert.equal(refused.ok, false);
  assert.deepEqual(calls, ['declare'], 'no answer arrived: nothing is cleared, nothing landed');
  assert.equal(dead.landing.responses.length, 0);
});

// ── T9 ───────────────────────────────────────────────────────────────────────

test('T9 the resume point a browser sends back: good → accepted; another user\'s or an unknown link → the 404 words; a bad stage, offset or counts and a non-JSON body → the 400 words; an empty body → a fresh run', () => {
  const MINE = ['link_a', 'link_b'];
  const good: SyncMore = { item: 'link_b', stage: 'transactions', offset: 1500, counts: { landed: 1500, already_landed: 0, corrected: 2, synced: 1500, skipped: 40, unheld: 0, added: 7 } };
  const send = (resume: unknown) => readResume(JSON.stringify({ resume }), MINE);
  const BAD = { ok: false, status: 400, body: { ok: false, stage: 'sync', message: 'The sync could not continue from where it stopped — press Sync to start again.' } };
  const NOT_FOUND = { ok: false, status: 404, body: { ok: false, stage: 'sync', message: 'Bank connection not found' } };
  assert.equal(RESUME_REFUSED, BAD.body.message);
  assert.equal(LINK_NOT_FOUND, NOT_FOUND.body.message);

  // an empty body is a fresh run, as before SYNC-01
  assert.deepEqual(readResume('', MINE), { ok: true, resume: null });
  assert.deepEqual(readResume('  \n', MINE), { ok: true, resume: null });

  // good → accepted, unchanged
  assert.deepEqual(send(good), { ok: true, resume: good });
  assert.deepEqual(send({ item: 'link_a', stage: 'investments', offset: 0, counts: {} }), { ok: true, resume: { item: 'link_a', stage: 'investments', offset: 0, counts: {} } });
  assert.deepEqual(send({ item: 'link_a', stage: 'holdings', offset: 0, counts: {} }), { ok: true, resume: { item: 'link_a', stage: 'holdings', offset: 0, counts: {} } });

  // another user's link, an unknown one, a retired one (not in the live read), not even a string: one answer, and it confirms nothing
  for (const item of ['link_of_someone_else', 'no_such_link', '', 7, null, ['link_a']]) assert.deepEqual(send({ ...good, item }), NOT_FOUND, `item ${JSON.stringify(item)}`);
  assert.deepEqual(readResume(JSON.stringify({ resume: good }), []), NOT_FOUND, 'a caller with no live link owns none');

  // a bad stage, offset or counts
  for (const stage of ['balances', 'Transactions', '', 3, null]) assert.deepEqual(send({ ...good, stage }), BAD, `stage ${JSON.stringify(stage)}`);
  for (const offset of [-1, 1.5, '500', null, Number.MAX_SAFE_INTEGER + 1]) assert.deepEqual(send({ ...good, offset }), BAD, `offset ${JSON.stringify(offset)}`);
  const seventeen = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`c_${'abcdefghijklmnopq'[i]}`, 1]));
  for (const counts of [null, [], 'x', { Landed: 1 }, { 'a-b': 1 }, { a1: 1 }, { landed: -1 }, { landed: 1.5 }, { landed: '1' }, { landed: null }, seventeen]) assert.deepEqual(send({ ...good, counts }), BAD, `counts ${JSON.stringify(counts)}`);
  assert.deepEqual(send({ ...good, counts: Object.fromEntries(Object.entries(seventeen).slice(0, 16)) }).ok, true, 'sixteen names is the most a point may carry');
  // a holdings point is one ask: it carries no offset and no counts
  assert.deepEqual(send({ item: 'link_a', stage: 'holdings', offset: 1, counts: {} }), BAD);
  assert.deepEqual(send({ item: 'link_a', stage: 'holdings', offset: 0, counts: { holdings: 3 } }), BAD);
  // the point is checked whole: a missing key, an extra key, a body that is not { resume }
  assert.deepEqual(send({ item: 'link_a', stage: 'transactions', offset: 0 }), BAD);
  assert.deepEqual(send({ ...good, cursor: 'x' }), BAD);
  for (const body of ['{}', '[]', 'null', '"resume"', '{"resume":null}', '{"resume":[]}', JSON.stringify({ resume: good, also: 1 })]) assert.deepEqual(readResume(body, MINE), BAD, `body ${body}`);
  // not JSON at all
  for (const body of ['{resume', 'resume=1', '<html>']) assert.deepEqual(readResume(body, MINE), BAD, `body ${body}`);
  // a malformed point naming a foreign link is still only malformed: the 404 is for a well-formed point alone
  assert.deepEqual(send({ ...good, item: 'link_of_someone_else', stage: 'balances' }), BAD);
});

// ── T10 ──────────────────────────────────────────────────────────────────────

test('T10 two live links of one bank get dated labels; a failure names that label once', () => {
  const labelOf = linkLabels([
    { id: 'l1', name: 'Robinhood', linked: '2026-03-03' },
    { id: 'l2', name: 'Wells Fargo', linked: '2025-01-05' },
    { id: 'l3', name: 'Robinhood', linked: '2026-08-21' },
  ]);
  assert.equal(labelOf('l1'), 'Robinhood (linked Mar 3, 2026)');
  assert.equal(labelOf('l3'), 'Robinhood (linked Aug 21, 2026)');
  assert.equal(labelOf('l2'), 'Wells Fargo', 'a bank linked once keeps its plain name');
  assert.throws(() => labelOf('l9'), /no label for a link outside this run/);
  assert.throws(() => linkLabels([{ id: 'a', name: 'Ally', linked: '2026-02-30' }, { id: 'b', name: 'Ally', linked: 'yesterday' }]), /names no calendar day/, 'a label is never built on a day that is not one');
  assert.equal(linkLabels([{ id: 'a', name: 'Ally', linked: 'not needed' }])('a'), 'Ally', 'a name that is not shared needs no day');

  // the label is the name inside an item failure, and the banner does not say it twice
  const loginRequired = Object.assign(new Error('Request failed with status code 400'), {
    isAxiosError: true,
    response: { status: 400, data: { error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'the login details of this item have changed', request_id: 'req_rh' } },
  });
  const label = labelOf('l1');
  const failure = itemFailure('transactions', label, loginRequired);
  assert.equal(failure.message, 'Robinhood (linked Mar 3, 2026) needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)');
  const line = failedLine(label, failure);
  assert.equal(line, 'Robinhood (linked Mar 3, 2026) — needs to be reconnected (Plaid: ITEM_LOGIN_REQUIRED)');
  assert.equal(line.split('Robinhood').length - 1, 1, 'named once');
  // and in the progress line
  assert.equal(progressLine(labelOf('l3'), 'investments', 500, 712), 'Still pulling — Robinhood (linked Aug 21, 2026): investments 500 of 712');
  // two links, one bank, in one answer: each its own outcome, each its own key
  const items = [
    { institution: labelOf('l1'), key: 'l1', stages: [failure] },
    { institution: labelOf('l3'), key: 'l3', stages: [stageOk('transactions', { landed: 3 })] },
  ];
  assert.deepEqual(items.map(itemStatus), ['failed', 'ok']);
  assert.equal(syncItemsEnvelope(items).status, 207);
});

// ── T11 ──────────────────────────────────────────────────────────────────────

test('T11 the 202 body as written, the progress lines and the two constants', () => {
  assert.equal(SYNC_PAGE_SIZE, 250, 'SYNC-02: half of the 500 Plaid allows — a Wells Fargo transaction is about 1.9 kB on the wire and a 500-row page crossed the 1,048,576 bytes one stored answer may hold; at 250 a page is about half that limit');
  assert.equal(SYNC_BUDGET_MS, 20_000);
  assert.deepEqual([...SYNC_STAGES], ['transactions', 'investments', 'holdings']);
  assert.deepEqual([pageOf(0), pageOf(249), pageOf(250), pageOf(500)], [1, 1, 2, 3], 'a page\'s number is its offset\'s page — the same whether or not the run was cut before it');
  assert.equal(progressLine('Robinhood', 'transactions', 1500, 4812), 'Still pulling — Robinhood: transactions 1,500 of 4,812');
  assert.equal(progressLine('Robinhood', 'investments', 0, null), 'Still pulling — Robinhood: investments next');

  const more: SyncMore = { item: 'link_b', stage: 'transactions', offset: 1500, counts: { landed: 1500, added: 41 } };
  const items = [{ institution: 'Ally', key: 'link_a', stages: [stageOk('transactions', { pulled: 9, plaid_total: 9 }, '2026-11-09')] }];
  const progress = progressLine('Robinhood', 'transactions', 1500, 4812);
  assert.deepEqual(moreEnvelope(more, items, progress), {
    status: 202,
    body: { ok: true, more, items, progress, lines: [progress], message: progress },
  });
  // the budget: the first ask is always allowed; after it, only inside the budget
  let now = 1000;
  const budget = runBudget(() => now);
  assert.equal(budget.mayAsk(), true);
  now += 60_000;
  assert.equal(budget.mayAsk(), true, 'no ask made yet — the request still makes its one');
  budget.asked();
  assert.equal(budget.mayAsk(), false, 'one ask made and the budget spent — it stops before the next');
  assert.equal(budget.asks(), 1);
  assert.equal(budget.elapsedMs(), 60_000);
  const inside = runBudget(() => now);
  inside.asked();
  now += SYNC_BUDGET_MS - 1;
  assert.equal(inside.mayAsk(), true);
  now += 1;
  assert.equal(inside.mayAsk(), false, 'at the budget, not after it');
});

// ── T12 ──────────────────────────────────────────────────────────────────────

test('T12 the route binds the loop: the three gates stand before the resume point is read; the one page size in both paged stages over the same range; a link with no accounts is not asked; the run module is pure', () => {
  const route = code('src/app/api/transactions/sync-complete/route.ts');
  const at = (needle: string) => { const i = route.indexOf(needle); assert.ok(i > -1, `the route holds ${needle}`); return i; };
  // the three gates, in order, before the body is read and before any Plaid ask
  const order = ['const userEmail = await getVerifiedEmail();', 'const user = await prisma.users.findUnique({', "const tabGate = await requireTabAccess(user.id, 'tab:books');", 'if (tabGate) return tabGate;', 'const plaidItems = await prisma.plaid_items.findMany({', 'readResume(await request.text(),', 'plaidClient.transactionsGet({'].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'verified email → the user → the books gate → the caller\'s own live links → the resume point → Plaid');
  assert.ok(route.includes('if (!resumeRead.ok) return NextResponse.json(resumeRead.body, { status: resumeRead.status });'), 'a refused point answers before anything is asked');
  // SYNC_PAGE_SIZE, twice; no page size is typed in the route; the range does not move
  assert.equal(route.split('count: SYNC_PAGE_SIZE').length - 1, 2, 'both paged stages ask SYNC_PAGE_SIZE');
  assert.equal(/count:\s*\d/.test(route), false, 'no page size is typed in the route');
  assert.equal(route.split("start_date: '2024-01-01',").length - 1, 2);
  assert.equal(route.split("end_date: new Date().toISOString().split('T')[0],").length - 1, 2);
  assert.ok(route.includes('export const maxDuration = 300;'), 'maxDuration stays');
  // the three endpoints, each asked in exactly one place
  for (const ask of ['plaidClient.transactionsGet(', 'plaidClient.investmentsTransactionsGet(', 'plaidClient.investmentsHoldingsGet(']) assert.equal(route.split(ask).length - 1, 1, `${ask} once`);
  // a link with no accounts is not asked; every outcome carries its key; the 202 is the pure module's
  assert.ok(route.includes('idle: (item) => item.accounts.length === 0,'));
  assert.ok(route.includes('key: (item) => item.id,') && route.includes('key: r.id,'), 'live and retired links carry the plaid_items row id');
  assert.ok(route.includes('select: { id: true, institutionName: true, retired_reason: true, retired_at: true },'), 'the retired read selects the id');
  assert.ok(route.includes('const { status, body } = moreEnvelope(walked.more, walked.items, walked.progress);'));
  assert.equal(route.includes('syncEachItem'), false, 'one walker — the old one is gone');
  // the run module: pure — it imports the fail-loud leaf and nothing else
  const run = code('src/lib/plaid/syncRun.ts');
  assert.deepEqual([...run.matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['./failLoud']);
  assert.equal(/prisma|plaidClient|next\/server|process\.env|Date\.now\(|new Date\(/.test(run), false, 'no Prisma, no Plaid client, no Next import, no clock of its own');
  assert.equal(/\?\?\s*0|\|\|\s*0/.test(run), false, 'no figure is defaulted');
});

// ── T13 ──────────────────────────────────────────────────────────────────────

test('T13 SYNC-02 a stage of 1,000 objects — four full pages — asks at 0, 250, 500 and 750 and pulls 1,000 of 1,000; no fifth ask is made', async () => {
  const db = database([]);
  const plaid = bank(HISTORY.slice(0, 1000));
  const hooks: string[] = [];
  const budget = unhurried();
  const outcome = stageOf(await pagedStage(ports(db, plaid, hooks), FRESH, budget));
  assert.deepEqual(plaid.asked, [0, 250, 500, 750], 'four asks of 250 — the total is reached on a full last page, and the loop does not ask a fifth, empty one');
  assert.equal(budget.asks(), 4);
  assert.deepEqual(outcome, {
    stage: 'transactions', ok: true,
    counts: { landed: 1000, already_landed: 0, corrected: 0, synced: 1000, skipped: 0, unheld: 0, added: 1000, pending_unlisted: 0, pending_unlisted_left: 0, pulled: 1000, plaid_total: 1000 },
    through: '2026-11-09',
  });
  // the bank's line, as the banner writes it from this outcome
  assert.equal(bankLine({ institution: 'Wells Fargo', key: LINK, stages: [outcome] }), 'Wells Fargo — transactions 1,000 of 1,000 pulled, 1,000 new, latest Nov 9, 2026');
  // one answer landed per ask — pages 1 to 4, 250 objects each (the fake wire states the page and its count)
  assert.deepEqual(db.landing.responses.map((r) => r.body.toString('utf8')), [1, 2, 3, 4].map((page) => JSON.stringify({ page, n: 250 })));
  assert.equal(db.landing.arrivals.size, 1000);
  assert.equal(db.domain.rows.size, 1000, 'the table holds every object');
  assert.deepEqual(hooks, ['first', 'answered', 'through'], 'the first answer once; Plaid answered; the newest date read once, at the end');
});
