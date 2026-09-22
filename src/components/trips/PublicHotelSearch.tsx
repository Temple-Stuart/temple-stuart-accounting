'use client';

/**
 * PublicHotelSearch — the LIVE, logged-out hotel search on the public travel
 * card (PR-H3). It mirrors PublicFlightSearch: a guest picks a destination +
 * dates and sees REAL hotels from the now-PUBLIC PR-H1 route
 * (/api/travel/hotels/search — no auth, bounded by per-IP rate-limit + the daily
 * LiteAPI cap). Results render through the pure <HotelResultsView/> (PR-H2).
 *
 * HOTEL-01 (2026-09-22): A HOTEL APPEARS ONCE, A RATE SAYS WHAT IT BUYS. The
 * answer's `cards` (one per hotel, every quoted rate beneath it, tri-state from
 * the payload) render instead of the one-price rows; the screen's filters ride
 * the request as the vendor's own contract (src/lib/hotels/rates.ts
 * hotelSearchParamsOf — a control at "any" sends nothing) and a search fires
 * ONLY here, on the SEARCH press, counted for the session. Book and Save act on
 * the SELECTED rate: Book with that rate's offerId, Save with that rate's total
 * and the property's stated check-in / check-out times when the payload carried
 * them — never the 15:00 / 11:00 nobody stated.
 *
 * SEARCH is always free + public. "Book" (pay now → a real guest reservation via
 * CheckoutPanel, no login) and "Save to trip" (plan → a budgeted line) follow the
 * freemium model (PR-Hotel-Commit): a guest gets the sign-up nudge; a logged-in
 * user with a selected trip commits to /api/trips/[id]/vendor-commit as synthetic
 * lodging; a logged-in user with no trip picked is told to pick one. No fake results.
 */

import { useState } from 'react';
import HotelResultsView, { type HotelCardView, type HotelRateView } from './HotelResultsView';
import CheckoutPanel from './CheckoutPanel';
import CountryCityPicker from './CountryCityPicker';
// PR-STRIP-DESIGN-2: icon-inside-field (TravelField) — Calendar on dates,
// Users on guests (the ruled field anatomy; lucide = house vocabulary).
import { Calendar, Users } from 'lucide-react';
import TravelSectionShell, { TravelField, TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS, TRAVEL_LABEL_CLASS } from './travelSection';
import { DEFAULT_HOTEL_FILTERS, hhmmOf, hotelSearchParamsOf, type HotelUiFilters } from '@/lib/hotels/rates';

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

  const [cards, setCards] = useState<HotelCardView[]>([]);
  const [env, setEnv] = useState<'live' | 'sandbox' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  // HOTEL-01: the screen's filters — a control writes them here and nothing else happens.
  const [filters, setFilters] = useState<HotelUiFilters>(DEFAULT_HOTEL_FILTERS);
  // HOTEL-01: how many metered searches this session has sent — shown beside the controls.
  const [searchCount, setSearchCount] = useState(0);
  // HOTEL-01: the selected rate — Book and Save act on it.
  const [selected, setSelected] = useState<{ hotelId: string; rateId: string } | null>(null);

  // ── LIVE search against the PUBLIC /api/travel/hotels/search (PR-H1). The ONLY
  //    place a search fires — a filter change never does. ──
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
    setCards([]);
    setSelected(null);
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
        // HOTEL-01: the vendor's own filter and sort names — only what the screen set.
        ...hotelSearchParamsOf(filters),
      });

      setSearchCount((n) => n + 1);
      const res = await fetch(`/api/travel/hotels/search?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to search hotels');
      }
      const data = await res.json();
      setCards((data.cards || []) as HotelCardView[]);
      setEnv(data.env === 'live' ? 'live' : data.env === 'sandbox' ? 'sandbox' : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hotel search failed');
    } finally {
      setLoading(false);
    }
  };

  // PR-G3: BOOKING is GUEST-FRIENDLY — Book opens the real checkout panel right
  // here (no login) on the SELECTED rate's offerId. A rate with no offerId can't
  // be booked — the view's Book button says so instead of opening an empty checkout.
  const [checkoutOf, setCheckoutOf] = useState<{ card: HotelCardView; rate: HotelRateView; offerId: string } | null>(null);
  const book = (card: HotelCardView, rate: HotelRateView) => {
    if (rate.offerId === null) {
      setError(`${card.name}'s ${rate.roomName ?? 'rate'} can't be booked right now — try another rate.`);
      return;
    }
    setError('');
    setCheckoutOf({ card, rate, offerId: rate.offerId });
  };

  // ── Save to trip (budget) — the three freemium states (mirrors flights). ──
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const saveToTrip = async (card: HotelCardView, rate: HotelRateView) => {
    if (authed !== true) { onRequireAuth(); return; }
    if (!currentTrip) {
      setSaveNote({ kind: 'info', text: 'Pick or create a trip above first, then save this stay to it.' });
      return;
    }

    setSavingId(card.hotelId);
    setSaveNote(null);
    try {
      const detail = [
        rate.roomName,
        rate.boardName ?? rate.boardType,
        rate.perNight !== null ? `$${rate.perNight}/night` : null,
        card.nights !== null ? `${card.nights} night${card.nights === 1 ? '' : 's'}` : null,
        `hotel:${card.hotelId}`,
      ].filter(Boolean).join(' · ');
      // HOTEL-01: the property's STATED check-in / check-out clocks, when the payload
      // carried them — else the keys are absent and the commit stores no time.
      const startTime = hhmmOf(card.checkinTime);
      const endTime = hhmmOf(card.checkoutTime);

      const res = await fetch(`/api/trips/${currentTrip.id}/vendor-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: 'lodging',
          synthetic: true,                  // no DB option row — build from this payload
          optionId: `hotel-${card.hotelId}-${Date.now()}`,
          startDate: checkin,
          endDate: checkout,
          amount: rate.total,                // the selected rate's whole-stay total — not recomputed
          notes: detail ? `${card.name} | ${detail}` : card.name,
          recurrence: 'daily',              // a stay is a nightly recurring block
          location: card.city ?? card.address ?? undefined,
          ...(startTime ? { startTime } : {}),
          ...(endTime ? { endTime } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Save failed');
      }
      setSaveNote({ kind: 'ok', text: `Saved ${card.name} to ${currentTrip.name ?? 'your trip'}.` });
      onCommitted?.();
    } catch (err) {
      setSaveNote({ kind: 'err', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <TravelSectionShell
      title="Hotels"
      explainer="Live stays with nightly prices — book a room now; a free account budgets it."
      // PR-STRIP-DESIGN-1: under the strip the tab + per-mode line carry
      // this identity — the in-card header hides (title stays, sr-only).
      hideHeader
    >
      <form onSubmit={search} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {/* PR-loc-2: linked country→city picker (real LiteAPI cities only)
            replaces the free-text city + country inputs. */}
        <CountryCityPicker onChange={setPicked} />
        <label className="flex flex-col gap-1">
          <span className={TRAVEL_LABEL_CLASS}>Check-in</span>
          <TravelField icon={<Calendar className="h-4 w-4" strokeWidth={1.75} />}>
            <input
              type="date"
              value={checkin}
              onChange={(e) => setCheckin(e.target.value)}
              className={`w-full pl-10 ${TRAVEL_INPUT_CLASS}`}
              aria-label="Check-in date"
            />
          </TravelField>
        </label>
        <label className="flex flex-col gap-1">
          <span className={TRAVEL_LABEL_CLASS}>Check-out</span>
          <TravelField icon={<Calendar className="h-4 w-4" strokeWidth={1.75} />}>
            <input
              type="date"
              value={checkout}
              onChange={(e) => setCheckout(e.target.value)}
              className={`w-full pl-10 ${TRAVEL_INPUT_CLASS}`}
              aria-label="Check-out date"
            />
          </TravelField>
        </label>
        {/* PR-B: the guests select gets its OWN grid cell (it previously shared a
            flex row with the Search button, which squeezed the button past the cell's
            right edge — the reported cutoff). */}
        <label className="flex flex-col gap-1">
          <span className={TRAVEL_LABEL_CLASS}>Guests</span>
          <TravelField icon={<Users className="h-4 w-4" strokeWidth={1.75} />}>
          <select
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className={`w-full pl-10 ${TRAVEL_INPUT_CLASS}`}
            aria-label="Guests"
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} guest{n === 1 ? '' : 's'}</option>
            ))}
          </select>
          </TravelField>
        </label>
        {/* PR-B cutoff fix: Search button in its OWN final cell, full-width so it
            fills the column and never overflows. */}
        <div className="flex items-end">
          <button
            type="submit"
            // SEARCH-ALWAYS-ON: full-strength at rest — search() already
            // errors loudly on the missing pieces and clears on a
            // valid attempt; only loading dims.
            disabled={loading}
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
          className={`rounded-lg border bg-white p-3 text-sm ${
            saveNote.kind === 'ok'
              ? 'border-brand-green/40 text-brand-green'
              : saveNote.kind === 'err'
                ? 'border-brand-red/40 text-brand-red'
                : 'border-border text-text-secondary'
          }`}
        >
          {saveNote.text}
        </div>
      )}

      {/* Results (and the controls above them): only after the first search. */}
      {searched && (
        <HotelResultsView
          cards={cards}
          loading={loading}
          error={error}
          env={env}
          filters={filters}
          onFiltersChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          searchCount={searchCount}
          selected={selected}
          onSelect={(card, rate) => setSelected(rate ? { hotelId: card.hotelId, rateId: rate.rateId } : null)}
          onBook={book}
          onSave={saveToTrip}
          savingId={savingId}
        />
      )}
      {!searched && error && (
        <div className="rounded-lg border border-border bg-white p-4 text-sm text-brand-red">{error}</div>
      )}

      {/* PR-G3 + T2a: checkout opens directly on Book, guest-ok. For an AUTHED
          user with a trip selected above, the trip's id threads through the
          already-complete chain (returnUrl → /booking/confirm → liteapi/book
          ownership gate) so the booking is born attached. GUEST SAFETY: the
          liteapi/book route 401s a guest-with-tripId by design, so tripId passes
          ONLY under authed === true && currentTrip — provable from this
          component's own props (currentTrip is also only settable from the
          authed-gated trips list). A guest always books standalone, unchanged. */}
      {checkoutOf && (
        <CheckoutPanel
          tripId={authed === true && currentTrip ? currentTrip.id : undefined}
          tripName={authed === true && currentTrip ? currentTrip.name : undefined}
          authed={authed}
          offerId={checkoutOf.offerId}
          hotelId={checkoutOf.card.hotelId}
          images={checkoutOf.card.images}
          hotelName={checkoutOf.card.name}
          checkin={checkin}
          checkout={checkout}
          onClose={() => setCheckoutOf(null)}
          onBooked={() => { /* confirmation shows in-panel; nothing to persist here */ }}
        />
      )}
    </TravelSectionShell>
  );
}
