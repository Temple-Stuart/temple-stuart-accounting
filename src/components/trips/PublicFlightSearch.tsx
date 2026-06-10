'use client';

/**
 * PublicFlightSearch — the LIVE, logged-out flight search on the public travel
 * card (PR-4). It reuses the pure <FlightPickerView/> (T1) and drives a REAL
 * search against the now-PUBLIC /api/flights/search route (PR-3: auth gate gone,
 * bounded by per-IP rate-limit + daily provider cap). A guest types airports +
 * dates and sees real Duffel results.
 *
 * SEARCH is public; BOOKING is gated. The commit/uncommit ("Commit to Budget")
 * actions route to onRequireAuth (sign-up) — they do NOT fire the auth-gated
 * vendor-commit fetch (which 401s for guests anyway). No itinerary load (that's
 * authed + trip-scoped). No fake hotel/ground/activity cards — flights is the one
 * live public tool today; a short note says the rest is coming.
 */

import { useState, useEffect, useCallback } from 'react';
import FlightPickerView, { type FlightOffer, type FlightLeg } from './FlightPickerView';

interface Props {
  /** Opens the existing home register/login modal (booking requires sign-in). */
  onRequireAuth: () => void;
}

function defaultDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export default function PublicFlightSearch({ onRequireAuth }: Props) {
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

  // ── Manual entry (local only — "booked elsewhere") → sets a selected offer. ──
  const submitManual = (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg || !leg.manualPrice) return;

    const manualFlight: FlightOffer = {
      id: `manual-${Date.now()}`,
      price: parseFloat(leg.manualPrice),
      currency: 'USD',
      outbound: {
        departure: { airport: leg.origin, localTime: leg.manualDepartTime || '', date: leg.departureDate },
        arrival: { airport: leg.destination, localTime: leg.manualArriveTime || '', date: leg.manualArriveDate || leg.departureDate },
        duration: '',
        stops: 0,
        carriers: [leg.manualAirline || 'Manual Entry'],
      },
      return: leg.tripType === 'roundtrip' && leg.returnDate ? {
        departure: { airport: leg.destination, localTime: '', date: leg.returnDate },
        arrival: { airport: leg.origin, localTime: '', date: leg.returnDate },
        duration: '',
        stops: 0,
        carriers: [leg.manualAirline || 'Manual Entry'],
      } : null,
      isManual: true,
    };

    updateLeg(legId, { selectedOffer: manualFlight, expanded: false, manualAirline: '', manualPrice: '', manualDepartTime: '', manualArriveTime: '', manualArriveDate: '' });
  };

  // BOOKING is gated: the "Commit to Budget" / uncommit actions route to sign-up,
  // never the auth-gated vendor-commit fetch. (vendor-commit also 401s guests.)
  const book = () => onRequireAuth();

  return (
    <div className="mt-6 space-y-3">
      <div>
        <p className="text-sm text-text-primary mb-1">Search real flights — free, no account needed.</p>
        <p className="text-xs text-text-muted">
          Type two airports and a date to see live fares. Saving a flight to a trip asks
          you to sign up. Hotels, activities, and rides are coming next.
        </p>
      </div>

      <FlightPickerView
        legs={legs}
        committing={null}
        liveSearchEnabled={true}
        onUpdateLeg={updateLeg}
        onRemoveLeg={removeLeg}
        onAddLeg={addLeg}
        onSearchLeg={searchLeg}
        onSubmitManual={submitManual}
        onCommitLeg={book}
        onUncommitLeg={book}
      />
    </div>
  );
}
