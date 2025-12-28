'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DestinationSelector from '@/components/trips/DestinationSelector';
import TripBookingFlow from '@/components/trips/TripBookingFlow';

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

interface ItineraryItem {
  id: string;
  day: number;
  homeDate: string;
  homeTime: string | null;
  destDate: string;
  destTime: string | null;
  category: string;
  vendor: string;
  cost: string;
  note: string | null;
  splitNames: string | null;
  splitBy: number;
  perPerson: string | null;
  location: string | null;
  verticalDrop: number | null;
  avgSnow: number | null;
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
  participants: Participant[];
  expenses: Expense[];
  itinerary: ItineraryItem[];
}

interface DateWindow {
  startDay: number;
  endDay: number;
  availableCount: number;
  availableNames: string[];
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

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

  // Confirmed trip dates
  const [confirmedStartDay, setConfirmedStartDay] = useState<number | null>(null);

  // Inline expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    paidById: '',
    day: '',
    category: 'meals',
    vendor: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    splitWith: [] as string[]
  });
  const [savingExpense, setSavingExpense] = useState(false);

  // Inline participant form
  const [showParticipantForm, setShowParticipantForm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [participantForm, setParticipantForm] = useState({
    firstName: '', lastName: '', email: '', phone: ''
  });

  useEffect(() => {
    loadTrip();
    loadParticipants();
    loadDestinations();
  }, [id]);

  const loadTrip = async () => {
    try {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error('Failed to load trip');
      const data = await res.json();
      setTrip(data.trip);
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
      if (res.ok) {
        const data = await res.json();
        setParticipants(data.participants || []);
      }
    } catch (err) {
      console.error('Failed to load participants:', err);
    }
  };

  const loadDestinations = async () => {
    try {
      const res = await fetch(`/api/trips/${id}/destinations`);
      if (res.ok) {
        const data = await res.json();
        setDestinations(data.destinations || []);
      }
    } catch (err) {
      console.error('Failed to load destinations:', err);
    }
  };

  const copyInviteLink = () => {
    if (trip?.inviteToken) {
      const url = `${window.location.origin}/trips/rsvp?token=${trip.inviteToken}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }

  };

  // Calculate valid date windows based on everyone's availability
  const dateWindows = useMemo(() => {
    if (!trip) return [];
    
    const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
    const confirmedParticipants = participants.filter(p => p.rsvpStatus === 'confirmed');
    if (confirmedParticipants.length === 0) return [];

    const windows: DateWindow[] = [];
    const tripLength = trip.daysTravel;

    for (let startDay = 1; startDay <= daysInMonth - tripLength + 1; startDay++) {
      const endDay = startDay + tripLength - 1;
      const tripDays = Array.from({ length: tripLength }, (_, i) => startDay + i);

      const available = confirmedParticipants.filter(p => {
        const blackout = p.unavailableDays || [];
        return !tripDays.some(d => blackout.includes(d));
      });

      if (available.length === confirmedParticipants.length) {
        windows.push({
          startDay,
          endDay,
          availableCount: available.length,
          availableNames: available.map(p => p.firstName)
        });
      }
    }

    return windows;
  }, [trip, participants]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingExpense(true);
    try {
      const res = await fetch(`/api/trips/${id}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...expenseForm,
          day: expenseForm.day ? parseInt(expenseForm.day) : null,
          amount: parseFloat(expenseForm.amount)
        })
      });
      if (!res.ok) throw new Error('Failed to add expense');
      setShowExpenseForm(false);
      setExpenseForm({
        paidById: '', day: '', category: 'meals', vendor: '', description: '',
        amount: '', date: new Date().toISOString().split('T')[0], location: '', splitWith: []
      });
      loadTrip();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/trips/${id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(participantForm)
      });
      if (!res.ok) throw new Error('Failed to add participant');
      setShowParticipantForm(false);
      setParticipantForm({ firstName: '', lastName: '', email: '', phone: '' });
      loadParticipants();
    loadDestinations();
      loadTrip();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add participant');
    }
  };

  const toggleSplitWith = (participantId: string) => {
    setExpenseForm(prev => ({
      ...prev,
      splitWith: prev.splitWith.includes(participantId)
        ? prev.splitWith.filter(pid => pid !== participantId)
        : [...prev.splitWith, participantId]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Loading trip...</div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="text-red-400">{error || 'Trip not found'}</div>
      </div>
    );
  }

  const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const confirmedParticipants = participants.filter(p => p.rsvpStatus === 'confirmed');
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <button onClick={() => router.push('/budgets/trips')} className="text-gray-500 hover:text-gray-900 text-sm mb-2">
              ← Back to Trips
            </button>
            <h1 className="text-3xl font-bold">{trip.name}</h1>
            <p className="text-gray-500">
              {trip.destination || 'TBD'} • {MONTHS[trip.month]} {trip.year} • {trip.daysTravel} days ({trip.daysRiding} riding)
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-green-400">${totalExpenses.toFixed(2)}</div>
            <div className="text-sm text-gray-500">total budget</div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: TRAVELERS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">👥 Travelers ({participants.length})</h2>
            {trip.inviteToken && (
              <button
                onClick={copyInviteLink}
                className="px-3 py-1.5 text-sm bg-[#b4b237] text-white rounded-lg hover:shadow-lg transition-all"
              >
                {copiedLink ? "✓ Copied!" : "📋 Copy Invite Link"}
              </button>
            )}          </div>
          {/* Participants List */}
          <div className="space-y-2">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-gray-100 rounded p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    p.rsvpStatus === 'confirmed' ? 'bg-green-600' :
                    p.rsvpStatus === 'declined' ? 'bg-red-600' : 'bg-yellow-600'
                  }`}>
                    {p.firstName[0]}
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      {p.firstName} {p.lastName}
                      {p.isOwner && <span className="ml-2 text-xs text-blue-400">(organizer)</span>}
                    </div>
                    <div className="text-xs text-gray-400">
                      {p.email} • {p.rsvpStatus}
                      {p.paymentMethod && ` • ${p.paymentMethod}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: SETTLEMENT MATRIX */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">💰 Who Owes Whom</h2>
          {confirmedParticipants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-2 px-3 text-gray-500">Traveler</th>
                    <th className="text-left py-2 px-3 text-gray-500">Payment</th>
                    {confirmedParticipants.map(p => (
                      <th key={p.id} className="text-center py-2 px-3 text-gray-500">{p.firstName}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {confirmedParticipants.map(p => (
                    <tr key={p.id} className="border-b border-gray-200">
                      <td className="py-2 px-3 font-medium">
                        {p.firstName} {p.lastName}
                        {p.isOwner && <span className="ml-2 text-xs text-blue-400">(you)</span>}
                      </td>
                      <td className="py-2 px-3 text-gray-500">{p.paymentMethod || '-'}</td>
                      {confirmedParticipants.map(other => (
                        <td key={other.id} className="text-center py-2 px-3">
                          {p.id === other.id ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className={(settlementMatrix[p.id]?.[other.id] || 0) > 0 ? 'text-red-400' : 'text-gray-400'}>
                              {(settlementMatrix[p.id]?.[other.id] || 0) > 0
                                ? `$${settlementMatrix[p.id][other.id].toFixed(2)}`
                                : '$0'}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400">Waiting for travelers to confirm...</p>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: AVAILABILITY CALENDAR + DATE FINDER */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">📅 Availability &amp; Date Finder</h2>
          
          {/* Calendar Grid */}
          <div className="mb-6">
            <div className="text-sm text-gray-500 mb-2">{MONTHS[trip.month]} {trip.year}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-2 text-gray-400 w-24">Traveler</th>
                    {calendarDays.map(day => (
                      <th key={day} className="text-center py-2 px-1 text-gray-400 min-w-[28px]">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {confirmedParticipants.map(p => (
                    <tr key={p.id} className="border-t border-gray-200">
                      <td className="py-2 px-2 text-gray-600">{p.firstName}</td>
                      {calendarDays.map(day => {
                        const isBlackout = (p.unavailableDays || []).includes(day);
                        return (
                          <td key={day} className="text-center py-1 px-1">
                            <div className={`w-6 h-6 rounded text-xs flex items-center justify-center ${
                              isBlackout ? 'bg-red-600/30 text-red-400' : 'bg-green-600/20 text-green-400'
                            }`}>
                              {isBlackout ? '✗' : '✓'}
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

          {/* Valid Date Windows */}
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              Valid {trip.daysTravel}-Day Windows (everyone available):
            </h3>
            {dateWindows.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dateWindows.map((w, idx) => (
                  <button
                    key={idx}
                    onClick={() => setConfirmedStartDay(w.startDay)}
                    className={`px-3 py-2 rounded text-sm ${
                      confirmedStartDay === w.startDay
                        ? 'bg-green-600 text-gray-900'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {MONTHS[trip.month].slice(0, 3)} {w.startDay}–{w.endDay}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">
                {confirmedParticipants.length === 0 
                  ? 'Waiting for travelers to RSVP with their availability...'
                  : 'No valid windows found where everyone is available. Consider adjusting trip length or checking availability.'}
              </p>
            )}
            {confirmedStartDay && (
              <div className="mt-3 p-3 bg-green-600/20 border border-green-600/40 rounded">
                <span className="text-green-400 font-medium">
                  ✓ Trip confirmed: {MONTHS[trip.month]} {confirmedStartDay}–{confirmedStartDay + trip.daysTravel - 1}, {trip.year}
                </span>
              </div>
            )}
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 4: DESTINATIONS TO COMPARE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">🏔️ Destinations to Compare</h2>
          <DestinationSelector
            activity={trip.activity}
            tripId={id}
            selectedDestinations={destinations}
            onDestinationsChange={loadDestinations}
          />
        </section>
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 5: ITINERARY / BUDGET */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">🗓️ Itinerary &amp; Budget</h2>
            <button
              onClick={() => setShowExpenseForm(!showExpenseForm)}
              className="px-3 py-1 text-sm bg-blue-600 text-gray-900 rounded hover:bg-blue-500"
            >
              {showExpenseForm ? 'Cancel' : '+ Add Expense'}
            </button>
          </div>

          {/* Destination Cost Comparison */}
          {destinations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Compare Costs by Destination</h3>
              <TripBookingFlow
                tripId={id}
                destinations={destinations}
                daysTravel={trip.daysTravel}
                daysRiding={trip.daysRiding}
                month={trip.month}
                year={trip.year}
                startDay={confirmedStartDay}
                travelerCount={confirmedParticipants.length || 4}
              />
            </div>
          )}

          {/* Inline Add Expense Form */}
          {showExpenseForm && (
            <form onSubmit={handleAddExpense} className="bg-gray-100 rounded p-4 mb-4 border border-gray-300">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <select
                  value={expenseForm.paidById}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paidById: e.target.value })}
                  className="bg-white border border-gray-200 rounded px-3 py-2 text-gray-900 text-sm"
                  required
                >
                  <option value="">Paid by...</option>
                  {confirmedParticipants.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName}</option>
                  ))}
                </select>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="bg-white border border-gray-200 rounded px-3 py-2 text-gray-900 text-sm"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Vendor *"
                  value={expenseForm.vendor}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                  className="bg-white border border-gray-200 rounded px-3 py-2 text-gray-900 text-sm"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount *"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="bg-white border border-gray-200 rounded px-3 py-2 text-gray-900 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <input
                  type="number"
                  min="1"
                  placeholder="Day #"
                  value={expenseForm.day}
                  onChange={(e) => setExpenseForm({ ...expenseForm, day: e.target.value })}
                  className="bg-white border border-gray-200 rounded px-3 py-2 text-gray-900 text-sm"
                />
                <input
                  type="date"
                  value={expenseForm.date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  className="bg-white border border-gray-200 rounded px-3 py-2 text-gray-900 text-sm"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="bg-white border border-gray-200 rounded px-3 py-2 text-gray-900 text-sm col-span-2"
                />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-500">Split with:</span>
                {confirmedParticipants.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleSplitWith(p.id)}
                    className={`px-2 py-1 rounded text-xs ${
                      expenseForm.splitWith.includes(p.id)
                        ? 'bg-blue-600 text-gray-900'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {p.firstName}
                  </button>
                ))}
                {expenseForm.splitWith.length > 0 && expenseForm.amount && (
                  <span className="text-xs text-green-400 ml-2">
                    = ${(parseFloat(expenseForm.amount) / expenseForm.splitWith.length).toFixed(2)}/person
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={savingExpense}
                className="bg-green-600 text-gray-900 rounded px-4 py-2 text-sm hover:bg-green-500 disabled:opacity-50"
              >
                {savingExpense ? 'Adding...' : 'Add to Itinerary'}
              </button>
            </form>
          )}

          {/* Itinerary Table */}
          {trip.expenses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-500">
                    <th className="text-left py-2 px-2">Day</th>
                    <th className="text-left py-2 px-2">Category</th>
                    <th className="text-left py-2 px-2">Vendor</th>
                    <th className="text-left py-2 px-2">Note</th>
                    <th className="text-right py-2 px-2">Cost</th>
                    <th className="text-left py-2 px-2">Split</th>
                    <th className="text-right py-2 px-2">Per Person</th>
                  </tr>
                </thead>
                <tbody>
                  {trip.expenses
                    .sort((a, b) => (a.day || 99) - (b.day || 99))
                    .map(expense => {
                      const cat = CATEGORIES.find(c => c.value === expense.category);
                      return (
                        <tr key={expense.id} className="border-b border-gray-200 hover:bg-gray-100/50">
                          <td className="py-2 px-2">{expense.day || '-'}</td>
                          <td className="py-2 px-2">
                            <span className="mr-1">{cat?.icon}</span>
                            {cat?.label || expense.category}
                          </td>
                          <td className="py-2 px-2 font-medium">{expense.vendor}</td>
                          <td className="py-2 px-2 text-gray-500 max-w-xs truncate">{expense.description || '-'}</td>
                          <td className="py-2 px-2 text-right font-medium">${parseFloat(expense.amount).toFixed(2)}</td>
                          <td className="py-2 px-2 text-xs">
                            {expense.isShared
                              ? expense.splits.map(s => s.participant.firstName).join(', ')
                              : `${expense.paidBy.firstName} (solo)`}
                          </td>
                          <td className="py-2 px-2 text-right text-green-400">
                            ${expense.perPerson ? parseFloat(expense.perPerson).toFixed(2) : parseFloat(expense.amount).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={4} className="py-3 px-2 font-semibold">Total</td>
                    <td className="py-3 px-2 text-right font-bold text-lg">${totalExpenses.toFixed(2)}</td>
                    <td></td>
                    <td className="py-3 px-2 text-right text-green-400 font-medium">
                      ${confirmedParticipants.length > 0
                        ? (totalExpenses / confirmedParticipants.length).toFixed(2)
                        : '0.00'}/avg
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">🗓️</div>
              <p>No expenses yet. Start building your trip budget!</p>
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION 6: CATEGORY SUMMARY */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {trip.expenses.length > 0 && (
          <section className="bg-white rounded-lg p-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">📊 Budget by Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {CATEGORIES.map(cat => {
                const catExpenses = trip.expenses.filter(e => e.category === cat.value);
                const catTotal = catExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                if (catTotal === 0) return null;
                return (
                  <div key={cat.value} className="bg-gray-100 rounded p-3">
                    <div className="text-2xl mb-1">{cat.icon}</div>
                    <div className="text-xs text-gray-500">{cat.label}</div>
                    <div className="font-bold">${catTotal.toFixed(2)}</div>
                    <div className="text-xs text-gray-400">{catExpenses.length} items</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
