'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plane, FileText, MapPin, Calendar, Users, Mountain, Music } from 'lucide-react';
import { searchDestinations, type Destination } from '@/lib/destinations';

const FILTER_CHIPS = [
  'Surf', 'Ski', 'Food Tour', 'Festival', 'Nightlife', 'Coworking', 'Cultural', 'Adventure',
];

function DestIcon({ type }: { type: string }) {
  if (type === 'ski') return <Mountain className="w-4 h-4 text-gray-400 flex-shrink-0" />;
  if (type === 'festival') return <Music className="w-4 h-4 text-gray-400 flex-shrink-0" />;
  return <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />;
}

export default function TripCreationBar() {
  const router = useRouter();
  const [barName, setBarName] = useState('');
  const [barDestination, setBarDestination] = useState('');
  const [barStartDate, setBarStartDate] = useState('');
  const [barEndDate, setBarEndDate] = useState('');
  const [barTravelers, setBarTravelers] = useState(2);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);

  // Autocomplete state
  const [destQuery, setDestQuery] = useState('');
  const [destResults, setDestResults] = useState<Destination[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  const handleDestChange = (val: string) => {
    setDestQuery(val);
    setBarDestination(val);
    const results = searchDestinations(val, 8);
    setDestResults(results);
    setShowDropdown(results.length > 0 && val.length > 0);
    setHighlightIdx(-1);
  };

  const selectDestination = (dest: Destination) => {
    setBarDestination(dest.name);
    setDestQuery(dest.name);
    setShowDropdown(false);
    setHighlightIdx(-1);
  };

  const handleDestKeyDown = (e: React.KeyboardEvent) => {
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

  // Close dropdown on outside click
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
      setShowDropdown(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const toggleChip = (chip: string) => {
    setSelectedChips(prev =>
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
    );
  };

  const handleCreateFromBar = () => {
    const params = new URLSearchParams();
    if (barName) params.set('tripName', barName);
    if (barDestination) params.set('destination', barDestination);
    if (barStartDate) params.set('startDate', barStartDate);
    if (barEndDate) params.set('endDate', barEndDate);
    if (barTravelers > 1) params.set('travelers', String(barTravelers));
    if (selectedChips.length > 0) params.set('interests', selectedChips.join(','));
    router.push(`/budgets/trips/new${params.toString() ? '?' + params.toString() : ''}`);
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

        {/* Section 2: Destination with autocomplete */}
        <div className="relative flex items-center gap-2 px-4 py-3 lg:flex-[2] lg:border-r border-b lg:border-b-0 border-gray-200 min-w-0" ref={dropdownRef}>
          <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={destInputRef}
            type="text"
            value={destQuery}
            onChange={e => handleDestChange(e.target.value)}
            onFocus={() => { if (destResults.length > 0 && destQuery.length > 0) setShowDropdown(true); }}
            onKeyDown={handleDestKeyDown}
            placeholder="Where to?"
            className="w-full border-0 outline-none bg-transparent text-sm text-text-primary placeholder:text-gray-400"
          />
          {/* Autocomplete dropdown */}
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
                  <DestIcon type={dest.type} />
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

        {/* Section 5: Create button */}
        <button
          onClick={handleCreateFromBar}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm transition-colors whitespace-nowrap rounded-b-xl lg:rounded-b-none lg:rounded-r-xl"
        >
          <Plane className="w-4 h-4" />
          Create Trip
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
        {FILTER_CHIPS.map(chip => {
          const active = selectedChips.includes(chip);
          return (
            <button
              key={chip}
              onClick={() => toggleChip(chip)}
              className={`text-xs px-3 py-1 rounded-full border whitespace-nowrap transition-colors ${
                active
                  ? 'bg-white/20 text-white border-white/60'
                  : 'border-white/30 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}
