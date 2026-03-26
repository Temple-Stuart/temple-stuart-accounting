'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import { TRAVEL_INTERESTS, ACTIVITY_GROUPS } from '@/lib/activities';

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

// Map filter chip labels → activity values for auto-selecting interests
// Derived from TRAVEL_INTERESTS: each item becomes a lowercase slug value
const INTEREST_TO_ACTIVITIES: Record<string, string[]> = Object.fromEntries(
  Object.entries(TRAVEL_INTERESTS).map(([category, items]) => [
    category,
    items.map(item => item.toLowerCase().replace(/[^a-z0-9]/g, '_')),
  ])
);

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
  return (
    <AppLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <NewTripForm />
      </Suspense>
    </AppLayout>
  );
}

function NewTripForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);
  const [didAutoScroll, setDidAutoScroll] = useState(false);

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

  // Auto-populate from query params
  useEffect(() => {
    const tripName = searchParams.get('tripName');
    const sd = searchParams.get('startDate');
    const ed = searchParams.get('endDate');
    const travelers = searchParams.get('travelers');
    const interests = searchParams.get('interests');
    const destinations = searchParams.get('destinations');

    if (tripName) setName(tripName);

    if (sd) {
      // Handle both YYYY-MM-DD and MM/DD/YYYY formats
      const parsed = parseToDateInput(sd);
      if (parsed) setStartDate(parsed);
    }
    if (ed) {
      const parsed = parseToDateInput(ed);
      if (parsed) setEndDate(parsed);
    }

    // Map interest filter chips to activity toggles
    if (interests) {
      const chipLabels = interests.split(',');
      const activities = new Set<string>();
      chipLabels.forEach(label => {
        const mapped = INTEREST_TO_ACTIVITIES[label.trim()];
        if (mapped) mapped.forEach(a => activities.add(a));
      });
      if (activities.size > 0) setSelectedActivities(Array.from(activities));
    }

    // Pre-fill destinations as simple name entries (search will be needed for full resort data)
    if (destinations) {
      const destNames = destinations.split(',').map(d => d.trim()).filter(Boolean);
      const fakeResorts: Resort[] = destNames.map((n, i) => ({
        id: `param-${i}`,
        name: n,
        country: '',
        state: null,
        region: '',
        nearestAirport: null,
      }));
      setSelectedDestinations(fakeResorts);
    }
  }, [searchParams]);

  // Auto-scroll past pre-filled details to Travel Profile
  useEffect(() => {
    if (didAutoScroll) return;
    const hasPreFilled = searchParams.get('tripName') && searchParams.get('startDate');
    if (hasPreFilled && profileRef.current) {
      setTimeout(() => {
        profileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      setDidAutoScroll(true);
    }
  }, [searchParams, didAutoScroll]);

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

  const searchDestinationsApi = useCallback(async (q: string) => {
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
      const tripRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          destination: selectedDestinations.length > 0 ? selectedDestinations[0].name : undefined,
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

      // Save destinations — resolve placeholder entries by searching the resorts API
      for (const dest of selectedDestinations) {
        if (!dest.id.startsWith('param-')) {
          // Real resort ID — save directly
          await fetch(`/api/trips/${tripId}/destinations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resortId: dest.id }),
          });
        } else {
          // Placeholder from query params — search for a matching resort by name
          try {
            const searchRes = await fetch('/api/resorts?activity=all');
            if (searchRes.ok) {
              const data = await searchRes.json();
              const match = (data.resorts || []).find((r: Resort) =>
                r.name.toLowerCase() === dest.name.toLowerCase()
              );
              if (match) {
                await fetch(`/api/trips/${tripId}/destinations`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ resortId: match.id }),
                });
              }
            }
          } catch {
            // Resort not found — destination name is already set on the trip
          }
        }
      }

      router.push(`/budgets/trips/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  const budgetHint = BUDGET_OPTIONS.find(b => b.value === budget)?.hint;

  return (
      <div className="min-h-screen bg-bg-terminal">
        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">

          {error && (
            <div className="bg-red-50 border border-red-200 text-brand-red px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          <div className="space-y-3">

            {/* ═══ Section 1: Trip Details ═══ */}
            <div className="bg-white border border-border p-4">
              <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">Trip Details</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Trip Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g., Bali Surf Trip 2026"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple"
                    required />
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Start Date *</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">End Date *</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Trip Type</label>
                    <div className="flex gap-1">
                      {TRIP_TYPES.map(tt => (
                        <button key={tt.value} type="button" onClick={() => setTripType(tt.value)}
                          className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg transition-colors ${
                            tripType === tt.value ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border border border-gray-200'
                          }`}>
                          {tt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {duration > 0 && (
                    <div className="flex items-end">
                      <div className="text-xs text-text-muted bg-bg-row px-3 py-2 rounded-lg w-full text-center">
                        <span className="font-semibold text-text-primary">{duration} days</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ═══ Section 2: Your Travel Profile ═══ */}
            <div className="bg-white border border-border p-4" ref={profileRef}>
              <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">
                Your Travel Profile
                {selectedActivities.length > 0 && (
                  <span className="ml-2 text-brand-purple font-normal text-xs">({selectedActivities.length} selected)</span>
                )}
              </h2>
              <div className="space-y-4">

                {/* Interests */}
                <div>
                  <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Your Interests</h4>
                  <div className="space-y-2">
                    {ACTIVITY_GROUPS.map(group => (
                      <div key={group.label}>
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
                </div>

                {/* Budget + Vibe + Pace in a tighter grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                    {budgetHint && <div className="text-[10px] text-text-muted mt-1.5">{budgetHint}</div>}
                  </div>

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
            </div>

            {/* ═══ Section 3: Destinations ═══ */}
            <div className="bg-white border border-border p-4">
              <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4">
                Destinations
                <span className="text-xs text-text-muted font-normal ml-2">(optional — add later)</span>
              </h2>

              {/* Selected destinations */}
              {selectedDestinations.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedDestinations.map(d => (
                    <div key={d.id} className="flex items-center gap-1.5 bg-brand-purple/10 border border-brand-purple/20 rounded-full px-3 py-1">
                      <span className="text-xs text-text-primary">{d.name}</span>
                      {d.country && <span className="text-[10px] text-text-muted">{d.country}</span>}
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
                onChange={e => searchDestinationsApi(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple mb-2"
              />
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
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

            {/* ═══ Actions ═══ */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={() => router.back()}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-3 transition-colors">
                Cancel
              </button>
              <button onClick={handleCreate} disabled={saving || !canCreate}
                className="bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm px-8 py-3 rounded-lg disabled:opacity-50 transition-colors">
                {saving ? 'Creating...' : 'Create Trip'}
              </button>
            </div>

          </div>
        </div>
      </div>
  );
}

/** Parse date string (YYYY-MM-DD or MM/DD/YYYY) to YYYY-MM-DD for date inputs */
function parseToDateInput(val: string): string | null {
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  // MM/DD/YYYY
  const match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}
