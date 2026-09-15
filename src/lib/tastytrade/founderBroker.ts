/**
 * TT-01 — THE SCANNER RUNS ON THE FOUNDER'S BROKER, and says so.
 *
 * There is no per-user TastyTrade credential anywhere in this codebase: the one
 * `new TastytradeClient(` (src/lib/tastytrade.ts:7) is built from
 * TASTYTRADE_CLIENT_SECRET + TASTYTRADE_REFRESH_TOKEN — Alex's own OAuth grant —
 * and the tastytrade_connections row holds the literal 'oauth' encrypted as its
 * sessionToken (src/app/api/tastytrade/connect/route.ts:59-60). So every scan,
 * for every entitled customer, spent the founder's broker session by documented
 * design (src/app/api/trading/convergence/route.ts:52-54).
 *
 * Until TT-02 lands the per-user authorization-code flow, the honest interim:
 * ONLY THE ADMIN MAY SPEND THE ADMIN'S BROKER. Everyone else is refused BEFORE
 * any cache read or upstream call, with this one line — the same line on the
 * scan form, in the JSON refusal and in the SSE stream's error event. One
 * const, so the three cannot drift.
 *
 * NO FALLBACK: a refused scan returns nothing computed, borrows no other
 * account, and makes zero upstream calls.
 */
export const FOUNDER_BROKER_LINE = "Trading runs on the founder's broker until per-user connections ship.";

/** The refusal's machine-readable reason, for tests and the UI. */
export const FOUNDER_BROKER_REASON = 'founder-broker' as const;

export type ScanGate =
  | { refused: true; reason: typeof FOUNDER_BROKER_REASON; line: string }
  | { refused: false };

/** Pure: may this viewer spend the founder's broker? Only the admin. */
export function scanGate(isAdmin: boolean): ScanGate {
  if (isAdmin) return { refused: false };
  return { refused: true, reason: FOUNDER_BROKER_REASON, line: FOUNDER_BROKER_LINE };
}

/**
 * Run a scan for a viewer, or refuse it. `run` is the paid pipeline; it is
 * NEVER invoked for a non-admin — a test hands in a spy and asserts it stayed
 * un-invoked (the discoveryGate.test.ts idiom: "the call is a spy that must
 * stay un-invoked when a gate refuses").
 */
export type ScanRun<T> =
  | { refused: true; reason: typeof FOUNDER_BROKER_REASON; line: string }
  | { refused: false; result: T };

export async function runScanForViewer<T>(isAdmin: boolean, run: () => Promise<T>): Promise<ScanRun<T>> {
  const gate = scanGate(isAdmin);
  if (gate.refused) return gate;
  return { refused: false, result: await run() };
}
