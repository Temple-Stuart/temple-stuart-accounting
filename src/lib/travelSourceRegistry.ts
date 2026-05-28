// ─── Travel source registry (per-category data routing) ─────────────────────
// Single source of truth for "which provider backs which category." The
// scanner route reads this registry to dispatch a category's scan to its
// declared source instead of branching with hardcoded if-statements.
//
// New providers (LiteAPI, Mozio, Airalo, Cover Genius) plug in by:
//   1. Writing a client module under src/lib/providers/.
//   2. Adding a branch in the route's dispatch.
//   3. Flipping the registry entry from a placeholder source to the real one.
//
// LOCKED ARCHITECTURE (target state):
//   Bookable      → provider booking API (LiteAPI/Duffel/Viator/Mozio/...).
//                   Show ONLY bookable inventory; no Google masking.
//   Non-bookable  → Google Places (discovery / budgeting only).

import { TRAVEL_COA } from './travelCOA';

export type Source =
  | 'google'      // LIVE — Google Places (discovery / non-bookable categories).
  | 'viator'      // LIVE — Viator (bookable tours / activities / wellness).
  | 'liteapi'     // declared, NOT connected — bookable hotels (target for accommodation).
  | 'mozio'       // declared, NOT connected — bookable airport transfers.
  | 'covergenius' // declared, NOT connected — travel insurance quotes.
  | 'airalo'      // declared, NOT connected — eSIM data plans.
  | 'duffel';     // LIVE for flights via /api/flights/search (NOT this scanner route).

export interface SourceAssignment {
  source: Source;
  /** Hard-bookable categories MUST come from their declared provider. If the
   *  provider fails or returns nothing, the category fails loud / shows
   *  empty — it never falls back to Google. (A Google taxi POI in a
   *  "Transfers" slot would be unbookable junk.) Non-bookable / discovery
   *  categories are soft and can use Google freely. */
  hardBookable: boolean;
}

/** Thrown when a category's registered source has no implementation yet.
 *  Surfaces to the user as a 501 with "Category X routes to Y (provider not
 *  yet connected)" — honest about architectural intent, NOT a silent fall-
 *  back to Google. */
export class UnimplementedSourceError extends Error {
  readonly kind = 'unimplemented_source' as const;
  constructor(public source: Source, public category: string) {
    super(`Category "${category}" routes to ${source} (provider not yet connected)`);
    this.name = 'UnimplementedSourceError';
  }
}

/** Per-category source + bookability declaration.
 *  Keys MUST match TRAVEL_COA keys exactly (src/lib/travelCOA.ts:25-220). */
export const SOURCE_BY_CATEGORY: Record<string, SourceAssignment> = {
  // ─── Flights ─────────────────────────────────────────────────────────────
  // Handled by /api/flights/search (Duffel), NOT via this scanner route.
  // Declared here so the registry is exhaustive; excluded from the active
  // scan loop by travelCOA.getActiveScanCategories.
  flights:          { source: 'duffel', hardBookable: true },

  // ─── Bookable categories ─────────────────────────────────────────────────
  // TEMPORARY: accommodation stays on Google so live hotel discovery does
  // NOT regress before the LiteAPI client lands. Flip to
  // { source: 'liteapi', hardBookable: true } in the LiteAPI PR.
  // See audit-reports/travel-registry-pr-2.md for the rationale.
  accommodation:    { source: 'google', hardBookable: false }, // TODO(LiteAPI PR): switch to liteapi+hardBookable

  // LIVE on Viator — Activities / Tours / Wellness / Sports / Bucket-list.
  // hardBookable: a Google "yoga studio" POI is not a bookable Viator
  // experience, so empty Viator stays empty (no Google masking).
  sports_fitness:   { source: 'viator', hardBookable: true },
  arts_culture:     { source: 'viator', hardBookable: true },
  wellness:         { source: 'viator', hardBookable: true },
  bucket_list:      { source: 'viator', hardBookable: true },

  // Declared bookable, providers NOT connected yet → fail loud (501) until
  // their PRs land. NOT temporarily on Google because Google can't surface
  // bookable inventory for these (a Google "taxi service" POI is not a
  // bookable Mozio quote; a Google search for "insurance" is meaningless).
  ground_transport: { source: 'mozio',       hardBookable: true },
  insurance_fees:   { source: 'covergenius', hardBookable: true },
  communication:    { source: 'airalo',      hardBookable: true },

  // ─── Non-bookable / discovery (Google Places — budgeting, not booking) ──
  brunch_coffee:    { source: 'google', hardBookable: false },
  dinner:           { source: 'google', hardBookable: false },
  business_meals:   { source: 'google', hardBookable: false },
  // Moved OFF Viator per locked architecture — entertainment/event venues
  // aren't reliable Viator inventory; Google Places is fine for discovery.
  nightlife:        { source: 'google', hardBookable: false },
  festivals:        { source: 'google', hardBookable: false },
  conferences:      { source: 'google', hardBookable: false },
  coworking:        { source: 'google', hardBookable: false },
  shopping:         { source: 'google', hardBookable: false },
};

// Default for any non-COA category (e.g. legacy interest slugs that still
// reach the scanner). Soft, Google-backed — same behaviour as before.
const DEFAULT_ASSIGNMENT: SourceAssignment = { source: 'google', hardBookable: false };

/** Look up the source + bookability for a category. Returns a Google default
 *  for unknown categories. */
export function getSource(category: string): SourceAssignment {
  return SOURCE_BY_CATEGORY[category] ?? DEFAULT_ASSIGNMENT;
}

/** True for sources whose client lives in this codebase AND can be invoked
 *  from the scanner route today. Update when each provider PR lands. */
export function isSourceImplemented(source: Source): boolean {
  return source === 'google' || source === 'viator';
}

// ─── Self-check: every TRAVEL_COA key has a registry entry ───────────────────
// Compile-time guard — if someone adds a category to TRAVEL_COA they get a
// runtime warning in dev until they wire it into the registry.
if (process.env.NODE_ENV !== 'production') {
  const missing = Object.keys(TRAVEL_COA).filter(k => !(k in SOURCE_BY_CATEGORY));
  if (missing.length > 0) {
    console.warn(
      `[travelSourceRegistry] TRAVEL_COA categories without a registry entry: ${missing.join(', ')}`
    );
  }
}
