'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import DestinationSelector from '@/components/trips/DestinationSelector';
import FlightPicker from '@/components/trips/FlightPicker';
import DestinationMap from '@/components/trips/DestinationMap';
import TripPlannerAI from '@/components/trips/TripPlannerAI';
import CalendarGrid, { CalendarEvent, SourceConfig } from '@/components/shared/CalendarGrid';
import 'leaflet/dist/leaflet.css';

const TRIP_SOURCE_CONFIG: Record<string, SourceConfig> = {
  lodging:      { label: 'Lodging',          icon: '🏨', bg: 'bg-blue-100',    dot: 'bg-blue-400',    badge: 'bg-blue-400' },
  flight:       { label: 'Flights',          icon: '✈️', bg: 'bg-purple-100',  dot: 'bg-purple-400',  badge: 'bg-purple-400' },
  transfer:     { label: 'Ground Transport', icon: '🚕', bg: 'bg-yellow-100',  dot: 'bg-yellow-500',  badge: 'bg-yellow-500' },
  vehicle:      { label: 'Vehicle Rental',   icon: '🏍️', bg: 'bg-orange-100', dot: 'bg-orange-400',  badge: 'bg-orange-400' },
  brunchCoffee: { label: 'Brunch & Coffee',  icon: '☕', bg: 'bg-amber-100',   dot: 'bg-amber-400',   badge: 'bg-amber-400' },
  dinner:       { label: 'Dinner',           icon: '🍽️', bg: 'bg-red-100',    dot: 'bg-red-400',     badge: 'bg-red-400' },
  activities:   { label: 'Activities',       icon: '🎯', bg: 'bg-green-100',   dot: 'bg-green-500',   badge: 'bg-green-500' },
  activity:     { label: 'Activities',       icon: '🎯', bg: 'bg-green-100',   dot: 'bg-green-500',   badge: 'bg-green-500' },
  coworking:    { label: 'Coworking',        icon: '💼', bg: 'bg-indigo-100',  dot: 'bg-indigo-400',  badge: 'bg-indigo-400' },
  nightlife:    { label: 'Nightlife',        icon: '🌙', bg: 'bg-pink-100',    dot: 'bg-pink-400',    badge: 'bg-pink-400' },
  wellness:     { label: 'Wellness',         icon: '🏋️', bg: 'bg-teal-100',   dot: 'bg-teal-400',    badge: 'bg-teal-400' },
  toiletries:   { label: 'Incidentals',      icon: '🛒', bg: 'bg-gray-100',    dot: 'bg-gray-400',    badge: 'bg-gray-400' },
};

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
  homeAirport?: string | null;
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
  const [originAirport, setOriginAirport] = useState("");
  const [destinationAirport, setDestinationAirport] = useState("");

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
  const [userTier, setUserTier] = useState<string>('free');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Vendor commitment state (legacy — commit now handled inside TripPlannerAI)

  useEffect(() => { loadTrip(); loadParticipants(); loadDestinations(); loadBudgetItems(); fetch("/api/auth/me").then(res => res.ok ? res.json() : null).then(data => { if (data?.user?.tier) setUserTier(data.user.tier); }); }, [id]);

  // Derive origin airport from current user's participant record
  useEffect(() => {
    if (participants.length === 0 || originAirport) return;
    const owner = participants.find((p: any) => p.isOwner);
    if (owner?.homeAirport) setOriginAirport(owner.homeAirport);
  }, [participants, originAirport]);

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

  // Derive destination airport from loaded destination data
  useEffect(() => {
    if (!trip?.destination || destinations.length === 0) return;
    const selected = destinations.find((d: any) => d.resort?.name === trip.destination);
    const airport = selected?.resort?.nearestAirport || selected?.resort?.nearest_airport;
    if (airport && !destinationAirport) setDestinationAirport(airport);
  }, [trip?.destination, destinations, destinationAirport]);

  const loadBudgetItems = async () => {
    try {
      const res = await fetch(`/api/trips/${id}/budget`);
      if (!res.ok) return;
      const data = await res.json();
      const items = data.items || [];

      const COA_TO_CATEGORY: Record<string, string> = {
        // Travel COA codes (9xxx) — strip prefix for lookup, support both P- and B-
        'P-9100': 'Flights', 'P-9200': 'Lodging', 'P-9300': 'Vehicle Rental', 'P-9350': 'Equipment Rental',
        'P-9400': 'Activities', 'P-9450': 'Nightlife', 'P-9500': 'Meals & Dining',
        'P-9600': 'Ground Transport', 'P-9700': 'Coworking', 'P-9800': 'Incidentals',
        'P-9900': 'Insurance', 'P-9950': 'Tips & Misc',
        'B-9100': 'Flights', 'B-9200': 'Lodging', 'B-9300': 'Vehicle Rental', 'B-9350': 'Equipment Rental',
        'B-9400': 'Activities', 'B-9450': 'Nightlife', 'B-9500': 'Meals & Dining',
        'B-9600': 'Ground Transport', 'B-9700': 'Coworking', 'B-9800': 'Incidentals',
        'B-9900': 'Insurance', 'B-9950': 'Tips & Misc',
        // Legacy 7xxx codes (backward compat)
        'P-7100': 'Flights', 'P-7200': 'Lodging', 'P-7300': 'Vehicle Rental', 'P-7400': 'Activities',
        'P-7500': 'Equipment Rental', 'P-7600': 'Ground Transport', 'P-7700': 'Meals & Dining',
        'P-7800': 'Tips & Misc', 'P-8220': 'Coworking',
        // Legacy vendor-commit placeholder codes
        'P-9910': 'Flights', 'P-9920': 'Lodging', 'P-9930': 'Ground Transport', 'P-9940': 'Vehicle Rental', 'P-9960': 'Activities',
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


  // Transform itinerary into CalendarGrid events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    if (!trip) return [];
    const items = trip.itinerary || [];
    // Deduplicate by vendorOptionId — group multi-day entries into single events
    const grouped: Record<string, any[]> = {};
    items.forEach((item: any) => {
      const key = item.vendorOptionId || item.id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return Object.entries(grouped).map(([key, entries]) => {
      const first = entries[0];
      const source = first.vendorOptionType || first.category || 'activities';
      const cfg = TRIP_SOURCE_CONFIG[source];
      const totalCost = entries.reduce((s: number, e: any) => s + parseFloat(e.cost || 0), 0);
      const dateStr = first.homeDate ? new Date(first.homeDate).toISOString().split('T')[0] : '';
      return {
        id: key,
        source,
        title: `${cfg?.icon || ''} ${first.vendor || 'Untitled'}`,
        icon: cfg?.icon || null,
        startDate: dateStr,
        endDate: entries.length > 1 && entries[entries.length - 1].homeDate
          ? new Date(entries[entries.length - 1].homeDate).toISOString().split('T')[0]
          : null,
        budgetAmount: totalCost,
        // Stash for uncommit
        _vendorOptionId: first.vendorOptionId,
        _vendorOptionType: first.vendorOptionType,
        _vendor: first.vendor,
        _note: first.note,
      } as CalendarEvent & Record<string, any>;
    });
  }, [trip]);

  // Event click: show detail popover
  const [clickedEvent, setClickedEvent] = useState<(CalendarEvent & Record<string, any>) | null>(null);
  const [uncommitting, setUncommitting] = useState(false);

  const handleUncommitEvent = async () => {
    if (!clickedEvent?._vendorOptionId) return;
    setUncommitting(true);
    try {
      const res = await fetch(`/api/trips/${id}/vendor-commit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: clickedEvent._vendorOptionType || 'activity',
          optionId: clickedEvent._vendorOptionId,
          notes: clickedEvent._vendor || clickedEvent.title,
        }),
      });
      if (!res.ok) throw new Error('Uncommit failed');
      setClickedEvent(null);
      loadTrip();
      loadBudgetItems();
    } catch (err) { alert(err instanceof Error ? err.message : 'Uncommit failed'); }
    finally { setUncommitting(false); }
  };

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

              {calendarEvents.length > 0 || tripDates ? (
                <div className="p-4">
                  <CalendarGrid
                    events={calendarEvents}
                    sourceConfig={TRIP_SOURCE_CONFIG}
                    defaultView="week"
                    anchorDate={tripDates?.departure || trip.startDate || undefined}
                    highlightStart={tripDates?.departure || trip.startDate || undefined}
                    highlightEnd={tripDates?.return || trip.endDate || undefined}
                    onEventClick={(event) => setClickedEvent(event as any)}
                    showBudgetTotals={true}
                    showCategoryLegend={true}
                    compact={true}
                  />
                  {/* Event detail popover */}
                  {clickedEvent && (
                    <div className="mt-3 p-3 bg-white border border-border rounded shadow-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-text-primary">{clickedEvent.title}</div>
                          <div className="text-xs text-text-muted mt-0.5">
                            {TRIP_SOURCE_CONFIG[clickedEvent.source]?.label || clickedEvent.source}
                            {clickedEvent.startDate && <span className="ml-2">{clickedEvent.startDate}</span>}
                            {clickedEvent.endDate && clickedEvent.endDate !== clickedEvent.startDate && <span> — {clickedEvent.endDate}</span>}
                          </div>
                          {(clickedEvent.budgetAmount || 0) > 0 && (
                            <div className="text-sm font-mono font-semibold text-emerald-700 mt-1">{fmt(clickedEvent.budgetAmount || 0)}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {clickedEvent._vendorOptionId && (
                            <button onClick={handleUncommitEvent} disabled={uncommitting}
                              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded disabled:opacity-50">
                              {uncommitting ? '...' : 'Uncommit'}
                            </button>
                          )}
                          <button onClick={() => setClickedEvent(null)} className="px-2 py-1.5 text-xs text-text-muted hover:bg-bg-row rounded">Close</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-text-faint">
                  <p className="text-sm mb-2">Commit vendors to see itinerary calendar</p>
                  <p className="text-xs">Select dates and destination first, then commit lodging, flights, etc.</p>
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

            {/* ── Step 3: Trip Planner & Budget ── */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">3</span>
                Trip Planner &amp; Budget
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
                    tripDates={tripDates}
                    onCommitted={() => { loadTrip(); loadBudgetItems(); }}
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
                    tripId={id}
                    destinationName={trip.destination}
                    destinationAirport={destinationAirport}
                    originAirport={originAirport}
                    departureDate={tripDates.departure}
                    returnDate={tripDates.return}
                    passengers={confirmedParticipants.length || 1}
                    onCommitted={() => { loadTrip(); loadBudgetItems(); }}
                  />
                </div>
              </div>
            )}

            {/* ── Step 5: Commit Trip ── */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">5</span>
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
