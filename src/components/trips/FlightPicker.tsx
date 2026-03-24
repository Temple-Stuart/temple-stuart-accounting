'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface FlightOffer {
  id: string;
  price: number;
  currency: string;
  outbound: {
    departure: { airport: string; airportName?: string; localTime: string; date: string };
    arrival: { airport: string; airportName?: string; localTime: string; date: string };
    duration: string;
    durationMinutes?: number;
    stops: number;
    carriers: string[];
    segments?: any[];
  } | null;
  return: {
    departure: { airport: string; airportName?: string; localTime: string; date: string };
    arrival: { airport: string; airportName?: string; localTime: string; date: string };
    duration: string;
    stops: number;
    carriers: string[];
  } | null;
  conditions?: {
    refundable: boolean;
    changeable: boolean;
  };
  isManual?: boolean;
}

interface FlightLeg {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  tripType: 'roundtrip' | 'oneway';
  offers: FlightOffer[];
  selectedOffer: FlightOffer | null;
  committed: boolean;
  commitId: string | null; // vendorOptionId for uncommit
  loading: boolean;
  error: string;
  expanded: boolean;
  // Manual entry fields
  manualAirline: string;
  manualPrice: string;
}

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

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

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
        departure: { airport: leg.origin, localTime: '', date: leg.departureDate },
        arrival: { airport: leg.destination, localTime: '', date: leg.departureDate },
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

    updateLeg(legId, { selectedOffer: manualFlight, expanded: false, manualAirline: '', manualPrice: '' });
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

  const formatStops = (stops: number) => {
    if (stops === 0) return 'Nonstop';
    if (stops === 1) return '1 stop';
    return `${stops} stops`;
  };

  const totalCommitted = legs.filter(l => l.committed).reduce((s, l) => s + (l.selectedOffer?.price || 0), 0);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      {totalCommitted > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 border border-emerald-200 rounded text-sm">
          <span className="text-emerald-800 font-medium">
            {legs.filter(l => l.committed).length} flight{legs.filter(l => l.committed).length !== 1 ? 's' : ''} committed
          </span>
          <span className="font-bold text-emerald-700">${totalCommitted.toLocaleString()}</span>
        </div>
      )}

      {/* Flight legs */}
      {legs.map((leg, legIdx) => (
        <div key={leg.id} className="bg-white border border-border rounded overflow-hidden">
          {/* Leg header */}
          <div
            className="flex items-center justify-between px-4 py-3 bg-bg-row border-b border-border cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => updateLeg(leg.id, { expanded: !leg.expanded })}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">✈️</span>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  {legs.length > 1 && <span className="text-text-muted">Leg {legIdx + 1}:</span>}
                  {leg.origin || '???'} → {leg.destination || '???'}
                  {leg.committed && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-medium rounded">Committed</span>}
                </div>
                <div className="text-xs text-text-muted">
                  {leg.departureDate}{leg.tripType === 'roundtrip' && leg.returnDate ? ` — ${leg.returnDate}` : ''} • {leg.tripType === 'roundtrip' ? 'Round-trip' : 'One-way'}
                  {leg.selectedOffer && !leg.committed && <span className="ml-2 text-brand-purple font-medium">${leg.selectedOffer.price} selected</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {leg.selectedOffer && <span className="text-sm font-bold text-brand-green">${leg.selectedOffer.price}</span>}
              <span className="text-xs text-text-muted">{leg.expanded ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Leg body */}
          {leg.expanded && (
            <div className="p-4 space-y-4">
              {/* Committed state */}
              {leg.committed ? (
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-medium">{leg.selectedOffer?.outbound?.carriers[0] || 'Flight'}</span>
                    <span className="text-text-muted ml-2">{leg.origin} → {leg.destination}</span>
                    <span className="ml-2 font-bold text-brand-green">${leg.selectedOffer?.price}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); uncommitLeg(leg.id); }} className="text-xs text-text-muted hover:text-red-600">Uncommit</button>
                </div>
              ) : (
                <>
                  {/* Search form */}
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">From</label>
                      <input type="text" value={leg.origin} onChange={e => updateLeg(leg.id, { origin: e.target.value.toUpperCase() })}
                        className="w-16 px-2 py-1.5 border border-border rounded text-xs font-mono text-center" maxLength={3} placeholder="LAX" />
                    </div>
                    <span className="text-text-muted pb-1.5">→</span>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">To</label>
                      <input type="text" value={leg.destination} onChange={e => updateLeg(leg.id, { destination: e.target.value.toUpperCase() })}
                        className="w-16 px-2 py-1.5 border border-border rounded text-xs font-mono text-center" maxLength={3} placeholder="DPS" />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">Depart</label>
                      <input type="date" value={leg.departureDate} onChange={e => updateLeg(leg.id, { departureDate: e.target.value })}
                        className="px-2 py-1.5 border border-border rounded text-xs" />
                    </div>
                    {leg.tripType === 'roundtrip' && (
                      <div>
                        <label className="text-[10px] text-text-muted block mb-0.5">Return</label>
                        <input type="date" value={leg.returnDate} onChange={e => updateLeg(leg.id, { returnDate: e.target.value })}
                          className="px-2 py-1.5 border border-border rounded text-xs" />
                      </div>
                    )}
                    <div className="flex items-center gap-1 bg-bg-row rounded p-0.5">
                      <button onClick={() => updateLeg(leg.id, { tripType: 'roundtrip' })}
                        className={`px-2 py-1 text-xs rounded transition-colors ${leg.tripType === 'roundtrip' ? 'bg-white shadow text-brand-purple font-medium' : 'text-text-secondary'}`}>
                        Round-trip
                      </button>
                      <button onClick={() => updateLeg(leg.id, { tripType: 'oneway' })}
                        className={`px-2 py-1 text-xs rounded transition-colors ${leg.tripType === 'oneway' ? 'bg-white shadow text-brand-purple font-medium' : 'text-text-secondary'}`}>
                        One-way
                      </button>
                    </div>
                    <button onClick={() => searchLeg(leg.id)} disabled={leg.loading}
                      className="px-3 py-1.5 bg-brand-purple text-white text-xs rounded hover:opacity-90 disabled:opacity-50">
                      {leg.loading ? 'Searching...' : '🔍 Search'}
                    </button>
                    {legs.length > 1 && !leg.committed && (
                      <button onClick={() => removeLeg(leg.id)} className="px-2 py-1.5 text-xs text-text-muted hover:text-red-600">✕</button>
                    )}
                  </div>

                  {leg.error && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs">{leg.error}</div>
                  )}

                  {/* Manual entry */}
                  <div className="p-3 bg-bg-row border border-border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-text-secondary font-medium">
                        {leg.offers.length === 0 && !leg.loading ? 'Enter flight details manually:' : 'Or enter manually (booked elsewhere):'}
                      </div>
                      <div className="flex gap-2">
                        <span className="text-[10px] text-text-faint">Search on:</span>
                        <a href="https://www.google.com/flights" target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-purple">Google Flights ↗</a>
                        <a href="https://www.kayak.com/flights" target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-purple">Kayak ↗</a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="text" value={leg.manualAirline} onChange={e => updateLeg(leg.id, { manualAirline: e.target.value })}
                        placeholder="Airline" className="flex-1 bg-white border border-border rounded px-2 py-1.5 text-xs" />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-text-muted">$</span>
                        <input type="number" value={leg.manualPrice} onChange={e => updateLeg(leg.id, { manualPrice: e.target.value })}
                          placeholder="Price" className="w-24 bg-white border border-border rounded px-2 py-1.5 text-xs" />
                      </div>
                      <button onClick={() => submitManual(leg.id)} disabled={!leg.manualPrice}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50">
                        Use This
                      </button>
                    </div>
                  </div>

                  {/* Search results */}
                  {leg.loading ? (
                    <div className="py-6 text-center">
                      <div className="animate-spin inline-block w-6 h-6 border-3 border-brand-purple border-t-transparent rounded-full mb-1"></div>
                      <div className="text-xs text-text-muted">Searching 300+ airlines via Duffel...</div>
                    </div>
                  ) : leg.offers.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs text-text-muted">{leg.offers.length} flights found — click to select:</div>
                      {leg.offers.map(offer => (
                        <div key={offer.id}
                          onClick={() => updateLeg(leg.id, { selectedOffer: offer })}
                          className={`p-3 border rounded cursor-pointer transition-all ${
                            leg.selectedOffer?.id === offer.id ? 'border-brand-purple bg-brand-purple-wash' : 'border-border hover:bg-bg-row'
                          }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <div className="font-bold text-sm text-text-primary">{offer.outbound?.departure.localTime}</div>
                                  <div className="text-[10px] text-text-muted">{offer.outbound?.departure.airport}</div>
                                </div>
                                <div className="flex-1 text-center">
                                  <div className="text-[10px] text-text-faint">{offer.outbound?.duration}</div>
                                  <div className="relative"><div className="border-t border-border my-1"></div>
                                    {(offer.outbound?.stops || 0) > 0 && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-text-faint rounded-full"></div>}
                                  </div>
                                  <div className="text-[10px] text-text-muted">{formatStops(offer.outbound?.stops || 0)}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-bold text-sm text-text-primary">{offer.outbound?.arrival.localTime}</div>
                                  <div className="text-[10px] text-text-muted">{offer.outbound?.arrival.airport}</div>
                                </div>
                              </div>
                              <div className="mt-0.5 text-[10px] text-text-muted">{offer.outbound?.carriers.join(', ')}</div>
                            </div>
                            {offer.return && (
                              <>
                                <div className="mx-3 h-10 border-l border-border"></div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-4">
                                    <div className="text-center">
                                      <div className="font-bold text-sm text-text-primary">{offer.return.departure.localTime}</div>
                                      <div className="text-[10px] text-text-muted">{offer.return.departure.airport}</div>
                                    </div>
                                    <div className="flex-1 text-center">
                                      <div className="text-[10px] text-text-faint">{offer.return.duration}</div>
                                      <div className="relative"><div className="border-t border-border my-1"></div>
                                        {offer.return.stops > 0 && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-text-faint rounded-full"></div>}
                                      </div>
                                      <div className="text-[10px] text-text-muted">{formatStops(offer.return.stops)}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="font-bold text-sm text-text-primary">{offer.return.arrival.localTime}</div>
                                      <div className="text-[10px] text-text-muted">{offer.return.arrival.airport}</div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                            <div className="ml-3 text-right">
                              <div className="text-sm font-bold text-brand-green">${offer.price}</div>
                              <div className="text-[10px] text-text-muted">per person</div>
                              {offer.conditions?.refundable && <div className="text-[10px] text-brand-green">Refundable</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="text-[10px] text-text-faint text-center pt-1">Powered by Duffel &middot; Prices include all taxes &amp; fees</div>
                    </div>
                  ) : null}

                  {/* Selected offer → Commit button */}
                  {leg.selectedOffer && !leg.committed && (
                    <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded">
                      <div className="text-sm">
                        <span className="font-medium">{leg.selectedOffer.outbound?.carriers[0] || 'Flight'}</span>
                        <span className="text-text-muted ml-2">{leg.origin} → {leg.destination}</span>
                        {leg.selectedOffer.outbound?.duration && <span className="text-text-muted ml-2">{leg.selectedOffer.outbound.duration}</span>}
                        <span className="ml-2 font-bold text-brand-green">${leg.selectedOffer.price}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateLeg(leg.id, { selectedOffer: null })} className="px-2 py-1 text-xs border border-border rounded">Clear</button>
                        <button onClick={() => commitLeg(leg.id)} disabled={committing === leg.id}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 disabled:opacity-50">
                          {committing === leg.id ? 'Committing...' : 'Commit to Budget'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add another leg */}
      <button onClick={addLeg}
        className="w-full py-2 text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center justify-center gap-2 border border-dashed border-purple-300 rounded hover:bg-purple-50 transition-colors">
        <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs">+</span>
        Add Another Flight Leg
      </button>

      {!process.env.NEXT_PUBLIC_DUFFEL_ENABLED && (
        <div className="text-[10px] text-text-faint text-center">
          Note: DUFFEL_API_TOKEN must be set for live flight search. Manual entry always works.
        </div>
      )}
    </div>
  );
}
