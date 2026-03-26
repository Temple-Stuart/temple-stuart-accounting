'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import DestinationSelector from '@/components/trips/DestinationSelector';
import FlightPicker from '@/components/trips/FlightPicker';
import DestinationMap from '@/components/trips/DestinationMap';
import TripPlannerAI from '@/components/trips/TripPlannerAI';
import TripProfileCard from '@/components/trips/TripProfileCard';
import CalendarGrid, { CalendarEvent, SourceConfig } from '@/components/shared/CalendarGrid';
import { ADMIN_USER_ID } from '@/lib/tiers';
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
  profileActivities?: string[];
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
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Inline date editing
  const [editingDates, setEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');

  const saveDates = async () => {
    if (!editStartDate || !editEndDate) return;
    try {
      const res = await fetch(`/api/trips/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: editStartDate, endDate: editEndDate }),
      });
      if (res.ok) { loadTrip(); setEditingDates(false); }
    } catch (err) { console.error('Failed to save dates:', err); }
  };

  // Vendor commitment state (legacy — commit now handled inside TripPlannerAI)

  useEffect(() => { loadTrip(); loadParticipants(); loadDestinations(); loadBudgetItems(); fetch("/api/auth/me").then(res => res.ok ? res.json() : null).then(data => { if (data?.user?.tier) setUserTier(data.user.tier); if (data?.user?.email) setCurrentUserEmail(data.user.email); if (data?.user?.id) setCurrentUserId(data.user.id); }); }, [id]);

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
    if (!trip) return null;
    // Prefer stored startDate/endDate, fall back to confirmedStartDay
    if (trip.startDate && trip.endDate) {
      return {
        departure: new Date(trip.startDate).toISOString().split("T")[0],
        return: new Date(trip.endDate).toISOString().split("T")[0],
      };
    }
    if (confirmedStartDay) {
      const start = new Date(trip.year, trip.month - 1, confirmedStartDay);
      const end = new Date(trip.year, trip.month - 1, confirmedStartDay + trip.daysTravel - 1);
      return { departure: start.toISOString().split("T")[0], return: end.toISOString().split("T")[0] };
    }
    return null;
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

          <div className="space-y-4">

            {/* ── Itinerary Calendar (primary view) ── */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{trip.name}</h2>
                  <p className="text-xs text-gray-500">
                    {destinations.length > 0
                      ? destinations.map((d: any) => d.name || d.resort?.name).filter(Boolean).join(' → ')
                      : (trip.destination || 'Destination TBD')} · {MONTHS[trip.month]} {trip.year} · {trip.daysTravel} days
                  </p>
                </div>
                <button onClick={() => setShowExpenseForm(!showExpenseForm)}
                  className="px-3 py-1.5 text-xs bg-brand-gold hover:bg-brand-gold-bright text-white rounded-lg font-medium">
                  {showExpenseForm ? 'Cancel' : '+ Add Expense'}
                </button>
              </div>

              {/* Inline Add Expense Form */}
              {showExpenseForm && (
                <form onSubmit={handleAddExpense} className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <select value={expenseForm.paidById} onChange={(e) => setExpenseForm({ ...expenseForm, paidById: e.target.value })}
                      className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs" required>
                      <option value="">Paid by...</option>
                      {confirmedParticipants.map(p => <option key={p.id} value={p.id}>{p.firstName}</option>)}
                    </select>
                    <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <input type="text" placeholder="Vendor *" value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                      className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs" required />
                    <input type="number" step="0.01" placeholder="Amount *" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs" required />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <input type="number" min="1" max={trip.daysTravel} placeholder="Day #" value={expenseForm.day} onChange={(e) => setExpenseForm({ ...expenseForm, day: e.target.value })}
                      className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="text" placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs col-span-2" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500">Split:</span>
                    {confirmedParticipants.map(p => (
                      <button key={p.id} type="button" onClick={() => toggleSplitWith(p.id)}
                        className={`px-2 py-1 text-xs font-medium rounded ${expenseForm.splitWith.includes(p.id) ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {p.firstName}
                      </button>
                    ))}
                  </div>
                  <button type="submit" disabled={savingExpense}
                    className="px-4 py-2 bg-brand-gold text-white text-xs font-medium rounded-lg disabled:opacity-50">
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
                    anchorDate={tripDates?.departure || trip.startDate?.split('T')[0] || undefined}
                    highlightStart={tripDates?.departure || trip.startDate?.split('T')[0] || undefined}
                    highlightEnd={tripDates?.return || trip.endDate?.split('T')[0] || undefined}
                    onEventClick={(event) => setClickedEvent(event as any)}
                    showBudgetTotals={true}
                    showCategoryLegend={true}
                    compact={true}
                  />
                  {clickedEvent && (
                    <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg shadow-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{clickedEvent.title}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {TRIP_SOURCE_CONFIG[clickedEvent.source]?.label || clickedEvent.source}
                            {clickedEvent.startDate && <span className="ml-2">{clickedEvent.startDate}</span>}
                            {clickedEvent.endDate && clickedEvent.endDate !== clickedEvent.startDate && <span> — {clickedEvent.endDate}</span>}
                          </div>
                          {(clickedEvent.budgetAmount || 0) > 0 && (
                            <div className="text-sm font-semibold text-emerald-700 mt-1">{fmt(clickedEvent.budgetAmount || 0)}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {clickedEvent._vendorOptionId && (
                            <button onClick={handleUncommitEvent} disabled={uncommitting}
                              className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg disabled:opacity-50">
                              {uncommitting ? '...' : 'Uncommit'}
                            </button>
                          )}
                          <button onClick={() => setClickedEvent(null)} className="px-2 py-1.5 text-xs text-gray-400 hover:bg-gray-50 rounded-lg">Close</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm mb-2">Commit vendors to see itinerary calendar</p>
                  <p className="text-xs">Select dates and destination first, then commit lodging, flights, etc.</p>
                </div>
              )}
            </div>

            {/* ── Crew & Profiles ── */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
                <h2 className="text-sm font-semibold text-gray-700">Crew ({participants.length})</h2>
                <span className="text-xs text-gray-500">
                  {participants.filter(p => !!p.profileTripType).length} of {participants.length} profiles complete
                </span>
              </div>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Email</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Status</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Role</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500">Blackout Days</th>
                      <th className="px-3 py-2 text-center font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {participants.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                              p.rsvpStatus === 'confirmed' ? 'bg-emerald-500' : p.rsvpStatus === 'declined' ? 'bg-red-500' : 'bg-amber-500'
                            }`}>
                              {p.firstName[0]}
                            </div>
                            <span className="font-medium text-gray-900">{p.firstName} {p.lastName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-500">{p.email}</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            p.rsvpStatus === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                            p.rsvpStatus === 'declined' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {p.rsvpStatus}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {p.isOwner && <span className="px-2 py-0.5 bg-brand-purple/10 text-brand-purple text-xs rounded">Organizer</span>}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-400">
                          {(p.unavailableDays || []).length > 0 ? (p.unavailableDays || []).join(', ') : '—'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {!p.isOwner && (
                            <button onClick={() => removeParticipant(p.id, p.firstName)}
                              className="text-gray-400 hover:text-red-500">×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Inline profiles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {participants.map(p => (
                  <TripProfileCard
                    key={p.id}
                    participant={p}
                    isCurrentUser={p.email.toLowerCase() === currentUserEmail.toLowerCase()}
                    tripId={id}
                    onProfileSaved={() => { loadParticipants(); }}
                  />
                ))}
              </div>
            </div>

            {/* ── Flights ── */}
            {tripDates && trip.destination && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">Flights</h2>
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
            )}

            {/* ── Destinations ── */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">Destinations</h2>
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
                  <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Location Map</div>
                  <DestinationMap
                    destinations={destinations}
                    selectedName={trip.destination}
                    onDestinationClick={(resortId: string, name: string) => selectDestination(resortId, name)}
                  />
                </div>
              )}
            </div>

            {/* ── Trip Planner & Budget ── */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">Trip Planner &amp; Budget</h2>
              {(() => {
                const selectedDest = destinations.find((d: any) => d.resort?.name === trip.destination);
                return (
                  (userTier === 'free' || userTier === 'pro') && currentUserId !== ADMIN_USER_ID ? (
                  <div className="text-center py-8">
                    <div className="text-sm font-medium text-gray-900 mb-2">AI Trip Planner requires Pro+</div>
                    <div className="text-xs text-gray-500 mb-4">Upgrade to Pro+ ($40/mo) to unlock AI-powered trip planning.</div>
                    <button onClick={() => setShowUpgradeModal(true)} className="px-6 py-2 text-xs bg-brand-gold text-white font-medium rounded-lg hover:bg-brand-gold-bright">View Plans</button>
                  </div>
                ) : (
                  <TripPlannerAI
                    tripId={id}
                    city={selectedDest?.resort?.name || trip.destination}
                    country={selectedDest?.resort?.country || null}
                    activity={trip.activity}
                    participantProfiles={participants.map(p => ({
                      firstName: p.firstName,
                      profileTripType: p.profileTripType,
                      profileActivities: p.profileActivities,
                    }))}
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

            {/* ── Commit to Calendar ── */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">Commit to Calendar</h2>
              {trip.committedAt ? (
                <div className="text-center py-4">
                  <div className="text-sm font-semibold text-emerald-700 mb-1">Trip Committed</div>
                  <div className="text-xs text-gray-500 mb-4">
                    {new Date(trip.startDate!).toLocaleDateString()} - {new Date(trip.endDate!).toLocaleDateString()}
                  </div>
                  <button onClick={uncommitTrip} disabled={committing}
                    className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">
                    {committing ? '...' : 'Uncommit'}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className={`p-3 text-center rounded-lg border ${confirmedStartDay ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}>
                      <div className="text-lg mb-1">{confirmedStartDay ? '✓' : '—'}</div>
                      <div className="text-xs text-gray-500">Dates</div>
                    </div>
                    <div className={`p-3 text-center rounded-lg border ${trip.destination ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}>
                      <div className="text-lg mb-1">{trip.destination ? '✓' : '—'}</div>
                      <div className="text-xs text-gray-500">Destination</div>
                    </div>
                    <div className={`p-3 text-center rounded-lg border ${committedBudgetItems.length > 0 ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200'}`}>
                      <div className="text-lg mb-1">{committedBudgetItems.length > 0 ? '✓' : '—'}</div>
                      <div className="text-xs text-gray-500">Budget</div>
                    </div>
                  </div>
                  <button onClick={commitTrip} disabled={!confirmedStartDay || !trip.destination || committing}
                    className="w-full px-4 py-3 bg-brand-gold text-white text-sm font-semibold rounded-lg hover:bg-brand-gold-bright disabled:opacity-50">
                    {committing ? 'Committing...' : 'Commit Trip'}
                  </button>
                </div>
              )}
            </div>

            {/* ── Budget Summary ── */}
            {committedBudgetItems.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="text-sm font-semibold text-gray-700">Committed Budget</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Item</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Category</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {committedBudgetItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">{item.description || item.category}</td>
                          <td className="px-3 py-2 text-gray-500">{item.category}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700">{fmt(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 font-semibold text-gray-900">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmt(totalBudget)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ── Settlement Matrix ── */}
            {confirmedParticipants.length > 1 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">Settlement Matrix</h2>
                <div className="overflow-x-auto">
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
                                <span className={(settlementMatrix[p.id]?.[other.id] || 0) > 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}>
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
