/**
 * PERF-01 — the Prisma-backed DomainDb that lands a page's domain writes in
 * ONE statement per kind instead of one per row.
 *
 * sync-complete hit Vercel's 300 s ceiling on the first full pull after PR-2.
 * The landing side was already batched (prismaLanding: one INSERT … ON
 * CONFLICT DO NOTHING RETURNING, one SELECT, one UPDATE per page); the domain
 * loop was not — the parser (plaidTransactionsPage.ts) issued one upsert per
 * transaction, one DELETE per posted transaction (the pending-duplicate guess
 * PENDING-01 removed, below) and one UPDATE per repeated object (the
 * arrival_id link): ~900 statements, ~900 Azure round trips, for a 500-object
 * page.
 *
 * The parser still speaks the per-row DomainDb port, so the landing tests (a
 * fake DomainDb) prove its semantics. THIS binding buffers the parser's
 * intents, in order, and `finish()` — called by runTransactionsPage inside the
 * same page transaction — replays them as:
 *
 *   1. one INSERT … ON CONFLICT ("transactionId") DO UPDATE for every upsert
 *      (Prisma's own upsert is that statement, one row at a time);
 *   2. one UPDATE … FROM (VALUES …) for the arrival_id links (arrival_id IS
 *      NULL, as the parser's updateMany says).
 *
 * The plan (planDomainWrites) is pure and reproduces the sequential order's
 * result exactly: same id twice → the first row's create fields, the last
 * row's data; a link for an id the page also upserts is a no-op (the upsert
 * sets arrival_id). It holds upserts and links, and nothing else. An intent
 * shape the parser does not issue is a throw, never a per-row fallback.
 *
 * PENDING-01 (Alex, 2026-11-11): THE GUESS IS GONE. Until then the parser also
 * issued one DELETE per posted transaction — every pending row of the same
 * account and amount dated within two days — and this binding replayed it as a
 * DELETE … USING (VALUES …) plus a DELETE by id for in-page rows. The parser
 * deletes nothing now, and neither does the plan. The pull's FIRST delete is
 * the page's replaced step (DomainDb.clearReplacedPending): the pending rows Plaid
 * NAMES as replaced by a posted charge, on the link's own accounts, never one
 * that is committed or carries a live posting — and (part 3) never one a
 * booking link or a settled refund points at: the database refuses that
 * delete, so the step does not try. It is NOT buffered. It runs at once,
 * inside the page's transaction — it names rows by their own ids, rows this
 * page does not write, so nothing buffered depends on it — as ONE statement
 * that deletes and counts (clearReplacedPendingSql), and its answer is the
 * page's three counts, one for each thing a named row can be: deleted
 * (pending_cleared); left in place because it is committed or posted from
 * (pending_kept); left in place because, though neither, a booking link or a
 * settled refund points at it (pending_linked).
 *
 * PENDING-03 (Alex, 2026-11-11): A PENDING ROW THE BANK NO LONGER LISTS IS
 * CLEARED — the pull's SECOND delete, the page's unlisted step
 * (DomainDb.clearUnlistedPending). The first clears a pending row only when a
 * posted charge names it; a hold the bank dropped was cleared by nothing. Plaid
 * lists a link's transactions newest first, so a page holds every transaction
 * the bank lists for the link dated strictly between the page's newest day and
 * its oldest day: a pending row of the link's own accounts, dated strictly
 * between them, that the page does not account for is no longer listed by the
 * bank. Like the first it is NOT buffered: it runs at once, inside the page's
 * transaction, right after the first — it judges only rows this page does not
 * list, rows this page does not write — as ONE statement that deletes and
 * counts (clearUnlistedPendingSql), and its answer is the page's two counts:
 * deleted (pending_unlisted), and left in place (pending_unlisted_left).
 *
 * THE PULL'S TWO DELETES, AND WHAT EACH ONE NEVER TOUCHES. Both delete
 * transactions rows only — never a journal or a ledger row — and only PENDING
 * rows on the accounts handed to them, the caller's own link's: a posted row
 * is never judged. Neither takes a row that is committed, that carries a live
 * posting, or that a booking link or a settled refund points at — the same
 * three conditions, word for word, in both statements; such a row is left
 * exactly as it is, and counted. The first never takes a row whose id it was
 * not handed; the second never takes a row whose id it WAS handed (the ids
 * the page lists, and the first step's), nor a row dated on either of the two
 * days or outside them. Nothing else in this binding deletes: the plan holds
 * upserts and links only.
 *
 * A page whose payloads omit a column (undefined, not null) is grouped by the
 * set of omitted columns, one statement per group — Prisma's create treats
 * undefined as the column default and its update skips it; the grouped
 * statement does the same by leaving the column out. A real Plaid answer has
 * one group.
 */
import { Prisma } from '@prisma/client';
// PENDING-03: the one reader of a 'YYYY-MM-DD' calendar day (pure text — no Date, no time zone): the unlisted step's two days are checked with it.
import { calendarDay } from '@/lib/plaid/failLoud';
import type { DomainDb, ReplacedPendingAnswer, UnlistedPendingAnswer } from './plaidTransactionsPage';

export interface UpsertIntent {
  where: { transactionId: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}
export interface LinkIntent {
  where: { transactionId: string; arrival_id: null };
  data: { arrival_id: string };
}
export type Intent = { kind: 'upsert'; args: UpsertIntent } | { kind: 'link'; args: LinkIntent };

export class UnsupportedDomainWriteError extends Error {
  constructor(what: string) {
    super(`prismaDomain: ${what} — the batching binding replays only the parser's two intents (upsert by transactionId, the arrival_id link) and runs the page's two pending steps; nothing else is issued`);
    this.name = 'UnsupportedDomainWriteError';
  }
}

/** The create column set, in statement order. `id`, `accountId`, `transactionId` come from the first create; the rest is the parser's txnData. */
export const CREATE_KEYS = ['id', 'accountId', 'transactionId'] as const;
export const DATA_KEYS = [
  'amount', 'date', 'name', 'merchantName', 'category', 'pending', 'authorized_date', 'authorized_datetime',
  'counterparties', 'location', 'payment_channel', 'payment_meta', 'personal_finance_category',
  'personal_finance_category_icon_url', 'transaction_code', 'transaction_type', 'logo_url', 'website',
  // FX-01 (2026-10-30, ruling E): the row's currency as Plaid states it — the parser's txnData carries it (plaidTransactionsPage.ts).
  'iso_currency_code', 'arrival_id', 'updatedAt',
] as const;
type DataKey = (typeof DATA_KEYS)[number];

const TIMESTAMP_KEYS = new Set<DataKey>(['date', 'authorized_date', 'authorized_datetime', 'updatedAt']);
const JSON_KEYS = new Set<DataKey>(['counterparties', 'location', 'payment_meta', 'personal_finance_category']);
const FLOAT_KEYS = new Set<DataKey>(['amount']);

export interface PlannedUpsert {
  id: string;
  accountId: string;
  transactionId: string;
  /** The last update's data for this id; a key that is undefined is OMITTED (Prisma: default on create, skipped on update). */
  data: Record<DataKey, unknown>;
}

/** What finish() replays: upserts and links. PENDING-01: nothing in the plan deletes. */
export interface DomainPlan {
  upserts: PlannedUpsert[];
  links: Array<{ transactionId: string; arrivalId: string }>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function assertUpsert(args: unknown): UpsertIntent {
  if (!isPlainObject(args) || !isPlainObject(args.where) || typeof args.where.transactionId !== 'string' || Object.keys(args.where).length !== 1
    || !isPlainObject(args.create) || !isPlainObject(args.update)) {
    throw new UnsupportedDomainWriteError('upsert must be { where: { transactionId }, create, update }');
  }
  for (const k of CREATE_KEYS) if (typeof args.create[k] !== 'string') throw new UnsupportedDomainWriteError(`upsert.create.${k} must be a string`);
  for (const k of Object.keys(args.update)) if (!(DATA_KEYS as readonly string[]).includes(k)) throw new UnsupportedDomainWriteError(`upsert.update carries an unknown column "${k}"`);
  for (const k of Object.keys(args.create)) if (!(CREATE_KEYS as readonly string[]).includes(k) && !(DATA_KEYS as readonly string[]).includes(k)) throw new UnsupportedDomainWriteError(`upsert.create carries an unknown column "${k}"`);
  return args as unknown as UpsertIntent;
}

function assertLink(args: unknown): LinkIntent {
  if (!isPlainObject(args) || !isPlainObject(args.where) || !isPlainObject(args.data)
    || typeof args.where.transactionId !== 'string' || args.where.arrival_id !== null || Object.keys(args.where).length !== 2
    || typeof args.data.arrival_id !== 'string' || Object.keys(args.data).length !== 1) {
    throw new UnsupportedDomainWriteError('updateMany must be { where: { transactionId, arrival_id: null }, data: { arrival_id } }');
  }
  return args as unknown as LinkIntent;
}

const isIdList = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every((id) => typeof id === 'string' && id.length > 0);
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** PENDING-01: the pending step's arguments, checked like every other write through this binding. */
function assertClear(args: unknown): { accountIds: string[]; transactionIds: string[] } {
  if (!isPlainObject(args) || Object.keys(args).length !== 2 || !isIdList(args.accountIds) || !isIdList(args.transactionIds)) {
    throw new UnsupportedDomainWriteError('clearReplacedPending must be { accountIds, transactionIds } — each a list of at least one id');
  }
  return { accountIds: args.accountIds, transactionIds: args.transactionIds };
}

/** A calendar day in the form YYYY-MM-DD — read by the one day reader (failLoud.ts calendarDay), which answers null for anything else. */
const isDay = (v: unknown): v is string => typeof v === 'string' && calendarDay(v) !== null;

/**
 * PENDING-03: the unlisted step's arguments, checked like every other write through this binding — two lists of at
 * least one id, and two calendar days with the oldest strictly before the newest (a window with nothing strictly
 * inside it is no window; the page does not call the step for one).
 */
function assertUnlisted(args: unknown): { accountIds: string[]; newestDay: string; oldestDay: string; accountedIds: string[] } {
  if (!isPlainObject(args) || Object.keys(args).length !== 4 || !isIdList(args.accountIds) || !isIdList(args.accountedIds)
    || !isDay(args.newestDay) || !isDay(args.oldestDay) || !(args.oldestDay < args.newestDay)) {
    throw new UnsupportedDomainWriteError('clearUnlistedPending must be { accountIds, newestDay, oldestDay, accountedIds } — each list of at least one id, the two days calendar days (YYYY-MM-DD) with the oldest strictly before the newest');
  }
  return { accountIds: args.accountIds, newestDay: args.newestDay, oldestDay: args.oldestDay, accountedIds: args.accountedIds };
}

/** Replay the parser's intents, in order, into the batched plan with the sequential order's exact result. */
export function planDomainWrites(intents: Intent[]): DomainPlan {
  const upserts = new Map<string, PlannedUpsert>();
  const links = new Map<string, string>();

  for (const intent of intents) {
    if (intent.kind === 'upsert') {
      const { where, create, update } = intent.args;
      const id = where.transactionId;
      const data = {} as Record<DataKey, unknown>;
      for (const k of DATA_KEYS) if (update[k] !== undefined) data[k] = update[k];
      const prior = upserts.get(id);
      upserts.set(id, prior
        ? { ...prior, data: { ...prior.data, ...data } }
        : { id: create.id as string, accountId: create.accountId as string, transactionId: create.transactionId as string, data });
    } else {
      const id = intent.args.where.transactionId;
      if (!links.has(id)) links.set(id, intent.args.data.arrival_id);
    }
  }

  return {
    upserts: [...upserts.values()],
    // A link for an id the page upserts is a no-op either way: the upsert sets arrival_id.
    links: [...links.entries()].filter(([id]) => !upserts.has(id)).map(([transactionId, arrivalId]) => ({ transactionId, arrivalId })),
  };
}

const CHUNK = 500;
function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

const ident = (name: string) => Prisma.raw(`"${name}"`);
const iso = (v: unknown): string | null => (v === null ? null : v instanceof Date ? v.toISOString() : String(v));
const json = (v: unknown): string | null => (v === null ? null : JSON.stringify(v));

function valueSql(key: DataKey, v: unknown): Prisma.Sql {
  if (TIMESTAMP_KEYS.has(key)) return Prisma.sql`${iso(v)}::timestamp`;
  if (JSON_KEYS.has(key)) return Prisma.sql`${json(v)}::jsonb`;
  if (FLOAT_KEYS.has(key)) return Prisma.sql`${v}::float8`;
  return Prisma.sql`${v}`;
}

/** Rows grouped by the set of columns their data carries — one statement per distinct set. */
export function groupByColumns(rows: PlannedUpsert[]): Array<{ columns: DataKey[]; rows: PlannedUpsert[] }> {
  const groups = new Map<string, { columns: DataKey[]; rows: PlannedUpsert[] }>();
  for (const r of rows) {
    const columns = DATA_KEYS.filter((k) => r.data[k] !== undefined);
    const key = columns.join(',');
    const g = groups.get(key) ?? { columns, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** INSERT … ON CONFLICT ("transactionId") DO UPDATE for one column group of rows — what Prisma's upsert issues, for the whole set at once. */
export function upsertSql(columns: DataKey[], rows: PlannedUpsert[]): Prisma.Sql {
  const names = [...CREATE_KEYS, ...columns];
  const values = rows.map((r) => Prisma.sql`(${Prisma.join([
    Prisma.sql`${r.id}`, Prisma.sql`${r.accountId}`, Prisma.sql`${r.transactionId}`,
    ...columns.map((k) => valueSql(k, r.data[k])),
  ])})`);
  const set = columns.length
    ? Prisma.join(columns.map((k) => Prisma.sql`${ident(k)} = EXCLUDED.${ident(k)}`))
    : Prisma.sql`"transactionId" = EXCLUDED."transactionId"`;
  return Prisma.sql`INSERT INTO transactions (${Prisma.join(names.map(ident))}) VALUES ${Prisma.join(values)} ON CONFLICT ("transactionId") DO UPDATE SET ${set}`;
}

export function linkSql(links: DomainPlan['links']): Prisma.Sql {
  const values = links.map((l) => Prisma.sql`(${l.transactionId}, ${l.arrivalId})`);
  return Prisma.sql`UPDATE transactions AS t SET arrival_id = v.arrival_id FROM (VALUES ${Prisma.join(values)}) AS v(transaction_id, arrival_id) WHERE t."transactionId" = v.transaction_id AND t.arrival_id IS NULL`;
}

/**
 * PENDING-01 — THE PULL'S FIRST DELETE, as ONE statement that deletes and counts.
 *
 *   named    the transactions rows the ids name that are still pending, on the link's own accounts;
 *   cleared  of those, the rows deleted: NOT committed, carrying no live posting — no journal entry of source
 *            'plaid_txn' on the row's own transactionId that is neither a reversal nor reversed — AND with nothing
 *            pointing at them: no booking link, no settled refund (the fifth condition, below);
 *   linked   of those, the rows left in place for that last reason alone: NOT committed, no live posting, and a
 *            booking link or a settled refund points at them;
 *   the answer: pending_cleared = the rows deleted; pending_linked = the rows of `linked`; pending_kept = every other
 *            named row — left in place because it is committed or posted from, which is the only other way to be
 *            left, whether or not something also points at it. The three add up to the named rows. Nothing about a
 *            row that is left changes.
 *
 * Both ids and accounts ride as one array parameter each, so a page of any size is one statement. Each sub-statement
 * reads the same snapshot: `named` and `linked` are counted as they stood before the delete. pending_kept is the
 * remainder on purpose: a row committed after that snapshot and before the delete is not taken — at the database's
 * default isolation (READ COMMITTED) the delete re-reads review_status on the row it locks — and is counted as kept,
 * which is what it then is.
 *
 * WHAT IT LOOKS FOR BEFORE IT DELETES, AND WHY — part 3, the ruling of 2026-11-11 on what PENDING-01's report named.
 * Two foreign keys point at a transactions row, both ON DELETE RESTRICT: a booking link
 * (transaction_reservation_links."transactionId" —
 * prisma/migrations/20260805000000_transaction_reservation_links/migration.sql:42-45) and a settled refund
 * (money_events."settledTransactionId" — prisma/migrations/20260926210000_match_02_refund_settlement/migration.sql:27-30).
 * Each holds the row's `id`, not Plaid's transactionId. The matcher proposes links on pending rows too
 * (src/app/api/runway/match/propose/route.ts: "pending included, the matcher flags it"), and the database refuses to
 * delete a row either key points at: until part 3 the statement threw on such a row, the page rolled back whole and
 * that bank's transactions stage was declared failed on that page — on every Sync. So the step never tries. The
 * delete carries a FIFTH condition — nothing points at the row: no transaction_reservation_links row with the row's
 * id as its transactionId, WHATEVER THE LINK'S STATUS (the foreign key reads no status — a proposed or a rejected link
 * refuses the delete as an accepted one does), and no money_events row with the row's id as its settledTransactionId
 * — and a row something points at is left exactly as it is and counted (pending_linked). The foreign keys stay as
 * they are. Moving a link to the posted row is the matcher's work, not this step's.
 *
 * WHAT THE SNAPSHOT CANNOT SEE: a link or a refund written AFTER it and before the delete. The database still refuses
 * that delete — the statement throws, the page rolls back whole and its stage is declared failed, for that one Sync;
 * the next Sync sees the link and leaves the row in place, counted.
 */
export function clearReplacedPendingSql(accountIds: string[], transactionIds: string[]): Prisma.Sql {
  return Prisma.sql`WITH named AS (SELECT t.id FROM transactions AS t WHERE t."transactionId" = ANY(${transactionIds}::text[]) AND t.pending = true AND t."accountId" = ANY(${accountIds}::text[])), cleared AS (DELETE FROM transactions AS t USING named AS n WHERE t.id = n.id AND t.review_status <> 'committed' AND NOT EXISTS (SELECT 1 FROM journal_entries AS j WHERE j.source_type = 'plaid_txn' AND j.source_id = t."transactionId" AND j.is_reversal = false AND j.reversed_by_entry_id IS NULL) AND NOT EXISTS (SELECT 1 FROM transaction_reservation_links AS l WHERE l."transactionId" = t.id) AND NOT EXISTS (SELECT 1 FROM money_events AS m WHERE m."settledTransactionId" = t.id) RETURNING t.id), linked AS (SELECT t.id FROM transactions AS t JOIN named AS n ON n.id = t.id WHERE t.review_status <> 'committed' AND NOT EXISTS (SELECT 1 FROM journal_entries AS j WHERE j.source_type = 'plaid_txn' AND j.source_id = t."transactionId" AND j.is_reversal = false AND j.reversed_by_entry_id IS NULL) AND (EXISTS (SELECT 1 FROM transaction_reservation_links AS l WHERE l."transactionId" = t.id) OR EXISTS (SELECT 1 FROM money_events AS m WHERE m."settledTransactionId" = t.id))) SELECT (SELECT count(*) FROM cleared)::int AS pending_cleared, ((SELECT count(*) FROM named) - (SELECT count(*) FROM cleared) - (SELECT count(*) FROM linked))::int AS pending_kept, (SELECT count(*) FROM linked)::int AS pending_linked`;
}

/**
 * PENDING-03 — THE PULL'S SECOND DELETE, as ONE statement that deletes and counts (clearReplacedPendingSql is its model).
 *
 *   unlisted  the transactions rows the bank no longer lists, read off ONE page: still pending, on the link's own
 *             accounts, whose day is strictly after the page's oldest day and strictly before its newest day, and
 *             whose transactionId is none of the ids the page accounts for (every id it lists, and the ids the first
 *             step was handed);
 *   cleared   of those, the rows deleted: NOT committed, carrying no live posting — no journal entry of source
 *             'plaid_txn' on the row's own transactionId that is neither a reversal nor reversed — AND with nothing
 *             pointing at them: no booking link, whatever its status, and no settled refund. The first statement's
 *             three conditions, word for word;
 *   the answer: pending_unlisted = the rows deleted; pending_unlisted_left = every other row of `unlisted` — left in
 *             place because one of those three holds, which is the only way to be left. Nothing about it changes.
 *
 * THE TWO DAYS ARE COMPARED AS DAYS, both strictly: the row's `date` is cast to a date, so a row that held a time of
 * day would still be judged by its day alone (the parser writes Plaid's own `date` at midnight). A row dated on the
 * oldest day or on the newest day is not in `unlisted`: a day can run on across a page's edge.
 *
 * The accounts and the ids ride as one array parameter each and the two days as one text parameter each, so a page
 * of any size is one statement. Each sub-statement reads the same snapshot: `unlisted` is counted as it stood before
 * the delete, and — as in the first statement — a row committed after that snapshot and before the delete is not
 * taken, and is counted as left. What the first statement's snapshot cannot see, this one's cannot either: a link or a
 * refund written after it and before the delete is still refused by the database — the page rolls back whole and its
 * stage is declared failed, for that one Sync; the next Sync leaves the row in place, counted. It runs after the
 * first statement, in the same transaction, so a row the first deleted is gone before it reads; a row the first LEFT
 * is one of the ids it is handed, and is counted by the first alone.
 */
export function clearUnlistedPendingSql(accountIds: string[], newestDay: string, oldestDay: string, accountedIds: string[]): Prisma.Sql {
  return Prisma.sql`WITH unlisted AS (SELECT t.id FROM transactions AS t WHERE t.pending = true AND t."accountId" = ANY(${accountIds}::text[]) AND t."date"::date > ${oldestDay}::date AND t."date"::date < ${newestDay}::date AND t."transactionId" <> ALL(${accountedIds}::text[])), cleared AS (DELETE FROM transactions AS t USING unlisted AS u WHERE t.id = u.id AND t.review_status <> 'committed' AND NOT EXISTS (SELECT 1 FROM journal_entries AS j WHERE j.source_type = 'plaid_txn' AND j.source_id = t."transactionId" AND j.is_reversal = false AND j.reversed_by_entry_id IS NULL) AND NOT EXISTS (SELECT 1 FROM transaction_reservation_links AS l WHERE l."transactionId" = t.id) AND NOT EXISTS (SELECT 1 FROM money_events AS m WHERE m."settledTransactionId" = t.id) RETURNING t.id) SELECT (SELECT count(*) FROM cleared)::int AS pending_unlisted, ((SELECT count(*) FROM unlisted) - (SELECT count(*) FROM cleared))::int AS pending_unlisted_left`;
}

export interface BatchingDomainDb extends DomainDb {
  /** Replay the buffered intents as the batched statements — inside the page's transaction. */
  finish(): Promise<void>;
  /** For the log line: how many intents the page buffered and how many statements ran — the flush's, and each pending step's one when it ran. */
  stats(): { intents: number; statements: number };
}

export function prismaDomain(tx: Prisma.TransactionClient): BatchingDomainDb {
  const intents: Intent[] = [];
  let statements = 0;
  let finished = false;
  const guard = () => { if (finished) throw new UnsupportedDomainWriteError('a write after finish()'); };
  return {
    transactions: {
      async upsert(args) { guard(); intents.push({ kind: 'upsert', args: assertUpsert(args) }); return {}; },
      async updateMany(args) { guard(); intents.push({ kind: 'link', args: assertLink(args) }); return {}; },
    },
    // PENDING-01: the page's first pending step — NOT buffered. It runs at once, inside the page's transaction: it names
    // rows this page does not write, so nothing buffered depends on it. One statement, counted for the log line.
    async clearReplacedPending(args): Promise<ReplacedPendingAnswer> {
      guard();
      const { accountIds, transactionIds } = assertClear(args);
      const answered = await tx.$queryRaw<Array<{ pending_cleared: unknown; pending_kept: unknown; pending_linked: unknown }>>(clearReplacedPendingSql(accountIds, transactionIds));
      statements += 1;
      // The statement answers exactly one row of three counts; anything else is the table not answering — said, never read as none.
      const answer = answered.length === 1 ? answered[0] : undefined;
      const cleared = answer?.pending_cleared;
      const kept = answer?.pending_kept;
      const linked = answer?.pending_linked;
      if (!isCount(cleared) || !isCount(kept) || !isCount(linked)) throw new Error('prismaDomain: the pending step answered no count — the table is not answering');
      return { pending_cleared: cleared, pending_kept: kept, pending_linked: linked };
    },
    // PENDING-03: the page's second pending step — NOT buffered, like the first. It runs at once, inside the page's
    // transaction, after the first: it judges only rows this page does not list — rows this page does not write — so
    // nothing buffered depends on it. One statement, counted for the log line.
    async clearUnlistedPending(args): Promise<UnlistedPendingAnswer> {
      guard();
      const { accountIds, newestDay, oldestDay, accountedIds } = assertUnlisted(args);
      const answered = await tx.$queryRaw<Array<{ pending_unlisted: unknown; pending_unlisted_left: unknown }>>(clearUnlistedPendingSql(accountIds, newestDay, oldestDay, accountedIds));
      statements += 1;
      // The statement answers exactly one row of two counts; anything else is the table not answering — said, never read as none.
      const answer = answered.length === 1 ? answered[0] : undefined;
      const unlisted = answer?.pending_unlisted;
      const left = answer?.pending_unlisted_left;
      if (!isCount(unlisted) || !isCount(left)) throw new Error('prismaDomain: the unlisted step answered no count — the table is not answering');
      return { pending_unlisted: unlisted, pending_unlisted_left: left };
    },
    async finish() {
      guard();
      finished = true;
      const plan = planDomainWrites(intents);
      for (const group of groupByColumns(plan.upserts)) {
        for (const rows of chunks(group.rows)) { await tx.$executeRaw(upsertSql(group.columns, rows)); statements += 1; }
      }
      for (const links of chunks(plan.links)) { await tx.$executeRaw(linkSql(links)); statements += 1; }
    },
    stats() { return { intents: intents.length, statements }; },
  };
}
