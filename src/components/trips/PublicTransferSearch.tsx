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
 * SEARCH is public; BOOKING is gated. The affiliate URL is STRIPPED at the route; "Book"
 * routes to onRequireAuth (sign-up) — this component fires NO booking fetch and renders NO
 * affiliate link. No fake results: the grid renders exactly what the route returns, and an
 * empty result shows an honest empty state (never sample data).
 */

import { useState, useEffect } from 'react';
import ActivityResultsView, { type ActivityResult } from './ActivityResultsView';
import TravelSectionShell, { TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS } from './travelSection';

interface Props {
  /** Opens the existing home register/login modal (booking requires sign-in). */
  onRequireAuth: () => void;
  /** PR-3: unified-bar fan-out. When searchNonce increments, this section runs its OWN
   *  search for {sharedCity, sharedCountry}. Manual per-section search still works. */
  sharedCity?: string;
  sharedCountry?: string;
  searchNonce?: number;
}

export default function PublicTransferSearch({ onRequireAuth, sharedCity, sharedCountry, searchNonce }: Props) {
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

  // BOOKING is gated: tapping "Book" routes to sign-up, never a booking fetch and
  // never an affiliate link. The view never books or links out — it calls back.
  const book = () => onRequireAuth();

  return (
    <TravelSectionShell
      title="Getting around — airport rides & transfers, no account needed."
      explainer="Type a city and country to see real airport and hotel transfers with photos and prices. Booking asks you to sign up."
    >
      <form onSubmit={search} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (e.g. Bali)"
          className={`${TRAVEL_INPUT_CLASS} lg:col-span-2`}
          aria-label="Destination city"
        />
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country (e.g. Indonesia)"
          className={TRAVEL_INPUT_CLASS}
          aria-label="Destination country"
        />
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className={`${TRAVEL_BUTTON_CLASS} w-full`}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {/* Results: only after the first search. Empty/loading/error live in the view. */}
      {searched && (
        <ActivityResultsView results={results} loading={loading} error={error} onBook={book} />
      )}
      {!searched && error && (
        <div className="rounded-lg border border-panel-border bg-panel-surface p-4 text-sm text-brand-red">{error}</div>
      )}
    </TravelSectionShell>
  );
}
