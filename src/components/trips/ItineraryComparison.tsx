'use client';

import { useState, useMemo } from 'react';

interface Resort {
  id: string;
  name: string;
  country: string;
  nearestAirport: string | null;
  verticalDrop: number | null;
  avgSnowfall: number | null;
}

interface Destination {
  id: string;
  resortId: string;
  resort: Resort;
}

interface FlightDetails {
  price: number;
  outbound: {
    departure: { airport: string; localTime: string; date: string };
    arrival: { airport: string; localTime: string; date: string };
    duration: string;
    stops: number;
    carriers: string[];
  } | null;
  return: {
    departure: { airport: string; localTime: string; date: string };
    arrival: { airport: string; localTime: string; date: string };
    duration: string;
    stops: number;
    carriers: string[];
  } | null;
}

interface DestinationData {
  flight: FlightDetails | null;
  costs: Record<string, { cost: number; vendor: string; time?: string }>;
}

interface Props {
  tripId: string;
  destinations: Destination[];
  daysTravel: number;
  daysRiding: number;
  month: number;
  year: number;
  startDay: number | null;
  participants: { id: string; firstName: string; homeAirport?: string | null }[];
}

const AIRLINE_NAMES: Record<string, string> = {
  'UA': 'United', 'AA': 'American', 'DL': 'Delta', 'AS': 'Alaska',
  'WN': 'Southwest', 'B6': 'JetBlue', 'NK': 'Spirit', 'F9': 'Frontier',
  'NH': 'ANA', 'JL': 'JAL', 'AC': 'Air Canada', 'LH': 'Lufthansa',
  'BA': 'British Airways', 'AF': 'Air France', 'LX': 'Swiss',
};

// Resort operating hours (defaults, could be per-resort)
const RESORT_HOURS = {
  firstChair: '09:00',
  lastChair: '16:00',
};

export default function ItineraryComparison({
  tripId,
  destinations,
  daysTravel,
  daysRiding,
  month,
  year,
  startDay,
  participants
}: Props) {
  const [destData, setDestData] = useState<Record<string, DestinationData>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [editingCell, setEditingCell] = useState<{ resortId: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const travelerCount = participants.length || 4;
  const homeAirport = 'LAX'; // TODO: Get from user profile

  // Calculate trip dates
  const tripDates = useMemo(() => {
    if (!startDay) return null;
    const dates: string[] = [];
    for (let i = 0; i < daysTravel; i++) {
      const d = new Date(year, month - 1, startDay + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [startDay, month, year, daysTravel]);

  const departureDate = tripDates?.[0];
  const returnDate = tripDates?.[tripDates.length - 1];

  // Add time to a base time string
  const addHours = (time: string, hours: number): string => {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + hours * 60;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  const formatTime = (time: string): string => {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const fetchQuotes = async (resortId: string, airport: string | null) => {
    if (!airport || !departureDate || !returnDate) return;

    setLoading(prev => ({ ...prev, [resortId]: true }));

    try {
      // Fetch optimized flights (earliest, shortest, direct preferred)
      const flightRes = await fetch(
        `/api/travel/flights?origin=${homeAirport}&destination=${airport}&departureDate=${departureDate}&returnDate=${returnDate}&optimize=time`
      );
      
      let flightData: FlightDetails | null = null;
      if (flightRes.ok) {
        const data = await flightRes.json();
        if (data.flights?.[0]) {
          flightData = data.flights[0];
        }
      }

      // Calculate derived times based on flight
      const landingTime = flightData?.outbound?.arrival?.localTime || '14:00';
      const hotelCheckIn = addHours(landingTime, 2); // +1hr luggage, +1hr drive estimate
      
      setDestData(prev => ({
        ...prev,
        [resortId]: {
          flight: flightData,
          costs: {
            rideshare_to: { cost: 75, vendor: 'Uber', time: addHours(flightData?.outbound?.departure?.localTime || '06:00', -2) },
            flight_out: { 
              cost: flightData?.price || 0, 
              vendor: flightData?.outbound?.carriers?.map(c => AIRLINE_NAMES[c] || c).join('/') || 'TBD',
              time: flightData?.outbound?.departure?.localTime || 'TBD',
            },
            flight_return: { 
              cost: 0, // Included in round trip
              vendor: flightData?.return?.carriers?.map(c => AIRLINE_NAMES[c] || c).join('/') || 'TBD',
              time: flightData?.return?.departure?.localTime || 'TBD',
            },
            rental_car: { cost: 0, vendor: 'TBD (Van/SUV)', time: landingTime },
            lodging: { cost: 0, vendor: 'TBD (5mi of resort)', time: hotelCheckIn },
            lift_ticket: { cost: 0, vendor: 'Resort', time: RESORT_HOURS.firstChair },
            equipment: { cost: 0, vendor: 'Resort Demo', time: addHours(RESORT_HOURS.firstChair, -0.5) },
            rideshare_from: { cost: 75, vendor: 'Uber', time: flightData?.return?.arrival?.localTime || '22:00' },
            // Per-day costs (will multiply by days)
            breakfast: { cost: 25, vendor: 'TBD', time: addHours(RESORT_HOURS.firstChair, -1) },
            lunch: { cost: 30, vendor: 'On-Mountain', time: '12:00' },
            dinner: { cost: 50, vendor: 'TBD', time: addHours(RESORT_HOURS.lastChair, 1) },
            gas: { cost: 50, vendor: 'Gas Station', time: '' },
          },
        },
      }));

    } catch (error) {
      console.error('Failed to fetch quotes:', error);
    } finally {
      setLoading(prev => ({ ...prev, [resortId]: false }));
    }
  };

  const fetchAllQuotes = async () => {
    if (!departureDate || !returnDate) {
      alert('Please select trip dates first');
      return;
    }
    for (const dest of destinations) {
      await fetchQuotes(dest.resortId, dest.resort.nearestAirport);
    }
  };

  // Build the day-by-day itinerary structure
  const buildItinerary = (resortId: string) => {
    const data = destData[resortId];
    if (!data || !tripDates) return [];

    const items: { day: number; date: string; time: string; category: string; description: string; vendor: string; cost: number; perPerson: number; isShared: boolean }[] = [];

    tripDates.forEach((date, dayIndex) => {
      const dayNum = dayIndex + 1;
      const isFirstDay = dayIndex === 0;
      const isLastDay = dayIndex === tripDates.length - 1;
      const isRidingDay = dayIndex > 0 && dayIndex < tripDates.length - 1;

      if (isFirstDay) {
        // Day 1: Travel to destination
        items.push({
          day: dayNum, date, time: data.costs.rideshare_to?.time || '06:00',
          category: 'Rideshare', description: 'Home → Airport',
          vendor: data.costs.rideshare_to?.vendor || 'Uber',
          cost: data.costs.rideshare_to?.cost || 75,
          perPerson: data.costs.rideshare_to?.cost || 75,
          isShared: false,
        });

        const flight = data.flight?.outbound;
        items.push({
          day: dayNum, date, time: flight?.departure?.localTime || 'TBD',
          category: 'Flight', 
          description: `${homeAirport} → ${flight?.arrival?.airport || '?'} (${flight?.stops === 0 ? 'Direct' : `${flight?.stops} stop`}, ${flight?.duration?.replace('PT', '').replace('H', 'h ').replace('M', 'm') || '?'})`,
          vendor: flight?.carriers?.map(c => AIRLINE_NAMES[c] || c).join('/') || 'TBD',
          cost: data.flight?.price || 0,
          perPerson: data.flight?.price || 0,
          isShared: false,
        });

        // Arrival activities
        items.push({
          day: dayNum, date, time: data.costs.rental_car?.time || '14:00',
          category: 'Rental Car', description: `Pickup (${daysTravel} days)`,
          vendor: data.costs.rental_car?.vendor || 'TBD',
          cost: data.costs.rental_car?.cost || 0,
          perPerson: (data.costs.rental_car?.cost || 0) / travelerCount,
          isShared: true,
        });

        items.push({
          day: dayNum, date, time: data.costs.lodging?.time || '16:00',
          category: 'Lodging', description: `Check-in (${daysTravel - 1} nights)`,
          vendor: data.costs.lodging?.vendor || 'TBD',
          cost: data.costs.lodging?.cost || 0,
          perPerson: (data.costs.lodging?.cost || 0) / travelerCount,
          isShared: true,
        });

        items.push({
          day: dayNum, date, time: data.costs.dinner?.time || '18:00',
          category: 'Dinner', description: 'Day 1',
          vendor: data.costs.dinner?.vendor || 'TBD',
          cost: data.costs.dinner?.cost || 50,
          perPerson: data.costs.dinner?.cost || 50,
          isShared: false,
        });
      }

      if (isRidingDay || (!isFirstDay && !isLastDay)) {
        // Riding days
        items.push({
          day: dayNum, date, time: data.costs.breakfast?.time || '08:00',
          category: 'Breakfast', description: `Day ${dayNum}`,
          vendor: data.costs.breakfast?.vendor || 'TBD',
          cost: data.costs.breakfast?.cost || 25,
          perPerson: data.costs.breakfast?.cost || 25,
          isShared: false,
        });

        if (dayNum === 2) {
          // First riding day - get gear
          items.push({
            day: dayNum, date, time: data.costs.equipment?.time || '08:30',
            category: 'Equipment', description: `Board + Boots (${daysRiding} days)`,
            vendor: data.costs.equipment?.vendor || 'Resort',
            cost: data.costs.equipment?.cost || 0,
            perPerson: data.costs.equipment?.cost || 0,
            isShared: false,
          });

          items.push({
            day: dayNum, date, time: data.costs.lift_ticket?.time || '09:00',
            category: 'Lift Ticket', description: `${daysRiding}-day pass`,
            vendor: data.costs.lift_ticket?.vendor || 'Resort',
            cost: data.costs.lift_ticket?.cost || 0,
            perPerson: data.costs.lift_ticket?.cost || 0,
            isShared: false,
          });
        }

        items.push({
          day: dayNum, date, time: '12:00',
          category: 'Lunch', description: `Day ${dayNum}`,
          vendor: data.costs.lunch?.vendor || 'On-Mountain',
          cost: data.costs.lunch?.cost || 30,
          perPerson: data.costs.lunch?.cost || 30,
          isShared: false,
        });

        items.push({
          day: dayNum, date, time: data.costs.dinner?.time || '17:00',
          category: 'Dinner', description: `Day ${dayNum}`,
          vendor: data.costs.dinner?.vendor || 'TBD',
          cost: data.costs.dinner?.cost || 50,
          perPerson: data.costs.dinner?.cost || 50,
          isShared: false,
        });
      }

      if (isLastDay) {
        // Last day: Return home
        items.push({
          day: dayNum, date, time: data.costs.breakfast?.time || '08:00',
          category: 'Breakfast', description: `Day ${dayNum}`,
          vendor: data.costs.breakfast?.vendor || 'TBD',
          cost: data.costs.breakfast?.cost || 25,
          perPerson: data.costs.breakfast?.cost || 25,
          isShared: false,
        });

        items.push({
          day: dayNum, date, time: addHours(data.flight?.return?.departure?.localTime || '14:00', -3),
          category: 'Gas', description: 'Fill tank before return',
          vendor: 'Gas Station',
          cost: data.costs.gas?.cost || 50,
          perPerson: (data.costs.gas?.cost || 50) / travelerCount,
          isShared: true,
        });

        const returnFlight = data.flight?.return;
        items.push({
          day: dayNum, date, time: returnFlight?.departure?.localTime || 'TBD',
          category: 'Flight', 
          description: `${returnFlight?.departure?.airport || '?'} → ${homeAirport} (${returnFlight?.stops === 0 ? 'Direct' : `${returnFlight?.stops} stop`})`,
          vendor: returnFlight?.carriers?.map(c => AIRLINE_NAMES[c] || c).join('/') || 'TBD',
          cost: 0, // Included in round trip
          perPerson: 0,
          isShared: false,
        });

        items.push({
          day: dayNum, date, time: data.costs.rideshare_from?.time || '22:00',
          category: 'Rideshare', description: 'Airport → Home',
          vendor: data.costs.rideshare_from?.vendor || 'Uber',
          cost: data.costs.rideshare_from?.cost || 75,
          perPerson: data.costs.rideshare_from?.cost || 75,
          isShared: false,
        });
      }
    });

    return items.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.time.localeCompare(b.time);
    });
  };

  const calculateTotal = (resortId: string): number => {
    const itinerary = buildItinerary(resortId);
    return itinerary.reduce((sum, item) => sum + item.perPerson, 0);
  };

  if (destinations.length === 0) {
    return <div className="text-center py-8 text-zinc-500">Select destinations above to compare costs</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm">
          <span className="text-zinc-300">{travelerCount} travelers • {daysTravel} days • {daysRiding} riding</span>
          {departureDate && returnDate ? (
            <span className="ml-2 text-green-400 font-medium">📅 {departureDate} → {returnDate}</span>
          ) : (
            <span className="ml-2 text-yellow-400">⚠️ Select dates above</span>
          )}
        </div>
        <button
          onClick={fetchAllQuotes}
          disabled={Object.values(loading).some(l => l) || !departureDate}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50 text-sm"
        >
          {Object.values(loading).some(l => l) ? '⏳ Fetching...' : '🔄 Fetch Live Quotes'}
        </button>
      </div>

      {/* Flight Summary Cards */}
      {destinations.some(d => destData[d.resortId]?.flight) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {destinations.map(dest => {
            const flight = destData[dest.resortId]?.flight;
            if (!flight) return null;
            return (
              <div key={dest.id} className="bg-zinc-800 rounded p-3 border border-zinc-700">
                <div className="font-medium text-sm mb-2">{dest.resort.name}</div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Outbound:</span>
                    <span className="text-white">
                      {formatTime(flight.outbound?.departure?.localTime || '')} → {formatTime(flight.outbound?.arrival?.localTime || '')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Duration:</span>
                    <span>{flight.outbound?.duration?.replace('PT', '').replace('H', 'h ').replace('M', 'm')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Stops:</span>
                    <span>{flight.outbound?.stops === 0 ? 'Direct ✓' : `${flight.outbound?.stops} stop`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Airline:</span>
                    <span>{flight.outbound?.carriers?.map(c => AIRLINE_NAMES[c] || c).join(', ')}</span>
                  </div>
                  <div className="flex justify-between font-medium text-green-400">
                    <span>Round Trip:</span>
                    <span>${flight.price}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-700 bg-zinc-800">
              <th className="text-left py-2 px-2 text-zinc-400 sticky left-0 bg-zinc-800">Day</th>
              <th className="text-left py-2 px-2 text-zinc-400">Time</th>
              <th className="text-left py-2 px-2 text-zinc-400">Category</th>
              {destinations.map(dest => (
                <th key={dest.id} className="text-center py-2 px-2 min-w-[140px]" colSpan={2}>
                  <div className="text-zinc-200 font-medium truncate">{dest.resort.name.split(' ').slice(0, 2).join(' ')}</div>
                  <div className="text-zinc-500 font-normal">✈️ {dest.resort.nearestAirport}</div>
                </th>
              ))}
            </tr>
            <tr className="border-b border-zinc-600 bg-zinc-800/50">
              <th colSpan={3}></th>
              {destinations.map(dest => (
                <>
                  <th key={`${dest.id}-v`} className="text-left py-1 px-1 text-zinc-500 text-[10px]">Vendor</th>
                  <th key={`${dest.id}-c`} className="text-right py-1 px-1 text-zinc-500 text-[10px]">$/Person</th>
                </>
              ))}
            </tr>
          </thead>
          <tbody>
            {tripDates && destinations[0] && buildItinerary(destinations[0].resortId).map((row, idx) => (
              <tr key={idx} className="border-b border-zinc-800 hover:bg-zinc-800/30">
                <td className="py-1.5 px-2 sticky left-0 bg-zinc-900 text-zinc-400 font-medium">
                  {idx === 0 || buildItinerary(destinations[0].resortId)[idx - 1]?.day !== row.day 
                    ? `Day ${row.day}` 
                    : ''}
                </td>
                <td className="py-1.5 px-2 text-zinc-500">{formatTime(row.time)}</td>
                <td className="py-1.5 px-2 text-zinc-300">{row.category}</td>
                {destinations.map(dest => {
                  const destItinerary = buildItinerary(dest.resortId);
                  const destRow = destItinerary[idx];
                  return (
                    <>
                      <td key={`${dest.id}-${idx}-v`} className="py-1.5 px-1 text-zinc-400 text-[11px]">
                        {destRow?.vendor || '—'}
                      </td>
                      <td key={`${dest.id}-${idx}-c`} className="py-1.5 px-1 text-right">
                        {destRow?.perPerson ? (
                          <span className={destRow.perPerson > 0 ? 'text-green-400' : 'text-zinc-500'}>
                            ${destRow.perPerson.toFixed(0)}
                            {destRow.isShared && <span className="text-blue-400 ml-0.5">*</span>}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                    </>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-600 bg-zinc-800 font-bold">
              <td colSpan={3} className="py-3 px-2 sticky left-0 bg-zinc-800">Per Person Total</td>
              {destinations.map(dest => (
                <>
                  <td key={`${dest.id}-total-l`}></td>
                  <td key={`${dest.id}-total`} className="py-3 px-2 text-right text-lg text-green-400">
                    ${calculateTotal(dest.resortId).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 text-[10px] text-zinc-500">
        <span className="text-blue-400">*</span> = Shared cost (split by {travelerCount})
        <span className="mx-2">•</span>
        Origin: {homeAirport}
        <span className="mx-2">•</span>
        Resort hours: {formatTime(RESORT_HOURS.firstChair)} - {formatTime(RESORT_HOURS.lastChair)}
      </div>
    </div>
  );
}
