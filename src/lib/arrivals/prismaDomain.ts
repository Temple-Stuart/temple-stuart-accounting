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
 * deletes nothing now, and neither does the plan. The sync's ONE delete is the
 * page's pending step (DomainDb.clearReplacedPending): the pending rows Plaid
 * NAMES as replaced by a posted charge, on the link's own accounts, never one
 * that is committed or carries a live posting. It is NOT buffered. It runs at
 * once, inside the page's transaction — it names rows by their own ids, rows
 * this page does not write, so nothing buffered depends on it — as ONE
 * statement that deletes and counts (clearReplacedPendingSql), and its answer
 * is the page's two counts.
 *
 * A page whose payloads omit a column (undefined, not null) is grouped by the
 * set of omitted columns, one statement per group — Prisma's create treats
 * undefined as the column default and its update skips it; the grouped
 * statement does the same by leaving the column out. A real Plaid answer has
 * one group.
 */
import { Prisma } from '@prisma/client';
import type { DomainDb, ReplacedPendingAnswer } from './plaidTransactionsPage';

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
    super(`prismaDomain: ${what} — the batching binding replays only the parser's two intents (upsert by transactionId, the arrival_id link) and runs the page's one pending step; nothing else is issued`);
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
 * PENDING-01 — THE SYNC'S ONE DELETE, as ONE statement that deletes and counts.
 *
 *   named    the transactions rows the ids name that are still pending, on the link's own accounts;
 *   cleared  of those, the rows deleted: NOT committed AND carrying no live posting — no journal entry of source
 *            'plaid_txn' on the row's own transactionId that is neither a reversal nor reversed;
 *   the answer: pending_cleared = the rows deleted; pending_kept = the named rows left in place, which the two
 *            conditions above are the only way to be — committed, or posted from. Nothing about them changes.
 *
 * Both ids and accounts ride as one array parameter each, so a page of any size is one statement. Each sub-statement
 * reads the same snapshot: `named` is counted as it stood before the delete.
 *
 * WHAT IT DOES NOT LOOK FOR — reported with PENDING-01 for a ruling, not decided here. Two foreign keys point at a
 * transactions row with ON DELETE RESTRICT: a booking link (transaction_reservation_links.transactionId,
 * prisma/schema.prisma:1924) and a settled refund (money_events.settledTransactionId, :1834). The matcher proposes
 * links on pending rows too. A named, uncommitted pending row that one of them points at is refused by the database:
 * the statement throws, the page rolls back whole and its stage is declared failed. The guess this replaced met the
 * same refusal.
 */
export function clearReplacedPendingSql(accountIds: string[], transactionIds: string[]): Prisma.Sql {
  return Prisma.sql`WITH named AS (SELECT t.id FROM transactions AS t WHERE t."transactionId" = ANY(${transactionIds}::text[]) AND t.pending = true AND t."accountId" = ANY(${accountIds}::text[])), cleared AS (DELETE FROM transactions AS t USING named AS n WHERE t.id = n.id AND t.review_status <> 'committed' AND NOT EXISTS (SELECT 1 FROM journal_entries AS j WHERE j.source_type = 'plaid_txn' AND j.source_id = t."transactionId" AND j.is_reversal = false AND j.reversed_by_entry_id IS NULL) RETURNING t.id) SELECT (SELECT count(*) FROM cleared)::int AS pending_cleared, ((SELECT count(*) FROM named) - (SELECT count(*) FROM cleared))::int AS pending_kept`;
}

export interface BatchingDomainDb extends DomainDb {
  /** Replay the buffered intents as the batched statements — inside the page's transaction. */
  finish(): Promise<void>;
  /** For the log line: how many intents the page buffered and how many statements ran — the flush's, and the pending step's one when it ran. */
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
    // PENDING-01: the page's pending step — NOT buffered. It runs at once, inside the page's transaction: it names
    // rows this page does not write, so nothing buffered depends on it. One statement, counted for the log line.
    async clearReplacedPending(args): Promise<ReplacedPendingAnswer> {
      guard();
      const { accountIds, transactionIds } = assertClear(args);
      const answered = await tx.$queryRaw<Array<{ pending_cleared: unknown; pending_kept: unknown }>>(clearReplacedPendingSql(accountIds, transactionIds));
      statements += 1;
      // The statement answers exactly one row of two counts; anything else is the table not answering — said, never read as none.
      const answer = answered.length === 1 ? answered[0] : undefined;
      const cleared = answer?.pending_cleared;
      const kept = answer?.pending_kept;
      if (!isCount(cleared) || !isCount(kept)) throw new Error('prismaDomain: the pending step answered no count — the table is not answering');
      return { pending_cleared: cleared, pending_kept: kept };
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
