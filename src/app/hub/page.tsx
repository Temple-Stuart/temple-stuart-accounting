'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppLayout, Card, Badge } from '@/components/ui';

interface CalendarEvent {
  id: string;
  source: string;
  source_id: string;
  title: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  color: string | null;
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

const modules = [
  { name: 'Bookkeeping', href: '/dashboard', icon: '📒', color: 'bg-emerald-500' },
  { name: 'Income', href: '/income', icon: '💵', color: 'bg-green-500' },
  { name: 'Trading', href: '/trading', icon: '📊', color: 'bg-purple-500' },
  { name: 'Home', href: '/home', icon: '🏠', color: 'bg-orange-500' },
  { name: 'Agenda', href: '/agenda', icon: '📋', color: 'bg-blue-500' },
  { name: 'Trips', href: '/budgets/trips', icon: '✈️', color: 'bg-cyan-500' },
  { name: 'Net Worth', href: '/net-worth', icon: '💰', color: 'bg-yellow-500' },
  { name: 'Budget', href: '/hub/itinerary', icon: '📈', color: 'bg-indigo-500' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SOURCE_CONFIG: Record<string, { icon: string; color: string; bgColor: string }> = {
  home: { icon: '🏠', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  agenda: { icon: '📋', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  trip: { icon: '✈️', color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
};

export default function HubPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [summary, setSummary] = useState<CalendarSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    loadCalendar();
  }, [selectedYear, selectedMonth]);

  const loadCalendar = async () => {
    try {
      let url = `/api/calendar?year=${selectedYear}`;
      if (selectedMonth) url += `&month=${selectedMonth}`;
      
      const res = await fetch(url);
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Sort events chronologically
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  // Group by month for calendar grid
  const eventsByMonth: Record<number, CalendarEvent[]> = {};
  events.forEach(e => {
    const month = new Date(e.start_date).getMonth();
    if (!eventsByMonth[month]) eventsByMonth[month] = [];
    eventsByMonth[month].push(e);
  });

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-gray-500 mt-1">Your Financial Command Center</p>
          </div>
          <div className="flex items-center gap-2">
            {years.map(year => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedYear === year 
                    ? 'bg-gray-900 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🏠</span>
              <span className="text-sm text-orange-600">Home</span>
            </div>
            <div className="text-2xl font-bold text-orange-700">{formatCurrency(summary?.homeTotal || 0)}</div>
            <div className="text-xs text-orange-500">{summary?.homeCount || 0} items</div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📋</span>
              <span className="text-sm text-blue-600">Agenda</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">{formatCurrency(summary?.agendaTotal || 0)}</div>
            <div className="text-xs text-blue-500">{summary?.agendaCount || 0} items</div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">✈️</span>
              <span className="text-sm text-cyan-600">Trips</span>
            </div>
            <div className="text-2xl font-bold text-cyan-700">{formatCurrency(summary?.tripTotal || 0)}</div>
            <div className="text-xs text-cyan-500">{summary?.tripCount || 0} trips</div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-[#b4b237]/10 to-[#b4b237]/20 border-[#b4b237]">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">💰</span>
              <span className="text-sm text-[#8f8c2a]">Total Committed</span>
            </div>
            <div className="text-2xl font-bold text-[#8f8c2a]">{formatCurrency(summary?.grandTotal || 0)}</div>
            <div className="text-xs text-[#8f8c2a]/70">{summary?.totalEvents || 0} total events</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{selectedYear} Calendar</h2>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {MONTHS.map((month, idx) => {
                  const monthEvents = eventsByMonth[idx] || [];
                  const monthTotal = monthEvents.reduce((sum, e) => sum + (e.budget_amount || 0), 0);
                  const hasHome = monthEvents.some(e => e.source === 'home');
                  const hasAgenda = monthEvents.some(e => e.source === 'agenda');
                  const hasTrip = monthEvents.some(e => e.source === 'trip');
                  
                  return (
                    <button
                      key={month}
                      onClick={() => setSelectedMonth(selectedMonth === idx + 1 ? null : idx + 1)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedMonth === idx + 1
                          ? 'border-[#b4b237] bg-[#b4b237]/10'
                          : monthEvents.length > 0
                            ? 'border-gray-200 hover:border-gray-300 bg-gray-50'
                            : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{month}</div>
                      {monthEvents.length > 0 ? (
                        <>
                          <div className="text-sm font-medium text-gray-600 mt-1">
                            {formatCurrency(monthTotal)}
                          </div>
                          <div className="flex gap-1 mt-2">
                            {hasHome && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                            {hasAgenda && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                            {hasTrip && <span className="w-2 h-2 rounded-full bg-cyan-500"></span>}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-gray-400 mt-1">No events</div>
                      )}
                    </button>
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {modules.map(mod => (
                  <button
                    key={mod.name}
                    onClick={() => router.push(mod.href)}
                    className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all text-left"
                  >
                    <span className="text-2xl">{mod.icon}</span>
                    <div className="font-medium text-gray-900 mt-2">{mod.name}</div>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Chronological List */}
          <div>
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedMonth ? `${MONTHS[selectedMonth - 1]} ${selectedYear}` : `${selectedYear}`} Timeline
              </h2>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {sortedEvents.length > 0 ? (
                  sortedEvents
                    .filter(e => !selectedMonth || new Date(e.start_date).getMonth() + 1 === selectedMonth)
                    .map(event => {
                      const config = SOURCE_CONFIG[event.source] || SOURCE_CONFIG.agenda;
                      return (
                        <div
                          key={event.id}
                          className={`p-4 rounded-lg ${config.bgColor} border border-gray-200`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{event.icon || config.icon}</span>
                              <div>
                                <div className="font-medium text-gray-900">{event.title}</div>
                                <div className="text-xs text-gray-500">
                                  {formatDate(event.start_date)}
                                  {event.end_date && event.end_date !== event.start_date && 
                                    ` - ${formatDate(event.end_date)}`}
                                </div>
                              </div>
                            </div>
                            <div className={`font-semibold ${config.color}`}>
                              {formatCurrency(event.budget_amount)}
                            </div>
                          </div>
                          {event.location && (
                            <div className="text-xs text-gray-500 mt-2">📍 {event.location}</div>
                          )}
                          {event.is_recurring && (
                            <Badge variant="info" className="mt-2 text-xs">Recurring</Badge>
                          )}
                        </div>
                      );
                    })
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-4xl mb-2">📅</div>
                    <p>No committed events yet</p>
                    <p className="text-sm mt-1">Commit items from Home, Agenda, or Trips</p>
                  </div>
                )}
              </div>
            </Card>

            {/* The Nomad Question */}
            <Card className="p-6 mt-6 bg-gradient-to-br from-[#b4b237]/10 to-[#b4b237]/5 border-[#b4b237]/30">
              <h2 className="text-lg font-semibold text-[#8f8c2a] mb-4">🌍 The Nomad Question</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Home costs:</span>
                  <span className="font-semibold text-orange-600">{formatCurrency(summary?.homeTotal || 0)}/yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Agenda (follows you):</span>
                  <span className="font-semibold text-blue-600">{formatCurrency(summary?.agendaTotal || 0)}/yr</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Trips planned:</span>
                  <span className="font-semibold text-cyan-600">{formatCurrency(summary?.tripTotal || 0)}/yr</span>
                </div>
                <div className="border-t border-[#b4b237]/20 pt-3 mt-3">
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold text-[#8f8c2a]">Monthly home cost:</span>
                    <span className="font-bold text-[#8f8c2a]">{formatCurrency((summary?.homeTotal || 0) / 12)}</span>
                  </div>
                  <p className="text-sm text-[#8f8c2a]/70 mt-2">
                    Can you travel for less than {formatCurrency((summary?.homeTotal || 0) / 12)}/mo?
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
