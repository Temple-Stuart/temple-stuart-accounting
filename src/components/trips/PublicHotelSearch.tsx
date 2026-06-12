'use client';

/**
 * PublicHotelSearch — the LIVE, logged-out hotel search on the public travel
 * card (PR-H3). It mirrors PublicFlightSearch: a guest types a destination +
 * dates and sees REAL, image-rich hotels from the now-PUBLIC PR-H1 route
 * (/api/travel/hotels/search — no auth, bounded by per-IP rate-limit + the daily
 * LiteAPI cap). Results render through the pure <HotelResultsView/> (PR-H2).
 *
 * SEARCH is public; BOOKING is gated. "Book" routes to onRequireAuth (sign-up) —
 * this component fires NO booking/prebook fetch (those routes 401 guests anyway).
 * No authed loads, no trip scope — a guest has neither. No fake results: the grid
 * renders exactly what the route returns.
 */

import { useState } from 'react';
import HotelResultsView, { type HotelResult } from './HotelResultsView';
import CountryCityPicker from './CountryCityPicker';

interface Props {
  /** Opens the existing home register/login modal (booking requires sign-in). */
  onRequireAuth: () => void;
}

function defaultDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export default function PublicHotelSearch({ onRequireAuth }: Props) {
  // PR-loc-2: destination is a LIST-CONFIRMED { city, country } from the linked
  // country→city picker (no free-text typos). null until a city is chosen.
  const [picked, setPicked] = useState<{ city: string; country: string; countryCode: string } | null>(null);
  const [checkin, setCheckin] = useState(defaultDate(30));
  const [checkout, setCheckout] = useState(defaultDate(33));
  const [adults, setAdults] = useState(2);

  const [results, setResults] = useState<HotelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // ── LIVE search against the PUBLIC /api/travel/hotels/search (PR-H1). ──
  const search = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!picked) {
      setError('Pick a country and a city from the list.');
      return;
    }
    if (!checkin || !checkout) {
      setError('Pick check-in and check-out dates.');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        city: picked.city,
        country: picked.country,
        // PR-loc-3: send the ISO-2 code so the search uses it directly (all 249
        // picker countries resolve). `country` name is kept too (back-compat/logs).
        countryCode: picked.countryCode,
        checkin,
        checkout,
        adults: String(adults),
      });

      const res = await fetch(`/api/travel/hotels/search?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to search hotels');
      }
      const data = await res.json();
      setResults((data.results || []) as HotelResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hotel search failed');
    } finally {
      setLoading(false);
    }
  };

  // BOOKING is gated: tapping "Book" routes to sign-up, never a booking/prebook
  // fetch (those routes 401 guests anyway). The view never books — it calls back.
  const book = () => onRequireAuth();

  const inputClass =
    'bg-white border border-border rounded px-3 py-2 text-sm text-text-primary ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-purple/40';

  return (
    <div className="mt-10 pt-8 border-t border-border space-y-4">
      <div>
        <p className="text-lg font-bold text-brand-purple mb-1">Search real hotels — free, no account needed.</p>
        <p className="text-xs text-text-muted">
          Type a destination and your dates to see live stays with photos and nightly prices.
          Booking a room asks you to sign up.
        </p>
      </div>

      <form onSubmit={search} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {/* PR-loc-2: linked country→city picker (real LiteAPI cities only)
            replaces the free-text city + country inputs. */}
        <CountryCityPicker onChange={setPicked} />
        <input
          type="date"
          value={checkin}
          onChange={(e) => setCheckin(e.target.value)}
          className={inputClass}
          aria-label="Check-in date"
        />
        <input
          type="date"
          value={checkout}
          onChange={(e) => setCheckout(e.target.value)}
          className={inputClass}
          aria-label="Check-out date"
        />
        <div className="flex gap-2">
          <select
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className={`${inputClass} flex-1`}
            aria-label="Guests"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} guest{n === 1 ? '' : 's'}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !picked}
            className="rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {/* Results: only after the first search. Empty/loading/error live in the view. */}
      {searched && (
        <HotelResultsView results={results} loading={loading} error={error} onBook={book} />
      )}
      {!searched && error && (
        <div className="rounded-lg border border-border bg-white p-4 text-sm text-brand-red">{error}</div>
      )}
    </div>
  );
}
