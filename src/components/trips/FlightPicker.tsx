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

  const fetchFlights = async () => {
    if (!destinationAirport) {
      setError('No airport code for this destination');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        origin: originAirport,
        destination: destinationAirport,
        departureDate,
        returnDate,
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
    } finally {
      setLoading(false);
    }
  };

  const formatStops = (stops: number) => {
    if (stops === 0) return 'Nonstop';
    if (stops === 1) return '1 stop';
    return `${stops} stops`;
  };

  // Collapsed view
  if (!expanded) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✈️</span>
            <div>
              <div className="font-medium text-gray-900">{destinationName}</div>
              <div className="text-sm text-gray-500">
                {originAirport} → {destinationAirport} • {departureDate} - {returnDate}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedFlight ? (
              <>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">${selectedFlight.price}</div>
                  <div className="text-xs text-gray-500">
                    {selectedFlight.outbound?.carriers[0]} • {formatStops(selectedFlight.outbound?.stops || 0)}
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(true)}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Change
                </button>
              </>
            ) : (
              <button
                onClick={fetchFlights}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✈️</span>
          <div>
            <div className="font-medium text-gray-900">{destinationName}</div>
            <div className="text-sm text-gray-500">
              {originAirport} → {destinationAirport} • Round-trip
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFlights}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            {loading ? '...' : '↻ Refresh'}
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2"></div>
          <div className="text-gray-500">Searching 300+ airlines via Duffel...</div>
        </div>
      ) : offers.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          <div className="text-3xl mb-2">🔍</div>
          <p>Click "Search Flights" to find options</p>
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((offer) => (
            <div
              key={offer.id}
              onClick={() => {
                onSelectFlight(offer);
                setExpanded(false);
              }}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                selectedFlight?.id === offer.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Outbound */}
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="font-bold text-gray-900">{offer.outbound?.departure.localTime}</div>
                      <div className="text-xs text-gray-500">{offer.outbound?.departure.airport}</div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="text-xs text-gray-400">{offer.outbound?.duration}</div>
                      <div className="relative">
                        <div className="border-t border-gray-300 my-1"></div>
                        {(offer.outbound?.stops || 0) > 0 && (
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-400 rounded-full"></div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{formatStops(offer.outbound?.stops || 0)}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-gray-900">{offer.outbound?.arrival.localTime}</div>
                      <div className="text-xs text-gray-500">{offer.outbound?.arrival.airport}</div>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {offer.outbound?.carriers.join(', ')}
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-4 h-12 border-l border-gray-200"></div>

                {/* Return */}
                {offer.return && (
                  <div className="flex-1">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="font-bold text-gray-900">{offer.return.departure.localTime}</div>
                        <div className="text-xs text-gray-500">{offer.return.departure.airport}</div>
                      </div>
                      <div className="flex-1 text-center">
                        <div className="text-xs text-gray-400">{offer.return.duration}</div>
                        <div className="relative">
                          <div className="border-t border-gray-300 my-1"></div>
                          {offer.return.stops > 0 && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-gray-400 rounded-full"></div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{formatStops(offer.return.stops)}</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-gray-900">{offer.return.arrival.localTime}</div>
                        <div className="text-xs text-gray-500">{offer.return.arrival.airport}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Price */}
                <div className="ml-4 text-right">
                  <div className="text-xl font-bold text-green-600">${offer.price}</div>
                  <div className="text-xs text-gray-500">per person</div>
                  {offer.conditions.refundable && (
                    <div className="text-xs text-green-500">✓ Refundable</div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          <div className="text-xs text-gray-400 text-center pt-2">
            Powered by Duffel • Prices include all taxes & fees
          </div>
        </div>
      )}
    </div>
  );
}
