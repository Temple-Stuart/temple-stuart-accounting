'use client';

import { useState } from 'react';

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
  bookingStatus?: 'watching' | 'booked_internal' | 'booked_external';
  isManual?: boolean;
}

interface Props {
  destinationName: string;
  destinationAirport: string;
  originAirport: string;
  departureDate: string;
  returnDate: string;
  passengers?: number;
  selectedFlight: FlightOffer | null;
  onSelectFlight: (flight: FlightOffer) => void;
}

export default function FlightPicker({
  destinationName,
  destinationAirport,
  originAirport,
  departureDate,
  returnDate,
  passengers = 1,
  selectedFlight,
  onSelectFlight,
}: Props) {
  const [offers, setOffers] = useState<FlightOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  
  // Editable airports
  const [editOrigin, setEditOrigin] = useState(originAirport);
  const [editDestination, setEditDestination] = useState(destinationAirport);
  
  // Manual entry state
  const [showManual, setShowManual] = useState(false);
  const [tripType, setTripType] = useState<'roundtrip' | 'oneway'>('roundtrip');
  const [manualAirline, setManualAirline] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualConfirmation, setManualConfirmation] = useState('');

  const fetchFlights = async () => {
    if (!destinationAirport) {
      setError('No airport code for this destination');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        origin: editOrigin || originAirport,
        destination: editDestination || destinationAirport,
        departureDate,
        ...(tripType === 'roundtrip' && returnDate ? { returnDate } : {}),
        passengers: passengers.toString(),
      });

      const res = await fetch(`/api/flights/search?${params}`);
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to search flights');
      }

      const data = await res.json();
      setOffers(data.offers || []);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setShowManual(true); // Show manual entry if API fails
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualPrice) return;
    
    const manualFlight: FlightOffer = {
      id: `manual-${Date.now()}`,
      price: parseFloat(manualPrice),
      currency: 'USD',
      outbound: {
        departure: { airport: editOrigin || originAirport, localTime: '', date: departureDate },
        arrival: { airport: editDestination || destinationAirport, localTime: '', date: departureDate },
        duration: '',
        stops: 0,
        carriers: [manualAirline || 'Manual Entry'],
      },
      return: {
        departure: { airport: editDestination || destinationAirport, localTime: '', date: returnDate },
        arrival: { airport: editOrigin || originAirport, localTime: '', date: returnDate },
        duration: '',
        stops: 0,
        carriers: [manualAirline || 'Manual Entry'],
      },
      bookingStatus: 'booked_external',
      isManual: true,
    };
    
    onSelectFlight(manualFlight);
    setExpanded(false);
    setShowManual(false);
  };

  const formatStops = (stops: number) => {
    if (stops === 0) return 'Nonstop';
    if (stops === 1) return '1 stop';
    return `${stops} stops`;
  };

  // Collapsed view
  if (!expanded) {
    return (
      <div className="bg-white border border-border rounded p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✈️</span>
            <div>
              <div className="font-medium text-text-primary">{destinationName}</div>
              <div className="text-sm text-text-muted flex items-center gap-1">
                <input 
                  type="text" 
                  value={editOrigin} 
                  onChange={(e) => setEditOrigin(e.target.value.toUpperCase())}
                  className="w-12 px-1 border rounded text-center font-mono"
                  maxLength={3}
                />
                <span>→</span>
                <input 
                  type="text" 
                  value={editDestination} 
                  onChange={(e) => setEditDestination(e.target.value.toUpperCase())}
                  className="w-12 px-1 border rounded text-center font-mono"
                  maxLength={3}
                />
                <button
                  onClick={fetchFlights}
                  disabled={loading}
                  className="ml-2 px-2 py-0.5 text-xs bg-brand-purple-wash text-brand-purple rounded hover:bg-brand-purple-wash disabled:opacity-50"
                >
                  {loading ? '...' : '🔍'}
                </button>
                <span>• {departureDate} - {returnDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedFlight ? (
              <>
                <div className="text-right">
                  <div className="text-terminal-lg font-bold text-brand-green">${selectedFlight.price}</div>
                  <div className="text-xs text-text-muted">
                    {selectedFlight.isManual ? (
                      <span className="text-orange-500">Manual entry</span>
                    ) : (
                      <>{selectedFlight.outbound?.carriers[0]} • {formatStops(selectedFlight.outbound?.stops || 0)}</>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(true)}
                  className="px-3 py-1.5 text-sm bg-bg-row text-text-secondary rounded hover:bg-border"
                >
                  Change
                </button>
              </>
            ) : (
              <button
                onClick={fetchFlights}
                disabled={loading}
                className="px-4 py-2 bg-brand-purple text-white rounded hover:bg-brand-purple disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search Flights'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Expanded view with offers
  return (
    <div className="bg-white border border-border rounded p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✈️</span>
          <div>
            <div className="font-medium text-text-primary">{destinationName}</div>
            <div className="text-sm text-text-muted">
              {originAirport} → {destinationAirport} • {tripType === 'roundtrip' ? 'Round-trip' : 'One-way'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-bg-row rounded p-1">
          <button
            onClick={() => setTripType('roundtrip')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tripType === 'roundtrip' ? 'bg-white shadow text-brand-purple font-medium' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Round-trip
          </button>
          <button
            onClick={() => setTripType('oneway')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tripType === 'oneway' ? 'bg-white shadow text-brand-purple font-medium' : 'text-text-secondary hover:text-text-primary'}`}
          >
            One-way
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFlights}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-bg-row text-text-secondary rounded hover:bg-border"
          >
            {loading ? '...' : '↻ Refresh'}
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="px-3 py-1.5 text-sm bg-bg-row text-text-secondary rounded hover:bg-border"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-brand-red text-sm">
          {error}
        </div>
      )}

      {/* Manual Entry Section - Always visible */}
      <div className="mb-4 p-4 bg-bg-row border border-border rounded">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-text-secondary font-medium">
            {offers.length === 0 && !loading ? "Enter flight details manually:" : "Or enter manually (booked elsewhere):"}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-text-faint">Search on:</span>
            <a href="https://www.google.com/flights" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-purple hover:text-brand-purple">Google Flights ↗</a>
            <a href="https://www.kayak.com/flights" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-purple hover:text-brand-purple">Kayak ↗</a>
            <a href="https://www.expedia.com/Flights" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-purple hover:text-brand-purple">Expedia ↗</a>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={manualAirline}
            onChange={(e) => setManualAirline(e.target.value)}
            placeholder="Airline (e.g. United)"
            className="bg-white border border-border rounded px-3 py-2 text-text-primary text-sm"
          />
        <div className="flex items-center gap-1 bg-bg-row rounded p-1">
          <button
            onClick={() => setTripType('roundtrip')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tripType === 'roundtrip' ? 'bg-white shadow text-brand-purple font-medium' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Round-trip
          </button>
          <button
            onClick={() => setTripType('oneway')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tripType === 'oneway' ? 'bg-white shadow text-brand-purple font-medium' : 'text-text-secondary hover:text-text-primary'}`}
          >
            One-way
          </button>
        </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">$</span>
            <input
              type="number"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              placeholder="Total price"
              className="flex-1 bg-white border border-border rounded px-3 py-2 text-text-primary text-sm"
            />
          </div>
          <input
            type="text"
            value={manualConfirmation}
            onChange={(e) => setManualConfirmation(e.target.value)}
            placeholder="Confirmation # (optional)"
            className="bg-white border border-border rounded px-3 py-2 text-text-primary text-sm"
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualPrice}
            className="bg-brand-green text-white rounded px-4 py-2 text-sm hover:bg-brand-green disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use This
          </button>
        </div>
        {manualPrice && (
          <div className="text-xs text-text-muted mt-2">
            ${(parseFloat(manualPrice) / passengers).toFixed(0)}/person for {passengers} traveler{passengers > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-brand-purple border-t-transparent rounded-full mb-2"></div>
          <div className="text-text-muted">Searching 300+ airlines via Duffel...</div>
        </div>
      ) : offers.length === 0 ? (
        <div className="py-4 text-center text-text-muted">
          <div className="text-3xl mb-2">🔍</div>
          <p>No flights found. Use manual entry above or try different dates.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-text-muted mb-2">{offers.length} flights found — click to select:</div>
          {offers.map((offer) => (
            <div
              key={offer.id}
              onClick={() => {
                onSelectFlight({ ...offer, bookingStatus: 'watching' });
                setExpanded(false);
              }}
              className={`p-3 border rounded cursor-pointer transition-all ${
                selectedFlight?.id === offer.id
                  ? 'border-brand-purple bg-brand-purple-wash'
                  : 'border-border hover:border-border hover:bg-bg-row'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Outbound */}
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="font-bold text-text-primary">{offer.outbound?.departure.localTime}</div>
                      <div className="text-xs text-text-muted">{offer.outbound?.departure.airport}</div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="text-xs text-text-faint">{offer.outbound?.duration}</div>
                      <div className="relative">
                        <div className="border-t border-border my-1"></div>
                        {(offer.outbound?.stops || 0) > 0 && (
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-text-faint rounded-full"></div>
                        )}
                      </div>
                      <div className="text-xs text-text-muted">{formatStops(offer.outbound?.stops || 0)}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-text-primary">{offer.outbound?.arrival.localTime}</div>
                      <div className="text-xs text-text-muted">{offer.outbound?.arrival.airport}</div>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-text-muted">
                    {offer.outbound?.carriers.join(', ')}
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-4 h-12 border-l border-border"></div>

                {/* Return */}
                {offer.return && (
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="font-bold text-text-primary">{offer.return.departure.localTime}</div>
                        <div className="text-xs text-text-muted">{offer.return.departure.airport}</div>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="text-xs text-text-faint">{offer.return.duration}</div>
                        <div className="relative">
                          <div className="border-t border-border my-1"></div>
                          {offer.return.stops > 0 && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-text-faint rounded-full"></div>
                          )}
                        </div>
                        <div className="text-xs text-text-muted">{formatStops(offer.return.stops)}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-text-primary">{offer.return.arrival.localTime}</div>
                        <div className="text-xs text-text-muted">{offer.return.arrival.airport}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Price */}
                <div className="ml-4 text-right">
                  <div className="text-sm font-bold text-brand-green">${offer.price}</div>
                  <div className="text-xs text-text-muted">per person</div>
                  {offer.conditions?.refundable && (
                    <div className="text-xs text-brand-green">✓ Refundable</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          <div className="text-xs text-text-faint text-center pt-2">
            Powered by Duffel • Prices include all taxes & fees • Click to select
          </div>
        </div>
      )}
    </div>
  );
}
