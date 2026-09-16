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
 */

/** The one line an empty Trade Log shows. */
export const TRADE_LOG_EMPTY_ROOM =
  'No trades yet — a trade arrives when a brokerage connected in Banking is synced and its transactions are committed in Books; there is no manual entry yet.';

/** The doors the line names, in the order it names them. */
export const TRADE_LOG_EMPTY_ROOM_DOORS: ReadonlyArray<{ label: string; href: string }> = [
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
