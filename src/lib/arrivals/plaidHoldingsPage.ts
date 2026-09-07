/**
 * REBUILD-01 PR-2d — PLAID HOLDINGS LAND AS SNAPSHOTS. One /investments/holdings/get
 * answer per item per sync, raw-first, in ONE database transaction (the PR-2 shape
 * of plaidTransactionsPage.ts / plaidInvestmentsPage.ts):
 *
 *   landResponse (the exact wire bytes; resource 'holding')
 *   → landObjects for the answer's securities[] (resource 'security', their_id =
 *     security_id — the same objects the investments answer carries, landed by
 *     the same rules; the holdings below reference them, holdings.security_id →
 *     securities.securityId) and for its holdings[] (resource 'holding', kind
 *     SNAPSHOT by the rule book's plaid · holding row). A holding has no provider
 *     id, so its their_id is COMPOSED and labeled composed (their_id_kind):
 *       holding:<account_id>:<security_id>:<as_of>
 *     where as_of is the UTC date the answer arrived — the moment the snapshot
 *     stands for. The answer carries no as-of of its own; a holding's
 *     institution_price_as_of is the price's date, stored as a column, never the
 *     snapshot's identity.
 *   → the parser writes securities (PR-2c's securityWrite, unchanged) and
 *     holdings rows FROM THE ARRIVAL PAYLOADS — one holdings row per account +
 *     security + as_of (UNIQUE: one snapshot per moment), pointed at its
 *     arrival (arrival_id NOT NULL)
 *   → each new arrival's read = now, status = done.
 *
 * Outcomes per holding, counted apart: landed (a new key — a row is written) ·
 * already_landed (the same snapshot again: same key, same content — the row
 * already points at this very arrival; nothing written; promise 2) · corrected
 * (same key, new content — the same day's position moved: a NEW arrival, the
 * row takes the latest and arrival_id moves to the newest; promise 1). A new
 * as_of is a new key — a new row, never a rewrite of yesterday's. A holding
 * whose account_id is none of the item's accounts is landed, read and COUNTED
 * as unmatched — declared, never silently dropped.
 *
 * A parser throw rolls the whole answer back (the response row, the arrivals,
 * the domain writes); the caller declares the failure with stage 'holdings'. A
 * non-2xx answer lands as evidence of the ask through recordFailedAnswer
 * (plaidTransactionsPage.ts) with this resource.
 */
import type { Holding, Security } from 'plaid';
import { stageFailed, type StageFailed } from '@/lib/plaid/failLoud';
import type { WireStamp } from '@/lib/plaid/wire';
import { landObjects, landResponse, markRead, type JsonObject, type LandingDb } from './land';
import { PLAID, type PageAccount, type PageClient } from './plaidTransactionsPage';
import { SECURITY, newId, securityWrite, type InvestmentsDomainDb, type SecurityPayload } from './plaidInvestmentsPage';

export const HOLDING = 'holding';

/** The UTC date an answer arrived — the snapshot's moment, the composed key's third part. */
export const asOfDate = (arrived: Date): string => arrived.toISOString().slice(0, 10);

/** The composed their_id of a holding — labeled composed on the arrival (their_id_kind). */
export const holdingTheirId = (h: { account_id: string; security_id: string }, asOf: string): string => `holding:${h.account_id}:${h.security_id}:${asOf}`;

export const HOLDING_KEY_KEYS = ['id', 'accountId', 'security_id', 'as_of'] as const;
export const HOLDING_DATA_KEYS = [
  'quantity', 'cost_basis', 'institution_price', 'institution_price_as_of', 'institution_price_datetime', 'institution_value',
  'iso_currency_code', 'unofficial_currency_code', 'arrival_id', 'updatedAt',
] as const;

/** One holdings row as the parser hands it to the domain port: the key (identity) and the values. Dates are ISO strings (as_of and institution_price_as_of: YYYY-MM-DD); the binding casts. Every value is present — null, never undefined. */
export interface HoldingRow {
  id: string;
  accountId: string;
  security_id: string;
  as_of: string;
  data: {
    quantity: number;
    cost_basis: number | null;
    institution_price: number;
    institution_price_as_of: string | null;
    institution_price_datetime: string | null;
    institution_value: number;
    iso_currency_code: string | null;
    unofficial_currency_code: string | null;
    arrival_id: string;
    updatedAt: Date;
  };
}

/** The domain port the parser writes through (a fake and the batching binding stand in). */
export interface HoldingsDomainDb {
  securities: InvestmentsDomainDb['securities'];
  holdings: {
    /** INSERT … ON CONFLICT ("accountId", security_id, as_of) DO UPDATE — the values and the arrival move to the newest. */
    upsert(row: HoldingRow): Promise<unknown>;
  };
}

export interface HoldingsPageInput {
  userId: string;
  /** The Plaid item this answer belongs to — its item_id is the arrival's `connection`. */
  connection: string;
  accounts: PageAccount[];
  wire: WireStamp;
  httpStatus: number;
  /** The objects in the answer — landed as they are; the parser never reads them. */
  securities: Security[];
  holdings: Holding[];
  now?: () => Date;
}

export interface HoldingsPageCounts {
  landed: number;
  already_landed: number;
  corrected: number;
  /** Holdings rows written (created or corrected) — the banner's count. */
  holdings: number;
  /** Security objects in the answer. */
  securities: number;
  /** Holdings whose account_id is none of the item's accounts — landed and read, no row; declared. */
  unmatched: number;
}

/** The sync's holdings row, from an arrival's payload. */
export function holdingWrite(h: Holding, accountRowId: string, asOf: string, arrivalId: string, now: Date): HoldingRow {
  return {
    id: newId('hold'),
    accountId: accountRowId,
    security_id: h.security_id,
    as_of: asOf,
    data: {
      quantity: h.quantity,
      cost_basis: h.cost_basis ?? null,
      institution_price: h.institution_price,
      institution_price_as_of: h.institution_price_as_of ?? null,
      institution_price_datetime: h.institution_price_datetime ?? null,
      institution_value: h.institution_value,
      iso_currency_code: h.iso_currency_code ?? null,
      unofficial_currency_code: h.unofficial_currency_code ?? null,
      arrival_id: arrivalId,
      updatedAt: now,
    },
  };
}

export interface HoldingsLanded {
  counts: HoldingsPageCounts;
  /** The snapshot's moment — the composed keys' date. */
  asOf: string;
}

/** Inside the caller's transaction: land, parse from the table, mark read. Throws to roll the answer back. */
export async function landHoldingsPage(landing: LandingDb, domain: HoldingsDomainDb, input: HoldingsPageInput): Promise<HoldingsLanded> {
  const now = input.now ?? (() => new Date());
  const asOf = asOfDate(input.wire.arrived);
  const counts: HoldingsPageCounts = { landed: 0, already_landed: 0, corrected: 0, holdings: 0, securities: input.securities.length, unmatched: 0 };

  const response = await landResponse(landing, {
    provider: PLAID,
    resource: HOLDING,
    userId: input.userId,
    guestRef: null,
    httpStatus: input.httpStatus,
    body: input.wire.body,
    asked: input.wire.asked,
    arrived: input.wire.arrived,
  });
  const base = { provider: PLAID, connection: input.connection, userId: input.userId, guestRef: null, responseId: response.id, asked: input.wire.asked, arrived: input.wire.arrived };

  const securities = await landObjects(landing, { ...base, resource: SECURITY, objects: input.securities.map((s) => ({ theirId: s.security_id, payload: s as unknown as JsonObject })) });
  const holdings = await landObjects(landing, {
    ...base,
    resource: HOLDING,
    objects: input.holdings.map((h) => ({ theirId: holdingTheirId(h, asOf), theirIdKind: 'composed' as const, payload: h as unknown as JsonObject })),
  });
  counts.landed = securities.landed + holdings.landed;
  counts.already_landed = securities.alreadyLanded + holdings.alreadyLanded;
  counts.corrected = securities.corrected + holdings.corrected;

  const at = now();
  const newRowIds: string[] = [];

  // Securities first — the holdings below reference them (PR-2c's rules, unchanged).
  for (const row of securities.rows) {
    if (row.outcome === 'already_landed') {
      await domain.securities.updateMany({ where: { securityId: row.their_id, arrival_id: null }, data: { arrival_id: row.id } });
      continue;
    }
    newRowIds.push(row.id);
    await domain.securities.upsert(securityWrite(row.payload as SecurityPayload, row.id, at));
  }

  for (const row of holdings.rows) {
    // Promise 2: the same snapshot again — the row already points at this very arrival; nothing to write.
    if (row.outcome === 'already_landed') continue;
    newRowIds.push(row.id);
    const h = row.payload as Holding;
    const account = input.accounts.find((acc) => acc.accountId === h.account_id);
    if (!account) { counts.unmatched++; continue; }
    // landed: a new key — a row; corrected: the same day's position moved — the row takes the latest, arrival_id moves.
    await domain.holdings.upsert(holdingWrite(h, account.id, asOf, row.id, at));
    counts.holdings++;
  }

  await markRead(landing, newRowIds, at);
  return { counts, asOf };
}

export type HoldingsPageResult = ({ ok: true } & HoldingsLanded) | { ok: false; failure: StageFailed };

/** The ports an answer runs through. A domain port that BUFFERS its writes (prismaHoldingsDomain) hands back `finish`, replayed inside the same transaction after the parser is done. */
export interface HoldingsPagePorts {
  landing: LandingDb;
  domain: HoldingsDomainDb;
  finish?: () => Promise<void>;
}

/** One answer, one transaction. A throw inside rolls it back and comes out as the declared failure (stage 'holdings'). */
export async function runHoldingsPage(
  client: PageClient,
  ports: (tx: unknown) => HoldingsPagePorts,
  input: HoldingsPageInput,
): Promise<HoldingsPageResult> {
  try {
    const landed = await client.$transaction(async (tx) => {
      const { landing, domain, finish } = ports(tx);
      const result = await landHoldingsPage(landing, domain, input);
      if (finish) await finish();
      return result;
    }, { maxWait: 10_000, timeout: 120_000 });
    return { ok: true, ...landed };
  } catch (error) {
    return { ok: false, failure: stageFailed('holdings', error) };
  }
}
