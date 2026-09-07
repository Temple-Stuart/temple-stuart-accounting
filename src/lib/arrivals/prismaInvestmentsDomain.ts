/**
 * REBUILD-01 PR-2c — the Prisma-backed InvestmentsDomainDb that lands a page's
 * domain writes in ONE statement per kind instead of one per row (PERF-01's
 * binding pattern, prismaDomain.ts). The parser (plaidInvestmentsPage.ts)
 * speaks the per-row port; THIS binding buffers its intents, in order, and
 * `finish()` — called by runInvestmentsPage inside the same page transaction —
 * replays them as, in this order (investment_transactions.security_id
 * references securities.securityId):
 *
 *   1. one INSERT … ON CONFLICT ("securityId") DO UPDATE for the securities —
 *      the sync's upsert: every column on create, the price and option
 *      columns (and the arrival) on update; a security repeated in the page
 *      keeps the first create's identity and the last update's values;
 *   2. one UPDATE … FROM (VALUES …) linking already-landed securities
 *      (arrival_id IS NULL, as the parser's updateMany says);
 *   3. one plain INSERT for the new investment transactions — a conflict here
 *      is the same fault the sync's create raised (P2002), never ignored;
 *   4. one INSERT … ON CONFLICT ("investment_transaction_id") DO UPDATE for
 *      the corrections (a page that creates an id and then corrects it emits
 *      the correction alone: the first create's identity, the last data);
 *   5. one UPDATE … FROM (VALUES …) linking the rest (arrival_id IS NULL).
 *
 * Every value the parser hands over is present (null, never undefined — the
 * parser normalizes), so one column set covers a whole page; an intent shape
 * the parser does not issue, or an undefined value, is a throw, never a
 * per-row fallback.
 */
import { Prisma } from '@prisma/client';
import type { InvestmentsDomainDb } from './plaidInvestmentsPage';

export const SECURITY_CREATE_KEYS = ['id', 'securityId', 'isin', 'cusip', 'sedol', 'ticker_symbol', 'name', 'type', 'updatedAt'] as const;
export const SECURITY_UPDATE_KEYS = ['close_price', 'close_price_as_of', 'option_contract_type', 'option_strike_price', 'option_expiration_date', 'option_underlying_ticker', 'arrival_id'] as const;
export const INVESTMENT_CREATE_KEYS = ['id', 'investment_transaction_id', 'accountId'] as const;
export const INVESTMENT_DATA_KEYS = [
  'amount', 'cancel_transaction_id', 'date', 'fees', 'iso_currency_code', 'name', 'price', 'quantity',
  'security_id', 'subtype', 'type', 'unofficial_currency_code', 'arrival_id', 'updatedAt',
] as const;

const TIMESTAMP_KEYS = new Set<string>(['close_price_as_of', 'option_expiration_date', 'date', 'updatedAt']);
const FLOAT_KEYS = new Set<string>(['close_price', 'option_strike_price', 'amount', 'fees', 'price', 'quantity']);

export class UnsupportedInvestmentsWriteError extends Error {
  constructor(what: string) {
    super(`prismaInvestmentsDomain: ${what} — the batching binding replays only the parser's five intents (the securities upsert and link, the investment_transactions create, correction upsert and link); nothing else is issued`);
    this.name = 'UnsupportedInvestmentsWriteError';
  }
}

export type Intent =
  | { kind: 'security'; args: { where: { securityId: string }; create: Record<string, unknown>; update: Record<string, unknown> } }
  | { kind: 'securityLink'; args: { where: { securityId: string; arrival_id: null }; data: { arrival_id: string } } }
  | { kind: 'create'; args: { data: Record<string, unknown> } }
  | { kind: 'upsert'; args: { where: { investment_transaction_id: string }; create: Record<string, unknown>; update: Record<string, unknown> } }
  | { kind: 'link'; args: { where: { investment_transaction_id: string; arrival_id: null }; data: { arrival_id: string } } };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function assertKeys(what: string, obj: Record<string, unknown>, keys: readonly string[]): void {
  const have = Object.keys(obj).sort();
  const want = [...keys].sort();
  if (have.join(',') !== want.join(',')) throw new UnsupportedInvestmentsWriteError(`${what} must carry exactly [${want.join(', ')}]; got [${have.join(', ')}]`);
  for (const k of keys) if (obj[k] === undefined) throw new UnsupportedInvestmentsWriteError(`${what}.${k} is undefined (the parser hands over null, never undefined)`);
}

function assertSecurity(args: unknown): Intent & { kind: 'security' } {
  if (!isPlainObject(args) || !isPlainObject(args.where) || typeof args.where.securityId !== 'string' || Object.keys(args.where).length !== 1 || !isPlainObject(args.create) || !isPlainObject(args.update)) {
    throw new UnsupportedInvestmentsWriteError('securities.upsert must be { where: { securityId }, create, update }');
  }
  assertKeys('securities.upsert.create', args.create, [...SECURITY_CREATE_KEYS, ...SECURITY_UPDATE_KEYS]);
  assertKeys('securities.upsert.update', args.update, SECURITY_UPDATE_KEYS);
  if (typeof args.create.id !== 'string' || args.create.securityId !== args.where.securityId) throw new UnsupportedInvestmentsWriteError('securities.upsert.create.id must be a string and create.securityId must equal where.securityId');
  return { kind: 'security', args: args as (Intent & { kind: 'security' })['args'] };
}

function assertLinkOn(idColumn: 'securityId' | 'investment_transaction_id', args: unknown): { where: Record<string, unknown>; data: { arrival_id: string } } {
  if (!isPlainObject(args) || !isPlainObject(args.where) || !isPlainObject(args.data)
    || typeof args.where[idColumn] !== 'string' || args.where.arrival_id !== null || Object.keys(args.where).length !== 2
    || typeof args.data.arrival_id !== 'string' || Object.keys(args.data).length !== 1) {
    throw new UnsupportedInvestmentsWriteError(`updateMany must be { where: { ${idColumn}, arrival_id: null }, data: { arrival_id } }`);
  }
  return args as { where: Record<string, unknown>; data: { arrival_id: string } };
}

function assertCreate(args: unknown): Intent & { kind: 'create' } {
  if (!isPlainObject(args) || !isPlainObject(args.data) || Object.keys(args).length !== 1) throw new UnsupportedInvestmentsWriteError('investment_transactions.create must be { data }');
  assertKeys('investment_transactions.create.data', args.data, [...INVESTMENT_CREATE_KEYS, ...INVESTMENT_DATA_KEYS]);
  for (const k of INVESTMENT_CREATE_KEYS) if (typeof args.data[k] !== 'string') throw new UnsupportedInvestmentsWriteError(`investment_transactions.create.data.${k} must be a string`);
  return { kind: 'create', args: { data: args.data } };
}

function assertUpsert(args: unknown): Intent & { kind: 'upsert' } {
  if (!isPlainObject(args) || !isPlainObject(args.where) || typeof args.where.investment_transaction_id !== 'string' || Object.keys(args.where).length !== 1 || !isPlainObject(args.create) || !isPlainObject(args.update)) {
    throw new UnsupportedInvestmentsWriteError('investment_transactions.upsert must be { where: { investment_transaction_id }, create, update }');
  }
  assertKeys('investment_transactions.upsert.create', args.create, [...INVESTMENT_CREATE_KEYS, ...INVESTMENT_DATA_KEYS]);
  assertKeys('investment_transactions.upsert.update', args.update, INVESTMENT_DATA_KEYS);
  for (const k of INVESTMENT_CREATE_KEYS) if (typeof args.create[k] !== 'string') throw new UnsupportedInvestmentsWriteError(`investment_transactions.upsert.create.${k} must be a string`);
  if (args.create.investment_transaction_id !== args.where.investment_transaction_id) throw new UnsupportedInvestmentsWriteError('investment_transactions.upsert.create.investment_transaction_id must equal where.investment_transaction_id');
  return { kind: 'upsert', args: args as (Intent & { kind: 'upsert' })['args'] };
}

export interface PlannedSecurity {
  /** The first create's identity columns. */
  create: Record<string, unknown>;
  /** The last update's values. */
  update: Record<string, unknown>;
}
export interface PlannedInvestment {
  id: string;
  investment_transaction_id: string;
  accountId: string;
  data: Record<string, unknown>;
}
export interface InvestmentsPlan {
  securities: PlannedSecurity[];
  securityLinks: Array<{ securityId: string; arrivalId: string }>;
  creates: PlannedInvestment[];
  upserts: PlannedInvestment[];
  links: Array<{ investmentTransactionId: string; arrivalId: string }>;
}

/** Replay the parser's intents, in order, into the batched plan with the sequential order's exact result. */
export function planInvestmentsWrites(intents: Intent[]): InvestmentsPlan {
  const securities = new Map<string, PlannedSecurity>();
  const securityLinks = new Map<string, string>();
  const rows = new Map<string, { row: PlannedInvestment; corrected: boolean }>();
  const links = new Map<string, string>();
  for (const intent of intents) {
    if (intent.kind === 'security') {
      const id = intent.args.where.securityId;
      const prior = securities.get(id);
      const create: Record<string, unknown> = {};
      for (const k of SECURITY_CREATE_KEYS) create[k] = intent.args.create[k];
      securities.set(id, { create: prior ? prior.create : create, update: { ...intent.args.update } });
    } else if (intent.kind === 'securityLink') {
      const id = intent.args.where.securityId;
      if (!securityLinks.has(id)) securityLinks.set(id, intent.args.data.arrival_id);
    } else if (intent.kind === 'create') {
      const d = intent.args.data;
      const id = d.investment_transaction_id as string;
      const data: Record<string, unknown> = {};
      for (const k of INVESTMENT_DATA_KEYS) data[k] = d[k];
      const prior = rows.get(id);
      rows.set(id, { row: { id: (prior?.row.id ?? d.id) as string, investment_transaction_id: id, accountId: (prior?.row.accountId ?? d.accountId) as string, data }, corrected: prior?.corrected ?? false });
    } else if (intent.kind === 'upsert') {
      const id = intent.args.where.investment_transaction_id;
      const prior = rows.get(id);
      const data: Record<string, unknown> = {};
      for (const k of INVESTMENT_DATA_KEYS) data[k] = intent.args.update[k];
      rows.set(id, { row: { id: (prior?.row.id ?? intent.args.create.id) as string, investment_transaction_id: id, accountId: (prior?.row.accountId ?? intent.args.create.accountId) as string, data }, corrected: true });
    } else {
      const id = intent.args.where.investment_transaction_id;
      if (!links.has(id)) links.set(id, intent.args.data.arrival_id);
    }
  }
  return {
    securities: [...securities.values()],
    // A link for a security the page upserts is a no-op either way: the upsert sets arrival_id.
    securityLinks: [...securityLinks.entries()].filter(([id]) => !securities.has(id)).map(([securityId, arrivalId]) => ({ securityId, arrivalId })),
    creates: [...rows.values()].filter((r) => !r.corrected).map((r) => r.row),
    upserts: [...rows.values()].filter((r) => r.corrected).map((r) => r.row),
    links: [...links.entries()].filter(([id]) => !rows.has(id)).map(([investmentTransactionId, arrivalId]) => ({ investmentTransactionId, arrivalId })),
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

function valueSql(key: string, v: unknown): Prisma.Sql {
  if (v === undefined) throw new UnsupportedInvestmentsWriteError(`${key} is undefined`);
  if (TIMESTAMP_KEYS.has(key)) return Prisma.sql`${iso(v)}::timestamp`;
  if (FLOAT_KEYS.has(key)) return Prisma.sql`${v}::float8`;
  return Prisma.sql`${v}`;
}

/** INSERT … ON CONFLICT ("securityId") DO UPDATE — the sync's securities upsert, for the whole set at once. */
export function securitiesSql(rows: PlannedSecurity[]): Prisma.Sql {
  const names = [...SECURITY_CREATE_KEYS, ...SECURITY_UPDATE_KEYS];
  const values = rows.map((r) => Prisma.sql`(${Prisma.join([
    ...SECURITY_CREATE_KEYS.map((k) => valueSql(k, r.create[k])),
    ...SECURITY_UPDATE_KEYS.map((k) => valueSql(k, r.update[k])),
  ])})`);
  const set = Prisma.join(SECURITY_UPDATE_KEYS.map((k) => Prisma.sql`${ident(k)} = EXCLUDED.${ident(k)}`));
  return Prisma.sql`INSERT INTO securities (${Prisma.join(names.map(ident))}) VALUES ${Prisma.join(values)} ON CONFLICT ("securityId") DO UPDATE SET ${set}`;
}

export function securityLinkSql(links: InvestmentsPlan['securityLinks']): Prisma.Sql {
  const values = links.map((l) => Prisma.sql`(${l.securityId}, ${l.arrivalId})`);
  return Prisma.sql`UPDATE securities AS s SET arrival_id = v.arrival_id FROM (VALUES ${Prisma.join(values)}) AS v(security_id, arrival_id) WHERE s."securityId" = v.security_id AND s.arrival_id IS NULL`;
}

function investmentValues(rows: PlannedInvestment[]): Prisma.Sql {
  return Prisma.join(rows.map((r) => Prisma.sql`(${Prisma.join([
    Prisma.sql`${r.id}`, Prisma.sql`${r.investment_transaction_id}`, Prisma.sql`${r.accountId}`,
    ...INVESTMENT_DATA_KEYS.map((k) => valueSql(k, r.data[k])),
  ])})`));
}
const INVESTMENT_COLUMNS = Prisma.join([...INVESTMENT_CREATE_KEYS, ...INVESTMENT_DATA_KEYS].map(ident));

/** A plain INSERT: a conflict is the fault the sync's create raised, never ignored. */
export function createsSql(rows: PlannedInvestment[]): Prisma.Sql {
  return Prisma.sql`INSERT INTO investment_transactions (${INVESTMENT_COLUMNS}) VALUES ${investmentValues(rows)}`;
}

/** INSERT … ON CONFLICT ("investment_transaction_id") DO UPDATE — a correction applied, the identity columns never touched. */
export function correctionsSql(rows: PlannedInvestment[]): Prisma.Sql {
  const set = Prisma.join(INVESTMENT_DATA_KEYS.map((k) => Prisma.sql`${ident(k)} = EXCLUDED.${ident(k)}`));
  return Prisma.sql`INSERT INTO investment_transactions (${INVESTMENT_COLUMNS}) VALUES ${investmentValues(rows)} ON CONFLICT ("investment_transaction_id") DO UPDATE SET ${set}`;
}

export function investmentLinkSql(links: InvestmentsPlan['links']): Prisma.Sql {
  const values = links.map((l) => Prisma.sql`(${l.investmentTransactionId}, ${l.arrivalId})`);
  return Prisma.sql`UPDATE investment_transactions AS t SET arrival_id = v.arrival_id FROM (VALUES ${Prisma.join(values)}) AS v(investment_transaction_id, arrival_id) WHERE t.investment_transaction_id = v.investment_transaction_id AND t.arrival_id IS NULL`;
}

export interface BatchingInvestmentsDomainDb extends InvestmentsDomainDb {
  /** Replay the buffered intents as the batched statements — inside the page's transaction. */
  finish(): Promise<void>;
  /** For the log line: how many intents the page issued and how many statements the flush ran. */
  stats(): { intents: number; statements: number };
}

export function prismaInvestmentsDomain(tx: Prisma.TransactionClient): BatchingInvestmentsDomainDb {
  const intents: Intent[] = [];
  let statements = 0;
  let finished = false;
  const guard = () => { if (finished) throw new UnsupportedInvestmentsWriteError('a write after finish()'); };
  return {
    securities: {
      async upsert(args) { guard(); intents.push(assertSecurity(args)); return {}; },
      async updateMany(args) { guard(); intents.push({ kind: 'securityLink', args: assertLinkOn('securityId', args) as (Intent & { kind: 'securityLink' })['args'] }); return {}; },
    },
    investment_transactions: {
      async create(args) { guard(); intents.push(assertCreate(args)); return {}; },
      async upsert(args) { guard(); intents.push(assertUpsert(args)); return {}; },
      async updateMany(args) { guard(); intents.push({ kind: 'link', args: assertLinkOn('investment_transaction_id', args) as (Intent & { kind: 'link' })['args'] }); return {}; },
    },
    async finish() {
      guard();
      finished = true;
      const plan = planInvestmentsWrites(intents);
      for (const rows of chunks(plan.securities)) { await tx.$executeRaw(securitiesSql(rows)); statements += 1; }
      for (const links of chunks(plan.securityLinks)) { await tx.$executeRaw(securityLinkSql(links)); statements += 1; }
      for (const rows of chunks(plan.creates)) { await tx.$executeRaw(createsSql(rows)); statements += 1; }
      for (const rows of chunks(plan.upserts)) { await tx.$executeRaw(correctionsSql(rows)); statements += 1; }
      for (const links of chunks(plan.links)) { await tx.$executeRaw(investmentLinkSql(links)); statements += 1; }
    },
    stats() { return { intents: intents.length, statements }; },
  };
}
