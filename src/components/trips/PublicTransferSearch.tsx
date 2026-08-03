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
 * SEARCH is public; BOOKING does not exist yet (PR-CHIP-1, Alex's ruling 2,
 * 2026-08-03): no ground vendor is wired (Mozio is declared-not-connected,
 * travelSourceRegistry.ts:22), so the old Book→sign-up wall was a false CTA —
 * signing up completed nothing (TRAVEL-CHIPS-AUDIT). The result rows now
 * render the honest disabled label "Booking coming soon" instead. The
 * affiliate URL stays STRIPPED at the route; this component fires NO booking
 * fetch and renders NO affiliate link. No fake results: the grid renders
 * exactly what the route returns, and an empty result shows an honest empty
 * state (never sample data).
 */

import { useState, useEffect } from 'react';
import ActivityResultsView, { type ActivityResult } from './ActivityResultsView';
import TravelSectionShell, { TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS, TRAVEL_LABEL_CLASS } from './travelSection';

interface Props {
  /** Interface stability only (both parents still pass it — LandingBookingSection
   *  :50, ModuleLauncher :800-807, untouched by PR-CHIP-1). Ground Book no
   *  longer routes to sign-up: no vendor exists, so the rows render the honest
   *  disabled label instead (ruling 2). */
  onRequireAuth: () => void;
  /** PR-3: unified-bar fan-out. When searchNonce increments, this section runs its OWN
   *  search for {sharedCity, sharedCountry}. Manual per-section search still works. */
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
      explainer="Real airport & hotel transfers. Booking coming soon."
    >
      <form onSubmit={search} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className={TRAVEL_LABEL_CLASS}>City</span>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Bali"
            className={TRAVEL_INPUT_CLASS}
            aria-label="Destination city"
          />
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
          PR-CHIP-1 (ruling 2): no onBook — ground has no vendor, so URL-less rows
          render the honest disabled label (the discover page's coming-soon posture). */}
      {searched && (
        <ActivityResultsView
          results={results}
          loading={loading}
          error={error}
          bookDisabledLabel="Booking coming soon"
        />
      )}
      {!searched && error && (
        <div className="rounded-lg border border-panel-border bg-panel-surface p-4 text-sm text-brand-red">{error}</div>
      )}
    </TravelSectionShell>
  );
}
