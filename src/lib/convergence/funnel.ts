/**
 * MODEL-02 STEP 3 — THE FUNNEL CONSTANTS, named and dated.
 *
 * A leaf: no imports, read by the pipeline (server), the route and the scan
 * panel (client). Each cut says what it is, what it was, and the day it was
 * set. The build (scripts/assert-tool-registry.ts, the funnel law) refuses a
 * bare number at any of the three sites.
 *
 * The funnel, in order (pipeline.ts):
 *   universe → Step C side rules → Step D: `limit × DEEP_FETCH_MULTIPLIER`
 *   symbols get the hard filters and the Finnhub deep fetch → Step F scores
 *   them → Step G ranks per side and the top STRUCTURE_CUT per side get a
 *   TastyTrade chain and structures.
 */

/** The day these were set. */
export const FUNNEL_SET_ON = '2026-09-16';

/**
 * The structure cut — how many ranked symbols PER SIDE get a live option chain
 * and structures (Step G → G2). Was an unnamed `TOP_N = 9` inside
 * rankAndDiversify since #1082. TastyTrade chains are free (no meter), so the
 * cut is the evidence's width, not a budget's: 40 per side.
 */
export const STRUCTURE_CUT = 40;

/**
 * The deep-fetch cut — `limit × DEEP_FETCH_MULTIPLIER` symbols (split by side
 * in BOTH mode) get the hard filters and the metered Finnhub deep fetch
 * (Step D). The multiplier was a bare `* 2` at two sites (pipeline.ts, the
 * second of which never binds — reported in MODEL-02).
 */
export const DEEP_FETCH_MULTIPLIER = 2;

/**
 * The scan panel's `limit` — the route's default was 20 while the panel sent 9
 * (18 deep-fetch symbols); the two now agree at 20 (40 deep-fetch symbols).
 * Per-scan Finnhub cost scales with this number — see the MODEL-02 report for
 * both figures (cold 468 → 1 040 calls; warm 144 → 320).
 */
export const SCAN_LIMIT_DEFAULT = 20;

/** The route's clamp on `limit` — unchanged, named here so the panel and the route read one number. */
export const SCAN_LIMIT_MIN = 4;
export const SCAN_LIMIT_MAX = 150;
