/**
 * PERF-01 — the Prisma-backed DomainDb that lands a page's domain writes in
 * ONE statement per kind instead of one per row.
 *
 * sync-complete hit Vercel's 300 s ceiling on the first full pull after PR-2.
 * The landing side was already batched (prismaLanding: one INSERT … ON
 * CONFLICT DO NOTHING RETURNING, one SELECT, one UPDATE per page); the domain
 * loop was not — the parser (plaidTransactionsPage.ts) issued one upsert per
 * transaction, one DELETE per posted transaction (pending duplicates) and one
 * UPDATE per repeated object (the arrival_id link): ~900 statements, ~900
 * Azure round trips, for a 500-object page.
 *
 * The parser is unchanged and still speaks the per-row DomainDb port, so the
 * existing landing tests (a fake DomainDb) prove its semantics unchanged. THIS
 * binding buffers the parser's intents, in order, and `finish()` — called by
 * runTransactionsPage inside the same page transaction — replays them as:
 *
 *   1. one INSERT … ON CONFLICT ("transactionId") DO UPDATE for every upsert
 *      (Prisma's own upsert is that statement, one row at a time);
 *   2. one UPDATE … FROM (VALUES …) for the arrival_id links (arrival_id IS
 *      NULL, as the parser's updateMany says);
 *   3. one DELETE … USING (VALUES …) for the pending-duplicate rule against
 *      rows that were NOT in this page, and one DELETE by id for the in-page
 *      rows the sequential order would have removed (planDomainWrites).
 *
 * The plan (planDomainWrites) is pure and reproduces the sequential order's
 * result exactly: same id twice → the first row's create fields, the last
 * row's data; a link for an id the page also upserts is a no-op (the upsert
 * sets arrival_id); an in-page pending row is deleted only by a LATER posted
 * row's rule, and a later re-upsert of that id revives it. An intent shape the
 * parser does not issue is a throw, never a per-row fallback.
 *
 * A page whose payloads omit a column (undefined, not null) is grouped by the
 * set of omitted columns, one statement per group — Prisma's create treats
 * undefined as the column default and its update skips it; the grouped
 * statement does the same by leaving the column out. A real Plaid answer has
 * one group.
 */
import { Prisma } from '@prisma/client';
import type { DomainDb } from './plaidTransactionsPage';

export interface UpsertIntent {
  where: { transactionId: string };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}
export interface LinkIntent {
  where: { transactionId: string; arrival_id: null };
  data: { arrival_id: string };
}
export interface DeleteIntent {
  where: { accountId: string; amount: number; pending: true; date: { gte: Date; lte: Date }; transactionId: { not: string } };
}
export type Intent = { kind: 'upsert'; args: UpsertIntent } | { kind: 'link'; args: LinkIntent } | { kind: 'delete'; args: DeleteIntent };

export class UnsupportedDomainWriteError extends Error {
  constructor(what: string) {
    super(`prismaDomain: ${what} — the batching binding replays only the parser's three intents (upsert by transactionId, the arrival_id link, the pending-duplicate delete); nothing else is issued`);
    this.name = 'UnsupportedDomainWriteError';
  }
}

/** The create column set, in statement order. `id`, `accountId`, `transactionId` come from the first create; the rest is the parser's txnData. */
export const CREATE_KEYS = ['id', 'accountId', 'transactionId'] as const;
export const DATA_KEYS = [
  'amount', 'date', 'name', 'merchantName', 'category', 'pending', 'authorized_date', 'authorized_datetime',
  'counterparties', 'location', 'payment_channel', 'payment_meta', 'personal_finance_category',
  'personal_finance_category_icon_url', 'transaction_code', 'transaction_type', 'logo_url', 'website', 'arrival_id', 'updatedAt',
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

export interface DomainPlan {
  upserts: PlannedUpsert[];
  links: Array<{ transactionId: string; arrivalId: string }>;
  /** The pending-duplicate rule, one per posted row, applied to rows NOT upserted in this page. */
  deletes: Array<{ accountId: string; amount: number; gte: Date; lte: Date; notTransactionId: string }>;
  /** In-page rows the sequential order would have removed (a LATER posted row's rule, not revived by a later upsert). */
  deleteInPageIds: string[];
  /** Every transactionId upserted in this page. */
  pageIds: string[];
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

function assertDelete(args: unknown): DeleteIntent {
  const w = isPlainObject(args) ? args.where : undefined;
  if (!isPlainObject(w) || Object.keys(w).length !== 5 || typeof w.accountId !== 'string' || typeof w.amount !== 'number' || w.pending !== true
    || !isPlainObject(w.date) || !(w.date.gte instanceof Date) || !(w.date.lte instanceof Date) || Object.keys(w.date).length !== 2
    || !isPlainObject(w.transactionId) || typeof w.transactionId.not !== 'string' || Object.keys(w.transactionId).length !== 1) {
    throw new UnsupportedDomainWriteError('deleteMany must be { where: { accountId, amount, pending: true, date: { gte, lte }, transactionId: { not } } }');
  }
  return args as unknown as DeleteIntent;
}

/** Replay the parser's intents, in order, into the batched plan with the sequential order's exact result. */
export function planDomainWrites(intents: Intent[]): DomainPlan {
  const upserts = new Map<string, PlannedUpsert>();
  const links = new Map<string, string>();
  const deletes: DomainPlan['deletes'] = [];
  const deletedNow = new Set<string>();
  // What the page has written so far, as the sequential order would see it.
  const inPage = new Map<string, { accountId: string; amount: number; pending: boolean; date: Date }>();

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
      const row = upserts.get(id)!;
      inPage.set(id, { accountId: row.accountId, amount: Number(row.data.amount), pending: row.data.pending === true, date: row.data.date instanceof Date ? row.data.date : new Date(String(row.data.date)) });
      deletedNow.delete(id);
    } else if (intent.kind === 'link') {
      const id = intent.args.where.transactionId;
      if (!links.has(id)) links.set(id, intent.args.data.arrival_id);
    } else {
      const w = intent.args.where;
      deletes.push({ accountId: w.accountId, amount: w.amount, gte: w.date.gte, lte: w.date.lte, notTransactionId: w.transactionId.not });
      for (const [id, row] of inPage) {
        if (id === w.transactionId.not || deletedNow.has(id)) continue;
        if (row.pending && row.accountId === w.accountId && row.amount === w.amount && row.date >= w.date.gte && row.date <= w.date.lte) {
          deletedNow.add(id);
        }
      }
    }
  }

  const pageIds = [...upserts.keys()];
  return {
    upserts: [...upserts.values()],
    // A link for an id the page upserts is a no-op either way: the upsert sets arrival_id.
    links: [...links.entries()].filter(([id]) => !upserts.has(id)).map(([transactionId, arrivalId]) => ({ transactionId, arrivalId })),
    deletes,
    deleteInPageIds: [...deletedNow],
    pageIds,
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

export function deleteSql(deletes: DomainPlan['deletes'], pageIds: string[]): Prisma.Sql {
  const values = deletes.map((d) => Prisma.sql`(${d.accountId}, ${d.amount}::float8, ${d.gte.toISOString()}::timestamp, ${d.lte.toISOString()}::timestamp, ${d.notTransactionId})`);
  const notInPage = pageIds.length ? Prisma.sql` AND NOT (t."transactionId" = ANY(${pageIds}::text[]))` : Prisma.empty;
  return Prisma.sql`DELETE FROM transactions AS t USING (VALUES ${Prisma.join(values)}) AS v(account_id, amount, lo, hi, transaction_id) WHERE t."accountId" = v.account_id AND t.amount = v.amount AND t.pending = true AND t.date >= v.lo AND t.date <= v.hi AND t."transactionId" <> v.transaction_id${notInPage}`;
}

export function deleteByIdSql(ids: string[]): Prisma.Sql {
  return Prisma.sql`DELETE FROM transactions WHERE "transactionId" = ANY(${ids}::text[])`;
}

export interface BatchingDomainDb extends DomainDb {
  /** Replay the buffered intents as the batched statements — inside the page's transaction. */
  finish(): Promise<void>;
  /** For the log line: how many intents the page issued and how many statements the flush ran. */
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
      async deleteMany(args) { guard(); intents.push({ kind: 'delete', args: assertDelete(args) }); return {}; },
    },
    async finish() {
      guard();
      finished = true;
      const plan = planDomainWrites(intents);
      for (const group of groupByColumns(plan.upserts)) {
        for (const rows of chunks(group.rows)) { await tx.$executeRaw(upsertSql(group.columns, rows)); statements += 1; }
      }
      for (const links of chunks(plan.links)) { await tx.$executeRaw(linkSql(links)); statements += 1; }
      for (const deletes of chunks(plan.deletes)) { await tx.$executeRaw(deleteSql(deletes, plan.pageIds)); statements += 1; }
      if (plan.deleteInPageIds.length) { await tx.$executeRaw(deleteByIdSql(plan.deleteInPageIds)); statements += 1; }
    },
    stats() { return { intents: intents.length, statements }; },
  };
}
