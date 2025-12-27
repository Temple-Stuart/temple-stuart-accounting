'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch (err) {
      console.error('Failed to load trips:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'text-yellow-700 bg-yellow-100';
      case 'confirmed': return 'text-green-700 bg-green-100';
      case 'completed': return 'text-gray-700 bg-gray-100';
      case 'cancelled': return 'text-red-700 bg-red-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const confirmedCount = (participants: Participant[]) => 
    participants.filter(p => p.rsvpStatus === 'confirmed').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#b4b237] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">TS</span>
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold text-gray-900">Trip Budgets</div>
              <div className="text-xs text-gray-400">Plan, split, track</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/hub')}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              ← Hub
            </button>
            <button
              onClick={() => router.push('/budgets/trips/new')}
              className="px-3 py-1.5 text-sm bg-[#b4b237] text-white rounded-lg font-medium hover:shadow-lg transition-all"
            >
              + New Trip
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-gray-500">Loading trips...</div>
        ) : trips.length === 0 ? (
          <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
            <div className="text-4xl mb-4">✈️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No trips yet</h2>
            <p className="text-gray-500 mb-6">Create your first trip to start planning and splitting expenses.</p>
            <button
              onClick={() => router.push('/budgets/trips/new')}
              className="px-6 py-2 bg-[#b4b237] text-white rounded-lg hover:shadow-lg transition-all"
            >
              Plan a Trip
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map(trip => (
              <div
                key={trip.id}
                onClick={() => router.push(`/budgets/trips/${trip.id}`)}
                className="bg-white rounded-xl p-6 border border-gray-200 hover:border-[#b4b237] hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">{trip.name}</h2>
                    <p className="text-gray-500">
                      {trip.destination || 'TBD'} • {MONTHS[trip.month]} {trip.year}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs capitalize ${getStatusColor(trip.status)}`}>
                    {trip.status}
                  </span>
                </div>

                <div className="flex gap-6 mt-4 text-sm">
                  <div>
                    <span className="text-gray-400">Travelers:</span>
                    <span className="ml-2 text-gray-900">
                      {confirmedCount(trip.participants)}/{trip.participants.length} confirmed
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Duration:</span>
                    <span className="ml-2 text-gray-900">{trip.daysTravel} days</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Expenses:</span>
                    <span className="ml-2 text-gray-900">{trip._count.expenses}</span>
                  </div>
                </div>

                {trip.participants.length > 0 && (
                  <div className="flex gap-1 mt-4">
                    {trip.participants.slice(0, 6).map(p => (
                      <div
                        key={p.id}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          p.rsvpStatus === 'confirmed' 
                            ? 'bg-green-500 text-white' 
                            : p.rsvpStatus === 'declined'
                            ? 'bg-red-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                        title={`${p.firstName} ${p.lastName} (${p.rsvpStatus})`}
                      >
                        {p.firstName[0]}
                      </div>
                    ))}
                    {trip.participants.length > 6 && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs bg-gray-100 text-gray-500">
                        +{trip.participants.length - 6}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
