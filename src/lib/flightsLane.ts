// ─── The flights LANE flag ───────────────────────────────────────────────────
// Which provider rail the flight search surfaces run on. LAUNCH-01 RETIRE-01
// retired Duffel: LiteAPI is the ONLY flights lane. Server-resolved from the
// FLIGHTS_LANE env var — the RULED design:
//   - unset/empty  → 'liteapi' (the default — the one lane there is)
//   - 'liteapi'    → 'liteapi'
//   - anything else (including the retired 'duffel') → THROW at resolution.
//     Fail loud, never guess.
// There is NO runtime auto-detection and NO fallback between lanes, ever — a
// broken lane fails loudly on its own rail.

export type FlightsLane = 'liteapi';

/** Every lane the product runs — one. A value outside this list is a config error. */
export const FLIGHTS_LANES: readonly FlightsLane[] = ['liteapi'];

export class FlightsLaneError extends Error {
  constructor(raw: string) {
    super(
      `FLIGHTS_LANE has unrecognized value '${raw}' — the only flights lane is 'liteapi' ` +
        `(Duffel was retired in LAUNCH-01; unset the variable or set it to 'liteapi')`,
    );
    this.name = 'FlightsLaneError';
  }
}

/** Pure: the lane a raw env value names. Unset/empty → 'liteapi'; 'liteapi' → 'liteapi'; anything else throws. */
export function resolveFlightsLane(raw: string | undefined): FlightsLane {
  if (raw === undefined || raw === '') return 'liteapi';
  if ((FLIGHTS_LANES as readonly string[]).includes(raw)) return raw as FlightsLane;
  throw new FlightsLaneError(raw);
}

// Resolution is memoized so the "lane resolved" line logs ONCE per server
// process, not per request. A throwing value is deliberately NOT memoized —
// every caller fails loudly until the env is fixed.
let resolved: FlightsLane | null = null;

export function flightsLane(): FlightsLane {
  if (resolved) return resolved;
  const raw = process.env.FLIGHTS_LANE;
  resolved = resolveFlightsLane(raw);
  console.log(
    raw === undefined || raw === ''
      ? "[flights] FLIGHTS_LANE unset — lane resolved: 'liteapi' (default)"
      : `[flights] lane resolved: '${raw}' (FLIGHTS_LANE)`,
  );
  return resolved;
}
