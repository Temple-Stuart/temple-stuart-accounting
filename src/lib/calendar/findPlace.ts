/**
 * GEO-01 — ONE GEOCODE, ON PURPOSE. The pure half: the query the app sends, the
 * shape it reads back, and the cap arithmetic. No fetch here, so a test can
 * check all three without a network or a database.
 *
 * WHY IT IS ITS OWN CALL AND NOT src/lib/placesSearch.ts. That module's
 * `searchPlaces` is trip-shaped: it geocodes the CITY first (:86, one call),
 * then paginates Text Search up to three pages (:107-118, three more), so a
 * single search costs FOUR calls or more. GEO-01 rules ONE call per press. What
 * IS reused is everything that matters for the bill and the honesty: the
 * quota-guarded `googleFetch` (googlePlacesQuota.ts:63), the typed errors
 * (travelErrors.ts MissingGoogleKeyError / GooglePlacesApiError), and the same
 * Text Search status handling.
 */

/** Google Text Search returns at most 20 per page; the ruling shows at most 5. */
export const MAX_PLACE_MATCHES = 5;

/** One match, as the form shows it and as a pick fills the fields. */
export interface PlaceMatch {
  /** Google's own name for the place — what fills the location field on a pick. */
  name: string;
  /** The formatted address, shown beneath the name so two "Starbucks" differ. */
  address: string;
  placeId: string;
  latitude: number;
  longitude: number;
}

/** What the route answers with. `usage` rides along so the button can show the cap. */
export interface FindPlaceResult {
  query: string;
  matches: PlaceMatch[];
  /** Google's own status, passed through — ZERO_RESULTS is not an error. */
  status: string;
  usage: { callCount: number; cap: number; remaining: number; resetsOn: string };
}

/**
 * The Text Search URL for ONE query. `near` is the user's current location
 * LABEL when the app holds one — see the note below; it is folded into the
 * query text, which costs nothing extra.
 *
 * WHAT THE APP ACTUALLY HOLDS (GEO-01 STEP 1, audited): there is no current
 * -location COORDINATE anywhere — every latitude/longitude column in
 * schema.prisma belongs to a trip, a place, a reservation or an event. What
 * exists is `operations_north_star.current_location_label` (schema:3663), a
 * free-text label like "Bangkok". So the bias is applied the only way that adds
 * no source and no second call: the label is appended to the query text.
 * Turning the label into a `location=`/`radius=` pair would need the Geocoding
 * API — a SECOND metered call per press — which the ruling forbids.
 */
export function textSearchUrl(query: string, apiKey: string, near?: string | null): string {
  const q = near && near.trim() ? `${query.trim()} near ${near.trim()}` : query.trim();
  return `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${apiKey}`;
}

/** The exact text sent to Google, so the UI can show what was actually asked. */
export function searchText(query: string, near?: string | null): string {
  return near && near.trim() ? `${query.trim()} near ${near.trim()}` : query.trim();
}

/** A finite number, or null. A missing coordinate is never a zero. */
function coord(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Read Google's results into matches. A result with NO geometry is DROPPED
 * rather than shown with a fabricated pin — picking it could not fill the
 * fields it promises. Capped at MAX_PLACE_MATCHES.
 */
export function readMatches(results: unknown, limit = MAX_PLACE_MATCHES): PlaceMatch[] {
  if (!Array.isArray(results)) return [];
  const out: PlaceMatch[] = [];
  for (const r of results) {
    if (out.length >= limit) break;
    if (!r || typeof r !== 'object') continue;
    const p = r as Record<string, unknown>;
    const name = typeof p.name === 'string' ? p.name : null;
    if (!name) continue;
    const geometry = (p.geometry ?? {}) as Record<string, unknown>;
    const loc = (geometry.location ?? {}) as Record<string, unknown>;
    const lat = coord(loc.lat);
    const lng = coord(loc.lng);
    // No geometry ⇒ no pin to offer. Shown-but-unpickable would be worse.
    if (lat === null || lng === null) continue;
    out.push({
      name,
      address: typeof p.formatted_address === 'string' ? p.formatted_address : '',
      placeId: typeof p.place_id === 'string' ? p.place_id : '',
      latitude: lat,
      longitude: lng,
    });
  }
  return out;
}

/**
 * The first day of next month, UTC — when googlePlacesQuota's counter starts a
 * new row. `currentYearMonth()` there keys on the UTC year-month
 * (googlePlacesQuota.ts:22-25), so the reset is midnight UTC on the 1st.
 */
export function capResetsOn(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return new Date(Date.UTC(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 1)).toISOString().slice(0, 10);
}

/** How many calls are left this month. Never negative. */
export function remainingCalls(callCount: number, cap: number): number {
  return Math.max(0, cap - callCount);
}

/** The line the button shows when there is nothing left to spend. */
export function atCapLine(cap: number, resetsOn: string): string {
  return `Place search is at its monthly cap of ${cap} lookups and resets on ${resetsOn}. Type the place name and save it without coordinates — the event still works.`;
}
