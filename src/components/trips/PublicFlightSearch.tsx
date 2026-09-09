'use client';

/**
 * PublicFlightSearch — the LIVE flight search on the public travel card (PR-4). It
 * reuses the pure <FlightPickerView/> (T1) and drives a REAL search against the
 * public LiteAPI flight search route (/api/travel/liteapi/flights/search — no auth
 * gate, bounded by per-IP rate-limit + the durable daily provider cap). Anyone —
 * logged in or not — types airports + dates and sees real LiteAPI results.
 * LAUNCH-01 RETIRE-01: Duffel is retired — LiteAPI is the only flights lane, and
 * the checkout below is the LiteAPI panel; there is no other rail to fall to.
 *
 * SEARCH is always free. SAVING a flight to a trip follows the freemium model
 * (PR-Flight-Commit): a guest gets the sign-up nudge (onRequireAuth); a logged-in
 * user with a selected trip commits to /api/trips/[id]/vendor-commit (the SAME path
 * the in-trip FlightPicker uses — budget line + itinerary + calendar event); a
 * logged-in user with no trip picked is told to pick or create a trip first. No fake
 * hotel/ground/activity cards — flights is the one live public tool here.
 */

import { useState, useEffect, useCallback } from 'react';
import FlightPickerView, { type FlightLeg, type FlightOffer } from './FlightPickerView';
import LiteApiFlightCheckoutPanel from './LiteApiFlightCheckoutPanel';
import { FLIGHTS_LANES, type FlightsLane } from '@/lib/flightsLane';
import { liteApiResultsToFlightOffers } from '@/lib/liteapiFlightAdapter';
import TravelSectionShell from './travelSection';

interface Props {
  /** Opens the existing home register/login modal (saving requires sign-in). */
  onRequireAuth: () => void;
  /** Login state from the home shell: null = still resolving, true/false once known. */
  authed?: boolean | null;
  /** The trip selected in the trips list above — where a committed flight is saved. */
  currentTrip?: { id: string; name?: string } | null;
  /** Called after a successful commit/uncommit so the trip's budget re-fetches. */
  onCommitted?: () => void;
}

function defaultDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export default function PublicFlightSearch({ onRequireAuth, authed, currentTrip, onCommitted }: Props) {
  // A guest has no trip/airport props — start one empty round-trip leg with
  // sensible near-future dates so they can search immediately by typing airports.
  const makeLeg = useCallback((overrides?: Partial<FlightLeg>): FlightLeg => ({
    id: `leg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    origin: '',
    destination: '',
    departureDate: defaultDate(30),
    returnDate: defaultDate(37),
    tripType: 'roundtrip',
    offers: [],
    selectedOffer: null,
    committed: false,
    commitId: null,
    loading: false,
    error: '',
    expanded: true,
    manualAirline: '',
    manualPrice: '',
    manualDepartTime: '',
    manualArriveTime: '',
    manualArriveDate: '',
    ...overrides,
  }), []);

  // PR-FL-6a: which provider rail this surface drives — SERVER-resolved
  // (FLIGHTS_LANE env via /api/travel/flights/lane; unset = 'liteapi', the only
  // lane since LAUNCH-01 RETIRE-01). null until the read lands; a failed/invalid
  // read BLOCKS searching with a declared error — the client NEVER guesses a
  // lane and NEVER falls back (the ruled no-auto-detection design).
  const [lane, setLane] = useState<FlightsLane | null>(null);
  const [laneError, setLaneError] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/travel/flights/lane');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Flight search is misconfigured.');
        if (!(FLIGHTS_LANES as readonly string[]).includes(data.lane)) {
          throw new Error('Flight search is misconfigured.');
        }
        if (!cancelled) setLane(data.lane);
      } catch (err) {
        if (!cancelled) setLaneError(err instanceof Error ? err.message : 'Flight search is misconfigured.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [legs, setLegs] = useState<FlightLeg[]>([]);
  // The leg currently committing (its button shows a pending state) — same as FlightPicker.
  const [committing, setCommitting] = useState<string | null>(null);
  // The offer being booked (pay now). Set when a card's "Book" is tapped; mounts the
  // LiteAPI checkout panel (passenger form → Nuitee-Stripe Elements). Guest-ok — NO
  // auth gate (booking is never locked, like hotels). The leg id is tracked alongside
  // the offer so the offer-expired pre-check can re-run the ORIGINAL search for that
  // leg, never silently re-quote.
  const [booking, setBooking] = useState<{ legId: string; offer: FlightOffer } | null>(null);

  const bookLeg = (legId: string) => {
    const leg = legs.find((l) => l.id === legId);
    if (!leg?.selectedOffer) return;
    // BOOK-1 mitigation (offer-expiry diagnosis): flight offers carry short
    // TTLs (expiresAt, when the provider states one). If the selected offer is
    // ALREADY dead, opening the checkout is certain failure — route straight to
    // the existing recovery (drop the selection, re-run the leg's ORIGINAL
    // search) instead. Mid-form expiry lands on the panel's own declared path.
    const exp = leg.selectedOffer.expiresAt;
    if (exp && new Date(exp).getTime() <= Date.now()) {
      updateLeg(legId, { selectedOffer: null });
      void searchLeg(legId);
      return;
    }
    setBooking({ legId, offer: leg.selectedOffer });
  };

  // One empty leg on mount. No authed itinerary load (guest has no trip).
  // (BOOK-1: the LAND-SEARCH-1 ls* prefill handoff died with the teaser —
  // the real search now lives ON the landing, so there is nothing to hand off.)
  useEffect(() => {
    if (legs.length === 0) setLegs([makeLeg()]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLeg = (legId: string, updates: Partial<FlightLeg>) => {
    setLegs(prev => prev.map(l => (l.id === legId ? { ...l, ...updates } : l)));
  };

  const removeLeg = (legId: string) => {
    setLegs(prev => {
      const filtered = prev.filter(l => l.id !== legId);
      return filtered.length > 0 ? filtered : [makeLeg()];
    });
  };

  const addLeg = () => {
    const lastLeg = legs[legs.length - 1];
    setLegs(prev => [...prev, makeLeg({
      origin: lastLeg?.destination || '',
      destination: '',
      departureDate: lastLeg?.departureDate || defaultDate(30),
      returnDate: '',
      tripType: 'oneway',
    })]);
  };

  // ── LIVE search — the LiteAPI lane (the only one): drives the FL-2 route and
  //    adapts its journeys into the picker shape. ──
  const searchLeg = async (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    if (!leg.origin || !leg.destination) {
      updateLeg(legId, { error: 'Enter both origin and destination airport codes' });
      return;
    }
    if (lane === null) {
      // Lane read failed or hasn't landed — declared, never a guessed lane.
      updateLeg(legId, { error: laneError || 'Search is still loading its configuration — try again in a moment.' });
      return;
    }

    updateLeg(legId, { loading: true, error: '', offers: [] });

    try {
      // Round-trip = TWO legs in ONE search (the documented legs[] contract);
      // the response's direction-tagged segments split back into the picker's
      // outbound/return blocks in the adapter. Currency is pinned USD — the
      // FL-2 route requires an explicit ISO code and the public surface
      // displays USD fares.
      const searchLegs = [
        { origin: leg.origin.trim().toUpperCase(), destination: leg.destination.trim().toUpperCase(), date: leg.departureDate },
        ...(leg.tripType === 'roundtrip' && leg.returnDate
          ? [{ origin: leg.destination.trim().toUpperCase(), destination: leg.origin.trim().toUpperCase(), date: leg.returnDate }]
          : []),
      ];
      const res = await fetch('/api/travel/liteapi/flights/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legs: searchLegs, adults: 1, currency: 'USD' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to search flights');
      }
      const data = await res.json();
      const offers = liteApiResultsToFlightOffers(data.results || []);
      updateLeg(legId, { offers, loading: false, expanded: true });
    } catch (err) {
      updateLeg(legId, { error: err instanceof Error ? err.message : 'Search failed', loading: false });
    }
  };

  // PR-Travel-Cleanup: the public home flight search drops the manual "enter flight
  // details" block entirely (enableManualEntry={false} below) — guests use the live LiteAPI
  // search, not hand-typed flights or competitor sites. The authed in-trip picker keeps
  // manual "booked elsewhere" entry. No submitManual handler is needed here anymore.

  // ── Commit a flight to the selected trip — the three freemium states. ──
  // Guest → sign-up nudge. Logged in + no trip → "pick a trip" (NOT a login prompt).
  // Logged in + a trip → the SAME vendor-commit POST the in-trip FlightPicker uses
  // (budget line + itinerary + calendar event), against currentTrip.id.
  const commitLeg = async (legId: string) => {
    if (authed !== true) { onRequireAuth(); return; }
    if (!currentTrip) {
      updateLeg(legId, { error: 'Pick or create a trip in Your Trips first, then save this flight to it.' });
      return;
    }
    const leg = legs.find(l => l.id === legId);
    if (!leg?.selectedOffer) return;

    setCommitting(legId);
    try {
      const offer = leg.selectedOffer;
      const title = `${leg.origin} → ${leg.destination}`;
      const flightId = `flight-${leg.id}-${Date.now()}`;
      const departTime = offer.outbound?.departure?.localTime || undefined;
      const arriveTime = offer.outbound?.arrival?.localTime || undefined;
      const arriveDate = offer.outbound?.arrival?.date || undefined;
      // PR-Flight-Duration-1: the provider's TRUE elapsed minutes (already parsed) so the calendar
      // can draw depart+duration instead of a naive cross-zone span (PR-2 renders it).
      const durationMinutes = offer.outbound?.durationMinutes ?? undefined;
      // PR-tz-0b: carry the departure/arrival airport IANA zones to the commit body. null
      // (never a hardcoded zone) when absent. vendor-commit has no column yet → it ignores
      // these until tz-1 adds storage. Staging only — nothing persists or renders them now.
      const originZone = offer.outbound?.departure?.timeZone ?? null;
      const destZone = offer.outbound?.arrival?.timeZone ?? null;

      const res = await fetch(`/api/trips/${currentTrip.id}/vendor-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: 'flight',
          optionId: flightId,
          startDate: leg.departureDate,
          endDate: leg.tripType === 'roundtrip' && leg.returnDate ? leg.returnDate : leg.departureDate,
          amount: offer.price,
          notes: title,
          startTime: departTime,
          endTime: arriveTime,
          arriveDate,
          durationMinutes,
          originZone,
          destZone,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not save the flight.');
      }
      updateLeg(legId, { committed: true, commitId: flightId, expanded: false });
      onCommitted?.();
    } catch (err) {
      updateLeg(legId, { error: err instanceof Error ? err.message : 'Could not save the flight.' });
    } finally {
      setCommitting(null);
    }
  };

  const uncommitLeg = async (legId: string) => {
    if (authed !== true || !currentTrip) { onRequireAuth(); return; }
    const leg = legs.find(l => l.id === legId);
    if (!leg?.commitId) return;
    try {
      const res = await fetch(`/api/trips/${currentTrip.id}/vendor-commit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: 'flight',
          optionId: leg.commitId,
          notes: `${leg.origin} → ${leg.destination}`,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not remove the flight.');
      }
      updateLeg(legId, { committed: false, commitId: null, selectedOffer: null });
      onCommitted?.();
    } catch (err) {
      updateLeg(legId, { error: err instanceof Error ? err.message : 'Could not remove the flight.' });
    }
  };

  return (
    <TravelSectionShell
      title="Flights"
      explainer="Live fares — book right here, or create a free account to save flights to a trip."
      // PR-STRIP-DESIGN-1: under the strip the tab + per-mode line carry
      // this identity — the in-card header hides (title stays, sr-only).
      hideHeader
    >
      <FlightPickerView
        legs={legs}
        committing={committing}
        liveSearchEnabled={true}
        onUpdateLeg={updateLeg}
        onRemoveLeg={removeLeg}
        onAddLeg={addLeg}
        onSearchLeg={searchLeg}
        enableManualEntry={false}
        onCommitLeg={commitLeg}
        onUncommitLeg={uncommitLeg}
        onBookLeg={bookLeg}
        providerLabel="LiteAPI"
      />

      {/* Book opens the LiteAPI checkout (FL-4/4b panel — passenger form →
          Nuitee-Stripe Elements; publishableKey-null renders its declared error
          until Nuitee's key lands) for the selected offer. Standalone + guest-ok,
          like the hotel Book; a booking made while signed in is adopted from the
          unattached list (UnattachedBookings). */}
      {booking && (
        <div className="mt-4 space-y-2">
          <LiteApiFlightCheckoutPanel
            offerId={booking.offer.id}
            price={booking.offer.price}
            currency={booking.offer.currency}
            onBooked={() => { onCommitted?.(); }}
          />
          <button
            type="button"
            onClick={() => setBooking(null)}
            className="text-xs text-text-muted underline hover:text-text-primary"
          >
            Close checkout
          </button>
        </div>
      )}
    </TravelSectionShell>
  );
}
