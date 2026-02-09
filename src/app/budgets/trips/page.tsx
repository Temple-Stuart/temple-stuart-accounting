'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import TripMap from '@/components/trips/TripMap';
import 'leaflet/dist/leaflet.css';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  rsvpStatus: string;
  isOwner: boolean;
}

interface Trip {
  id: string;
  name: string;
  destination: string | null;
  activity: string | null;
  month: number;
  year: number;
  daysTravel: number;
  daysRiding: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  committedAt: string | null;
  latitude: string | null;
  longitude: string | null;
  destinationPhoto: string | null;
  participants: Participant[];
  _count: {
    expenses: number;
    itinerary: number;
    budget_line_items: number;
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ACTIVITIES: Record<string, string> = {
  surf: 'Surf', kitesurf: 'Kitesurf', sail: 'Sail', snowboard: 'Snowboard', ski: 'Ski',
  scuba: 'Scuba', mtb: 'MTB', climbing: 'Climbing', hiking: 'Hiking', fishing: 'Fishing',
  golf: 'Golf', roadcycle: 'Road Cycling', moto: 'Moto', hike: 'Hike', climb: 'Climb',
  bike: 'Bike', run: 'Run', triathlon: 'Triathlon', skate: 'Skate', festival: 'Festival',
  conference: 'Conference', nomad: 'Nomad',
};

const ACTIVITY_COLORS: Record<string, string> = {
  surf: '#3b82f6', kitesurf: '#06b6d4', sail: '#6366f1', snowboard: '#8b5cf6', ski: '#7c3aed',
  scuba: '#14b8a6', mtb: '#f97316', climbing: '#ef4444', hiking: '#22c55e', fishing: '#10b981',
  golf: '#84cc16', roadcycle: '#eab308', moto: '#f43f5e', hike: '#16a34a', climb: '#dc2626',
  bike: '#ea580c', run: '#ec4899', triathlon: '#2563eb', skate: '#9333ea', festival: '#d946ef',
  conference: '#6b7280', nomad: '#f59e0b',
};

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  useEffect(() => { loadTrips(); }, []);

  const loadTrips = async () => {
    try {
      const res = await fetch('/api/trips');
      if (res.ok) {
        const data = await res.json();
        const sortedTrips = (data.trips || []).sort((a: Trip, b: Trip) => {
          const dateA = a.startDate ? new Date(a.startDate).getTime() : new Date(a.year, a.month - 1, 1).getTime();
          const dateB = b.startDate ? new Date(b.startDate).getTime() : new Date(b.year, b.month - 1, 1).getTime();
          return dateA - dateB;
        });
        setTrips(sortedTrips);
      }
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTrip = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' });
      if (res.ok) setTrips(trips.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete trip:', error);
    } finally {
      setDeleting(null);
    }
  };

  const committedTrips = trips.filter(t => t.committedAt && t.startDate);
  const plannedTrips = trips.filter(t => !t.committedAt);

  // Stats
  const stats = useMemo(() => {
    const yearTrips = committedTrips.filter(t => {
      const start = new Date(t.startDate!);
      return start.getFullYear() === selectedYear;
    });
    const totalDays = yearTrips.reduce((sum, t) => sum + t.daysTravel, 0);
    const totalBudget = yearTrips.reduce((sum, t) => sum + (t._count.expenses || 0), 0);
    const uniqueDestinations = new Set(yearTrips.map(t => t.destination).filter(Boolean)).size;
    
    return { count: yearTrips.length, days: totalDays, budget: totalBudget, destinations: uniqueDestinations };
  }, [committedTrips, selectedYear]);

  const fmt = (n: number) => '$' + n.toLocaleString();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-[#2d1b4e] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f5f5f5]">
        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">
          
          {/* Header */}
          <div className="mb-4 bg-[#2d1b4e] text-white p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Trip Command Center</h1>
                <p className="text-gray-300 text-xs font-mono">
                  {trips.length} trips · {committedTrips.length} committed · {plannedTrips.length} planning
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => router.push('/budgets/trips/new')}
                  className="px-4 py-2 text-xs bg-white text-[#2d1b4e] font-medium hover:bg-gray-100">
                  + New Trip
                </button>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Trips {selectedYear}</div>
              <div className="text-2xl font-bold font-mono text-gray-900">{stats.count}</div>
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Travel Days</div>
              <div className="text-2xl font-bold font-mono text-gray-900">{stats.days}</div>
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Destinations</div>
              <div className="text-2xl font-bold font-mono text-gray-900">{stats.destinations}</div>
            </div>
            <div className="bg-white border border-gray-200 p-4">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Budget Items</div>
              <div className="text-2xl font-bold font-mono text-gray-900">{stats.budget}</div>
            </div>
          </div>

          {/* Year Selector */}
          <div className="flex items-center justify-end mb-4">
            <div className="flex gap-1 bg-white border border-gray-200">
              {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
                <button key={year} onClick={() => setSelectedYear(year)}
                  className={`px-4 py-2 text-xs font-medium ${year === selectedYear ? 'bg-[#2d1b4e] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white border border-gray-200 mb-4">
            <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold flex items-center justify-between">
              <button onClick={() => {
                if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
                else setSelectedMonth(m => m - 1);
              }} className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20">←</button>
              <span>{FULL_MONTHS[selectedMonth]} {selectedYear}</span>
              <button onClick={() => {
                if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
                else setSelectedMonth(m => m + 1);
              }} className="px-2 py-1 text-xs bg-white/10 hover:bg-white/20">→</button>
            </div>

            {(() => {
              const monthIndex = selectedMonth;
              const monthNum = monthIndex + 1;
              const daysInMonth = new Date(selectedYear, monthNum, 0).getDate();
              const firstDayOfWeek = new Date(selectedYear, monthIndex, 1).getDay();

              const monthTrips = committedTrips.filter(t => {
                if (!t.startDate) return false;
                const start = new Date(t.startDate);
                const end = new Date(t.endDate!);
                const monthStart = new Date(selectedYear, monthIndex, 1);
                const monthEnd = new Date(selectedYear, monthNum, 0);
                return start <= monthEnd && end >= monthStart;
              });

              return (
                <div className="p-4">
                  <div className="grid grid-cols-7 gap-px text-center mb-1">
                    {WEEKDAYS.map((d, i) => (
                      <div key={i} className="text-[9px] text-gray-400 font-medium py-1">{d[0]}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-px">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, dayIndex) => {
                      const day = dayIndex + 1;
                      const currentDate = new Date(selectedYear, monthIndex, day);

                      const tripOnDay = monthTrips.find(t => {
                        const start = new Date(t.startDate!);
                        const end = new Date(t.endDate!);
                        start.setHours(0, 0, 0, 0);
                        end.setHours(23, 59, 59, 999);
                        return currentDate >= start && currentDate <= end;
                      });

                      const isStart = tripOnDay && new Date(tripOnDay.startDate!).getDate() === day &&
                        new Date(tripOnDay.startDate!).getMonth() === monthIndex;
                      const isEnd = tripOnDay && new Date(tripOnDay.endDate!).getDate() === day &&
                        new Date(tripOnDay.endDate!).getMonth() === monthIndex;

                      return (
                        <div key={day}
                          onClick={() => tripOnDay && router.push(`/budgets/trips/${tripOnDay.id}`)}
                          className={`aspect-square flex items-center justify-center text-[10px] transition-all relative ${
                            tripOnDay
                              ? 'text-white cursor-pointer hover:opacity-80'
                              : 'text-gray-500 hover:bg-gray-50'
                          }`}
                          style={tripOnDay ? { backgroundColor: ACTIVITY_COLORS[tripOnDay.activity || ''] || '#2d1b4e' } : {}}
                          title={tripOnDay ? `${tripOnDay.name} - ${tripOnDay.destination}` : undefined}
                        >
                          {day}
                          {isStart && <div className="absolute -left-px top-0 bottom-0 w-1 bg-black/30" />}
                          {isEnd && <div className="absolute -right-px top-0 bottom-0 w-1 bg-black/30" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* Month trips list */}
                  {monthTrips.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {monthTrips.map(t => (
                        <div key={t.id} onClick={() => router.push(`/budgets/trips/${t.id}`)}
                          className="text-[10px] px-2 py-1 cursor-pointer hover:opacity-80 flex items-center gap-1 text-white truncate"
                          style={{ backgroundColor: ACTIVITY_COLORS[t.activity || ''] || '#2d1b4e' }}>
                          <span className="font-medium">{t.destination || t.name}</span>
                          <span className="opacity-70">· {t.daysTravel}d</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Trip List */}
          <div className="bg-white border border-gray-200 mb-4">
            <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
              All Trips
            </div>

            {trips.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p className="text-sm mb-4">No trips yet. Create your first trip to start planning.</p>
                <button onClick={() => router.push('/budgets/trips/new')}
                  className="px-4 py-2 text-sm bg-[#2d1b4e] text-white hover:bg-[#3d2b5e]">
                  Create First Trip
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-[#3d2b5e] text-white">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Trip</th>
                      <th className="px-3 py-2 text-left font-medium">Destination</th>
                      <th className="px-3 py-2 text-left font-medium">Activity</th>
                      <th className="px-3 py-2 text-left font-medium">Dates</th>
                      <th className="px-3 py-2 text-center font-medium">Days</th>
                      <th className="px-3 py-2 text-center font-medium">Crew</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                      <th className="px-3 py-2 text-center font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {trips.map(trip => (
                      <tr key={trip.id} onClick={() => router.push(`/budgets/trips/${trip.id}`)}
                        className="hover:bg-gray-50 cursor-pointer">
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900">{trip.name}</div>
                        </td>
                        <td className="px-3 py-3 text-gray-600">{trip.destination || '—'}</td>
                        <td className="px-3 py-3">
                          {trip.activity && (
                            <span className="px-2 py-0.5 text-[10px] text-white"
                              style={{ backgroundColor: ACTIVITY_COLORS[trip.activity] || '#6b7280' }}>
                              {ACTIVITIES[trip.activity] || trip.activity}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-gray-600">
                          {trip.startDate
                            ? `${new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(trip.endDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            : `${MONTHS[trip.month - 1]} ${trip.year}`}
                        </td>
                        <td className="px-3 py-3 text-center font-mono">{trip.daysTravel}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex -space-x-1 justify-center">
                            {trip.participants.slice(0, 3).map(p => (
                              <div key={p.id}
                                className={`w-5 h-5 rounded-full border border-white flex items-center justify-center text-[8px] font-bold text-white ${
                                  p.rsvpStatus === 'confirmed' ? 'bg-emerald-500' : 'bg-gray-400'
                                }`}>
                                {p.firstName[0]}
                              </div>
                            ))}
                            {trip.participants.length > 3 && (
                              <div className="w-5 h-5 rounded-full border border-white bg-gray-200 flex items-center justify-center text-[8px] text-gray-600">
                                +{trip.participants.length - 3}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 text-[10px] ${
                            trip.committedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {trip.committedAt ? 'Committed' : 'Planning'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={(e) => deleteTrip(trip.id, e)}
                            className="text-gray-400 hover:text-red-600 text-xs px-2 py-1">
                            {deleting === trip.id ? '...' : '×'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Map */}
          <div className="bg-white border border-gray-200">
            <div className="bg-[#2d1b4e] text-white px-4 py-2 text-sm font-semibold">
              Trip Locations
            </div>
            <div className="p-4">
              <TripMap
                trips={committedTrips.map(t => ({
                  id: t.id,
                  name: t.name,
                  destination: t.destination,
                  activity: t.activity,
                  latitude: t.latitude,
                  longitude: t.longitude,
                  startDate: t.startDate,
                  endDate: t.endDate,
                }))}
                onTripClick={(id) => router.push(`/budgets/trips/${id}`)}
              />
            </div>
          </div>

          {/* Trip Detail Sidebar (when selected) */}
          {selectedTrip && (
            <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-50 overflow-y-auto">
              <div className="bg-[#2d1b4e] text-white p-4 flex justify-between items-center">
                <div>
                  <div className="font-semibold">{selectedTrip.name}</div>
                  <div className="text-xs text-gray-300">{selectedTrip.destination}</div>
                </div>
                <button onClick={() => setSelectedTrip(null)} className="text-white/60 hover:text-white">×</button>
              </div>
              {/* Quick details would go here */}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
