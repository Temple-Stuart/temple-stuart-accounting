'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { searchDestinations, type Destination } from '@/lib/destinations';

const TRIP_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'mixed', label: 'Mixed' },
];

interface Props {
  /** HOME-PR-1: when set, a "Create trip" click while UNAUTHENTICATED calls this
   *  (the home launcher opens the register modal) instead of POSTing. The form is
   *  freely usable by guests; only the save is register-gated. Omit on the trips
   *  index (always authenticated there) → POSTs directly as before. */
  onUnauthenticated?: () => boolean | Promise<boolean>;
  /** HOME-PR-1c: render the "Plan a new trip" SectionCard band + card chrome.
   *  Default true (the trips index is unchanged). The home launcher passes
   *  false — it already wraps the form in its single "Launch a module" band, so
   *  the inner band/card would be a redundant second banner. */
  showHeader?: boolean;
  /** PR-HCR-Trips1: when set, a successful create calls this with the new trip id
   *  INSTEAD of navigating to /budgets/trips/[id]. The home launcher passes it so
   *  the new trip refreshes the All Trips list in place. Omit it (trips index) →
   *  the existing navigation is unchanged. */
  onCreated?: (tripId: string) => void;
  /** T1: stack the fields vertically for narrow containers (TripFormModal's
   *  max-w-lg card) — the form's lg: breakpoints key off the VIEWPORT, so the
   *  wide one-row layout otherwise activates inside the 512px modal and the six
   *  controls overlap. Default false: the full-width trips-index mount keeps its
   *  original row layout with byte-identical classNames. Layout classes only —
   *  no logic/validation/API difference between the two modes. */
  stacked?: boolean;
}

// HOME-PR-1: shared create-trip card, extracted VERBATIM from
// budgets/trips/page.tsx (PR-37a/b) so the trips index and the home module
// launcher render ONE component. Behavior on the trips index is unchanged
// (onUnauthenticated omitted → direct POST). POST /api/trips is unchanged.
export default function CreateTripForm({ onUnauthenticated, showHeader = true, onCreated, stacked = false }: Props) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState(2);
  const [tripType, setTripType] = useState('personal');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Destination autocomplete
  const [destQuery, setDestQuery] = useState('');
  const [destResults, setDestResults] = useState<Destination[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  const handleDestChange = (val: string) => {
    setDestQuery(val);
    const results = searchDestinations(val, 8).filter(
      d => d.type === 'city' && !selectedDestinations.includes(d.name)
    );
    setDestResults(results);
    setShowDropdown(results.length > 0 && val.length > 0);
  };

  const addDestination = (dest: Destination) => {
    if (!selectedDestinations.includes(dest.name)) {
      setSelectedDestinations(prev => [...prev, dest.name]);
    }
    setDestQuery('');
    setDestResults([]);
    setShowDropdown(false);
    destInputRef.current?.focus();
  };

  const removeDestination = (n: string) => {
    setSelectedDestinations(prev => prev.filter(d => d !== n));
  };

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setShowDropdown(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  // PR-37a + PR-33 discipline: dates are the entered window — validate end >=
  // start, no fallback. POST /api/trips requires `name` + a resolvable
  // month/year/daysTravel; a startDate+endDate derive all three server-side
  // (route.ts:33-48), so the form requires name + a valid date range.
  const datesValid = !!startDate && !!endDate && endDate >= startDate;
  const canCreate = !!name.trim() && datesValid && !creating;

  const handleCreate = async () => {
    if (!canCreate) return;
    // HOME-PR-1: register-gate on the home launcher. If a guest tries to create,
    // onUnauthenticated opens the register modal and returns true ("handled —
    // don't POST"). On the trips index there's no callback → proceed to POST.
    if (onUnauthenticated) {
      const handled = await onUnauthenticated();
      if (handled) return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          destination: selectedDestinations[0] || null,
          startDate,
          endDate,
          tripType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Create failed (HTTP ${res.status})`);
      const newId = data.trip?.id;
      if (!newId) throw new Error('Create succeeded but no trip id was returned.');
      if (onCreated) {
        // Home launcher: stay put, clear the form, and let the All Trips list refresh.
        setName('');
        setSelectedDestinations([]);
        setStartDate('');
        setEndDate('');
        setCreating(false);
        onCreated(newId);
      } else {
        // Trips index: unchanged — navigate to the new trip.
        router.push(`/budgets/trips/${newId}`);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create trip');
      setCreating(false);
    }
  };

  const formBody = (
    <>
        <div className={stacked ? 'flex flex-col gap-3' : 'flex flex-col lg:flex-row lg:items-end gap-3'}>
          {/* Trip name */}
          <label className={stacked ? 'flex flex-col gap-1 min-w-0' : 'flex flex-col gap-1 lg:flex-[3] min-w-0'}>
            <span className="text-[11px] text-brand-purple font-medium">Trip name *</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Bali Surf Trip 2026"
              className="border border-brand-purple/40 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>

          {/* Destinations with autocomplete */}
          <div className={stacked ? 'flex flex-col gap-1 min-w-0 relative' : 'flex flex-col gap-1 lg:flex-[3] min-w-0 relative'} ref={dropdownRef}>
            <span className="text-[11px] text-brand-purple font-medium">Destination(s)</span>
            <div className="flex flex-wrap items-center gap-1 border border-brand-purple/40 rounded px-2 py-1.5 bg-white min-h-[38px] focus-within:border-brand-purple focus-within:ring-2 focus-within:ring-brand-purple/20">
              {selectedDestinations.map(n => (
                <span key={n} className="inline-flex items-center gap-1 bg-brand-purple/10 text-brand-purple text-xs px-2 py-0.5 rounded-full">
                  {n}
                  <button type="button" onClick={() => removeDestination(n)} className="hover:text-brand-purple/70">×</button>
                </span>
              ))}
              <input
                ref={destInputRef}
                type="text"
                value={destQuery}
                onChange={e => handleDestChange(e.target.value)}
                onFocus={() => { if (destResults.length > 0 && destQuery.length > 0) setShowDropdown(true); }}
                placeholder={selectedDestinations.length === 0 ? 'Where to?' : ''}
                className="flex-1 min-w-[60px] border-0 outline-none bg-transparent text-sm"
              />
            </div>
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-border z-50 max-h-[260px] overflow-y-auto">
                {destResults.map(dest => (
                  <button
                    key={`${dest.type}-${dest.name}`}
                    type="button"
                    onClick={() => addDestination(dest)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-row"
                  >
                    <span className="font-medium text-text-primary truncate">{dest.name}</span>
                    <span className="text-xs text-text-faint ml-auto">{dest.country}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date range */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-brand-purple font-medium">Start *</span>
            <input
              type="date"
              value={startDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setStartDate(e.target.value)}
              className="border border-brand-purple/40 rounded px-2 py-2 text-sm bg-white focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-brand-purple font-medium">End *</span>
            <input
              type="date"
              value={endDate}
              min={startDate || new Date().toISOString().split('T')[0]}
              onChange={e => setEndDate(e.target.value)}
              className="border border-brand-purple/40 rounded px-2 py-2 text-sm bg-white focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            />
          </label>

          {/* Travelers */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-brand-purple font-medium">Travelers</span>
            <select
              value={travelers}
              onChange={e => setTravelers(+e.target.value)}
              className="border border-brand-purple/40 rounded px-2 py-2 text-sm bg-white focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
              ))}
            </select>
          </label>

          {/* Create */}
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className={stacked ? 'w-full px-6 py-2 bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm rounded disabled:opacity-50 whitespace-nowrap' : 'px-6 py-2 bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm rounded disabled:opacity-50 whitespace-nowrap'}
          >
            {creating ? 'Creating…' : 'Create trip'}
          </button>
        </div>

        {/* Trip type toggle */}
        <div className="flex items-center gap-2 mt-3">
          {TRIP_TYPES.map(tt => (
            <button
              key={tt.value}
              type="button"
              onClick={() => setTripType(tt.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                tripType === tt.value
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'bg-white text-text-secondary border-border hover:bg-bg-row'
              }`}
            >
              {tt.label}
            </button>
          ))}
          {!datesValid && (startDate || endDate) && (
            <span className="text-xs text-brand-red ml-2">End date must be on or after start date.</span>
          )}
          {createError && <span className="text-xs text-brand-red ml-2">{createError}</span>}
        </div>
    </>
  );

  // HOME-PR-1c: with showHeader (default — trips index), wrap the form in the
  // "Plan a new trip" SectionCard band + card chrome. The home launcher passes
  // showHeader={false} — it already provides the single "Launch a module" band,
  // so the form renders bare (no redundant second banner/card).
  if (!showHeader) return formBody;
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm mb-4">
      <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">
        Plan a new trip
      </div>
      <div className="bg-white p-4">
        {formBody}
      </div>
    </div>
  );
}
