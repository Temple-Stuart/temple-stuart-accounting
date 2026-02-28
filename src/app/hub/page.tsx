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
  growth: { icon: '📚', color: 'text-brand-purple', bgColor: 'bg-brand-purple-wash', dotColor: 'bg-brand-purple-wash0', calendarColor: 'bg-blue-400' },
  trip: { icon: '✈️', color: 'text-cyan-600', bgColor: 'bg-cyan-50', dotColor: 'bg-cyan-500', calendarColor: 'bg-cyan-400' },
};

// Nomad metrics lookup by destination (static data - can be API-driven later)
const NOMAD_METRICS: Record<string, { costIndex: number; visa: string; timezone: string; internet: number; cowork: number; temp: number; safety: number }> = {
  'canggu': { costIndex: 0.35, visa: '30d VOA', timezone: 'UTC+8', internet: 45, cowork: 120, temp: 28, safety: 7.5 },
  'bali': { costIndex: 0.35, visa: '30d VOA', timezone: 'UTC+8', internet: 40, cowork: 120, temp: 28, safety: 7.5 },
  'kuala lumpur': { costIndex: 0.40, visa: '90d free', timezone: 'UTC+8', internet: 65, cowork: 150, temp: 32, safety: 7.8 },
  'da nang': { costIndex: 0.30, visa: '45d e-visa', timezone: 'UTC+7', internet: 50, cowork: 80, temp: 30, safety: 8.2 },
  'vietnam': { costIndex: 0.30, visa: '45d e-visa', timezone: 'UTC+7', internet: 50, cowork: 80, temp: 30, safety: 8.0 },
  'phuket': { costIndex: 0.45, visa: '60d free', timezone: 'UTC+7', internet: 55, cowork: 180, temp: 31, safety: 7.6 },
  'thailand': { costIndex: 0.40, visa: '60d free', timezone: 'UTC+7', internet: 55, cowork: 150, temp: 31, safety: 7.5 },
  'tarifa': { costIndex: 0.65, visa: '90d Schengen', timezone: 'UTC+1', internet: 80, cowork: 200, temp: 24, safety: 8.5 },
  'spain': { costIndex: 0.70, visa: '90d Schengen', timezone: 'UTC+1', internet: 100, cowork: 220, temp: 22, safety: 8.5 },
  'lisbon': { costIndex: 0.60, visa: '90d Schengen', timezone: 'UTC+0', internet: 90, cowork: 180, temp: 20, safety: 8.3 },
  'portugal': { costIndex: 0.60, visa: '90d Schengen', timezone: 'UTC+0', internet: 85, cowork: 180, temp: 20, safety: 8.3 },
  'mexico city': { costIndex: 0.45, visa: '180d free', timezone: 'UTC-6', internet: 60, cowork: 150, temp: 22, safety: 6.5 },
  'playa del carmen': { costIndex: 0.55, visa: '180d free', timezone: 'UTC-5', internet: 50, cowork: 180, temp: 28, safety: 6.8 },
  'medellin': { costIndex: 0.40, visa: '90d free', timezone: 'UTC-5', internet: 55, cowork: 120, temp: 24, safety: 6.5 },
  'buenos aires': { costIndex: 0.35, visa: '90d free', timezone: 'UTC-3', internet: 50, cowork: 100, temp: 18, safety: 6.2 },
  'siargao': { costIndex: 0.30, visa: '30d free', timezone: 'UTC+8', internet: 25, cowork: 80, temp: 29, safety: 7.8 },
  'philippines': { costIndex: 0.35, visa: '30d free', timezone: 'UTC+8', internet: 30, cowork: 100, temp: 30, safety: 7.0 },
};

const getNomadMetrics = (destination: string | null) => {
  if (!destination) return null;
  const d = destination.toLowerCase();
  for (const [key, metrics] of Object.entries(NOMAD_METRICS)) {
    if (d.includes(key)) return metrics;
  }
  return null;
};

// Auto-generate destination tags based on keywords
const getDestinationTag = (destination: string | null): { label: string; color: string } => {
  if (!destination) return { label: 'Adventure awaits', color: 'bg-brand-purple' };
  
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
  return 'bg-red-50 text-brand-red';
};

const getWsVarianceText = (budget: number, actual: number) => {
  if (actual === 0) return 'text-text-faint';
  if (actual <= budget) return 'text-emerald-700';
  return 'text-brand-red';
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
      <div className="min-h-screen bg-bg-terminal">
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
          
          {/* Header - Wall Street Style */}
          <div className="mb-6 bg-brand-purple text-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-sm font-semibold tracking-tight">
                  {session?.user?.name || 'Dashboard'}
                </h1>
                <p className="text-text-faint text-sm mt-0.5 font-mono">Financial Command Center · FY {selectedYear}</p>
              </div>
              <div className="text-right text-xs">
                <div className="text-text-faint">Last updated</div>
                <div className="font-mono">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* UPCOMING TRIPS - WALL STREET STYLE WITH IMAGES */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-terminal-lg font-semibold text-text-primary tracking-tight">Committed Trips</h2>
                <p className="text-xs text-text-muted">FY {selectedYear} · Nomad Itinerary · {committedTrips.length} destinations</p>
              </div>
              <button onClick={() => router.push('/budgets/trips')} className="text-xs text-text-secondary hover:text-text-primary font-medium">
                View all →
              </button>
            </div>
            
            {committedTrips.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {committedTrips.map(trip => {
                  const metrics = getNomadMetrics(trip.destination);
                  const nights = trip.startDate && trip.endDate 
                    ? Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / (1000 * 60 * 60 * 24))
                    : null;
                  const avgPerNight = nights && nights > 0 ? Math.round(trip.totalBudget / nights) : null;
                  
                  return (
                    <div 
                      key={trip.id}
                      onClick={() => router.push(`/budgets/trips/${trip.id}`)}
                      className="border border-border bg-white cursor-pointer hover:shadow-sm transition-shadow group"
                    >
                      {/* Image */}
                      <div className="relative h-[120px] overflow-hidden">
                        {/* Gradient placeholder - always rendered, visible when image fails or no destination */}
                        <div className="w-full h-full bg-gradient-to-br from-brand-purple-deep to-brand-purple-hover flex items-center justify-center">
                          <span className="text-white/50 text-3xl font-mono">{(trip.destination || trip.name || '?').charAt(0)}</span>
                        </div>
                        {/* Photo from proxy - overlays placeholder, hides on error */}
                        {trip.destination && (
                          <img
                            src={`/api/places/photo?destination=${encodeURIComponent(trip.destination)}`}
                            alt={trip.destination || trip.name}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        {/* Overlay with destination name */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <div className="font-semibold text-white text-sm truncate">{trip.destination || trip.name}</div>
                          <div className="text-[10px] text-text-faint font-mono">
                            {trip.startDate ? new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
                            {trip.endDate && ` – ${new Date(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                            {nights && ` · ${nights}N`}
                          </div>
                        </div>
                      </div>
                      
                      {/* Budget Row */}
                      <div className="bg-brand-purple text-white px-3 py-2 flex justify-between items-center">
                        <div>
                          <div className="text-terminal-lg font-bold font-mono">{fmt(trip.totalBudget)}</div>
                          <div className="text-[10px] text-text-faint">total budget</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono">{avgPerNight ? `$${avgPerNight}` : '—'}/nt</div>
                          <div className="text-[10px] text-text-faint">avg cost</div>
                        </div>
                      </div>

                      {/* Metrics Grid */}
                      {metrics ? (
                        <div className="grid grid-cols-3 divide-x divide-border text-xs border-b border-border">
                          <div className="p-1.5 text-center">
                            <div className="text-text-faint text-[9px]">Cost</div>
                            <div className={`font-mono font-semibold text-[11px] ${metrics.costIndex < 0.5 ? 'text-emerald-700' : metrics.costIndex < 0.7 ? 'text-text-secondary' : 'text-brand-red'}`}>{metrics.costIndex}x</div>
                          </div>
                          <div className="p-1.5 text-center">
                            <div className="text-text-faint text-[9px]">Visa</div>
                            <div className="font-mono font-semibold text-[11px] text-text-secondary">{metrics.visa.split(' ')[0]}</div>
                          </div>
                          <div className="p-1.5 text-center">
                            <div className="text-text-faint text-[9px]">TZ</div>
                            <div className="font-mono font-semibold text-[11px] text-text-secondary">{metrics.timezone.replace('UTC', '')}</div>
                          </div>
                        </div>
                      ) : null}
                      {metrics ? (
                        <div className="grid grid-cols-3 divide-x divide-border text-xs">
                          <div className="p-1.5 text-center">
                            <div className="text-text-faint text-[9px]">WiFi</div>
                            <div className={`font-mono font-semibold text-[11px] ${metrics.internet >= 50 ? 'text-emerald-700' : 'text-text-secondary'}`}>{metrics.internet}M</div>
                          </div>
                          <div className="p-1.5 text-center">
                            <div className="text-text-faint text-[9px]">Cowork</div>
                            <div className="font-mono font-semibold text-[11px] text-text-secondary">${metrics.cowork}</div>
                          </div>
                          <div className="p-1.5 text-center">
                            <div className="text-text-faint text-[9px]">Temp</div>
                            <div className="font-mono font-semibold text-[11px] text-text-secondary">{metrics.temp}°</div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 text-center text-[10px] text-text-faint">No metrics</div>
                      )}

                      {/* Status Bar */}
                      <div className="bg-bg-row px-2 py-1 text-[9px] text-text-muted flex justify-between border-t border-border">
                        {metrics ? (
                          <>
                            <span>Safety {metrics.safety}</span>
                            <span className={metrics.costIndex < 0.5 ? 'text-emerald-600 font-medium' : ''}>{Math.round((1 - metrics.costIndex) * 100)}% savings</span>
                          </>
                        ) : (
                          <span className="w-full text-center">Add destination data</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* Add Trip Card */}
                <div onClick={() => router.push('/budgets/trips/new')} className="border border-dashed border-border bg-white flex flex-col items-center justify-center cursor-pointer hover:border-brand-purple hover:bg-bg-row transition-colors" style={{minHeight: '280px'}}>
                  <div className="w-10 h-10 border-2 border-border flex items-center justify-center mb-2">
                    <span className="text-text-faint text-sm">+</span>
                  </div>
                  <span className="text-text-muted text-sm font-medium">Add Trip</span>
                </div>
              </div>
            ) : (
              <div onClick={() => router.push('/budgets/trips/new')} className="border border-dashed border-border bg-white p-8 text-center cursor-pointer hover:border-brand-purple hover:bg-bg-row transition-colors">
                <div className="text-text-faint mb-2">No committed trips</div>
                <span className="text-sm text-brand-purple font-medium">+ Add Trip</span>
              </div>
            )}
          </div>
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CALENDAR - macOS STYLE */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6 bg-white rounded border border-border overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-row/50">
              <div className="flex items-center gap-4">
                <div className="flex bg-border/70 rounded p-0.5">
                  <button onClick={() => setCalendarView('week')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${calendarView === 'week' ? 'bg-white shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>Week</button>
                  <button onClick={() => setCalendarView('month')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${calendarView === 'month' ? 'bg-white shadow-sm text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>Month</button>
                </div>
              </div>
              <h2 className="text-sm font-semibold text-text-primary">{calendarView === 'week' ? `${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}` : `${MONTHS[selectedMonth]} ${selectedYear}`}</h2>
              <div className="flex items-center gap-2">
                <button onClick={goToToday} className="px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-row rounded border border-border transition-colors">Today</button>
                <button onClick={calendarView === 'week' ? prevWeek : prevMonth} className="w-8 h-8 flex items-center justify-center text-text-muted rounded hover:bg-bg-row transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
                <button onClick={calendarView === 'week' ? nextWeek : nextMonth} className="w-8 h-8 flex items-center justify-center text-text-muted rounded hover:bg-bg-row transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
              </div>
            </div>
            <div className="flex">
              <div className="w-44 border-r border-border p-3 bg-bg-row/30 hidden sm:block">
                <div className="space-y-0.5">
                  {Object.entries(SOURCE_CONFIG).map(([source, config]) => (
                    <label key={source} className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:bg-bg-row transition-colors">
                      <input type="checkbox" checked={visibleCategories[source]} onChange={(e) => setVisibleCategories(prev => ({ ...prev, [source]: e.target.checked }))} className="sr-only" />
                      <div className={`w-3 h-3 rounded-sm transition-colors ${visibleCategories[source] ? config.calendarColor : 'bg-border'}`} />
                      <span className={`text-sm transition-colors ${visibleCategories[source] ? 'text-text-secondary font-medium' : 'text-text-faint'}`}>{source.charAt(0).toUpperCase() + source.slice(1)}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {calendarView === 'week' ? (
                  <div>
                    <div className="grid grid-cols-7 border-b border-border">
                      {weekDays.map((day, idx) => {
                        const isToday = day.toDateString() === now.toDateString();
                        return (
                          <div key={idx} className={`text-center py-3 border-r border-border-light last:border-r-0 ${isToday ? 'bg-red-50' : ''}`}>
                            <div className="text-xs text-text-muted uppercase tracking-wide font-medium">{DAYS[day.getDay()]}</div>
                            <div className={`text-sm font-light mt-0.5 ${isToday ? 'bg-red-500 text-white w-9 h-9 rounded-full flex items-center justify-center mx-auto' : 'text-text-primary'}`}>{day.getDate()}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-7 min-h-[320px]">
                      {weekDays.map((day, idx) => {
                        const dayEvents = getEventsForDate(day);
                        const isToday = day.toDateString() === now.toDateString();
                        return (
                          <div key={idx} className={`border-r border-border-light last:border-r-0 p-1.5 ${isToday ? 'bg-red-50/30' : ''}`}>
                            <div className="space-y-1">
                              {dayEvents.slice(0, 8).map((event, eventIdx) => {
                                const config = SOURCE_CONFIG[event.source] || SOURCE_CONFIG.home;
                                return (<div key={event.id || eventIdx} className={`${config.calendarColor} text-white text-xs px-2 py-1.5 rounded truncate cursor-pointer hover:opacity-90 transition-opacity`} title={`${event.title} - ${formatCurrency(event.budget_amount)}`}>{event.title}</div>);
                              })}
                              {dayEvents.length > 8 && <div className="text-xs text-text-muted px-2">+{dayEvents.length - 8} more</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="grid grid-cols-7 gap-1 mb-2">{DAYS.map(day => <div key={day} className="text-center text-sm font-semibold text-text-muted py-2">{day}</div>)}</div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, idx) => {
                        if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
                        const dayEvents = eventsByDay[day]?.filter(e => visibleCategories[e.source]) || [];
                        const dayTotal = dayEvents.reduce((sum: number, e: CalendarEvent) => sum + e.budget_amount, 0);
                        const isToday = day === now.getDate() && selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
                        return (
                          <div key={day} className={`aspect-square p-1 rounded border overflow-hidden transition-all cursor-pointer hover:border-border ${isToday ? "border-red-400 border-2 bg-red-50" : "border-border-light bg-bg-row/50"}`}>
                            <div className="flex flex-col h-full">
                              <div className={`text-xs font-semibold mb-1 ${isToday ? "text-brand-red" : "text-text-secondary"}`}>{day}</div>
                              {dayEvents.length > 0 && (
                                <div className="flex-1 flex flex-col justify-end">
                                  <div className="flex flex-wrap gap-0.5 mb-1">
                                    {dayEvents.slice(0, 4).map((e: CalendarEvent, i: number) => { const config = SOURCE_CONFIG[e.source] || SOURCE_CONFIG.home; return <div key={i} className={`w-2 h-2 rounded-full ${config.dotColor}`} title={e.title} />; })}
                                    {dayEvents.length > 4 && <span className="text-[8px] text-text-faint">+{dayEvents.length - 4}</span>}
                                  </div>
                                  <div className="text-[10px] font-bold text-text-secondary tabular-nums truncate">{formatCurrency(dayTotal)}</div>
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
                <h2 className="text-sm font-semibold text-text-primary tracking-tight">Budget Comparison</h2>
                <p className="text-sm text-text-muted mt-0.5">FY {selectedYear} · Homebase + Business + Travel · USD</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-600 rounded-sm"></span><span className="text-text-secondary">Under Budget</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-600 rounded-sm"></span><span className="text-text-secondary">Over Budget</span></span>
                <div className="h-4 w-px bg-border mx-2"></div>
                <button onClick={() => setSelectedYear(y => y - 1)} className="px-2 py-1 text-text-secondary hover:bg-bg-row rounded">◀</button>
                <span className="font-semibold text-text-primary">{selectedYear}</span>
                <button onClick={() => setSelectedYear(y => y + 1)} className="px-2 py-1 text-text-secondary hover:bg-bg-row rounded">▶</button>
              </div>
            </div>

            {/* Month Toggle */}
            <div className="mb-4 p-4 bg-white border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-text-secondary">Travel months (homebase costs excluded):</span>
                <div className="flex gap-2">
                  <button onClick={() => setTravelMonths([0,1,2,3,4,5,6,7,8,9,10,11])} className="text-xs px-3 py-1 text-text-secondary hover:bg-bg-row border border-border transition-colors font-medium">All Travel</button>
                  <button onClick={() => setTravelMonths([])} className="text-xs px-3 py-1 text-text-secondary hover:bg-bg-row border border-border transition-colors font-medium">All Home</button>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {MONTHS_SHORT.map((m, i) => (
                  <button 
                    key={i} 
                    onClick={() => setTravelMonths(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a,b) => a-b))}
                    className={`px-3 py-1.5 text-xs font-mono font-medium transition-all border ${
                      travelMonths.includes(i) 
                        ? 'bg-brand-purple text-white border-brand-purple' 
                        : 'bg-white text-text-secondary border-border hover:bg-bg-row'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex gap-6 text-xs text-text-muted mt-3 font-mono">
                <span>Home: {homeMonths.length} mo</span>
                <span>Travel: {travelMonths.length} mo</span>
              </div>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border mb-4">
              <div className="bg-white p-4">
                <div className="text-xs text-text-muted font-medium mb-1">Home Months Cost</div>
                <div className="text-sm font-bold text-text-primary font-mono">{fmt(homeMonthsHomebaseBudget)}</div>
                <div className="text-xs text-text-muted mt-1">+ {fmt(homeMonthsTravelBudget)} travel</div>
              </div>
              <div className="bg-white p-4">
                <div className="text-xs text-text-muted font-medium mb-1">Travel Months Cost</div>
                <div className="text-sm font-bold text-text-primary font-mono">{fmt(travelMonthsTravelBudget)}</div>
                <div className="text-xs text-text-faint line-through mt-1">{fmt(travelMonthsHomebaseBudget)} homebase</div>
              </div>
              <div className="bg-white p-4">
                <div className="text-xs text-text-muted font-medium mb-1">Travel Savings</div>
                <div className={`text-sm font-bold font-mono ${travelSavings >= 0 ? 'text-emerald-700' : 'text-brand-red'}`}>{travelSavings >= 0 ? '+' : ''}{fmt(travelSavings)}</div>
                <div className="text-xs text-text-muted mt-1">{travelSavings >= 0 ? 'Saved vs home' : 'Extra vs home'}</div>
              </div>
              <div className="bg-brand-purple p-4 text-white">
                <div className="text-xs text-text-faint font-medium mb-1">Effective Total</div>
                <div className="text-sm font-bold font-mono">{fmt(effectiveYearlyCost)}</div>
                <div className="text-xs text-text-faint mt-1">{selectedYear} projected</div>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="border border-border bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-brand-purple text-white">
                    <th className="text-left py-2 px-3 font-medium border-r border-brand-purple-hover w-36">Category</th>
                    {MONTHS_SHORT.map((m, i) => (
                      <th key={m} className={`py-2 px-2 font-medium border-r border-brand-purple-hover text-right min-w-[55px] ${travelMonths.includes(i) ? 'bg-panel-highlight' : ''}`}>{m}</th>
                    ))}
                    <th className="py-2 px-3 font-medium text-right bg-panel-highlight min-w-[70px]">FY Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border bg-white hover:bg-brand-purple-wash/30">
                    <td className="py-2 px-3 font-medium text-text-primary border-r border-border">Homebase</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const val = yearBudget[i]?.total || 0;
                      const isTraveling = travelMonths.includes(i);
                      return (
                        <td key={i} className={`py-2 px-2 text-right font-mono border-r border-border-light ${isTraveling ? 'bg-bg-row' : ''}`}>
                          <span className={isTraveling ? 'text-text-faint line-through' : 'text-text-secondary'}>{fmt(val)}</span>
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right font-mono font-semibold text-text-primary bg-bg-row">{fmt(homeMonthsHomebaseBudget)}</td>
                  </tr>
                  <tr className="border-b border-border bg-bg-row/50 hover:bg-brand-purple-wash/30">
                    <td className="py-2 px-3 font-medium text-text-primary border-r border-border">Business</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const val = Object.values(businessBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (<td key={i} className="py-2 px-2 text-right font-mono border-r border-border-light text-text-secondary">{fmt(val)}</td>);
                    })}
                    <td className="py-2 px-3 text-right font-mono font-semibold text-text-primary bg-bg-row">{fmt(yearlyBusinessBudget)}</td>
                  </tr>
                  <tr className="border-b border-border bg-white hover:bg-brand-purple-wash/30">
                    <td className="py-2 px-3 font-medium text-text-primary border-r border-border">Travel</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const val = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (<td key={i} className="py-2 px-2 text-right font-mono border-r border-border-light text-text-secondary">{fmt(val)}</td>);
                    })}
                    <td className="py-2 px-3 text-right font-mono font-semibold text-text-primary bg-bg-row">{fmt(yearlyTravelBudget)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-brand-purple text-white font-semibold">
                    <td className="py-2 px-3 border-r border-brand-purple-hover">Monthly Total</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const homebase = yearBudget[i]?.total || 0;
                      const business = Object.values(businessBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      const travel = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      const isTraveling = travelMonths.includes(i);
                      const effective = isTraveling ? (travel + business) : (homebase + travel + business);
                      return (<td key={i} className={`py-2 px-2 text-right font-mono border-r border-brand-purple-hover ${isTraveling ? 'bg-panel-highlight' : ''}`}>{fmt(effective)}</td>);
                    })}
                    <td className="py-2 px-3 text-right font-mono bg-panel-highlight">{fmt(effectiveYearlyCost)}</td>
                  </tr>
                  <tr className="bg-bg-row text-text-secondary text-[10px]">
                    <td className="py-1.5 px-3 border-r border-border">Trips</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const tripsInMonth = committedTrips.filter(t => {
                        if (!t.startDate) return false;
                        const start = new Date(new Date(t.startDate).getTime() + 12*60*60*1000);
                        return start.getMonth() === i && start.getFullYear() === selectedYear;
                      });
                      return (
                        <td key={i} className="py-1.5 px-1 text-center border-r border-border-light truncate" style={{maxWidth: '55px'}}>
                          {tripsInMonth.length > 0 ? tripsInMonth.map(t => t.destination?.split(',')[0] || t.name).join(', ') : '—'}
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-3 text-center bg-border font-medium">{committedTrips.filter(t => t.startDate && new Date(new Date(t.startDate).getTime() + 12*60*60*1000).getFullYear() === selectedYear).length} trips</td>
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
                <h2 className="text-terminal-lg font-semibold text-text-primary tracking-tight">Homebase Operating Expenses</h2>
                <p className="text-xs text-text-muted">FY {selectedYear} · Budget vs Actual · USD</p>
              </div>
            </div>
            <div className="border border-border bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-brand-purple text-white">
                    <th className="text-left py-2 px-3 font-medium border-r border-brand-purple-hover w-40">Account</th>
                    <th className="py-2 px-2 font-medium border-r border-brand-purple-hover w-10 text-center">Type</th>
                    {MONTHS_SHORT.map(m => <th key={m} className="py-2 px-2 font-medium border-r border-brand-purple-hover text-right min-w-[55px]">{m}</th>)}
                    <th className="py-2 px-3 font-medium text-right bg-panel-highlight min-w-[70px]">FY Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(SOURCE_CONFIG).filter(([s]) => s !== 'trip').map(([source, config], idx) => {
                    const budgetTotal = Object.values(yearBudget).reduce((sum, m) => sum + (m[source] || 0), 0);
                    const actualTotal = Object.values(yearActual).reduce((sum, m) => sum + (m[source] || 0), 0);
                    return (
                      <Fragment key={source}>
                        <tr className={`hover:bg-brand-purple-wash/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row/50'}`}>
                          <td rowSpan={2} className="py-1.5 px-3 border-r border-border align-top">
                            <div className="font-medium text-text-primary">{CATEGORY_NAMES[source] || source}</div>
                            <div className="text-[10px] text-text-faint font-mono uppercase">{source}</div>
                          </td>
                          <td className="py-1.5 px-2 text-[10px] text-text-muted border-r border-border text-center font-medium">BUD</td>
                          {MONTHS_SHORT.map((_, i) => (
                            <td key={i} className="py-1.5 px-2 text-right font-mono text-text-secondary border-r border-border-light">{fmt(yearBudget[i]?.[source] || 0)}</td>
                          ))}
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-text-primary bg-bg-row/50">{fmt(budgetTotal)}</td>
                        </tr>
                        <tr className={`border-b border-border hover:bg-brand-purple-wash/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row/50'}`}>
                          <td className="py-1.5 px-2 text-[10px] text-text-muted border-r border-border text-center font-medium">ACT</td>
                          {MONTHS_SHORT.map((_, i) => {
                            const bud = yearBudget[i]?.[source] || 0;
                            const act = yearActual[i]?.[source] || 0;
                            return (
                              <td key={i} className={`py-1.5 px-2 text-right font-mono border-r border-border-light ${act > 0 && act > bud ? 'text-brand-red bg-red-50' : act > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-text-faint'}`}>
                                {fmt(act)}
                              </td>
                            );
                          })}
                          <td className={`py-1.5 px-3 text-right font-mono font-semibold ${actualTotal > 0 && actualTotal > budgetTotal ? 'text-brand-red bg-red-100/50' : actualTotal > 0 ? 'text-emerald-700 bg-emerald-100/50' : 'text-text-faint bg-bg-row/50'}`}>
                            {fmt(actualTotal)}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-brand-purple text-white font-semibold">
                    <td className="py-2 px-3 border-r border-brand-purple-hover">Total</td>
                    <td className="py-2 px-2 text-[10px] border-r border-brand-purple-hover text-center">BUD</td>
                    {MONTHS_SHORT.map((_, i) => (<td key={i} className="py-2 px-2 text-right font-mono border-r border-brand-purple-hover">{fmt(yearBudget[i]?.total || 0)}</td>))}
                    <td className="py-2 px-3 text-right font-mono bg-panel-highlight">{fmt(yearlyHomebaseBudget)}</td>
                  </tr>
                  <tr className="bg-brand-purple-hover text-white">
                    <td className="py-2 px-3 border-r border-brand-purple-hover"></td>
                    <td className="py-2 px-2 text-[10px] border-r border-brand-purple-hover text-center">ACT</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const bud = yearBudget[i]?.total || 0;
                      const act = yearActual[i]?.total || 0;
                      return (<td key={i} className={`py-2 px-2 text-right font-mono border-r border-brand-purple-hover ${act > 0 && act > bud ? 'text-red-300' : act > 0 ? 'text-emerald-300' : ''}`}>{fmt(act)}</td>);
                    })}
                    <td className={`py-2 px-3 text-right font-mono bg-panel-highlight ${yearlyHomebaseActual > yearlyHomebaseBudget ? 'text-red-300' : yearlyHomebaseActual > 0 ? 'text-emerald-300' : ''}`}>{fmt(yearlyHomebaseActual)}</td>
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
                <h2 className="text-terminal-lg font-semibold text-text-primary tracking-tight">Travel Operating Expenses</h2>
                <p className="text-xs text-text-muted">FY {selectedYear} · Budget vs Actual · USD</p>
              </div>
            </div>
            <div className="border border-border bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-brand-purple text-white">
                    <th className="text-left py-2 px-3 font-medium border-r border-brand-purple-hover w-40">Account</th>
                    <th className="py-2 px-2 font-medium border-r border-brand-purple-hover w-10 text-center">Type</th>
                    {MONTHS_SHORT.map(m => <th key={m} className="py-2 px-2 font-medium border-r border-brand-purple-hover text-right min-w-[55px]">{m}</th>)}
                    <th className="py-2 px-3 font-medium text-right bg-panel-highlight min-w-[70px]">FY Total</th>
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
                        <tr className={`hover:bg-brand-purple-wash/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row/50'}`}>
                          <td rowSpan={2} className="py-1.5 px-3 border-r border-border align-top">
                            <div className="font-medium text-text-primary">{name.replace(/^[^\w]+/, '')}</div>
                            <div className="text-[10px] text-text-faint font-mono">{code}</div>
                          </td>
                          <td className="py-1.5 px-2 text-[10px] text-text-muted border-r border-border text-center font-medium">BUD</td>
                          {MONTHS_SHORT.map((_, i) => (<td key={i} className="py-1.5 px-2 text-right font-mono text-text-secondary border-r border-border-light">{fmt(budgetRow[i] || 0)}</td>))}
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-text-primary bg-bg-row/50">{fmt(budgetTotal)}</td>
                        </tr>
                        <tr className={`border-b border-border hover:bg-brand-purple-wash/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row/50'}`}>
                          <td className="py-1.5 px-2 text-[10px] text-text-muted border-r border-border text-center font-medium">ACT</td>
                          {MONTHS_SHORT.map((_, i) => {
                            const bud = budgetRow[i] || 0;
                            const act = actualRow[i] || 0;
                            return (<td key={i} className={`py-1.5 px-2 text-right font-mono border-r border-border-light ${act > 0 && act > bud ? 'text-brand-red bg-red-50' : act > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-text-faint'}`}>{fmt(act)}</td>);
                          })}
                          <td className={`py-1.5 px-3 text-right font-mono font-semibold ${actualTotal > 0 && actualTotal > budgetTotal ? 'text-brand-red bg-red-100/50' : actualTotal > 0 ? 'text-emerald-700 bg-emerald-100/50' : 'text-text-faint bg-bg-row/50'}`}>{fmt(actualTotal)}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-brand-purple text-white font-semibold">
                    <td className="py-2 px-3 border-r border-brand-purple-hover">Total</td>
                    <td className="py-2 px-2 text-[10px] border-r border-brand-purple-hover text-center">BUD</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const monthTotal = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (<td key={i} className="py-2 px-2 text-right font-mono border-r border-brand-purple-hover">{fmt(monthTotal)}</td>);
                    })}
                    <td className="py-2 px-3 text-right font-mono bg-panel-highlight">{fmt(yearlyTravelBudget)}</td>
                  </tr>
                  <tr className="bg-brand-purple-hover text-white">
                    <td className="py-2 px-3 border-r border-brand-purple-hover"></td>
                    <td className="py-2 px-2 text-[10px] border-r border-brand-purple-hover text-center">ACT</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const budMonth = Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      const actMonth = Object.values(nomadBudget.actualData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (<td key={i} className={`py-2 px-2 text-right font-mono border-r border-brand-purple-hover ${actMonth > 0 && actMonth > budMonth ? 'text-red-300' : actMonth > 0 ? 'text-emerald-300' : ''}`}>{fmt(actMonth)}</td>);
                    })}
                    <td className={`py-2 px-3 text-right font-mono bg-panel-highlight ${yearlyTravelActual > yearlyTravelBudget ? 'text-red-300' : yearlyTravelActual > 0 ? 'text-emerald-300' : ''}`}>{fmt(yearlyTravelActual)}</td>
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
                <h2 className="text-terminal-lg font-semibold text-text-primary tracking-tight">Business Operating Expenses</h2>
                <p className="text-xs text-text-muted">FY {selectedYear} · Budget vs Actual · USD</p>
              </div>
            </div>
            {Object.keys(businessBudget.coaNames).length > 0 ? (
              <div className="border border-border bg-white overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-brand-purple text-white">
                      <th className="text-left py-2 px-3 font-medium border-r border-brand-purple-hover w-40">Account</th>
                      <th className="py-2 px-2 font-medium border-r border-brand-purple-hover w-10 text-center">Type</th>
                      {MONTHS_SHORT.map(m => <th key={m} className="py-2 px-2 font-medium border-r border-brand-purple-hover text-right min-w-[55px]">{m}</th>)}
                      <th className="py-2 px-3 font-medium text-right bg-panel-highlight min-w-[70px]">FY Total</th>
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
                          <tr className={`hover:bg-brand-purple-wash/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row/50'}`}>
                            <td rowSpan={2} className="py-1.5 px-3 border-r border-border align-top">
                              <div className="font-medium text-text-primary">{name}</div>
                              <div className="text-[10px] text-text-faint font-mono">{code}</div>
                            </td>
                            <td className="py-1.5 px-2 text-[10px] text-text-muted border-r border-border text-center font-medium">BUD</td>
                            {MONTHS_SHORT.map((_, i) => (<td key={i} className="py-1.5 px-2 text-right font-mono text-text-secondary border-r border-border-light">{fmt(budgetRow[i] || 0)}</td>))}
                            <td className="py-1.5 px-3 text-right font-mono font-semibold text-text-primary bg-bg-row/50">{fmt(budgetTotal)}</td>
                          </tr>
                          <tr className={`border-b border-border hover:bg-brand-purple-wash/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row/50'}`}>
                            <td className="py-1.5 px-2 text-[10px] text-text-muted border-r border-border text-center font-medium">ACT</td>
                            {MONTHS_SHORT.map((_, i) => {
                              const bud = budgetRow[i] || 0;
                              const act = actualRow[i] || 0;
                              return (<td key={i} className={`py-1.5 px-2 text-right font-mono border-r border-border-light ${act > 0 && act > bud ? 'text-brand-red bg-red-50' : act > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-text-faint'}`}>{fmt(act)}</td>);
                            })}
                            <td className={`py-1.5 px-3 text-right font-mono font-semibold ${actualTotal > 0 && actualTotal > budgetTotal ? 'text-brand-red bg-red-100/50' : actualTotal > 0 ? 'text-emerald-700 bg-emerald-100/50' : 'text-text-faint bg-bg-row/50'}`}>{fmt(actualTotal)}</td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-brand-purple text-white font-semibold">
                      <td className="py-2 px-3 border-r border-brand-purple-hover">Total</td>
                      <td className="py-2 px-2 text-[10px] border-r border-brand-purple-hover text-center">BUD</td>
                      {MONTHS_SHORT.map((_, i) => {
                        const monthTotal = Object.values(businessBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                        return (<td key={i} className="py-2 px-2 text-right font-mono border-r border-brand-purple-hover">{fmt(monthTotal)}</td>);
                      })}
                      <td className="py-2 px-3 text-right font-mono bg-panel-highlight">{fmt(yearlyBusinessBudget)}</td>
                    </tr>
                    <tr className="bg-brand-purple-hover text-white">
                      <td className="py-2 px-3 border-r border-brand-purple-hover"></td>
                      <td className="py-2 px-2 text-[10px] border-r border-brand-purple-hover text-center">ACT</td>
                      {MONTHS_SHORT.map((_, i) => {
                        const budMonth = Object.values(businessBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                        const actMonth = Object.values(businessBudget.actualData).reduce((s, coa) => s + (coa[i] || 0), 0);
                        return (<td key={i} className={`py-2 px-2 text-right font-mono border-r border-brand-purple-hover ${actMonth > 0 && actMonth > budMonth ? 'text-red-300' : actMonth > 0 ? 'text-emerald-300' : ''}`}>{fmt(actMonth)}</td>);
                      })}
                      <td className={`py-2 px-3 text-right font-mono bg-panel-highlight ${yearlyBusinessActual > yearlyBusinessBudget ? 'text-red-300' : yearlyBusinessActual > 0 ? 'text-emerald-300' : ''}`}>{fmt(yearlyBusinessActual)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="border border-border bg-white p-8 text-center">
                <div className="text-text-faint mb-2">No business accounts configured</div>
                <div className="text-xs text-text-faint">Map transactions to B-xxxx accounts to see them here</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-xs text-text-faint text-center py-4">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Source: Temple Stuart Ledger
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
