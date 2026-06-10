'use client';

/**
 * PublicActivitySearch — the LIVE, logged-out activity search on the public travel
 * card (PR-A3). It mirrors PublicHotelSearch: a guest types a destination and sees
 * REAL, image-rich tours/experiences from the now-PUBLIC PR-A1 route
 * (/api/travel/activities/search — no auth, bounded by per-IP rate-limit + the
 * daily Viator cap). Results render through the pure <ActivityResultsView/> (PR-A2).
 *
 * SEARCH is public; BOOKING is gated. Viator "booking" is an external affiliate
 * URL, already STRIPPED from the route payload (route.ts:76). "Book" routes to
 * onRequireAuth (sign-up) — this component fires NO booking fetch and renders NO
 * affiliate link. No authed loads, no trip scope. No fake results: the grid renders
 * exactly what the route returns.
 */

import { useState } from 'react';
import ActivityResultsView, { type ActivityResult } from './ActivityResultsView';

interface Props {
  /** Opens the existing home register/login modal (booking requires sign-in). */
  onRequireAuth: () => void;
}

export default function PublicActivitySearch({ onRequireAuth }: Props) {
  // Guest has no trip/destination props — start empty so they search by typing a
  // city + country. Activity search is destination-based (no dates).
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [results, setResults] = useState<ActivityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // ── LIVE search against the PUBLIC /api/travel/activities/search (PR-A1). ──
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

      const res = await fetch(`/api/travel/activities/search?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to search activities');
      }
      const data = await res.json();
      setResults((data.results || []) as ActivityResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activity search failed');
    } finally {
      setLoading(false);
    }
  };

  // BOOKING is gated: tapping "Book" routes to sign-up, never a booking fetch and
  // never an affiliate link. The view never books or links out — it calls back.
  const book = () => onRequireAuth();

  const inputClass =
    'bg-white border border-border rounded px-3 py-2 text-sm text-text-primary ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-purple/40';

  return (
    <div className="mt-10 pt-8 border-t border-border space-y-4">
      <div>
        <p className="text-lg font-bold text-brand-purple mb-1">Find real things to do — free, no account needed.</p>
        <p className="text-xs text-text-muted">
          Type a city and country to see real tours and experiences with photos and prices.
          Booking asks you to sign up.
        </p>
      </div>

      <form onSubmit={search} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (e.g. Lisbon)"
          className={`${inputClass} lg:col-span-2`}
          aria-label="Destination city"
        />
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country (e.g. Portugal)"
          className={inputClass}
          aria-label="Destination country"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover disabled:opacity-50"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Results: only after the first search. Empty/loading/error live in the view. */}
      {searched && (
        <ActivityResultsView results={results} loading={loading} error={error} onBook={book} />
      )}
      {!searched && error && (
        <div className="rounded-lg border border-border bg-white p-4 text-sm text-brand-red">{error}</div>
      )}
    </div>
  );
}
