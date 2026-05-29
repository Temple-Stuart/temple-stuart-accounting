'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import TripTimeline from '@/components/trips/TripTimeline';

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

          {/* PR-12 Fix 3: timeline of trip date blocks. Replaces the prior
              month-grid CalendarGrid + leaflet TripMap widgets — both were
              empty noise on the index page. Each trip renders as one row
              with a bar spanning its date range; Daily/Monthly toggle. */}
          <div className="bg-white border border-border">
            <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
              Trip Timeline
            </div>
            <TripTimeline
              trips={trips.map(t => ({
                id: t.id,
                name: t.name,
                destination: t.destination,
                startDate: t.startDate,
                endDate: t.endDate,
                committedAt: t.committedAt,
              }))}
            />
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
