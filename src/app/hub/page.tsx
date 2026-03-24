'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppLayout, Card, Badge } from '@/components/ui';
import BudgetDrillDown from '@/components/hub/BudgetDrillDown';
import CalendarGrid, { CalendarEvent as GridEvent, SourceConfig } from '@/components/shared/CalendarGrid';

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

// CalendarGrid-compatible config derived from SOURCE_CONFIG
const HUB_GRID_CONFIG: Record<string, SourceConfig> = Object.fromEntries(
  Object.entries(SOURCE_CONFIG).map(([key, cfg]) => [key, {
    label: key.charAt(0).toUpperCase() + key.slice(1),
    icon: cfg.icon,
    bg: cfg.bgColor,
    dot: cfg.dotColor,
    badge: cfg.calendarColor,
    text: cfg.color,
  }])
);

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

  const [committedTrips, setCommittedTrips] = useState<Array<{
    id: string; name: string; destination: string | null;
    latitude: number | null; longitude: number | null;
    startDate: string | null; endDate: string | null; totalBudget: number; destinationPhoto: string | null;
  }>>([]);
  
  const [homebaseBudget, setHomebaseBudget] = useState<{
    budgetData: Record<string, Record<number, number>>;
    actualData: Record<string, Record<number, number>>;
    coaNames: Record<string, string>;
    budgetGrandTotal: number;
    actualGrandTotal: number;
  }>({ budgetData: {}, actualData: {}, coaNames: {}, budgetGrandTotal: 0, actualGrandTotal: 0 });
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


  const [drillDown, setDrillDown] = useState<{
    coaCodes: string[];
    month: number;
    year: number;
    categoryName: string;
    cellAmount: number;
    entityType: string;
  } | null>(null);

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
        setHomebaseBudget({
          budgetData: data.budgetData || {},
          actualData: data.actualData || {},
          coaNames: data.coaNames || {},
          budgetGrandTotal: data.budgetGrandTotal || 0,
          actualGrandTotal: data.actualGrandTotal || 0
        });
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
  const openDrill = (coaCodes: string[], month: number, name: string, amount: number, entityType: string) => {
    if (amount > 0) setDrillDown({ coaCodes, month, year: selectedYear, categoryName: name, cellAmount: amount, entityType });
  };


  // Calculator logic
  const homeMonths = MONTHS.map((_, i) => i).filter(i => !travelMonths.includes(i));
  const travelMonthsHomebaseBudget = travelMonths.reduce((sum, i) => sum + Object.values(homebaseBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
  const travelMonthsTravelBudget = travelMonths.reduce((sum, i) => sum + Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
  const travelSavings = travelMonthsHomebaseBudget - travelMonthsTravelBudget;
  const homeMonthsHomebaseBudget = homeMonths.reduce((sum, i) => sum + Object.values(homebaseBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
  const homeMonthsTravelBudget = homeMonths.reduce((sum, i) => sum + Object.values(nomadBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
  const homeMonthsCombined = homeMonthsHomebaseBudget + homeMonthsTravelBudget;
  const yearlyHomebaseBudget = homebaseBudget.budgetGrandTotal;
  const yearlyHomebaseActual = homebaseBudget.actualGrandTotal;
  const yearlyTravelBudget = nomadBudget.budgetGrandTotal;
  const yearlyTravelActual = nomadBudget.actualGrandTotal;
  const yearlyBusinessBudget = businessBudget.budgetGrandTotal;
  const yearlyBusinessActual = businessBudget.actualGrandTotal;
  const effectiveYearlyCost = homeMonthsCombined + travelMonthsTravelBudget + yearlyBusinessBudget;

  // Transform hub events to CalendarGrid format
  const gridEvents: GridEvent[] = useMemo(() => events.map(e => ({
    id: e.id,
    source: e.source,
    title: e.title,
    icon: e.icon,
    startDate: e.start_date,
    endDate: e.end_date,
    isRecurring: e.is_recurring,
    location: e.location,
    budgetAmount: e.budget_amount,
  })), [events]);

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
          {/* CALENDAR - macOS STYLE (extracted CalendarGrid component) */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6">
            <CalendarGrid
              events={gridEvents}
              sourceConfig={HUB_GRID_CONFIG}
              defaultView="week"
              showBudgetTotals={true}
              showCategoryLegend={true}
            />
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
                      const val = Object.values(homebaseBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
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
                      const homebase = Object.values(homebaseBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
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
                  {Object.entries(homebaseBudget.coaNames).map(([code, name], idx) => {
                    const budgetRow = homebaseBudget.budgetData[code] || {};
                    const actualRow = homebaseBudget.actualData[code] || {};
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
                            return (<td key={i} onClick={() => openDrill([code], i, name, act, 'personal')} className={`py-1.5 px-2 text-right font-mono border-r border-border-light ${act > 0 ? 'cursor-pointer' : ''} ${act > 0 && act > bud ? 'text-brand-red bg-red-50' : act > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-text-faint'}`}>{fmt(act)}</td>);
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
                      const monthTotal = Object.values(homebaseBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (<td key={i} className="py-2 px-2 text-right font-mono border-r border-brand-purple-hover">{fmt(monthTotal)}</td>);
                    })}
                    <td className="py-2 px-3 text-right font-mono bg-panel-highlight">{fmt(yearlyHomebaseBudget)}</td>
                  </tr>
                  <tr className="bg-brand-purple-hover text-white">
                    <td className="py-2 px-3 border-r border-brand-purple-hover"></td>
                    <td className="py-2 px-2 text-[10px] border-r border-brand-purple-hover text-center">ACT</td>
                    {MONTHS_SHORT.map((_, i) => {
                      const budMonth = Object.values(homebaseBudget.budgetData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      const actMonth = Object.values(homebaseBudget.actualData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return (<td key={i} onClick={() => openDrill(Object.keys(homebaseBudget.coaNames), i, 'Homebase Total', actMonth, 'personal')} className={`py-2 px-2 text-right font-mono border-r border-brand-purple-hover ${actMonth > 0 ? 'cursor-pointer' : ''} ${actMonth > 0 && actMonth > budMonth ? 'text-red-300' : actMonth > 0 ? 'text-emerald-300' : ''}`}>{fmt(actMonth)}</td>);
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
                            return (<td key={i} onClick={() => openDrill([code], i, name, act, 'personal')} className={`py-1.5 px-2 text-right font-mono border-r border-border-light ${act > 0 ? 'cursor-pointer' : ''} ${act > 0 && act > bud ? 'text-brand-red bg-red-50' : act > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-text-faint'}`}>{fmt(act)}</td>);
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
                      return (<td key={i} onClick={() => openDrill(Object.keys(nomadBudget.coaNames), i, 'Travel Total', actMonth, 'personal')} className={`py-2 px-2 text-right font-mono border-r border-brand-purple-hover ${actMonth > 0 ? 'cursor-pointer' : ''} ${actMonth > 0 && actMonth > budMonth ? 'text-red-300' : actMonth > 0 ? 'text-emerald-300' : ''}`}>{fmt(actMonth)}</td>);
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
                              return (<td key={i} onClick={() => openDrill([code], i, name, act, 'sole_prop')} className={`py-1.5 px-2 text-right font-mono border-r border-border-light ${act > 0 ? 'cursor-pointer' : ''} ${act > 0 && act > bud ? 'text-brand-red bg-red-50' : act > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-text-faint'}`}>{fmt(act)}</td>);
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
                        return (<td key={i} onClick={() => openDrill(Object.keys(businessBudget.coaNames), i, 'Business Total', actMonth, 'sole_prop')} className={`py-2 px-2 text-right font-mono border-r border-brand-purple-hover ${actMonth > 0 ? 'cursor-pointer' : ''} ${actMonth > 0 && actMonth > budMonth ? 'text-red-300' : actMonth > 0 ? 'text-emerald-300' : ''}`}>{fmt(actMonth)}</td>);
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
      {drillDown && (
        <BudgetDrillDown
          isOpen={true}
          onClose={() => setDrillDown(null)}
          {...drillDown}
        />
      )}
    </AppLayout>
  );
}
