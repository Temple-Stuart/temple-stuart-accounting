'use client';

import { useState, useMemo, useEffect } from 'react';
import FlightPicker from './FlightPicker';
import LodgingOptions from './LodgingOptions';
import VehicleOptions from './VehicleOptions';
import TransferOptions from './TransferOptions';
import ActivityExpenses from './ActivityExpenses';

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
          merged[resortId] = {
              ...merged[resortId],
          ...costs
          }
        }
        return merged;
      });
    }
  }, [initialCosts]);

  const [originAirport, setOriginAirport] = useState('LAX');

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
    bizdev: number;
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
    const bizdev = manualCosts[resortId]?.bizdev || 0;

    // Per-person calculation
    const sharedCosts = (hotel + car) / Math.max(travelerCount, 1);
    const individualCosts = flight + activities + equipment + meals + (groundTransport / Math.max(travelerCount, 1)) + tips + bizdev;
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
      bizdev,
      total: hotel + car + groundTransport + (flight + activities + equipment + meals + tips + bizdev) * travelerCount,
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
      if (t.bizdev > 0) items.push({ category: "bizdev", amount: t.bizdev, description: `Business dev` });
    });
    onBudgetChange(items);
  }, [selectedFlights, selectedHotels, selectedCars, selectedArrivals, selectedDepartures, manualCosts, destinations, travelerCount]);

  if (!tripDates) {
    return (
      <div className="text-center py-8 text-yellow-600 bg-yellow-50 rounded">
        ⚠️ Please select trip dates in the Availability section above
      </div>
    );
  }

  if (destinations.length === 0) {
    return (
      <div className="text-center py-8 text-text-faint">
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
        <h3 className="text-terminal-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-brand-purple text-white rounded-full flex items-center justify-center text-sm">1</span>
          ✈️ Flights
        </h3>
        <p className="text-sm text-text-muted mb-4">
          Search live prices or enter manually if booking elsewhere
        </p>
        <div className="flex items-center gap-2 mb-4">
          <label className="text-sm text-text-secondary">Flying from:</label>
          <input
            type="text"
            value={originAirport}
            onChange={(e) => setOriginAirport(e.target.value.toUpperCase())}
            placeholder="LAX"
            maxLength={3}
            className="w-20 px-2 py-1 border rounded text-center uppercase font-mono"
          />
        </div>
        <div className="space-y-3">
          {destinations.map(dest => (
            <FlightPicker
              key={dest.id}
              destinationName={dest.resort.name}
              destinationAirport={dest.resort.nearestAirport || ''}
              originAirport={originAirport}
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
        <h3 className="text-terminal-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-brand-purple text-white rounded-full flex items-center justify-center text-sm">2</span>
          🏨 Lodging
        </h3>
        <p className="text-sm text-text-muted mb-4">
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
        <h3 className="text-terminal-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-brand-purple text-white rounded-full flex items-center justify-center text-sm">3</span>
          🚗 Transportation
        </h3>
        <p className="text-sm text-text-muted mb-4">
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
        <h3 className="text-terminal-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-brand-purple text-white rounded-full flex items-center justify-center text-sm">4</span>
          🚕 Airport Transfers
        </h3>
        <p className="text-sm text-text-muted mb-4">
          Rideshare/shuttle to and from the airport
        </p>
        <TransferOptions 
          tripId={tripId} 
          participantCount={travelerCount}
          onSelect={(option) => {
            if (option.price) {
              if (option.direction === 'arrival') {
                setSelectedArrivals(prev => ({
                  ...prev,
                  [destinations[0]?.resortId || 'default']: option
                }));
              } else {
                setSelectedDepartures(prev => ({
                  ...prev,
                  [destinations[0]?.resortId || 'default']: option
                }));
              }
            }
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* STEP 5: OTHER EXPENSES - UNIVERSAL CATEGORIES */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-terminal-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-brand-purple text-white rounded-full flex items-center justify-center text-sm">5</span>
          📋 Trip Expenses
        </h3>
        <p className="text-sm text-text-muted mb-4">
          Add activities, coworking, lessons, and other expenses for your trip
        </p>
        <ActivityExpenses
          tripId={tripId}
          activity={null}
          participantCount={travelerCount}
          onCategoryTotals={(totals) => {
            setManualCosts(prev => ({
              ...prev,
              [destinations[0]?.resortId || 'default']: {
                ...prev[destinations[0]?.resortId || 'default'],
                activities: (totals.activities || 0) + (totals.lift_pass || 0) + (totals.lessons || 0) + (totals.apres || 0) + (totals.yoga || 0) + (totals.massage || 0) + (totals.conference || 0) + (totals.networking || 0) + (totals.nightlife || 0) + (totals.fitness || 0) + (totals.wellness || 0),
                equipment: (totals.equipment || 0) + (totals.board_rental || 0) + (totals.kite_rental || 0),
                meals: (totals.food || 0) + (totals.coffee || 0) + (totals.meals || 0),
                tips: totals.tips || 0,
                bizdev: totals.coworking || 0,
              }
            }));
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* BUDGET COMPARISON */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-bg-row rounded p-6 border border-border">
        <h3 className="text-terminal-lg font-semibold mb-4">📊 Budget Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-text-muted">Category</th>
                {destinations.map(dest => (
                  <th key={dest.id} className="text-right py-2 px-3 text-text-secondary min-w-[120px]">
                    {dest.resort.name.split(' ').slice(0, 2).join(' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border-light">
                <td className="py-2 px-3">✈️ Flight</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.flight > 0 ? <span className="text-brand-green font-medium">${t.flight}</span> : <span className="text-text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2 px-3">🏨 Lodging <span className="text-xs text-brand-purple">(÷{travelerCount})</span></td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.hotel > 0 ? <span className="text-brand-green font-medium">${(t.hotel / travelerCount).toFixed(0)}</span> : <span className="text-text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2 px-3">🚗 Transportation <span className="text-xs text-brand-purple">(÷{travelerCount})</span></td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.car > 0 ? <span className="text-brand-green font-medium">${(t.car / travelerCount).toFixed(0)}</span> : <span className="text-text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2 px-3">🎟️ Activities</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.activities > 0 ? <span className="text-brand-green font-medium">${t.activities}</span> : <span className="text-text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2 px-3">🎿 Equipment</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.equipment > 0 ? <span className="text-brand-green font-medium">${t.equipment}</span> : <span className="text-text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2 px-3">🍽️ Food & Dining</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.meals > 0 ? <span className="text-brand-green font-medium">${t.meals}</span> : <span className="text-text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2 px-3">🚕 Ground Transport <span className="text-xs text-brand-purple">(÷{travelerCount})</span></td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.groundTransport > 0 ? <span className="text-brand-green font-medium">${(t.groundTransport / travelerCount).toFixed(0)}</span> : <span className="text-text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2 px-3">💵 Tips & Misc</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.tips > 0 ? <span className="text-brand-green font-medium">${t.tips}</span> : <span className="text-text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-border-light">
                <td className="py-2 px-3">💼 Business Dev</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-2 px-3 text-right">
                      {t.bizdev > 0 ? <span className="text-brand-green font-medium">${t.bizdev}</span> : <span className="text-text-faint">—</span>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-bold">
                <td className="py-3 px-3 text-terminal-lg">Per Person Total</td>
                {destinations.map(dest => {
                  const t = calculateTotal(dest.resortId);
                  return (
                    <td key={dest.id} className="py-3 px-3 text-right text-sm text-brand-green">
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
