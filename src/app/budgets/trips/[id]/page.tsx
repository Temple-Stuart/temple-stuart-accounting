'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import DestinationSelector from '@/components/trips/DestinationSelector';
import FlightPicker from '@/components/trips/FlightPicker';
import DestinationMap from '@/components/trips/DestinationMap';
import TripPlannerAI from '@/components/trips/TripPlannerAI';
import LodgingOptions from '@/components/trips/LodgingOptions';
import TransferOptions from '@/components/trips/TransferOptions';
import VehicleOptions from '@/components/trips/VehicleOptions';
import ActivityExpenses from '@/components/trips/ActivityExpenses';
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
  profileTripType?: string | null;
  profileBudget?: string | null;
  profilePriorities?: string[];
  profileVibe?: string[];
  profilePace?: string | null;
  profileGroupSize?: number | null;
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

  // TODO: onBudgetChange/tripBudget is legacy — budget now flows through vendor-commit only
  const [tripBudget, setTripBudget] = useState<{category: string; amount: number; description: string; splitType?: string}[]>([]);
  const [committedBudgetItems, setCommittedBudgetItems] = useState<{category: string; amount: number; description: string}[]>([]);
  const [initialCosts, setInitialCosts] = useState<Record<string, Record<string, number>>>({});

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    paidById: '', day: '', category: 'meals', vendor: '', description: '',
    amount: '', date: new Date().toISOString().split('T')[0], location: '', splitWith: [] as string[]
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [userTier, setUserTier] = useState<string>('free');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Vendor commitment state
  const [commitPanel, setCommitPanel] = useState<{ optionType: string; optionId: string; title: string } | null>(null);
  const [commitDates, setCommitDates] = useState({ startDate: '', endDate: '', startTime: '', endTime: '', notes: '' });
  const [vendorCommitting, setVendorCommitting] = useState(false);
  const [vendorRefreshKey, setVendorRefreshKey] = useState(0);

  useEffect(() => { loadTrip(); loadParticipants(); loadDestinations(); loadBudgetItems(); fetch("/api/auth/me").then(res => res.ok ? res.json() : null).then(data => { if (data?.user?.tier) setUserTier(data.user.tier); }); }, [id]);

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

      const COA_TO_CATEGORY: Record<string, string> = {
        'P-7100': 'flight', 'P-7200': 'hotel', 'P-7300': 'car', 'P-7400': 'activities',
        'P-7500': 'equipment', 'P-7600': 'groundTransport', 'P-7700': 'meals', 'P-7800': 'tips', 'P-8220': 'bizdev',
        // Legacy vendor-commit codes (pre-migration)
        'P-9910': 'flight', 'P-9920': 'hotel', 'P-9930': 'groundTransport', 'P-9940': 'car', 'P-9960': 'activities',
      };

      const restoredBudget = items.map((item: any) => ({
        category: COA_TO_CATEGORY[item.coaCode] || item.coaCode,
        amount: Number(item.amount),
        description: item.description || '',
      }));
      setCommittedBudgetItems(restoredBudget);
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
    const allBudgetItems = [...committedBudgetItems];
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

  const vendorCommit = async () => {
    if (!commitPanel) return;
    setVendorCommitting(true);
    try {
      const res = await fetch(`/api/trips/${id}/vendor-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: commitPanel.optionType,
          optionId: commitPanel.optionId,
          startDate: commitDates.startDate,
          endDate: commitDates.endDate || null,
          startTime: commitDates.startTime || null,
          endTime: commitDates.endTime || null,
          notes: commitDates.notes || null,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setCommitPanel(null);
      setCommitDates({ startDate: '', endDate: '', startTime: '', endTime: '', notes: '' });
      setVendorRefreshKey(k => k + 1);
      loadTrip();
      loadBudgetItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setVendorCommitting(false);
    }
  };

  const vendorUncommit = async (optionType: string, optionId: string) => {
    if (!confirm('Uncommit this option? Budget and itinerary entries will be removed.')) return;
    try {
      const res = await fetch(`/api/trips/${id}/vendor-commit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionType, optionId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setVendorRefreshKey(k => k + 1);
      loadTrip();
      loadBudgetItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Uncommit failed');
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

  // Day-by-day itinerary (from trip_itinerary, not expenses)
  const itineraryDays = useMemo(() => {
    if (!trip) return [];
    const itineraryItems = trip.itinerary || [];

    // If trip has a startDate, build days from that
    if (trip.startDate) {
      const days = [];
      const start = new Date(trip.startDate);
      for (let i = 0; i < trip.daysTravel; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dayItems = itineraryItems.filter((item: any) => item.day === i + 1);
        days.push({
          dayNum: i + 1,
          date: date,
          weekday: WEEKDAYS[date.getDay()],
          dateStr: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          items: dayItems,
          totalCost: dayItems.reduce((sum: number, item: any) => sum + parseFloat(item.cost || 0), 0)
        });
      }
      return days;
    }

    // No startDate but itinerary records exist (from vendor-commit) — build days from records
    if (itineraryItems.length > 0) {
      const maxDay = Math.max(...itineraryItems.map((item: any) => item.day || 1), trip.daysTravel);
      const days = [];
      for (let i = 0; i < maxDay; i++) {
        const dayItems = itineraryItems.filter((item: any) => item.day === i + 1);
        // Use homeDate from itinerary if available for the date display
        const firstItem = dayItems.find((item: any) => item.homeDate);
        const date = firstItem ? new Date(firstItem.homeDate) : null;
        days.push({
          dayNum: i + 1,
          date: date,
          weekday: date ? WEEKDAYS[date.getDay()] : `Day`,
          dateStr: date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : `Day ${i + 1}`,
          items: dayItems,
          totalCost: dayItems.reduce((sum: number, item: any) => sum + parseFloat(item.cost || 0), 0)
        });
      }
      return days;
    }

    return [];
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

  if (loading) return <AppLayout><div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" /></div></AppLayout>;
  if (error || !trip) return <AppLayout><div className="flex items-center justify-center py-20 text-brand-red">{error || 'Trip not found'}</div></AppLayout>;

  const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const confirmedParticipants = participants.filter(p => p.rsvpStatus === 'confirmed');
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const totalBudget = committedBudgetItems.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <AppLayout>
      <div className="min-h-screen bg-bg-terminal">
        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">
          
          {/* Header */}
          <div className="mb-4 bg-brand-purple text-white p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => router.push('/budgets/trips')} className="text-text-faint hover:text-white text-xs">
                    ← Trips
                  </button>
                  <span className={`px-2 py-0.5 text-[10px] ${trip.committedAt ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                    {trip.committedAt ? 'COMMITTED' : 'PLANNING'}
                  </span>
                </div>
                <h1 className="text-terminal-lg font-semibold tracking-tight">{trip.name}</h1>
                <p className="text-text-faint text-xs font-mono">
                  {trip.destination || 'Destination TBD'} · {MONTHS[trip.month]} {trip.year} · {trip.daysTravel} days
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-bold font-mono">{fmt(totalBudget || totalExpenses)}</div>
                  <div className="text-[10px] text-text-faint">total budget</div>
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
            <div className="bg-white border border-border p-3">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Crew</div>
              <div className="text-sm font-bold font-mono text-text-primary">{confirmedParticipants.length}</div>
              <div className="text-[10px] text-text-faint">{participants.length} invited</div>
            </div>
            <div className="bg-white border border-border p-3">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Days</div>
              <div className="text-sm font-bold font-mono text-text-primary">{trip.daysTravel}</div>
            </div>
            <div className="bg-white border border-border p-3">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Expenses</div>
              <div className="text-sm font-bold font-mono text-text-primary">{trip.expenses.length}</div>
            </div>
            <div className="bg-white border border-border p-3">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Budget</div>
              <div className="text-sm font-bold font-mono text-emerald-700">{fmt(totalBudget || totalExpenses)}</div>
            </div>
            <div className="bg-white border border-border p-3">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Per Person</div>
              <div className="text-sm font-bold font-mono text-text-primary">
                {confirmedParticipants.length > 0 ? fmt((totalBudget || totalExpenses) / confirmedParticipants.length) : '—'}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* SCOREBOARD — Itinerary + Crew (reference while planning)  */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* ── Itinerary (scoreboard — fills up as you commit vendors) ── */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center justify-between">
                <span>Itinerary</span>
                <button onClick={() => setShowExpenseForm(!showExpenseForm)}
                  className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20">
                  {showExpenseForm ? 'Cancel' : '+ Add Expense'}
                </button>
              </div>

              {/* Inline Add Expense Form */}
              {showExpenseForm && (
                <form onSubmit={handleAddExpense} className="p-4 bg-bg-row border-b border-border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <select value={expenseForm.paidById} onChange={(e) => setExpenseForm({ ...expenseForm, paidById: e.target.value })}
                      className="bg-white border border-border px-2 py-1.5 text-xs" required>
                      <option value="">Paid by...</option>
                      {confirmedParticipants.map(p => <option key={p.id} value={p.id}>{p.firstName}</option>)}
                    </select>
                    <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="bg-white border border-border px-2 py-1.5 text-xs">
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <input type="text" placeholder="Vendor *" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                      className="bg-white border border-border px-2 py-1.5 text-xs" required />
                    <input type="number" step="0.01" placeholder="Amount *" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="bg-white border border-border px-2 py-1.5 text-xs" required />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <input type="number" min="1" max={trip.daysTravel} placeholder="Day #" value={expenseForm.day} onChange={(e) => setExpenseForm({ ...expenseForm, day: e.target.value })}
                      className="bg-white border border-border px-2 py-1.5 text-xs" />
                    <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      className="bg-white border border-border px-2 py-1.5 text-xs" />
                    <input type="text" placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      className="bg-white border border-border px-2 py-1.5 text-xs col-span-2" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-text-muted">Split:</span>
                    {confirmedParticipants.map(p => (
                      <button key={p.id} type="button" onClick={() => toggleSplitWith(p.id)}
                        className={`px-2 py-1 text-[10px] font-medium ${expenseForm.splitWith.includes(p.id) ? 'bg-brand-purple text-white' : 'bg-border text-text-secondary'}`}>
                        {p.firstName}
                      </button>
                    ))}
                  </div>
                  <button type="submit" disabled={savingExpense}
                    className="px-4 py-2 bg-brand-purple text-white text-xs font-medium disabled:opacity-50">
                    {savingExpense ? '...' : 'Add'}
                  </button>
                </form>
              )}

              {(trip.startDate || itineraryDays.length > 0) ? (
                <div>
                  {/* Day Selector */}
                  <div className="flex flex-wrap gap-2 p-3 border-b border-border">
                    {itineraryDays.map(day => (
                      <button key={day.dayNum} onClick={() => setSelectedDay(day.dayNum)}
                        className={`px-3 py-1.5 text-[10px] font-medium whitespace-nowrap transition-colors ${
                          selectedDay === day.dayNum ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border'
                        }`}>
                        Day {day.dayNum} · {day.dateStr}
                      </button>
                    ))}
                  </div>

                  {/* Selected Day Content */}
                  {(() => {
                    const day = itineraryDays.find(d => d.dayNum === selectedDay);
                    if (!day) return null;
                    return (
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-purple text-white flex items-center justify-center font-bold">
                              {day.dayNum}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-text-primary">{day.weekday}, {day.dateStr}</div>
                              <div className="text-[10px] text-text-muted">{day.items.length} items</div>
                            </div>
                          </div>
                          {day.totalCost > 0 && (
                            <div className="text-right">
                              <div className="text-sm font-mono font-semibold text-emerald-700">{fmt(day.totalCost)}</div>
                            </div>
                          )}
                        </div>

                        {day.items.length > 0 ? (
                          <div className="space-y-2">
                            {day.items.map((item: any) => (
                              <div key={item.id} className="flex items-center justify-between p-2 bg-bg-row text-xs">
                                <div className="flex items-center gap-2">
                                  {item.destTime && (
                                    <span className="px-2 py-0.5 bg-brand-purple text-white text-[10px] font-mono">{item.destTime}</span>
                                  )}
                                  <span className="px-2 py-0.5 bg-border text-text-secondary text-[10px]">{item.category}</span>
                                  <span className="font-medium">{item.vendor}</span>
                                  {item.note && <span className="text-text-muted">· {item.note}</span>}
                                </div>
                                <div className="text-right">
                                  <div className="font-mono font-semibold">{fmt(parseFloat(item.cost || 0))}</div>
                                  {item.splitBy > 1 && item.perPerson && (
                                    <div className="text-[10px] text-text-muted">
                                      {fmt(parseFloat(item.perPerson))}/person
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-text-faint italic">No activities planned for this day</div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-8 text-center text-text-faint">
                  <p className="text-sm mb-2">Commit the trip to see day-by-day itinerary</p>
                  <p className="text-xs">Select dates and destination first</p>
                </div>
              )}
            </div>

            {/* ── Crew ── */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
                Crew ({participants.length})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-brand-purple-hover text-white">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                      <th className="px-3 py-2 text-center font-medium">Role</th>
                      <th className="px-3 py-2 text-center font-medium">Blackout Days</th>
                      <th className="px-3 py-2 text-center font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {participants.map(p => (
                      <tr key={p.id} className="hover:bg-bg-row">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                              p.rsvpStatus === 'confirmed' ? 'bg-emerald-500' : p.rsvpStatus === 'declined' ? 'bg-red-500' : 'bg-amber-500'
                            }`}>
                              {p.firstName[0]}
                            </div>
                            <span className="font-medium text-text-primary">{p.firstName} {p.lastName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-text-secondary font-mono">{p.email}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 text-[10px] ${
                            p.rsvpStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                            p.rsvpStatus === 'declined' ? 'bg-red-100 text-brand-red' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {p.rsvpStatus}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {p.isOwner && <span className="px-2 py-0.5 bg-brand-purple-wash text-brand-purple text-[10px]">Organizer</span>}
                        </td>
                        <td className="px-3 py-3 text-center text-text-muted">
                          {(p.unavailableDays || []).length > 0 ? (p.unavailableDays || []).join(', ') : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {!p.isOwner && (
                            <button onClick={() => removeParticipant(p.id, p.firstName)}
                              className="text-text-faint hover:text-brand-red">×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* PLANNING FLOW — Steps 1 through 6                         */}
            {/* ═══════════════════════════════════════════════════════════ */}

            {/* ── Step 1: Dates ── */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">1</span>
                Date Selection
              </div>
              <div className="p-4">
                <div className="text-xs text-text-muted mb-3">{MONTHS[trip.month]} {trip.year}</div>

                {/* Mini Calendar */}
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr>
                        <th className="text-left py-1 px-1 text-text-faint w-16 sticky left-0 bg-white">Person</th>
                        {calendarDays.map(day => (
                          <th key={day} className="text-center py-1 px-0.5 text-text-faint min-w-[20px]">{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {confirmedParticipants.map(p => (
                        <tr key={p.id} className="border-t border-border-light">
                          <td className="py-1 px-1 text-text-secondary font-medium sticky left-0 bg-white text-[10px]">{p.firstName}</td>
                          {calendarDays.map(day => {
                            const blocked = (p.unavailableDays || []).includes(day);
                            const inRange = confirmedStartDay && day >= confirmedStartDay && day < confirmedStartDay + trip.daysTravel;
                            return (
                              <td key={day} className="text-center py-0.5 px-0.5">
                                <div className={`w-4 h-4 mx-auto flex items-center justify-center text-[8px] ${
                                  blocked ? 'bg-red-100 text-brand-red' :
                                  inRange ? 'bg-brand-purple text-white' :
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
                <div className="text-xs font-medium text-text-secondary mb-2">Valid {trip.daysTravel}-Day Windows:</div>
                {dateWindows.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {dateWindows.map((w, idx) => (
                      <button key={idx} onClick={() => setConfirmedStartDay(w.startDay)}
                        className={`px-2 py-1 text-[10px] font-medium transition-all ${
                          confirmedStartDay === w.startDay ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border'
                        }`}>
                        {MONTHS[trip.month].slice(0, 3)} {w.startDay}–{w.endDay}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-faint text-xs">{confirmedParticipants.length === 0 ? 'Waiting for RSVPs...' : 'No valid windows found.'}</p>
                )}

                {confirmedStartDay && (
                  <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                    ✓ Selected: {MONTHS[trip.month]} {confirmedStartDay}–{confirmedStartDay + trip.daysTravel - 1}, {trip.year}
                  </div>
                )}
              </div>
            </div>

            {/* ── Step 2: Destinations ── */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">2</span>
                Destinations
              </div>
              <div className="p-4">
                <DestinationSelector
                  activity={trip.activity}
                  tripId={id}
                  selectedDestinations={destinations}
                  onDestinationsChange={loadDestinations}
                  selectedDestinationId={destinations.find((d: any) => d.resort?.name === trip.destination)?.resortId}
                  onSelectDestination={selectDestination}
                />

                {destinations.length > 0 && (
                  <div className="mt-6">
                    <div className="text-xs font-medium text-text-muted mb-3 uppercase tracking-wider">Location Map</div>
                    <DestinationMap
                      destinations={destinations}
                      selectedName={trip.destination}
                      onDestinationClick={(resortId: string, name: string) => selectDestination(resortId, name)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Step 3: AI Trip Planner ── */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">3</span>
                AI Trip Planner
              </div>
              <div className="p-4">
              {(() => {
                const selectedDest = destinations.find((d: any) => d.resort?.name === trip.destination);
                return (
                  userTier === 'free' || userTier === 'pro' ? (
                  <div className="text-center py-8">
                    <div className="text-sm font-medium text-text-primary mb-2">AI Trip Planner requires Pro+</div>
                    <div className="text-xs text-text-muted mb-4">Upgrade to Pro+ ($40/mo) to unlock AI-powered trip planning.</div>
                    <button onClick={() => setShowUpgradeModal(true)} className="px-6 py-2 text-xs bg-brand-purple text-white font-medium hover:bg-brand-purple-hover">View Plans</button>
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
                    participantId={participants.find(p => p.isOwner)?.id}
                    initialProfile={(() => {
                      const owner = participants.find(p => p.isOwner);
                      if (!owner?.profileTripType) return undefined;
                      return {
                        tripType: owner.profileTripType || undefined,
                        budget: owner.profileBudget || undefined,
                        priorities: owner.profilePriorities || [],
                        vibe: owner.profileVibe || [],
                        pace: owner.profilePace || undefined,
                        groupSize: owner.profileGroupSize || undefined,
                      };
                    })()}
                    onBudgetChange={(total: number, selections: any[], groupSize: number) => {
                      const catMap: Record<string, string> = {
                        lodging: "lodging", coworking: "coworking", motoRental: "car",
                        equipmentRental: "equipment", airportTransfers: "airportTransfers",
                        brunchCoffee: "meals", dinner: "meals", activities: "activities",
                        nightlife: "activities", toiletries: "tips", wellness: "wellness",
                      };
                      const items = selections.map((sel: any) => ({
                        splitType: sel.splitType || "personal",
                        category: catMap[sel.category] || sel.category,
                        amount: (sel.customPrice * (sel.rateType === "daily" ? sel.days.length : sel.rateType === "weekly" ? Math.ceil(sel.days.length / 7) : 1)) / (sel.splitType === "split" ? groupSize : 1),
                        description: sel.item.name,
                        photoUrl: sel.item.photoUrl || null,
                      }));
                      setTripBudget(items);
                    }}
                    onVendorOptionCreated={() => setVendorRefreshKey(k => k + 1)}
                    vendorRefreshKey={vendorRefreshKey}
                  />
                )
              );
              })()}
              </div>
            </div>

            {/* ── Step 4: Flights ── */}
            {tripDates && trip.destination && (
              <div className="bg-white border border-border">
                <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                  <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">4</span>
                  Flights
                </div>
                <div className="p-4">
                  <FlightPicker
                    destinationName={trip.destination}
                    destinationAirport={destinationAirport}
                    originAirport={originAirport}
                    departureDate={tripDates.departure}
                    returnDate={tripDates.return}
                    passengers={confirmedParticipants.length || 1}
                    selectedFlight={selectedFlight}
                    onSelectFlight={setSelectedFlight}
                  />
                </div>
              </div>
            )}

            {/* ── Step 5: Vendor Options ── */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">5</span>
                Vendor Options
              </div>
              <div className="divide-y divide-border">
                {/* Lodging */}
                <div className="p-4">
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Lodging</div>
                  <LodgingOptions
                    key={`lodging-${vendorRefreshKey}`}
                    tripId={id}
                    participantCount={confirmedParticipants.length || 1}
                    nights={trip.daysTravel - 1}
                    onCommitOption={(optionType, optionId, title) => { setCommitPanel({ optionType, optionId, title }); setCommitDates({ startDate: tripDates?.departure || '', endDate: tripDates?.return || '', startTime: '', endTime: '', notes: '' }); }}
                    onUncommitOption={vendorUncommit}
                  />
                </div>

                {/* Transfers */}
                <div className="p-4">
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Transfers</div>
                  <TransferOptions
                    key={`transfer-${vendorRefreshKey}`}
                    tripId={id}
                    participantCount={confirmedParticipants.length || 1}
                    onCommitOption={(optionType, optionId, title) => { setCommitPanel({ optionType, optionId, title }); setCommitDates({ startDate: tripDates?.departure || '', endDate: '', startTime: '', endTime: '', notes: '' }); }}
                    onUncommitOption={vendorUncommit}
                  />
                </div>

                {/* Vehicles */}
                <div className="p-4">
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Vehicles</div>
                  <VehicleOptions
                    key={`vehicle-${vendorRefreshKey}`}
                    tripId={id}
                    participantCount={confirmedParticipants.length || 1}
                    days={trip.daysTravel}
                    onCommitOption={(optionType, optionId, title) => { setCommitPanel({ optionType, optionId, title }); setCommitDates({ startDate: tripDates?.departure || '', endDate: tripDates?.return || '', startTime: '', endTime: '', notes: '' }); }}
                    onUncommitOption={vendorUncommit}
                  />
                </div>

                {/* Activities */}
                <div className="p-4">
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Activities</div>
                  <ActivityExpenses
                    key={`activity-${vendorRefreshKey}`}
                    tripId={id}
                    activity={trip.activity}
                    participantCount={confirmedParticipants.length || 1}
                    onCommitOption={(optionType, optionId, title) => { setCommitPanel({ optionType, optionId, title }); setCommitDates({ startDate: tripDates?.departure || '', endDate: '', startTime: '', endTime: '', notes: '' }); }}
                    onUncommitOption={vendorUncommit}
                  />
                </div>
              </div>

              {/* Vendor Commitment Panel (shown when user clicks Commit on any option) */}
              {commitPanel && (
                <div className="border-t border-border bg-emerald-50 p-4">
                  <div className="text-xs font-semibold text-emerald-800 mb-3">
                    Commit: {commitPanel.title} ({commitPanel.optionType})
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">Start Date *</label>
                      <input type="date" value={commitDates.startDate}
                        onChange={e => setCommitDates(p => ({ ...p, startDate: e.target.value }))}
                        className="w-full bg-white border border-border px-2 py-1.5 text-xs" required />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">End Date</label>
                      <input type="date" value={commitDates.endDate}
                        onChange={e => setCommitDates(p => ({ ...p, endDate: e.target.value }))}
                        className="w-full bg-white border border-border px-2 py-1.5 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">Start Time</label>
                      <input type="time" value={commitDates.startTime}
                        onChange={e => setCommitDates(p => ({ ...p, startTime: e.target.value }))}
                        className="w-full bg-white border border-border px-2 py-1.5 text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">Notes</label>
                      <input type="text" value={commitDates.notes} placeholder="Optional notes"
                        onChange={e => setCommitDates(p => ({ ...p, notes: e.target.value }))}
                        className="w-full bg-white border border-border px-2 py-1.5 text-xs" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={vendorCommit} disabled={!commitDates.startDate || vendorCommitting}
                      className="px-4 py-2 bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                      {vendorCommitting ? 'Committing...' : 'Confirm Commitment'}
                    </button>
                    <button onClick={() => setCommitPanel(null)}
                      className="px-4 py-2 text-xs border border-border text-text-secondary hover:bg-bg-row">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Step 6: Commit Trip ── */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">6</span>
                Commit to Calendar
              </div>
              <div className="p-4">
                {trip.committedAt ? (
                  <div className="text-center">
                    <div className="text-3xl mb-2">✓</div>
                    <div className="text-sm font-semibold text-emerald-700 mb-1">Trip Committed</div>
                    <div className="text-xs text-text-muted mb-4">
                      {new Date(trip.startDate!).toLocaleDateString()} - {new Date(trip.endDate!).toLocaleDateString()}
                    </div>
                    <button onClick={uncommitTrip} disabled={committing}
                      className="px-4 py-2 text-xs border border-border text-text-secondary hover:bg-bg-row">
                      {committing ? '...' : 'Uncommit'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className={`p-3 text-center border ${confirmedStartDay ? 'border-emerald-500 bg-emerald-50' : 'border-border'}`}>
                        <div className="text-terminal-lg mb-1">{confirmedStartDay ? '✓' : '—'}</div>
                        <div className="text-[10px] text-text-muted">Dates</div>
                      </div>
                      <div className={`p-3 text-center border ${trip.destination ? 'border-emerald-500 bg-emerald-50' : 'border-border'}`}>
                        <div className="text-terminal-lg mb-1">{trip.destination ? '✓' : '—'}</div>
                        <div className="text-[10px] text-text-muted">Destination</div>
                      </div>
                      <div className={`p-3 text-center border ${committedBudgetItems.length > 0 ? 'border-emerald-500 bg-emerald-50' : 'border-border'}`}>
                        <div className="text-terminal-lg mb-1">{committedBudgetItems.length > 0 ? '✓' : '—'}</div>
                        <div className="text-[10px] text-text-muted">Budget</div>
                      </div>
                    </div>
                    <button onClick={commitTrip} disabled={!confirmedStartDay || !trip.destination || committing}
                      className="w-full px-4 py-3 bg-brand-purple text-white text-sm font-medium hover:bg-brand-purple-hover disabled:opacity-50">
                      {committing ? 'Committing...' : 'Commit Trip'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* OUTPUT / REFERENCE SECTIONS                               */}
            {/* ═══════════════════════════════════════════════════════════ */}

            {/* ── Budget Summary ── */}
            {committedBudgetItems.length > 0 && (
              <div className="bg-white border border-border">
                <div className="bg-brand-purple-hover text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                  Committed Budget
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-bg-row">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Item</th>
                        <th className="px-3 py-2 text-left font-medium">Category</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {committedBudgetItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-bg-row">
                          <td className="px-3 py-2 font-medium">{item.description || item.category}</td>
                          <td className="px-3 py-2 text-text-secondary">{item.category}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700">{fmt(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-bg-row border-t border-border">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 font-semibold">Total</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{fmt(totalBudget)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ── Settlement Matrix ── */}
            {confirmedParticipants.length > 1 && (
              <div className="bg-white border border-border">
                <div className="bg-brand-purple-hover text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                  Settlement Matrix
                </div>
                <div className="p-4 overflow-x-auto">
                  <table className="text-xs">
                    <thead>
                      <tr>
                        <th className="text-left py-2 px-2 text-text-muted font-medium">Owes →</th>
                        {confirmedParticipants.map(p => (
                          <th key={p.id} className="text-center py-2 px-3 text-text-muted font-medium">{p.firstName}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {confirmedParticipants.map(p => (
                        <tr key={p.id} className="border-t border-border-light">
                          <td className="py-2 px-2 font-medium text-text-primary">{p.firstName}</td>
                          {confirmedParticipants.map(other => (
                            <td key={other.id} className="text-center py-2 px-3">
                              {p.id === other.id ? (
                                <span className="text-text-faint">—</span>
                              ) : (
                                <span className={(settlementMatrix[p.id]?.[other.id] || 0) > 0 ? 'text-brand-red font-semibold' : 'text-text-faint'}>
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
        </div>
      </div>
    </AppLayout>
  );
}
