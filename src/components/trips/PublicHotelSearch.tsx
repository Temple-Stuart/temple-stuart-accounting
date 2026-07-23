'use client';

/**
 * PublicHotelSearch — the LIVE, logged-out hotel search on the public travel
 * card (PR-H3). It mirrors PublicFlightSearch: a guest types a destination +
 * dates and sees REAL, image-rich hotels from the now-PUBLIC PR-H1 route
 * (/api/travel/hotels/search — no auth, bounded by per-IP rate-limit + the daily
 * LiteAPI cap). Results render through the pure <HotelResultsView/> (PR-H2).
 *
 * SEARCH is always free + public. Two actions per stay: "Book" (pay now → a real
 * guest reservation via CheckoutPanel, no login) and "Save to trip" (plan → a
 * budgeted line). Save follows the freemium model (PR-Hotel-Commit): a guest gets
 * the sign-up nudge; a logged-in user with a selected trip commits to
 * /api/trips/[id]/vendor-commit as synthetic lodging (budget line + itinerary +
 * calendar event, the SAME path the discover "Add to trip" uses); a logged-in user
 * with no trip picked is told to pick or create one. No fake results.
 */

import { useState } from 'react';
import HotelResultsView, { type HotelResult } from './HotelResultsView';
import CheckoutPanel from './CheckoutPanel';
import CountryCityPicker from './CountryCityPicker';
import TravelSectionShell, { TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS } from './travelSection';

interface Props {
  /** Opens the existing home register/login modal (saving requires sign-in). */
  onRequireAuth: () => void;
  /** Login state from the home shell: null = resolving, true/false once known. */
  authed?: boolean | null;
  /** The trip selected in the trips list above — where a saved stay is budgeted. */
  currentTrip?: { id: string; name?: string } | null;
  /** Called after a successful save so the trip's budget re-fetches. */
  onCommitted?: () => void;
}

function defaultDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export default function PublicHotelSearch({ onRequireAuth, authed, currentTrip, onCommitted }: Props) {
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

  // PR-G3: BOOKING is now GUEST-FRIENDLY — tapping "Book" opens the real checkout
  // panel right here (no login). Guests book end-to-end (no trip); the routes
  // persist a guest reservation + commission. (onRequireAuth is kept for a future
  // "save to a trip — sign in" upsell, PR-G4.) A hotel with no bookable offer
  // can't be booked — surface that honestly instead of opening an empty checkout.
  const [checkoutHotel, setCheckoutHotel] = useState<HotelResult | null>(null);
  const book = (hotel: HotelResult) => {
    if (!hotel.liteapiOfferId) {
      setError(`${hotel.name} can't be booked right now — try another stay.`);
      return;
    }
    setError('');
    setCheckoutHotel(hotel);
  };

  // ── Save to trip (budget) — the three freemium states (mirrors flights). ──
  // Guest → sign-up nudge. Logged in + no trip → "pick a trip" (NOT a login prompt).
  // Logged in + a trip → POST the SAME synthetic-lodging vendor-commit the discover
  // "Add to trip" uses (budget line + itinerary + calendar), against currentTrip.id.
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const saveToTrip = async (hotel: HotelResult) => {
    if (authed !== true) { onRequireAuth(); return; }
    if (!currentTrip) {
      setSaveNote({ kind: 'info', text: 'Pick or create a trip above first, then save this stay to it.' });
      return;
    }
    const amount = hotel.priceTotal ?? hotel.price;
    if (amount == null) {
      setSaveNote({ kind: 'err', text: `${hotel.name} has no price to save — try another stay.` });
      return;
    }

    setSavingId(hotel.liteapiHotelId);
    setSaveNote(null);
    try {
      const detail = [
        hotel.pricePerNight != null ? `$${hotel.pricePerNight}/night` : null,
        hotel.nights != null ? `${hotel.nights} night${hotel.nights === 1 ? '' : 's'}` : null,
        hotel.liteapiHotelId ? `hotel:${hotel.liteapiHotelId}` : null,
      ].filter(Boolean).join(' · ');

      const res = await fetch(`/api/trips/${currentTrip.id}/vendor-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: 'lodging',
          synthetic: true,                  // no DB option row — build from this payload
          optionId: `hotel-${hotel.liteapiHotelId || 'manual'}-${Date.now()}`,
          startDate: checkin,
          endDate: checkout,
          amount,                            // whole-stay total — not recomputed
          notes: detail ? `${hotel.name} | ${detail}` : hotel.name,
          recurrence: 'daily',              // a stay is a nightly recurring block
          location: hotel.city || hotel.address || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Save failed');
      }
      setSaveNote({ kind: 'ok', text: `Saved ${hotel.name} to ${currentTrip.name ?? 'your trip'}.` });
      onCommitted?.();
    } catch (err) {
      setSaveNote({ kind: 'err', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <TravelSectionShell
      title="Search real hotels — free, no account needed."
      explainer="Type a destination and your dates to see live stays with photos and nightly prices. Book a room now — signed in, you can attach the stay to a trip at checkout; create a free account to budget it."
    >
      <form onSubmit={search} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* PR-loc-2: linked country→city picker (real LiteAPI cities only)
            replaces the free-text city + country inputs. */}
        <CountryCityPicker onChange={setPicked} />
        <input
          type="date"
          value={checkin}
          onChange={(e) => setCheckin(e.target.value)}
          className={TRAVEL_INPUT_CLASS}
          aria-label="Check-in date"
        />
        <input
          type="date"
          value={checkout}
          onChange={(e) => setCheckout(e.target.value)}
          className={TRAVEL_INPUT_CLASS}
          aria-label="Check-out date"
        />
        {/* PR-B: the guests select gets its OWN grid cell (it previously shared a
            flex row with the Search button, which squeezed the button past the cell's
            right edge — the reported cutoff). */}
        <select
          value={adults}
          onChange={(e) => setAdults(Number(e.target.value))}
          className={TRAVEL_INPUT_CLASS}
          aria-label="Guests"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n} guest{n === 1 ? '' : 's'}</option>
          ))}
        </select>
        {/* PR-B cutoff fix: Search button in its OWN final cell, full-width so it
            fills the column and never overflows. */}
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading || !picked}
            className={`${TRAVEL_BUTTON_CLASS} w-full`}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {/* Save-to-trip feedback (separate from the search error): pick-a-trip prompt,
          a saved confirmation, or a save error. */}
      {saveNote && (
        <div
          className={`rounded-lg border bg-panel-surface p-3 text-sm ${
            saveNote.kind === 'ok'
              ? 'border-brand-green/40 text-brand-green'
              : saveNote.kind === 'err'
                ? 'border-brand-red/40 text-brand-red'
                : 'border-panel-border text-white/70'
          }`}
        >
          {saveNote.text}
        </div>
      )}

      {/* Results: only after the first search. Empty/loading/error live in the view. */}
      {searched && (
        <HotelResultsView
          results={results}
          loading={loading}
          error={error}
          onBook={book}
          onSave={saveToTrip}
          savingId={savingId}
        />
      )}
      {!searched && error && (
        <div className="rounded-lg border border-panel-border bg-panel-surface p-4 text-sm text-brand-red">{error}</div>
      )}

      {/* PR-G3 + T2a: checkout opens directly on Book, guest-ok. For an AUTHED
          user with a trip selected above, the trip's id threads through the
          already-complete chain (returnUrl → /booking/confirm → liteapi/book
          ownership gate) so the booking is born attached. GUEST SAFETY: the
          liteapi/book route 401s a guest-with-tripId by design, so tripId passes
          ONLY under authed === true && currentTrip — provable from this
          component's own props (currentTrip is also only settable from the
          authed-gated trips list). A guest always books standalone, unchanged. */}
      {checkoutHotel && checkoutHotel.liteapiOfferId && (
        <CheckoutPanel
          tripId={authed === true && currentTrip ? currentTrip.id : undefined}
          tripName={authed === true && currentTrip ? currentTrip.name : undefined}
          authed={authed}
          offerId={checkoutHotel.liteapiOfferId}
          hotelId={checkoutHotel.liteapiHotelId}
          images={checkoutHotel.images}
          hotelName={checkoutHotel.name}
          checkin={checkin}
          checkout={checkout}
          onClose={() => setCheckoutHotel(null)}
          onBooked={() => { /* confirmation shows in-panel; nothing to persist here */ }}
        />
      )}
    </TravelSectionShell>
  );
}
