'use client';

import { useState, useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout, Card, Button, Badge, PageHeader } from '@/components/ui';
import DestinationSelector from '@/components/trips/DestinationSelector';
import TripBookingFlow from '@/components/trips/TripBookingFlow';
import DestinationMap from '@/components/trips/DestinationMap';
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

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    paidById: '', day: '', category: 'meals', vendor: '', description: '',
    amount: '', date: new Date().toISOString().split('T')[0], location: '', splitWith: [] as string[]
  });
  const [savingExpense, setSavingExpense] = useState(false);

  useEffect(() => { loadTrip(); loadParticipants(); loadDestinations(); }, [id]);

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
      if (res.ok) { const data = await res.json(); setParticipants(data.participants || []); }
    } catch (err) { console.error('Failed to load participants:', err); }
  };

  const loadDestinations = async () => {
    try {
      const res = await fetch(`/api/trips/${id}/destinations`);
      if (res.ok) { const data = await res.json(); setDestinations(data.destinations || []); }
    } catch (err) { console.error('Failed to load destinations:', err); }
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
    try {
      const res = await fetch(`/api/trips/${id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDay: confirmedStartDay })
      });
      if (!res.ok) throw new Error('Failed to commit trip');
      const data = await res.json();
      setTrip(prev => prev ? { ...prev, ...data.trip } : null);
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
                  <Badge variant={p.rsvpStatus === 'confirmed' ? 'success' : p.rsvpStatus === 'declined' ? 'danger' : 'warning'} size="sm">
                    {p.rsvpStatus}
                  </Badge>
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

        {/* Row 4: Itinerary & Budget */}
        <Card
          title="🗓️ Itinerary & Budget"
          action={<Button size="sm" onClick={() => setShowExpenseForm(!showExpenseForm)}>{showExpenseForm ? 'Cancel' : '+ Add Expense'}</Button>}
          noPadding
        >
          {/* Booking Flow */}
          {destinations.length > 0 && (
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-500 mb-3">Compare Costs by Destination</h3>
              <TripBookingFlow tripId={id} destinations={destinations} daysTravel={trip.daysTravel} daysRiding={trip.daysRiding}
                month={trip.month} year={trip.year} startDay={confirmedStartDay} travelerCount={confirmedParticipants.length || 4} />
            </div>
          )}

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
