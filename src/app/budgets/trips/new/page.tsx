'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import { TRAVEL_INTERESTS, ACTIVITY_GROUPS } from '@/lib/activities';
import { ChevronDown } from 'lucide-react';

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

// Map filter chip labels → activity values
const INTEREST_TO_ACTIVITIES: Record<string, string[]> = Object.fromEntries(
  Object.entries(TRAVEL_INTERESTS).map(([category, items]) => [
    category,
    items.map(item => item.toLowerCase().replace(/[^a-z0-9]/g, '_')),
  ])
);

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

  // Trip type (not in search bar)
  const [tripType, setTripType] = useState('personal');

  // Profile
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [budget, setBudget] = useState('midrange');
  const [vibes, setVibes] = useState<string[]>([]);
  const [pace, setPace] = useState('balanced');

  // Track which interest categories are expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Read interests from URL params and auto-expand/select matching categories
  useEffect(() => {
    const interests = searchParams.get('interests');
    if (interests) {
      const chipLabels = interests.split(',').map(c => c.trim());
      const expanded = new Set<string>();
      const activities = new Set<string>();
      chipLabels.forEach(label => {
        const mapped = INTEREST_TO_ACTIVITIES[label];
        if (mapped) {
          expanded.add(label);
          mapped.forEach(a => activities.add(a));
        }
      });
      if (expanded.size > 0) setExpandedCategories(expanded);
      if (activities.size > 0) setSelectedActivities(Array.from(activities));
    }
  }, [searchParams]);

  // Read trip details from URL params (set by search bar)
  const name = searchParams.get('tripName') || '';
  const startDate = (() => {
    const sd = searchParams.get('startDate');
    if (!sd) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(sd)) return sd;
    const match = sd.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    return '';
  })();
  const endDate = (() => {
    const ed = searchParams.get('endDate');
    if (!ed) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(ed)) return ed;
    const match = ed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    return '';
  })();
  const destinations = searchParams.get('destinations')?.split(',').map(d => d.trim()).filter(Boolean) || [];

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

  const toggleCategory = (label: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
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
          destination: destinations.length > 0 ? destinations[0] : undefined,
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

      // Save destinations — search resorts API for matching entries
      for (const destName of destinations) {
        try {
          const searchRes = await fetch('/api/resorts?activity=all');
          if (searchRes.ok) {
            const data = await searchRes.json();
            const match = (data.resorts || []).find((r: any) =>
              r.name.toLowerCase() === destName.toLowerCase()
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

      router.push(`/budgets/trips/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  const budgetHint = BUDGET_OPTIONS.find(b => b.value === budget)?.hint;

  // Categories to show: selected chips first (expanded), then unselected if user clicked "+ Add Category"
  const selectedCategoryGroups = ACTIVITY_GROUPS.filter(g => expandedCategories.has(g.label));
  const unselectedCategoryGroups = ACTIVITY_GROUPS.filter(g => !expandedCategories.has(g.label));

  return (
    <div className="min-h-screen bg-bg-terminal">
      <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">

        {error && (
          <div className="bg-red-50 border border-red-200 text-brand-red px-4 py-3 mb-4 text-sm">{error}</div>
        )}

        {/* Summary of what's in the search bar */}
        {(name || destinations.length > 0 || startDate) && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {name && <span className="font-medium text-gray-900">{name}</span>}
            {destinations.length > 0 && (
              <span>{destinations.join(' → ')}</span>
            )}
            {startDate && endDate && (
              <span>{new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {duration} days</span>
            )}
          </div>
        )}

        <div className="space-y-3">

          {/* Trip Type */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Trip Type</h2>
            <div className="flex gap-2">
              {TRIP_TYPES.map(tt => (
                <button key={tt.value} type="button" onClick={() => setTripType(tt.value)}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                    tripType === tt.value ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border border border-gray-200'
                  }`}>
                  {tt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Travel Profile — Interests */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">
              Your Interests
              {selectedActivities.length > 0 && (
                <span className="ml-2 text-brand-purple font-normal text-xs">({selectedActivities.length} selected)</span>
              )}
            </h2>

            {/* Selected/expanded categories */}
            {selectedCategoryGroups.length > 0 ? (
              <div className="space-y-3">
                {selectedCategoryGroups.map(group => (
                  <div key={group.label}>
                    <button onClick={() => toggleCategory(group.label)}
                      className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1.5 hover:text-brand-purple">
                      <ChevronDown className="w-3.5 h-3.5" />
                      {group.label}
                    </button>
                    <div className="flex flex-wrap gap-1.5 pl-5">
                      {group.activities.map(act => {
                        const selected = selectedActivities.includes(act.value);
                        return (
                          <button key={act.value} type="button" onClick={() => toggleActivity(act.value)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
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
            ) : (
              <p className="text-xs text-gray-400 mb-3">Select interest categories using the filter chips in the search bar above, or add them below.</p>
            )}

            {/* Collapsed unselected categories */}
            {!showAllCategories && unselectedCategoryGroups.length > 0 && (
              <button onClick={() => setShowAllCategories(true)}
                className="mt-3 text-xs text-brand-purple hover:underline font-medium">
                + Add Category ({unselectedCategoryGroups.length} more)
              </button>
            )}

            {showAllCategories && unselectedCategoryGroups.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                {unselectedCategoryGroups.map(group => (
                  <div key={group.label}>
                    <button onClick={() => toggleCategory(group.label)}
                      className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1.5 hover:text-brand-purple">
                      <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                      {group.label}
                    </button>
                    {expandedCategories.has(group.label) && (
                      <div className="flex flex-wrap gap-1.5 pl-5">
                        {group.activities.map(act => {
                          const selected = selectedActivities.includes(act.value);
                          return (
                            <button key={act.value} type="button" onClick={() => toggleActivity(act.value)}
                              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                selected ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border'
                              }`}>
                              {act.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Budget + Vibe + Pace */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-3">Preferences</h2>
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
                {budgetHint && <div className="text-xs text-text-muted mt-1.5">{budgetHint}</div>}
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

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-3 transition-colors">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={saving || !canCreate}
              className="bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm px-8 py-3 rounded-lg disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save Trip'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
