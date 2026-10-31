/**
 * TRIPS-01 (2026-09-29) — THE TRAVEL TAB SELECTS A TRIP FROM THE URL.
 *
 * There is ONE Trips tab: the Travel tab. The legacy planner under /budgets/trips
 * is four redirects now, and every link into a trip — a booking's "Trip" button
 * (src/lib/reservations/bookingRow.ts), a trip just created, the legacy URLs
 * themselves — lands on the Travel tab as /travel?trip=<id>.
 *
 * This leaf answers what that id selects, and it can only answer FROM THE LIST IT
 * IS HANDED: the signed-in user's own trips, exactly as AllTripsList already loads
 * them from GET /api/trips (user-scoped: src/app/api/trips/route.ts:25-26, where
 * userId is the caller's). It fetches nothing and builds no trip. An id that is not
 * in the list — another user's trip, a deleted one, a typo — selects nothing and
 * says so, in one line; the tab never tells a foreign id from an unknown one, so it
 * confirms nothing about a trip that is not yours (the defensive 404's rule).
 *
 * PURE: no fetch, no env, no window, no React.
 */

/** The one line the Travel tab shows when a link asks for a trip that is not in your list. */
export const TRIP_NOT_YOURS = "That trip isn't in your trips.";

/** What a requested id selects: one of YOUR rows — the row itself, never a copy — or nothing. */
export type UrlTrip<T> =
  | { kind: 'selected'; trip: T }
  | { kind: 'notYours' };

/** The ?trip a URL asks for — read only on /travel; any other path asks for none. */
export function requestedTripOf(
  pathname: string | null,
  params: { get(name: string): string | null } | null,
): string | null {
  if (pathname !== '/travel' || params === null) return null;
  return params.get('trip');
}

/** The requested id against the user's loaded list: the row with that id, or not yours. */
export function tripFromUrl<T extends { id: string }>(requested: string, rows: readonly T[]): UrlTrip<T> {
  const trip = rows.find((r) => r.id === requested);
  return trip === undefined ? { kind: 'notYours' } : { kind: 'selected', trip };
}

/** What the list does when the URL's request or the list itself changes. */
export type UrlTripStep<T> =
  /** Nothing to do: no request, the list is not loaded yet, or this request is already answered. */
  | { kind: 'wait' }
  /** The URL no longer asks (the tab consumed it): the same id may ask again, and will be answered again. */
  | { kind: 'forget' }
  /** Answer this request, once, from the loaded list. */
  | { kind: 'answer'; id: string; verdict: UrlTrip<T> };

/**
 * One step of AllTripsList's answer. It answers a request only once the list has
 * LOADED (a failed load answers nothing — the list's own error says why), only
 * from `rows`, and only once per arrival: `answered` is the id last answered, and
 * it is forgotten when the URL stops asking, so the same link followed again is
 * answered again.
 */
export function urlTripStep<T extends { id: string }>(
  requested: string | null,
  loaded: boolean,
  rows: readonly T[],
  answered: string | null,
): UrlTripStep<T> {
  if (requested === null) return answered === null ? { kind: 'wait' } : { kind: 'forget' };
  if (!loaded || answered === requested) return { kind: 'wait' };
  return { kind: 'answer', id: requested, verdict: tripFromUrl(requested, rows) };
}
