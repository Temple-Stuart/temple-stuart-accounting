'use client';

import { useState, useEffect } from 'react';
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

const SOURCE_CONFIG: Record<string, { icon: string; color: string; bgColor: string; dotColor: string }> = {
  home: { icon: '🏠', color: 'text-amber-600', bgColor: 'bg-amber-50', dotColor: 'bg-amber-500' },
  auto: { icon: '🚗', color: 'text-slate-600', bgColor: 'bg-slate-50', dotColor: 'bg-slate-400' },
  shopping: { icon: '🛒', color: 'text-pink-600', bgColor: 'bg-pink-50', dotColor: 'bg-pink-500' },
  personal: { icon: '👤', color: 'text-violet-600', bgColor: 'bg-violet-50', dotColor: 'bg-violet-500' },
  health: { icon: '💪', color: 'text-emerald-600', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500' },
  growth: { icon: '📚', color: 'text-blue-600', bgColor: 'bg-blue-50', dotColor: 'bg-blue-500' },
  trip: { icon: '✈️', color: 'text-cyan-600', bgColor: 'bg-cyan-50', dotColor: 'bg-cyan-500' },
};

const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Glow style for under/over budget
const getVarianceStyle = (budget: number, actual: number) => {
  if (budget === 0 && actual === 0) return '';
  if (actual === 0) return 'bg-emerald-100/50'; // No spend yet
  if (actual <= budget) return 'bg-emerald-100 shadow-[inset_0_0_12px_rgba(16,185,129,0.3)]'; // Under budget - green glow
  return 'bg-red-100 shadow-[inset_0_0_12px_rgba(239,68,68,0.3)]'; // Over budget - red glow
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

  const [committedTrips, setCommittedTrips] = useState<Array<{
    id: string; name: string; destination: string | null;
    latitude: number | null; longitude: number | null;
    startDate: string | null; endDate: string | null; totalBudget: number;
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

  const goToToday = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  };

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

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
          {/* HOMEBASE BUDGET - With Actuals */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="mb-6 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold w-[140px]">Category</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium w-[60px] text-xs">Type</th>
                    {MONTHS.map(m => <th key={m} className="text-right py-3 px-3 min-w-[75px] text-gray-600 font-medium">{m.slice(0,3)}</th>)}
                    <th className="text-right py-3 px-4 font-bold text-gray-900 bg-gray-100/80 w-[100px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(SOURCE_CONFIG).filter(([s]) => s !== 'trip').map(([source, config]) => {
                    const budgetTotal = Object.values(yearBudget).reduce((sum, m) => sum + (m[source] || 0), 0);
                    const actualTotal = Object.values(yearActual).reduce((sum, m) => sum + (m[source] || 0), 0);
                    
                    return (
                      <>
                        {/* Budget Row */}
                        <tr key={`${source}-budget`} className="border-t border-gray-100">
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
                        <tr key={`${source}-actual`} className="border-b border-gray-200">
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
                      </>
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
          <div className="mb-6 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                <span className="text-xl">✈️</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Travel Budget</h2>
                <p className="text-sm text-gray-500">{selectedYear} • Budget vs Actual</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className="text-left py-3 px-4 text-gray-600 font-semibold w-[140px]">Account</th>
                    <th className="text-left py-3 px-2 text-gray-500 font-medium w-[60px] text-xs">Type</th>
                    {MONTHS.map(m => <th key={m} className="text-right py-3 px-3 min-w-[75px] text-gray-600 font-medium">{m.slice(0,3)}</th>)}
                    <th className="text-right py-3 px-4 font-bold text-gray-900 bg-gray-100/80 w-[100px]">Total</th>
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
                      <>
                        {/* Budget Row */}
                        <tr key={`${code}-budget`} className="border-t border-gray-100">
                          <td rowSpan={2} className="py-2 px-4 text-gray-700 font-medium whitespace-nowrap border-r border-gray-100">
                            {name} <span className="text-gray-400 text-xs ml-1">{code}</span>
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
                        <tr key={`${code}-actual`} className="border-b border-gray-200">
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
                      </>
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
          <div className="mb-8 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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

            <div className="px-6 py-4 text-center text-sm text-gray-500 bg-gray-50/50 border-t border-gray-100">
              <span className="text-amber-600">🏠 Home months</span> = Homebase + Travel costs &nbsp;|&nbsp; <span className="text-cyan-600">✈️ Travel months</span> = Travel cost only (homebase avoided)
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* CALENDAR + SIDEBAR */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="text-xl font-bold text-gray-900 bg-transparent border-none cursor-pointer focus:ring-0 focus:outline-none"
                      >
                        {MONTHS.map((month, idx) => (
                          <option key={month} value={idx}>{month}</option>
                        ))}
                      </select>
                      
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="text-xl font-bold text-gray-900 bg-transparent border-none cursor-pointer focus:ring-0 focus:outline-none"
                      >
                        {years.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    
                    <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  
                  <button 
                    onClick={goToToday}
                    className="px-4 py-2 text-sm bg-[#b4b237] text-white font-semibold rounded-lg hover:bg-[#9a9830] transition-colors shadow-sm"
                  >
                    Today
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map(day => (
                    <div key={day} className="text-center text-sm font-semibold text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} className="h-24 bg-gray-50 rounded-lg"></div>;
                    }

                    const dayEvents = eventsByDay[day] || [];
                    const isToday = day === now.getDate() && selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
                    const dayTotal = dayEvents.reduce((sum, e) => sum + (e.budget_amount || 0), 0);

                    return (
                      <div
                        key={day}
                        className={`h-24 p-2 rounded-lg border transition-all ${
                          isToday 
                            ? 'border-[#b4b237] bg-[#b4b237]/5 shadow-sm ring-1 ring-[#b4b237]/20' 
                            : dayEvents.length > 0 
                              ? 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                              : 'border-gray-100 bg-gray-50/50'
                        }`}
                      >
                        <div className={`text-sm font-semibold ${isToday ? 'text-[#b4b237]' : 'text-gray-700'}`}>
                          {day}
                        </div>
                        
                        {dayEvents.length > 0 && (
                          <>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {dayEvents.slice(0, 3).map((e, i) => (
                                <span 
                                  key={i} 
                                  className={`w-2 h-2 rounded-full ${SOURCE_CONFIG[e.source]?.dotColor || 'bg-gray-400'}`}
                                  title={e.title}
                                ></span>
                              ))}
                              {dayEvents.length > 3 && (
                                <span className="text-xs text-gray-400">+{dayEvents.length - 3}</span>
                              )}
                            </div>
                            {dayTotal > 0 && (
                              <div className="text-xs font-semibold text-[#b4b237] mt-1 tabular-nums">
                                {formatCurrency(dayTotal)}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-6 mt-6 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span> Home
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span> Agenda
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="w-3 h-3 rounded-full bg-cyan-500"></span> Trips
                  </div>
                </div>
              </div>

              {/* Trip Map */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <span className="text-xl">🗺️</span>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Committed Trips</h2>
                </div>
                {committedTrips.filter(t => t.latitude && t.longitude).length > 0 ? (
                  <div className="h-[300px] rounded-xl overflow-hidden border border-gray-200">
                    <MapContainer
                      center={[20, 0]}
                      zoom={1}
                      style={{ height: "100%", width: "100%" }}
                      scrollWheelZoom={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {committedTrips.filter(t => t.latitude && t.longitude).map(trip => (
                        <Marker key={trip.id} position={[trip.latitude!, trip.longitude!]}>
                          <Popup>
                            <div className="text-sm">
                              <div className="font-bold">{trip.destination}</div>
                              <div className="text-gray-500">{trip.name}</div>
                              <div className="text-cyan-600 font-semibold">${trip.totalBudget.toLocaleString()}</div>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="text-4xl mb-3">🗺️</div>
                    <p className="text-sm">No committed trips with locations</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Events List */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {MONTHS[selectedMonth]} Events
                </h2>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {events.length > 0 ? (
                    events.map(event => {
                      const config = SOURCE_CONFIG[event.source] || SOURCE_CONFIG.home;
                      const eventDate = parseDate(event.start_date);
                      return (
                        <div key={event.id} className={`p-3 rounded-xl ${config.bgColor} border border-gray-100`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span>{event.icon || config.icon}</span>
                              <div>
                                <div className="font-medium text-gray-800 text-sm">{event.title}</div>
                                <div className="text-xs text-gray-500">
                                  {MONTHS[eventDate.getMonth()].slice(0, 3)} {eventDate.getDate()}
                                </div>
                              </div>
                            </div>
                            <div className={`font-bold text-sm tabular-nums ${config.color}`}>
                              {formatCurrency(event.budget_amount)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-4xl mb-3">📅</div>
                      <p className="text-sm">No events this month</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Committed Trips List */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xl">✈️</span>
                  <h2 className="text-lg font-semibold text-gray-900">Upcoming Trips</h2>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {committedTrips.length > 0 ? (
                    committedTrips.map(trip => (
                      <div 
                        key={trip.id} 
                        onClick={() => router.push(`/budgets/trips/${trip.id}`)} 
                        className="p-4 rounded-xl bg-cyan-50 hover:bg-cyan-100 cursor-pointer transition-all border border-cyan-100 hover:border-cyan-200"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-gray-800 text-sm">{trip.destination || trip.name}</div>
                            <div className="text-xs text-gray-500 mt-1">
                              {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : "TBD"}
                            </div>
                          </div>
                          <div className="font-bold text-sm text-cyan-600 tabular-nums">
                            {formatCurrency(trip.totalBudget)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <div className="text-4xl mb-3">✈️</div>
                      <p className="text-sm">No committed trips</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
