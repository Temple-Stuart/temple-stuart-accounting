'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';
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
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORIES = [
  { value: 'rideshare', label: 'Rideshare' },
  { value: 'flight', label: 'Flight' },
  { value: 'rental_car', label: 'Rental Car' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'meals', label: 'Meals' },
  { value: 'admissions', label: 'Tickets' },
  { value: 'equipment', label: 'Rentals' },
  { value: 'gas', label: 'Gas' },
  { value: 'other', label: 'Other' }
];

type TabType = 'overview' | 'itinerary' | 'crew' | 'budget' | 'destinations' | 'flights';

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
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Flight booking state
  const [originAirport, setOriginAirport] = useState("LAX");
  const [destinationAirport, setDestinationAirport] = useState("");
  const [selectedFlight, setSelectedFlight] = useState<any>(null);

  const [tripBudget, setTripBudget] = useState<{category: string; amount: number; description: string; splitType?: string}[]>([]);
  const [initialCosts, setInitialCosts] = useState<Record<string, Record<string, number>>>({});

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    paidById: '', day: '', category: 'meals', vendor: '', description: '',
    amount: '', date: new Date().toISOString().split('T')[0], location: '', splitWith: [] as string[]
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const [userTier, setUserTier] = useState<string>('free');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => { loadTrip(); loadParticipants(); loadDestinations(); loadBudgetItems(); }, [id]);

  const loadTrip = async () => {
    try {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error('Failed to load trip');
      const data = await res.json();
      setTrip(data.trip);
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
    try {
      const res = await fetch(`/api/trips/${id}/budget`);
      if (!res.ok) return;
      const data = await res.json();
      const items = data.items || [];
      if (items.length === 0) return;
      
      const COA_TO_CATEGORY: Record<string, string> = {
        'P-7100': 'flight', 'P-7200': 'hotel', 'P-7300': 'car', 'P-7400': 'activities',
        'P-7500': 'equipment', 'P-7600': 'groundTransport', 'P-7700': 'meals', 'P-7800': 'tips', 'P-8220': 'bizdev',
      };
      
      const restoredBudget = items.map((item: any) => ({
        category: COA_TO_CATEGORY[item.coaCode] || item.coaCode,
        amount: Number(item.amount),
        description: item.description || '',
        photoUrl: item.photoUrl || null
      }));
      setTripBudget(restoredBudget);
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
      alert('Please select dates and destination first');
      return;
    }
    setCommitting(true);
    const allBudgetItems = [...tripBudget];
    if (selectedFlight?.price) {
      allBudgetItems.push({
        category: 'flight',
        amount: selectedFlight.price,
        description: selectedFlight.isManual ? 'Manual Flight' : `${selectedFlight.outbound?.carriers[0] || 'Flight'}`
      });
    }
    try {
      const res = await fetch(`/api/trips/${id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDay: confirmedStartDay, budgetItems: allBudgetItems })
      });
      if (!res.ok) throw new Error('Failed to commit trip');
      const data = await res.json();
      setTrip(prev => prev ? { ...prev, startDate: data.startDate, endDate: data.endDate, status: 'committed', committedAt: new Date().toISOString() } : null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to commit');
    } finally {
      setCommitting(false);
    }
  };

  const uncommitTrip = async () => {
    if (!confirm('Remove from calendar?')) return;
    setCommitting(true);
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

  // Day-by-day itinerary
  const itineraryDays = useMemo(() => {
    if (!trip || !trip.startDate) return [];
    const days = [];
    const start = new Date(trip.startDate);
    for (let i = 0; i < trip.daysTravel; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dayExpenses = trip.expenses.filter(e => e.day === i + 1);
      days.push({
        dayNum: i + 1,
        date: date,
        weekday: WEEKDAYS[date.getDay()],
        dateStr: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        expenses: dayExpenses,
        totalCost: dayExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)
      });
    }
    return days;
  }, [trip]);

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
    if (!confirm("Remove " + name + "?")) return;
    try {
      const res = await fetch("/api/trips/" + id + "/participants", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId })
      });
      if (!res.ok) throw new Error("Failed");
      loadParticipants();
    } catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  };

  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  if (loading) return <AppLayout><div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-[#2d1b4e] border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  if (error || !trip) return <AppLayout><div className="flex items-center justify-center py-20 text-red-500">{error || 'Trip not found'}</div></AppLayout>;

  const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const confirmedParticipants = participants.filter(p => p.rsvpStatus === 'confirmed');
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalBudget = tripBudget.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f5f5f5]">
        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">
          
          {/* Header */}
          <div className="mb-4 bg-[#2d1b4e] text-white p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => router.push('/budgets/trips')} className="text-gray-400 hover:text-white text-xs">
                    ← Trips
                  </button>
                  <span className={`px-2 py-0.5 text-[10px] ${trip.committedAt ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                    {trip.committedAt ? 'COMMITTED' : 'PLANNING'}
                  </span>
                </div>
                <h1 className="text-lg font-semibold tracking-tight">{trip.name}</h1>
                <p className="text-gray-300 text-xs font-mono">
                  {trip.destination || 'Destination TBD'} · {MONTHS[trip.month]} {trip.year} · {trip.daysTravel} days
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xl font-bold font-mono">{fmt(totalBudget || totalExpenses)}</div>
                  <div className="text-[10px] text-gray-400">total budget</div>
                </div>
                {trip.inviteToken && (
                  <button onClick={copyInviteLink}
                    className="px-3 py-2 text-xs bg-white/10 hover:bg-white/20">
                    {copiedLink ? '✓ Copied' : 'Copy Invite'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Crew</div>
              <div className="text-xl font-bold font-mono text-gray-900">{confirmedParticipants.length}</div>
              <div className="text-[10px] text-gray-400">{participants.length} invited</div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Days</div>
              <div className="text-xl font-bold font-mono text-gray-900">{trip.daysTravel}</div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Expenses</div>
              <div className="text-xl font-bold font-mono text-gray-900">{trip.expenses.length}</div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Budget</div>
              <div className="text-xl font-bold font-mono text-emerald-700">{fmt(totalBudget || totalExpenses)}</div>
            </div>
            <div className="bg-white border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Per Person</div>
              <div className="text-xl font-bold font-mono text-gray-900">
                {confirmedParticipants.length > 0 ? fmt((totalBudget || totalExpenses) / confirmedParticipants.length) : '—'}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto bg-white border border-gray-200">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'itinerary', label: 'Itinerary' },
              { key: 'crew', label: `Crew (${participants.length})` },
              { key: 'budget', label: 'Budget' },
              { key: 'destinations', label: 'Destinations' },
              { key: 'flights', label: 'Flights' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as TabType)}
                className={`px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${activeTab === tab.key ? 'bg-[#2d1b4e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white border border-gray-200">
            
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div>
                <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                  {/* Date Selection */}
                  <div>
                    <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">Date Selection</div>
                    <div className="p-4">
                      <div className="text-xs text-gray-500 mb-3">{MONTHS[trip.month]} {trip.year}</div>
                      
                      {/* Mini Calendar */}
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr>
                              <th className="text-left py-1 px-1 text-gray-400 w-16 sticky left-0 bg-white">Person</th>
                              {calendarDays.map(day => (
                                <th key={day} className="text-center py-1 px-0.5 text-gray-400 min-w-[20px]">{day}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {confirmedParticipants.map(p => (
                              <tr key={p.id} className="border-t border-gray-100">
                                <td className="py-1 px-1 text-gray-700 font-medium sticky left-0 bg-white text-[10px]">{p.firstName}</td>
                                {calendarDays.map(day => {
                                  const blocked = (p.unavailableDays || []).includes(day);
                                  const inRange = confirmedStartDay && day >= confirmedStartDay && day < confirmedStartDay + trip.daysTravel;
                                  return (
                                    <td key={day} className="text-center py-0.5 px-0.5">
                                      <div className={`w-4 h-4 mx-auto flex items-center justify-center text-[8px] ${
                                        blocked ? 'bg-red-100 text-red-500' : 
                                        inRange ? 'bg-[#2d1b4e] text-white' :
                                        'bg-emerald-100 text-emerald-600'
                                      }`}>
                                        {blocked ? '×' : inRange ? '✓' : '·'}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Date Windows */}
                      <div className="text-xs font-medium text-gray-600 mb-2">Valid {trip.daysTravel}-Day Windows:</div>
                      {dateWindows.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {dateWindows.map((w, idx) => (
                            <button key={idx} onClick={() => setConfirmedStartDay(w.startDay)}
                              className={`px-2 py-1 text-[10px] font-medium transition-all ${
                                confirmedStartDay === w.startDay ? 'bg-[#2d1b4e] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}>
                              {MONTHS[trip.month].slice(0, 3)} {w.startDay}–{w.endDay}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-xs">{confirmedParticipants.length === 0 ? 'Waiting for RSVPs...' : 'No valid windows found.'}</p>
                      )}

                      {confirmedStartDay && (
                        <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                          ✓ Selected: {MONTHS[trip.month]} {confirmedStartDay}–{confirmedStartDay + trip.daysTravel - 1}, {trip.year}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Commit Section */}
                  <div>
                    <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">Commit to Calendar</div>
                    <div className="p-4">
                      {trip.committedAt ? (
                        <div className="text-center">
                          <div className="text-3xl mb-2">✓</div>
                          <div className="text-sm font-semibold text-emerald-700 mb-1">Trip Committed</div>
                          <div className="text-xs text-gray-500 mb-4">
                            {new Date(trip.startDate!).toLocaleDateString()} - {new Date(trip.endDate!).toLocaleDateString()}
                          </div>
                          <button onClick={uncommitTrip} disabled={committing}
                            className="px-4 py-2 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50">
                            {committing ? '...' : 'Uncommit'}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className={`p-3 text-center border ${confirmedStartDay ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                              <div className="text-lg mb-1">{confirmedStartDay ? '✓' : '—'}</div>
                              <div className="text-[10px] text-gray-500">Dates</div>
                            </div>
                            <div className={`p-3 text-center border ${trip.destination ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                              <div className="text-lg mb-1">{trip.destination ? '✓' : '—'}</div>
                              <div className="text-[10px] text-gray-500">Destination</div>
                            </div>
                            <div className={`p-3 text-center border ${tripBudget.length > 0 ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                              <div className="text-lg mb-1">{tripBudget.length > 0 ? '✓' : '—'}</div>
                              <div className="text-[10px] text-gray-500">Budget</div>
                            </div>
                          </div>
                          <button onClick={commitTrip} disabled={!confirmedStartDay || !trip.destination || committing}
                            className="w-full px-4 py-3 bg-[#2d1b4e] text-white text-sm font-medium hover:bg-[#3d2b5e] disabled:opacity-50">
                            {committing ? 'Committing...' : 'Commit Trip'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Budget Summary */}
                {tripBudget.length > 0 && (
                  <div className="border-t border-gray-200">
                    <div className="bg-[#3d2b5e] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Budget Summary
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Item</th>
                            <th className="px-3 py-2 text-left font-medium">Category</th>
                            <th className="px-3 py-2 text-center font-medium">Split</th>
                            <th className="px-3 py-2 text-right font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {tripBudget.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium">{item.description || item.category}</td>
                              <td className="px-3 py-2 text-gray-600">{item.category}</td>
                              <td className="px-3 py-2 text-center">
                                {item.splitType === 'split' && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px]">Split</span>}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">{fmt(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t border-gray-200">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 font-semibold">Total</td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{fmt(totalBudget)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Itinerary Tab - Day by Day */}
            {activeTab === 'itinerary' && (
              <div>
                <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold flex items-center justify-between">
                  <span>Day-by-Day Itinerary</span>
                  <button onClick={() => setShowExpenseForm(!showExpenseForm)}
                    className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20">
                    {showExpenseForm ? 'Cancel' : '+ Add Expense'}
                  </button>
                </div>

                {/* Expense Form */}
                {showExpenseForm && (
                  <form onSubmit={handleAddExpense} className="p-4 bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                      <select value={expenseForm.paidById} onChange={(e) => setExpenseForm({ ...expenseForm, paidById: e.target.value })}
                        className="bg-white border border-gray-200 px-2 py-1.5 text-xs" required>
                        <option value="">Paid by...</option>
                        {confirmedParticipants.map(p => <option key={p.id} value={p.id}>{p.firstName}</option>)}
                      </select>
                      <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                        className="bg-white border border-gray-200 px-2 py-1.5 text-xs">
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <input type="text" placeholder="Vendor *" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                        className="bg-white border border-gray-200 px-2 py-1.5 text-xs" required />
                      <input type="number" step="0.01" placeholder="Amount *" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                        className="bg-white border border-gray-200 px-2 py-1.5 text-xs" required />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                      <input type="number" min="1" max={trip.daysTravel} placeholder="Day #" value={expenseForm.day} onChange={(e) => setExpenseForm({ ...expenseForm, day: e.target.value })}
                        className="bg-white border border-gray-200 px-2 py-1.5 text-xs" />
                      <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                        className="bg-white border border-gray-200 px-2 py-1.5 text-xs" />
                      <input type="text" placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                        className="bg-white border border-gray-200 px-2 py-1.5 text-xs col-span-2" />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500">Split:</span>
                      {confirmedParticipants.map(p => (
                        <button key={p.id} type="button" onClick={() => toggleSplitWith(p.id)}
                          className={`px-2 py-1 text-[10px] font-medium ${expenseForm.splitWith.includes(p.id) ? 'bg-[#2d1b4e] text-white' : 'bg-gray-200 text-gray-600'}`}>
                          {p.firstName}
                        </button>
                      ))}
                    </div>
                    <button type="submit" disabled={savingExpense}
                      className="px-4 py-2 bg-[#2d1b4e] text-white text-xs font-medium disabled:opacity-50">
                      {savingExpense ? '...' : 'Add'}
                    </button>
                  </form>
                )}

                {/* Day-by-Day View */}
                {trip.startDate ? (
                  <div className="divide-y divide-gray-200">
                    {itineraryDays.map(day => (
                      <div key={day.dayNum} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#2d1b4e] text-white flex items-center justify-center font-bold">
                              {day.dayNum}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{day.weekday}, {day.dateStr}</div>
                              <div className="text-[10px] text-gray-500">{day.expenses.length} items</div>
                            </div>
                          </div>
                          {day.totalCost > 0 && (
                            <div className="text-right">
                              <div className="text-sm font-mono font-semibold text-emerald-700">{fmt(day.totalCost)}</div>
                            </div>
                          )}
                        </div>

                        {day.expenses.length > 0 ? (
                          <div className="ml-13 space-y-2">
                            {day.expenses.map(expense => (
                              <div key={expense.id} className="flex items-center justify-between p-2 bg-gray-50 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[10px]">{expense.category}</span>
                                  <span className="font-medium">{expense.vendor}</span>
                                  {expense.description && <span className="text-gray-500">· {expense.description}</span>}
                                </div>
                                <div className="text-right">
                                  <div className="font-mono font-semibold">{fmt(parseFloat(expense.amount))}</div>
                                  {expense.isShared && (
                                    <div className="text-[10px] text-gray-500">
                                      {fmt(parseFloat(expense.perPerson || expense.amount))}/person
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="ml-13 text-xs text-gray-400 italic">No activities planned</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400">
                    <p className="text-sm mb-2">Commit the trip to see day-by-day itinerary</p>
                    <p className="text-xs">Select dates and destination first</p>
                  </div>
                )}
              </div>
            )}

            {/* Crew Tab */}
            {activeTab === 'crew' && (
              <div>
                <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
                  Crew ({participants.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#3d2b5e] text-white">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Email</th>
                        <th className="px-3 py-2 text-center font-medium">Status</th>
                        <th className="px-3 py-2 text-center font-medium">Role</th>
                        <th className="px-3 py-2 text-center font-medium">Blackout Days</th>
                        <th className="px-3 py-2 text-center font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {participants.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                                p.rsvpStatus === 'confirmed' ? 'bg-emerald-500' : p.rsvpStatus === 'declined' ? 'bg-red-500' : 'bg-amber-500'
                              }`}>
                                {p.firstName[0]}
                              </div>
                              <span className="font-medium text-gray-900">{p.firstName} {p.lastName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-600 font-mono">{p.email}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-0.5 text-[10px] ${
                              p.rsvpStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                              p.rsvpStatus === 'declined' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {p.rsvpStatus}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {p.isOwner && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px]">Organizer</span>}
                          </td>
                          <td className="px-3 py-3 text-center text-gray-500">
                            {(p.unavailableDays || []).length > 0 ? (p.unavailableDays || []).join(', ') : '—'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {!p.isOwner && (
                              <button onClick={() => removeParticipant(p.id, p.firstName)}
                                className="text-gray-400 hover:text-red-600">×</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Settlement Matrix */}
                {confirmedParticipants.length > 1 && (
                  <div className="border-t border-gray-200">
                    <div className="bg-[#3d2b5e] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Settlement Matrix
                    </div>
                    <div className="p-4 overflow-x-auto">
                      <table className="text-xs">
                        <thead>
                          <tr>
                            <th className="text-left py-2 px-2 text-gray-500 font-medium">Owes →</th>
                            {confirmedParticipants.map(p => (
                              <th key={p.id} className="text-center py-2 px-3 text-gray-500 font-medium">{p.firstName}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {confirmedParticipants.map(p => (
                            <tr key={p.id} className="border-t border-gray-100">
                              <td className="py-2 px-2 font-medium text-gray-900">{p.firstName}</td>
                              {confirmedParticipants.map(other => (
                                <td key={other.id} className="text-center py-2 px-3">
                                  {p.id === other.id ? (
                                    <span className="text-gray-300">—</span>
                                  ) : (
                                    <span className={(settlementMatrix[p.id]?.[other.id] || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                                      {(settlementMatrix[p.id]?.[other.id] || 0) > 0 ? fmt(settlementMatrix[p.id][other.id]) : '$0'}
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Budget Tab */}
            {activeTab === 'budget' && (
              <div>
                <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
                  AI Trip Planner
                </div>
                <div className="p-4">
                  {(() => {
                    const selectedDest = destinations.find(d => d.resort?.name === trip.destination);
                    return (
                      userTier === 'free' || userTier === 'pro' ? (
                      <div className="text-center py-8">
                        <div className="text-sm font-medium text-gray-900 mb-2">AI Trip Planner requires Pro+</div>
                        <div className="text-xs text-gray-500 mb-4">Upgrade to Pro+ ($40/mo) to unlock AI-powered trip planning.</div>
                        <button onClick={() => setShowUpgradeModal(true)} className="px-6 py-2 text-xs bg-[#2d1b4e] text-white font-medium hover:bg-[#3d2b5e]">View Plans</button>
                      </div>
                    ) : (
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
                    )
                  );
                  })()}
                </div>
              </div>
            )}

            {/* Destinations Tab */}
            {activeTab === 'destinations' && (
              <div>
                <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
                  Compare Destinations
                </div>
                <div className="p-4">
                  <DestinationSelector
                    activity={trip.activity}
                    tripId={id}
                    selectedDestinations={destinations}
                    onDestinationsChange={loadDestinations}
                    selectedDestinationId={destinations.find(d => d.resort?.name === trip.destination)?.resortId}
                    onSelectDestination={selectDestination}
                  />
                  
                  {destinations.length > 0 && (
                    <div className="mt-6">
                      <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Location Map</div>
                      <DestinationMap
                        destinations={destinations}
                        selectedName={trip.destination}
                        onDestinationClick={(resortId, name) => selectDestination(resortId, name)}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Flights Tab */}
            {activeTab === 'flights' && (
              <div>
                <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
                  Flight Search
                </div>
                <div className="p-4">
                  {(() => {
                    const selectedDest = destinations.find(d => d.resort?.name === trip.destination);
                    const defaultDestAirport = selectedDest?.resort?.nearestAirport || "DPS";
                    const effectiveDestAirport = destinationAirport || defaultDestAirport;
                    
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <label className="block text-[10px] text-gray-500 uppercase mb-1">From</label>
                            <input type="text" value={originAirport}
                              onChange={(e) => setOriginAirport(e.target.value.toUpperCase())}
                              maxLength={3}
                              className="w-20 border border-gray-200 px-3 py-2 text-sm font-mono uppercase" />
                          </div>
                          <span className="text-gray-400 mt-5">→</span>
                          <div>
                            <label className="block text-[10px] text-gray-500 uppercase mb-1">To</label>
                            <input type="text" value={destinationAirport || defaultDestAirport}
                              onChange={(e) => setDestinationAirport(e.target.value.toUpperCase())}
                              maxLength={3}
                              className="w-20 border border-gray-200 px-3 py-2 text-sm font-mono uppercase" />
                          </div>
                          {trip.destination && <span className="text-xs text-gray-500 mt-5">({trip.destination})</span>}
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
                          <div className="text-center py-8 bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                            Select trip dates to search flights
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
