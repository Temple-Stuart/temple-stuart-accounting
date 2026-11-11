/**
 * SYNC-01 (Alex, 2026-11-11 12:40: "my bank trannies were not pulling for like not everything... we need to get this
 * working 100% today" · 12:54: "lets get the sync fixed. so everything pulls") — THE RUN.
 *
 * Until this, one request re-downloaded every bank's whole history since 2024-01-01, bank after bank, inside Vercel's
 * 300 s. It was made faster twice (8851bba, 2026-02-21; PERF-01, 2026-09-05) while the history kept growing; when it
 * was cut, the banks at the end of the order were never asked and the next press began again at the first bank.
 *
 * THE RUN IS ONE RUN, CUT INTO REQUESTS. A request works until it has spent its budget, then stops BEFORE the next
 * Plaid ask and answers 202 with the point it stopped at (`more`). The next request carries that point back and
 * continues exactly there — the same item order, that item, that stage from that offset with those counts, then every
 * later stage and every later item, never an earlier one. Nothing is asked twice: this is not a retry (HYG-01's "no
 * retries" stands — src/lib/plaid/failLoud.ts). Every request makes at least one ask, so the run always moves.
 *
 * What this file holds, and all it holds:
 *   · the paging loop (pagedStage): ask → land → count → next offset → look at the clock;
 *   · the walk over items and stages with its resume point (walkItems) — the ONE walker (it was failLoud.ts
 *     syncEachItem): every item runs every stage whatever the others did; a runner that throws is a declared failure;
 *   · the request's budget (runBudget), the check of a resume point sent back by a browser (readResume), the name
 *     each link carries in a run (linkLabels), the note for an account Plaid lists that the app does not hold
 *     (unheldNotes), the progress line and the 202 body (moreEnvelope).
 *
 * PURE, OVER PORTS: no Prisma, no Plaid client, no Next import. The route (src/app/api/transactions/sync-complete/
 * route.ts) binds Prisma and Plaid into the ports and keeps the gates, the reads, the balance update, the page's own
 * transaction, the failed-answer landing and the ITEM_ERROR record; node:test drives this very loop with fakes.
 *
 * Fail loud: an empty page under a larger total is a declared failure, never a loop; an object for an account the
 * link holds no row for is counted (`unheld`), never dropped without a word; nothing here defaults a figure.
 */
import { calendarDay, stageFailed, stageOk, thousands, type Envelope, type ItemOutcome, type StageFailed, type StageOutcome } from './failLoud';

/**
 * SYNC-02 (Alex, 2026-11-11 16:25) — THE PAGE FITS WHAT THE STORE HOLDS. 250 objects an ask, for `options.count` on
 * /transactions/get and /investments/transactions/get alike. Why 250, with the numbers:
 *
 *   · Plaid allows up to 500 (its default is 100). SYNC-01 asked for the 500.
 *   · One stored answer may hold 1,048,576 bytes — provider_responses_body_size_chk, CHECK (octet_length(body) <=
 *     1048576), prisma/migrations/20260903000000_arrivals/migration.sql:62.
 *   · A Wells Fargo transaction is about 1.9 kB on the wire (34 MB over 178 pages of 100 on 2026-10-20), so 500 of
 *     them are about 950 kB before the answer's accounts and item are counted — and on 2026-11-11 a 500-row page
 *     crossed the limit: pages 1–3 slipped under it, page 4 did not, rolled back and ended its stage.
 *   · At 250 a page is about 475 kB: about half the limit.
 *   · Plaid allows 30 asks a minute per link — 7,500 rows a minute at this size.
 *
 * Only the size of an ask moves. The resume point is an offset, never a page, so a run cut before this change
 * continues where it stopped.
 */
export const SYNC_PAGE_SIZE = 250;

/**
 * What one request may spend before it stops ahead of the next ask. 20 s, not more: a page begun inside the budget
 * runs its own database transaction, which may take 130 s (maxWait 10 s + timeout 120 s —
 * src/lib/arrivals/plaidTransactionsPage.ts runTransactionsPage), and must still end well inside maxDuration 300.
 */
export const SYNC_BUDGET_MS = 20_000;

/** The stages of one link, in the order they run. */
export const SYNC_STAGES = ['transactions', 'investments', 'holdings'] as const;
export type SyncStage = (typeof SYNC_STAGES)[number];

/** A link that holds no accounts in this app is not asked: there is no row its objects could be written to. */
export const IDLE_NO_ACCOUNTS = 'holds no accounts in this app — nothing was asked of Plaid';

/** Where a run stopped, and so where the next request continues: the plaid_items row id, the stage, the objects already taken from Plaid in that stage, and that stage's counts so far. */
export interface SyncMore {
  item: string;
  stage: SyncStage;
  offset: number;
  counts: Record<string, number>;
}

/** Where a stage starts in this request: 0 and no counts on a fresh stage; a resume point's offset and counts on a continued one. */
export interface StageStart {
  offset: number;
  counts: Record<string, number>;
}

// ─── THE BUDGET ───────────────────────────────────────────────────────────────

/** The request's clock: how many asks it has made, and whether it may make another. */
export interface RunBudget {
  /** True for the request's first ask, whatever the clock says; after that, only while the budget is unspent. */
  mayAsk(): boolean;
  /** An ask is being made — counted when it is attempted, whether or not Plaid answers. */
  asked(): void;
  asks(): number;
  elapsedMs(): number;
}

export function runBudget(now: () => number, budgetMs: number = SYNC_BUDGET_MS): RunBudget {
  const started = now();
  let asks = 0;
  return {
    mayAsk: () => asks === 0 || now() - started < budgetMs,
    asked: () => { asks += 1; },
    asks: () => asks,
    elapsedMs: () => now() - started,
  };
}

// ─── ONE STAGE ────────────────────────────────────────────────────────────────

/** What a stage hands back to the walk: its declared outcome, or the point it stopped at because the request's budget is spent. */
export type StageStep =
  | { kind: 'done'; outcome: StageOutcome; notes?: string[] }
  | { kind: 'more'; offset: number; counts: Record<string, number>; total: number | null };

/** One answer to one ask: how many objects it carried, and Plaid's own total for the range. */
export interface PageAnswer {
  objects: number;
  total: number;
}

export type PageLanded = { ok: true; counts: Record<string, number> } | { ok: false; failure: StageFailed };

/** The ports of a paged stage. The route binds Plaid and Prisma; a test binds fakes. */
export interface PagedPorts<A extends PageAnswer> {
  stage: SyncStage;
  /** One ask at `offset` for SYNC_PAGE_SIZE objects. A throw is the ask's own failure — declared through `declare`. */
  ask(offset: number, page: number): Promise<A>;
  /** Land one answer in its own database transaction and hand back the page's counts; a rolled-back page is `ok: false`. */
  land(answer: A, page: number): Promise<PageLanded>;
  /** 'YYYY-MM-DD' — the newest date the app now holds for this link in this stage's table, or null when it holds none. Read once, when the stage completes. */
  through(): Promise<string | null>;
  /** Declare a thrown failure (the route names the link and records an ITEM_ERROR on it). */
  declare(error: unknown): Promise<StageFailed>;
  /** The answer at offset 0 — the route updates the balances of the account rows it already holds. */
  first?(answer: A): Promise<void>;
  /** Plaid answered in this request — the route clears a recorded ITEM_ERROR (a page failure is ours, not the link's state). */
  answered?(): Promise<void>;
  /** When the stage completes: one note per account in the last answer that the link holds no row for. */
  notes?(last: A): string[];
}

/** A page's number is its offset's page, so it is the same number whether or not the run was cut before it. */
export const pageOf = (offset: number): number => Math.floor(offset / SYNC_PAGE_SIZE) + 1;

/** Add one page's counts to the stage's. A count the stage has not seen yet starts at this page's value. */
function addCounts(into: Record<string, number>, page: Record<string, number>): void {
  for (const [name, value] of Object.entries(page)) {
    const had = into[name];
    into[name] = had === undefined ? value : had + value;
  }
}

/** Plaid said there is more and sent nothing: declared, with where it happened. Never a loop. */
export function emptyPageFailure(stage: SyncStage, offset: number, total: number, page: number): StageFailed {
  const words = `Plaid answered an empty page at ${thousands(offset)} of ${thousands(total)}`;
  return { ...stageFailed(stage, new Error(words), page), message: words };
}

/**
 * THE PAGING LOOP — written once. ask → land → count → next offset → look at the clock.
 *
 * It stops in one of three ways: the stage is complete (Plaid's total is reached) — ok, with what it pulled; a
 * failure is declared (the ask threw, the page rolled back, or Plaid answered an empty page under a larger total);
 * or the request's budget is spent — it stops BEFORE the next ask and hands back the point to continue from.
 */
export async function pagedStage<A extends PageAnswer>(ports: PagedPorts<A>, from: StageStart, budget: RunBudget): Promise<StageStep> {
  const counts: Record<string, number> = { ...from.counts };
  let offset = from.offset;
  let total: number | null = null;
  let last: A | null = null;
  const plaidAnswered = async () => { if (last !== null && ports.answered) await ports.answered(); };
  try {
    for (;;) {
      if (!budget.mayAsk()) {
        await plaidAnswered();
        return { kind: 'more', offset, counts, total };
      }
      const page = pageOf(offset);
      budget.asked();
      const answer = await ports.ask(offset, page);
      last = answer;
      total = answer.total;
      if (offset === 0 && ports.first) await ports.first(answer);
      const landed = await ports.land(answer, page);
      if (!landed.ok) {
        await plaidAnswered();
        return { kind: 'done', outcome: landed.failure };
      }
      addCounts(counts, landed.counts);
      if (answer.objects === 0 && answer.total > offset) {
        await plaidAnswered();
        return { kind: 'done', outcome: emptyPageFailure(ports.stage, offset, answer.total, page) };
      }
      offset += answer.objects;
      if (!(answer.total > offset)) break;
    }
    // The loop asks before it can break, so a completed stage always holds its last answer; said, not assumed.
    if (last === null || total === null) throw new Error('syncRun: a paged stage completed without an answer');
    await plaidAnswered();
    const through = await ports.through();
    const outcome = stageOk(ports.stage, { ...counts, pulled: offset, plaid_total: total }, through === null ? undefined : through);
    const notes = ports.notes ? ports.notes(last) : [];
    return notes.length > 0 ? { kind: 'done', outcome, notes } : { kind: 'done', outcome };
  } catch (error) {
    return { kind: 'done', outcome: await ports.declare(error) };
  }
}

/** A stage that is one ask (holdings): the clock is looked at before it, like any other ask. `run` declares its own outcome. */
export async function askOnce(budget: RunBudget, run: () => Promise<StageOutcome>): Promise<StageStep> {
  if (!budget.mayAsk()) return { kind: 'more', offset: 0, counts: {}, total: null };
  budget.asked();
  return { kind: 'done', outcome: await run() };
}

// ─── THE WALK ─────────────────────────────────────────────────────────────────

export type StageRun<I> = (item: I, from: StageStart, budget: RunBudget) => Promise<StageStep>;
export type WalkStage<I> = readonly [stage: SyncStage, run: StageRun<I>];

export interface WalkInput<I> {
  /** The caller's live links, in the route's own order — the same order on every request of a run. */
  items: readonly I[];
  /** The plaid_items row id. */
  key(item: I): string;
  /** The link's one name in the run (linkLabels). */
  label(item: I): string;
  /** A live link that holds no accounts in this app. */
  idle(item: I): boolean;
  stages: ReadonlyArray<WalkStage<I>>;
  /** Where the last request stopped, or null for a fresh run. */
  resume: SyncMore | null;
  budget: RunBudget;
}

/**
 * What one request's walk comes to. `items`: the outcomes finished in THIS request — a live link is listed once it
 * has a finished stage, an idle link when the walk reaches it. `more`: null when the run is done; otherwise where
 * this request stopped, with the line to show while the run goes on.
 */
export type WalkResult =
  | { items: ItemOutcome[]; more: null }
  | { items: ItemOutcome[]; more: SyncMore; progress: string };

/** "Still pulling — Robinhood: transactions 1,500 of 4,812"; "… : investments next" when the stage has not asked yet. */
export function progressLine(label: string, stage: SyncStage, offset: number, total: number | null): string {
  return total === null
    ? `Still pulling — ${label}: ${stage} next`
    : `Still pulling — ${label}: ${stage} ${thousands(offset)} of ${thousands(total)}`;
}

/**
 * THE ONE WALKER. Every item runs every stage, in the order given, whatever any other item did (HYG-03). A runner
 * declares its own outcome; a runner that THROWS is itself a declared failure of that stage — never a silent skip,
 * never a halt. With a resume point the walk starts at that item and that stage and never visits an earlier one.
 */
export async function walkItems<I>(input: WalkInput<I>): Promise<WalkResult> {
  const { items, stages, resume, budget } = input;
  const done: ItemOutcome[] = [];
  let firstItem = 0;
  let firstStage = 0;
  if (resume !== null) {
    firstItem = items.findIndex((item) => input.key(item) === resume.item);
    firstStage = stages.findIndex(([stage]) => stage === resume.stage);
    if (firstItem < 0) throw new Error('syncRun: the resume point names a link this run does not hold');
    if (firstStage < 0) throw new Error('syncRun: the resume point names a stage this run does not have');
  }
  for (let i = firstItem; i < items.length; i += 1) {
    const item = items[i];
    const institution = input.label(item);
    const key = input.key(item);
    if (input.idle(item)) {
      done.push({ institution, key, stages: [], idle: IDLE_NO_ACCOUNTS });
      continue;
    }
    const finished: StageOutcome[] = [];
    const notes: string[] = [];
    const outcome = (): ItemOutcome => (notes.length > 0 ? { institution, key, stages: finished, notes } : { institution, key, stages: finished });
    const continued = resume !== null && i === firstItem;
    for (let s = continued ? firstStage : 0; s < stages.length; s += 1) {
      const [stage, run] = stages[s];
      const from: StageStart = continued && s === firstStage && resume !== null ? { offset: resume.offset, counts: resume.counts } : { offset: 0, counts: {} };
      let step: StageStep;
      try {
        step = await run(item, from, budget);
      } catch (err) {
        step = { kind: 'done', outcome: stageFailed(stage, err) };
      }
      if (step.kind === 'more') {
        if (finished.length > 0) done.push(outcome());
        return { items: done, more: { item: key, stage, offset: step.offset, counts: step.counts }, progress: progressLine(institution, stage, step.offset, step.total) };
      }
      finished.push(step.outcome);
      if (step.notes) notes.push(...step.notes);
    }
    done.push(outcome());
  }
  return { items: done, more: null };
}

/** The 202: the run is not done — where it stopped, what finished in this request, and the line to show meanwhile. */
export function moreEnvelope(more: SyncMore, items: ItemOutcome[], progress: string): Envelope {
  return { status: 202, body: { ok: true, more, items, progress, lines: [progress], message: progress } };
}

// ─── THE RESUME POINT A BROWSER SENDS BACK ────────────────────────────────────

export const RESUME_REFUSED = 'The sync could not continue from where it stopped — press Sync to start again.';
/** The words of src/lib/plaid/reconnect.ts ownedItemOr404 — a foreign id and an unknown one read the same, and confirm nothing. */
export const LINK_NOT_FOUND = 'Bank connection not found';

export type ResumeRead =
  | { ok: true; resume: SyncMore | null }
  | { ok: false; status: 400 | 404; body: { ok: false; stage: 'sync'; message: string } };

const refused = (status: 400 | 404, message: string): ResumeRead => ({ ok: false, status, body: { ok: false, stage: 'sync', message } });

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const hasExactly = (o: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(o);
  return own.length === keys.length && keys.every((k) => own.includes(k));
};
const MAX_COUNT_KEYS = 16;
const COUNT_NAME = /^[a-z_]+$/;

/**
 * Read the request's body, AFTER the gates. An empty body is a fresh run. Anything else must be exactly
 * `{ "resume": { item, stage, offset, counts } }` — the `more` of the last answer, unchanged — and is checked whole:
 * the stage one of the three, the offset a non-negative safe integer, the counts a plain object of at most 16
 * lower-case names with non-negative safe integers (a holdings point carries offset 0 and no counts: it is one ask).
 * A body that is not that is a 400. An `item` that is not one of the caller's own live links — foreign, unknown,
 * retired, not even a string — is the defensive 404.
 */
export function readResume(bodyText: string, liveItemIds: readonly string[]): ResumeRead {
  if (bodyText.trim() === '') return { ok: true, resume: null };
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return refused(400, RESUME_REFUSED);
  }
  if (!isPlainObject(body) || !hasExactly(body, ['resume'])) return refused(400, RESUME_REFUSED);
  const point = body.resume;
  if (!isPlainObject(point) || !hasExactly(point, ['item', 'stage', 'offset', 'counts'])) return refused(400, RESUME_REFUSED);
  const { item, stage, offset, counts } = point;
  if (typeof stage !== 'string' || !(SYNC_STAGES as readonly string[]).includes(stage)) return refused(400, RESUME_REFUSED);
  if (!isCount(offset)) return refused(400, RESUME_REFUSED);
  if (!isPlainObject(counts)) return refused(400, RESUME_REFUSED);
  const names = Object.keys(counts);
  if (names.length > MAX_COUNT_KEYS || !names.every((n) => COUNT_NAME.test(n) && isCount(counts[n]))) return refused(400, RESUME_REFUSED);
  if (stage === 'holdings' && (offset !== 0 || names.length > 0)) return refused(400, RESUME_REFUSED);
  if (typeof item !== 'string' || !liveItemIds.includes(item)) return refused(404, LINK_NOT_FOUND);
  return { ok: true, resume: { item, stage: stage as SyncStage, offset, counts: counts as Record<string, number> } };
}

// ─── THE NAMES ────────────────────────────────────────────────────────────────

/** A live link as the labels need it: its row id, the bank's name as the user knows it, and the UTC day it was linked ('YYYY-MM-DD'). */
export interface LinkName {
  id: string;
  name: string;
  linked: string;
}

/**
 * ONE NAME PER LINK IN A RUN. A link is named for its bank — unless two live links carry the same name, when each is
 * named `<Bank> (linked <Mon D, YYYY>)` so a line, a failure and the progress say which link they mean.
 */
export function linkLabels(links: readonly LinkName[]): (id: string) => string {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const link of links) {
    if (seen.has(link.name)) shared.add(link.name);
    seen.add(link.name);
  }
  const labels = new Map<string, string>();
  for (const link of links) {
    if (!shared.has(link.name)) { labels.set(link.id, link.name); continue; }
    const day = calendarDay(link.linked);
    if (day === null) throw new Error('syncRun: a link names no calendar day it was linked on');
    labels.set(link.id, `${link.name} (linked ${day})`);
  }
  return (id: string) => {
    const label = labels.get(id);
    if (label === undefined) throw new Error('syncRun: no label for a link outside this run');
    return label;
  };
}

/** An account as Plaid lists it under a link — the four fields a note names. */
export interface ListedAccount {
  account_id: string;
  name: string;
  mask: string | null;
  type: string;
}

/**
 * One note per account Plaid lists under the link that the link holds no row for: `<name> ••<mask> (<type>)` — the
 * mask left out when Plaid states none. The app creates no account row here; the note is how the gap is said.
 */
export function unheldNotes(listed: readonly ListedAccount[], heldAccountIds: readonly string[]): string[] {
  return listed
    .filter((account) => !heldAccountIds.includes(account.account_id))
    .map((account) => `${account.name}${account.mask ? ` ••${account.mask}` : ''} (${account.type})`);
}
