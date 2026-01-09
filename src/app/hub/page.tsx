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
  home: { icon: '🏠', color: 'text-orange-600', bgColor: 'bg-orange-100', dotColor: 'bg-orange-500' },
  auto: { icon: '🚗', color: 'text-gray-600', bgColor: 'bg-gray-100', dotColor: 'bg-gray-500' },
  shopping: { icon: '🛒', color: 'text-pink-600', bgColor: 'bg-pink-100', dotColor: 'bg-pink-500' },
  personal: { icon: '👤', color: 'text-purple-600', bgColor: 'bg-purple-100', dotColor: 'bg-purple-500' },
  health: { icon: '💪', color: 'text-green-600', bgColor: 'bg-green-100', dotColor: 'bg-green-500' },
  growth: { icon: '📚', color: 'text-blue-600', bgColor: 'bg-blue-100', dotColor: 'bg-blue-500' },
  trip: { icon: '✈️', color: 'text-cyan-600', bgColor: 'bg-cyan-100', dotColor: 'bg-cyan-500' },
};


const modules = [
  { name: 'Bookkeeping', href: '/dashboard', icon: '📒' },
  { name: 'Income', href: '/income', icon: '💵' },
  { name: 'Trading', href: '/trading', icon: '📊' },
  { name: 'Home', href: '/home', icon: '🏠' },
  { name: 'Auto', href: '/auto', icon: '🚗' },
  { name: 'Shopping', href: '/shopping', icon: '🛒' },
  { name: 'Personal', href: '/personal', icon: '👤' },
  { name: 'Health', href: '/health', icon: '💪' },
  { name: 'Growth', href: '/growth', icon: '📚' },
  { name: 'Trips', href: '/budgets/trips', icon: '✈️' },
  { name: 'Net Worth', href: '/net-worth', icon: '💰' },
  { name: 'Budget', href: '/hub/itinerary', icon: '📈' },
];
// Helper to parse date string without timezone issues
const parseDate = (dateStr: string): Date => {
  // dateStr is "YYYY-MM-DD", parse as local date
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

  // Committed trips for map and list
  const [committedTrips, setCommittedTrips] = useState<Array<{
    id: string; name: string; destination: string | null;
    latitude: number | null; longitude: number | null;
    startDate: string | null; endDate: string | null; totalBudget: number;
  }>>([]);
  const [yearCalendar, setYearCalendar] = useState<Record<number, Record<string, number>>>({});
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

  // Group events by day - using parseDate to avoid timezone issues
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

  const monthlyTotal = events.reduce((sum, e) => sum + (e.budget_amount || 0), 0);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-gray-500 mt-1">Your Financial Command Center</p>
          </div>
        </div>

        {/* Summary Cards */}
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center gap-2 mb-1">
              <span>🏠</span>
              <span className="text-sm text-orange-600">Home</span>
            </div>
            <div className="text-xl font-bold text-orange-700">{formatCurrency(summary?.homeTotal || 0)}</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <span>🧬</span>
              <span className="text-sm text-purple-600">Life</span>
            </div>
            <div className="text-xl font-bold text-purple-700">{formatCurrency((summary?.autoTotal || 0) + (summary?.shoppingTotal || 0) + (summary?.personalTotal || 0) + (summary?.healthTotal || 0) + (summary?.growthTotal || 0))}</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
            <div className="flex items-center gap-2 mb-1">
              <span>✈️</span>
              <span className="text-sm text-cyan-600">Trips</span>
            </div>
            <div className="text-xl font-bold text-cyan-700">{formatCurrency(summary?.tripTotal || 0)}</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-[#b4b237]/10 to-[#b4b237]/20 border-[#b4b237]">
            <div className="flex items-center gap-2 mb-1">
              <span>💰</span>
              <span className="text-sm text-[#8f8c2a]">Total</span>
            </div>
            <div className="text-xl font-bold text-[#8f8c2a]">{formatCurrency(summary?.grandTotal || 0)}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      className="text-xl font-bold text-gray-900 bg-transparent border-none cursor-pointer focus:ring-0"
                    >
                      {MONTHS.map((month, idx) => (
                        <option key={month} value={idx}>{month}</option>
                      ))}
                    </select>
                    
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="text-xl font-bold text-gray-900 bg-transparent border-none cursor-pointer focus:ring-0"
                    >
                      {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  
                  <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                
                <button 
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Today
                </button>
              </div>

              {/* Days header */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
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
                          ? 'border-[#b4b237] bg-[#b4b237]/5' 
                          : dayEvents.length > 0 
                            ? 'border-gray-200 bg-white hover:bg-gray-50'
                            : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className={`text-sm font-medium ${isToday ? 'text-[#b4b237]' : 'text-gray-900'}`}>
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
                            <div className="text-xs font-medium text-gray-600 mt-1">
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
              <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="w-3 h-3 rounded-full bg-orange-500"></span> Home
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span> Agenda
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="w-3 h-3 rounded-full bg-cyan-500"></span> Trips
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {modules.map(mod => (
                  <button
                    key={mod.name}
                    onClick={() => router.push(mod.href)}
                    className="p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-center"
                  >
                    <span className="text-xl">{mod.icon}</span>
                    <div className="text-xs font-medium text-gray-600 mt-1">{mod.name}</div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Trip Map */}
            <Card className="p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">🗺️ Committed Trips</h2>
              {committedTrips.filter(t => t.latitude && t.longitude).length > 0 ? (
                <div className="h-[300px] rounded-lg overflow-hidden">
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
                <div className="text-center py-8 text-gray-400">
                  <div className="text-3xl mb-2">🗺️</div>
                  <p className="text-sm">No committed trips with locations</p>
                </div>
              )}
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Events List */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {MONTHS[selectedMonth]} Events
              </h2>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {events.length > 0 ? (
                  events.map(event => {
                    const config = SOURCE_CONFIG[event.source] || SOURCE_CONFIG.agenda;
                    const eventDate = parseDate(event.start_date);
                    return (
                      <div key={event.id} className={`p-3 rounded-lg ${config.bgColor}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span>{event.icon || config.icon}</span>
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{event.title}</div>
                              <div className="text-xs text-gray-500">
                                {MONTHS[eventDate.getMonth()].slice(0, 3)} {eventDate.getDate()}
                              </div>
                            </div>
                          </div>
                          <div className={`font-semibold text-sm ${config.color}`}>
                            {formatCurrency(event.budget_amount)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-3xl mb-2">📅</div>
                    <p className="text-sm">No events this month</p>
                  </div>
                )}
              </div>
            </Card>


            {/* The Nomad Question */}
            <Card className="p-6 bg-gradient-to-br from-[#b4b237]/10 to-[#b4b237]/5 border-[#b4b237]/30">
              <h2 className="text-lg font-semibold text-[#8f8c2a] mb-4">🌍 The Nomad Question</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">🏠 Home:</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(summary?.homeTotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">🚗 Auto:</span>
                  <span className="font-semibold text-gray-600">{formatCurrency(summary?.autoTotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">🛒 Shopping:</span>
                  <span className="font-semibold text-pink-600">{formatCurrency(summary?.shoppingTotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">👤 Personal:</span>
                  <span className="font-semibold text-purple-600">{formatCurrency(summary?.personalTotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">💪 Health:</span>
                  <span className="font-semibold text-green-600">{formatCurrency(summary?.healthTotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">📚 Growth:</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(summary?.growthTotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">✈️ Trips:</span>
                  <span className="font-semibold text-cyan-600">{formatCurrency(summary?.tripTotal || 0)}</span>
                </div>
                <div className="border-t border-[#b4b237]/20 pt-3 mt-3">
                  <div className="flex justify-between font-bold">
                    <span className="text-[#8f8c2a]">Total/mo:</span>
                    <span className="text-[#8f8c2a]">{formatCurrency(summary?.grandTotal || 0)}</span>
                  </div>
                  <p className="text-[#8f8c2a]/70 mt-2 text-xs">
                    Your baseline cost of living. Can you travel for less?
                  </p>
                </div>
              </div>
            </Card>

            {/* Committed Trips List */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">✈️ Upcoming Trips</h2>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {committedTrips.length > 0 ? (
                  committedTrips.map(trip => (
                    <div key={trip.id} onClick={() => router.push(`/budgets/trips/${trip.id}`)} className="p-3 rounded-lg bg-cyan-50 hover:bg-cyan-100 cursor-pointer transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{trip.destination || trip.name}</div>
                          <div className="text-xs text-gray-500">
                            {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : "TBD"}
                          </div>
                        </div>
                        <div className="font-semibold text-sm text-cyan-600">
                          {formatCurrency(trip.totalBudget)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-3xl mb-2">✈️</div>
                    <p className="text-sm">No committed trips</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Year Calendar */}
        <Card className="p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">🏠 {selectedYear} Lease Apartment Budget</h2>
            <div className="flex gap-2">
              <button onClick={() => setSelectedYear(y => y - 1)} className="px-3 py-1 text-sm border rounded hover:bg-gray-100">←</button>
              <button onClick={() => setSelectedYear(y => y + 1)} className="px-3 py-1 text-sm border rounded hover:bg-gray-100">→</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Category</th>
                  {MONTHS.map(m => <th key={m} className="text-right py-2 px-2 min-w-[70px]">{m.slice(0,3)}</th>)}
                  <th className="text-right py-2 px-2 font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(SOURCE_CONFIG).filter(([s]) => s !== 'trip').map(([source, config]) => (
                  <tr key={source} className="border-b border-gray-100">
                    <td className="py-2 px-2">{config.icon} {source.charAt(0).toUpperCase() + source.slice(1)}</td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className={`text-right py-2 px-2 ${config.color}`}>
                        {yearCalendar[i]?.[source] ? formatCurrency(yearCalendar[i][source]) : "—"}
                      </td>
                    ))}
                    <td className={`text-right py-2 px-2 font-bold ${config.color}`}>
                      {formatCurrency(Object.values(yearCalendar).reduce((sum, m) => sum + (m[source] || 0), 0))}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 font-bold">
                  <td className="py-2 px-2">Total</td>
                  {MONTHS.map((_, i) => (
                    <td key={i} className="text-right py-2 px-2">
                      {yearCalendar[i]?.total ? formatCurrency(yearCalendar[i].total) : "—"}
                    </td>
                  ))}
                  <td className="text-right py-2 px-2 text-green-600">
                    {formatCurrency(Object.values(yearCalendar).reduce((sum, m) => sum + (m.total || 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Digital Nomad Budget - Trip COA Breakdown */}
        <Card className="p-6 mt-6">
          <h2 className="text-lg font-semibold text-cyan-700 mb-4">🌍 {selectedYear} Digital Nomad Budget</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Account</th>
                  {MONTHS.map(m => <th key={m} className="text-right py-2 px-2 min-w-[70px]">{m.slice(0,3)}</th>)}
                  <th className="text-right py-2 px-2 font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(nomadBudget.coaNames).map(([code, name]) => {
                  const rowData = nomadBudget.monthlyData[code] || {};
                  const rowTotal = Object.values(rowData).reduce((s, v) => s + v, 0);
                  if (rowTotal === 0) return null;
                  return (
                    <tr key={code} className="border-b border-gray-100">
                      <td className="py-2 px-2 whitespace-nowrap">{name} <span className="text-xs text-gray-400">{code}</span></td>
                      {MONTHS.map((_, i) => (
                        <td key={i} className="text-right py-2 px-2 text-cyan-600">
                          {rowData[i] ? formatCurrency(rowData[i]) : "—"}
                        </td>
                      ))}
                      <td className="text-right py-2 px-2 font-bold text-cyan-600">{formatCurrency(rowTotal)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 font-bold">
                  <td className="py-2 px-2">Total Travel</td>
                  {MONTHS.map((_, i) => {
                    const monthTotal = Object.values(nomadBudget.monthlyData).reduce((s, coa) => s + (coa[i] || 0), 0);
                    return <td key={i} className="text-right py-2 px-2">{monthTotal ? formatCurrency(monthTotal) : "—"}</td>;
                  })}
                  <td className="text-right py-2 px-2 text-cyan-600">{formatCurrency(nomadBudget.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
