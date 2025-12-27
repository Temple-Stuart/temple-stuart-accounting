'use client';

import { useState } from 'react';

interface FlightOption {
  id: string;
  price: number;
  currency: string;
  outbound: {
    departure: { airport: string; localTime: string; date: string };
    arrival: { airport: string; localTime: string; date: string };
    duration: string;
    durationMinutes: number;
    stops: number;
    carriers: string[];
    segments: {
      carrier: string;
      flightNumber: string;
      departure: { airport: string; localTime: string };
      arrival: { airport: string; localTime: string };
    }[];
  } | null;
  return: {
    departure: { airport: string; localTime: string; date: string };
    arrival: { airport: string; localTime: string; date: string };
    duration: string;
    stops: number;
    carriers: string[];
  } | null;
}

interface Props {
  destinationName: string;
  destinationAirport: string;
  originAirport: string;
  departureDate: string;
  returnDate: string;
  selectedFlight: FlightOption | null | any;
  onSelectFlight: (flight: any) => void;
}

const AIRLINE_NAMES: Record<string, string> = {
  'UA': 'United Airlines', 'AA': 'American Airlines', 'DL': 'Delta Air Lines',
  'AS': 'Alaska Airlines', 'WN': 'Southwest', 'B6': 'JetBlue',
  'NK': 'Spirit Airlines', 'F9': 'Frontier', 'NH': 'ANA',
  'JL': 'Japan Airlines', 'AC': 'Air Canada', 'LH': 'Lufthansa',
  'BA': 'British Airways', 'AF': 'Air France', 'LX': 'Swiss',
};

export default function FlightPicker({
  destinationName,
  destinationAirport,
  originAirport,
  departureDate,
  returnDate,
  selectedFlight,
  onSelectFlight,
}: Props) {
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const fetchFlights = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(
        `/api/travel/flights?origin=${originAirport}&destination=${destinationAirport}&departureDate=${departureDate}&returnDate=${returnDate}&optimize=time`
      );
      
      if (!res.ok) {
        throw new Error('Failed to fetch flights');
      }
      
      const data = await res.json();
      setFlights(data.flights || []);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch flights');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string): string => {
    if (!time || time === 'TBD') return 'TBD';
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const formatDuration = (dur: string): string => {
    return dur?.replace('PT', '').replace('H', 'h ').replace('M', 'm') || '?';
  };

  const getAirlineName = (code: string): string => {
    return AIRLINE_NAMES[code] || code;
  };

  return (
    <div className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-zinc-750 flex justify-between items-center"
        onClick={() => flights.length > 0 ? setExpanded(!expanded) : fetchFlights()}
      >
        <div>
          <div className="font-medium">{destinationName}</div>
          <div className="text-sm text-zinc-400">
            {originAirport} → {destinationAirport} • {departureDate} to {returnDate}
          </div>
        </div>
        
        {selectedFlight ? (
          <div className="text-right">
            <div className="text-green-400 font-bold">${selectedFlight.price}</div>
            <div className="text-xs text-zinc-400">
              {selectedFlight.outbound?.carriers?.map((c: string) => getAirlineName(c)).join(', ')}
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); fetchFlights(); }}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? '⏳ Loading...' : '🔍 Search Flights'}
          </button>
        )}
      </div>

      {/* Selected Flight Summary */}
      {selectedFlight && !expanded && (
        <div className="px-4 pb-3 border-t border-zinc-700">
          <div className="flex justify-between items-center text-sm pt-2">
            <div>
              <span className="text-zinc-300">Depart:</span>
              <span className="ml-2 text-white">{formatTime(selectedFlight.outbound?.departure?.localTime || '')}</span>
              <span className="mx-2 text-zinc-500">→</span>
              <span className="text-white">{formatTime(selectedFlight.outbound?.arrival?.localTime || '')}</span>
              <span className="ml-2 text-zinc-500">
                ({selectedFlight.outbound?.stops === 0 ? 'Direct' : `${selectedFlight.outbound?.stops} stop`})
              </span>
            </div>
            <button 
              onClick={() => setExpanded(true)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Flight Options List */}
      {expanded && (
        <div className="border-t border-zinc-700">
          {error && (
            <div className="p-4 text-red-400 text-sm">{error}</div>
          )}
          
          {flights.length === 0 && !loading && !error && (
            <div className="p-4 text-zinc-500 text-sm">No flights found for these dates.</div>
          )}

          {flights.map((flight, idx) => (
            <div
              key={flight.id}
              onClick={() => {
                onSelectFlight(flight);
                setExpanded(false);
              }}
              className={`p-4 border-b border-zinc-700 last:border-b-0 cursor-pointer transition-colors ${
                selectedFlight?.id === flight.id 
                  ? 'bg-blue-600/20 border-l-2 border-l-blue-500' 
                  : 'hover:bg-zinc-700/50'
              }`}
            >
              <div className="flex justify-between items-start">
                {/* Outbound */}
                <div className="flex-1">
                  <div className="text-xs text-zinc-500 mb-1">OUTBOUND • {flight.outbound?.departure?.date}</div>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold text-white">
                      {formatTime(flight.outbound?.departure?.localTime || '')}
                    </div>
                    <div className="flex-1 flex items-center">
                      <div className="h-px bg-zinc-600 flex-1"></div>
                      <div className="px-2 text-xs text-zinc-400">
                        {formatDuration(flight.outbound?.duration || '')}
                        {flight.outbound?.stops === 0 ? (
                          <span className="ml-1 text-green-400">Direct</span>
                        ) : (
                          <span className="ml-1 text-yellow-400">{flight.outbound?.stops} stop</span>
                        )}
                      </div>
                      <div className="h-px bg-zinc-600 flex-1"></div>
                    </div>
                    <div className="text-lg font-bold text-white">
                      {formatTime(flight.outbound?.arrival?.localTime || '')}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 mt-1">
                    <span>{flight.outbound?.departure?.airport}</span>
                    <span>{flight.outbound?.arrival?.airport}</span>
                  </div>
                </div>

                {/* Price */}
                <div className="ml-6 text-right">
                  <div className="text-xl font-bold text-green-400">${flight.price}</div>
                  <div className="text-xs text-zinc-400">round trip</div>
                </div>
              </div>

              {/* Return Flight */}
              {flight.return && (
                <div className="mt-3 pt-3 border-t border-zinc-700/50">
                  <div className="text-xs text-zinc-500 mb-1">RETURN • {flight.return.departure?.date}</div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-zinc-300">
                      {formatTime(flight.return.departure?.localTime || '')}
                    </div>
                    <div className="flex-1 flex items-center">
                      <div className="h-px bg-zinc-700 flex-1"></div>
                      <div className="px-2 text-xs text-zinc-500">
                        {formatDuration(flight.return.duration || '')}
                        {flight.return.stops === 0 ? ' Direct' : ` ${flight.return.stops} stop`}
                      </div>
                      <div className="h-px bg-zinc-700 flex-1"></div>
                    </div>
                    <div className="text-sm text-zinc-300">
                      {formatTime(flight.return.arrival?.localTime || '')}
                    </div>
                  </div>
                </div>
              )}

              {/* Airline */}
              <div className="mt-2 text-xs text-zinc-400">
                {flight.outbound?.carriers?.map((c: string) => getAirlineName(c)).join(', ')}
              </div>
            </div>
          ))}

          {flights.length > 0 && (
            <div className="p-3 bg-zinc-900 text-xs text-zinc-500 text-center">
              ⚠️ Test data from Amadeus API — prices may not reflect actual fares
            </div>
          )}
        </div>
      )}
    </div>
  );
}
