'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import { ACTIVITY_GROUPS, ACTIVITY_LABELS } from '@/lib/activities';

const TRIP_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'mixed', label: 'Mixed' },
];

const BUDGET_OPTIONS = [
  { value: 'backpacker', label: '$0-50/night', hint: 'We\'d suggest $ venues' },
  { value: 'budget', label: '$50-100/night', hint: 'We\'d suggest $-$$ venues' },
  { value: 'midrange', label: '$100-200/night', hint: 'We\'d suggest $$ venues' },
  { value: 'comfort', label: '$200-350/night', hint: 'We\'d suggest $$-$$$ venues' },
  { value: 'premium', label: '$350-500/night', hint: 'We\'d suggest $$$ venues' },
  { value: 'luxury', label: '$500+/night', hint: 'All price levels' },
];

const VIBE_OPTIONS = [
  { value: 'chill', label: 'Chill & Relaxed' },
  { value: 'active', label: 'Adventurous' },
  { value: 'social', label: 'Social & Party' },
  { value: 'splurge', label: 'Luxe & Pampered' },
  { value: 'spontaneous', label: 'Spontaneous' },
  { value: 'offbeat', label: 'Off the Beaten Path' },
  { value: 'touristy', label: 'Hit the Highlights' },
  { value: 'local', label: 'Cultural & Immersive' },
];

const PACE_OPTIONS = [
  { value: 'slow', label: 'Slow & Savoring' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'packed', label: 'Packed & Hustling' },
];

interface Resort {
  id: string;
  name: string;
  country: string;
  state: string | null;
  region: string;
  nearestAirport: string | null;
  bestMonths?: string | null;
}

export default function NewTripPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Section 1: Trip Details
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tripType, setTripType] = useState('personal');

  // Section 2: Profile
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [budget, setBudget] = useState('midrange');
  const [vibes, setVibes] = useState<string[]>([]);
  const [pace, setPace] = useState('balanced');

  // Section 3: Destinations
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Resort[]>([]);
  const [selectedDestinations, setSelectedDestinations] = useState<Resort[]>([]);
  const [searching, setSearching] = useState(false);

  const duration = startDate && endDate
    ? Math.round((new Date(endDate + 'T12:00:00').getTime() - new Date(startDate + 'T12:00:00').getTime()) / 86400000) + 1
    : 0;

  const toggleActivity = (val: string) => {
    setSelectedActivities(prev =>
      prev.includes(val) ? prev.filter(a => a !== val) : [...prev, val]
    );
  };

  const toggleVibe = (val: string) => {
    setVibes(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : prev.length < 3 ? [...prev, val] : prev
    );
  };

  const searchDestinations = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch('/api/resorts?activity=all');
      if (res.ok) {
        const data = await res.json();
        const filtered = (data.resorts || []).filter((r: Resort) =>
          r.name.toLowerCase().includes(q.toLowerCase()) ||
          r.country.toLowerCase().includes(q.toLowerCase()) ||
          r.region?.toLowerCase().includes(q.toLowerCase())
        ).slice(0, 20);
        setSearchResults(filtered);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  const addDestination = (resort: Resort) => {
    if (!selectedDestinations.some(d => d.id === resort.id)) {
      setSelectedDestinations(prev => [...prev, resort]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeDestination = (id: string) => {
    setSelectedDestinations(prev => prev.filter(d => d.id !== id));
  };

  const canCreate = name.trim() && startDate && endDate && duration > 0;

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    setError('');

    try {
      // 1. Create trip
      const tripRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          startDate,
          endDate,
          activity: 'all',
          month: new Date(startDate + 'T12:00:00').getMonth() + 1,
          year: new Date(startDate + 'T12:00:00').getFullYear(),
          daysTravel: duration,
          daysRiding: duration,
          tripType,
        }),
      });

      if (!tripRes.ok) {
        const d = await tripRes.json();
        throw new Error(d.error || 'Failed to create trip');
      }

      const { trip } = await tripRes.json();
      const tripId = trip.id;
      const ownerId = trip.participants?.[0]?.id;

      // 2. Save organizer profile
      if (ownerId && (selectedActivities.length > 0 || budget || vibes.length > 0 || pace)) {
        await fetch(`/api/trips/${tripId}/participants`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId: ownerId,
            profile: {
              activities: selectedActivities,
              budget,
              vibe: vibes,
              pace,
              tripType: tripType === 'business' ? 'remote_work' : 'adventure',
            },
          }),
        });
      }

      // 3. Add destinations
      for (const dest of selectedDestinations) {
        await fetch(`/api/trips/${tripId}/destinations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resortId: dest.id }),
        });
      }

      // Redirect to trip detail page
      router.push(`/budgets/trips/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  const budgetHint = BUDGET_OPTIONS.find(b => b.value === budget)?.hint;

  return (
    <AppLayout>
      <div className="min-h-screen bg-bg-terminal">
        <div className="p-4 lg:p-6 max-w-2xl mx-auto">

          {/* Header */}
          <div className="mb-4 bg-brand-purple text-white p-4 flex items-center justify-between">
            <div>
              <h1 className="text-terminal-lg font-semibold">New Trip</h1>
              <p className="text-text-faint text-xs">Set up your trip, your profile, and destinations all in one go</p>
            </div>
            <button onClick={() => router.push('/budgets/trips')} className="text-xs text-text-faint hover:text-white">
              ← Back
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-brand-red px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          <div className="space-y-4">

            {/* ═══ Section 1: Trip Details ═══ */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">1</span>
                Trip Details
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Trip Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g., Bali Surf Trip 2026"
                    className="w-full px-3 py-2 border border-border text-sm focus:outline-none focus:border-brand-purple"
                    required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Start Date *</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-border text-sm focus:outline-none focus:border-brand-purple" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">End Date *</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-border text-sm focus:outline-none focus:border-brand-purple" />
                  </div>
                </div>

                {duration > 0 && (
                  <div className="text-xs text-text-muted bg-bg-row px-3 py-2">
                    Duration: <span className="font-semibold text-text-primary">{duration} days</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Trip Type</label>
                  <div className="flex gap-2">
                    {TRIP_TYPES.map(tt => (
                      <button key={tt.value} type="button" onClick={() => setTripType(tt.value)}
                        className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                          tripType === tt.value ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border border border-border'
                        }`}>
                        {tt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Section 2: Your Travel Profile ═══ */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">2</span>
                Your Travel Profile
              </div>
              <div className="p-4 space-y-5">

                {/* Interests */}
                <div>
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Your Interests
                    {selectedActivities.length > 0 && (
                      <span className="ml-2 text-brand-purple font-normal normal-case">({selectedActivities.length} selected)</span>
                    )}
                  </h4>
                  {ACTIVITY_GROUPS.map(group => (
                    <div key={group.label} className="mb-3">
                      <div className="text-[11px] font-medium text-text-muted mb-1">{group.label}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.activities.map(act => {
                          const selected = selectedActivities.includes(act.value);
                          return (
                            <button key={act.value} type="button" onClick={() => toggleActivity(act.value)}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                                selected ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border'
                              }`}>
                              {act.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Budget */}
                <div>
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Budget per Night</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {BUDGET_OPTIONS.map(bo => (
                      <button key={bo.value} type="button" onClick={() => setBudget(bo.value)}
                        className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                          budget === bo.value ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border'
                        }`}>
                        {bo.label}
                      </button>
                    ))}
                  </div>
                  {budgetHint && (
                    <div className="text-[10px] text-text-muted mt-1.5">{budgetHint}</div>
                  )}
                </div>

                {/* Vibe */}
                <div>
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                    Vibe <span className="font-normal text-text-muted">(up to 3)</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {VIBE_OPTIONS.map(vo => {
                      const selected = vibes.includes(vo.value);
                      return (
                        <button key={vo.value} type="button" onClick={() => toggleVibe(vo.value)}
                          className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                            selected ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border'
                          }`}>
                          {vo.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pace */}
                <div>
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Pace</h4>
                  <div className="flex gap-2">
                    {PACE_OPTIONS.map(po => (
                      <button key={po.value} type="button" onClick={() => setPace(po.value)}
                        className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
                          pace === po.value ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border'
                        }`}>
                        {po.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Section 3: Destinations ═══ */}
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 flex items-center justify-center text-[10px] font-bold">3</span>
                Destinations
                <span className="text-xs text-white/60 font-normal ml-auto">(optional — add later)</span>
              </div>
              <div className="p-4">
                {/* Selected destinations */}
                {selectedDestinations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedDestinations.map(d => (
                      <div key={d.id} className="flex items-center gap-1.5 bg-brand-purple-wash border border-brand-purple/20 rounded-full px-3 py-1">
                        <span className="text-xs text-text-primary">{d.name}</span>
                        <span className="text-[10px] text-text-muted">{d.country}</span>
                        {d.nearestAirport && <span className="text-[10px] font-mono text-text-faint">{d.nearestAirport}</span>}
                        <button onClick={() => removeDestination(d.id)} className="text-text-faint hover:text-brand-red text-xs ml-1">×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search */}
                <input
                  type="text"
                  placeholder="Search destinations..."
                  value={searchQuery}
                  onChange={e => searchDestinations(e.target.value)}
                  className="w-full px-3 py-2 border border-border text-sm focus:outline-none focus:border-brand-purple mb-2"
                />
                {searchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border border-border rounded">
                    {searchResults.map(r => (
                      <button key={r.id} onClick={() => addDestination(r)}
                        disabled={selectedDestinations.some(d => d.id === r.id)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-bg-row flex justify-between items-center disabled:opacity-50 border-b border-border/50 last:border-0">
                        <span>
                          <span className="font-medium">{r.name}</span>
                          <span className="text-text-muted ml-2">{r.state ? `${r.state}, ` : ''}{r.country}</span>
                        </span>
                        {r.nearestAirport && <span className="font-mono text-text-faint">{r.nearestAirport}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ Section 4: Create ═══ */}
            <div className="flex gap-3">
              <button type="button" onClick={() => router.back()}
                className="flex-1 px-4 py-3 border border-border text-text-secondary text-xs font-medium hover:bg-bg-row">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving || !canCreate}
                className="flex-1 px-4 py-3 bg-brand-purple text-white text-sm font-semibold hover:bg-brand-purple-hover disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Trip'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
