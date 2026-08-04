// ─── The flights LANE flag (PR-FL-6a) ────────────────────────────────────────
// Which provider rail the PUBLIC flight search surface runs on. Server-resolved
// from the FLIGHTS_LANE env var — the RULED design:
//   - unset/empty  → 'duffel' (current behavior preserved — the honest default)
//   - 'duffel' | 'liteapi' → that lane
//   - anything else → THROW at resolution. Fail loud, never guess.
// Switching lanes is an EXPLICIT OPERATOR ACT (set the env, redeploy). There is
// NO runtime auto-detection and NO health-check fallback between lanes, ever —
// a broken lane fails loudly on its own rail.

export type FlightsLane = 'duffel' | 'liteapi';

// Resolution is memoized so the "lane resolved" line logs ONCE per server
// process, not per request. A throwing value is deliberately NOT memoized —
// every caller fails loudly until the env is fixed.
let resolved: FlightsLane | null = null;

export function flightsLane(): FlightsLane {
  if (resolved) return resolved;
  const raw = process.env.FLIGHTS_LANE;
  if (raw === undefined || raw === '') {
    resolved = 'duffel';
    console.log("[flights] FLIGHTS_LANE unset — lane resolved: 'duffel' (default)");
    return resolved;
  }
  if (raw === 'duffel' || raw === 'liteapi') {
    resolved = raw;
    console.log(`[flights] lane resolved: '${raw}' (FLIGHTS_LANE)`);
    return resolved;
  }
  throw new Error(`FLIGHTS_LANE has unrecognized value '${raw}' — expected 'duffel' or 'liteapi'`);
}
