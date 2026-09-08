/**
 * REBUILD-01 PR-2d — the Prisma-backed HoldingsDomainDb that lands an answer's
 * domain writes in ONE statement per kind (PERF-01's binding pattern,
 * prismaInvestmentsDomain.ts, whose securities statements it reuses). The parser
 * (plaidHoldingsPage.ts) speaks the per-row port; THIS binding buffers, in
 * order, and `finish()` — called by runHoldingsPage inside the same transaction
 * — replays as (holdings.security_id references securities.securityId):
 *
 *   1. one INSERT … ON CONFLICT ("securityId") DO UPDATE for the securities
 *      (PR-2c's securitiesSql);
 *   2. one UPDATE … FROM (VALUES …) linking already-landed securities;
 *   3. one INSERT … ON CONFLICT ("accountId", security_id, as_of) DO UPDATE for
 *      the holdings — a new key inserts, the same key (the same day's position,
 *      corrected) takes the last values and the newest arrival; a key repeated
 *      in one answer keeps the first row's id and the last write's values.
 *
 * Every value the parser hands over is present (null, never undefined); a row
 * missing a column is a throw, never a per-row fallback.
 */
import { Prisma } from '@prisma/client';
import { planInvestmentsWrites, securitiesSql, securityLinkSql, type Intent } from './prismaInvestmentsDomain';
import { HOLDING_DATA_KEYS, HOLDING_KEY_KEYS, type HoldingRow, type HoldingsDomainDb } from './plaidHoldingsPage';

export class UnsupportedHoldingsWriteError extends Error {
  constructor(what: string) {
    super(`prismaHoldingsDomain: ${what} — the batching binding replays only the parser's intents (the securities upsert and link, the holdings upsert); nothing else is issued`);
    this.name = 'UnsupportedHoldingsWriteError';
  }
}

const DATE_KEYS = new Set<string>(['as_of', 'institution_price_as_of']);
const TIMESTAMP_KEYS = new Set<string>(['institution_price_datetime', 'updatedAt']);
const FLOAT_KEYS = new Set<string>(['quantity', 'cost_basis', 'institution_price', 'institution_value']);

const ident = (name: string) => Prisma.raw(`"${name}"`);
const iso = (v: unknown): string | null => (v === null ? null : v instanceof Date ? v.toISOString() : String(v));

function valueSql(key: string, v: unknown): Prisma.Sql {
  if (v === undefined) throw new UnsupportedHoldingsWriteError(`${key} is undefined (the parser hands over null, never undefined)`);
  if (DATE_KEYS.has(key)) return Prisma.sql`${v}::date`;
  if (TIMESTAMP_KEYS.has(key)) return Prisma.sql`${iso(v)}::timestamp`;
  if (FLOAT_KEYS.has(key)) return Prisma.sql`${v}::float8`;
  return Prisma.sql`${v}`;
}

function assertRow(row: HoldingRow): void {
  for (const k of HOLDING_KEY_KEYS) if (typeof row[k] !== 'string' || row[k].length === 0) throw new UnsupportedHoldingsWriteError(`holdings.upsert.${k} must be a non-empty string`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.as_of)) throw new UnsupportedHoldingsWriteError(`holdings.upsert.as_of must be YYYY-MM-DD; got ${row.as_of}`);
  const have = Object.keys(row.data).sort();
  const want = [...HOLDING_DATA_KEYS].sort();
  if (have.join(',') !== want.join(',')) throw new UnsupportedHoldingsWriteError(`holdings.upsert.data must carry exactly [${want.join(', ')}]; got [${have.join(', ')}]`);
  for (const k of HOLDING_DATA_KEYS) if (row.data[k] === undefined) throw new UnsupportedHoldingsWriteError(`holdings.upsert.data.${k} is undefined`);
}

/** One row per key (accountId, security_id, as_of): the first row's id, the last write's values. */
export function planHoldings(rows: HoldingRow[]): HoldingRow[] {
  const by = new Map<string, HoldingRow>();
  for (const r of rows) {
    const k = `${r.accountId} ${r.security_id} ${r.as_of}`;
    const prior = by.get(k);
    by.set(k, prior ? { ...r, id: prior.id } : r);
  }
  return [...by.values()];
}

const CHUNK = 500;
function chunks<T>(list: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK));
  return out;
}

/** INSERT … ON CONFLICT ("accountId", security_id, as_of) DO UPDATE — one snapshot per moment; the same moment takes the latest. */
export function holdingsSql(rows: HoldingRow[]): Prisma.Sql {
  const names = [...HOLDING_KEY_KEYS, ...HOLDING_DATA_KEYS];
  const values = rows.map((r) => Prisma.sql`(${Prisma.join([
    Prisma.sql`${r.id}`, Prisma.sql`${r.accountId}`, Prisma.sql`${r.security_id}`, Prisma.sql`${r.as_of}::date`,
    ...HOLDING_DATA_KEYS.map((k) => valueSql(k, r.data[k])),
  ])})`);
  const set = Prisma.join(HOLDING_DATA_KEYS.map((k) => Prisma.sql`${ident(k)} = EXCLUDED.${ident(k)}`));
  return Prisma.sql`INSERT INTO holdings (${Prisma.join(names.map(ident))}) VALUES ${Prisma.join(values)} ON CONFLICT ("accountId", security_id, as_of) DO UPDATE SET ${set}`;
}

export interface BatchingHoldingsDomainDb extends HoldingsDomainDb {
  /** Replay the buffered intents as the batched statements — inside the answer's transaction. */
  finish(): Promise<void>;
  /** For the log line: how many intents the answer issued and how many statements the flush ran. */
  stats(): { intents: number; statements: number };
}

/** The executor the binding needs — a Prisma transaction client, or a fake in the tests. */
export interface RawExecutor {
  $executeRaw(query: Prisma.Sql): Promise<number>;
}

export function prismaHoldingsDomain(tx: RawExecutor): BatchingHoldingsDomainDb {
  const securityIntents: Intent[] = [];
  const rows: HoldingRow[] = [];
  let statements = 0;
  let finished = false;
  const guard = () => { if (finished) throw new UnsupportedHoldingsWriteError('a write after finish()'); };
  return {
    securities: {
      async upsert(args) { guard(); securityIntents.push({ kind: 'security', args }); return {}; },
      async updateMany(args) { guard(); securityIntents.push({ kind: 'securityLink', args: args as (Intent & { kind: 'securityLink' })['args'] }); return {}; },
    },
    holdings: {
      async upsert(row) { guard(); assertRow(row); rows.push(row); return {}; },
    },
    async finish() {
      guard();
      finished = true;
      const plan = planInvestmentsWrites(securityIntents);
      for (const batch of chunks(plan.securities)) { await tx.$executeRaw(securitiesSql(batch)); statements += 1; }
      for (const links of chunks(plan.securityLinks)) { await tx.$executeRaw(securityLinkSql(links)); statements += 1; }
      for (const batch of chunks(planHoldings(rows))) { await tx.$executeRaw(holdingsSql(batch)); statements += 1; }
    },
    stats() { return { intents: securityIntents.length + rows.length, statements }; },
  };
}
