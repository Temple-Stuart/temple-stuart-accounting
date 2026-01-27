'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppLayout, Card, Badge } from '@/components/ui';

import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });

import 'leaflet/dist/leaflet.css';

interface CalendarEvent {
  id: string;
  source: string;
  title: string;
  icon: string | null;
  start_date: string;
  end_date: string | null;
  is_recurring: boolean;
  location: string | null;
  budget_amount: number;
}

interface CalendarSummary {
  totalEvents: number;
  homeTotal: number;
  autoTotal: number;
  shoppingTotal: number;
  personalTotal: number;
  healthTotal: number;
  growthTotal: number;
  tripTotal: number;
  grandTotal: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SOURCE_CONFIG: Record<string, { icon: string; color: string; bgColor: string; dotColor: string; calendarColor: string }> = {
  home: { icon: '🏠', color: 'text-amber-600', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500', calendarColor: 'bg-amber-400' },
  auto: { icon: '🚗', color: 'text-slate-600', bgColor: 'bg-slate-50', dotColor: 'bg-slate-400', calendarColor: 'bg-slate-400' },
  shopping: { icon: '🛒', color: 'text-pink-600', bgColor: 'bg-pink-50', dotColor: 'bg-pink-500', calendarColor: 'bg-pink-400' },
  personal: { icon: '👤', color: 'text-violet-600', bgColor: 'bg-violet-50', dotColor: 'bg-violet-500', calendarColor: 'bg-violet-400' },
  health: { icon: '💪', color: 'text-emerald-600', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500', calendarColor: 'bg-emerald-400' },
  growth: { icon: '📚', color: 'text-blue-600', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500', calendarColor: 'bg-blue-400' },
  trip: { icon: '✈️', color: 'text-cyan-600', bgColor: 'bg-cyan-50', dotColor: 'bg-cyan-500', calendarColor: 'bg-cyan-400' },
};

// Auto-generate destination tags based on keywords
const getDestinationTag = (destination: string | null): { label: string; color: string } => {
  if (!destination) return { label: 'Adventure awaits', color: 'bg-gray-600' };
  
  const d = destination.toLowerCase();
  
  if (d.includes('hawaii') || d.includes('honolulu') || d.includes('maui') || d.includes('caribbean') || 
      d.includes('bahamas') || d.includes('cancun') || d.includes('phuket') || d.includes('bali') ||
      d.includes('fiji') || d.includes('maldives') || d.includes('tahiti')) {
    return { label: 'Tropical paradise', color: 'bg-emerald-600' };
  }
  
  if (d.includes('beach') || d.includes('coast') || d.includes('monterey') || d.includes('carmel') ||
      d.includes('laguna') || d.includes('malibu') || d.includes('santa cruz') || d.includes('san diego') ||
      d.includes('miami') || d.includes('cape') || d.includes('seaside')) {
    return { label: 'Coastal charm', color: 'bg-blue-600' };
  }
  
  if (d.includes('aspen') || d.includes('vail') || d.includes('tahoe') || d.includes('mountain') ||
      d.includes('alps') || d.includes('rockies') || d.includes('whistler') || d.includes('denver') ||
      d.includes('colorado') || d.includes('jackson hole') || d.includes('mammoth')) {
    return { label: 'Mountain retreat', color: 'bg-slate-600' };
  }
  
  if (d.includes('new york') || d.includes('nyc') || d.includes('los angeles') || d.includes('chicago') ||
      d.includes('san francisco') || d.includes('london') || d.includes('paris') || d.includes('tokyo') ||
      d.includes('vegas') || d.includes('seattle') || d.includes('austin')) {
    return { label: 'City escape', color: 'bg-violet-600' };
  }
  
  if (d.includes('spa') || d.includes('retreat') || d.includes('resort') || d.includes('napa') ||
      d.includes('wine') || d.includes('sedona') || d.includes('palm springs')) {
    return { label: 'Relaxing escape', color: 'bg-rose-600' };
  }
  
  if (d.includes('mexico') || d.includes('canada') || d.includes('europe') || d.includes('asia') ||
      d.includes('japan') || d.includes('italy') || d.includes('spain') || d.includes('france') ||
      d.includes('greece') || d.includes('portugal') || d.includes('thailand') || d.includes('vietnam')) {
    return { label: 'International adventure', color: 'bg-indigo-600' };
  }
  
  return { label: 'Adventure awaits', color: 'bg-cyan-600' };
};

const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Wall Street style variance - muted colors
const getWsVarianceClass = (budget: number, actual: number) => {
  if (actual === 0) return '';
  if (actual <= budget) return 'bg-emerald-50 text-emerald-700';
  return 'bg-red-50 text-red-700';
};

const getWsVarianceText = (budget: number, actual: number) => {
  if (actual === 0) return 'text-gray-400';
  if (actual <= budget) return 'text-emerald-700';
  return 'text-red-700';
};

export default function HubPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('week');
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek);
    return start;
  });

  const [committedTrips, setCommittedTrips] = useState<Array<{
    id: string; name: string; destination: string | null;
    latitude: number | null; longitude: number | null;
    startDate: string | null; endDate: string | null; totalBudget: number; destinationPhoto: string | null;
  }>>([]);
  
  const [yearBudget, setYearBudget] = useState<Record<number, Record<string, number>>>({});
  const [yearActual, setYearActual] = useState<Record<number, Record<string, number>>>({});
  const [travelMonths, setTravelMonths] = useState<number[]>([]);
  const [nomadBudget, setNomadBudget] = useState<{ 
    budgetData: Record<string, Record<number, number>>; 
    actualData: Record<string, Record<number, number>>;
    coaNames: Record<string, string>; 
    budgetGrandTotal: number;
    actualGrandTotal: number;
  }>({ budgetData: {}, actualData: {}, coaNames: {}, budgetGrandTotal: 0, actualGrandTotal: 0 });

  const [businessBudget, setBusinessBudget] = useState<{ 
    budgetData: Record<string, Record<number, number>>; 
    actualData: Record<string, Record<number, number>>;
    coaNames: Record<string, string>; 
    budgetGrandTotal: number;
    actualGrandTotal: number;
  }>({ budgetData: {}, actualData: {}, coaNames: {}, budgetGrandTotal: 0, actualGrandTotal: 0 });

  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({
    home: true, auto: true, shopping: true, personal: true, health: true, growth: true, trip: true,
  });

  useEffect(() => { loadCalendar(); }, [selectedYear, selectedMonth]);

  const loadCalendar = async () => {
    try {
      const res = await fetch(`/api/calendar?year=${selectedYear}&month=${selectedMonth + 1}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setSummary(data.summary || null);
      }
    } catch (err) { console.error('Failed to load calendar:', err); }
    finally { setLoading(false); }
  };

  const loadCommittedTrips = async () => {
    try {
      const res = await fetch("/api/hub/trips");
      if (res.ok) { const data = await res.json(); setCommittedTrips(data.trips || []); }
    } catch (err) { console.error("Failed to load trips:", err); }
  };

  const loadYearCalendar = async () => {
    try {
      const res = await fetch(`/api/hub/year-calendar?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setYearBudget(data.budgetData || data.monthlyData || {});
        setYearActual(data.actualData || {});
      }
    } catch (err) { console.error("Failed to load year calendar:", err); }
  };

  const loadNomadBudget = async () => {
    try {
      const res = await fetch(`/api/hub/nomad-budget?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setNomadBudget({ 
          budgetData: data.budgetData || data.monthlyData || {}, 
          actualData: data.actualData || {},
          coaNames: data.coaNames || {}, 
          budgetGrandTotal: data.budgetGrandTotal || data.grandTotal || 0,
          actualGrandTotal: data.actualGrandTotal || 0
        });
      }
    } catch (err) { console.error("Failed to load nomad budget:", err); }
  };

  const loadBusinessBudget = async () => {
    try {
      const res = await fetch(`/api/hub/business-budget?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setBusinessBudget({ 
          budgetData: data.budgetData || {}, 
          actualData: data.actualData || {},
          coaNames: data.coaNames || {}, 
          budgetGrandTotal: data.budgetGrandTotal || 0,
          actualGrandTotal: data.actualGrandTotal || 0
        });
      }
    } catch (err) { console.error("Failed to load business budget:", err); }
  };

  useEffect(() => { loadCommittedTrips(); loadYearCalendar(); loadNomadBudget(); loadBusinessBudget(); }, [selectedYear]);

  const fmt = (n: number) => n ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—';
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
  const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  events.forEach(e => {
    const eventDate = parseDate(e.start_date);
    if (eventDate.getMonth() === selectedMonth && eventDate.getFullYear() === selectedYear) {
      const day = eventDate.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    }
  });

  const prevMonth = () => { if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); } else { setSelectedMonth(selectedMonth - 1); } };
  const nextMonth = () => { if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); } else { setSelectedMonth(selectedMonth + 1); } };
  const prevWeek = () => { const newStart = new Date(selectedWeekStart); newStart.setDate(newStart.getDate() - 7); setSelectedWeekStart(newStart); setSelectedMonth(newStart.getMonth()); setSelectedYear(newStart.getFullYear()); };
  const nextWeek = () => { const newStart = new Date(selectedWeekStart); newStart.setDate(newStart.getDate() + 7); setSelectedWeekStart(newStart); setSelectedMonth(newStart.getMonth()); setSelectedYear(newStart.getFullYear()); };
  const goToToday = () => { setSelectedYear(now.getFullYear()); setSelectedMonth(now.getMonth()); const today = new Date(); const dayOfWeek = today.getDay(); const start = new Date(today); start.setDate(today.getDate() - dayOfWeek); setSelectedWeekStart(start); };

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) { calendarDays.push(null); }
  for (let day = 1; day <= daysInMonth; day++) { calendarDays.push(day); }

  const getWeekDays = () => { const days = []; for (let i = 0; i < 7; i++) { const day = new Date(selectedWeekStart); day.setDate(selectedWeekStart.getDate() + i); days.push(day); } return days; };
  const weekDays = getWeekDays();

  const getEventsForDate = (date: Date) => events.filter(e => {
    const eventDate = parseDate(e.start_date);
    return eventDate.getDate() === date.getDate() && eventDate.getMonth() === date.getMonth() && eventDate.getFullYear() === date.getFullYear() && visibleCategories[e.source];
  });

  // Calculator logic
  const homeMonths = MONTHS.map((_, i) => i).filter(i => !travelMonths.includes(i));
  const travelMonthsHomebaseBudget = travelMonths.reduce((sum, i) => sum + (yearBudget[i]?.total || 0), 0);
  const travelMonthsTravelBudget = travelMonths.reduce((sum, i) => sum + Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
  const travelSavings = travelMonthsHomebaseBudget - travelMonthsTravelBudget;
  const homeMonthsHomebaseBudget = homeMonths.reduce((sum, i) => sum + (yearBudget[i]?.total || 0), 0);
  const homeMonthsTravelBudget = homeMonths.reduce((sum, i) => sum + Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
  const homeMonthsCombined = homeMonthsHomebaseBudget + homeMonthsTravelBudget;
  const yearlyHomebaseBudget = Object.values(yearBudget).reduce((sum, m) => sum + (m.total || 0), 0);
  const yearlyHomebaseActual = Object.values(yearActual).reduce((sum, m) => sum + (m.total || 0), 0);
  const yearlyTravelBudget = nomadBudget.budgetGrandTotal;
  const yearlyTravelActual = nomadBudget.actualGrandTotal;
  const yearlyBusinessBudget = businessBudget.budgetGrandTotal;
  const yearlyBusinessActual = businessBudget.actualGrandTotal;
  const effectiveYearlyCost = homeMonthsCombined + travelMonthsTravelBudget + yearlyBusinessBudget;

  // Category name mapping for homebase
  const CATEGORY_NAMES: Record<string, string> = {
    home: 'Housing & Utilities',
    auto: 'Transportation',
    shopping: 'Shopping & Retail',
    personal: 'Personal & Lifestyle',
    health: 'Health & Fitness',
    growth: 'Education & Growth',
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#F8F9FA]">
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''} 👋
            </h1>
            <p className="text-gray-500 mt-1">Your Financial Command Center</p>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* UPCOMING TRIPS - HORIZONTAL SCROLL CARDS (Airbnb Style) */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✈️</span>
                <h2 className="text-xl font-semibold text-gray-900">Upcoming Trips</h2>
              </div>
              <button 
                onClick={() => router.push('/budgets/trips')}
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
              >
                View all
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            {committedTrips.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 lg:-mx-8 lg:px-8">
                {committedTrips.map(trip => {
                  const tag = getDestinationTag(trip.destination);
                  const nights = trip.startDate && trip.endDate 
                    ? Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const avgPerNight = nights && nights > 0 ? trip.totalBudget / nights : null;
                  
                  return (
                    <div 
                      key={trip.id}
                      onClick={() => router.push(`/budgets/trips/${trip.id}`)}
                      className="flex-shrink-0 w-[280px] snap-start cursor-pointer group"
                    >
                      <div className="relative h-[187px] rounded-xl overflow-hidden mb-3">
                        {trip.destinationPhoto ? (
                          <img src={trip.destinationPhoto} alt={trip.destination || trip.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center"><span className="text-6xl">✈️</span></div>
                        )}
                        <div className={`absolute top-3 left-3 ${tag.color} text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-lg`}>{tag.label}</div>
                        <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors" onClick={(e) => { e.stopPropagation(); }}>
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        </button>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-base mb-0.5">{trip.destination || trip.name}</h3>
                        <p className="text-gray-500 text-sm mb-2">
                          {trip.startDate ? new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Date TBD"}
                          {trip.endDate && ` – ${new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                        </p>
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-gray-900">{formatCurrency(trip.totalBudget)}</span>
                          {nights && <span className="text-gray-500 text-sm">total · {nights} nights</span>}
                        </div>
                        {avgPerNight && <p className="text-gray-400 text-sm">{formatCurrency(avgPerNight)} avg/night</p>}
                      </div>
                    </div>
                  );
                })}
                <div onClick={() => router.push('/budgets/trips/new')} className="flex-shrink-0 w-[280px] h-[187px] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition-colors snap-start">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3"><svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></div>
                  <span className="text-gray-500 font-medium">Plan a new trip</span>
                </div>
              </div>
            ) : (
              <div onClick={() => router.push('/budgets/trips/new')} className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition-colors">
                <div className="text-5xl mb-4">✈️</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No trips planned yet</h3>
                <p className="text-gray-500 mb-4">Start planning your next adventure</p>
                <span className="inline-flex items-center gap-2 text-cyan-600 font-medium">Plan a trip<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></span>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CALENDAR - macOS STYLE */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="flex bg-gray-200/70 rounded-lg p-0.5">
                  <button onClick={() => setCalendarView('week')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${calendarView === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Week</button>
                  <button onClick={() => setCalendarView('month')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${calendarView === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Month</button>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">{calendarView === 'week' ? `${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}` : `${MONTHS[selectedMonth]} ${selectedYear}`}</h2>
              <div className="flex items-center gap-2">
                <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">Today</button>
                <button onClick={calendarView === 'week' ? prevWeek : prevMonth} className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <button onClick={calendarView === 'week' ? nextWeek : nextMonth} className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
              </div>
            </div>
            <div className="flex">
              <div className="w-44 border-r border-gray-200 p-3 bg-gray-50/30 hidden sm:block">
                <div className="space-y-0.5">
                  {Object.entries(SOURCE_CONFIG).map(([source, config]) => (
                    <label key={source} className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input type="checkbox" checked={visibleCategories[source]} onChange={(e) => setVisibleCategories(prev => ({ ...prev, [source]: e.target.checked }))} className="sr-only" />
                      <div className={`w-3 h-3 rounded-sm transition-colors ${visibleCategories[source] ? config.calendarColor : 'bg-gray-300'}`} />
                      <span className={`text-sm transition-colors ${visibleCategories[source] ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{source.charAt(0).toUpperCase() + source.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {calendarView === 'week' ? (
                  <div>
                    <div className="grid grid-cols-7 border-b border-gray-200">
                      {weekDays.map((day, idx) => {
                        const isToday = day.toDateString() === now.toDateString();
                        return (
                          <div key={idx} className={`text-center py-3 border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-red-50' : ''}`}>
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{DAYS[day.getDay()]}</div>
                            <div className={`text-2xl font-light mt-0.5 ${isToday ? 'bg-red-500 text-white w-9 h-9 rounded-full flex items-center justify-center mx-auto' : 'text-gray-900'}`}>{day.getDate()}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-7 min-h-[320px]">
                      {weekDays.map((day, idx) => {
                        const dayEvents = getEventsForDate(day);
                        const isToday = day.toDateString() === now.toDateString();
                        return (
                          <div key={idx} className={`border-r border-gray-100 last:border-r-0 p-1.5 ${isToday ? 'bg-red-50/30' : ''}`}>
                            <div className="space-y-1">
                              {dayEvents.slice(0, 8).map((event, eventIdx) => {
                                const config = SOURCE_CONFIG[event.source] || SOURCE_CONFIG.home;
                                return (<div key={event.id || eventIdx} className={`${config.calendarColor} text-white text-xs px-2 py-1.5 rounded truncate cursor-pointer hover:opacity-90 transition-opacity`} title={`${event.title} - ${formatCurrency(event.budget_amount)}`}>{event.title}</div>);
                              })}
                              {dayEvents.length > 8 && <div className="text-xs text-gray-500 px-2">+{dayEvents.length - 8} more</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="grid grid-cols-7 gap-1 mb-2">{DAYS.map(day => <div key={day} className="text-center text-sm font-semibold text-gray-500 py-2">{day}</div>)}</div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, idx) => {
                        if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
                        const dayEvents = eventsByDay[day]?.filter(e => visibleCategories[e.source]) || [];
                        const dayTotal = dayEvents.reduce((sum: number, e: CalendarEvent) => sum + e.budget_amount, 0);
                        const isToday = day === now.getDate() && selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
                        return (
                          <div key={day} className={`aspect-square p-1 rounded-xl border overflow-hidden transition-all cursor-pointer hover:border-gray-300 ${isToday ? "border-red-400 border-2 bg-red-50" : "border-gray-100 bg-gray-50/50"}`}>
                            <div className="flex flex-col h-full">
                              <div className={`text-xs font-semibold mb-1 ${isToday ? "text-red-500" : "text-gray-600"}`}>{day}</div>
                              {dayEvents.length > 0 && (
                                <div className="flex-1 flex flex-col justify-end">
                                  <div className="flex flex-wrap gap-0.5 mb-1">
                                    {dayEvents.slice(0, 4).map((e: CalendarEvent, i: number) => { const config = SOURCE_CONFIG[e.source] || SOURCE_CONFIG.home; return <div key={i} className={`w-2 h-2 rounded-full ${config.dotColor}`} title={e.title} />; })}
                                    {dayEvents.length > 4 && <span className="text-[8px] text-gray-400">+{dayEvents.length - 4}</span>}
                                  </div>
                                  <div className="text-[10px] font-bold text-gray-600 tabular-nums truncate">{formatCurrency(dayTotal)}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* BUDGET COMPARISON - WALL STREET STYLE */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Budget Comparison</h2>
                <p className="text-sm text-gray-500 mt-0.5">FY {selectedYear} · Homebase + Business + Travel · USD</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-600 rounded-sm"></span><span className="text-gray-600">Under Budget</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-600 rounded-sm"></span><span className="text-gray-600">Over Budget</span></span>
                <div className="h-4 w-px bg-gray-300 mx-2"></div>
                <button onClick={() => setSelectedYear(y => y - 1)} className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded">◀</button>
                <span className="font-semibold text-gray-900">{selectedYear}</span>
                <button onClick={() => setSelectedYear(y => y + 1)} className="px-2 py-1 text-gray-600 hover:bg-gray-100 rounded">▶</button>
              </div>
            </div>

            {/* Month Toggle */}
            <div className="mb-4 p-4 bg-white border border-gray-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Travel months (homebase costs excluded):</span>
                <div className="flex gap-2">
                  <button onClick={() => setTravelMonths([0,1,2,3,4,5,6,7,8,9,10,11])} className="text-xs px-3 py-1 text-gray-600 hover:bg-gray-100 border border-gray-300 transition-colors font-medium">All Travel</button>
                  <button onClick={() => setTravelMonths([])} className="text-xs px-3 py-1 text-gray-600 hover:bg-gray-100 border border-gray-300 transition-colors font-medium">All Home</button>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {MONTHS_SHORT.map((m, i) => (
                  <button 
                    key={i} 
                    onClick={() => setTravelMonths(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a,b) => a-b))}
                    className={`px-3 py-1.5 text-xs font-mono font-medium transition-all border ${
                      travelMonths.includes(i) 
                        ? 'bg-[#2d1b4e] text-white border-[#2d1b4e]' 
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex gap-6 text-xs text-gray-500 mt-3 font-mono">
                <span>Home: {homeMonths.length} mo</span>
                <span>Travel: {travelMonths.length} mo</span>
              </div>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-300 mb-4">
              <div className="bg-white p-4">
                <div className="text-xs text-gray-500 font-medium mb-1">Home Months Cost</div>
                <div className="text-2xl font-bold text-gray-900 font-mono">{fmt(homeMonthsHomebaseBudget)}</div>
                <div className="text-xs text-gray-500 mt-1">+ {fmt(homeMonthsTravelBudget)} travel</div>
              </div>
              <div className="bg-white p-4">
                <div className="text-xs text-gray-500 font-medium mb-1">Travel Months Cost</div>
                <div className="text-2xl font-bold text-gray-900 font-mono">{fmt(travelMonthsTravelBudget)}</div>
                <div className="text-xs text-gray-400 line-through mt-1">{fmt(travelMonthsHomebaseBudget)} homebase</div>
              </div>
              <div className="bg-white p-4">
                <div className="text-xs text-gray-500 font-medium mb-1">Travel Savings</div>
                <div className={`text-2xl font-bold font-mono ${travelSavings >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{travelSavings >= 0 ? '+' : ''}{fmt(travelSavings)}</div>
                <div className="text-xs text-gray-500 mt-1">{travelSavings >= 0 ? 'Saved vs home' : 'Extra vs home'}</div>
              </div>
              <div className="bg-[#2d1b4e] p-4 text-white">
                <div className="text-xs text-gray-300 font-medium mb-1">Effective Total</div>
                <div className="text-2xl font-bold font-mono">{fmt(effectiveYearlyCost)}</div>
                <div className="text-xs text-gray-400 mt-1">{selectedYear} projected</div>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="border border-gray-300 bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#2d1b4e] text-white">
                    <th className="text-left py-2 px-3 font-medium border-r border-[#3d2b5e] w-36">Category</th>
                    {MONTHS_SHORT.map((m, i) => (
                      <th key={m} className={`py-2 px-2 font-medium border-r border-[#3d2b5e] text-right min-w-[55px] ${travelMonths.includes(i) ? 'bg-[#1a0f2e]' : ''}`}>{m}</th>
                    ))}
                    <th className="py-2 px-3 font-medium text-right bg-[#1a0f2e] min-w-[70px]">FY Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 bg-white hover:bg-blue-50/30">
                    <td className="py-2 px-3 font-medium text-gray-900 border-r border-gray-200">Homebase</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const val = yearBudget[i]?.total || 0;
                      const isTraveling = travelMonths.includes(i);
                      return (
                        <td key={i} className={`py-2 px-2 text-right font-mono border-r border-gray-100 ${isTraveling ? 'bg-gray-100' : ''}`}>
                          <span className={isTraveling ? 'text-gray-300 line-through' : 'text-gray-700'}>{fmt(val)}</span>
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900 bg-gray-50">{fmt(homeMonthsHomebaseBudget)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50/50 hover:bg-blue-50/30">
                    <td className="py-2 px-3 font-medium text-gray-900 border-r border-gray-200">Business</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const val = Object.values(businessBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (<td key={i} className="py-2 px-2 text-right font-mono border-r border-gray-100 text-gray-700">{fmt(val)}</td>);
                    })}
                    <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900 bg-gray-50">{fmt(yearlyBusinessBudget)}</td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-white hover:bg-blue-50/30">
                    <td className="py-2 px-3 font-medium text-gray-900 border-r border-gray-200">Travel</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const val = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (<td key={i} className="py-2 px-2 text-right font-mono border-r border-gray-100 text-gray-700">{fmt(val)}</td>);
                    })}
                    <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900 bg-gray-50">{fmt(yearlyTravelBudget)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-[#2d1b4e] text-white font-semibold">
                    <td className="py-2 px-3 border-r border-[#3d2b5e]">Monthly Total</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const homebase = yearBudget[i]?.total || 0;
                      const business = Object.values(businessBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      const travel = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      const isTraveling = travelMonths.includes(i);
                      const effective = isTraveling ? (travel + business) : (homebase + travel + business);
                      return (<td key={i} className={`py-2 px-2 text-right font-mono border-r border-[#3d2b5e] ${isTraveling ? 'bg-[#1a0f2e]' : ''}`}>{fmt(effective)}</td>);
                    })}
                    <td className="py-2 px-3 text-right font-mono bg-[#1a0f2e]">{fmt(effectiveYearlyCost)}</td>
                  </tr>
                  <tr className="bg-gray-100 text-gray-600 text-[10px]">
                    <td className="py-1.5 px-3 border-r border-gray-200">Trips</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const tripsInMonth = committedTrips.filter(t => {
                        if (!t.startDate) return false;
                        const start = new Date(new Date(t.startDate).getTime() + 12*60*60*1000);
                        return start.getMonth() === i && start.getFullYear() === selectedYear;
                      });
                      return (
                        <td key={i} className="py-1.5 px-1 text-center border-r border-gray-100 truncate" style={{maxWidth: '55px'}}>
                          {tripsInMonth.length > 0 ? tripsInMonth.map(t => t.destination?.split(',')[0] || t.name).join(', ') : '—'}
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-3 text-center bg-gray-200 font-medium">{committedTrips.filter(t => t.startDate && new Date(new Date(t.startDate).getTime() + 12*60*60*1000).getFullYear() === selectedYear).length} trips</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* HOMEBASE BUDGET - WALL STREET STYLE */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Homebase Operating Expenses</h2>
                <p className="text-xs text-gray-500">FY {selectedYear} · Budget vs Actual · USD</p>
              </div>
            </div>
            <div className="border border-gray-300 bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#2d1b4e] text-white">
                    <th className="text-left py-2 px-3 font-medium border-r border-[#3d2b5e] w-40">Account</th>
                    <th className="py-2 px-2 font-medium border-r border-[#3d2b5e] w-10 text-center">Type</th>
                    {MONTHS_SHORT.map(m => <th key={m} className="py-2 px-2 font-medium border-r border-[#3d2b5e] text-right min-w-[55px]">{m}</th>)}
                    <th className="py-2 px-3 font-medium text-right bg-[#1a0f2e] min-w-[70px]">FY Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(SOURCE_CONFIG).filter(([s]) => s !== 'trip').map(([source, config], idx) => {
                    const budgetTotal = Object.values(yearBudget).reduce((sum, m) => sum + (m[source] || 0), 0);
                    const actualTotal = Object.values(yearActual).reduce((sum, m) => sum + (m[source] || 0), 0);
                    return (
                      <Fragment key={source}>
                        <tr className={`hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td rowSpan={2} className="py-1.5 px-3 border-r border-gray-200 align-top">
                            <div className="font-medium text-gray-900">{CATEGORY_NAMES[source] || source}</div>
                            <div className="text-[10px] text-gray-400 font-mono uppercase">{source}</div>
                          </td>
                          <td className="py-1.5 px-2 text-[10px] text-gray-500 border-r border-gray-200 text-center font-medium">BUD</td>
                          {MONTHS_SHORT.map((_, i) => (
                            <td key={i} className="py-1.5 px-2 text-right font-mono text-gray-700 border-r border-gray-100">{fmt(yearBudget[i]?.[source] || 0)}</td>
                          ))}
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-gray-900 bg-gray-100/50">{fmt(budgetTotal)}</td>
                        </tr>
                        <tr className={`border-b border-gray-200 hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="py-1.5 px-2 text-[10px] text-gray-500 border-r border-gray-200 text-center font-medium">ACT</td>
                          {MONTHS_SHORT.map((_, i) => {
                            const bud = yearBudget[i]?.[source] || 0;
                            const act = yearActual[i]?.[source] || 0;
                            return (
                              <td key={i} className={`py-1.5 px-2 text-right font-mono border-r border-gray-100 ${act > 0 && act > bud ? 'text-red-700 bg-red-50' : act > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-gray-400'}`}>
                                {fmt(act)}
                              </td>
                            );
                          })}
                          <td className={`py-1.5 px-3 text-right font-mono font-semibold ${actualTotal > 0 && actualTotal > budgetTotal ? 'text-red-700 bg-red-100/50' : actualTotal > 0 ? 'text-emerald-700 bg-emerald-100/50' : 'text-gray-400 bg-gray-100/50'}`}>
                            {fmt(actualTotal)}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#2d1b4e] text-white font-semibold">
                    <td className="py-2 px-3 border-r border-[#3d2b5e]">Total</td>
                    <td className="py-2 px-2 text-[10px] border-r border-[#3d2b5e] text-center">BUD</td>
                    {MONTHS_SHORT.map((_, i) => (<td key={i} className="py-2 px-2 text-right font-mono border-r border-[#3d2b5e]">{fmt(yearBudget[i]?.total || 0)}</td>))}
                    <td className="py-2 px-3 text-right font-mono bg-[#1a0f2e]">{fmt(yearlyHomebaseBudget)}</td>
                  </tr>
                  <tr className="bg-[#3d2b5e] text-white">
                    <td className="py-2 px-3 border-r border-[#3d2b5e]"></td>
                    <td className="py-2 px-2 text-[10px] border-r border-[#3d2b5e] text-center">ACT</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const bud = yearBudget[i]?.total || 0;
                      const act = yearActual[i]?.total || 0;
                      return (<td key={i} className={`py-2 px-2 text-right font-mono border-r border-[#3d2b5e] ${act > 0 && act > bud ? 'text-red-300' : act > 0 ? 'text-emerald-300' : ''}`}>{fmt(act)}</td>);
                    })}
                    <td className={`py-2 px-3 text-right font-mono bg-[#1a0f2e] ${yearlyHomebaseActual > yearlyHomebaseBudget ? 'text-red-300' : yearlyHomebaseActual > 0 ? 'text-emerald-300' : ''}`}>{fmt(yearlyHomebaseActual)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TRAVEL BUDGET - WALL STREET STYLE */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Travel Operating Expenses</h2>
                <p className="text-xs text-gray-500">FY {selectedYear} · Budget vs Actual · USD</p>
              </div>
            </div>
            <div className="border border-gray-300 bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#2d1b4e] text-white">
                    <th className="text-left py-2 px-3 font-medium border-r border-[#3d2b5e] w-40">Account</th>
                    <th className="py-2 px-2 font-medium border-r border-[#3d2b5e] w-10 text-center">Type</th>
                    {MONTHS_SHORT.map(m => <th key={m} className="py-2 px-2 font-medium border-r border-[#3d2b5e] text-right min-w-[55px]">{m}</th>)}
                    <th className="py-2 px-3 font-medium text-right bg-[#1a0f2e] min-w-[70px]">FY Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(nomadBudget.coaNames).map(([code, name], idx) => {
                    const budgetRow = nomadBudget.budgetData[code] || {};
                    const actualRow = nomadBudget.actualData[code] || {};
                    const budgetTotal = Object.values(budgetRow).reduce((s, v) => s + v, 0);
                    const actualTotal = Object.values(actualRow).reduce((s, v) => s + v, 0);
                    if (budgetTotal === 0 && actualTotal === 0) return null;
                    return (
                      <Fragment key={code}>
                        <tr className={`hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td rowSpan={2} className="py-1.5 px-3 border-r border-gray-200 align-top">
                            <div className="font-medium text-gray-900">{name.replace(/^[^\w]+/, '')}</div>
                            <div className="text-[10px] text-gray-400 font-mono">{code}</div>
                          </td>
                          <td className="py-1.5 px-2 text-[10px] text-gray-500 border-r border-gray-200 text-center font-medium">BUD</td>
                          {MONTHS_SHORT.map((_, i) => (<td key={i} className="py-1.5 px-2 text-right font-mono text-gray-700 border-r border-gray-100">{fmt(budgetRow[i] || 0)}</td>))}
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-gray-900 bg-gray-100/50">{fmt(budgetTotal)}</td>
                        </tr>
                        <tr className={`border-b border-gray-200 hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="py-1.5 px-2 text-[10px] text-gray-500 border-r border-gray-200 text-center font-medium">ACT</td>
                          {MONTHS_SHORT.map((_, i) => {
                            const bud = budgetRow[i] || 0;
                            const act = actualRow[i] || 0;
                            return (<td key={i} className={`py-1.5 px-2 text-right font-mono border-r border-gray-100 ${act > 0 && act > bud ? 'text-red-700 bg-red-50' : act > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-gray-400'}`}>{fmt(act)}</td>);
                          })}
                          <td className={`py-1.5 px-3 text-right font-mono font-semibold ${actualTotal > 0 && actualTotal > budgetTotal ? 'text-red-700 bg-red-100/50' : actualTotal > 0 ? 'text-emerald-700 bg-emerald-100/50' : 'text-gray-400 bg-gray-100/50'}`}>{fmt(actualTotal)}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#2d1b4e] text-white font-semibold">
                    <td className="py-2 px-3 border-r border-[#3d2b5e]">Total</td>
                    <td className="py-2 px-2 text-[10px] border-r border-[#3d2b5e] text-center">BUD</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const monthTotal = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (<td key={i} className="py-2 px-2 text-right font-mono border-r border-[#3d2b5e]">{fmt(monthTotal)}</td>);
                    })}
                    <td className="py-2 px-3 text-right font-mono bg-[#1a0f2e]">{fmt(yearlyTravelBudget)}</td>
                  </tr>
                  <tr className="bg-[#3d2b5e] text-white">
                    <td className="py-2 px-3 border-r border-[#3d2b5e]"></td>
                    <td className="py-2 px-2 text-[10px] border-r border-[#3d2b5e] text-center">ACT</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const budMonth = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      const actMonth = Object.values(nomadBudget.actualData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (<td key={i} className={`py-2 px-2 text-right font-mono border-r border-[#3d2b5e] ${actMonth > 0 && actMonth > budMonth ? 'text-red-300' : actMonth > 0 ? 'text-emerald-300' : ''}`}>{fmt(actMonth)}</td>);
                    })}
                    <td className={`py-2 px-3 text-right font-mono bg-[#1a0f2e] ${yearlyTravelActual > yearlyTravelBudget ? 'text-red-300' : yearlyTravelActual > 0 ? 'text-emerald-300' : ''}`}>{fmt(yearlyTravelActual)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* BUSINESS BUDGET - WALL STREET STYLE */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Business Operating Expenses</h2>
                <p className="text-xs text-gray-500">FY {selectedYear} · Budget vs Actual · USD</p>
              </div>
            </div>
            {Object.keys(businessBudget.coaNames).length > 0 ? (
              <div className="border border-gray-300 bg-white overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#2d1b4e] text-white">
                      <th className="text-left py-2 px-3 font-medium border-r border-[#3d2b5e] w-40">Account</th>
                      <th className="py-2 px-2 font-medium border-r border-[#3d2b5e] w-10 text-center">Type</th>
                      {MONTHS_SHORT.map(m => <th key={m} className="py-2 px-2 font-medium border-r border-[#3d2b5e] text-right min-w-[55px]">{m}</th>)}
                      <th className="py-2 px-3 font-medium text-right bg-[#1a0f2e] min-w-[70px]">FY Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(businessBudget.coaNames).map(([code, name], idx) => {
                      const budgetRow = businessBudget.budgetData[code] || {};
                      const actualRow = businessBudget.actualData[code] || {};
                      const budgetTotal = Object.values(budgetRow).reduce((s, v) => s + v, 0);
                      const actualTotal = Object.values(actualRow).reduce((s, v) => s + v, 0);
                      if (budgetTotal === 0 && actualTotal === 0) return null;
                      return (
                        <Fragment key={code}>
                          <tr className={`hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td rowSpan={2} className="py-1.5 px-3 border-r border-gray-200 align-top">
                              <div className="font-medium text-gray-900">{name}</div>
                              <div className="text-[10px] text-gray-400 font-mono">{code}</div>
                            </td>
                            <td className="py-1.5 px-2 text-[10px] text-gray-500 border-r border-gray-200 text-center font-medium">BUD</td>
                            {MONTHS_SHORT.map((_, i) => (<td key={i} className="py-1.5 px-2 text-right font-mono text-gray-700 border-r border-gray-100">{fmt(budgetRow[i] || 0)}</td>))}
                            <td className="py-1.5 px-3 text-right font-mono font-semibold text-gray-900 bg-gray-100/50">{fmt(budgetTotal)}</td>
                          </tr>
                          <tr className={`border-b border-gray-200 hover:bg-blue-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="py-1.5 px-2 text-[10px] text-gray-500 border-r border-gray-200 text-center font-medium">ACT</td>
                            {MONTHS_SHORT.map((_, i) => {
                              const bud = budgetRow[i] || 0;
                              const act = actualRow[i] || 0;
                              return (<td key={i} className={`py-1.5 px-2 text-right font-mono border-r border-gray-100 ${act > 0 && act > bud ? 'text-red-700 bg-red-50' : act > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-gray-400'}`}>{fmt(act)}</td>);
                            })}
                            <td className={`py-1.5 px-3 text-right font-mono font-semibold ${actualTotal > 0 && actualTotal > budgetTotal ? 'text-red-700 bg-red-100/50' : actualTotal > 0 ? 'text-emerald-700 bg-emerald-100/50' : 'text-gray-400 bg-gray-100/50'}`}>{fmt(actualTotal)}</td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#2d1b4e] text-white font-semibold">
                      <td className="py-2 px-3 border-r border-[#3d2b5e]">Total</td>
                      <td className="py-2 px-2 text-[10px] border-r border-[#3d2b5e] text-center">BUD</td>
                      {MONTHS_SHORT.map((_, i) => {
                        const monthTotal = Object.values(businessBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                        return (<td key={i} className="py-2 px-2 text-right font-mono border-r border-[#3d2b5e]">{fmt(monthTotal)}</td>);
                      })}
                      <td className="py-2 px-3 text-right font-mono bg-[#1a0f2e]">{fmt(yearlyBusinessBudget)}</td>
                    </tr>
                    <tr className="bg-[#3d2b5e] text-white">
                      <td className="py-2 px-3 border-r border-[#3d2b5e]"></td>
                      <td className="py-2 px-2 text-[10px] border-r border-[#3d2b5e] text-center">ACT</td>
                      {MONTHS_SHORT.map((_, i) => {
                        const budMonth = Object.values(businessBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                        const actMonth = Object.values(businessBudget.actualData).reduce((s, coa) => s + (coa[i] || 0), 0);
                        return (<td key={i} className={`py-2 px-2 text-right font-mono border-r border-[#3d2b5e] ${actMonth > 0 && actMonth > budMonth ? 'text-red-300' : actMonth > 0 ? 'text-emerald-300' : ''}`}>{fmt(actMonth)}</td>);
                      })}
                      <td className={`py-2 px-3 text-right font-mono bg-[#1a0f2e] ${yearlyBusinessActual > yearlyBusinessBudget ? 'text-red-300' : yearlyBusinessActual > 0 ? 'text-emerald-300' : ''}`}>{fmt(yearlyBusinessActual)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="border border-gray-300 bg-white p-8 text-center">
                <div className="text-gray-400 mb-2">No business accounts configured</div>
                <div className="text-xs text-gray-400">Map transactions to B-xxxx accounts to see them here</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-400 text-center py-4">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Source: Temple Stuart Ledger
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
