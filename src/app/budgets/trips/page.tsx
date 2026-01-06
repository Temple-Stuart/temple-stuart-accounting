'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout, Card, Button, Badge, PageHeader } from '@/components/ui';
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
  participants: Participant[];
  _count: {
    expenses: number;
    itinerary: number;
    budget_line_items: number;
  };
}

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ACTIVITIES: Record<string, string> = {
  surf: '🏄 Surf',
  kitesurf: '🪁 Kitesurf',
  sail: '⛵ Sail',
  snowboard: '🏂 Snowboard',
  ski: '⛷️ Ski',
  scuba: '🤿 Scuba',
  mtb: '🚵 MTB',
  climbing: '🧗 Climbing',
  hiking: '🥾 Hiking',
  fishing: '🎣 Fishing',
  golf: '⛳ Golf',
  roadcycle: '🚴 Road Cycling',
  moto: '🏍️ Moto',
  hike: '🏕️ Hike',
  climb: '🧗 Climb',
  bike: '🚴 Bike',
  run: '🏃 Run',
  triathlon: '🏊 Triathlon',
  skate: '🛹 Skate',
  festival: '🎪 Festival',
  conference: '🎤 Conference',
  nomad: '💼 Nomad',
};

const ACTIVITY_COLORS: Record<string, string> = {
  surf: 'bg-blue-500',
  kitesurf: 'bg-cyan-500',
  sail: 'bg-indigo-500',
  snowboard: 'bg-purple-500',
  ski: 'bg-violet-500',
  scuba: 'bg-teal-500',
  mtb: 'bg-orange-500',
  climbing: 'bg-red-500',
  hiking: 'bg-green-500',
  fishing: 'bg-emerald-500',
  golf: 'bg-lime-500',
  roadcycle: 'bg-yellow-500',
  moto: 'bg-rose-500',
  hike: 'bg-green-600',
  climb: 'bg-red-600',
  bike: 'bg-orange-600',
  run: 'bg-pink-500',
  triathlon: 'bg-blue-600',
  skate: 'bg-purple-600',
  festival: 'bg-fuchsia-500',
  conference: 'bg-gray-500',
  nomad: 'bg-amber-500',
};

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    try {
      const res = await fetch('/api/trips');
      if (res.ok) {
        const data = await res.json();
        setTrips(data.trips || []);
      }
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteTrip = async (id: string) => {
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTrips(trips.filter(t => t.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete trip:', error);
    } finally {
      setDeleting(null);
    }
  };

  const committedTrips = trips.filter(t => t.committedAt && t.startDate);

  return (
    <AppLayout>
      <PageHeader
        title="Trips & Agenda"
        subtitle="Plan trips, compare destinations, coordinate with your crew"
        backHref="/hub"
        actions={
          <Button onClick={() => router.push('/budgets/trips/new')}>
            + New Trip
          </Button>
        }
      />

      <div className="px-4 lg:px-8 py-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-[#b4b237] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Trip Map */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">🗺️ Trip Locations</h2>
              </div>
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
            </Card>

            {/* Year Calendar */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">📅 Trip Calendar</h2>
                <div className="flex items-center gap-2">
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        year === selectedYear
                          ? 'bg-[#b4b237] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>

              {committedTrips.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">📅</div>
                  <p>No committed trips yet. Commit a trip to see it on the calendar.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
                  {FULL_MONTHS.map((monthName, monthIndex) => {
                    const monthNum = monthIndex + 1;
                    const daysInMonth = new Date(selectedYear, monthNum, 0).getDate();
                    const firstDayOfWeek = new Date(selectedYear, monthIndex, 1).getDay();
                    
                    const monthTrips = committedTrips.filter(t => {
                      if (!t.startDate) return false;
                      const start = new Date(new Date(t.startDate).getTime() + 12*60*60*1000);
                      const end = new Date(new Date(t.endDate!).getTime() + 12*60*60*1000);
                      const monthStart = new Date(selectedYear, monthIndex, 1);
                      const monthEnd = new Date(selectedYear, monthNum, 0);
                      return start <= monthEnd && end >= monthStart;
                    });

                    return (
                      <div key={monthName} className="bg-gray-50 rounded-xl p-3">
                        <div className="text-xs font-semibold text-gray-500 mb-2 text-center">{monthName}</div>
                        
                        <div className="grid grid-cols-7 gap-px text-center">
                          {['S','M','T','W','T','F','S'].map((d, i) => (
                            <div key={i} className="text-[8px] text-gray-400 font-medium">{d}</div>
                          ))}
                          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-5" />
                          ))}
                          {Array.from({ length: daysInMonth }).map((_, dayIndex) => {
                            const day = dayIndex + 1;
                            const currentDate = new Date(selectedYear, monthIndex, day);
                            
                            const tripOnDay = monthTrips.find(t => {
                              const start = new Date(new Date(t.startDate!).getTime() + 12*60*60*1000);
                              const end = new Date(new Date(t.endDate!).getTime() + 12*60*60*1000);
                              start.setHours(0,0,0,0);
                              end.setHours(23,59,59,999);
                              currentDate.setHours(12,0,0,0);
                              return currentDate >= start && currentDate <= end;
                            });

                            return (
                              <div
                                key={day}
                                onClick={() => tripOnDay && router.push(`/budgets/trips/${tripOnDay.id}`)}
                                className={`h-5 text-[10px] flex items-center justify-center rounded-sm transition-all ${
                                  tripOnDay
                                    ? `${ACTIVITY_COLORS[tripOnDay.activity || ''] || 'bg-[#b4b237]'} text-white cursor-pointer hover:opacity-80`
                                    : 'text-gray-500 hover:bg-gray-100'
                                }`}
                                title={tripOnDay ? `${tripOnDay.name} - ${tripOnDay.destination}` : undefined}
                              >
                                {day}
                              </div>
                            );
                          })}
                        </div>

                        {monthTrips.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {monthTrips.slice(0, 2).map(t => (
                              <div
                                key={t.id}
                                onClick={() => router.push(`/budgets/trips/${t.id}`)}
                                className={`text-[9px] px-1.5 py-0.5 rounded truncate cursor-pointer ${ACTIVITY_COLORS[t.activity || ''] || 'bg-[#b4b237]'} text-white`}
                              >
                                {ACTIVITIES[t.activity || '']?.split(' ')[0] || '🗺️'} {t.destination || t.name}
                              </div>
                            ))}
                            {monthTrips.length > 2 && (
                              <div className="text-[9px] text-gray-400 text-center">+{monthTrips.length - 2} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Trip Cards */}
            {trips.length === 0 ? (
              <Card className="max-w-lg mx-auto text-center py-12">
                <div className="text-5xl mb-4">✈️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No trips yet</h3>
                <p className="text-gray-500 mb-6">Create your first trip to start planning adventures with your crew.</p>
                <Button onClick={() => router.push('/budgets/trips/new')}>Create Your First Trip</Button>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trips.map((trip) => (
                  <Card key={trip.id} className="hover:border-[#b4b237] hover:shadow-lg transition-all cursor-pointer group" noPadding>
                    <div onClick={() => router.push(`/budgets/trips/${trip.id}`)} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <span className="text-2xl">
                          {trip.activity && ACTIVITIES[trip.activity]?.split(' ')[0] || '🗺️'}
                        </span>
                        {trip.committedAt ? (
                          <Badge variant="success">Committed</Badge>
                        ) : trip.status === 'confirmed' ? (
                          <Badge variant="success">Confirmed</Badge>
                        ) : trip.status === 'planning' ? (
                          <Badge variant="warning">Planning</Badge>
                        ) : (
                          <Badge variant="default">{trip.status}</Badge>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#b4b237] transition-colors mb-1">
                        {trip.name}
                      </h3>
                      <p className="text-gray-500 text-sm mb-4">
                        {trip.destination || 'Destination TBD'} • {trip.startDate 
                          ? `${new Date(new Date(trip.startDate).getTime() + 12*60*60*1000).toLocaleDateString()} - ${new Date(new Date(trip.endDate).getTime() + 12*60*60*1000).toLocaleDateString()}`
                          : `${MONTHS[trip.month]} ${trip.year}`}
                      </p>

                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex -space-x-2">
                          {trip.participants.slice(0, 4).map((p) => (
                            <div
                              key={p.id}
                              className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white ${
                                p.rsvpStatus === 'confirmed' ? 'bg-green-500' :
                                p.rsvpStatus === 'maybe' ? 'bg-yellow-500' : 'bg-gray-400'
                              }`}
                              title={`${p.firstName} ${p.lastName}`}
                            >
                              {p.firstName[0]}
                            </div>
                          ))}
                          {trip.participants.length > 4 && (
                            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                              +{trip.participants.length - 4}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {trip.participants.filter(p => p.rsvpStatus === 'confirmed').length} confirmed
                        </span>
                      </div>

                      <div className="flex items-center gap-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                        <span>{trip.daysTravel} days</span>
                        <span>•</span>
                        <span>{trip._count.expenses} expenses</span>
                        <span>•</span>
                        <span>{trip._count.budget_line_items || trip._count.itinerary} budget items</span>
                      </div>
                    </div>

                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id); }}
                        loading={deleting === trip.id}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); router.push(`/budgets/trips/${trip.id}`); }}
                      >
                        View
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
