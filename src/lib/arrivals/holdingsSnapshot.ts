/**
 * REBUILD-01 PR-2d — THE STORED SNAPSHOT, READ. /api/investments (and the
 * analysis route) used to ask Plaid for holdings live on every view; the one
 * asker is sync-complete's holdings stage, and this reads what it stored — never
 * asked twice. For each account: its latest as_of, and every holdings row of
 * that moment (a position sold since an older day is not shown as held); the
 * securities those rows name, from the securities table. Answered in Plaid's
 * field names — the shape the routes always returned — plus the snapshot's
 * moment and each row's arrival. No snapshot yet (never synced) is declared
 * as `as_of: null`, never dressed as an empty portfolio.
 */
import type { PrismaClient } from '@prisma/client';
import type { PageAccount } from './plaidTransactionsPage';

export type HoldingsReadDb = Pick<PrismaClient, 'holdings' | 'securities'>;

export interface StoredHolding {
  account_id: string;
  security_id: string;
  quantity: number;
  cost_basis: number | null;
  institution_price: number;
  institution_price_as_of: string | null;
  institution_price_datetime: string | null;
  institution_value: number;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  /** The snapshot's moment (YYYY-MM-DD). */
  as_of: string;
  arrival_id: string;
}

export interface StoredSecurity {
  security_id: string;
  name: string | null;
  ticker_symbol: string | null;
  type: string | null;
  isin: string | null;
  cusip: string | null;
  sedol: string | null;
  close_price: number | null;
  close_price_as_of: string | null;
}

export interface HoldingsSnapshot {
  /** The newest moment among the accounts' latest snapshots; null when nothing is stored yet. */
  as_of: string | null;
  holdings: StoredHolding[];
  securities: StoredSecurity[];
}

const dateStr = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export async function latestHoldingsSnapshot(db: HoldingsReadDb, accounts: PageAccount[]): Promise<HoldingsSnapshot> {
  if (accounts.length === 0) return { as_of: null, holdings: [], securities: [] };
  const rows = await db.holdings.findMany({
    where: { accountId: { in: accounts.map((a) => a.id) } },
    orderBy: [{ as_of: 'desc' }, { createdAt: 'desc' }],
  });
  // Each account's latest moment — the first row seen per account in as_of-desc order — then every row of that moment.
  const latestByAccount = new Map<string, number>();
  for (const r of rows) if (!latestByAccount.has(r.accountId)) latestByAccount.set(r.accountId, r.as_of.getTime());
  const latest = rows.filter((r) => latestByAccount.get(r.accountId) === r.as_of.getTime());
  const plaidAccountId = new Map(accounts.map((a) => [a.id, a.accountId]));
  const holdings: StoredHolding[] = latest.map((r) => ({
    account_id: plaidAccountId.get(r.accountId) as string,
    security_id: r.security_id,
    quantity: r.quantity,
    cost_basis: r.cost_basis,
    institution_price: r.institution_price,
    institution_price_as_of: dateStr(r.institution_price_as_of),
    institution_price_datetime: r.institution_price_datetime ? r.institution_price_datetime.toISOString() : null,
    institution_value: r.institution_value,
    iso_currency_code: r.iso_currency_code,
    unofficial_currency_code: r.unofficial_currency_code,
    as_of: dateStr(r.as_of) as string,
    arrival_id: r.arrival_id,
  }));
  const securityIds = [...new Set(latest.map((r) => r.security_id))];
  const secs = securityIds.length ? await db.securities.findMany({ where: { securityId: { in: securityIds } } }) : [];
  const securities: StoredSecurity[] = secs.map((s) => ({
    security_id: s.securityId,
    name: s.name,
    ticker_symbol: s.ticker_symbol,
    type: s.type,
    isin: s.isin,
    cusip: s.cusip,
    sedol: s.sedol,
    close_price: s.close_price,
    close_price_as_of: dateStr(s.close_price_as_of),
  }));
  const as_of = latest.length ? dateStr(new Date(Math.max(...latest.map((r) => r.as_of.getTime())))) : null;
  return { as_of, holdings, securities };
}
