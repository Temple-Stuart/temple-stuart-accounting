'use client';

import { useState, useEffect, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  rsvpStatus: string;
  isOwner: boolean;
  unavailableDays: number[] | null;
}

interface Trip {
  id: string;
  name: string;
  destination: string | null;
  activity: string | null;
  month: number;
  year: number;
  daysTravel: number;
  startDate: string | null;
  endDate: string | null;
  status: string;
  owner: { name: string; email: string };
  participants: Participant[];
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const ACTIVITIES: Record<string, string> = {
  surf: '🏄 Surf',
  kitesurf: '🪁 Kite Surf',
  sail: '⛵ Sail',
  snowboard: '🏂 Snowboard'
};

export default function ParticipantTripView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);

  useEffect(() => {
    // Check localStorage for saved token if none in URL
    const savedToken = localStorage.getItem('trip_token_' + id);
    if (!token && savedToken) {
      router.replace('/trips/' + id + '?token=' + savedToken);
      return;
    }
    if (token) {
      localStorage.setItem('trip_token_' + id, token);
      loadTrip();
    } else {
      setError('Missing access token. Please use your invite link.');
      setLoading(false);
    }
  }, [id, token]);

  const loadTrip = async () => {
    try {
      const res = await fetch('/api/trips/' + id + '/participant?token=' + token);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load trip');
      }
      const data = await res.json();
      setTrip(data.trip);
      setCurrentParticipant(data.participant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip');
      localStorage.removeItem('trip_token_' + id);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading trip...</div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-md">
          <div className="text-4xl mb-4">😕</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Error</h1>
          <p className="text-gray-500 mb-4">{error || 'Trip not found'}</p>
          <p className="text-sm text-gray-400">Please use the invite link shared with you.</p>
        </div>
      </div>
    );
  }

  const confirmedParticipants = trip.participants.filter(p => p.rsvpStatus === 'confirmed');
  const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#b4b237] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">TS</span>
            </div>
            <span className="font-semibold text-gray-900">{trip.name}</span>
          </div>
          {currentParticipant && (
            <div className="text-sm text-gray-500">
              Viewing as <span className="font-medium text-gray-900">{currentParticipant.firstName}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Trip Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{trip.name}</h1>
              <p className="text-gray-500">Organized by {trip.owner.name}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              trip.status === 'committed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {trip.status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Where</div>
              <div className="font-semibold text-gray-900">{trip.destination || 'TBD'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-400 text-sm">When</div>
              <div className="font-semibold text-gray-900">
                {trip.startDate 
                  ? new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : MONTHS[trip.month]} {trip.year}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Duration</div>
              <div className="font-semibold text-gray-900">{trip.daysTravel} days</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Activity</div>
              <div className="font-semibold text-gray-900">
                {trip.activity ? (ACTIVITIES[trip.activity] || trip.activity) : 'TBD'}
              </div>
            </div>
          </div>
        </div>

        {/* Travelers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">👥 Travelers ({confirmedParticipants.length})</h2>
          <div className="space-y-2">
            {trip.participants.map(p => (
              <div key={p.id} className={`flex items-center justify-between rounded-lg p-3 ${
                p.id === currentParticipant?.id ? 'bg-[#b4b237]/10 border border-[#b4b237]' : 'bg-gray-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                    p.rsvpStatus === 'confirmed' ? 'bg-green-500' : p.rsvpStatus === 'declined' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}>
                    {p.firstName[0]}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {p.firstName} {p.lastName}
                      {p.isOwner && <span className="ml-2 text-xs text-blue-500">(organizer)</span>}
                      {p.id === currentParticipant?.id && <span className="ml-2 text-xs text-[#b4b237]">(you)</span>}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  p.rsvpStatus === 'confirmed' ? 'bg-green-100 text-green-700' 
                  : p.rsvpStatus === 'declined' ? 'bg-red-100 text-red-700' 
                  : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {p.rsvpStatus}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Availability Calendar */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">📅 Group Availability - {MONTHS[trip.month]} {trip.year}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-2 px-2 text-gray-400 w-24 sticky left-0 bg-white">Traveler</th>
                  {calendarDays.map(day => (
                    <th key={day} className="text-center py-2 px-1 text-gray-400 min-w-[28px]">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confirmedParticipants.map(p => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className={`py-2 px-2 font-medium sticky left-0 bg-white ${
                      p.id === currentParticipant?.id ? 'text-[#b4b237]' : 'text-gray-700'
                    }`}>
                      {p.firstName}
                    </td>
                    {calendarDays.map(day => {
                      const blocked = (p.unavailableDays || []).includes(day);
                      return (
                        <td key={day} className="text-center py-1 px-1">
                          <div className={`w-6 h-6 rounded text-xs flex items-center justify-center ${
                            blocked ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-600'
                          }`}>
                            {blocked ? '✗' : '✓'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trip Dates (if committed) */}
        {trip.startDate && trip.endDate && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-lg font-bold text-green-800 mb-2">Trip Confirmed!</h3>
            <p className="text-green-700">
              {new Date(trip.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' - '}
              {new Date(trip.endDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
