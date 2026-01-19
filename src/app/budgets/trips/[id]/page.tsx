'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout, Card, Button, Badge, PageHeader } from '@/components/ui';
import DestinationSelector from '@/components/trips/DestinationSelector';
import FlightPicker from '@/components/trips/FlightPicker';
import DestinationMap from '@/components/trips/DestinationMap';
import TripPlannerAI from '@/components/trips/TripPlannerAI';
import 'leaflet/dist/leaflet.css';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  paymentMethod: string | null;
  paymentHandle: string | null;
  rsvpStatus: string;
  isOwner: boolean;
  unavailableDays: number[] | null;
  inviteUrl?: string;
}

interface ExpenseSplit {
  id: string;
  amount: string;
  settled: boolean;
  participant: { id: string; firstName: string; lastName: string };
}

interface Expense {
  id: string;
  day: number | null;
  category: string;
  vendor: string;
  description: string | null;
  amount: string;
  date: string;
  isShared: boolean;
  splitCount: number;
  perPerson: string | null;
  location: string | null;
  paidBy: { id: string; firstName: string; lastName: string };
  splits: ExpenseSplit[];
}

interface Trip {
  id: string;
  name: string;
  destination: string | null;
  activity: string | null;
  inviteToken: string | null;
  month: number;
  year: number;
  daysTravel: number;
  daysRiding: number;
  rsvpDeadline: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  committedAt: string | null;
  participants: Participant[];
  expenses: Expense[];
  itinerary: any[];
}

interface DateWindow {
  startDay: number;
  endDay: number;
  availableCount: number;
  availableNames: string[];
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CATEGORIES = [
  { value: 'rideshare', label: 'Rideshare', icon: '🚗' },
  { value: 'flight', label: 'Flight', icon: '✈️' },
  { value: 'rental_car', label: 'Rental Car', icon: '🚐' },
  { value: 'lodging', label: 'Lodging', icon: '🏨' },
  { value: 'meals', label: 'Meals', icon: '🍽️' },
  { value: 'admissions', label: 'Lift Tickets', icon: '🎿' },
  { value: 'equipment', label: 'Rentals', icon: '🏂' },
  { value: 'gas', label: 'Gas', icon: '⛽' },
  { value: 'other', label: 'Other', icon: '📦' }
];

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [settlementMatrix, setSettlementMatrix] = useState<Record<string, Record<string, number>>>({});
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [destinations, setDestinations] = useState<any[]>([]);
  const [confirmedStartDay, setConfirmedStartDay] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Flight booking state
  const [originAirport, setOriginAirport] = useState("LAX");
  const [destinationAirport, setDestinationAirport] = useState("");
  const [selectedFlight, setSelectedFlight] = useState<any>(null);

  const [tripBudget, setTripBudget] = useState<{category: string; amount: number; description: string; splitType?: string}[]>([]);
  // Loaded budget items from DB
  const [initialCosts, setInitialCosts] = useState<Record<string, Record<string, number>>>({});

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    paidById: '', day: '', category: 'meals', vendor: '', description: '',
    amount: '', date: new Date().toISOString().split('T')[0], location: '', splitWith: [] as string[]
  });
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => { loadTrip(); loadParticipants(); loadDestinations(); loadBudgetItems(); }, [id]);

  const loadTrip = async () => {
    try {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error('Failed to load trip');
      const data = await res.json();
      setTrip(data.trip);
      // Initialize confirmedStartDay from saved startDate
      if (data.trip.startDate) {
        const savedDate = new Date(data.trip.startDate);
        setConfirmedStartDay(savedDate.getUTCDate());
      }
      setSettlementMatrix(data.settlementMatrix || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  };

  const loadParticipants = async () => {
    try {
      const res = await fetch(`/api/trips/${id}/participants`);
      if (res.ok) { const data = await res.json(); setParticipants(data.participants || []); }
    } catch (err) { console.error('Failed to load participants:', err); }
  };

  const loadDestinations = async () => {
    try {
      const res = await fetch(`/api/trips/${id}/destinations`);
      if (res.ok) { const data = await res.json(); setDestinations(data.destinations || []); }
    } catch (err) { console.error('Failed to load destinations:', err); }
  };

  const loadBudgetItems = async () => {
    console.log("[DEBUG] loadBudgetItems called for trip:", id);
    try {
      const res = await fetch(`/api/trips/${id}/budget`);
      if (!res.ok) return;
      const data = await res.json();
      const items = data.items || [];
      console.log("[DEBUG] Budget items from API:", items);
      
      if (items.length === 0) return;
      
      // Reverse map COA codes to category keys
      const COA_TO_CATEGORY: Record<string, string> = {
        'P-7100': 'flight',
        'P-7200': 'hotel',
        'P-7300': 'car',
        'P-7400': 'activities',
        'P-7500': 'equipment',
        'P-7600': 'groundTransport',
        'P-7700': 'meals',
        'P-7800': 'tips',
        'P-8220': 'bizdev',
      };
      
      // We'll apply loaded costs to the selected destination
      // Need to wait for destinations to load first
      const destRes = await fetch(`/api/trips/${id}/destinations`);
      if (!destRes.ok) return;
      const destData = await destRes.json();
      const dests = destData.destinations || [];
      
      // Find the selected destination (matches trip.destination name)
      const tripRes = await fetch(`/api/trips/${id}`);
      const tripData = await tripRes.json();
      const selectedDest = dests.find((d: any) => d.resort?.name === tripData.trip?.destination);
      
      if (!selectedDest) return;
      
      // Build manualCosts structure
      const costs: Record<string, Record<string, number>> = {};
      costs[selectedDest.resortId] = {};
      
      for (const item of items) {
        const category = COA_TO_CATEGORY[item.coaCode];
        if (category) {
          // Only restore manual cost categories (not flight/hotel/car which come from pickers)
          costs[selectedDest.resortId][category] = Number(item.amount);
        }
      }
      
      setInitialCosts(costs);
      
      // Also restore tripBudget for committed trips
      const restoredBudget = items.map((item: any) => ({
        category: COA_TO_CATEGORY[item.coaCode] || item.coaCode,
        amount: Number(item.amount),
        description: item.description || '',
        photoUrl: item.photoUrl || null
      }));
      setTripBudget(restoredBudget);
      console.log('Restored tripBudget from DB:', restoredBudget);
    } catch (err) {
      console.error('Failed to load budget items:', err);
    }
  };

  const selectDestination = async (resortId: string, resortName: string) => {
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: resortName })
      });
      if (res.ok) setTrip(prev => prev ? { ...prev, destination: resortName } : null);
    } catch (err) { console.error("Failed to select destination:", err); }
  };

  const copyInviteLink = () => {
    if (trip?.inviteToken) {
      navigator.clipboard.writeText(`${window.location.origin}/trips/rsvp?token=${trip.inviteToken}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const commitTrip = async () => {
    if (!confirmedStartDay || !trip?.destination) {
      alert('Please select a date window and destination first');
      return;
    }
    setCommitting(true);
    // Combine flight (if selected) + AI selections into budgetItems
    const allBudgetItems = [...tripBudget];
    if (selectedFlight?.price) {
      allBudgetItems.push({
        category: 'flight',
        amount: selectedFlight.price,
        description: selectedFlight.isManual ? 'Manual Flight' : `${selectedFlight.outbound?.carriers[0] || 'Flight'}`
      });
    }
    console.log("budgetItems being sent:", allBudgetItems);
    try {
      const res = await fetch(`/api/trips/${id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDay: confirmedStartDay, budgetItems: allBudgetItems })
      });
      if (!res.ok) throw new Error('Failed to commit trip');
      const data = await res.json();
      setTrip(prev => prev ? { ...prev, startDate: data.startDate, endDate: data.endDate, status: 'committed', committedAt: new Date().toISOString() } : null);
      alert('Trip committed to calendar!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to commit');
    } finally {
      setCommitting(false);
    }
  };

  const uncommitTrip = async () => {
    if (!confirm('Remove this trip from the calendar?')) return;
    setCommitting(true);
    // Combine flight (if selected) + AI selections into budgetItems
    const allBudgetItems = [...tripBudget];
    if (selectedFlight?.price) {
      allBudgetItems.push({
        category: 'flight',
        amount: selectedFlight.price,
        description: selectedFlight.isManual ? 'Manual Flight' : `${selectedFlight.outbound?.carriers[0] || 'Flight'}`
      });
    }
    console.log("budgetItems being sent:", allBudgetItems);
    try {
      const res = await fetch(`/api/trips/${id}/commit`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to uncommit');
      setTrip(prev => prev ? { ...prev, startDate: null, endDate: null, committedAt: null, status: 'planning' } : null);
      setConfirmedStartDay(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    } finally {
      setCommitting(false);
    }
  };


  // Calculate trip dates for flight search
  const tripDates = useMemo(() => {
    if (!trip || !confirmedStartDay) return null;
    const start = new Date(trip.year, trip.month - 1, confirmedStartDay);
    const end = new Date(trip.year, trip.month - 1, confirmedStartDay + trip.daysTravel - 1);
    return {
      departure: start.toISOString().split("T")[0],
      return: end.toISOString().split("T")[0],
    };
  }, [trip, confirmedStartDay]);
  const dateWindows = useMemo(() => {
    if (!trip) return [];
    const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
    const confirmed = participants.filter(p => p.rsvpStatus === 'confirmed');
    if (confirmed.length === 0) return [];
    const windows: DateWindow[] = [];
    for (let start = 1; start <= daysInMonth - trip.daysTravel + 1; start++) {
      const days = Array.from({ length: trip.daysTravel }, (_, i) => start + i);
      const available = confirmed.filter(p => !days.some(d => (p.unavailableDays || []).includes(d)));
      if (available.length === confirmed.length) {
        windows.push({ startDay: start, endDay: start + trip.daysTravel - 1, availableCount: available.length, availableNames: available.map(p => p.firstName) });
      }
    }
    return windows;
  }, [trip, participants]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExpense(true);
    try {
      const res = await fetch(`/api/trips/${id}/expenses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...expenseForm, day: expenseForm.day ? parseInt(expenseForm.day) : null, amount: parseFloat(expenseForm.amount) })
      });
      if (!res.ok) throw new Error('Failed to add expense');
      setShowExpenseForm(false);
      setExpenseForm({ paidById: '', day: '', category: 'meals', vendor: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], location: '', splitWith: [] });
      loadTrip();
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setSavingExpense(false); }
  };

  const toggleSplitWith = (pid: string) => {
    setExpenseForm(prev => ({
      ...prev, splitWith: prev.splitWith.includes(pid) ? prev.splitWith.filter(p => p !== pid) : [...prev.splitWith, pid]
    }));
  };

  const removeParticipant = async (participantId: string, name: string) => {
    if (!confirm("Remove " + name + " from this trip?")) return;
    try {
      const res = await fetch("/api/trips/" + id + "/participants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId })
      });
      if (!res.ok) throw new Error("Failed to remove participant");
      loadParticipants();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  if (loading) return <AppLayout><div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-[#b4b237] border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  if (error || !trip) return <AppLayout><div className="flex items-center justify-center py-20 text-red-500">{error || 'Trip not found'}</div></AppLayout>;

  const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const confirmedParticipants = participants.filter(p => p.rsvpStatus === 'confirmed');
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <AppLayout>
      <PageHeader
        title={trip.name}
        subtitle={`${trip.destination || 'Destination TBD'} • ${MONTHS[trip.month]} ${trip.year} • ${trip.daysTravel} days`}
        backHref="/budgets/trips"
        badge={<Badge variant={trip.status === 'confirmed' ? 'success' : trip.status === 'planning' ? 'warning' : 'default'}>{trip.status}</Badge>}
        actions={
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-2xl font-bold text-green-600">${totalExpenses.toFixed(2)}</div>
              <div className="text-xs text-gray-500">total budget</div>
            </div>
            {trip.inviteToken && (
              <Button variant="secondary" size="sm" onClick={copyInviteLink}>
                {copiedLink ? '✓ Copied!' : '📋 Invite Link'}
              </Button>
            )}
          </div>
        }
      />

      <div className="px-4 lg:px-8 py-8 space-y-6">
        {/* Row 1: Travelers + Settlement */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Travelers */}
          <Card title={`👥 Travelers (${participants.length})`}>
            <div className="space-y-2">
              {participants.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      p.rsvpStatus === 'confirmed' ? 'bg-green-500' : p.rsvpStatus === 'declined' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}>{p.firstName[0]}</div>
                    <div>
                      <div className="font-medium text-sm text-gray-900">
                        {p.firstName} {p.lastName}
                        {p.isOwner && <span className="ml-2 text-xs text-blue-500">(organizer)</span>}
                      </div>
                      <div className="text-xs text-gray-500">{p.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.rsvpStatus === 'confirmed' ? 'success' : p.rsvpStatus === 'declined' ? 'danger' : 'warning'} size="sm">
                      {p.rsvpStatus}
                    </Badge>
                    {!p.isOwner && (
                      <button
                        onClick={() => removeParticipant(p.id, p.firstName)}
                        className="text-red-400 hover:text-red-600 text-xs px-2 py-1 hover:bg-red-50 rounded"
                        title="Remove participant"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {participants.length === 0 && <p className="text-gray-400 text-center py-4">No travelers yet</p>}
            </div>
          </Card>

          {/* Settlement Matrix */}
          <Card title="💰 Who Owes Whom">
            {confirmedParticipants.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 text-gray-500 font-medium">Person</th>
                      {confirmedParticipants.map(p => (
                        <th key={p.id} className="text-center py-2 px-2 text-gray-500 font-medium">{p.firstName}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {confirmedParticipants.map(p => (
                      <tr key={p.id} className="border-b border-gray-100">
                        <td className="py-2 px-2 font-medium text-gray-900">{p.firstName}</td>
                        {confirmedParticipants.map(other => (
                          <td key={other.id} className="text-center py-2 px-2">
                            {p.id === other.id ? <span className="text-gray-300">—</span> : (
                              <span className={(settlementMatrix[p.id]?.[other.id] || 0) > 0 ? 'text-red-500 font-medium' : 'text-gray-400'}>
                                {(settlementMatrix[p.id]?.[other.id] || 0) > 0 ? `$${settlementMatrix[p.id][other.id].toFixed(0)}` : '$0'}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-400 text-center py-4">Waiting for confirmations...</p>}
          </Card>
        </div>

        {/* Row 2: Availability Calendar */}
        <Card title="📅 Availability & Date Finder">
          <div className="mb-6">
            <div className="text-sm text-gray-500 mb-3">{MONTHS[trip.month]} {trip.year}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-2 text-gray-400 w-24 sticky left-0 bg-white">Traveler</th>
                    {calendarDays.map(day => (
                      <th key={day} className="text-center py-2 px-1 text-gray-400 min-w-[28px]">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {confirmedParticipants.map(p => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-2 px-2 text-gray-700 font-medium sticky left-0 bg-white">{p.firstName}</td>
                      {calendarDays.map(day => {
                        const blocked = (p.unavailableDays || []).includes(day);
                        return (
                          <td key={day} className="text-center py-1 px-1">
                            <div className={`w-6 h-6 rounded text-xs flex items-center justify-center ${blocked ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'}`}>
                              {blocked ? '✗' : '✓'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-3">Valid {trip.daysTravel}-Day Windows:</h3>
            {dateWindows.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dateWindows.map((w, idx) => (
                  <button key={idx} onClick={() => setConfirmedStartDay(w.startDay)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      confirmedStartDay === w.startDay ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}>
                    {MONTHS[trip.month].slice(0, 3)} {w.startDay}–{w.endDay}
                  </button>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">{confirmedParticipants.length === 0 ? 'Waiting for RSVPs...' : 'No valid windows found.'}</p>}
            {confirmedStartDay && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-green-700 font-medium">✓ Selected: {MONTHS[trip.month]} {confirmedStartDay}–{confirmedStartDay + trip.daysTravel - 1}, {trip.year}</span>
              </div>
            )}
          </div>
        </Card>

        {/* Row 3: Destinations */}
        <Card title="🏔️ Destinations to Compare">
          <DestinationSelector
            activity={trip.activity}
            tripId={id}
            selectedDestinations={destinations}
            onDestinationsChange={loadDestinations}
            selectedDestinationId={destinations.find(d => d.resort?.name === trip.destination)?.resortId}
            onSelectDestination={selectDestination}
          />
          
          {/* Destination Map */}
          {destinations.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-500 mb-3">📍 Compare Locations</h4>
              <DestinationMap
                destinations={destinations}
                selectedName={trip.destination}
                onDestinationClick={(resortId, name) => selectDestination(resortId, name)}
              />
            </div>
          )}
        </Card>


        {/* Row 4: Flights */}
        <Card title="✈️ Flights">
          {(() => {
            const selectedDest = destinations.find(d => d.resort?.name === trip.destination);
            const defaultDestAirport = selectedDest?.resort?.nearestAirport || "DPS";
            const effectiveDestAirport = destinationAirport || defaultDestAirport;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm text-gray-600">Flying from:</label>
                  <input
                    type="text"
                    value={originAirport}
                    onChange={(e) => setOriginAirport(e.target.value.toUpperCase())}
                    placeholder="LAX"
                    maxLength={3}
                    className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase"
                  />
                  <span className="text-gray-400">→</span>
                  <input
                    type="text"
                    value={destinationAirport || defaultDestAirport}
                    onChange={(e) => setDestinationAirport(e.target.value.toUpperCase())}
                    placeholder={defaultDestAirport}
                    maxLength={3}
                    className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase"
                  />
                  {trip.destination && <span className="text-xs text-gray-500">({trip.destination})</span>}
                </div>
                {tripDates ? (
                  <FlightPicker
                    destinationName={trip.destination || "Destination"}
                    destinationAirport={effectiveDestAirport}
                    originAirport={originAirport}
                    departureDate={tripDates.departure}
                    returnDate={tripDates.return}
                    passengers={confirmedParticipants.length || 1}
                    selectedFlight={selectedFlight}
                    onSelectFlight={setSelectedFlight}
                  />
                ) : (
                  <div className="text-center py-8 text-yellow-600 bg-yellow-50 rounded-lg">
                    ⚠️ Select trip dates above to search flights
                  </div>
                )}
              </div>
            );
          })()}
        </Card>

        {/* Row 4: AI Trip Assistant */}
        <Card title="🤖 AI Trip Assistant">
          {(() => {
            const selectedDest = destinations.find(d => d.resort?.name === trip.destination);
            return (
              <TripPlannerAI
                committedBudget={tripBudget}
                tripId={id}
                city={selectedDest?.resort?.name || trip.destination}
                country={selectedDest?.resort?.country || null}
                activity={trip.activity}
                month={trip.month}
                year={trip.year}
                daysTravel={trip.daysTravel}
                onBudgetChange={(total, selections, groupSize) => {
                  const catMap: Record<string, string> = {
                    lodging: "lodging", coworking: "coworking", motoRental: "car",
                    equipmentRental: "equipment", airportTransfers: "airportTransfers",
                    brunchCoffee: "meals", dinner: "meals", activities: "activities",
                    nightlife: "activities", toiletries: "tips", wellness: "wellness",
                  };
                  const items = selections.map(sel => ({
                    splitType: sel.splitType || "personal",
                    category: catMap[sel.category] || sel.category,
                    amount: (sel.customPrice * (sel.rateType === "daily" ? sel.days.length : sel.rateType === "weekly" ? Math.ceil(sel.days.length / 7) : 1)) / (sel.splitType === "split" ? groupSize : 1),
                    description: sel.item.name,
                    photoUrl: sel.item.photoUrl || null,
                  }));
                  setTripBudget(items);
                }}
              />
            );
          })()}
        </Card>

        {/* Committed Budget Summary */}
        {tripBudget.length > 0 && (
          <Card title={trip?.status === 'committed' ? "✅ Committed Budget" : "📋 Planned Budget (not committed)"}>
            <div className="space-y-2">
              {tripBudget.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{item.description || item.category}</span>
                    <span className="text-xs text-gray-500 ml-2">({item.category})</span>
                    {item.splitType === "split" && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded ml-2">👥 Your share</span>}
                  </div>
                  <span className="font-bold text-green-600">${Number(item.amount).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg mt-4 border-t-2 border-green-500">
                <span className="font-bold">Total Committed</span>
                <span className="font-bold text-green-700 text-lg">
                  ${tripBudget.reduce((sum, item) => sum + Number(item.amount), 0).toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        )}

        {/* Row 5: Itinerary & Budget */}
        <Card
          title="🗓️ Itinerary & Budget"
          action={<Button size="sm" onClick={() => setShowExpenseForm(!showExpenseForm)}>{showExpenseForm ? 'Cancel' : '+ Add Expense'}</Button>}
          noPadding
        >
          {/* Booking Flow */}
          {/* Expense Form */}
          {showExpenseForm && (
            <form onSubmit={handleAddExpense} className="p-6 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <select value={expenseForm.paidById} onChange={(e) => setExpenseForm({ ...expenseForm, paidById: e.target.value })}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">Paid by...</option>
                  {confirmedParticipants.map(p => <option key={p.id} value={p.id}>{p.firstName}</option>)}
                </select>
                <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                </select>
                <input type="text" placeholder="Vendor *" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
                <input type="number" step="0.01" placeholder="Amount *" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <input type="number" min="1" placeholder="Day #" value={expenseForm.day} onChange={(e) => setExpenseForm({ ...expenseForm, day: e.target.value })}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input type="text" placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-500">Split with:</span>
                {confirmedParticipants.map(p => (
                  <button key={p.id} type="button" onClick={() => toggleSplitWith(p.id)}
                    className={`px-2 py-1 rounded text-xs font-medium ${expenseForm.splitWith.includes(p.id) ? 'bg-[#b4b237] text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {p.firstName}
                  </button>
                ))}
                {expenseForm.splitWith.length > 0 && expenseForm.amount && (
                  <span className="text-xs text-green-600 ml-2">= ${(parseFloat(expenseForm.amount) / expenseForm.splitWith.length).toFixed(2)}/person</span>
                )}
              </div>
              <Button type="submit" loading={savingExpense}>Add to Itinerary</Button>
            </form>
          )}

          {/* Expenses Table */}
          {trip.expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-white">
                    <th className="text-left py-3 px-4 font-semibold">Day</th>
                    <th className="text-left py-3 px-4 font-semibold">Category</th>
                    <th className="text-left py-3 px-4 font-semibold">Vendor</th>
                    <th className="text-left py-3 px-4 font-semibold">Note</th>
                    <th className="text-right py-3 px-4 font-semibold">Cost</th>
                    <th className="text-left py-3 px-4 font-semibold">Split</th>
                    <th className="text-right py-3 px-4 font-semibold">Per Person</th>
                  </tr>
                </thead>
                <tbody>
                  {trip.expenses.sort((a, b) => (a.day || 99) - (b.day || 99)).map((expense, idx) => {
                    const cat = CATEGORIES.find(c => c.value === expense.category);
                    return (
                      <tr key={expense.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : ''}`}>
                        <td className="py-3 px-4">{expense.day || '-'}</td>
                        <td className="py-3 px-4"><span className="mr-1">{cat?.icon}</span>{cat?.label || expense.category}</td>
                        <td className="py-3 px-4 font-medium text-gray-900">{expense.vendor}</td>
                        <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{expense.description || '-'}</td>
                        <td className="py-3 px-4 text-right font-medium">${parseFloat(expense.amount).toFixed(2)}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">
                          {expense.isShared ? expense.splits.map(s => s.participant.firstName).join(', ') : `${expense.paidBy.firstName}`}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 font-medium">
                          ${expense.perPerson ? parseFloat(expense.perPerson).toFixed(2) : parseFloat(expense.amount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={4} className="py-4 px-4 font-bold text-gray-900">Total</td>
                    <td className="py-4 px-4 text-right font-bold text-xl text-gray-900">${totalExpenses.toFixed(2)}</td>
                    <td></td>
                    <td className="py-4 px-4 text-right text-green-600 font-bold">
                      ${confirmedParticipants.length > 0 ? (totalExpenses / confirmedParticipants.length).toFixed(2) : '0.00'}/avg
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">🗓️</div>
              <p>No expenses yet. Start building your trip budget!</p>
            </div>
          )}
        </Card>

        {/* Row 5: Category Summary */}
        {trip.expenses.length > 0 && (
          <Card title="📊 Budget by Category">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {CATEGORIES.map(cat => {
                const catExpenses = trip.expenses.filter(e => e.category === cat.value);
                const catTotal = catExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                if (catTotal === 0) return null;
                return (
                  <div key={cat.value} className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">{cat.icon}</div>
                    <div className="text-xs text-gray-500 mb-1">{cat.label}</div>
                    <div className="font-bold text-gray-900">${catTotal.toFixed(2)}</div>
                    <div className="text-xs text-gray-400">{catExpenses.length} items</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Row 6: Commit Trip */}
        <Card title="🚀 Commit Trip to Calendar" className="border-2 border-dashed border-gray-300">
          <div className="space-y-4">
            {trip.committedAt ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-lg font-bold text-green-800 mb-2">Trip Committed!</h3>
                <p className="text-green-700 mb-4">
                  {trip.destination} • {new Date(trip.startDate!).toLocaleDateString()} - {new Date(trip.endDate!).toLocaleDateString()}
                </p>
                <Button variant="secondary" onClick={uncommitTrip} loading={committing}>
                  Remove from Calendar
                </Button>
              </div>
            ) : (
              <>
                <div className="grid md:grid-cols-3 gap-4 text-center">
                  <div className={`p-4 rounded-xl border-2 ${confirmedStartDay ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="text-2xl mb-2">{confirmedStartDay ? '✅' : '📅'}</div>
                    <div className="text-sm font-medium text-gray-700">Dates</div>
                    <div className="text-xs text-gray-500">
                      {confirmedStartDay
                        ? `${MONTHS[trip.month]} ${confirmedStartDay}-${confirmedStartDay + trip.daysTravel - 1}`
                        : 'Select above'}
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl border-2 ${trip.destination ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="text-2xl mb-2">{trip.destination ? '✅' : '📍'}</div>
                    <div className="text-sm font-medium text-gray-700">Destination</div>
                    <div className="text-xs text-gray-500">{trip.destination || 'Select above'}</div>
                  </div>
                  <div className={`p-4 rounded-xl border-2 ${trip.expenses.length > 0 ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="text-2xl mb-2">{trip.expenses.length > 0 ? '✅' : '💰'}</div>
                    <div className="text-sm font-medium text-gray-700">Budget</div>
                    <div className="text-xs text-gray-500">
                      {trip.expenses.length > 0 ? `$${totalExpenses.toFixed(0)} planned` : 'Add expenses'}
                    </div>
                  </div>
                </div>
                <div className="text-center pt-4">
                  <Button
                    onClick={commitTrip}
                    loading={committing}
                    disabled={!confirmedStartDay || !trip.destination}
                    className="px-8 py-3 text-lg"
                  >
                    🗓️ Commit Trip to Calendar
                  </Button>
                  {(!confirmedStartDay || !trip.destination) && (
                    <p className="text-xs text-gray-400 mt-2">Select dates and destination to commit</p>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>

      </div>
    </AppLayout>
  );
}
