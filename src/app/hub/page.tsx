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
  homeCount: number;
  autoCount: number;
  shoppingCount: number;
  personalCount: number;
  healthCount: number;
  growthCount: number;
  tripCount: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SOURCE_CONFIG: Record<string, { icon: string; color: string; bgColor: string; dotColor: string }> = {
  home: { icon: '🏠', color: 'text-amber-400', bgColor: 'bg-amber-950/30', dotColor: 'bg-amber-400' },
  auto: { icon: '🚗', color: 'text-slate-400', bgColor: 'bg-slate-800/50', dotColor: 'bg-slate-400' },
  shopping: { icon: '🛒', color: 'text-pink-400', bgColor: 'bg-pink-950/30', dotColor: 'bg-pink-400' },
  personal: { icon: '👤', color: 'text-violet-400', bgColor: 'bg-violet-950/30', dotColor: 'bg-violet-400' },
  health: { icon: '💪', color: 'text-emerald-400', bgColor: 'bg-emerald-950/30', dotColor: 'bg-emerald-400' },
  growth: { icon: '📚', color: 'text-blue-400', bgColor: 'bg-blue-950/30', dotColor: 'bg-blue-400' },
  trip: { icon: '✈️', color: 'text-cyan-400', bgColor: 'bg-cyan-950/30', dotColor: 'bg-cyan-400' },
};

const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
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
  const [yearCalendar, setYearCalendar] = useState<Record<number, Record<string, number>>>({});
  const [selectedMonths, setSelectedMonths] = useState<number[]>([0,1,2,3,4,5,6,7,8,9,10,11]);
  const [nomadBudget, setNomadBudget] = useState<{ monthlyData: Record<string, Record<number, number>>; coaNames: Record<string, string>; grandTotal: number }>({ monthlyData: {}, coaNames: {}, grandTotal: 0 });

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
        setYearCalendar(data.monthlyData || {});
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
        setNomadBudget({ monthlyData: data.monthlyData || {}, coaNames: data.coaNames || {}, grandTotal: data.grandTotal || 0 });
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

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
          
          {/* Header */}
          <div className="mb-8 pb-6 border-b border-[#b4b237]/30">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-[#b4b237] mt-2 text-lg font-medium tracking-wide">Your Financial Command Center</p>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* BUDGET TABLES - NOW AT TOP */}
          {/* ═══════════════════════════════════════════════════════════════════ */}

          {/* Year Calendar - Lease Apartment Budget */}
          <div className="mb-6 bg-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-900/40 to-slate-900 border-b border-slate-700/50 flex items-center justify-between">
              <h2 className="text-xl font-bold text-amber-400 flex items-center gap-3">
                <span className="text-2xl">🏠</span>
                {selectedYear} Lease Apartment Budget
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setSelectedYear(y => y - 1)} className="px-4 py-2 text-sm bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-600 transition-all">←</button>
                <button onClick={() => setSelectedYear(y => y + 1)} className="px-4 py-2 text-sm bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-600 transition-all">→</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/50">
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold">Category</th>
                    {MONTHS.map(m => <th key={m} className="text-right py-3 px-3 min-w-[80px] text-slate-400 font-semibold">{m.slice(0,3)}</th>)}
                    <th className="text-right py-3 px-4 font-bold text-[#b4b237]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(SOURCE_CONFIG).filter(([s]) => s !== 'trip').map(([source, config]) => (
                    <tr key={source} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-slate-300">{config.icon} {source.charAt(0).toUpperCase() + source.slice(1)}</td>
                      {MONTHS.map((_, i) => (
                        <td key={i} className={`text-right py-3 px-3 ${config.color} font-medium`}>
                          {yearCalendar[i]?.[source] ? formatCurrency(yearCalendar[i][source]) : <span className="text-slate-600">—</span>}
                        </td>
                      ))}
                      <td className={`text-right py-3 px-4 font-bold ${config.color}`}>
                        {formatCurrency(Object.values(yearCalendar).reduce((sum, m) => sum + (m[source] || 0), 0))}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#b4b237]/30 bg-slate-800/50">
                    <td className="py-3 px-4 font-bold text-white">Total</td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className="text-right py-3 px-3 font-bold text-white">
                        {yearCalendar[i]?.total ? formatCurrency(yearCalendar[i].total) : <span className="text-slate-600">—</span>}
                      </td>
                    ))}
                    <td className="text-right py-3 px-4 font-bold text-[#b4b237] text-lg">
                      {formatCurrency(Object.values(yearCalendar).reduce((sum, m) => sum + (m.total || 0), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Digital Nomad Budget */}
          <div className="mb-6 bg-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-gradient-to-r from-cyan-900/40 to-slate-900 border-b border-slate-700/50">
              <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-3">
                <span className="text-2xl">🌍</span>
                {selectedYear} Digital Nomad Budget
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/50">
                    <th className="text-left py-3 px-4 text-slate-400 font-semibold">Account</th>
                    {MONTHS.map(m => <th key={m} className="text-right py-3 px-3 min-w-[80px] text-slate-400 font-semibold">{m.slice(0,3)}</th>)}
                    <th className="text-right py-3 px-4 font-bold text-cyan-400">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(nomadBudget.coaNames).map(([code, name]) => {
                    const rowData = nomadBudget.monthlyData[code] || {};
                    const rowTotal = Object.values(rowData).reduce((s, v) => s + v, 0);
                    if (rowTotal === 0) return null;
                    return (
                      <tr key={code} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-slate-300">{name} <span className="text-slate-500 text-xs">{code}</span></td>
                        {MONTHS.map((_, i) => (
                          <td key={i} className="text-right py-3 px-3 text-cyan-400 font-medium">
                            {rowData[i] ? formatCurrency(rowData[i]) : <span className="text-slate-600">—</span>}
                          </td>
                        ))}
                        <td className="text-right py-3 px-4 font-bold text-cyan-400">{formatCurrency(rowTotal)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-cyan-500/30 bg-slate-800/50">
                    <td className="py-3 px-4 font-bold text-white">Total Travel</td>
                    {MONTHS.map((_, i) => {
                      const monthTotal = Object.values(nomadBudget.monthlyData).reduce((s, coa) => s + (coa[i] || 0), 0);
                      return <td key={i} className="text-right py-3 px-3 font-bold text-white">{monthTotal ? formatCurrency(monthTotal) : <span className="text-slate-600">—</span>}</td>;
                    })}
                    <td className="text-right py-3 px-4 font-bold text-cyan-400 text-lg">{formatCurrency(nomadBudget.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Savings Comparison */}
          <div className="mb-8 bg-slate-900/80 rounded-xl border border-slate-700/50 overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-900/40 to-slate-900 border-b border-slate-700/50">
              <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-3">
                <span className="text-2xl">💰</span>
                {selectedYear} Nomad Savings
              </h2>
            </div>
            
            {/* Month Selection */}
            <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-300">Select months to compare:</span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedMonths([0,1,2,3,4,5,6,7,8,9,10,11])} className="text-xs px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors">All</button>
                  <button onClick={() => setSelectedMonths([])} className="text-xs px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors">None</button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {MONTHS.map((m, i) => (
                  <button 
                    key={i} 
                    onClick={() => setSelectedMonths(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort((a,b) => a-b))}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                      selectedMonths.includes(i) 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' 
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {m.slice(0,3)}
                  </button>
                ))}
              </div>
              <div className="text-xs text-slate-500 mt-3">{selectedMonths.length} months selected</div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 p-6 border-b border-slate-700/50">
              <div className="text-center p-5 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <div className="text-sm text-slate-400 mb-2 font-medium">🏠 Lease Apartment</div>
                <div className="text-3xl font-bold text-slate-200">{formatCurrency(selectedMonths.reduce((sum, i) => sum + (yearCalendar[i]?.total || 0), 0))}</div>
                <div className="text-xs text-slate-500 mt-1">{selectedMonths.length} months staying home</div>
              </div>
              <div className="text-center p-5 bg-cyan-950/30 rounded-xl border border-cyan-800/30">
                <div className="text-sm text-slate-400 mb-2 font-medium">🌍 Digital Nomad</div>
                <div className="text-3xl font-bold text-cyan-400">{formatCurrency(selectedMonths.reduce((sum, i) => sum + Object.values(nomadBudget.monthlyData).reduce((s, coa) => s + (coa[i] || 0), 0), 0))}</div>
                <div className="text-xs text-slate-500 mt-1">{selectedMonths.length} months traveling</div>
              </div>
              <div className="text-center p-5 bg-gradient-to-br from-emerald-950/50 to-[#b4b237]/10 rounded-xl border-2 border-emerald-600/50">
                <div className="text-sm text-slate-400 mb-2 font-medium">💵 Total Savings</div>
                {(() => {
                  const leaseTotal = selectedMonths.reduce((sum, i) => sum + (yearCalendar[i]?.total || 0), 0);
                  const nomadTotal = selectedMonths.reduce((sum, i) => sum + Object.values(nomadBudget.monthlyData).reduce((s, coa) => s + (coa[i] || 0), 0), 0);
                  const savings = leaseTotal - nomadTotal;
                  return (
                    <>
                      <div className={`text-3xl font-bold ${savings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(savings)}</div>
                      <div className="text-xs text-slate-500 mt-1">{savings >= 0 ? 'Saved by going nomad! 🎉' : 'Travel costs more'}</div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Month-by-Month Breakdown */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-emerald-900/20">
                    <th className="py-3 px-4 text-left text-slate-400 font-semibold">Category</th>
                    {MONTHS.map((m, i) => (<th key={i} className={`text-right py-3 px-3 text-slate-400 font-semibold ${!selectedMonths.includes(i) ? 'opacity-30' : ''}`}>{m.slice(0,3)}</th>))}
                    <th className="text-right py-3 px-4 font-bold text-emerald-400">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-800/50">
                    <td className="py-3 px-4 text-slate-300">🏠 Lease Cost</td>
                    {MONTHS.map((_, i) => (<td key={i} className={`text-right py-3 px-3 text-slate-400 font-medium ${!selectedMonths.includes(i) ? 'opacity-30' : ''}`}>{yearCalendar[i]?.total ? formatCurrency(yearCalendar[i].total) : <span className="text-slate-600">—</span>}</td>))}
                    <td className="text-right py-3 px-4 font-bold text-slate-300">{formatCurrency(selectedMonths.reduce((sum, i) => sum + (yearCalendar[i]?.total || 0), 0))}</td>
                  </tr>
                  <tr className="border-t border-slate-800/50">
                    <td className="py-3 px-4 text-slate-300">🌍 Travel Cost</td>
                    {MONTHS.map((_, i) => { const mt = Object.values(nomadBudget.monthlyData).reduce((s, coa) => s + (coa[i] || 0), 0); return (<td key={i} className={`text-right py-3 px-3 text-cyan-400 font-medium ${!selectedMonths.includes(i) ? 'opacity-30' : ''}`}>{mt ? formatCurrency(mt) : <span className="text-slate-600">—</span>}</td>); })}
                    <td className="text-right py-3 px-4 font-bold text-cyan-400">{formatCurrency(selectedMonths.reduce((sum, i) => sum + Object.values(nomadBudget.monthlyData).reduce((s, coa) => s + (coa[i] || 0), 0), 0))}</td>
                  </tr>
                  <tr className="bg-emerald-900/20 border-t border-emerald-600/30">
                    <td className="py-3 px-4 font-bold text-white">💵 Monthly Savings</td>
                    {MONTHS.map((_, i) => { const lease = yearCalendar[i]?.total || 0; const travel = Object.values(nomadBudget.monthlyData).reduce((s, coa) => s + (coa[i] || 0), 0); const diff = lease - travel; return (<td key={i} className={`text-right py-3 px-3 font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'} ${!selectedMonths.includes(i) ? 'opacity-30' : ''}`}>{(lease || travel) ? formatCurrency(diff) : <span className="text-slate-600">—</span>}</td>); })}
                    {(() => { const ts = selectedMonths.reduce((sum, i) => sum + ((yearCalendar[i]?.total || 0) - Object.values(nomadBudget.monthlyData).reduce((s, coa) => s + (coa[i] || 0), 0)), 0); return (<td className={`text-right py-3 px-4 font-bold text-lg ${ts >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(ts)}</td>); })()}
                  </tr>
                  <tr className="bg-violet-900/20 border-t border-violet-600/30">
                    <td className="py-3 px-4 text-violet-300 font-medium">📍 Trip</td>
                    {MONTHS.map((_, i) => {
                      const tripsInMonth = committedTrips.filter(t => {
                        if (!t.startDate) return false;
                        const start = new Date(new Date(t.startDate).getTime() + 12*60*60*1000);
                        return start.getMonth() === i && start.getFullYear() === selectedYear;
                      });
                      return (
                        <td key={i} className={`text-center py-3 px-3 text-xs text-violet-400 ${!selectedMonths.includes(i) ? 'opacity-30' : ''}`} style={{maxWidth: '80px', whiteSpace: 'normal', wordWrap: 'break-word'}}>
                          {tripsInMonth.length > 0 ? tripsInMonth.map(t => t.name).join(', ') : <span className="text-slate-600">—</span>}
                        </td>
                      );
                    })}
                    <td className="text-center py-3 px-4 text-xs text-violet-400 font-semibold">{committedTrips.filter(t => t.startDate && new Date(new Date(t.startDate).getTime() + 12*60*60*1000).getFullYear() === selectedYear).length} trips</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 text-center text-sm text-slate-500 border-t border-slate-700/50">
              Select the months you plan to travel to see your projected savings
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* MAIN CONTENT GRID - CALENDAR + SIDEBAR */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-6 shadow-2xl">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <button onClick={prevMonth} className="p-2.5 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="text-2xl font-bold text-white bg-transparent border-none cursor-pointer focus:ring-0"
                      >
                        {MONTHS.map((month, idx) => (
                          <option key={month} value={idx} className="bg-slate-900 text-white">{month}</option>
                        ))}
                      </select>
                      
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="text-2xl font-bold text-white bg-transparent border-none cursor-pointer focus:ring-0"
                      >
                        {years.map(year => (
                          <option key={year} value={year} className="bg-slate-900 text-white">{year}</option>
                        ))}
                      </select>
                    </div>
                    
                    <button onClick={nextMonth} className="p-2.5 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  
                  <button 
                    onClick={goToToday}
                    className="px-4 py-2 text-sm bg-[#b4b237] text-slate-900 font-semibold rounded-lg hover:bg-[#c9c73f] transition-colors"
                  >
                    Today
                  </button>
                </div>

                {/* Days header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map(day => (
                    <div key={day} className="text-center text-sm font-semibold text-slate-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} className="h-24 bg-slate-800/30 rounded-lg"></div>;
                    }

                    const dayEvents = eventsByDay[day] || [];
                    const isToday = day === now.getDate() && selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
                    const dayTotal = dayEvents.reduce((sum, e) => sum + (e.budget_amount || 0), 0);

                    return (
                      <div
                        key={day}
                        className={`h-24 p-2 rounded-lg border transition-all ${
                          isToday 
                            ? 'border-[#b4b237] bg-[#b4b237]/10 shadow-lg shadow-[#b4b237]/20' 
                            : dayEvents.length > 0 
                              ? 'border-slate-600 bg-slate-800/50 hover:bg-slate-800'
                              : 'border-slate-800 bg-slate-800/20'
                        }`}
                      >
                        <div className={`text-sm font-semibold ${isToday ? 'text-[#b4b237]' : 'text-slate-300'}`}>
                          {day}
                        </div>
                        
                        {dayEvents.length > 0 && (
                          <>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {dayEvents.slice(0, 3).map((e, i) => (
                                <span 
                                  key={i} 
                                  className={`w-2 h-2 rounded-full ${SOURCE_CONFIG[e.source]?.dotColor || 'bg-slate-500'}`}
                                  title={e.title}
                                ></span>
                              ))}
                              {dayEvents.length > 3 && (
                                <span className="text-xs text-slate-500">+{dayEvents.length - 3}</span>
                              )}
                            </div>
                            {dayTotal > 0 && (
                              <div className="text-xs font-semibold text-[#b4b237] mt-1">
                                {formatCurrency(dayTotal)}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex gap-6 mt-6 pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="w-3 h-3 rounded-full bg-amber-400"></span> Home
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="w-3 h-3 rounded-full bg-blue-400"></span> Agenda
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <span className="w-3 h-3 rounded-full bg-cyan-400"></span> Trips
                  </div>
                </div>
              </div>

              {/* Trip Map */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <span className="text-2xl">🗺️</span>
                  Committed Trips
                </h2>
                {committedTrips.filter(t => t.latitude && t.longitude).length > 0 ? (
                  <div className="h-[300px] rounded-lg overflow-hidden border border-slate-700/50">
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
                  <div className="text-center py-12 text-slate-500 bg-slate-800/30 rounded-lg border border-slate-700/50">
                    <div className="text-4xl mb-3">🗺️</div>
                    <p className="text-sm">No committed trips with locations</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Events List */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">
                  {MONTHS[selectedMonth]} Events
                </h2>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {events.length > 0 ? (
                    events.map(event => {
                      const config = SOURCE_CONFIG[event.source] || SOURCE_CONFIG.home;
                      const eventDate = parseDate(event.start_date);
                      return (
                        <div key={event.id} className={`p-3 rounded-lg ${config.bgColor} border border-slate-700/30`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span>{event.icon || config.icon}</span>
                              <div>
                                <div className="font-medium text-slate-200 text-sm">{event.title}</div>
                                <div className="text-xs text-slate-500">
                                  {MONTHS[eventDate.getMonth()].slice(0, 3)} {eventDate.getDate()}
                                </div>
                              </div>
                            </div>
                            <div className={`font-bold text-sm ${config.color}`}>
                              {formatCurrency(event.budget_amount)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12 text-slate-500">
                      <div className="text-4xl mb-3">📅</div>
                      <p className="text-sm">No events this month</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Committed Trips List */}
              <div className="bg-slate-900/80 rounded-xl border border-slate-700/50 p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                  <span>✈️</span>
                  Upcoming Trips
                </h2>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {committedTrips.length > 0 ? (
                    committedTrips.map(trip => (
                      <div 
                        key={trip.id} 
                        onClick={() => router.push(`/budgets/trips/${trip.id}`)} 
                        className="p-4 rounded-lg bg-cyan-950/30 hover:bg-cyan-900/40 cursor-pointer transition-all border border-cyan-800/30 hover:border-cyan-600/50"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-slate-200 text-sm">{trip.destination || trip.name}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : "TBD"}
                            </div>
                          </div>
                          <div className="font-bold text-sm text-cyan-400">
                            {formatCurrency(trip.totalBudget)}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-slate-500">
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
