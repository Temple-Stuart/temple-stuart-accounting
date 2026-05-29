'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plane, FileText, MapPin, Calendar, Users, X, Save } from 'lucide-react';
import { searchDestinations, type Destination } from '@/lib/destinations';

const TRIP_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'mixed', label: 'Mixed' },
];

export default function TripCreationBar() {
  const router = useRouter();
  const pathname = usePathname();
  const tripDetailMatch = pathname?.match(/^\/budgets\/trips\/([^/]+)$/);
  // PR-12 Fix 2: /budgets/trips/new is gone. Landing-mode click now POSTs
  // directly to /api/trips + /destinations and router.push's to the new
  // trip's detail page. The 'new' mode + URL-param pre-populate effect
  // were removed along with the deleted page.
  const isOnDetailPage = !!(tripDetailMatch && tripDetailMatch[1] !== 'new');
  const detailTripId = tripDetailMatch?.[1] || null;
  const mode: 'landing' | 'detail' = isOnDetailPage ? 'detail' : 'landing';

  const [barName, setBarName] = useState('');
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [barStartDate, setBarStartDate] = useState('');
  const [barEndDate, setBarEndDate] = useState('');
  const [barTravelers, setBarTravelers] = useState(2);
  const [tripType, setTripType] = useState('personal');

  // Autocomplete state
  const [destQuery, setDestQuery] = useState('');
  const [destResults, setDestResults] = useState<Destination[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);
  const [didInit, setDidInit] = useState(false);

  // Pre-populate from trip data on detail page
  useEffect(() => {
    if (!isOnDetailPage || !detailTripId || didInit) return;
    (async () => {
      try {
        const res = await fetch(`/api/trips/${detailTripId}`);
        if (!res.ok) return;
        const data = await res.json();
        const trip = data.trip;
        if (trip.name) setBarName(trip.name);
        if (trip.startDate) setBarStartDate(trip.startDate.split('T')[0]);
        if (trip.endDate) setBarEndDate(trip.endDate.split('T')[0]);
        if (trip.participants) setBarTravelers(trip.participants.length || 2);
        // Load destinations
        const destRes = await fetch(`/api/trips/${detailTripId}/destinations`);
        if (destRes.ok) {
          const destData = await destRes.json();
          const names = (destData.destinations || [])
            .map((d: any) => d.name || d.resort?.name)
            .filter(Boolean);
          if (names.length > 0) setSelectedDestinations(names);
        } else if (trip.destination) {
          setSelectedDestinations([trip.destination]);
        }
        setDidInit(true);
      } catch { /* ignore */ }
    })();
  }, [isOnDetailPage, detailTripId, didInit]);

  const handleDestChange = (val: string) => {
    setDestQuery(val);
    const results = searchDestinations(val, 8).filter(
      d => d.type === 'city' && !selectedDestinations.includes(d.name)
    );
    setDestResults(results);
    setShowDropdown(results.length > 0 && val.length > 0);
    setHighlightIdx(-1);
  };

  const selectDestination = (dest: Destination) => {
    if (!selectedDestinations.includes(dest.name)) {
      setSelectedDestinations(prev => [...prev, dest.name]);
    }
    setDestQuery('');
    setDestResults([]);
    setShowDropdown(false);
    setHighlightIdx(-1);
    destInputRef.current?.focus();
  };

  const removeDestination = (name: string) => {
    setSelectedDestinations(prev => prev.filter(d => d !== name));
    destInputRef.current?.focus();
  };

  const handleDestKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && destQuery === '' && selectedDestinations.length > 0) {
      setSelectedDestinations(prev => prev.slice(0, -1));
      return;
    }
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, destResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      selectDestination(destResults[highlightIdx]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
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

  const [updating, setUpdating] = useState(false);

  const handleButtonClick = async () => {
    if (mode === 'detail' && detailTripId) {
      // PATCH the existing trip
      setUpdating(true);
      try {
        const duration = barStartDate && barEndDate
          ? Math.round((new Date(barEndDate + 'T12:00:00').getTime() - new Date(barStartDate + 'T12:00:00').getTime()) / 86400000) + 1
          : undefined;
        await fetch(`/api/trips/${detailTripId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: barName || undefined,
            destination: selectedDestinations[0] || undefined,
            startDate: barStartDate || undefined,
            endDate: barEndDate || undefined,
            daysTravel: duration,
            tripType: tripType !== 'personal' ? tripType : undefined,
          }),
        });
        router.refresh();
      } catch { /* ignore */ }
      finally { setUpdating(false); }
      return;
    }

    // PR-12 Fix 2: landing-mode auto-save. Inlined from the deleted
    // /budgets/trips/new page — POST the trip + per-destination rows
    // sequentially, then router.push straight to the detail page.
    if (!barName.trim() || !barStartDate || !barEndDate) return;
    const duration = Math.round(
      (new Date(barEndDate + 'T12:00:00').getTime() - new Date(barStartDate + 'T12:00:00').getTime()) / 86400000
    ) + 1;
    if (duration <= 0) return;

    setUpdating(true);
    try {
      const tripRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: barName.trim(),
          destination: selectedDestinations.length > 0 ? selectedDestinations[0] : undefined,
          startDate: barStartDate,
          endDate: barEndDate,
          activity: 'all',
          month: new Date(barStartDate + 'T12:00:00').getMonth() + 1,
          year: new Date(barStartDate + 'T12:00:00').getFullYear(),
          daysTravel: duration,
          daysRiding: duration,
          tripType,
        }),
      });
      if (!tripRes.ok) {
        const d = await tripRes.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create trip');
      }
      const { trip } = await tripRes.json();
      const tripId = trip.id;

      // Per-destination rows (same flow the deleted page ran). Coordinates
      // come from the static destinations catalog when there's a match.
      for (const destName of selectedDestinations) {
        const matches = searchDestinations(destName, 1);
        const match = matches.find(d => d.type === 'city' && d.name.toLowerCase() === destName.toLowerCase())
          || matches.find(d => d.type === 'city');
        await fetch(`/api/trips/${tripId}/destinations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: destName,
            country: match?.country || null,
            lat: match?.lat || null,
            lng: match?.lng || null,
          }),
        });
      }

      router.push(`/budgets/trips/${tripId}`);
    } catch {
      // Swallow — failures are rare and the user can retry the button.
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Unified search bar */}
      <div className="bg-white border-2 border-brand-gold/60 rounded-xl shadow-md flex flex-col lg:flex-row">
        {/* Section 1: Trip Name */}
        <div className="flex items-center gap-2 px-4 py-3 lg:flex-[3.5] lg:border-r border-b lg:border-b-0 border-gray-200 min-w-0">
          <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={barName}
            onChange={e => setBarName(e.target.value)}
            placeholder="e.g., Bali Surf Trip 2026"
            className="w-full border-0 outline-none bg-transparent text-sm text-text-primary placeholder:text-gray-400"
          />
        </div>

        {/* Section 2: Multi-destination with autocomplete */}
        <div className="relative flex items-center gap-2 px-4 py-2 lg:flex-[2.5] lg:border-r border-b lg:border-b-0 border-gray-200 min-w-0" ref={dropdownRef}>
          <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
            {selectedDestinations.map(name => (
              <span
                key={name}
                className="inline-flex items-center gap-1 bg-brand-purple/10 text-brand-purple text-xs px-2 py-0.5 rounded-full flex-shrink-0"
              >
                {name}
                <button
                  onClick={() => removeDestination(name)}
                  className="hover:text-brand-purple/70 transition-colors"
                  type="button"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              ref={destInputRef}
              type="text"
              value={destQuery}
              onChange={e => handleDestChange(e.target.value)}
              onFocus={() => { if (destResults.length > 0 && destQuery.length > 0) setShowDropdown(true); }}
              onKeyDown={handleDestKeyDown}
              placeholder={selectedDestinations.length === 0 ? 'Where to?' : ''}
              className="flex-1 min-w-[60px] border-0 outline-none bg-transparent text-sm text-text-primary placeholder:text-gray-400 py-1"
            />
          </div>
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[280px] overflow-y-auto">
              {destResults.map((dest, idx) => (
                <button
                  key={`${dest.type}-${dest.name}`}
                  onClick={() => selectDestination(dest)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    idx === highlightIdx ? 'bg-bg-row' : 'hover:bg-bg-row/50'
                  }`}
                >
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-text-primary truncate">{dest.name}</span>
                  <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{dest.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Dates */}
        <div className="flex items-center gap-2 px-4 py-3 lg:flex-[2.5] lg:border-r border-b lg:border-b-0 border-gray-200 min-w-0">
          <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            type="date"
            value={barStartDate}
            onChange={e => setBarStartDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="border-0 outline-none bg-transparent text-sm text-text-primary w-[120px] min-w-0"
          />
          <span className="text-gray-300">—</span>
          <input
            type="date"
            value={barEndDate}
            onChange={e => setBarEndDate(e.target.value)}
            min={barStartDate || new Date().toISOString().split('T')[0]}
            className="border-0 outline-none bg-transparent text-sm text-text-primary w-[120px] min-w-0"
          />
        </div>

        {/* Section 4: Travelers */}
        <div className="flex items-center gap-2 px-4 py-3 lg:flex-[1] lg:border-r border-b lg:border-b-0 border-gray-200 min-w-0">
          <Users className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <select
            value={barTravelers}
            onChange={e => setBarTravelers(+e.target.value)}
            className="border-0 outline-none bg-transparent text-sm text-text-primary cursor-pointer w-full"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
            ))}
          </select>
        </div>

        {/* Section 5: Button */}
        <button
          onClick={handleButtonClick}
          disabled={updating}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm transition-colors whitespace-nowrap rounded-b-xl lg:rounded-b-none lg:rounded-r-xl disabled:opacity-50"
        >
          {mode === 'detail' ? (
            <>{updating ? 'Updating...' : <><Save className="w-4 h-4" /> Update</>}</>
          ) : updating ? (
            <><Save className="w-4 h-4" /> Saving…</>
          ) : (
            <><Plane className="w-4 h-4" /> Create Trip</>
          )}
        </button>
      </div>

      {/* Trip type toggle */}
      <div className="flex items-center gap-2">
        {TRIP_TYPES.map(tt => (
          <button
            key={tt.value}
            onClick={() => setTripType(tt.value)}
            className={`text-xs px-3 py-1 rounded-full border whitespace-nowrap transition-colors ${
              tripType === tt.value
                ? 'bg-white/20 text-white border-white/60'
                : 'border-white/30 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
