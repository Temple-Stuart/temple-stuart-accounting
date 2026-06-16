'use client';

/**
 * PublicFlightSearch — the LIVE flight search on the public travel card (PR-4). It
 * reuses the pure <FlightPickerView/> (T1) and drives a REAL search against the
 * now-PUBLIC /api/flights/search route (PR-3: auth gate gone, bounded by per-IP
 * rate-limit + daily provider cap). Anyone — logged in or not — types airports +
 * dates and sees real Duffel results.
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
import FlightCheckoutPanel from './FlightCheckoutPanel';

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

  const [legs, setLegs] = useState<FlightLeg[]>([]);
  // The leg currently committing (its button shows a pending state) — same as FlightPicker.
  const [committing, setCommitting] = useState<string | null>(null);
  // PR-Duffel-Pay-3: the offer being booked (pay now). Set when a card's "Book" is tapped;
  // mounts the FlightCheckoutPanel. Guest-ok — NO auth gate (booking is never locked, like
  // hotels); the panel + backend run the Duffel Payments flow (TEST mode).
  const [bookingOffer, setBookingOffer] = useState<FlightOffer | null>(null);

  const bookLeg = (legId: string) => {
    const leg = legs.find((l) => l.id === legId);
    if (leg?.selectedOffer) setBookingOffer(leg.selectedOffer);
  };

  // One empty leg on mount. No authed itinerary load (guest has no trip).
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

  // ── LIVE search against the now-PUBLIC /api/flights/search (PR-3). ──
  const searchLeg = async (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg) return;

    if (!leg.origin || !leg.destination) {
      updateLeg(legId, { error: 'Enter both origin and destination airport codes' });
      return;
    }

    updateLeg(legId, { loading: true, error: '', offers: [] });

    try {
      const params = new URLSearchParams({
        origin: leg.origin,
        destination: leg.destination,
        departureDate: leg.departureDate,
        ...(leg.tripType === 'roundtrip' && leg.returnDate ? { returnDate: leg.returnDate } : {}),
        passengers: '1',
      });

      const res = await fetch(`/api/flights/search?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to search flights');
      }
      const data = await res.json();
      updateLeg(legId, { offers: data.offers || [], loading: false, expanded: true });
    } catch (err) {
      updateLeg(legId, { error: err instanceof Error ? err.message : 'Search failed', loading: false });
    }
  };

  // PR-Travel-Cleanup: the public home flight search drops the manual "enter flight
  // details" block entirely (enableManualEntry={false} below) — guests use the live Duffel
  // search, not hand-typed flights or competitor sites. The authed in-trip picker keeps
  // manual "booked elsewhere" entry. No submitManual handler is needed here anymore.

  // ── Commit a flight to the selected trip — the three freemium states. ──
  // Guest → sign-up nudge. Logged in + no trip → "pick a trip" (NOT a login prompt).
  // Logged in + a trip → the SAME vendor-commit POST the in-trip FlightPicker uses
  // (budget line + itinerary + calendar event), against currentTrip.id.
  const commitLeg = async (legId: string) => {
    if (authed !== true) { onRequireAuth(); return; }
    if (!currentTrip) {
      updateLeg(legId, { error: 'Pick or create a trip above first, then save this flight to it.' });
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
      // PR-Flight-Duration-1: Duffel's TRUE elapsed minutes (already parsed) so the calendar
      // can draw depart+duration instead of a naive cross-zone span (PR-2 renders it).
      const durationMinutes = offer.outbound?.durationMinutes ?? undefined;

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
    <div className="mt-10 pt-8 border-t border-border space-y-3">
      <div>
        <p className="text-lg font-bold text-brand-purple mb-1">Search real flights — free, no account needed.</p>
        <p className="text-xs text-text-muted">
          Type two airports and a date to see live fares — free, no account needed. To save a
          flight to a trip, log in and pick a trip above. Hotels, activities, and rides are coming next.
        </p>
      </div>

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
      />

      {/* PR-Duffel-Pay-3: Book opens the flight checkout (PR-2) for the selected offer —
          pay now via Duffel Payments (TEST mode). Standalone + guest-ok, like the hotel
          Book; the confirmation shows in-panel and its "Done" button closes it. */}
      {bookingOffer && (
        <FlightCheckoutPanel
          offer={{ id: bookingOffer.id, price: bookingOffer.price, currency: bookingOffer.currency }}
          passengerCount={1}
          onClose={() => setBookingOffer(null)}
          onBooked={() => { /* confirmation shows in-panel; nothing to persist here */ }}
        />
      )}
    </div>
  );
}
