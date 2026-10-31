/**
 * REBUILD-01 PR-2c — one page of /investments/transactions/get, raw-first, in
 * ONE database transaction (the PR-2 shape of plaidTransactionsPage.ts):
 *
 *   landResponse (the exact wire bytes; resource 'investment_transaction')
 *   → landObjects for the answer's securities[] (resource 'security', their_id
 *     = security_id) and for its investment_transactions[] (resource
 *     'investment_transaction', their_id = investment_transaction_id) — one
 *     arrival per object, fingerprinted, UNIQUE (provider, their_id, fingerprint)
 *   → the existing parser writes securities and investment_transactions rows
 *     FROM THE ARRIVAL PAYLOADS (never from response.data) and sets arrival_id
 *   → each new arrival's read = now, status = done.
 *
 * The answer's accounts[] and item{} are not landed as arrivals: the
 * transactions phase's answer carries the same accounts and neither phase
 * lands them as objects today (the rule book's plaid · account · REGISTRY row
 * is unused) — they ride the response bytes, once per answer. Holdings (kind
 * SNAPSHOT) land through plaidHoldingsPage.ts (PR-2d), which reuses
 * securityWrite for the securities the holdings answer carries.
 *
 * Three outcomes per object, counted apart: landed (a new id — parsed; an
 * investment transaction whose domain row PREDATES the store is linked and
 * counted skipped, exactly as the insert-only sync skipped it) · already_landed
 * (same id, same content — linked through arrival_id, never re-parsed;
 * promise 2) · corrected (same id, new content — a NEW arrival row, parsed;
 * the domain row takes the latest and arrival_id moves to the newest row;
 * promise 1). A security is parsed on landed and corrected — the sync's
 * upsert: every column on create, the price and option columns on update —
 * and linked on already_landed. Securities are written before the investment
 * transactions that reference them (investment_transactions.security_id →
 * securities.securityId).
 *
 * A parser throw rolls the whole page back (the response row, the page's
 * arrivals, its domain writes); the caller declares the failure with stage
 * 'investments' and the page. A non-2xx answer lands as evidence of the ask
 * through recordFailedAnswer (plaidTransactionsPage.ts) with this resource.
 */
import type { InvestmentTransaction, Security } from 'plaid';
import { stageFailed, type StageFailed } from '@/lib/plaid/failLoud';
import type { WireStamp } from '@/lib/plaid/wire';
import { landObjects, landResponse, markRead, type JsonObject, type LandingDb } from './land';
import { PLAID, type PageAccount, type PageClient } from './plaidTransactionsPage';

export const SECURITY = 'security';
export const INVESTMENT_TRANSACTION = 'investment_transaction';

/** Plaid's option_contract on a security — plaid 11.0.0's Security type omits it (the sync read it untyped); the four fields the parser stores. */
export interface OptionContractLike {
  contract_type?: string | null;
  expiration_date?: string | null;
  strike_price?: number | null;
  underlying_security_ticker?: string | null;
}
export type SecurityPayload = Security & { option_contract?: OptionContractLike | null };

/** The subset of the Prisma transaction client the parser writes through (typed loosely so a fake and the batching binding can stand in). */
export interface InvestmentsDomainDb {
  securities: {
    upsert(args: { where: { securityId: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<unknown>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
  };
  investment_transactions: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    upsert(args: { where: { investment_transaction_id: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<unknown>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
  };
}

export interface InvestmentsPageInput {
  page: number;
  userId: string;
  /** The Plaid item this page belongs to — its item_id is the arrival's `connection`. */
  connection: string;
  accounts: PageAccount[];
  /** investment_transaction_ids whose domain row already exists — loaded once per item, as the sync always did. */
  existing: Set<string>;
  wire: WireStamp;
  httpStatus: number;
  /** The objects in the answer — landed as they are; the parser never reads them. */
  securities: Security[];
  investmentTransactions: InvestmentTransaction[];
  now?: () => Date;
}

export interface InvestmentsPageCounts {
  landed: number;
  already_landed: number;
  corrected: number;
  synced: number;
  skipped: number;
  /** Security objects in the answer — the sync's `securities` count (every object, every page). */
  securities: number;
}

const dateOrNull = (v: string | null | undefined): Date | null => (v ? new Date(v) : null);
/** The sync's row id shape (`sec_…`, `inv_…`; PR-2d: `hold_…`). */
export const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/** The sync's securities upsert, from an arrival's payload: every column on create; the price and option columns (and the arrival) on update. */
export function securityWrite(s: SecurityPayload, arrivalId: string, now: Date): { where: { securityId: string }; create: Record<string, unknown>; update: Record<string, unknown> } {
  const o = s.option_contract;
  const update = {
    close_price: s.close_price ?? null,
    close_price_as_of: dateOrNull(s.close_price_as_of),
    option_contract_type: o?.contract_type || null,
    option_strike_price: o?.strike_price || null,
    option_expiration_date: dateOrNull(o?.expiration_date),
    option_underlying_ticker: o?.underlying_security_ticker || null,
    arrival_id: arrivalId,
  };
  return {
    where: { securityId: s.security_id },
    create: {
      id: newId('sec'),
      securityId: s.security_id,
      isin: s.isin ?? null,
      cusip: s.cusip ?? null,
      sedol: s.sedol ?? null,
      ticker_symbol: s.ticker_symbol ?? null,
      name: s.name ?? null,
      type: s.type ?? null,
      updatedAt: now,
      ...update,
    },
    update,
  };
}

/** The sync's investment_transactions row, from an arrival's payload. */
export function investmentWrite(t: InvestmentTransaction, accountRowId: string, arrivalId: string, now: Date): { id: string; investment_transaction_id: string; accountId: string; data: Record<string, unknown> } {
  return {
    id: newId('inv'),
    investment_transaction_id: t.investment_transaction_id,
    accountId: accountRowId,
    data: {
      amount: t.amount ?? null,
      cancel_transaction_id: t.cancel_transaction_id ?? null,
      date: new Date(t.date),
      fees: t.fees ?? null,
      iso_currency_code: t.iso_currency_code ?? null,
      name: t.name,
      price: t.price ?? null,
      quantity: t.quantity ?? null,
      security_id: t.security_id ?? null,
      subtype: t.subtype ?? null,
      type: t.type ?? null,
      unofficial_currency_code: t.unofficial_currency_code ?? null,
      arrival_id: arrivalId,
      updatedAt: now,
    },
  };
}

/** Inside the caller's transaction: land, parse from the table, mark read. Throws to roll the page back. */
export async function landInvestmentsPage(landing: LandingDb, domain: InvestmentsDomainDb, input: InvestmentsPageInput): Promise<InvestmentsPageCounts> {
  const now = input.now ?? (() => new Date());
  const counts: InvestmentsPageCounts = { landed: 0, already_landed: 0, corrected: 0, synced: 0, skipped: 0, securities: input.securities.length };

  const response = await landResponse(landing, {
    provider: PLAID,
    resource: INVESTMENT_TRANSACTION,
    userId: input.userId,
    guestRef: null,
    httpStatus: input.httpStatus,
    body: input.wire.body,
    asked: input.wire.asked,
    arrived: input.wire.arrived,
  });
  const base = { provider: PLAID, connection: input.connection, userId: input.userId, guestRef: null, responseId: response.id, asked: input.wire.asked, arrived: input.wire.arrived };

  const securities = await landObjects(landing, { ...base, resource: SECURITY, objects: input.securities.map((s) => ({ theirId: s.security_id, payload: s as unknown as JsonObject })) });
  const investments = await landObjects(landing, { ...base, resource: INVESTMENT_TRANSACTION, objects: input.investmentTransactions.map((t) => ({ theirId: t.investment_transaction_id, payload: t as unknown as JsonObject })) });
  counts.landed = securities.landed + investments.landed;
  counts.already_landed = securities.alreadyLanded + investments.alreadyLanded;
  counts.corrected = securities.corrected + investments.corrected;

  const at = now();
  const newRowIds: string[] = [];

  // Securities first — the investment transactions below reference them.
  for (const row of securities.rows) {
    if (row.outcome === 'already_landed') {
      await domain.securities.updateMany({ where: { securityId: row.their_id, arrival_id: null }, data: { arrival_id: row.id } });
      continue;
    }
    newRowIds.push(row.id);
    await domain.securities.upsert(securityWrite(row.payload as SecurityPayload, row.id, at));
  }

  for (const row of investments.rows) {
    if (row.outcome === 'already_landed') {
      // Promise 2: the table already holds this content — link the domain row, never re-parse.
      await domain.investment_transactions.updateMany({ where: { investment_transaction_id: row.their_id, arrival_id: null }, data: { arrival_id: row.id } });
      continue;
    }
    newRowIds.push(row.id);
    const t = row.payload as InvestmentTransaction;
    const account = input.accounts.find((acc) => acc.accountId === t.account_id);
    if (!account) continue;
    const w = investmentWrite(t, account.id, row.id, at);
    if (row.outcome === 'corrected') {
      // A correction is applied: latest-arrived wins, arrival_id moves to the newest row.
      await domain.investment_transactions.upsert({
        where: { investment_transaction_id: w.investment_transaction_id },
        create: { id: w.id, investment_transaction_id: w.investment_transaction_id, accountId: w.accountId, ...w.data },
        update: w.data,
      });
      counts.synced++;
    } else if (input.existing.has(t.investment_transaction_id)) {
      // The insert-only sync's skip: the row predates the store — point it at its arrival, never rewrite it.
      await domain.investment_transactions.updateMany({ where: { investment_transaction_id: t.investment_transaction_id, arrival_id: null }, data: { arrival_id: row.id } });
      counts.skipped++;
      counts.synced++;
    } else {
      await domain.investment_transactions.create({ data: { id: w.id, investment_transaction_id: w.investment_transaction_id, accountId: w.accountId, ...w.data } });
      counts.synced++;
    }
  }

  await markRead(landing, newRowIds, at);
  return counts;
}

export type InvestmentsPageResult = { ok: true; counts: InvestmentsPageCounts } | { ok: false; failure: StageFailed & { page: number } };

/** The ports a page runs through. A domain port that BUFFERS its writes (prismaInvestmentsDomain) hands back `finish`, replayed inside the same transaction after the parser is done. */
export interface InvestmentsPagePorts {
  landing: LandingDb;
  domain: InvestmentsDomainDb;
  finish?: () => Promise<void>;
}

/** One page, one transaction. A throw inside rolls the page back and comes out as the declared failure. */
export async function runInvestmentsPage(
  client: PageClient,
  ports: (tx: unknown) => InvestmentsPagePorts,
  input: InvestmentsPageInput,
): Promise<InvestmentsPageResult> {
  try {
    const counts = await client.$transaction(async (tx) => {
      const { landing, domain, finish } = ports(tx);
      const result = await landInvestmentsPage(landing, domain, input);
      if (finish) await finish();
      return result;
    }, { maxWait: 10_000, timeout: 120_000 });
    return { ok: true, counts };
  } catch (error) {
    return { ok: false, failure: { ...stageFailed('investments', error, input.page), page: input.page } };
  }
}
