'use client';

/**
 * FlightPicker — the LIVE, authed container for the flight picker.
 *
 * T1 split: this file keeps the EXACT live behavior it had before — it owns ALL
 * network (GET committed itinerary on mount / GET the PAID Duffel search via
 * /api/flights/search / POST + DELETE vendor-commit), all leg state + the manual
 * entry, and the env check — and now renders the pure <FlightPickerView/> with the
 * live `legs`/`committing` + the real handlers wired to its callbacks. The public
 * name + prop shape are unchanged, so the existing call site
 * (budgets/trips/[id]/page.tsx:819) is untouched and the authed booking flow
 * behaves EXACTLY as before.
 *
 * The paid Duffel search (api.duffel.com/air/offer_requests, reached via the
 * /api/flights/search route) is container-only and NEVER reachable from the pure
 * view. The real Duffel order (/air/orders, via /api/flights/book) is not invoked
 * by this component at all. NO new behavior, NO demo data, NO fallback.
 */

import { useState, useEffect, useCallback } from 'react';
import FlightPickerView, { type FlightOffer, type FlightLeg } from './FlightPickerView';

interface Props {
  tripId: string;
  destinationName: string;
  destinationAirport: string;
  originAirport: string;
  departureDate: string;
  returnDate: string;
  passengers?: number;
  onCommitted?: () => void;
}

const formatStops = (stops: number) => {
  if (stops === 0) return 'Nonstop';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
};

export default function FlightPicker({
  tripId,
  destinationName,
  destinationAirport,
  originAirport,
  departureDate,
  returnDate,
  passengers = 1,
  onCommitted,
}: Props) {
  const makeLeg = useCallback((overrides?: Partial<FlightLeg>): FlightLeg => ({
    id: `leg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    origin: originAirport || '',
    destination: destinationAirport || '',
    departureDate,
    returnDate,
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
  }), [originAirport, destinationAirport, departureDate, returnDate]);

  const [legs, setLegs] = useState<FlightLeg[]>([]);
  const [committing, setCommitting] = useState<string | null>(null);

  // Initialize first leg once airports are available
  useEffect(() => {
    if (legs.length === 0) {
      setLegs([makeLeg()]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update first leg's airports when props change (destinationAirport loads async)
  useEffect(() => {
    setLegs(prev => prev.map((leg, i) => {
      if (i !== 0 || leg.committed) return leg;
      const updates: Partial<FlightLeg> = {};
      if (!leg.origin && originAirport) updates.origin = originAirport;
      if (!leg.destination && destinationAirport) updates.destination = destinationAirport;
      return Object.keys(updates).length > 0 ? { ...leg, ...updates } : leg;
    }));
  }, [originAirport, destinationAirport]);

  // Load committed flights from itinerary on mount
  useEffect(() => {
    const loadCommitted = async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/itinerary`);
        if (!res.ok) return;
        const data = await res.json();
        const entries = data.itinerary || data.entries || [];
        // Group flight entries by vendorOptionId
        const flightGroups: Record<string, any[]> = {};
        for (const e of entries) {
          if (e.vendorOptionType === 'flight' && e.vendorOptionId) {
            if (!flightGroups[e.vendorOptionId]) flightGroups[e.vendorOptionId] = [];
            flightGroups[e.vendorOptionId].push(e);
          }
        }
        if (Object.keys(flightGroups).length === 0) return;
        const committedLegs: FlightLeg[] = Object.entries(flightGroups).map(([optId, entries]) => {
          const first = entries[0];
          const route = first.vendor || 'Flight';
          const parts = route.split(' → ');
          return makeLeg({
            id: `committed-${optId}`,
            origin: parts[0] || '',
            destination: parts[1] || parts[0] || '',
            departureDate: first.homeDate ? new Date(first.homeDate).toISOString().split('T')[0] : departureDate,
            tripType: 'oneway',
            committed: true,
            commitId: optId,
            expanded: false,
            selectedOffer: {
              id: optId,
              price: entries.reduce((s: number, e: any) => s + Number(e.cost || 0), 0),
              currency: 'USD',
              outbound: { departure: { airport: parts[0] || '', localTime: '', date: '' }, arrival: { airport: parts[1] || '', localTime: '', date: '' }, duration: '', stops: 0, carriers: [first.note || route] },
              return: null,
              isManual: true,
            },
          });
        });
        // Replace default leg with committed ones, keep an empty leg if user wants to add more
        setLegs(prev => {
          const uncommitted = prev.filter(l => !l.committed && (l.selectedOffer || l.offers.length > 0));
          return [...committedLegs, ...uncommitted.length > 0 ? uncommitted : [makeLeg({ expanded: false })]];
        });
      } catch { /* non-fatal */ }
    };
    loadCommitted();
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLeg = (legId: string, updates: Partial<FlightLeg>) => {
    setLegs(prev => prev.map(l => l.id === legId ? { ...l, ...updates } : l));
  };

  const removeLeg = (legId: string) => {
    setLegs(prev => {
      const filtered = prev.filter(l => l.id !== legId);
      return filtered.length > 0 ? filtered : [makeLeg()];
    });
  };

  const addLeg = () => {
    // Pre-populate: origin = last leg's destination
    const lastLeg = legs[legs.length - 1];
    setLegs(prev => [...prev, makeLeg({
      origin: lastLeg?.destination || destinationAirport || '',
      destination: '',
      departureDate: lastLeg?.departureDate || departureDate,
      returnDate: '',
      tripType: 'oneway',
    })]);
  };

  // ── Search ──
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
        passengers: passengers.toString(),
      });

      const res = await fetch(`/api/flights/search?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to search flights');
      }

      const data = await res.json();
      updateLeg(legId, { offers: data.offers || [], loading: false, expanded: true });
    } catch (err) {
      updateLeg(legId, { error: err instanceof Error ? err.message : 'Search failed', loading: false });
    }
  };

  // ── Manual Entry ──
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

  // ── Commit via vendor-commit ──
  const commitLeg = async (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg?.selectedOffer) return;

    setCommitting(legId);
    try {
      const offer = leg.selectedOffer;
      const carrier = offer.outbound?.carriers[0] || 'Flight';
      const title = `${leg.origin} → ${leg.destination}`;
      const notes = offer.isManual
        ? `${carrier} | ${title} | $${offer.price}`
        : `${carrier} | ${title} | ${offer.outbound?.duration || ''} | ${formatStops(offer.outbound?.stops || 0)} | $${offer.price}`;
      const flightId = `flight-${leg.id}-${Date.now()}`;

      // Extract departure/arrival times and dates from offer
      const departTime = offer.outbound?.departure?.localTime || undefined;
      const arriveTime = offer.outbound?.arrival?.localTime || undefined;
      const arriveDate = offer.outbound?.arrival?.date || undefined;
      // PR-Flight-Duration-Capture-AllPaths: Duffel's true elapsed minutes (parsed at
      // duffel.ts:307), mirroring PublicFlightSearch.tsx:165,180 so this in-trip path also
      // stores duration_minutes. undefined for manual offers → vendor-commit gate stores null.
      const durationMinutes = offer.outbound?.durationMinutes ?? undefined;

      const res = await fetch(`/api/trips/${tripId}/vendor-commit`, {
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
        const d = await res.json();
        throw new Error(d.error || 'Commit failed');
      }

      updateLeg(legId, { committed: true, commitId: flightId, expanded: false });
      if (onCommitted) onCommitted();
    } catch (err) {
      updateLeg(legId, { error: err instanceof Error ? err.message : 'Commit failed' });
    } finally {
      setCommitting(null);
    }
  };

  // ── Uncommit ──
  const uncommitLeg = async (legId: string) => {
    const leg = legs.find(l => l.id === legId);
    if (!leg?.commitId) return;

    try {
      const res = await fetch(`/api/trips/${tripId}/vendor-commit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: 'flight',
          optionId: leg.commitId,
          notes: `${leg.origin} → ${leg.destination}`,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Uncommit failed');
      }
      updateLeg(legId, { committed: false, commitId: null, selectedOffer: null });
      if (onCommitted) onCommitted();
    } catch (err) {
      updateLeg(legId, { error: err instanceof Error ? err.message : 'Uncommit failed' });
    }
  };

  return (
    <FlightPickerView
      legs={legs}
      committing={committing}
      liveSearchEnabled={!!process.env.NEXT_PUBLIC_DUFFEL_ENABLED}
      onUpdateLeg={updateLeg}
      onRemoveLeg={removeLeg}
      onAddLeg={addLeg}
      onSearchLeg={searchLeg}
      onSubmitManual={submitManual}
      onCommitLeg={commitLeg}
      onUncommitLeg={uncommitLeg}
    />
  );
}
