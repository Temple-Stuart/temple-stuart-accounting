/**
 * REBUILD-01 PR-2 — one page of /transactions/get, raw-first, in ONE database
 * transaction:
 *
 *   landResponse → landObjects → the parser writes transactions rows FROM THE
 *   ARRIVAL PAYLOADS (never from response.data) and sets transactions.arrival_id
 *   → each new arrival's read = now, status = done.
 *
 * A parser throw rolls the whole page back (the response row, the page's
 * arrivals, its domain writes) and the caller answers with the HYG-01 envelope
 * carrying stage 'transactions', the page number and the summarized error; the
 * landed rows of earlier pages stay. Three outcomes per object, counted apart:
 * landed (a new id) · already_landed (same id, same content — LINKED through
 * transactions.arrival_id, never re-parsed; promise 2 working) · corrected
 * (same id, new content — a NEW arrival row, parsed; the upsert applies it, so
 * latest-arrived wins and arrival_id moves to the newest row; promise 1).
 *
 * A non-2xx answer lands as evidence of the ask — one provider_responses row
 * (exact bytes, http_status, asked, arrived), no arrivals — before the stage
 * declares its failure (recordFailedAnswer).
 *
 * The parser itself is sync-complete's existing domain logic, moved here: the
 * "complete data" skip and the upsert (promise 1 on the domain table is PR-2b).
 * It deletes nothing.
 *
 * PENDING-01 (Alex, 2026-11-11): THE SYNC CLEARS A PENDING ROW ONLY ON PLAID'S
 * OWN WORD, AND NEVER A COMMITTED ONE. Until then the parser deleted, for every
 * posted transaction it PARSED, every pending row of the same account and
 * amount dated within two days — a guess, whatever had been posted from that
 * row, and never for a posted transaction that had already landed. The guess is
 * gone. Once per page, after the page's objects are parsed and before they are
 * marked read, the page takes the `pending_transaction_id` of each POSTED
 * object it holds — landed, already landed and corrected alike, as the table
 * holds them — whose account this link holds, drops any id the same page still
 * lists as a pending object (replacedPendingIds), and hands what is left, with
 * the link's own account row ids, to ONE port method
 * (DomainDb.clearReplacedPending). A pending row those ids name, on those
 * accounts, is then exactly one of THREE things, and the method answers a
 * count of each — carried by the page only when the step ran:
 *   pending_cleared  deleted: NOT committed, no live posting, and nothing
 *                    points at it;
 *   pending_kept     left in place: committed, or carrying a live posting;
 *   pending_linked   left in place: NOT committed, no live posting, and a
 *                    booking link or a settled refund points at it (part 3,
 *                    the ruling of 2026-11-11: both foreign keys are ON
 *                    DELETE RESTRICT, so the database refuses that delete —
 *                    the step never tries, and the row is counted).
 * The three add up to the rows named, and nothing about a row that is left
 * changes.
 *
 * PENDING-03 (Alex, 2026-11-11 12:08: "get bookkeeping full proof"): A PENDING
 * ROW THE BANK NO LONGER LISTS IS CLEARED — the pull's SECOND delete. The first
 * clears a pending row only when a posted charge NAMES it, so a hold the bank
 * dropped, or a charge whose posted copy Plaid did not link to it, was cleared
 * by nothing: it sat in the queue, marked pending at the bank, where it cannot
 * be committed (production, 2026-11-11 20:10: 35 of the 43 pending rows held,
 * December 2025 to September 2026, on no page of the night's pulls). Once per
 * page, right after the first step and before the page is marked read, the
 * page reads its own WINDOW (pageWindow) — its newest day, its oldest day and
 * every id it lists, over every object whichever account it is for — and hands
 * it, with the link's own account row ids and the ids the first step was
 * handed, to ONE more port method (DomainDb.clearUnlistedPending). Plaid lists
 * a link's transactions newest first, so a page holds EVERY transaction the
 * bank lists for the link dated strictly between those two days: a held
 * pending row of the link's own accounts, dated strictly between them, that
 * the page does not list is no longer listed by the bank. Nothing is matched
 * by amount, by name or by nearness of date. Two counts, carried by the page
 * only when the step ran:
 *   pending_unlisted       deleted;
 *   pending_unlisted_left  left in place: committed, carrying a live posting,
 *                          or pointed at by a booking link or a settled
 *                          refund.
 *
 * THE PULL'S TWO DELETES, AND WHAT EACH ONE NEVER TOUCHES. Both delete bank
 * rows (transactions) only — never a journal or a ledger row — and only
 * PENDING rows on the accounts of the caller's own link: a posted row is never
 * judged. Neither takes a row that is committed, that carries a live posting,
 * or that a booking link or a settled refund points at: such a row is left
 * exactly as it is, and counted. The first never takes a row no posted object
 * of the page names; the second never takes a row the page lists, a row the
 * first was handed, or a row dated on the page's first or last day or outside
 * them. Nothing else in the sync deletes a transactions row.
 *
 * FX-01 (Alex, 2026-10-30, ruling E): the parser keeps Plaid's own word for the
 * row's currency — transactions.iso_currency_code, NULL when Plaid states none.
 * unofficial_currency_code is NOT kept: a row Plaid states only in an unofficial
 * code (a cryptocurrency, a currency with no ISO code) lands with a NULL iso code
 * and is refused at commit by name (src/lib/books/functionalCurrency.ts
 * postingCurrencyRule). The domain binding's DATA_KEYS (prismaDomain.ts) names
 * the same key — the two move together, or the binding refuses the unknown key.
 */
import type { Transaction } from 'plaid';
import { calendarDay, stageFailed, type StageFailed } from '@/lib/plaid/failLoud';
import type { WireStamp } from '@/lib/plaid/wire';
import { ResponseTooLargeError, landObjects, landResponse, markRead, type JsonObject, type LandingDb } from './land';

export const PLAID = 'plaid';
export const TRANSACTION = 'transaction';

export interface ExistingTxn {
  transactionId: string;
  personal_finance_category: unknown;
}

export interface PageAccount {
  id: string;
  accountId: string;
}

/**
 * PENDING-01: what the page's pending step answers. Each pending row the ids name, on the link's accounts, is exactly
 * one of three things: deleted (pending_cleared); left in place because it is committed or carries a live posting
 * (pending_kept); left in place because, though it is neither, a booking link or a settled refund points at it
 * (pending_linked — part 3). The three add up to those rows.
 */
export interface ReplacedPendingAnswer {
  pending_cleared: number;
  pending_kept: number;
  pending_linked: number;
}

/**
 * PENDING-03: what the page's second pending step answers. Each pending row of the link's accounts that is dated
 * strictly inside the page's window and that the page does not account for is one of two things: deleted
 * (pending_unlisted), or left in place because it is committed, carries a live posting, or a booking link or a settled
 * refund points at it (pending_unlisted_left). The two add up to those rows.
 */
export interface UnlistedPendingAnswer {
  pending_unlisted: number;
  pending_unlisted_left: number;
}

/** The subset of the Prisma transaction client the parser writes through (typed loosely so a fake can stand in), and the page's two pending steps. */
export interface DomainDb {
  transactions: {
    upsert(args: { where: { transactionId: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<unknown>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
  };
  /**
   * PENDING-01 — THE PULL'S FIRST DELETE. `transactionIds` are the pending charges Plaid names as replaced by a posted
   * charge of this page; `accountIds` are the row ids of the link's own accounts. A transactions row whose
   * transactionId is one of those ids, whose `pending` is true, on one of those accounts, is exactly one of three
   * things, and the answer counts each:
   *   pending_cleared — DELETED: it is NOT committed (review_status is not 'committed'), it carries no live posting
   *     (no journal_entries row with source_type 'plaid_txn', source_id = the row's transactionId, is_reversal false,
   *     reversed_by_entry_id null) AND nothing points at it (no transaction_reservation_links row with the row's id as
   *     its transactionId, whatever the link's status; no money_events row with the row's id as its
   *     settledTransactionId);
   *   pending_kept — left in place: committed, or carrying a live posting — whether or not something also points at it;
   *   pending_linked — left in place: NOT committed, no live posting, and a booking link or a settled refund points at
   *     it. Both foreign keys are ON DELETE RESTRICT — the database refuses to delete such a row — so the step never
   *     tries (part 3, the ruling of 2026-11-11).
   * The three counts add up to the rows the ids name. Nothing about a row that is left changes.
   */
  clearReplacedPending(args: { accountIds: string[]; transactionIds: string[] }): Promise<ReplacedPendingAnswer>;
  /**
   * PENDING-03 — THE PULL'S SECOND DELETE: A PENDING ROW THE BANK NO LONGER LISTS IS CLEARED.
   *
   * THE PREMISE. Plaid lists a link's transactions newest first (on production every one of the 270 pages stored
   * since October is in date order — 42,190 transactions, 0 out of order; Alex's psql, 2026-11-11). So a page is one
   * unbroken run of that list and holds EVERY transaction the bank lists for the link dated strictly between the
   * page's newest day and its oldest day: anything newer sits on an earlier page, anything older on a later one.
   *
   * THE RULE. `accountIds` are the row ids of the link's own accounts; `newestDay` and `oldestDay` are the page's two
   * days ('YYYY-MM-DD'); `accountedIds` are the ids the page accounts for — every id it lists, and the ids the first
   * step was handed (those are that step's, whatever it did with them). A transactions row whose `pending` is true, on
   * one of those accounts, whose day is strictly after the oldest day and strictly before the newest day, and whose
   * transactionId is none of those ids, is no longer listed by the bank. It is one of two things, and the answer
   * counts each:
   *   pending_unlisted — DELETED: it is NOT committed (review_status is not 'committed'), it carries no live posting
   *     (no journal_entries row with source_type 'plaid_txn', source_id = the row's transactionId, is_reversal false,
   *     reversed_by_entry_id null) AND nothing points at it (no transaction_reservation_links row with the row's id as
   *     its transactionId, whatever the link's status; no money_events row with the row's id as its
   *     settledTransactionId) — the first step's three conditions, word for word;
   *   pending_unlisted_left — left in place, because one of those three holds. Nothing about it changes.
   * The two counts add up to those rows. The rule reads PENDING rows only: a posted row is never judged. Nothing is
   * matched by amount, by name or by nearness of date.
   *
   * TWO THINGS IT DOES NOT DO.
   *   · It does not judge a row dated on the page's first or last day. A day can run on across a page's edge, so that
   *     row waits for a pull where its day falls strictly inside a page.
   *   · It does not follow a charge to a new day: the rule reads the day the ROW holds. A pending charge whose day the
   *     bank moved EARLIER since the last pull is cleared on the page of its old day and written again from the page
   *     that lists it, in the same pull — as a correction: a moved day is new content, and a correction is always
   *     parsed. (An object the store already holds word for word is linked, never parsed again; a row cleared while
   *     the bank lists it under such an object is not written again until that object changes.)
   */
  clearUnlistedPending(args: { accountIds: string[]; newestDay: string; oldestDay: string; accountedIds: string[] }): Promise<UnlistedPendingAnswer>;
}

export interface TransactionsPageInput {
  page: number;
  userId: string;
  /** The Plaid item this page belongs to — its item_id is the arrival's `connection`. */
  connection: string;
  accounts: PageAccount[];
  existing: Map<string, ExistingTxn>;
  /** The answer as it came off the wire. */
  wire: WireStamp;
  httpStatus: number;
  /** The objects in the answer — landed as they are; the parser never reads them. */
  transactions: Transaction[];
  now?: () => Date;
}

export interface PageCounts {
  landed: number;
  already_landed: number;
  corrected: number;
  synced: number;
  skipped: number;
  /** SYNC-01: objects for an account this link holds no row for — landed as arrivals, counted here, never written to the domain. */
  unheld: number;
  /** SYNC-01: objects written as a NEW row of the app — written, not as a correction, while `existing` held no row for the id. Not `landed`: a row the app already had can land in the store for the first time. */
  added: number;
  /** PENDING-01: pending rows deleted because a posted object of this page names them (DomainDb.clearReplacedPending). Carried ONLY by a page where that step ran. */
  pending_cleared?: number;
  /** PENDING-01: pending rows a posted object of this page names that were left in place — committed, or carrying a live posting. Carried ONLY by a page where the step ran. */
  pending_kept?: number;
  /** PENDING-01 part 3: pending rows a posted object of this page names that were left in place — NOT committed, no live posting, and a booking link or a settled refund points at them. Carried ONLY by a page where the step ran. */
  pending_linked?: number;
  /** PENDING-03: pending rows deleted because the bank no longer lists them — dated strictly inside this page's window and not accounted for by it (DomainDb.clearUnlistedPending). Carried ONLY by a page where that step ran — at zero too. */
  pending_unlisted?: number;
  /** PENDING-03: pending rows the bank no longer lists that were left in place — committed, carrying a live posting, or pointed at by a booking link or a settled refund. Carried ONLY by a page where the step ran — at zero too. */
  pending_unlisted_left?: number;
}

/** The existing domain write, from an arrival's payload. A correction never takes the complete-data skip: latest-arrived wins. */
async function parseTransaction(domain: DomainDb, ctx: TransactionsPageInput, arrivalId: string, txn: Transaction, counts: PageCounts, now: Date, correction: boolean): Promise<void> {
  const account = ctx.accounts.find((acc) => acc.accountId === txn.account_id);
  if (!account) { counts.unheld++; return; }

  const existing = ctx.existing.get(txn.transaction_id);
  if (!correction && existing && existing.personal_finance_category !== null) {
    // Already has complete data — skip expensive update; still point the row at its arrival.
    await domain.transactions.updateMany({ where: { transactionId: txn.transaction_id, arrival_id: null }, data: { arrival_id: arrivalId } });
    counts.skipped++;
    counts.synced++;
    return;
  }

  const t = txn as Transaction & Record<string, unknown>;
  const txnData = {
    amount: txn.amount,
    // FX-01 (2026-10-30, ruling E): Plaid's own word for the row's currency, or NULL when Plaid states
    // none. unofficial_currency_code is NOT kept: a row Plaid states only in an unofficial code lands
    // with a NULL iso code and is refused at commit by name (functionalCurrency.ts postingCurrencyRule).
    iso_currency_code: txn.iso_currency_code ?? null,
    date: new Date(txn.date),
    name: txn.name,
    merchantName: txn.merchant_name,
    category: txn.category?.join(', ') || null,
    pending: txn.pending || false,
    authorized_date: txn.authorized_date ? new Date(txn.authorized_date) : null,
    authorized_datetime: txn.authorized_datetime ? new Date(txn.authorized_datetime) : null,
    counterparties: t.counterparties || null,
    location: t.location || null,
    payment_channel: txn.payment_channel,
    payment_meta: t.payment_meta || null,
    personal_finance_category: t.personal_finance_category || null,
    personal_finance_category_icon_url: t.personal_finance_category_icon_url,
    transaction_code: txn.transaction_code,
    transaction_type: t.transaction_type,
    logo_url: t.logo_url,
    website: t.website,
    arrival_id: arrivalId,
    updatedAt: now,
  };

  await domain.transactions.upsert({
    where: { transactionId: txn.transaction_id },
    create: {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId: txn.transaction_id,
      accountId: account.id,
      ...txnData,
    },
    update: txnData,
  });
  counts.synced++;
  if (!correction && !existing) counts.added++;
}

/**
 * PENDING-01 — THE PENDING CHARGES THIS PAGE'S POSTED OBJECTS NAME. From EVERY object of the page as the table holds
 * it — landed, already landed and corrected alike — the `pending_transaction_id` of each POSTED object (its `pending`
 * is false) whose account this link holds. An id the same page still lists as a pending object is dropped: Plaid is
 * still listing that charge. Each id once, in the page's own order. Plaid's own word only — nothing here matches a row
 * by its account, its amount or its day.
 */
export function replacedPendingIds(rows: ReadonlyArray<{ payload: unknown }>, accounts: readonly PageAccount[]): string[] {
  const held = new Set(accounts.map((account) => account.accountId));
  const stillPending = new Set<string>();
  const named: string[] = [];
  for (const row of rows) {
    if (typeof row.payload !== 'object' || row.payload === null) continue;
    const object = row.payload as Partial<Transaction>;
    if (object.pending === true) {
      if (typeof object.transaction_id === 'string') stillPending.add(object.transaction_id);
      continue;
    }
    if (object.pending !== false) continue;
    const id = object.pending_transaction_id;
    if (typeof id !== 'string' || id.length === 0) continue;
    if (typeof object.account_id !== 'string' || !held.has(object.account_id)) continue;
    if (!named.includes(id)) named.push(id);
  }
  return named.filter((id) => !stillPending.has(id));
}

/** PENDING-03: a page's window — its newest day and its oldest day (Plaid's own `date`, 'YYYY-MM-DD'), and every transaction id it lists, each once, in the page's own order. */
export interface PageWindow {
  newestDay: string;
  oldestDay: string;
  listedIds: string[];
}

/**
 * PENDING-03 — THE PAGE'S WINDOW. Over EVERY object of the page as the table holds it — landed, already landed and
 * corrected alike, whichever account it is for (the link's list is ONE list, the accounts held here and the ones not
 * held alike): the day of its first object (the newest), the day of its last (the oldest), and every transaction id
 * it lists.
 *
 * WHY THE WINDOW IS EXACT. Plaid lists a link's transactions newest first, so a page is one unbroken run of that list:
 * anything newer than its first object sits on an earlier page, anything older than its last on a later one. Every
 * transaction the bank lists for the link dated STRICTLY BETWEEN the two days is therefore on this page. The two days
 * themselves are not covered — a day can run on across a page's edge. A page asked after the list moved (a charge
 * added or dropped above it between two asks) is still one unbroken run of the list as it stood at that ask.
 *
 * NO WINDOW — and the step does not run for the page — when the premise cannot be read off the page itself:
 *   · an object states no `date` that is a calendar day in the form YYYY-MM-DD (it cannot be placed), or no
 *     transaction id (it cannot be accounted for);
 *   · the days are not newest-first in the answer's order — the premise does not hold for that page;
 *   · the newest day is the oldest day — a page of one day, of one object or of none: nothing lies strictly between.
 * Nothing here reads an amount, a name or an account.
 */
export function pageWindow(rows: ReadonlyArray<{ payload: unknown }>): PageWindow | null {
  const listedIds: string[] = [];
  const listed = new Set<string>();
  let newestDay: string | null = null;
  let oldestDay: string | null = null;
  for (const row of rows) {
    if (typeof row.payload !== 'object' || row.payload === null) return null;
    const object = row.payload as Partial<Transaction>;
    const day = object.date;
    if (typeof day !== 'string' || calendarDay(day) === null) return null;
    const id = object.transaction_id;
    if (typeof id !== 'string' || id.length === 0) return null;
    // Newest first: a day is never after the day before it in the answer. 'YYYY-MM-DD' text orders as its days do.
    if (oldestDay !== null && day > oldestDay) return null;
    if (newestDay === null) newestDay = day;
    oldestDay = day;
    if (!listed.has(id)) {
      listed.add(id);
      listedIds.push(id);
    }
  }
  if (newestDay === null || oldestDay === null || newestDay === oldestDay) return null;
  return { newestDay, oldestDay, listedIds };
}

/** Inside the caller's transaction: land, parse from the table, mark read. Throws to roll the page back. */
export async function landTransactionsPage(landing: LandingDb, domain: DomainDb, input: TransactionsPageInput): Promise<PageCounts> {
  const now = input.now ?? (() => new Date());
  const counts: PageCounts = { landed: 0, already_landed: 0, corrected: 0, synced: 0, skipped: 0, unheld: 0, added: 0 };

  const response = await landResponse(landing, {
    provider: PLAID,
    resource: TRANSACTION,
    userId: input.userId,
    guestRef: null,
    httpStatus: input.httpStatus,
    body: input.wire.body,
    asked: input.wire.asked,
    arrived: input.wire.arrived,
  });

  const landed = await landObjects(landing, {
    provider: PLAID,
    resource: TRANSACTION,
    connection: input.connection,
    userId: input.userId,
    guestRef: null,
    responseId: response.id,
    asked: input.wire.asked,
    arrived: input.wire.arrived,
    objects: input.transactions.map((t) => ({ theirId: t.transaction_id, payload: t as unknown as JsonObject })),
  });
  counts.landed = landed.landed;
  counts.already_landed = landed.alreadyLanded;
  counts.corrected = landed.corrected;

  const at = now();
  const newRowIds: string[] = [];
  for (const row of landed.rows) {
    if (row.outcome === 'already_landed') {
      // Promise 2: the table already holds this content — link the domain row, never re-parse.
      await domain.transactions.updateMany({ where: { transactionId: row.their_id, arrival_id: null }, data: { arrival_id: row.id } });
      continue;
    }
    newRowIds.push(row.id);
    // The parser reads the arrival, never the HTTP object; a correction is applied (latest-arrived wins).
    await parseTransaction(domain, input, row.id, row.payload as Transaction, counts, at, row.outcome === 'corrected');
  }

  // PENDING-01: THE EXACT RULE, once per page — after the page's objects are parsed, before they are marked read.
  // The pending charges this page's posted objects name (replacedPendingIds: Plaid's own pending_transaction_id, never
  // a guess) go to the one port method with the link's own account row ids. A page that names none does not run the
  // step and carries none of its three counts.
  const replaced = replacedPendingIds(landed.rows, input.accounts);
  if (replaced.length > 0) {
    const answer = await domain.clearReplacedPending({ accountIds: input.accounts.map((account) => account.id), transactionIds: replaced });
    counts.pending_cleared = answer.pending_cleared;
    counts.pending_kept = answer.pending_kept;
    counts.pending_linked = answer.pending_linked;
  }

  // PENDING-03: THE SECOND RULE, once per page — right after the replaced step, before the page is marked read. The
  // page's own window (pageWindow: its newest day, its oldest day, every id it lists — over every object, whichever
  // account it is for) goes to the one port method with the link's own account row ids and the ids this page accounts
  // for: every id it lists, and the ids the replaced step was handed (those are that step's, whatever it did with
  // them). A page with no window does not run the step and carries neither of its two counts. Nor does a link that
  // holds no account row: it has nothing to judge.
  const span = input.accounts.length > 0 ? pageWindow(landed.rows) : null;
  if (span !== null) {
    const answer = await domain.clearUnlistedPending({
      accountIds: input.accounts.map((account) => account.id),
      newestDay: span.newestDay,
      oldestDay: span.oldestDay,
      accountedIds: [...span.listedIds, ...replaced.filter((id) => !span.listedIds.includes(id))],
    });
    counts.pending_unlisted = answer.pending_unlisted;
    counts.pending_unlisted_left = answer.pending_unlisted_left;
  }

  await markRead(landing, newRowIds, at);
  return counts;
}

/** A failed ask is evidence of the ask: land the non-2xx answer's bytes (no arrivals). A network failure with no answer lands nothing. PR-2c: the investments phase names its resource. */
export async function recordFailedAnswer(landing: LandingDb, input: { userId: string; err: unknown; now?: () => Date; resource?: string }): Promise<{ landed: boolean; status?: number }> {
  const response = (err_has_response(input.err) ? input.err.response : undefined);
  if (!response?.wire) return { landed: false };
  await landResponse(landing, {
    provider: PLAID,
    resource: input.resource ?? TRANSACTION,
    userId: input.userId,
    guestRef: null,
    httpStatus: response.status,
    body: response.wire.body,
    asked: response.wire.asked,
    arrived: response.wire.arrived,
  });
  return { landed: true, status: response.status };
}

function err_has_response(err: unknown): err is { response?: { status: number; wire?: WireStamp } } {
  return typeof err === 'object' && err !== null && 'response' in err;
}

export interface PageClient {
  $transaction<T>(fn: (tx: unknown) => Promise<T>, options?: { maxWait?: number; timeout?: number }): Promise<T>;
}

export type PageResult = { ok: true; counts: PageCounts } | { ok: false; failure: StageFailed & { page: number } };

/** The ports a page runs through. PERF-01: a domain port that BUFFERS its writes (prismaDomain) hands back `finish`, replayed inside the same transaction after the parser is done. */
export interface PagePorts {
  landing: LandingDb;
  domain: DomainDb;
  finish?: () => Promise<void>;
}

/**
 * SYNC-02 (Alex, 2026-11-11 16:25) — HOW A PAGE RUNNER'S CATCH DECLARES WHAT WAS THROWN. The three runners — this
 * file's, plaidInvestmentsPage.ts and plaidHoldingsPage.ts — hand their catch here: the one place. The failure is the
 * same failure it was (failLoud.ts stageFailed): the page has rolled back whole and its stage ends there. Its words
 * change for one throw only. The store's refusal of an answer too large to hold (land.ts ResponseTooLargeError) is the
 * product's own sentence, so it is handed to the bank's line as the failure's `message` — the emptyPageFailure
 * precedent (src/lib/plaid/syncRun.ts) — and the line reads
 *   <bank> — transactions page 7: the answer is 1,180,442 bytes — over the 1,048,576 one stored answer may hold; nothing from it was written
 * with no error-class name in front. Every other error keeps the words it had: `<error name>: <error message>`, or
 * Plaid's own code. The failure's `error` — the summary the server logs — still names the class.
 */
export function pageFailed(stage: string, error: unknown, page?: number): StageFailed {
  const failure = stageFailed(stage, error, page);
  return error instanceof ResponseTooLargeError ? { ...failure, message: error.message } : failure;
}

/** One page, one transaction. A throw inside rolls the page back and comes out as the declared failure. */
export async function runTransactionsPage(
  client: PageClient,
  ports: (tx: unknown) => PagePorts,
  input: TransactionsPageInput,
): Promise<PageResult> {
  try {
    const counts = await client.$transaction(async (tx) => {
      const { landing, domain, finish } = ports(tx);
      const result = await landTransactionsPage(landing, domain, input);
      // PERF-01: the batching binding's statements run here — still this transaction, still rolled back whole on a throw.
      if (finish) await finish();
      return result;
    }, { maxWait: 10_000, timeout: 120_000 });
    return { ok: true, counts };
  } catch (error) {
    return { ok: false, failure: { ...pageFailed('transactions', error, input.page), page: input.page } };
  }
}
