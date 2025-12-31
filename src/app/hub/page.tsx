'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppLayout, Card, Badge } from '@/components/ui';

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
  agendaTotal: number;
  tripTotal: number;
  grandTotal: number;
  homeCount: number;
  agendaCount: number;
  tripCount: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SOURCE_CONFIG: Record<string, { icon: string; color: string; bgColor: string; dotColor: string }> = {
  home: { icon: '🏠', color: 'text-orange-600', bgColor: 'bg-orange-100', dotColor: 'bg-orange-500' },
  agenda: { icon: '📋', color: 'text-blue-600', bgColor: 'bg-blue-100', dotColor: 'bg-blue-500' },
  trip: { icon: '✈️', color: 'text-cyan-600', bgColor: 'bg-cyan-100', dotColor: 'bg-cyan-500' },
};

const modules = [
  { name: 'Bookkeeping', href: '/dashboard', icon: '📒' },
  { name: 'Income', href: '/income', icon: '💵' },
  { name: 'Trading', href: '/trading', icon: '📊' },
  { name: 'Home', href: '/home', icon: '🏠' },
  { name: 'Agenda', href: '/agenda', icon: '📋' },
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center gap-2 mb-1">
              <span>🏠</span>
              <span className="text-sm text-orange-600">Home</span>
            </div>
            <div className="text-xl font-bold text-orange-700">{formatCurrency(summary?.homeTotal || 0)}</div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <span>📋</span>
              <span className="text-sm text-blue-600">Agenda</span>
            </div>
            <div className="text-xl font-bold text-blue-700">{formatCurrency(summary?.agendaTotal || 0)}</div>
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
              <span className="text-sm text-[#8f8c2a]">This Month</span>
            </div>
            <div className="text-xl font-bold text-[#8f8c2a]">{formatCurrency(monthlyTotal)}</div>
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
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Home costs/mo:</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(summary?.homeTotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Agenda costs/mo:</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(summary?.agendaTotal || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Trip costs/mo:</span>
                  <span className="font-semibold text-cyan-600">{formatCurrency(summary?.tripTotal || 0)}</span>
                </div>
                <div className="border-t border-[#b4b237]/20 pt-3 mt-3">
                  <p className="text-[#8f8c2a]">
                    <strong>Baseline:</strong> {formatCurrency(summary?.homeTotal || 0)}/mo to stay home
                  </p>
                  <p className="text-[#8f8c2a]/70 mt-1 text-xs">
                    Can you travel for less?
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
