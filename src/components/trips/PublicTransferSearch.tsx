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

import { useState } from 'react';
import ActivityResultsView, { type ActivityResult } from './ActivityResultsView';
import TravelSectionShell, { TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS } from './travelSection';

interface Props {
  /** Opens the existing home register/login modal (booking requires sign-in). */
  onRequireAuth: () => void;
}

export default function PublicTransferSearch({ onRequireAuth }: Props) {
  // Guest has no trip/destination props — start empty so they search by typing a
  // city + country. Transfer search is destination-based (no dates).
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [results, setResults] = useState<ActivityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // ── LIVE search against the PUBLIC /api/travel/transfers/search. ──
  const search = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!city.trim() || !country.trim()) {
      setError('Enter a city and country.');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        city: city.trim(),
        country: country.trim(),
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
        <div className="rounded-lg border border-border bg-white p-4 text-sm text-brand-red">{error}</div>
      )}
    </TravelSectionShell>
  );
}
