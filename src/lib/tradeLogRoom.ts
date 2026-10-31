/**
 * TRADE-SPLIT — what Trade Log's room says when it holds no trade.
 *
 * A leaf: no imports, read by src/app/trade-log/page.tsx and by its test, so
 * the room's honesty is a behaviour and not a string match.
 *
 * THE FACT THIS LINE RESTS ON (TRADE-SPLIT STEP 0.4, the audit's answer). A
 * `trading_positions` row is created in exactly ONE place —
 * src/lib/position-tracker-service.ts:176 — from an `investment_transactions`
 * leg, reached through /api/investment-transactions/commit-to-ledger:116
 * (and stock-lots/route.ts:171, investments/assignment-exercise/route.ts:60,
 * src/lib/batch-trade-processor.ts:501, :729, :1330). Those legs are written
 * ONLY by the Plaid arrivals pass (src/lib/arrivals/plaidInvestmentsPage.ts:203,
 * :215 and prismaInvestmentsDomain.ts:87-100, through
 * /api/transactions/sync-complete). TastyTrade writes nothing but
 * `tastytrade_connections` (connect/disconnect/callback) — its positions are a
 * live read, never persisted.
 *
 * So: there is NO manual "log a trade" path, and Brokerage's TastyTrade
 * connection is NOT the door that fills this room. The line names the doors
 * that actually do — Banking (the Plaid connection and its sync) and Books
 * (where the synced transactions are committed) — because pointing a customer
 * at a door that cannot fill the room would be a fallback dressed as help.
 *
 * Building the missing manual entry is TRADE-LOG-01's job, not this PR's.
 *
 * ── TRADE-LOG-01 STEP 5 — THE ROOM NOW HAS TWO DOORS ────────────────────────
 * The audit above still holds for a SYNCED trade: that path is untouched. What
 * changed is that it is no longer the only path. src/app/api/trade-log/manual
 * writes a `trading_positions` row directly, one per leg under one trade_num,
 * with `source = 'manual'` and the owner's `userId` — and every reader treats
 * it exactly as it treats a synced one.
 *
 * So the line no longer says "there is no manual entry yet", because that
 * sentence is now false, and the first door it offers is the one that is right
 * here on this page: log the trade. The brokerage door stays, because for a
 * customer who already has a connection the sync is still the way to get a
 * whole book in without typing it.
 */

/** The one line an empty Trade Log shows. */
export const TRADE_LOG_EMPTY_ROOM =
  'No trades yet — log one by hand right here on LAB, or connect a brokerage in Banking, sync it and commit its transactions in Books.';

/** The doors the line names, in the order it names them. */
export const TRADE_LOG_EMPTY_ROOM_DOORS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Log a trade →', href: '#log-a-trade' },
  { label: 'Banking →', href: '/accounts' },
  { label: 'Books →', href: '/books' },
];

/** The day the room's line was set, with the audit behind it. */
export const TRADE_LOG_EMPTY_ROOM_SET_ON = '2026-09-16';

/**
 * Is the room empty? A room with no trade at all — NOT a room whose date
 * filter happens to exclude every trade, which the journal's own
 * "No trades in selected period" already says.
 */
export function tradeLogRoomIsEmpty(trades: readonly unknown[] | null | undefined): boolean {
  return (trades?.length ?? 0) === 0;
}
