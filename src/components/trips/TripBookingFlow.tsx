'use client';

import { useState, useMemo } from 'react';
import FlightPicker from './FlightPicker';
import HotelPicker from './HotelPicker';
import CarPicker from './CarPicker';
import TransferPicker from './TransferPicker';

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

interface FlightSelection {
  id: string;
  price: number;
  currency: string;
  outbound: {
    departure: { airport: string; localTime: string; date: string };
    arrival: { airport: string; localTime: string; date: string };
    duration: string;
    durationMinutes?: number;
    durationFormatted?: string;
    stops: number;
    carriers: string[];
    segments?: any[];
  } | null;
  return: {
    departure: { airport: string; localTime: string; date: string };
    arrival: { airport: string; localTime: string; date: string };
    duration: string;
    durationFormatted?: string;
    stops: number;
    carriers: string[];
  } | null;
}
interface Props {
  tripId: string;
  destinations: Destination[];
  daysTravel: number;
  daysRiding: number;
  month: number;
  year: number;
  startDay: number | null;
  travelerCount: number;
}

const AIRLINE_NAMES: Record<string, string> = {
  'UA': 'United', 'AA': 'American', 'DL': 'Delta', 'AS': 'Alaska',
  'WN': 'Southwest', 'B6': 'JetBlue', 'NK': 'Spirit', 'F9': 'Frontier',
  'NH': 'ANA', 'JL': 'JAL', 'AC': 'Air Canada', 'LH': 'Lufthansa',
};

export default function TripBookingFlow({
  tripId,
  destinations,
  daysTravel,
  daysRiding,
  month,
  year,
  startDay,
  travelerCount,
}: Props) {
  // Selected items per destination
  const [selectedFlights, setSelectedFlights] = useState<Record<string, FlightSelection>>({});
  const [selectedHotels, setSelectedHotels] = useState<Record<string, any>>({});
  const [selectedCars, setSelectedCars] = useState<Record<string, any>>({});
  const [selectedArrivals, setSelectedArrivals] = useState<Record<string, any>>({});
  const [selectedDepartures, setSelectedDepartures] = useState<Record<string, any>>({});
  
  // Manual cost entries
  const [manualCosts, setManualCosts] = useState<Record<string, Record<string, number>>>({});

  const homeAirport = 'LAX'; // TODO: Get from user profile

  // Calculate trip dates
  const tripDates = useMemo(() => {
    if (!startDay) return null;
    const start = new Date(year, month - 1, startDay);
    const end = new Date(year, month - 1, startDay + daysTravel - 1);
    return {
      departure: start.toISOString().split('T')[0],
      return: end.toISOString().split('T')[0],
    };
  }, [startDay, month, year, daysTravel]);

  const handleSelectFlight = (resortId: string, flight: FlightSelection) => {
    setSelectedFlights(prev => ({ ...prev, [resortId]: flight }));
  };


  const handleSelectHotel = (resortId: string, hotel: any) => {
    setSelectedHotels(prev => ({ ...prev, [resortId]: hotel }));
  };

  const handleSelectCar = (resortId: string, car: any) => {
    setSelectedCars(prev => ({ ...prev, [resortId]: car }));
  };

  const handleSelectArrival = (resortId: string, transfer: any) => {
    setSelectedArrivals(prev => ({ ...prev, [resortId]: transfer }));
  };

  const handleSelectDeparture = (resortId: string, transfer: any) => {
    setSelectedDepartures(prev => ({ ...prev, [resortId]: transfer }));
  };
  const handleManualCost = (resortId: string, key: string, value: number) => {
    setManualCosts(prev => ({
      ...prev,
      [resortId]: { ...prev[resortId], [key]: value },
    }));
  };

  // Calculate totals per destination
  const calculateTotal = (resortId: string): { 
    flight: number; 
    hotel: number; 
    car: number; 
    liftTicket: number;
    equipment: number;
    meals: number;
    rideshare: number;
    gas: number;
    total: number;
    perPerson: number;
  } => {
    const flight = selectedFlights[resortId]?.price || 0;
    const hotel = selectedHotels[resortId]?.totalPrice || manualCosts[resortId]?.hotel || 0;
    const car = selectedCars[resortId]?.price || manualCosts[resortId]?.car || 0;
    const liftTicket = manualCosts[resortId]?.liftTicket || 0;
    const equipment = manualCosts[resortId]?.equipment || 0;
    const meals = manualCosts[resortId]?.meals || (daysTravel * 75); // Default $75/day
    const rideshare = manualCosts[resortId]?.rideshare || 150; // $75 each way
    const gas = manualCosts[resortId]?.gas || 50;

    // Per-person calculation
    const sharedCosts = (hotel + car + gas) / travelerCount;
    const individualCosts = flight + liftTicket + equipment + meals + rideshare;
    const perPerson = sharedCosts + individualCosts;

    return {
      flight,
      hotel,
      car,
      liftTicket,
      equipment,
      meals,
      rideshare,
      gas,
      total: hotel + car + gas + (flight + liftTicket + equipment + meals + rideshare) * travelerCount,
      perPerson,
    };
  };

  if (!tripDates) {
    return (
      <div className="text-center py-8 text-yellow-400">
        ⚠️ Please select trip dates in the Availability section above
      </div>
    );
  }

  if (destinations.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        Select destinations in the section above to start planning
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 1: FLIGHTS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-sm">1</span>
          ✈️ Select Flights
        </h3>
        <p className="text-sm text-zinc-400 mb-4">
          Showing top 5 shortest flights (non-stop preferred) from {homeAirport}
        </p>
        <div className="space-y-3">
          {destinations.map(dest => (
            <FlightPicker
              key={dest.id}
              destinationName={dest.resort.name}
              destinationAirport={dest.resort.nearestAirport || ''}
              originAirport={homeAirport}
              departureDate={tripDates.departure}
              returnDate={tripDates.return}
              selectedFlight={selectedFlights[dest.resortId] || null}
              onSelectFlight={(flight) => handleSelectFlight(dest.resortId, flight)}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 2: HOTELS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-sm">2</span>
          🏨 Select Lodging
        </h3>
        <p className="text-sm text-zinc-400 mb-4">
          Hotels within 20 miles of resort • {daysTravel - 1} nights • {travelerCount} guests (cost split)
        </p>
        <div className="space-y-3">
          {destinations.map(dest => (
            <HotelPicker
              key={dest.id}
              destinationName={dest.resort.name}
              resortId={dest.resortId}
              checkInDate={tripDates.departure}
              checkOutDate={tripDates.return}
              adults={travelerCount}
              rooms={Math.ceil(travelerCount / 2)}
              bedsNeeded={travelerCount}
              selectedHotel={selectedHotels[dest.resortId] || null}
              onSelectHotel={(hotel) => handleSelectHotel(dest.resortId, hotel)}
            />
          ))}
        </div>
      </div>
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 3: RENTAL CAR */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-sm">3</span>
          🚐 Select Rental Car
        </h3>
        <p className="text-sm text-zinc-400 mb-4">
          Van/SUV for {travelerCount} travelers + snowboards, {daysTravel} days (cost split)
        </p>
        <div className="space-y-3">
          {destinations.map(dest => (
            <CarPicker
              key={dest.id}
              destinationName={dest.resort.name}
              destinationAirport={dest.resort.nearestAirport || ""}
              pickupDate={tripDates.departure}
              dropoffDate={tripDates.return}
              travelers={travelerCount}
              days={daysTravel}
              selectedCar={selectedCars[dest.resortId] || null}
              onSelectCar={(car) => handleSelectCar(dest.resortId, car)}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 4: AIRPORT TRANSFERS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-sm">4</span>
          🚕 Rideshare (Airport ↔ Resort)
        </h3>
        <p className="text-sm text-zinc-400 mb-4">
          Estimate round-trip rideshare costs (Uber/Lyft) from airport to resort
        </p>
        <div className="space-y-3">
          {destinations.map(dest => (
            <TransferPicker
              key={dest.id}
              destinationName={dest.resort.name}
              resortId={dest.resortId}
              airportCode={dest.resort.nearestAirport || ""}
              arrivalDateTime={`${tripDates.departure}T12:00:00`}
              departureDateTime={`${tripDates.return}T10:00:00`}
              passengers={travelerCount}
              selectedArrival={selectedArrivals[dest.resortId] || null}
              selectedDeparture={selectedDepartures[dest.resortId] || null}
              onSelectArrival={(transfer) => handleSelectArrival(dest.resortId, transfer)}
              onSelectDeparture={(transfer) => handleSelectDeparture(dest.resortId, transfer)}
            />
          ))}
        </div>
      </div>
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 5: OTHER COSTS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-sm">5</span>
          🎿 Lift Tickets, Rentals & More
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left py-2 px-3 text-zinc-400">Expense</th>
                <th className="text-left py-2 px-3 text-zinc-400">Type</th>
                {destinations.map(dest => (
                  <th key={dest.id} className="text-center py-2 px-3 text-zinc-300 min-w-[120px]">
                    {dest.resort.name.split(' ').slice(0, 2).join(' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-800">
                <td className="py-2 px-3">Lift Tickets</td>
                <td className="py-2 px-3 text-zinc-500 text-xs">{daysRiding}-day pass (per person)</td>
                {destinations.map(dest => (
                  <td key={dest.id} className="py-2 px-3">
                    <input
                      type="number"
                      placeholder="$0"
                      value={manualCosts[dest.resortId]?.liftTicket || ''}
                      onChange={(e) => handleManualCost(dest.resortId, 'liftTicket', parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-center"
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2 px-3">Equipment Rental</td>
                <td className="py-2 px-3 text-zinc-500 text-xs">Board + boots {daysRiding} days (per person)</td>
                {destinations.map(dest => (
                  <td key={dest.id} className="py-2 px-3">
                    <input
                      type="number"
                      placeholder="$0"
                      value={manualCosts[dest.resortId]?.equipment || ''}
                      onChange={(e) => handleManualCost(dest.resortId, 'equipment', parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-center"
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2 px-3">Meals</td>
                <td className="py-2 px-3 text-zinc-500 text-xs">Est. ${75}/day × {daysTravel} days (per person)</td>
                {destinations.map(dest => (
                  <td key={dest.id} className="py-2 px-3">
                    <input
                      type="number"
                      placeholder={`$${daysTravel * 75}`}
                      value={manualCosts[dest.resortId]?.meals || ''}
                      onChange={(e) => handleManualCost(dest.resortId, 'meals', parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-center"
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2 px-3">Rideshare</td>
                <td className="py-2 px-3 text-zinc-500 text-xs">To/from airport (per person)</td>
                {destinations.map(dest => (
                  <td key={dest.id} className="py-2 px-3">
                    <input
                      type="number"
                      placeholder="$150"
                      value={manualCosts[dest.resortId]?.rideshare || ''}
                      onChange={(e) => handleManualCost(dest.resortId, 'rideshare', parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-center"
                    />
                  </td>
                ))}
              </tr>
              <tr className="border-b border-zinc-800">
                <td className="py-2 px-3">Gas</td>
                <td className="py-2 px-3 text-zinc-500 text-xs">Rental car fuel (split)</td>
                {destinations.map(dest => (
                  <td key={dest.id} className="py-2 px-3">
                    <input
                      type="number"
                      placeholder="$50"
                      value={manualCosts[dest.resortId]?.gas || ''}
                      onChange={(e) => handleManualCost(dest.resortId, 'gas', parseFloat(e.target.value) || 0)}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-white text-center"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CONSOLIDATED BUDGET */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-zinc-800 rounded-lg p-6 border border-zinc-700">
        <h3 className="text-lg font-semibold mb-4">📊 Budget Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-600">
                <th className="text-left py-2 px-3 text-zinc-400">Category</th>
                {destinations.map(dest => (
                  <th key={dest.id} className="text-right py-2 px-3 text-zinc-300 min-w-[120px]">
                    {dest.resort.name.split(' ').slice(0, 2).join(' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-3">✈️ Flight</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.flight > 0 ? <span className="text-green-400">${t.flight}</span> : <span className="text-zinc-500">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-3">🏨 Lodging <span className="text-xs text-blue-400">(÷{travelerCount})</span></td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.hotel > 0 ? <span className="text-green-400">${(t.hotel / travelerCount).toFixed(0)}</span> : <span className="text-zinc-500">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-3">🚐 Rental Car <span className="text-xs text-blue-400">(÷{travelerCount})</span></td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.car > 0 ? <span className="text-green-400">${(t.car / travelerCount).toFixed(0)}</span> : <span className="text-zinc-500">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-3">🎿 Lift Tickets</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.liftTicket > 0 ? <span className="text-green-400">${t.liftTicket}</span> : <span className="text-zinc-500">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-3">🏂 Equipment</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.equipment > 0 ? <span className="text-green-400">${t.equipment}</span> : <span className="text-zinc-500">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-3">🍽️ Meals</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right text-green-400">${t.meals}</td>
                  );
                })}
              </tr>
              <tr className="border-b border-zinc-700">
                <td className="py-2 px-3">🚗 Rideshare + Gas</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right text-green-400">
                      ${t.rideshare + (t.gas / travelerCount)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-500 font-bold">
                <td className="py-3 px-3 text-lg">Per Person Total</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-3 px-3 text-right text-xl text-green-400">
                      ${t.perPerson.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
}
