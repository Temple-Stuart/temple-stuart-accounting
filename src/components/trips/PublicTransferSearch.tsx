'use client';

/**
 * PublicTransferSearch — the LIVE, logged-out ground-transit search on the public
 * travel card ("Getting around"). Mirrors PublicActivitySearch exactly: a guest types
 * a destination and sees REAL, image-rich Viator transfer products (airport ⇄ hotel
 * rides, private drivers) from the now-PUBLIC /api/travel/transfers/search route
 * (no auth, bounded by per-IP rate-limit + the daily Viator cap — same cost profile as
 * the activities search). The route filters to the verified transfer tags (21745 +
 * 12044), merged + deduped. Results render through the same pure <ActivityResultsView/>
 * (the payload is the identical recommendation shape).
 *
 * SEARCH is public; BOOKING links out (PR-TILE-GROUND-A, Alex's ruling,
 * 2026-08-04 — supersedes CHIP-1's "coming soon" posture): the ground rows are
 * Viator transfer products, and the route now emits a VALIDATED `bookingUrl`
 * (viator.com + our pid via the shared emit gate, transfers/search/route.ts)
 * — so Book is a real outbound link rendered by the view, guest-completable.
 * Rows whose URL failed validation carry no bookingUrl and render no action
 * (absence is honest — never a fake CTA). This component itself still fires
 * NO booking fetch and constructs NO URL. No fake results: the grid renders
 * exactly what the route returns, and an empty result shows an honest empty
 * state (never sample data).
 */

import { useState, useEffect } from 'react';
import ActivityResultsView, { type ActivityResult } from './ActivityResultsView';
// PR-STRIP-DESIGN-2: icon-inside-field — MapPin marks the destination.
import { MapPin } from 'lucide-react';
import TravelSectionShell, { TravelField, TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS, TRAVEL_LABEL_CLASS } from './travelSection';

interface Props {
  /** Interface stability only (both parents still pass it — LandingBookingSection
   *  :50, ModuleLauncher :800-807, untouched by PR-CHIP-1). Ground Book no
   *  longer routes to sign-up: no vendor exists, so the rows render the honest
   *  disabled label instead (ruling 2). */
  onRequireAuth: () => void;
  /** PR-3 fan-out props — INERT since TRAVEL-RESTRUCTURE retired the unified
   *  destination bar (no mount passes these anymore). Kept optional so the
   *  contract stays available; this panel's own inputs are the search path. */
  sharedCity?: string;
  sharedCountry?: string;
  searchNonce?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function PublicTransferSearch({ onRequireAuth: _onRequireAuth, sharedCity, sharedCountry, searchNonce }: Props) {
  // Guest has no trip/destination props — start empty so they search by typing a
  // city + country. Transfer search is destination-based (no dates).
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [results, setResults] = useState<ActivityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // ── LIVE search against the PUBLIC /api/travel/transfers/search. Reused by both the
  //    form submit and the PR-3 unified-bar fan-out (same fetch, same route). ──
  const runSearch = async (cityVal: string, countryVal: string) => {
    if (!cityVal.trim() || !countryVal.trim()) {
      setError('Enter a city and country.');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        city: cityVal.trim(),
        country: countryVal.trim(),
      });

      const res = await fetch(`/api/travel/transfers/search?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to search transfers');
      }
      const data = await res.json();
      setResults((data.results || []) as ActivityResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer search failed');
    } finally {
      setLoading(false);
    }
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(city, country);
  };

  // PR-3: fan-out — when the unified bar's nonce changes, pre-fill this section's inputs
  // and fire its own search for that destination. Keyed on the nonce only (one fire per
  // "Search all"); manual per-section search is unaffected.
  useEffect(() => {
    if (!searchNonce) return;
    if (!sharedCity?.trim() || !sharedCountry?.trim()) return;
    setCity(sharedCity);
    setCountry(sharedCountry);
    runSearch(sharedCity, sharedCountry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchNonce]);

  return (
    <TravelSectionShell
      title="Getting around"
      explainer="Airport transfers & fast-track. Book on Viator."
      // PR-STRIP-DESIGN-1: under the strip the tab + per-mode line carry
      // this identity — the in-card header hides (title stays, sr-only).
      hideHeader
    >
      <form onSubmit={search} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className={TRAVEL_LABEL_CLASS}>City</span>
          <TravelField icon={<MapPin className="h-4 w-4" strokeWidth={1.75} />}>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Bali"
              className={`w-full pl-10 ${TRAVEL_INPUT_CLASS}`}
              aria-label="Destination city"
            />
          </TravelField>
        </label>
        <label className="flex flex-col gap-1">
          <span className={TRAVEL_LABEL_CLASS}>Country</span>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. Indonesia"
            className={TRAVEL_INPUT_CLASS}
            aria-label="Destination country"
          />
        </label>
        <div className="col-span-2 flex items-end lg:col-span-1">
          <button
            type="submit"
            disabled={loading}
            className={`${TRAVEL_BUTTON_CLASS} w-full`}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {/* Results: only after the first search. Empty/loading/error live in the view.
          PR-TILE-GROUND-A: rows with a validated bookingUrl render the outbound
          Book link (the view's CHIP-1 precedence); URL-less rows render no
          action — no onBook, no disabled label, no fake CTA. */}
      {searched && (
        <ActivityResultsView results={results} loading={loading} error={error} />
      )}
      {!searched && error && (
        <div className="rounded-lg border border-border bg-white p-4 text-sm text-brand-red">{error}</div>
      )}
    </TravelSectionShell>
  );
}
