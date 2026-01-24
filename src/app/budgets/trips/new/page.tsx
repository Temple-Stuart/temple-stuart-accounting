'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ACTIVITY_GROUPS = [
  {
    label: 'Snow & Mountain',
    activities: [
      { value: 'snowboard', label: 'Snowboard', icon: '🏂' },
      { value: 'ski', label: 'Ski', icon: '⛷️' },
      { value: 'backcountry', label: 'Backcountry', icon: '🎿' },
      { value: 'mtb', label: 'Mountain Bike', icon: '🚵' },
      { value: 'hike', label: 'Hiking', icon: '🥾' },
      { value: 'camp', label: 'Camping', icon: '🏕️' },
      { value: 'climb', label: 'Rock Climbing', icon: '🧗' },
      { value: 'bouldering', label: 'Bouldering', icon: '🪨' },
    ]
  },
  {
    label: 'Water Sports',
    activities: [
      { value: 'surf', label: 'Surf', icon: '🏄' },
      { value: 'kitesurf', label: 'Kitesurf', icon: '🪁' },
      { value: 'windsurf', label: 'Windsurf', icon: '🌊' },
      { value: 'wakeboard', label: 'Wakeboard', icon: '🏄‍♂️' },
      { value: 'sail', label: 'Sailing', icon: '⛵' },
      { value: 'kayak', label: 'Kayak', icon: '🛶' },
      { value: 'rafting', label: 'Rafting', icon: '🚣' },
      { value: 'scuba', label: 'Scuba Dive', icon: '🤿' },
      { value: 'snorkel', label: 'Snorkel', icon: '🐠' },
      { value: 'swim', label: 'Swim', icon: '🏊' },
      { value: 'cliffjump', label: 'Cliff Jump', icon: '🪂' },
      { value: 'fish', label: 'Fishing', icon: '🎣' },
    ]
  },
  {
    label: 'Endurance & Fitness',
    activities: [
      { value: 'roadbike', label: 'Road Cycling', icon: '🚴' },
      { value: 'gravel', label: 'Gravel Bike', icon: '🚲' },
      { value: 'run', label: 'Running', icon: '🏃' },
      { value: 'trail', label: 'Trail Running', icon: '🏔️' },
      { value: 'marathon', label: 'Marathon', icon: '🏅' },
      { value: 'triathlon', label: 'Triathlon', icon: '🏊‍♂️' },
      { value: 'crossfit', label: 'CrossFit', icon: '🏋️' },
      { value: 'yoga', label: 'Yoga Retreat', icon: '🧘' },
      { value: 'wellness', label: 'Wellness & Spa', icon: '💆' },
    ]
  },
  {
    label: 'Motorsports & Action',
    activities: [
      { value: 'moto', label: 'Motorcycle', icon: '🏍️' },
      { value: 'atv', label: 'ATV/UTV', icon: '🛞' },
      { value: 'skydive', label: 'Skydiving', icon: '🪂' },
      { value: 'paraglide', label: 'Paragliding', icon: '🪂' },
      { value: 'bungee', label: 'Bungee Jump', icon: '🎢' },
      { value: 'zipline', label: 'Zipline', icon: '🌲' },
    ]
  },
  {
    label: 'Urban & Lifestyle',
    activities: [
      { value: 'golf', label: 'Golf', icon: '⛳' },
      { value: 'tennis', label: 'Tennis', icon: '🎾' },
      { value: 'pickleball', label: 'Pickleball', icon: '🏓' },
      { value: 'skate', label: 'Skateboard', icon: '🛹' },
      { value: 'photography', label: 'Photography', icon: '📷' },
      { value: 'foodtour', label: 'Food Tour', icon: '🍜' },
      { value: 'winetour', label: 'Wine Tour', icon: '🍷' },
      { value: 'breweries', label: 'Breweries', icon: '🍺' },
    ]
  },
  {
    label: 'Culture & Entertainment',
    activities: [
      { value: 'museum', label: 'Museums', icon: '🏛️' },
      { value: 'art', label: 'Art Galleries', icon: '🎨' },
      { value: 'history', label: 'Historical Sites', icon: '🏰' },
      { value: 'festival', label: 'Festival', icon: '🎪' },
      { value: 'concert', label: 'Concert', icon: '🎸' },
      { value: 'nightlife', label: 'Nightlife', icon: '🎉' },
      { value: 'theater', label: 'Theater', icon: '🎭' },
      { value: 'sports', label: 'Watch Sports', icon: '🏟️' },
    ]
  },
  {
    label: 'Business & Work',
    activities: [
      { value: 'conference', label: 'Conference', icon: '🎤' },
      { value: 'nomad', label: 'Remote Work', icon: '💻' },
      { value: 'coworking', label: 'Coworking', icon: '🏢' },
      { value: 'networking', label: 'Networking', icon: '🤝' },
      { value: 'retreat', label: 'Team Retreat', icon: '👥' },
      { value: 'workshop', label: 'Workshop', icon: '📋' },
    ]
  },
  {
    label: 'Social & Dining',
    activities: [
      { value: 'dinner', label: 'Fine Dining', icon: '🍽️' },
      { value: 'brunch', label: 'Brunch', icon: '🥂' },
      { value: 'coffee', label: 'Coffee Culture', icon: '☕' },
      { value: 'cooking', label: 'Cooking Class', icon: '👨‍🍳' },
      { value: 'wedding', label: 'Wedding', icon: '💒' },
      { value: 'bachelor', label: 'Bachelor/ette', icon: '🥳' },
      { value: 'birthday', label: 'Birthday', icon: '🎂' },
      { value: 'reunion', label: 'Reunion', icon: '👨‍👩‍👧‍👦' },
    ]
  },
  {
    label: 'Wildlife & Nature',
    activities: [
      { value: 'safari', label: 'Safari', icon: '🦁' },
      { value: 'whalewatching', label: 'Whale Watch', icon: '🐋' },
      { value: 'birdwatching', label: 'Bird Watch', icon: '🦅' },
      { value: 'stargazing', label: 'Stargazing', icon: '🌌' },
      { value: 'nationalpark', label: 'National Park', icon: '🏞️' },
      { value: 'beach', label: 'Beach', icon: '🏖️' },
      { value: 'hotspring', label: 'Hot Springs', icon: '♨️' },
    ]
  },
];

export default function NewTripPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ id: string; inviteUrl: string } | null>(null);

  const [name, setName] = useState('');
  const [activities, setActivities] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [daysTravel, setDaysTravel] = useState(7);

  const toggleActivity = (value: string) => {
    setActivities(prev => 
      prev.includes(value) 
        ? prev.filter(a => a !== value)
        : [...prev, value]
    );
  };

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
          activities,
          activity: activities[0] || null, // backward compat: primary activity
          month: new Date(startDate + 'T12:00:00').getMonth() + 1,
          year: new Date(startDate + 'T12:00:00').getFullYear(),
          startDate,
          daysTravel,
          daysRiding: daysTravel // default to total days
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

  // Success screen
  if (created) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center">
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
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
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
            <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center">
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

      <main className="max-w-2xl mx-auto px-4 py-8">
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
              placeholder="e.g., Bali Surf & Work Trip 2025"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-600"
              required
            />
          </div>

          {/* Activity Selection - Multi-select */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">Activities *</label>
              {activities.length > 0 && (
                <span className="text-xs bg-purple-600/10 text-purple-600 px-2 py-1 rounded-full font-medium">
                  {activities.length} selected
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-4">Select all that apply — these feed into AI recommendations</p>
            
            <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2">
              {ACTIVITY_GROUPS.map(group => (
                <div key={group.label}>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 sticky top-0 bg-white py-1">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {group.activities.map(a => {
                      const isSelected = activities.includes(a.value);
                      return (
                        <button
                          key={a.value}
                          type="button"
                          onClick={() => toggleActivity(a.value)}
                          className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                            isSelected
                              ? 'border-purple-600 bg-purple-600/10 shadow-sm'
                              : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="text-xl mb-0.5">{a.icon}</div>
                          <div className="text-xs font-medium text-gray-700 leading-tight">{a.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected activities summary */}
            {activities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {activities.map(actValue => {
                    const act = ACTIVITY_GROUPS.flatMap(g => g.activities).find(a => a.value === actValue);
                    return act ? (
                      <span 
                        key={actValue}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600/10 text-purple-600 rounded-full text-xs font-medium"
                      >
                        {act.icon} {act.label}
                        <button
                          type="button"
                          onClick={() => toggleActivity(actValue)}
                          className="ml-1 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* When */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-600"
            />
            <p className="text-xs text-gray-500 mt-2">Trip can span multiple months based on duration</p>
          </div>

          {/* Duration - Single field now */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Duration (days)</label>
            <input
              type="number"
              min={1}
              max={90}
              value={daysTravel}
              onChange={(e) => setDaysTravel(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-purple-600"
            />
            <p className="text-xs text-gray-500 mt-2">Total trip length including travel days</p>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex gap-3">
              <div className="text-blue-500 text-xl">💡</div>
              <div className="text-sm text-blue-800">
                <strong>How it works:</strong> After creating the trip, you'll get a shareable invite link. 
                Send it to your crew — they'll add their names and mark blackout dates. The AI will use your 
                selected activities to recommend lodging, restaurants, and experiences.
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
              disabled={saving || !name || activities.length === 0}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
