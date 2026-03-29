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
import { coaCodeToLabel } from '@/lib/travelCOA';
import { buildCalendarSourceConfig, getDiningCategoryKeys } from '@/lib/travelCategories';
import 'leaflet/dist/leaflet.css';

// Calendar source config derived from category registry
const TRIP_SOURCE_CONFIG: Record<string, SourceConfig> = buildCalendarSourceConfig();

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

function formatTime12h(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h)) return time;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
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
  const [vendorOptions, setVendorOptions] = useState<Record<string, { category?: string; imageUrl?: string; title?: string }>>({});
  const [scannerResults, setScannerResults] = useState<any[]>([]);
  const [viatorCategoryFilter, setViatorCategoryFilter] = useState<string | null>(null);
  const [viatorDestFilter, setViatorDestFilter] = useState<string | null>(null);
  const [viatorCommitKey, setViatorCommitKey] = useState<string | null>(null);
  const [viatorCommitDate, setViatorCommitDate] = useState('');
  const [viatorCommitStartTime, setViatorCommitStartTime] = useState('10:00');
  const [viatorCommitEndTime, setViatorCommitEndTime] = useState('12:00');
  const [viatorCommitPrice, setViatorCommitPrice] = useState('');
  const [viatorCommitting, setViatorCommitting] = useState(false);
  const [confirmedStartDay, setConfirmedStartDay] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Flight booking state
  const [originAirport, setOriginAirport] = useState("");
  const [destinationAirport, setDestinationAirport] = useState("");

  // TODO: onBudgetChange/tripBudget is legacy — budget now flows through vendor-commit only
  const [tripBudget, setTripBudget] = useState<{category: string; amount: number; description: string; splitType?: string}[]>([]);
  const [committedBudgetItems, setCommittedBudgetItems] = useState<{category: string; amount: number; description: string; location?: string | null; vote?: 'up' | 'down' | null}[]>([]);
  const [initialCosts, setInitialCosts] = useState<Record<string, Record<string, number>>>({});

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [budgetSort, setBudgetSort] = useState<{ col: 'category' | 'item' | 'amount'; dir: 'asc' | 'desc' }>({ col: 'category', dir: 'asc' });
  const [expenseForm, setExpenseForm] = useState({
    paidById: '', day: '', category: 'meals', vendor: '', description: '',
    amount: '', date: new Date().toISOString().split('T')[0], location: '', splitWith: [] as string[]
  });
  const [savingExpense, setSavingExpense] = useState(false);
  const [userTier, setUserTier] = useState<string>('free');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Calendar event popover
  const [popoverEvent, setPopoverEvent] = useState<(CalendarEvent & Record<string, any>) | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const handleEventClick = (event: CalendarEvent, mouseEvent?: MouseEvent) => {
    // Position popover near the click position
    if (mouseEvent) {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const top = mouseEvent.clientY + scrollY + 8;
      const left = Math.min(window.innerWidth - 340, Math.max(16, mouseEvent.clientX - 160));
      setPopoverPos({ top, left });
    } else {
      // Fallback: center of viewport
      setPopoverPos({ top: window.scrollY + 200, left: Math.max(16, (window.innerWidth - 320) / 2) });
    }
    setPopoverEvent(event as any);
  };

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

  useEffect(() => { loadTrip(); loadParticipants(); loadDestinations(); loadBudgetItems(); loadVendorOptions(); loadScannerResults(); fetch("/api/auth/me").then(res => res.ok ? res.json() : null).then(data => { if (data?.user?.tier) setUserTier(data.user.tier); if (data?.user?.email) setCurrentUserEmail(data.user.email); if (data?.user?.id) setCurrentUserId(data.user.id); }); }, [id]);

  // Re-resolve budget item locations when scanner results or itinerary become available
  useEffect(() => {
    if (scannerResults.length > 0 || trip?.itinerary?.length) {
      loadBudgetItems();
    }
  }, [scannerResults, trip?.itinerary]);

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

  const loadVendorOptions = async () => {
    try {
      const [actRes, lodgRes] = await Promise.all([
        fetch(`/api/trips/${id}/activities`),
        fetch(`/api/trips/${id}/lodging`),
      ]);
      const map: Record<string, { category?: string; imageUrl?: string; title?: string }> = {};
      if (actRes.ok) {
        const data = await actRes.json();
        for (const opt of (data.options || data.activities || [])) {
          map[opt.id] = { category: opt.category, imageUrl: opt.image_url || opt.imageUrl, title: opt.title };
        }
      }
      if (lodgRes.ok) {
        const data = await lodgRes.json();
        for (const opt of (data.options || data.lodging || [])) {
          map[opt.id] = { category: 'lodging', imageUrl: opt.image_url || opt.imageUrl, title: opt.title };
        }
      }
      setVendorOptions(map);
    } catch (err) { console.error('Failed to load vendor options:', err); }
  };

  const loadScannerResults = async () => {
    try {
      const res = await fetch(`/api/trips/${id}/scanner-results`);
      if (!res.ok) return;
      const data = await res.json();
      setScannerResults(data.results || []);
    } catch (err) { console.error('Failed to load scanner results:', err); }
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

      // Level 1: itinerary entry location (vendor name → location)
      const itineraryLocationMap: Record<string, string> = {};
      if (trip?.itinerary) {
        for (const entry of trip.itinerary) {
          if (entry.vendor && entry.location) {
            itineraryLocationMap[entry.vendor] = entry.location;
          }
        }
      }

      // Level 2: scanner results — item name → scan destination
      // Each scanner result has a destination (e.g., "Tokyo") and recommendations with names
      const scannerNameToDestMap: Record<string, string> = {};
      for (const sr of scannerResults) {
        const dest = sr.destination;
        if (!dest) continue;
        const recs = sr.recommendations || [];
        for (const rec of recs) {
          if (rec.name) scannerNameToDestMap[rec.name] = dest;
        }
      }

      const restoredBudget = items.map((item: any) => {
        const desc = item.description || '';
        // Try itinerary location first, then scanner destination, then nothing
        const location = itineraryLocationMap[desc]
          || scannerNameToDestMap[desc]
          || null;
        return {
          category: coaCodeToLabel(item.coaCode),
          amount: Number(item.amount),
          description: desc,
          location,
        };
      });
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

  const handleViatorCommit = async (rec: any) => {
    if (!viatorCommitDate) return;
    setViatorCommitting(true);
    try {
      // Step 1: Create activity vendor option
      const price = viatorCommitPrice ? parseFloat(viatorCommitPrice) : (rec.price || 0);
      const notes = [rec.summary, rec.bookingUrl ? `Booking: ${rec.bookingUrl}` : ''].filter(Boolean).join('\n');
      const createRes = await fetch(`/api/trips/${id}/activities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: rec._scanCategory || rec.category, title: rec.name, url: rec.bookingUrl || rec.website || null, image_url: rec.photoUrl || null, vendor: rec.name, price, is_per_person: true, notes }),
      });
      if (!createRes.ok) throw new Error('Failed to create option');
      const created = await createRes.json();
      const optionId = created.option?.id;
      if (!optionId) throw new Error('No option ID returned');

      // Step 2: Commit to itinerary
      await fetch(`/api/trips/${id}/vendor-commit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionType: 'activity', optionId, startDate: viatorCommitDate, endDate: null, startTime: viatorCommitStartTime || null, endTime: viatorCommitEndTime || null, location: rec.address || rec._scanDest || null }),
      });

      setViatorCommitKey(null);
      loadTrip(); loadBudgetItems(); loadVendorOptions(); loadScannerResults();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Commit failed');
    } finally {
      setViatorCommitting(false);
    }
  };

  const handleUncommitItem = async (vendorOptionId: string, vendorOptionType: string) => {
    if (!confirm('Remove this from your itinerary and budget?')) return;
    try {
      const res = await fetch(`/api/trips/${id}/vendor-commit`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionType: vendorOptionType, optionId: vendorOptionId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to uncommit'); }
      loadTrip(); loadBudgetItems(); loadVendorOptions(); loadScannerResults();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Uncommit failed');
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

    // Build scanner name→destination fallback for items without location
    const scannerNameToDest: Record<string, string> = {};
    for (const sr of scannerResults) {
      if (!sr.destination) continue;
      for (const rec of (sr.recommendations || [])) {
        if (rec.name) scannerNameToDest[rec.name] = sr.destination;
      }
    }
    const resolveLocation = (item: any): string | null =>
      item.location || scannerNameToDest[item.vendor] || null;

    // For flights: each itinerary entry is its own event (don't group)
    // For other types: group by vendorOptionId for multi-day bookings
    const flightItems = items.filter((item: any) => (item.vendorOptionType || item.category) === 'flight');
    const otherItems = items.filter((item: any) => (item.vendorOptionType || item.category) !== 'flight');

    // Resolve correct source key using vendorOptions category
    const resolveSource = (item: any): string => {
      const optInfo = item.vendorOptionId ? vendorOptions[item.vendorOptionId] : null;
      return optInfo?.category || item.vendorOptionType || item.category || 'activities';
    };

    // Flight events — one per entry
    const flightEvents: CalendarEvent[] = flightItems.map((item: any) => {
      const dateStr = item.homeDate ? new Date(item.homeDate).toISOString().split('T')[0] : '';
      const destDateStr = item.destDate ? new Date(item.destDate).toISOString().split('T')[0] : null;
      return {
        id: item.id,
        source: 'flights',
        title: item.vendor || 'Flight',
        icon: null,
        startDate: dateStr,
        endDate: destDateStr !== dateStr ? destDateStr : null,
        startTime: item.homeTime || null,
        endTime: item.destTime || null,
        location: resolveLocation(item),
        budgetAmount: parseFloat(item.cost || 0),
        _vendorOptionId: item.vendorOptionId,
        _vendorOptionType: item.vendorOptionType,
        _vendor: item.vendor,
        _note: item.note,
        _homeTime: item.homeTime,
        _destTime: item.destTime,
        _location: resolveLocation(item),
        _category: 'flights',
      } as CalendarEvent & Record<string, any>;
    });

    // Other events — group by vendorOptionId for multi-day
    const grouped: Record<string, any[]> = {};
    otherItems.forEach((item: any) => {
      const key = item.vendorOptionId || item.id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const otherEvents: (CalendarEvent & Record<string, any>)[] = [];

    for (const [key, entries] of Object.entries(grouped)) {
      const first = entries[0];
      const source = resolveSource(first);
      const totalCost = entries.reduce((s: number, e: any) => s + parseFloat(e.cost || 0), 0);
      const vendorName = first.vendor || 'Untitled';
      const isLodging = source === 'lodging' || source === 'accommodation';

      if (isLodging) {
        const sortedEntries = [...entries].sort((a, b) =>
          new Date(a.homeDate).getTime() - new Date(b.homeDate).getTime()
        );
        const firstDate = new Date(sortedEntries[0].homeDate).toISOString().split('T')[0];
        const lastDate = sortedEntries.length > 1
          ? new Date(sortedEntries[sortedEntries.length - 1].homeDate).toISOString().split('T')[0]
          : null;
        otherEvents.push({
          id: key,
          source,
          title: vendorName,
          icon: null,
          startDate: firstDate,
          endDate: lastDate,
          startTime: null,
          endTime: null,
          location: resolveLocation(first),
          budgetAmount: totalCost,
          _vendorOptionId: first.vendorOptionId,
          _vendorOptionType: first.vendorOptionType,
          _vendor: vendorName,
          _location: resolveLocation(first),
          _category: source,
        } as any);
      } else {
        const dateStr = first.homeDate ? new Date(first.homeDate).toISOString().split('T')[0] : '';
        otherEvents.push({
          id: key,
          source,
          title: vendorName,
          icon: null,
          startDate: dateStr,
          endDate: entries.length > 1 && entries[entries.length - 1].homeDate
            ? new Date(entries[entries.length - 1].homeDate).toISOString().split('T')[0]
            : null,
          startTime: first.homeTime || null,
          endTime: first.destTime || null,
          location: resolveLocation(first),
          budgetAmount: totalCost,
          _vendorOptionId: first.vendorOptionId,
          _vendorOptionType: first.vendorOptionType,
          _vendor: first.vendor,
          _note: first.note,
          _homeTime: first.homeTime,
          _destTime: first.destTime,
          _location: resolveLocation(first),
          _category: source,
        } as any);
      }
    }

    return [...flightEvents, ...otherEvents];
  }, [trip, vendorOptions, scannerResults]);

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

            {/* ── Map + Committed Rows (grouped by destination) ── */}
            {(() => {
              const itinerary = trip.itinerary || [];
              const DINING_CATEGORIES = getDiningCategoryKeys();

              // Build scanner name→destination map
              const scannerNameToDest: Record<string, string> = {};
              for (const sr of scannerResults) {
                if (!sr.destination) continue;
                for (const rec of (sr.recommendations || [])) {
                  if (rec.name) scannerNameToDest[rec.name] = sr.destination;
                }
              }

              const resolveDestination = (item: any): string =>
                item.location || scannerNameToDest[item.vendor] || 'Other';

              const resolveCategoryLabel = (item: any): string => {
                const cat = item.resolvedCategory || item.vendorOptionType || item.category || '';
                if (cat === 'lodging' || cat === 'accommodation') return 'Lodging';
                if (DINING_CATEGORIES.has(cat)) return 'Dining';
                if (cat === 'flight') return 'Flight';
                return 'Activity';
              };

              const CATEGORY_SORT_ORDER: Record<string, number> = { 'Lodging': 0, 'Dining': 1, 'Activity': 2, 'Flight': 3 };
              const CATEGORY_BADGE_COLORS: Record<string, string> = {
                'Lodging': 'bg-blue-100 text-blue-700',
                'Dining': 'bg-amber-100 text-amber-700',
                'Activity': 'bg-violet-100 text-violet-700',
                'Flight': 'bg-purple-100 text-purple-700',
              };

              const resolvedItems = itinerary
                .filter((item: any) => (item.vendorOptionType || item.category) !== 'flight')
                .map((item: any) => {
                  const optInfo = item.vendorOptionId ? vendorOptions[item.vendorOptionId] : null;
                  return {
                    ...item,
                    resolvedCategory: optInfo?.category || item.vendorOptionType || item.category || '',
                    imageUrl: optInfo?.imageUrl || null,
                    _destination: resolveDestination(item),
                    _categoryLabel: '',
                  };
                });

              // Set category labels
              for (const item of resolvedItems) {
                item._categoryLabel = resolveCategoryLabel(item);
              }

              // Deduplicate multi-day items (lodging etc.) by vendorOptionId
              const deduped: Record<string, any> = {};
              for (const item of resolvedItems) {
                const key = item.vendorOptionId || item.id;
                if (!deduped[key]) {
                  deduped[key] = { ...item, nightCount: 1, _firstDate: item.homeDate, _lastDate: item.homeDate };
                } else {
                  deduped[key].nightCount++;
                  if (item.homeDate && new Date(item.homeDate) > new Date(deduped[key]._lastDate)) deduped[key]._lastDate = item.homeDate;
                  if (item.homeDate && new Date(item.homeDate) < new Date(deduped[key]._firstDate)) deduped[key]._firstDate = item.homeDate;
                }
              }
              const allItems = Object.values(deduped).map((item: any) => {
                if (item._firstDate && item._lastDate) {
                  const nights = Math.round((new Date(item._lastDate).getTime() - new Date(item._firstDate).getTime()) / (1000 * 60 * 60 * 24));
                  item.nightCount = Math.max(nights, 1);
                }
                return item;
              });

              // Group by destination
              const byDestination: Record<string, any[]> = {};
              for (const item of allItems) {
                const dest = item._destination;
                if (!byDestination[dest]) byDestination[dest] = [];
                byDestination[dest].push(item);
              }
              // Sort items within each destination: lodging → dining → activities
              for (const items of Object.values(byDestination)) {
                items.sort((a: any, b: any) => (CATEGORY_SORT_ORDER[a._categoryLabel] ?? 9) - (CATEGORY_SORT_ORDER[b._categoryLabel] ?? 9));
              }
              // Sort destinations: named first (alphabetical), "Other" last
              const destEntries = Object.entries(byDestination).sort(([a], [b]) => {
                if (a === 'Other') return 1;
                if (b === 'Other') return -1;
                return a.localeCompare(b);
              });

              return (
                <>
                  {/* Full-width Map */}
                  <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
                    <DestinationMap
                      destinations={destinations}
                      selectedName={trip.destination}
                      onDestinationClick={(resortId: string, name: string) => selectDestination(resortId, name)}
                      height="400px"
                    />
                  </div>

                  {/* ── Itinerary Calendar (primary view — first after map) ── */}
                  <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
                    <div className="bg-brand-purple/80 text-white px-4 py-2.5 flex items-center justify-between">
                      <h2 className="text-sm font-semibold">Itinerary</h2>
                    </div>
                    {calendarEvents.length > 0 || tripDates ? (
                      <div className="p-4">
                        <CalendarGrid
                          events={calendarEvents}
                          sourceConfig={TRIP_SOURCE_CONFIG}
                          defaultView="week"
                          anchorDate={tripDates?.departure || trip.startDate?.split('T')[0] || undefined}
                          highlightStart={tripDates?.departure || trip.startDate?.split('T')[0] || undefined}
                          highlightEnd={tripDates?.return || trip.endDate?.split('T')[0] || undefined}
                          onEventClick={handleEventClick}
                          showBudgetTotals={true}
                          showCategoryLegend={true}
                          compact={true}
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center text-gray-400">
                        <p className="text-sm mb-2">Commit vendors to see itinerary calendar</p>
                        <p className="text-xs">Select dates and destination first, then commit lodging, flights, etc.</p>
                      </div>
                    )}
                  </div>

                  {/* ── Committed items by destination ── */}
                  {destEntries.length > 0 ? destEntries.map(([dest, items]) => (
                    <div key={dest} className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
                      <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">{dest} <span className="font-normal opacity-70">({items.length})</span></div>
                      <div className="overflow-x-auto bg-white p-3" style={{ scrollSnapType: 'x mandatory' }}>
                        <div className="flex gap-3">
                          {items.map((item: any, idx: number) => (
                            <div key={item.vendorOptionId || idx} className="w-[240px] flex-shrink-0 border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow" style={{ scrollSnapAlign: 'start' }}>
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.vendor || ''} className="w-full h-[120px] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                              ) : null}
                              <div className={`w-full h-[120px] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center ${item.imageUrl ? 'hidden' : ''}`}>
                                <span className="text-sm font-medium text-gray-400">{item._categoryLabel.toUpperCase()}</span>
                              </div>
                              <div className="p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded ${CATEGORY_BADGE_COLORS[item._categoryLabel] || 'bg-gray-100 text-gray-600'}`}>
                                    {item._categoryLabel}
                                  </span>
                                </div>
                                <div className="font-medium text-xs text-gray-900 truncate">{item.vendor || 'Untitled'}</div>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                                  {item.cost && <span className="font-semibold text-emerald-700">${parseFloat(item.cost).toFixed(0)}</span>}
                                  {item.nightCount > 1 && <span>{item.nightCount} nights</span>}
                                </div>
                                {item.homeDate && (
                                  <div className="text-[10px] text-gray-400 mt-1">
                                    {new Date(item.homeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    {item.nightCount > 1 && ' onwards'}
                                  </div>
                                )}
                                <div className="mt-1.5 flex items-center gap-2">
                                  <span className="px-1.5 py-0.5 text-[9px] font-medium bg-emerald-100 text-emerald-700 rounded">Committed</span>
                                  {item.vendorOptionId && (
                                    <button onClick={() => handleUncommitItem(item.vendorOptionId, item.vendorOptionType || item.resolvedCategory || 'activity')}
                                      className="text-[9px] text-red-400 hover:text-red-600">Uncommit</button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
                      <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">Committed Items</div>
                      <div className="bg-white text-center py-6 text-gray-400">
                        <p className="text-xs">No items committed yet. Scan destinations to find places.</p>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* ── Committed Budget ── */}
            {committedBudgetItems.length > 0 && (() => {
              const toggleSort = (col: 'category' | 'item' | 'amount') => {
                setBudgetSort(prev => ({
                  col,
                  dir: prev.col === col && prev.dir === 'asc' ? 'desc' : 'asc',
                }));
              };
              const arrow = (col: string) => budgetSort.col === col ? (budgetSort.dir === 'asc' ? ' ↑' : ' ↓') : '';
              const sorted = [...committedBudgetItems].sort((a, b) => {
                const dir = budgetSort.dir === 'asc' ? 1 : -1;
                if (budgetSort.col === 'category') return a.category.localeCompare(b.category) * dir;
                if (budgetSort.col === 'item') return (a.description || a.category).localeCompare(b.description || b.category) * dir;
                return (a.amount - b.amount) * dir;
              });
              let lastCategory = '';

              return (
                <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
                  <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">Committed Budget</div>
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th onClick={() => toggleSort('category')} className="px-3 py-2 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none">Category{arrow('category')}</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Country</th>
                          <th onClick={() => toggleSort('item')} className="px-3 py-2 text-left font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none">Item{arrow('item')}</th>
                          <th onClick={() => toggleSort('amount')} className="px-3 py-2 text-right font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none">Amount{arrow('amount')}</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-500 w-16">Vote</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sorted.map((item, idx) => {
                          const showCategory = item.category !== lastCategory;
                          lastCategory = item.category;
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-500">{showCategory ? item.category : ''}</td>
                              <td className="px-3 py-2 text-gray-400 text-[11px]">{item.location || '—'}</td>
                              <td className="px-3 py-2 font-medium text-gray-900">{item.description || item.category}</td>
                              <td className="px-3 py-2 text-right font-semibold text-emerald-700">{fmt(item.amount)}</td>
                              <td className="px-3 py-2 text-center">
                                <button onClick={() => {
                                  setCommittedBudgetItems(prev => prev.map((b, i) => i === idx ? { ...b, vote: b.vote === 'up' ? null : 'up' } : b));
                                }} className={`text-sm mr-1 ${item.vote === 'up' ? 'text-emerald-600' : 'text-gray-300 hover:text-gray-500'}`}>+</button>
                                <button onClick={() => {
                                  setCommittedBudgetItems(prev => prev.map((b, i) => i === idx ? { ...b, vote: b.vote === 'down' ? null : 'down' } : b));
                                }} className={`text-sm ${item.vote === 'down' ? 'text-red-500' : 'text-gray-300 hover:text-gray-500'}`}>-</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 font-semibold text-gray-900">Total</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmt(totalBudget)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* ── Add Expense (inline) ── */}
            {showExpenseForm && (
              <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
                <div className="bg-brand-purple/80 text-white px-4 py-2.5 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Add Expense</h2>
                  <button onClick={() => setShowExpenseForm(false)} className="px-3 py-1 text-xs bg-white/20 hover:bg-white/30 text-white rounded font-medium">Cancel</button>
                </div>
                <form onSubmit={handleAddExpense} className="p-4 bg-gray-50">
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
              </div>
            )}

            {/* ── Crew & Profiles ── */}
            <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
              <div className="bg-brand-purple/80 text-white px-4 py-2.5 flex justify-between items-center">
                <h2 className="text-sm font-semibold">Crew ({participants.length})</h2>
                <span className="text-xs opacity-70">
                  {participants.filter(p => !!p.profileTripType).length} of {participants.length} profiles complete
                </span>
              </div>
              <div className="bg-white p-4">
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
            </div>

            {/* ── Flights ── */}
            {tripDates && trip.destination && (
              <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
                <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">Flights</div>
                <div className="bg-white p-4">
                <FlightPicker
                  tripId={id}
                  destinationName={trip.destination}
                  destinationAirport={destinationAirport}
                  originAirport={originAirport}
                  departureDate={tripDates.departure}
                  returnDate={tripDates.return}
                  passengers={confirmedParticipants.length || 1}
                  onCommitted={() => { loadTrip(); loadBudgetItems(); loadVendorOptions(); loadScannerResults(); }}
                />
                </div>
              </div>
            )}

            {/* ── Bookable Experiences (Viator) ── */}
            {(() => {
              const VIATOR_CATS = new Set(['sports_fitness', 'arts_culture', 'nightlife', 'festivals', 'wellness', 'bucket_list', 'ground_transport']);
              const viatorResults = scannerResults.filter((r: any) => VIATOR_CATS.has(r.category));
              const allRecs = viatorResults.flatMap((r: any) => (r.recommendations || []).map((rec: any) => ({ ...rec, _scanCategory: r.category, _scanDest: r.destination })));
              const viatorCats = [...new Set(viatorResults.map((r: any) => r.category))];
              const viatorDests = [...new Set(viatorResults.map((r: any) => r.destination).filter(Boolean))];
              let filteredRecs = allRecs;
              if (viatorDestFilter) filteredRecs = filteredRecs.filter((r: any) => r._scanDest === viatorDestFilter);
              if (viatorCategoryFilter) filteredRecs = filteredRecs.filter((r: any) => r._scanCategory === viatorCategoryFilter);
              const COA_LABELS: Record<string, string> = { sports_fitness: 'Sports & Fitness', arts_culture: 'Arts & Culture', nightlife: 'Nightlife', festivals: 'Festivals', wellness: 'Wellness', bucket_list: 'Bucket List', ground_transport: 'Transport' };

              const fmtDuration = (mins: number) => mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;

              return (
                <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
                  <div className="bg-brand-purple/80 text-white px-4 py-2.5 flex items-center justify-between">
                    <h2 className="text-sm font-semibold tracking-wide">Bookable Experiences</h2>
                    <span className="text-[10px] opacity-60">via Viator</span>
                  </div>
                  <div className="bg-white rounded-b-lg">
                    {viatorCats.length > 0 ? (
                      <>
                        {/* Destination filter */}
                        {viatorDests.length > 1 && (
                          <div className="px-4 pt-3 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 mr-1">Scan:</span>
                            {viatorDests.map(dest => {
                              const label = dest.split(',')[0].trim();
                              return (
                                <button key={dest} onClick={() => setViatorDestFilter(viatorDestFilter === dest ? null : dest)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${viatorDestFilter === dest ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {/* Category filter */}
                        <div className="px-4 pt-2 pb-2 flex flex-wrap gap-1.5">
                          <button onClick={() => setViatorCategoryFilter(null)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${!viatorCategoryFilter ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            All ({filteredRecs.length})
                          </button>
                          {viatorCats.map(cat => (
                            <button key={cat} onClick={() => setViatorCategoryFilter(viatorCategoryFilter === cat ? null : cat)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${viatorCategoryFilter === cat ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                              {COA_LABELS[cat] || cat}
                            </button>
                          ))}
                        </div>
                        {/* Cards */}
                        <div className="overflow-x-auto px-4 pb-4" style={{ scrollSnapType: 'x mandatory' }}>
                          <div className="flex gap-3">
                            {filteredRecs.slice(0, 50).map((rec: any, idx: number) => {
                              const destCity = rec._scanDest ? rec._scanDest.split(',')[0].trim() : '';
                              return (
                                <div key={rec.viatorProductCode || idx} className="w-[240px] flex-shrink-0 border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white" style={{ scrollSnapAlign: 'start' }}>
                                  {rec.photoUrl ? (
                                    <img src={rec.photoUrl} alt={rec.name || ''} className="w-full h-[140px] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                                  ) : null}
                                  <div className={`w-full h-[140px] bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center ${rec.photoUrl ? 'hidden' : ''}`}>
                                    <span className="text-sm font-medium text-purple-300">EXPERIENCE</span>
                                  </div>
                                  <div className="p-3 space-y-1.5">
                                    <div className="font-medium text-xs text-gray-900 line-clamp-2 leading-snug">{rec.name}</div>
                                    <div className="text-[11px] font-semibold text-emerald-700">
                                      {rec.price != null ? `From $${rec.price}/person` : 'See pricing'}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                      {rec.durationMinutes != null && <span>{fmtDuration(rec.durationMinutes)}</span>}
                                      {rec.durationMinutes != null && destCity && <span>·</span>}
                                      {destCity && <span>{destCity}</span>}
                                    </div>
                                    <div className="text-[11px] text-gray-500">
                                      {rec.googleRating} ({rec.reviewCount})
                                    </div>
                                    {viatorCommitKey === (rec.viatorProductCode || rec.name) ? (
                                      <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
                                        <input type="date" value={viatorCommitDate}
                                          min={tripDates?.departure || ''} max={tripDates?.return || ''}
                                          onChange={e => setViatorCommitDate(e.target.value)}
                                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                                        <div className="grid grid-cols-2 gap-1">
                                          <input type="time" value={viatorCommitStartTime} onChange={e => setViatorCommitStartTime(e.target.value)}
                                            className="border border-gray-200 rounded px-2 py-1 text-xs" />
                                          <input type="time" value={viatorCommitEndTime} onChange={e => setViatorCommitEndTime(e.target.value)}
                                            className="border border-gray-200 rounded px-2 py-1 text-xs" />
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs text-gray-500">$</span>
                                          <input type="number" step="0.01" min="0" placeholder="0.00" value={viatorCommitPrice}
                                            onChange={e => setViatorCommitPrice(e.target.value)}
                                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs font-mono" />
                                        </div>
                                        <div className="flex gap-1">
                                          <button onClick={() => handleViatorCommit(rec)} disabled={!viatorCommitDate || viatorCommitting}
                                            className="flex-1 px-2 py-1.5 bg-brand-gold hover:bg-brand-gold-bright text-white text-xs font-medium rounded disabled:opacity-50">
                                            {viatorCommitting ? '...' : 'Confirm'}
                                          </button>
                                          <button onClick={() => setViatorCommitKey(null)}
                                            className="px-2 py-1.5 text-xs border border-gray-200 rounded">Cancel</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="flex gap-1.5 mt-2">
                                          <button onClick={() => { setViatorCommitKey(rec.viatorProductCode || rec.name); setViatorCommitDate(tripDates?.departure || ''); setViatorCommitPrice(rec.price ? String(rec.price) : ''); }}
                                            className="flex-1 text-center px-2 py-1.5 bg-brand-gold hover:bg-brand-gold-bright text-white text-xs font-medium rounded">
                                            Commit
                                          </button>
                                          <a href={rec.bookingUrl || rec.website || '#'} target="_blank" rel="noopener noreferrer"
                                            className="flex-1 text-center px-2 py-1.5 border border-brand-gold text-brand-gold hover:bg-brand-gold/5 text-xs font-medium rounded">
                                            View
                                          </a>
                                        </div>
                                        <a href={rec.bookingUrl || rec.website || '#'} target="_blank" rel="noopener noreferrer"
                                          className="block text-center w-full px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded mt-1.5">
                                          Book on Viator
                                        </a>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <p className="text-xs">Scan a destination in Trip Planner below to find bookable experiences.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Trip Planner & Budget (with integrated destination selector) ── */}
            <div id="trip-planner-section" className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
              <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">Trip Planner &amp; Budget</div>
              <div className="bg-white p-4">
              {/* Destination pills — select scan target */}
              {destinations.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="text-xs text-gray-500">Scan:</span>
                  {destinations.map((d: any) => {
                    const name = d.name || d.resort?.name || '';
                    const isActive = name === trip.destination;
                    return (
                      <button key={d.id} type="button" onClick={() => selectDestination(d.resortId, name)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {name}
                      </button>
                    );
                  })}
                  <DestinationSelector
                    activity={trip.activity}
                    tripId={id}
                    selectedDestinations={destinations}
                    onDestinationsChange={loadDestinations}
                    selectedDestinationId={destinations.find((d: any) => d.resort?.name === trip.destination)?.resortId}
                    onSelectDestination={selectDestination}
                    compact
                  />
                </div>
              )}
              {destinations.length === 0 && (
                <div className="mb-4">
                  <DestinationSelector
                    activity={trip.activity}
                    tripId={id}
                    selectedDestinations={destinations}
                    onDestinationsChange={loadDestinations}
                    selectedDestinationId={undefined}
                    onSelectDestination={selectDestination}
                  />
                </div>
              )}
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
                    onCommitted={() => { loadTrip(); loadBudgetItems(); loadVendorOptions(); loadScannerResults(); }}
                  />
                )
              );
              })()}
              </div>
            </div>

            {/* ── Commit to Ledger ── */}
            <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
              <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">Commit to Ledger</div>
              <div className="bg-white p-4">
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
            </div>

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

          {/* ── Event Detail Popover ── */}
          {popoverEvent && (
            <div className="fixed inset-0 z-50" onClick={() => setPopoverEvent(null)}>
              <div
                className="absolute bg-white rounded-lg shadow-xl border border-gray-200 w-[320px] p-4"
                style={{ top: popoverPos?.top || 100, left: popoverPos?.left || 100 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={() => setPopoverEvent(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
                <div className="space-y-2">
                  <div className="font-semibold text-sm text-gray-900 pr-6">{(popoverEvent as any)._vendor || popoverEvent.title}</div>
                  {popoverEvent.startDate && (
                    <div className="text-xs text-gray-500">
                      {new Date(popoverEvent.startDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  )}
                  {(popoverEvent.startTime || popoverEvent.endTime) && (
                    <div className="text-xs text-gray-600">
                      {popoverEvent.startTime ? formatTime12h(popoverEvent.startTime) : ''}
                      {popoverEvent.startTime && popoverEvent.endTime ? ' — ' : ''}
                      {popoverEvent.endTime ? formatTime12h(popoverEvent.endTime) : ''}
                    </div>
                  )}
                  {(popoverEvent.location || (popoverEvent as any)._location) && (
                    <div className="text-xs text-gray-500">{popoverEvent.location || (popoverEvent as any)._location}</div>
                  )}
                  {popoverEvent.budgetAmount != null && popoverEvent.budgetAmount > 0 && (
                    <div className="text-xs font-semibold text-emerald-700">{fmt(popoverEvent.budgetAmount)}</div>
                  )}
                  {(popoverEvent as any)._category && (
                    <div className="text-xs text-gray-400">Category: {(popoverEvent as any)._category}</div>
                  )}
                  {(popoverEvent as any)._note && (
                    <div className="text-xs text-gray-400 line-clamp-2">{(popoverEvent as any)._note}</div>
                  )}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    {(popoverEvent as any)._vendorOptionId && (
                      <button
                        onClick={() => {
                          const evt = popoverEvent as any;
                          handleUncommitItem(evt._vendorOptionId, evt._vendorOptionType || 'activity');
                          setPopoverEvent(null);
                        }}
                        className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 font-medium"
                      >
                        Uncommit
                      </button>
                    )}
                    {(popoverEvent.location || (popoverEvent as any)._location) && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((popoverEvent as any)._vendor || popoverEvent.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs text-brand-purple border border-brand-purple/30 rounded hover:bg-brand-purple/5 font-medium"
                      >
                        View on Map
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
