/**
 * TRADE-LOG-01 — WHO OWNS A trading_positions ROW. One predicate, one place.
 *
 * Before this PR the answer was implicit and retyped at every call site: a row
 * was yours if its `open_investment_txn_id` was in the set of investment
 * transaction ids on accounts you own. That is the ARRIVALS CHAIN, and it is
 * the only answer a synced row can give — it has no owner column.
 *
 * A hand-entered trade has no arrival, so under that chain it would be unowned
 * and invisible to every reader. TRADE-LOG-01 adds `trading_positions.userId`
 * and this predicate reads BOTH shapes:
 *
 *   yours  ⇔  userId = you            (explicit — hand-entered, and any row a
 *                                      writer that knows you records)
 *         OR  open_investment_txn_id ∈ your arrival ids   (the chain, unchanged)
 *
 * The two are OR'd, never mixed: an old row keeps the chain, a new hand-entered
 * row uses the column, and nothing about the arrivals pass changes. This is a
 * CAPABILITY predicate — it says who may see a row, and it never looks at
 * `source`. Provenance is for display and for splitting a read; it never
 * decides what a row can do.
 *
 * A leaf over Prisma's `where` shape: no database call of its own.
 */

/** The `where` fragment that scopes trading_positions to one user. */
export interface PositionOwnershipWhere {
  OR: [{ userId: string }, { open_investment_txn_id: { in: string[] } }];
}

/**
 * Scope trading_positions to `userId`. `arrivalTxnIds` is the user's
 * investment-transaction ids — the chain that owns every pre-TRADE-LOG-01 row.
 * Pass `[]` when the user has no connection at all; the explicit branch still
 * finds their hand-entered trades.
 */
export function positionOwnershipWhere(userId: string, arrivalTxnIds: readonly string[]): PositionOwnershipWhere {
  return { OR: [{ userId }, { open_investment_txn_id: { in: [...arrivalTxnIds] } }] };
}

/** The row shape the in-memory twin below needs. */
export interface OwnableRow {
  userId?: string | null;
  open_investment_txn_id?: string | null;
}

/**
 * The same question asked of a row already in hand — for the paths that fetch
 * first and check after (the Books commit walks a trade's legs). Same rule as
 * the `where` above, so the two can never drift.
 */
export function ownsPosition(row: OwnableRow, userId: string, arrivalTxnIds: ReadonlySet<string> | readonly string[]): boolean {
  if (row.userId != null && row.userId === userId) return true;
  const id = row.open_investment_txn_id;
  if (id == null) return false;
  const set = arrivalTxnIds instanceof Set ? arrivalTxnIds : new Set(arrivalTxnIds as readonly string[]);
  return set.has(id);
}

/** Every leg of a trade must be the caller's — the Books commit's rule (commit-to-ledger/route.ts:107-115). */
export function ownsEveryLeg(rows: readonly OwnableRow[], userId: string, arrivalTxnIds: ReadonlySet<string> | readonly string[]): boolean {
  if (rows.length === 0) return false;
  const set = arrivalTxnIds instanceof Set ? arrivalTxnIds : new Set(arrivalTxnIds as readonly string[]);
  return rows.every((r) => ownsPosition(r, userId, set));
}

// ── PROVENANCE ─────────────────────────────────────────────────────────────
// `source` already existed (VarChar(20), NOT NULL, DEFAULT 'legacy') and is
// TAX-SIGNIFICANT: src/lib/tax-report-service.ts:50-55 treats
// plaid/tastytrade/robinhood/legacy as broker-imported (Form 8949 Box A/D) and
// everything else as self-reported (Box B/E). 'manual' is deliberately NOT in
// that set — a hand-entered basis is not broker-reported, and Box B/E is the
// honest box for it.

/** What a hand-entered row records. */
export const MANUAL_SOURCE = 'manual';

/**
 * What a row born from the arrivals chain records. Until TRADE-LOG-01 the
 * synced writer (position-tracker-service.ts:174-181) set no source at all and
 * the column's DEFAULT 'legacy' answered for it — so the row said "I predate
 * the source column" when in fact it had just been written from a Plaid leg.
 * Now every writer names its own provenance. Both values are already inside
 * tax-report-service.ts BROKER_IMPORTED_SOURCES, so no Form 8949 box changes
 * and no existing row is touched: only what a NEW synced row says about itself.
 */
export const SYNCED_SOURCE = 'plaid';

/** Is this row hand-entered? For DISPLAY and for splitting a read — never for capability. */
export function isManualSource(source: string | null | undefined): boolean {
  return (source ?? '').toLowerCase() === MANUAL_SOURCE;
}

/** The word a surface shows next to a hand-entered trade. */
export const MANUAL_BADGE = 'hand-entered';

/**
 * The bias a hand-entered book carries, stated once and quoted wherever the
 * split is reported (scripts/edge-read.ts's honest frame).
 */
export const SELF_REPORTED_BIAS_NOTE =
  'A hand-entered trade is entered by the person being measured: its price, date and fees are self-reported and nothing verifies them against a broker.';
