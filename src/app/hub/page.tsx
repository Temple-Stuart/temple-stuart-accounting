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
  
  // Tropical destinations
  if (d.includes('hawaii') || d.includes('honolulu') || d.includes('maui') || d.includes('caribbean') || 
      d.includes('bahamas') || d.includes('cancun') || d.includes('phuket') || d.includes('bali') ||
      d.includes('fiji') || d.includes('maldives') || d.includes('tahiti')) {
    return { label: 'Tropical paradise', color: 'bg-emerald-600' };
  }
  
  // Coastal destinations
  if (d.includes('beach') || d.includes('coast') || d.includes('monterey') || d.includes('carmel') ||
      d.includes('laguna') || d.includes('malibu') || d.includes('santa cruz') || d.includes('san diego') ||
      d.includes('miami') || d.includes('cape') || d.includes('seaside')) {
    return { label: 'Coastal charm', color: 'bg-blue-600' };
  }
  
  // Mountain destinations
  if (d.includes('aspen') || d.includes('vail') || d.includes('tahoe') || d.includes('mountain') ||
      d.includes('alps') || d.includes('rockies') || d.includes('whistler') || d.includes('denver') ||
      d.includes('colorado') || d.includes('jackson hole') || d.includes('mammoth')) {
    return { label: 'Mountain retreat', color: 'bg-slate-600' };
  }
  
  // City destinations
  if (d.includes('new york') || d.includes('nyc') || d.includes('los angeles') || d.includes('chicago') ||
      d.includes('san francisco') || d.includes('london') || d.includes('paris') || d.includes('tokyo') ||
      d.includes('vegas') || d.includes('seattle') || d.includes('austin')) {
    return { label: 'City escape', color: 'bg-violet-600' };
  }
  
  // Relaxing destinations
  if (d.includes('spa') || d.includes('retreat') || d.includes('resort') || d.includes('napa') ||
      d.includes('wine') || d.includes('sedona') || d.includes('palm springs')) {
    return { label: 'Relaxing escape', color: 'bg-rose-600' };
  }
  
  // International
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

// Glow style for under/over budget
const getVarianceStyle = (budget: number, actual: number) => {
  if (budget === 0 && actual === 0) return '';
  if (actual === 0) return 'bg-emerald-100/50';
  if (actual <= budget) return 'bg-emerald-100 shadow-[inset_0_0_12px_rgba(16,185,129,0.3)]';
  return 'bg-red-100 shadow-[inset_0_0_12px_rgba(239,68,68,0.3)]';
};

const getVarianceTextColor = (budget: number, actual: number) => {
  if (budget === 0 && actual === 0) return 'text-gray-400';
  if (actual <= budget) return 'text-emerald-600';
  return 'text-red-600';
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
  
  // Budget & Actual data
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

  // Category visibility for calendar
  const [visibleCategories, setVisibleCategories] = useState<Record<string, boolean>>({
    home: true,
    auto: true,
    shopping: true,
    personal: true,
    health: true,
    growth: true,
    trip: true,
  });

  useEffect(() => {
    loadCalendar();
  }, [selectedYear, selectedMonth]);

  const loadCalendar = async () => {
    try {
      const res = await fetch(`/api/calendar?year=${selectedYear}&month=${selectedMonth + 1}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to load calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCommittedTrips = async () => {
    try {
      const res = await fetch("/api/hub/trips");
      if (res.ok) {
        const data = await res.json();
        setCommittedTrips(data.trips || []);
      }
    } catch (err) {
      console.error("Failed to load trips:", err);
    }
  };

  const loadYearCalendar = async () => {
    try {
      const res = await fetch(`/api/hub/year-calendar?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setYearBudget(data.budgetData || data.monthlyData || {});
        setYearActual(data.actualData || {});
      }
    } catch (err) {
      console.error("Failed to load year calendar:", err);
    }
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
    } catch (err) {
      console.error("Failed to load nomad budget:", err);
    }
  };

  useEffect(() => { loadCommittedTrips(); loadYearCalendar(); loadNomadBudget(); }, [selectedYear]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };

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

  const prevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const prevWeek = () => {
    const newStart = new Date(selectedWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setSelectedWeekStart(newStart);
    // Update month/year if week crosses boundary
    setSelectedMonth(newStart.getMonth());
    setSelectedYear(newStart.getFullYear());
  };

  const nextWeek = () => {
    const newStart = new Date(selectedWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setSelectedWeekStart(newStart);
    // Update month/year if week crosses boundary
    setSelectedMonth(newStart.getMonth());
    setSelectedYear(newStart.getFullYear());
  };

  const goToToday = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek);
    setSelectedWeekStart(start);
  };

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Get week days for week view
  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(selectedWeekStart);
      day.setDate(selectedWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = getWeekDays();

  // Get events for a specific date (for week view)
  const getEventsForDate = (date: Date) => {
    return events.filter(e => {
      const eventDate = parseDate(e.start_date);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear() &&
             visibleCategories[e.source];
    });
  };

  const currentYear = now.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i);

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
  
  const effectiveYearlyCost = homeMonthsCombined + travelMonthsTravelBudget;

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
            <div className="flex items-center justify-between mb-4">
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
                      {/* Image Container */}
                      <div className="relative h-[187px] rounded-xl overflow-hidden mb-3">
                        {trip.destinationPhoto ? (
                          <img 
                            src={trip.destinationPhoto} 
                            alt={trip.destination || trip.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                            <span className="text-6xl">✈️</span>
                          </div>
                        )}
                        {/* Tag Badge */}
                        <div className={`absolute top-3 left-3 ${tag.color} text-white text-xs font-medium px-2.5 py-1 rounded-md shadow-lg`}>
                          {tag.label}
                        </div>
                        {/* Favorite Button */}
                        <button 
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Trip Info */}
                      <div>
                        <h3 className="font-semibold text-gray-900 text-base mb-0.5">
                          {trip.destination || trip.name}
                        </h3>
                        <p className="text-gray-500 text-sm mb-2">
                          {trip.startDate 
                            ? new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                            : "Date TBD"
                          }
                          {trip.endDate && ` – ${new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                        </p>
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-gray-900">{formatCurrency(trip.totalBudget)}</span>
                          {nights && <span className="text-gray-500 text-sm">total · {nights} nights</span>}
                        </div>
                        {avgPerNight && (
                          <p className="text-gray-400 text-sm">{formatCurrency(avgPerNight)} avg/night</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* Add Trip Card */}
                <div 
                  onClick={() => router.push('/budgets/trips/new')}
                  className="flex-shrink-0 w-[280px] h-[187px] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition-colors snap-start"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-gray-500 font-medium">Plan a new trip</span>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => router.push('/budgets/trips/new')}
                className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition-colors"
              >
                <div className="text-5xl mb-4">✈️</div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No trips planned yet</h3>
                <p className="text-gray-500 mb-4">Start planning your next adventure</p>
                <span className="inline-flex items-center gap-2 text-cyan-600 font-medium">
                  Plan a trip
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CALENDAR - macOS STYLE */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Calendar Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/50">
              <div className="flex items-center gap-4">
                {/* View Toggle */}
                <div className="flex bg-gray-200/70 rounded-lg p-0.5">
                  <button
                    onClick={() => setCalendarView('week')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      calendarView === 'week' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setCalendarView('month')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      calendarView === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Month
                  </button>
                </div>
              </div>

              {/* Month/Year Display */}
              <h2 className="text-xl font-semibold text-gray-900">
                {calendarView === 'week' 
                  ? `${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
                  : `${MONTHS[selectedMonth]} ${selectedYear}`
                }
              </h2>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={goToToday}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  Today
                </button>
                <button 
                  onClick={calendarView === 'week' ? prevWeek : prevMonth} 
                  className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  onClick={calendarView === 'week' ? nextWeek : nextMonth} 
                  className="w-8 h-8 flex items-center justify-center text-gray-500 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex">
              {/* Category Sidebar */}
              <div className="w-44 border-r border-gray-200 p-3 bg-gray-50/30 hidden sm:block">
                <div className="space-y-0.5">
                  {Object.entries(SOURCE_CONFIG).map(([source, config]) => (
                    <label 
                      key={source}
                      className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={visibleCategories[source]}
                        onChange={(e) => setVisibleCategories(prev => ({ ...prev, [source]: e.target.checked }))}
                        className="sr-only"
                      />
                      <div 
                        className={`w-3 h-3 rounded-sm transition-colors ${visibleCategories[source] ? config.calendarColor : 'bg-gray-300'}`}
                      />
                      <span className={`text-sm transition-colors ${visibleCategories[source] ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                        {source.charAt(0).toUpperCase() + source.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Calendar Content */}
              <div className="flex-1 min-w-0">
                {calendarView === 'week' ? (
                  /* Week View */
                  <div>
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 border-b border-gray-200">
                      {weekDays.map((day, idx) => {
                        const isToday = day.toDateString() === now.toDateString();
                        return (
                          <div 
                            key={idx} 
                            className={`text-center py-3 border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-red-50' : ''}`}
                          >
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                              {DAYS[day.getDay()]}
                            </div>
                            <div className={`text-2xl font-light mt-0.5 ${isToday ? 'bg-red-500 text-white w-9 h-9 rounded-full flex items-center justify-center mx-auto' : 'text-gray-900'}`}>
                              {day.getDate()}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Events Grid */}
                    <div className="grid grid-cols-7 min-h-[320px]">
                      {weekDays.map((day, idx) => {
                        const dayEvents = getEventsForDate(day);
                        const isToday = day.toDateString() === now.toDateString();
                        
                        return (
                          <div 
                            key={idx} 
                            className={`border-r border-gray-100 last:border-r-0 p-1.5 ${isToday ? 'bg-red-50/30' : ''}`}
                          >
                            <div className="space-y-1">
                              {dayEvents.slice(0, 8).map((event, eventIdx) => {
                                const config = SOURCE_CONFIG[event.source] || SOURCE_CONFIG.home;
                                return (
                                  <div
                                    key={event.id || eventIdx}
                                    className={`${config.calendarColor} text-white text-xs px-2 py-1.5 rounded truncate cursor-pointer hover:opacity-90 transition-opacity`}
                                    title={`${event.title} - ${formatCurrency(event.budget_amount)}`}
                                  >
                                    {event.title}
                                  </div>
                                );
                              })}
                              {dayEvents.length > 8 && (
                                <div className="text-xs text-gray-500 px-2">
                                  +{dayEvents.length - 8} more
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Month View */
                  <div className="p-4">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {DAYS.map(day => (
                        <div key={day} className="text-center text-sm font-semibold text-gray-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, idx) => {
                        if (!day) {
                          return <div key={`empty-${idx}`} className="aspect-square" />;
                        }
                        const dayEvents = eventsByDay[day]?.filter(e => visibleCategories[e.source]) || [];
                        const dayTotal = dayEvents.reduce((sum: number, e: CalendarEvent) => sum + e.budget_amount, 0);
                        const isToday = day === now.getDate() && selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
                        
                        return (
                          <div
                            key={day}
                            className={`aspect-square p-1 rounded-xl border overflow-hidden transition-all cursor-pointer hover:border-gray-300 ${
                              isToday ? "border-red-400 border-2 bg-red-50" : "border-gray-100 bg-gray-50/50"
                            }`}
                          >
                            <div className="flex flex-col h-full">
                              <div className={`text-xs font-semibold mb-1 ${isToday ? "text-red-500" : "text-gray-600"}`}>
                                {day}
                              </div>
                              {dayEvents.length > 0 && (
                                <div className="flex-1 flex flex-col justify-end">
                                  <div className="flex flex-wrap gap-0.5 mb-1">
                                    {dayEvents.slice(0, 4).map((e: CalendarEvent, i: number) => {
                                      const config = SOURCE_CONFIG[e.source] || SOURCE_CONFIG.home;
                                      return (
                                        <div key={i} className={`w-2 h-2 rounded-full ${config.dotColor}`} title={e.title} />
                                      );
                                    })}
                                    {dayEvents.length > 4 && (
                                      <span className="text-[8px] text-gray-400">+{dayEvents.length - 4}</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-bold text-gray-600 tabular-nums truncate">
                                    {formatCurrency(dayTotal)}
                                  </div>
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
          {/* HOMEBASE BUDGET - With Actuals */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6 bg-white rounded-2xl border border-gray-200 overflow-hidden lg:overflow-x-auto shadow-sm hover:shadow-md transition-shadow">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <span className="text-xl">🏠</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Homebase Budget</h2>
                  <p className="text-sm text-gray-500">{selectedYear} • Budget vs Actual</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded bg-emerald-200 shadow-[inset_0_0_4px_rgba(16,185,129,0.5)]"></span>
                  <span className="text-gray-500">Under</span>
                  <span className="w-3 h-3 rounded bg-red-200 shadow-[inset_0_0_4px_rgba(239,68,68,0.5)] ml-2"></span>
                  <span className="text-gray-500">Over</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedYear(y => y - 1)} className="w-9 h-9 flex items-center justify-center text-gray-500 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-sm font-medium text-gray-700 min-w-[50px] text-center">{selectedYear}</span>
                  <button onClick={() => setSelectedYear(y => y + 1)} className="w-9 h-9 flex items-center justify-center text-gray-500 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto lg:overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold w-[80px] whitespace-normal">Category</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium w-[50px] text-xs">Type</th>
                    {MONTHS.map(m => <th key={m} className="text-right py-3 px-3 min-w-[50px] lg:min-w-0 text-gray-600 font-medium">{m.slice(0,3)}</th>)}
                    <th className="text-right py-3 px-4 font-bold text-gray-900 bg-gray-100/80 w-[80px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(SOURCE_CONFIG).filter(([s]) => s !== 'trip').map(([source, config]) => {
                    const budgetTotal = Object.values(yearBudget).reduce((sum, m) => sum + (m[source] || 0), 0);
                    const actualTotal = Object.values(yearActual).reduce((sum, m) => sum + (m[source] || 0), 0);
                    
                    return (
                      <Fragment key={source}>
                        {/* Budget Row */}
                        <tr className="border-t border-gray-100">
                          <td rowSpan={2} className="py-2 px-4 text-gray-700 font-medium border-r border-gray-100">
                            <span className="mr-2">{config.icon}</span>
                            {source.charAt(0).toUpperCase() + source.slice(1)}
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-400">Budget</td>
                          {MONTHS.map((_, i) => (
                            <td key={i} className="text-right py-2 px-3 tabular-nums">
                              {yearBudget[i]?.[source] 
                                ? <span className={config.color}>{formatCurrency(yearBudget[i][source])}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                          ))}
                          <td className={`text-right py-2 px-4 font-semibold tabular-nums bg-gray-50/50 ${config.color}`}>
                            {formatCurrency(budgetTotal)}
                          </td>
                        </tr>
                        {/* Actual Row */}
                        <tr className="border-b border-gray-200">
                          <td className="py-2 px-2 text-xs text-gray-400">Actual</td>
                          {MONTHS.map((_, i) => {
                            const budget = yearBudget[i]?.[source] || 0;
                            const actual = yearActual[i]?.[source] || 0;
                            return (
                              <td key={i} className={`text-right py-2 px-3 tabular-nums rounded ${getVarianceStyle(budget, actual)}`}>
                                {actual 
                                  ? <span className={getVarianceTextColor(budget, actual)}>{formatCurrency(actual)}</span>
                                  : <span className="text-gray-300">—</span>
                                }
                              </td>
                            );
                          })}
                          <td className={`text-right py-2 px-4 font-semibold tabular-nums rounded ${getVarianceStyle(budgetTotal, actualTotal)}`}>
                            <span className={getVarianceTextColor(budgetTotal, actualTotal)}>{formatCurrency(actualTotal)}</span>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  {/* Total Budget */}
                  <tr className="bg-gradient-to-r from-amber-50 to-orange-50 border-t-2 border-amber-200">
                    <td className="py-3 px-4 font-bold text-gray-900">Total</td>
                    <td className="py-3 px-2 text-xs text-gray-500">Budget</td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className="text-right py-3 px-3 font-bold tabular-nums text-gray-900">
                        {yearBudget[i]?.total ? formatCurrency(yearBudget[i].total) : <span className="text-gray-300">—</span>}
                      </td>
                    ))}
                    <td className="text-right py-3 px-4 font-bold tabular-nums text-amber-700 bg-amber-100/50 text-lg">
                      {formatCurrency(yearlyHomebaseBudget)}
                    </td>
                  </tr>
                  {/* Total Actual */}
                  <tr className="bg-gradient-to-r from-amber-50/50 to-orange-50/50">
                    <td className="py-3 px-4 font-bold text-gray-700"></td>
                    <td className="py-3 px-2 text-xs text-gray-500">Actual</td>
                    {MONTHS.map((_, i) => {
                      const budget = yearBudget[i]?.total || 0;
                      const actual = yearActual[i]?.total || 0;
                      return (
                        <td key={i} className={`text-right py-3 px-3 font-bold tabular-nums rounded ${getVarianceStyle(budget, actual)}`}>
                          {actual ? <span className={getVarianceTextColor(budget, actual)}>{formatCurrency(actual)}</span> : <span className="text-gray-300">—</span>}
                        </td>
                      );
                    })}
                    <td className={`text-right py-3 px-4 font-bold tabular-nums text-lg rounded ${getVarianceStyle(yearlyHomebaseBudget, yearlyHomebaseActual)}`}>
                      <span className={getVarianceTextColor(yearlyHomebaseBudget, yearlyHomebaseActual)}>{formatCurrency(yearlyHomebaseActual)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TRAVEL BUDGET - With Actuals */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6 bg-white rounded-2xl border border-gray-200 overflow-hidden lg:overflow-x-auto shadow-sm hover:shadow-md transition-shadow">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                <span className="text-xl">✈️</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Travel Budget</h2>
                <p className="text-sm text-gray-500">{selectedYear} • Budget vs Actual</p>
              </div>
            </div>
            <div className="overflow-x-auto lg:overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold w-[80px] whitespace-normal">Account</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium w-[50px] text-xs">Type</th>
                    {MONTHS.map(m => <th key={m} className="text-right py-3 px-3 min-w-[50px] lg:min-w-0 text-gray-600 font-medium">{m.slice(0,3)}</th>)}
                    <th className="text-right py-3 px-4 font-bold text-gray-900 bg-gray-100/80 w-[80px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(nomadBudget.coaNames).map(([code, name]) => {
                    const budgetRow = nomadBudget.budgetData[code] || {};
                    const actualRow = nomadBudget.actualData[code] || {};
                    const budgetTotal = Object.values(budgetRow).reduce((s, v) => s + v, 0);
                    const actualTotal = Object.values(actualRow).reduce((s, v) => s + v, 0);
                    
                    if (budgetTotal === 0 && actualTotal === 0) return null;
                    
                    return (
                      <Fragment key={code}>
                        {/* Budget Row */}
                        <tr className="border-t border-gray-100">
                          <td rowSpan={2} className="py-2 px-4 text-gray-700 font-medium border-r border-gray-100">
                            <div className="font-medium">{name}</div><div className="text-gray-400 text-xs">{code}</div>
                          </td>
                          <td className="py-2 px-2 text-xs text-gray-400">Budget</td>
                          {MONTHS.map((_, i) => (
                            <td key={i} className="text-right py-2 px-3 tabular-nums">
                              {budgetRow[i] 
                                ? <span className="text-cyan-600">{formatCurrency(budgetRow[i])}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                          ))}
                          <td className="text-right py-2 px-4 font-semibold tabular-nums text-cyan-600 bg-gray-50/50">
                            {formatCurrency(budgetTotal)}
                          </td>
                        </tr>
                        {/* Actual Row */}
                        <tr className="border-b border-gray-200">
                          <td className="py-2 px-2 text-xs text-gray-400">Actual</td>
                          {MONTHS.map((_, i) => {
                            const budget = budgetRow[i] || 0;
                            const actual = actualRow[i] || 0;
                            return (
                              <td key={i} className={`text-right py-2 px-3 tabular-nums rounded ${getVarianceStyle(budget, actual)}`}>
                                {actual 
                                  ? <span className={getVarianceTextColor(budget, actual)}>{formatCurrency(actual)}</span>
                                  : <span className="text-gray-300">—</span>
                                }
                              </td>
                            );
                          })}
                          <td className={`text-right py-2 px-4 font-semibold tabular-nums rounded ${getVarianceStyle(budgetTotal, actualTotal)}`}>
                            <span className={getVarianceTextColor(budgetTotal, actualTotal)}>{formatCurrency(actualTotal)}</span>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  {/* Total Budget */}
                  <tr className="bg-gradient-to-r from-cyan-50 to-sky-50 border-t-2 border-cyan-200">
                    <td className="py-3 px-4 font-bold text-gray-900">Total Travel</td>
                    <td className="py-3 px-2 text-xs text-gray-500">Budget</td>
                    {MONTHS.map((_, i) => {
                      const monthTotal = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return <td key={i} className="text-right py-3 px-3 font-bold tabular-nums text-gray-900">{monthTotal ? formatCurrency(monthTotal) : <span className="text-gray-300">—</span>}</td>;
                    })}
                    <td className="text-right py-3 px-4 font-bold tabular-nums text-cyan-700 bg-cyan-100/50 text-lg">
                      {formatCurrency(yearlyTravelBudget)}
                    </td>
                  </tr>
                  {/* Total Actual */}
                  <tr className="bg-gradient-to-r from-cyan-50/50 to-sky-50/50">
                    <td className="py-3 px-4 font-bold text-gray-700"></td>
                    <td className="py-3 px-2 text-xs text-gray-500">Actual</td>
                    {MONTHS.map((_, i) => {
                      const budgetMonth = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      const actualMonth = Object.values(nomadBudget.actualData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (
                        <td key={i} className={`text-right py-3 px-3 font-bold tabular-nums rounded ${getVarianceStyle(budgetMonth, actualMonth)}`}>
                          {actualMonth ? <span className={getVarianceTextColor(budgetMonth, actualMonth)}>{formatCurrency(actualMonth)}</span> : <span className="text-gray-300">—</span>}
                        </td>
                      );
                    })}
                    <td className={`text-right py-3 px-4 font-bold tabular-nums text-lg rounded ${getVarianceStyle(yearlyTravelBudget, yearlyTravelActual)}`}>
                      <span className={getVarianceTextColor(yearlyTravelBudget, yearlyTravelActual)}>{formatCurrency(yearlyTravelActual)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* HOMEBASE + TRAVEL CALCULATOR */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-8 bg-white rounded-2xl border border-gray-200 overflow-hidden lg:overflow-x-auto shadow-sm hover:shadow-md transition-shadow">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-cyan-100 flex items-center justify-center">
                <span className="text-xl">📊</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Homebase + Travel</h2>
                <p className="text-sm text-gray-500">Select months you'll travel instead of staying home</p>
              </div>
            </div>
            
            {/* Month Selection */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Which months will you travel?</span>
                <div className="flex gap-2">
                  <button onClick={() => setTravelMonths([0,1,2,3,4,5,6,7,8,9,10,11])} className="text-xs px-3 py-1.5 bg-white text-gray-600 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors font-medium">All Travel</button>
                  <button onClick={() => setTravelMonths([])} className="text-xs px-3 py-1.5 bg-white text-gray-600 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors font-medium">All Home</button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {MONTHS.map((m, i) => (
                  <button 
                    key={i} 
                    onClick={() => setTravelMonths(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a,b) => a-b))}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                      travelMonths.includes(i) 
                        ? 'bg-cyan-500 text-white shadow-sm' 
                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                    }`}
                  >
                    {travelMonths.includes(i) ? '✈️' : '🏠'} {m.slice(0,3)}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 text-xs text-gray-500 mt-3">
                <span>🏠 {homeMonths.length} months at home</span>
                <span>✈️ {travelMonths.length} months traveling</span>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 border-b border-gray-100">
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="text-xs text-gray-500 mb-1 font-medium">🏠 Home Months</div>
                <div className="text-xl font-bold text-gray-900 tabular-nums">{formatCurrency(homeMonthsHomebaseBudget)}</div>
                <div className="text-xs text-amber-600 mt-1">Homebase cost</div>
                {homeMonthsTravelBudget > 0 && (
                  <div className="text-xs text-cyan-600 mt-0.5">+ {formatCurrency(homeMonthsTravelBudget)} travel</div>
                )}
              </div>
              
              <div className="p-4 bg-cyan-50 rounded-xl border border-cyan-100">
                <div className="text-xs text-gray-500 mb-1 font-medium">✈️ Travel Months</div>
                <div className="text-xl font-bold text-gray-900 tabular-nums">{formatCurrency(travelMonthsTravelBudget)}</div>
                <div className="text-xs text-cyan-600 mt-1">Travel cost only</div>
                <div className="text-xs text-gray-400 mt-0.5 line-through">{formatCurrency(travelMonthsHomebaseBudget)} homebase</div>
              </div>
              
              <div className={`p-4 rounded-xl border-2 ${travelSavings >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-xs text-gray-500 mb-1 font-medium">💵 Travel Savings</div>
                <div className={`text-xl font-bold tabular-nums ${travelSavings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {travelSavings >= 0 ? '+' : ''}{formatCurrency(travelSavings)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {travelSavings >= 0 ? 'Saved vs staying home' : 'Extra cost vs home'}
                </div>
              </div>
              
              <div className="p-4 bg-gradient-to-br from-[#b4b237]/10 to-[#b4b237]/5 rounded-xl border-2 border-[#b4b237]/30">
                <div className="text-xs text-gray-500 mb-1 font-medium">📊 Effective Total</div>
                <div className="text-xl font-bold text-[#8f8c2a] tabular-nums">{formatCurrency(effectiveYearlyCost)}</div>
                <div className="text-xs text-gray-500 mt-1">{selectedYear} projected spend</div>
              </div>
            </div>

            {/* Detailed Comparison Table */}
            <div className="overflow-x-auto lg:overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="py-3 px-4 text-left text-gray-600 font-semibold w-[80px] whitespace-normal">Category</th>
                    {MONTHS.map((m, i) => (
                      <th key={i} className={`text-right py-3 px-3 text-gray-600 font-medium min-w-[50px] lg:min-w-0 ${travelMonths.includes(i) ? 'bg-cyan-50/50' : 'bg-amber-50/50'}`}>
                        <div className="text-[10px] mb-0.5">{travelMonths.includes(i) ? '✈️' : '🏠'}</div>
                        {m.slice(0,3)}
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 font-bold text-gray-900 bg-gray-100/80 w-[80px]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-gray-700 font-medium">🏠 Homebase</td>
                    {MONTHS.map((_, i) => {
                      const val = yearBudget[i]?.total || 0;
                      const isTraveling = travelMonths.includes(i);
                      return (
                        <td key={i} className={`text-right py-3 px-3 tabular-nums ${isTraveling ? 'bg-cyan-50/30' : 'bg-amber-50/30'}`}>
                          {val ? (
                            <span className={isTraveling ? 'text-gray-300 line-through' : 'text-amber-600'}>
                              {formatCurrency(val)}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      );
                    })}
                    <td className="text-right py-3 px-4 font-bold tabular-nums text-amber-700 bg-gray-50/50">
                      {formatCurrency(homeMonthsHomebaseBudget)}
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-gray-700 font-medium">✈️ Travel</td>
                    {MONTHS.map((_, i) => { 
                      const mt = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      const isTraveling = travelMonths.includes(i);
                      return (
                        <td key={i} className={`text-right py-3 px-3 tabular-nums ${isTraveling ? 'bg-cyan-50/30' : 'bg-amber-50/30'}`}>
                          {mt ? (
                            <span className="text-cyan-600">{formatCurrency(mt)}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      ); 
                    })}
                    <td className="text-right py-3 px-4 font-bold tabular-nums text-cyan-700 bg-gray-50/50">
                      {formatCurrency(travelMonthsTravelBudget + homeMonthsTravelBudget)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-emerald-50 to-green-50 border-t-2 border-emerald-200">
                    <td className="py-3 px-4 font-bold text-gray-900">💵 Monthly Cost</td>
                    {MONTHS.map((_, i) => { 
                      const homebase = yearBudget[i]?.total || 0; 
                      const travel = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      const isTraveling = travelMonths.includes(i);
                      const effective = isTraveling ? travel : (homebase + travel);
                      return (
                        <td key={i} className={`text-right py-3 px-3 font-bold tabular-nums ${isTraveling ? 'text-cyan-600 bg-cyan-50/50' : 'text-amber-600 bg-amber-50/50'}`}>
                          {effective ? formatCurrency(effective) : <span className="text-gray-300">—</span>}
                        </td>
                      ); 
                    })}
                    <td className="text-right py-3 px-4 font-bold tabular-nums text-lg text-[#8f8c2a] bg-[#b4b237]/10">
                      {formatCurrency(effectiveYearlyCost)}
                    </td>
                  </tr>
                  <tr className="bg-violet-50/50 border-t border-violet-100">
                    <td className="py-3 px-4 text-violet-700 font-medium">📍 Trips</td>
                    {MONTHS.map((_, i) => {
                      const tripsInMonth = committedTrips.filter(t => {
                        if (!t.startDate) return false;
                        const start = new Date(new Date(t.startDate).getTime() + 12*60*60*1000);
                        return start.getMonth() === i && start.getFullYear() === selectedYear;
                      });
                      return (
                        <td key={i} className="text-center py-3 px-3 text-xs text-violet-600" style={{maxWidth: '80px', whiteSpace: 'normal', wordWrap: 'break-word'}}>
                          {tripsInMonth.length > 0 ? tripsInMonth.map(t => t.name).join(', ') : <span className="text-gray-300">—</span>}
                        </td>
                      );
                    })}
                    <td className="text-center py-3 px-4 text-xs text-violet-600 font-semibold bg-violet-100/30">
                      {committedTrips.filter(t => t.startDate && new Date(new Date(t.startDate).getTime() + 12*60*60*1000).getFullYear() === selectedYear).length} trips
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="px-6 py-4 text-center text-sm text-gray-500 bg-gray-50/50 border-t border-gray-100">
              <span className="text-amber-600">🏠 Home months</span> = Homebase + Travel costs &nbsp;|&nbsp; <span className="text-cyan-600">✈️ Travel months</span> = Travel cost only (homebase avoided)
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
