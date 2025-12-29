'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout, Card, Button, Badge, PageHeader } from '@/components/ui';

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
  participants: Participant[];
  _count: {
    expenses: number;
    itinerary: number;
  };
}

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
};

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return <Badge variant="success">Confirmed</Badge>;
      case 'planning': return <Badge variant="warning">Planning</Badge>;
      case 'cancelled': return <Badge variant="danger">Cancelled</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

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

      <div className="px-4 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-[#b4b237] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trips.length === 0 ? (
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
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="text-2xl mr-2">
                        {trip.activity && ACTIVITIES[trip.activity]?.split(' ')[0] || '🗺️'}
                      </span>
                    </div>
                    {getStatusBadge(trip.status)}
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#b4b237] transition-colors mb-1">
                    {trip.name}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {trip.destination || 'Destination TBD'} • {MONTHS[trip.month]} {trip.year}
                  </p>

                  {/* Participants */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex -space-x-2">
                      {trip.participants.slice(0, 4).map((p, i) => (
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

                  {/* Stats */}
                  <div className="flex items-center gap-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                    <span>{trip.daysTravel} days</span>
                    <span>•</span>
                    <span>{trip._count.expenses} expenses</span>
                    <span>•</span>
                    <span>{trip._count.itinerary} items</span>
                  </div>
                </div>

                {/* Actions */}
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
      </div>
    </AppLayout>
  );
}
