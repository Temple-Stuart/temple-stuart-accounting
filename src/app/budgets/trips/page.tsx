'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import TripMap from '@/components/trips/TripMap';
import CalendarGrid, { type CalendarEvent, type SourceConfig } from '@/components/shared/CalendarGrid';
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

interface ItineraryItem {
  id: string;
  tripId: string;
  day: number;
  destDate: string;
  destTime: string | null;
  category: string;
  vendor: string;
  cost: string;
  note: string | null;
  location: string | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

// Trip calendar source config — maps to trip booking categories
const TRIP_SOURCE_CONFIG: Record<string, SourceConfig> = {
  flight:    { label: 'Flights',     icon: 'plane',    bg: 'bg-blue-100',    dot: 'bg-blue-400',    badge: 'bg-blue-500' },
  hotel:     { label: 'Hotels',      icon: 'bed',      bg: 'bg-purple-100',  dot: 'bg-purple-400',  badge: 'bg-purple-500' },
  activity:  { label: 'Activities',  icon: 'compass',  bg: 'bg-emerald-100', dot: 'bg-emerald-400', badge: 'bg-emerald-500' },
  transfer:  { label: 'Transfers',   icon: 'car',      bg: 'bg-amber-100',   dot: 'bg-amber-400',   badge: 'bg-amber-500' },
  nightlife: { label: 'Nightlife',   icon: 'music',    bg: 'bg-pink-100',    dot: 'bg-pink-400',    badge: 'bg-pink-500' },
  coworking: { label: 'Coworking',   icon: 'laptop',   bg: 'bg-cyan-100',    dot: 'bg-cyan-400',    badge: 'bg-cyan-500' },
  food:      { label: 'Food',        icon: 'utensils', bg: 'bg-orange-100',  dot: 'bg-orange-400',  badge: 'bg-orange-500' },
  trip:      { label: 'Trip Range',  icon: 'map',      bg: 'bg-indigo-100',  dot: 'bg-indigo-400',  badge: 'bg-indigo-400' },
};

// Map itinerary categories to source config keys
function mapCategory(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes('flight') || lower.includes('air')) return 'flight';
  if (lower.includes('hotel') || lower.includes('accom') || lower.includes('stay') || lower.includes('lodge') || lower.includes('hostel') || lower.includes('airbnb')) return 'hotel';
  if (lower.includes('transfer') || lower.includes('taxi') || lower.includes('uber') || lower.includes('car') || lower.includes('rental') || lower.includes('train') || lower.includes('bus')) return 'transfer';
  if (lower.includes('night') || lower.includes('bar') || lower.includes('club')) return 'nightlife';
  if (lower.includes('cowork') || lower.includes('office') || lower.includes('work')) return 'coworking';
  if (lower.includes('food') || lower.includes('dining') || lower.includes('restaurant') || lower.includes('meal') || lower.includes('breakfast') || lower.includes('lunch') || lower.includes('dinner')) return 'food';
  return 'activity';
}

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

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
        // Fetch itinerary items for each trip with dates
        loadItineraryEvents(sortedTrips);
      }
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadItineraryEvents = async (loadedTrips: Trip[]) => {
    const tripsWithDates = loadedTrips.filter(t => t.startDate && t.endDate);
    const events: CalendarEvent[] = [];

    // Add trip date ranges as background events
    for (const trip of tripsWithDates) {
      const start = trip.startDate!.split('T')[0];
      const end = trip.endDate!.split('T')[0];
      // Create one event per day of the trip range
      const startDate = new Date(start);
      const endDate = new Date(end);
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        const dateKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        const isFirst = cursor.getTime() === startDate.getTime();
        events.push({
          id: `trip-${trip.id}-${dateKey}`,
          source: 'trip',
          title: isFirst ? trip.name : (trip.destination || trip.name),
          startDate: dateKey,
          location: trip.destination,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // Fetch itinerary items from each trip
    const itineraryPromises = tripsWithDates.map(async (trip) => {
      try {
        const res = await fetch(`/api/trips/${trip.id}/itinerary`);
        if (res.ok) {
          const data = await res.json();
          return (data.items || data.itinerary || []).map((item: ItineraryItem) => ({
            ...item,
            tripId: trip.id,
            tripName: trip.name,
          }));
        }
      } catch {
        // Skip failed fetches
      }
      return [];
    });

    const allItems = (await Promise.all(itineraryPromises)).flat();
    for (const item of allItems) {
      if (!item.destDate) continue;
      const dateStr = typeof item.destDate === 'string' ? item.destDate.split('T')[0] : '';
      if (!dateStr) continue;
      const source = mapCategory(item.category || '');
      const timeStr = item.destTime ? ` ${item.destTime}` : '';
      events.push({
        id: item.id,
        source,
        title: `${item.vendor}${timeStr}`,
        startDate: dateStr,
        location: item.location,
        budgetAmount: item.cost ? Math.round(parseFloat(item.cost) * 100) : undefined,
      });
    }

    setCalendarEvents(events);
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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-bg-terminal">
        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">

          {/* Trip List */}
          <div className="bg-white border border-border mb-4">
            <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
              All Trips
            </div>

            {trips.length === 0 ? (
              <div className="p-8 text-center text-text-faint">
                <p className="text-sm mb-4">No trips yet. Use the search bar above to create your first trip.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-brand-purple-hover text-white">
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
                  <tbody className="divide-y divide-border">
                    {trips.map(trip => (
                      <tr key={trip.id} onClick={() => router.push(`/budgets/trips/${trip.id}`)}
                        className="hover:bg-bg-row cursor-pointer">
                        <td className="px-3 py-3">
                          <div className="font-medium text-text-primary">{trip.name}</div>
                        </td>
                        <td className="px-3 py-3 text-text-secondary">{trip.destination || '—'}</td>
                        <td className="px-3 py-3">
                          {trip.activity && (
                            <span className="px-2 py-0.5 text-[10px] text-white"
                              style={{ backgroundColor: ACTIVITY_COLORS[trip.activity] || '#6b7280' }}>
                              {ACTIVITIES[trip.activity] || trip.activity}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-text-secondary">
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
                                  p.rsvpStatus === 'confirmed' ? 'bg-emerald-500' : 'bg-text-faint'
                                }`}>
                                {p.firstName[0]}
                              </div>
                            ))}
                            {trip.participants.length > 3 && (
                              <div className="w-5 h-5 rounded-full border border-white bg-border flex items-center justify-center text-[8px] text-text-secondary">
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
                            className="text-text-faint hover:text-brand-red text-xs px-2 py-1">
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

          {/* Trip Calendar */}
          <div className="bg-white border border-border mb-4">
            <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
              Trip Calendar
            </div>
            <CalendarGrid
              events={calendarEvents}
              sourceConfig={TRIP_SOURCE_CONFIG}
              defaultView="month"
              showCategoryLegend={true}
              showBudgetTotals={true}
            />
          </div>

          {/* Map */}
          <div className="bg-white border border-border">
            <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
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
            <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-sm z-50 overflow-y-auto">
              <div className="bg-brand-purple text-white p-4 flex justify-between items-center">
                <div>
                  <div className="font-semibold">{selectedTrip.name}</div>
                  <div className="text-xs text-text-faint">{selectedTrip.destination}</div>
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
