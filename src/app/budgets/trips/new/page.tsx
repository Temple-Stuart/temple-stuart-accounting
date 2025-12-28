'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
];

const ACTIVITY_GROUPS = [
  {
    label: 'Mountain',
    activities: [
      { value: 'snowboard', label: 'Snowboard', icon: '🏂' },
      { value: 'mtb', label: 'Mountain Bike', icon: '🚵' },
      { value: 'hike', label: 'Camp & Hike', icon: '🏕️' },
      { value: 'climb', label: 'Rock Climb', icon: '🧗' },
    ]
  },
  {
    label: 'Water',
    activities: [
      { value: 'surf', label: 'Surf', icon: '🏄' },
      { value: 'kitesurf', label: 'Kite Surf', icon: '🪁' },
      { value: 'sail', label: 'Sail', icon: '⛵' },
    ]
  },
  {
    label: 'Endurance',
    activities: [
      { value: 'bike', label: 'Bike', icon: '🚴' },
      { value: 'run', label: 'Run', icon: '🏃' },
      { value: 'triathlon', label: 'Triathlon', icon: '🏊' },
    ]
  },
  {
    label: 'Lifestyle',
    activities: [
      { value: 'golf', label: 'Golf', icon: '⛳' },
      { value: 'skate', label: 'Skateboard', icon: '🛹' },
      { value: 'festival', label: 'Concert & Festival', icon: '🎪' },
    ]
  },
  {
    label: 'Business',
    activities: [
      { value: 'conference', label: 'Conference', icon: '🎤' },
      { value: 'nomad', label: 'Meeting / Study', icon: '💼' },
    ]
  },
];

export default function NewTripPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ id: string; inviteUrl: string } | null>(null);

  const [name, setName] = useState('');
  const [activity, setActivity] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [daysTravel, setDaysTravel] = useState(7);
  const [daysRiding, setDaysRiding] = useState(5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          activity: activity || null,
          month,
          year,
          daysTravel,
          daysRiding
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create trip');
      }

      const { trip } = await res.json();
      const inviteUrl = `${window.location.origin}/trips/rsvp?token=${trip.inviteToken}`;
      setCreated({ id: trip.id, inviteUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  const copyInviteLink = () => {
    if (created?.inviteUrl) {
      navigator.clipboard.writeText(created.inviteUrl);
      alert('Invite link copied!');
    }
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2];

  // Success screen
  if (created) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#b4b237] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">TS</span>
              </div>
              <div className="font-semibold text-gray-900">Trip Created!</div>
            </div>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 py-12">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Trip Created!</h1>
            <p className="text-gray-500 mb-8">
              Share the invite link with your travelers. They'll add their names and blackout dates.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <label className="block text-sm text-gray-500 mb-2">Invite Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={created.inviteUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                />
                <button
                  onClick={copyInviteLink}
                  className="px-4 py-2 bg-[#b4b237] text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/budgets/trips/${created.id}`)}
                className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-all"
              >
                View Trip →
              </button>
              <button
                onClick={() => router.push('/budgets/trips')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 transition-all"
              >
                All Trips
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#b4b237] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">TS</span>
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold text-gray-900">New Trip</div>
              <div className="text-xs text-gray-400">Plan your adventure</div>
            </div>
          </div>
          <button 
            onClick={() => router.push('/budgets/trips')}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Back
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Trip Name */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Trip Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Bali Surf Trip 2025"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
              required
            />
          </div>

          {/* Activity Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-4">Activity *</label>
            <div className="space-y-4">
              {ACTIVITY_GROUPS.map(group => (
                <div key={group.label}>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">{group.label}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {group.activities.map(a => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => setActivity(a.value)}
                        className={`p-3 rounded-lg border-2 text-center transition-all ${
                          activity === a.value
                            ? 'border-[#b4b237] bg-[#b4b237]/10'
                            : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="text-2xl mb-1">{a.icon}</div>
                        <div className="text-xs font-medium text-gray-700">{a.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* When */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">When</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Month</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                >
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Year</label>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Duration</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Total Days</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={daysTravel}
                  onChange={(e) => setDaysTravel(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Activity Days</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={daysRiding}
                  onChange={(e) => setDaysRiding(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex gap-3">
              <div className="text-blue-500 text-xl">💡</div>
              <div className="text-sm text-blue-800">
                <strong>How it works:</strong> After creating the trip, you'll get a shareable invite link. 
                Send it to your crew — they'll add their names and mark blackout dates.
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name || !activity}
              className="flex-1 px-6 py-3 bg-[#b4b237] text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
