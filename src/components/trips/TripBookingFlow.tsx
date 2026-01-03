'use client';

import { useState, useMemo, useEffect } from 'react';
import FlightPicker from './FlightPicker';
import LodgingOptions from './LodgingOptions';
import VehicleOptions from './VehicleOptions';
import TransferOptions from './TransferOptions';

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
  conditions?: {
    refundable: boolean;
    changeable: boolean;
  };
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
  onBudgetChange?: (items: {category: string; amount: number; description: string}[]) => void;
  initialCosts?: Record<string, Record<string, number>>;
}

export default function TripBookingFlow({
  tripId,
  destinations,
  daysTravel,
  daysRiding,
  month,
  year,
  startDay,
  travelerCount,
  onBudgetChange,
  initialCosts,
}: Props) {
  // Selected items per destination
  const [selectedFlights, setSelectedFlights] = useState<Record<string, FlightSelection>>({});
  const [selectedHotels, setSelectedHotels] = useState<Record<string, any>>({});
  const [selectedCars, setSelectedCars] = useState<Record<string, any>>({});
  const [selectedArrivals, setSelectedArrivals] = useState<Record<string, any>>({});
  const [selectedDepartures, setSelectedDepartures] = useState<Record<string, any>>({});
  
  // Manual cost entries - initialize from props if available
  const [manualCosts, setManualCosts] = useState<Record<string, Record<string, number>>>(initialCosts || {});

  // Update manualCosts when initialCosts loads
  useEffect(() => {
    if (initialCosts && Object.keys(initialCosts).length > 0) {
      setManualCosts(prev => {
        // Merge initialCosts with any existing values (don't overwrite user edits)
        const merged = { ...prev };
        for (const [resortId, costs] of Object.entries(initialCosts)) {
          if (!merged[resortId]) {
            merged[resortId] = { ...costs };
          }
        }
        return merged;
      });
    }
  }, [initialCosts]);

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

  // Calculate totals per destination - NO DEFAULTS
  const calculateTotal = (resortId: string): { 
    flight: number; 
    hotel: number; 
    car: number; 
    activities: number;
    equipment: number;
    meals: number;
    groundTransport: number;
    tips: number;
    total: number;
    perPerson: number;
  } => {
    const flight = selectedFlights[resortId]?.price || manualCosts[resortId]?.flight || 0;
    const hotel = selectedHotels[resortId]?.totalPrice || manualCosts[resortId]?.hotel || 0;
    const car = selectedCars[resortId]?.price || manualCosts[resortId]?.car || 0;
    const arrivalTransfer = selectedArrivals[resortId]?.price || 0;
    const departureTransfer = selectedDepartures[resortId]?.price || 0;
    
    // User-entered values only - NO DEFAULTS
    const activities = manualCosts[resortId]?.activities || 0;
    const equipment = manualCosts[resortId]?.equipment || 0;
    const meals = manualCosts[resortId]?.meals || 0;
    const groundTransport = manualCosts[resortId]?.groundTransport || arrivalTransfer + departureTransfer;
    const tips = manualCosts[resortId]?.tips || 0;

    // Per-person calculation
    const sharedCosts = (hotel + car) / Math.max(travelerCount, 1);
    const individualCosts = flight + activities + equipment + meals + (groundTransport / Math.max(travelerCount, 1)) + tips;
    const perPerson = sharedCosts + individualCosts;

    return {
      flight,
      hotel,
      car,
      activities,
      equipment,
      meals,
      groundTransport,
      tips,
      total: hotel + car + groundTransport + (flight + activities + equipment + meals + tips) * travelerCount,
      perPerson,
    };
  };


  // Notify parent of budget changes
  useEffect(() => {
    console.log("TripBookingFlow useEffect:", { destinationsCount: destinations.length, hasCallback: !!onBudgetChange });
    if (!onBudgetChange || destinations.length === 0) return;
    const items: {category: string; amount: number; description: string}[] = [];
    destinations.forEach(dest => {
      const t = calculateTotal(dest.resortId);
      if (t.flight > 0) items.push({ category: "flight", amount: t.flight, description: `Flight to ${dest.resort.name}` });
      if (t.hotel > 0) items.push({ category: "hotel", amount: t.hotel / Math.max(travelerCount, 1), description: `Lodging at ${dest.resort.name}` });
      if (t.car > 0) items.push({ category: "car", amount: t.car / Math.max(travelerCount, 1), description: `Rental car` });
      if (t.activities > 0) items.push({ category: "activities", amount: t.activities, description: `Activities` });
      if (t.equipment > 0) items.push({ category: "equipment", amount: t.equipment, description: `Equipment rental` });
      if (t.meals > 0) items.push({ category: "meals", amount: t.meals, description: `Food & dining` });
      if (t.groundTransport > 0) items.push({ category: "groundTransport", amount: t.groundTransport / Math.max(travelerCount, 1), description: `Ground transport` });
      if (t.tips > 0) items.push({ category: "tips", amount: t.tips, description: `Tips & misc` });
    });
    onBudgetChange(items);
  }, [selectedFlights, selectedHotels, selectedCars, selectedArrivals, selectedDepartures, manualCosts, destinations, travelerCount]);

  if (!tripDates) {
    return (
      <div className="text-center py-8 text-yellow-600 bg-yellow-50 rounded-lg">
        ⚠️ Please select trip dates in the Availability section above
      </div>
    );
  }

  if (destinations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
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
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">1</span>
          ✈️ Flights
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Search live prices or enter manually if booking elsewhere
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
              passengers={travelerCount}
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
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">2</span>
          🏨 Lodging
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {daysTravel - 1} nights • {travelerCount} guests • Cost split evenly
        </p>
        <LodgingOptions 
          tripId={tripId} 
          participantCount={travelerCount} 
          nights={daysTravel - 1 || 1}
          onSelect={(option) => {
            if (option.total_price) {
              setManualCosts(prev => ({
                ...prev,
                [destinations[0]?.resortId || 'default']: {
                  ...prev[destinations[0]?.resortId || 'default'],
                  hotel: Number(option.total_price)
                }
              }));
            }
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 3: RENTAL CAR */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">3</span>
          🚗 Transportation
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {daysTravel} days • {travelerCount} travelers • Cost split evenly
        </p>
        <VehicleOptions 
          tripId={tripId} 
          participantCount={travelerCount} 
          days={daysTravel}
          onSelect={(option) => {
            if (option.total_price) {
              setManualCosts(prev => ({
                ...prev,
                [destinations[0]?.resortId || 'default']: {
                  ...prev[destinations[0]?.resortId || 'default'],
                  car: Number(option.total_price)
                }
              }));
            }
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 4: AIRPORT TRANSFERS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">4</span>
          🚕 Airport Transfers
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Rideshare/shuttle to and from the airport
        </p>
        <TransferOptions 
          tripId={tripId} 
          participantCount={travelerCount}
          onSelect={(option) => {
            if (option.price) {
              const key = option.direction === 'arrival' ? 'arrivalTransfer' : 'departureTransfer';
              setManualCosts(prev => ({
                ...prev,
                [destinations[0]?.resortId || 'default']: {
                  ...prev[destinations[0]?.resortId || 'default'],
                  [key]: Number(option.price)
                }
              }));
            }
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 5: OTHER EXPENSES - UNIVERSAL CATEGORIES */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm">5</span>
          📋 Other Trip Expenses
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Enter your estimated costs per person (leave blank if not applicable)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-500">Expense</th>
                <th className="text-left py-2 px-3 text-gray-500">Description</th>
                {destinations.map(dest => (
                  <th key={dest.id} className="text-center py-2 px-3 text-gray-600 min-w-[120px]">
                    {dest.resort.name.split(' ').slice(0, 2).join(' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">🎟️ Activities</td>
                <td className="py-3 px-3 text-gray-400 text-xs">Tickets, passes, admissions (per person)</td>
                {destinations.map(dest => (
                  <td key={dest.id} className="py-3 px-3">
                    <div className="flex items-center">
                      <span className="text-gray-400 text-sm mr-1">$</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={manualCosts[dest.resortId]?.activities || ''}
                        onChange={(e) => handleManualCost(dest.resortId, 'activities', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-900 text-center"
                      />
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">🎿 Equipment Rental</td>
                <td className="py-3 px-3 text-gray-400 text-xs">Gear rental for {daysRiding} days (per person)</td>
                {destinations.map(dest => (
                  <td key={dest.id} className="py-3 px-3">
                    <div className="flex items-center">
                      <span className="text-gray-400 text-sm mr-1">$</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={manualCosts[dest.resortId]?.equipment || ''}
                        onChange={(e) => handleManualCost(dest.resortId, 'equipment', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-900 text-center"
                      />
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">🍽️ Food & Dining</td>
                <td className="py-3 px-3 text-gray-400 text-xs">Est. for {daysTravel} days (per person)</td>
                {destinations.map(dest => (
                  <td key={dest.id} className="py-3 px-3">
                    <div className="flex items-center">
                      <span className="text-gray-400 text-sm mr-1">$</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={manualCosts[dest.resortId]?.meals || ''}
                        onChange={(e) => handleManualCost(dest.resortId, 'meals', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-900 text-center"
                      />
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">⛽ Gas & Parking</td>
                <td className="py-3 px-3 text-gray-400 text-xs">Fuel, tolls, parking (split)</td>
                {destinations.map(dest => (
                  <td key={dest.id} className="py-3 px-3">
                    <div className="flex items-center">
                      <span className="text-gray-400 text-sm mr-1">$</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={manualCosts[dest.resortId]?.groundTransport || ''}
                        onChange={(e) => handleManualCost(dest.resortId, 'groundTransport', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-900 text-center"
                      />
                    </div>
                  </td>
                ))}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-3 font-medium">💵 Tips & Misc</td>
                <td className="py-3 px-3 text-gray-400 text-xs">Gratuities, souvenirs (per person)</td>
                {destinations.map(dest => (
                  <td key={dest.id} className="py-3 px-3">
                    <div className="flex items-center">
                      <span className="text-gray-400 text-sm mr-1">$</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={manualCosts[dest.resortId]?.tips || ''}
                        onChange={(e) => handleManualCost(dest.resortId, 'tips', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-gray-900 text-center"
                      />
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* BUDGET COMPARISON */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">📊 Budget Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 px-3 text-gray-500">Category</th>
                {destinations.map(dest => (
                  <th key={dest.id} className="text-right py-2 px-3 text-gray-600 min-w-[120px]">
                    {dest.resort.name.split(' ').slice(0, 2).join(' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-3">✈️ Flight</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.flight > 0 ? <span className="text-green-600 font-medium">${t.flight}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-3">🏨 Lodging <span className="text-xs text-blue-500">(÷{travelerCount})</span></td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.hotel > 0 ? <span className="text-green-600 font-medium">${(t.hotel / travelerCount).toFixed(0)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-3">🚗 Transportation <span className="text-xs text-blue-500">(÷{travelerCount})</span></td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.car > 0 ? <span className="text-green-600 font-medium">${(t.car / travelerCount).toFixed(0)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-3">🎟️ Activities</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.activities > 0 ? <span className="text-green-600 font-medium">${t.activities}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-3">🎿 Equipment</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.equipment > 0 ? <span className="text-green-600 font-medium">${t.equipment}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-3">🍽️ Food & Dining</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.meals > 0 ? <span className="text-green-600 font-medium">${t.meals}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-3">🚕 Ground Transport <span className="text-xs text-blue-500">(÷{travelerCount})</span></td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.groundTransport > 0 ? <span className="text-green-600 font-medium">${(t.groundTransport / travelerCount).toFixed(0)}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2 px-3">💵 Tips & Misc</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.tips > 0 ? <span className="text-green-600 font-medium">${t.tips}</span> : <span className="text-gray-300">—</span>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-bold">
                <td className="py-3 px-3 text-lg">Per Person Total</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-3 px-3 text-right text-xl text-green-600">
                      {t.perPerson > 0 ? `$${t.perPerson.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '$0'}
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
