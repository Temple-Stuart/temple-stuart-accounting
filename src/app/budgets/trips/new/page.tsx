'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';

const ACTIVITY_GROUPS = [
  {
    label: 'Snow & Mountain',
    activities: [
      { value: 'snowboard', label: 'Snowboard' },
      { value: 'ski', label: 'Ski' },
      { value: 'backcountry', label: 'Backcountry' },
      { value: 'mtb', label: 'Mountain Bike' },
      { value: 'hike', label: 'Hiking' },
      { value: 'camp', label: 'Camping' },
      { value: 'climb', label: 'Rock Climbing' },
    ]
  },
  {
    label: 'Water Sports',
    activities: [
      { value: 'surf', label: 'Surf' },
      { value: 'kitesurf', label: 'Kitesurf' },
      { value: 'windsurf', label: 'Windsurf' },
      { value: 'wakeboard', label: 'Wakeboard' },
      { value: 'sail', label: 'Sailing' },
      { value: 'kayak', label: 'Kayak' },
      { value: 'scuba', label: 'Scuba Dive' },
      { value: 'fish', label: 'Fishing' },
    ]
  },
  {
    label: 'Endurance & Fitness',
    activities: [
      { value: 'roadbike', label: 'Road Cycling' },
      { value: 'gravel', label: 'Gravel Bike' },
      { value: 'run', label: 'Running' },
      { value: 'trail', label: 'Trail Running' },
      { value: 'triathlon', label: 'Triathlon' },
      { value: 'yoga', label: 'Yoga Retreat' },
    ]
  },
  {
    label: 'Motorsports & Action',
    activities: [
      { value: 'moto', label: 'Motorcycle' },
      { value: 'atv', label: 'ATV/UTV' },
      { value: 'skydive', label: 'Skydiving' },
      { value: 'paraglide', label: 'Paragliding' },
    ]
  },
  {
    label: 'Urban & Lifestyle',
    activities: [
      { value: 'golf', label: 'Golf' },
      { value: 'tennis', label: 'Tennis' },
      { value: 'skate', label: 'Skateboard' },
      { value: 'foodtour', label: 'Food Tour' },
      { value: 'winetour', label: 'Wine Tour' },
    ]
  },
  {
    label: 'Culture & Events',
    activities: [
      { value: 'festival', label: 'Festival' },
      { value: 'concert', label: 'Concert' },
      { value: 'conference', label: 'Conference' },
      { value: 'wedding', label: 'Wedding' },
    ]
  },
  {
    label: 'Business & Work',
    activities: [
      { value: 'nomad', label: 'Remote Work' },
      { value: 'coworking', label: 'Coworking' },
      { value: 'retreat', label: 'Team Retreat' },
    ]
  },
  {
    label: 'Wildlife & Nature',
    activities: [
      { value: 'safari', label: 'Safari' },
      { value: 'nationalpark', label: 'National Park' },
      { value: 'beach', label: 'Beach' },
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
    setActivities(prev => prev.includes(value) ? prev.filter(a => a !== value) : [...prev, value]);
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
          activity: activities[0] || null,
          month: new Date(startDate + 'T12:00:00').getMonth() + 1,
          year: new Date(startDate + 'T12:00:00').getFullYear(),
          startDate,
          daysTravel,
          daysRiding: daysTravel
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
    }
  };

  // Success screen
  if (created) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#f5f5f5]">
          <div className="p-4 lg:p-6 max-w-xl mx-auto">
            <div className="bg-white border border-gray-200">
              <div className="bg-[#2d1b4e] text-white p-4 text-center">
                <div className="text-lg font-semibold">Trip Created</div>
              </div>
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">✓</div>
                <p className="text-gray-600 mb-6 text-sm">
                  Share the invite link with your travelers. They'll add their names and blackout dates.
                </p>

                <div className="bg-gray-50 p-3 mb-6">
                  <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Invite Link</label>
                  <div className="flex gap-2">
                    <input type="text" value={created.inviteUrl} readOnly
                      className="flex-1 px-3 py-2 border border-gray-200 text-xs font-mono bg-white" />
                    <button onClick={copyInviteLink}
                      className="px-4 py-2 bg-[#2d1b4e] text-white text-xs font-medium hover:bg-[#3d2b5e]">
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <button onClick={() => router.push(`/budgets/trips/${created.id}`)}
                    className="px-6 py-2 bg-[#2d1b4e] text-white text-xs font-medium hover:bg-[#3d2b5e]">
                    View Trip →
                  </button>
                  <button onClick={() => router.push('/budgets/trips')}
                    className="px-6 py-2 border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50">
                    All Trips
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f5f5f5]">
        <div className="p-4 lg:p-6 max-w-2xl mx-auto">
          
          {/* Header */}
          <div className="mb-4 bg-[#2d1b4e] text-white p-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">New Trip</h1>
              <p className="text-gray-300 text-xs">Plan your next adventure</p>
            </div>
            <button onClick={() => router.push('/budgets/trips')} className="text-xs text-gray-300 hover:text-white">
              ← Back
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Trip Name */}
            <div className="bg-white border border-gray-200">
              <div className="bg-[#3d2b5e] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                Trip Details
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Trip Name *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Bali Surf Trip 2025"
                    className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[#2d1b4e]"
                    required />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[#2d1b4e]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Duration (days)</label>
                    <input type="number" min={1} max={90} value={daysTravel}
                      onChange={(e) => setDaysTravel(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-200 text-sm focus:outline-none focus:border-[#2d1b4e]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Activities */}
            <div className="bg-white border border-gray-200">
              <div className="bg-[#3d2b5e] text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>Activities</span>
                {activities.length > 0 && (
                  <span className="text-[10px] bg-white/20 px-2 py-0.5">{activities.length} selected</span>
                )}
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto space-y-4">
                {ACTIVITY_GROUPS.map(group => (
                  <div key={group.label}>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{group.label}</div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {group.activities.map(a => {
                        const isSelected = activities.includes(a.value);
                        return (
                          <button key={a.value} type="button" onClick={() => toggleActivity(a.value)}
                            className={`px-3 py-2 text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-[#2d1b4e] text-white'
                                : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}>
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected summary */}
              {activities.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <div className="flex flex-wrap gap-1">
                    {activities.map(actValue => {
                      const act = ACTIVITY_GROUPS.flatMap(g => g.activities).find(a => a.value === actValue);
                      return act ? (
                        <span key={actValue}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-[#2d1b4e] text-white text-[10px] font-medium">
                          {act.label}
                          <button type="button" onClick={() => toggleActivity(actValue)} className="ml-1 hover:text-gray-300">×</button>
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 p-4 text-xs text-blue-800">
              <strong>How it works:</strong> After creating, you'll get a shareable invite link. 
              Send it to your crew — they'll add their names and mark blackout dates.
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button type="button" onClick={() => router.back()}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={saving || !name || activities.length === 0}
                className="flex-1 px-4 py-3 bg-[#2d1b4e] text-white text-xs font-medium hover:bg-[#3d2b5e] disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Trip'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
