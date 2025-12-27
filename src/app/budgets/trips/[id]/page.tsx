'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';

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
  participants: Participant[];
  expenses: Expense[];
}

interface DateWindow {
  startDay: number;
  endDay: number;
  availableCount: number;
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const ACTIVITIES: Record<string, string> = {
  surf: '🏄 Surf',
  kitesurf: '🪁 Kite Surf',
  sail: '⛵ Sail',
  snowboard: '🏂 Snowboard'
};

const CATEGORIES = [
  { value: 'flight', label: 'Flight', icon: '✈️' },
  { value: 'lodging', label: 'Lodging', icon: '🏨' },
  { value: 'meals', label: 'Meals', icon: '🍽️' },
  { value: 'transport', label: 'Transport', icon: '🚗' },
  { value: 'activities', label: 'Activities', icon: '🎿' },
  { value: 'gear', label: 'Gear Rental', icon: '🏂' },
  { value: 'other', label: 'Other', icon: '📦' }
];

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const [confirmedStartDay, setConfirmedStartDay] = useState<number | null>(null);

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    paidById: '',
    day: '',
    category: 'meals',
    vendor: '',
    description: '',
    amount: '',
    splitWith: [] as string[]
  });
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => {
    loadTrip();
    loadParticipants();
  }, [id]);

  const loadTrip = async () => {
    try {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error('Failed to load trip');
      const data = await res.json();
      setTrip(data.trip);
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

  const copyInviteLink = () => {
    if (trip?.inviteToken) {
      const url = `${window.location.origin}/trips/rsvp?token=${trip.inviteToken}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const dateWindows = useMemo(() => {
    if (!trip) return [];
    
    const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
    const confirmed = participants.filter(p => p.rsvpStatus === 'confirmed');
    if (confirmed.length === 0) return [];

    const windows: DateWindow[] = [];

    for (let startDay = 1; startDay <= daysInMonth - trip.daysTravel + 1; startDay++) {
      const tripDays = Array.from({ length: trip.daysTravel }, (_, i) => startDay + i);
      const allAvailable = confirmed.every(p => {
        const blackout = p.unavailableDays || [];
        return !tripDays.some(d => blackout.includes(d));
      });

      if (allAvailable) {
        windows.push({ startDay, endDay: startDay + trip.daysTravel - 1, availableCount: confirmed.length });
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
      setExpenseForm({ paidById: '', day: '', category: 'meals', vendor: '', description: '', amount: '', splitWith: [] });
      loadTrip();
    } catch (err) {
      alert('Failed to add expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const toggleSplitWith = (pid: string) => {
    setExpenseForm(prev => ({
      ...prev,
      splitWith: prev.splitWith.includes(pid)
        ? prev.splitWith.filter(p => p !== pid)
        : [...prev.splitWith, pid]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading trip...</div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error || 'Trip not found'}</div>
      </div>
    );
  }

  const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const confirmed = participants.filter(p => p.rsvpStatus === 'confirmed');
  const totalExpenses = trip.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#b4b237] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">TS</span>
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold text-gray-900">{trip.name}</div>
              <div className="text-xs text-gray-400">
                {trip.destination || 'TBD'} {trip.activity && `• ${ACTIVITIES[trip.activity]}`}
              </div>
            </div>
          </div>
          <button 
            onClick={() => router.push('/budgets/trips')}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← All Trips
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Trip Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{trip.name}</h1>
              <p className="text-gray-500">
                {trip.destination || 'Destination TBD'} • {MONTHS[trip.month]} {trip.year} • {trip.daysTravel} days
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#b4b237]">${totalExpenses.toFixed(0)}</div>
              <div className="text-xs text-gray-400">total budget</div>
            </div>
          </div>
          
          {/* Invite Link */}
          {trip.inviteToken && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Invite Link:</span>
                <button
                  onClick={copyInviteLink}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                >
                  {copiedLink ? '✓ Copied!' : '📋 Copy Link'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Travelers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">👥 Travelers ({participants.length})</h2>
          {participants.length === 0 ? (
            <p className="text-gray-500 text-sm">Share the invite link to add travelers.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {participants.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    p.rsvpStatus === 'confirmed' ? 'bg-green-50 text-green-700' :
                    p.rsvpStatus === 'declined' ? 'bg-red-50 text-red-700' :
                    'bg-yellow-50 text-yellow-700'
                  }`}
                >
                  <span className="font-medium">{p.firstName} {p.lastName}</span>
                  {p.isOwner && <span className="text-xs opacity-60">(you)</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Availability Calendar */}
        {confirmed.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">📅 Availability — {MONTHS[trip.month]} {trip.year}</h2>
            
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-2 text-gray-400 w-24">Traveler</th>
                    {calendarDays.map(day => (
                      <th key={day} className="text-center py-2 px-0.5 text-gray-400 min-w-[24px]">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {confirmed.map(p => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-2 px-2 text-gray-700 font-medium">{p.firstName}</td>
                      {calendarDays.map(day => {
                        const blocked = (p.unavailableDays || []).includes(day);
                        return (
                          <td key={day} className="text-center py-1 px-0.5">
                            <div className={`w-5 h-5 rounded text-xs flex items-center justify-center mx-auto ${
                              blocked ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'
                            }`}>
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

            {/* Date Windows */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Valid {trip.daysTravel}-day windows:
              </h3>
              {dateWindows.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {dateWindows.slice(0, 10).map((w, idx) => (
                    <button
                      key={idx}
                      onClick={() => setConfirmedStartDay(w.startDay)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        confirmedStartDay === w.startDay
                          ? 'bg-[#b4b237] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {MONTHS[trip.month].slice(0, 3)} {w.startDay}–{w.endDay}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No dates where everyone is available.</p>
              )}
              {confirmedStartDay && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-green-700 font-medium">
                    ✓ Selected: {MONTHS[trip.month]} {confirmedStartDay}–{confirmedStartDay + trip.daysTravel - 1}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expenses */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">💰 Expenses</h2>
            <button
              onClick={() => setShowExpenseForm(!showExpenseForm)}
              className="px-3 py-1.5 text-sm bg-[#b4b237] text-white rounded-lg hover:shadow-lg transition-all"
            >
              {showExpenseForm ? 'Cancel' : '+ Add Expense'}
            </button>
          </div>

          {/* Add Expense Form */}
          {showExpenseForm && (
            <form onSubmit={handleAddExpense} className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <select
                  value={expenseForm.paidById}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paidById: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  required
                >
                  <option value="">Paid by...</option>
                  {confirmed.map(p => (
                    <option key={p.id} value={p.id}>{p.firstName}</option>
                  ))}
                </select>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Vendor"
                  value={expenseForm.vendor}
                  onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  required
                />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-500">Split with:</span>
                {confirmed.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleSplitWith(p.id)}
                    className={`px-2 py-1 rounded text-xs transition-all ${
                      expenseForm.splitWith.includes(p.id)
                        ? 'bg-[#b4b237] text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {p.firstName}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={savingExpense}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {savingExpense ? 'Adding...' : 'Add Expense'}
              </button>
            </form>
          )}

          {/* Expenses List */}
          {trip.expenses.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No expenses yet. Add your first expense above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-left py-2 px-2">Category</th>
                    <th className="text-left py-2 px-2">Vendor</th>
                    <th className="text-left py-2 px-2">Paid By</th>
                    <th className="text-right py-2 px-2">Amount</th>
                    <th className="text-right py-2 px-2">Per Person</th>
                  </tr>
                </thead>
                <tbody>
                  {trip.expenses.map(exp => {
                    const cat = CATEGORIES.find(c => c.value === exp.category);
                    return (
                      <tr key={exp.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-2">
                          <span className="mr-1">{cat?.icon}</span>
                          {cat?.label || exp.category}
                        </td>
                        <td className="py-2 px-2 font-medium text-gray-900">{exp.vendor}</td>
                        <td className="py-2 px-2 text-gray-600">{exp.paidBy.firstName}</td>
                        <td className="py-2 px-2 text-right font-medium">${parseFloat(exp.amount).toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-[#b4b237]">
                          ${exp.perPerson ? parseFloat(exp.perPerson).toFixed(2) : parseFloat(exp.amount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={3} className="py-3 px-2 font-semibold">Total</td>
                    <td className="py-3 px-2 text-right font-bold text-lg">${totalExpenses.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right text-[#b4b237] font-medium">
                      ${confirmed.length > 0 ? (totalExpenses / confirmed.length).toFixed(2) : '0.00'}/ea
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
