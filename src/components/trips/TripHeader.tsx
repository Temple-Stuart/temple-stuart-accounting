'use client';

// ─── Committed-trip header (Travel-PR-29) ─────────────────────────────────────
// Replaces the search-form bar on an EXISTING trip. Presents the trip's
// name/destinations/dates/travelers as committed, EDITABLE-IN-PLACE facts (not a
// "Where to?" search form). Reuses the SAME endpoints the rest of the trip uses:
//   - name/dates/tripType → PATCH /api/trips/[id]   (PR-29 widened it to persist
//     name/tripType — previously dropped)
//   - destinations        → /api/trips/[id]/destinations POST/DELETE (the SAME
//     trip_destinations source the scan-row "Scan:" chips read, so the two stay
//     in sync via the parent's onChanged reload)
//   - travelers           → READ-ONLY count + Manage link (full editor = PR-31)

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Calendar, Users, X, Save, Check } from 'lucide-react';
import { searchDestinations, type Destination } from '@/lib/destinations';

export interface TripHeaderDestination {
  id?: string;
  resortId?: string;
  name: string;
}

interface TripHeaderProps {
  tripId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  tripType: string;
  destinations: TripHeaderDestination[];
  travelerCount: number;
  /** Reload trip + destinations on the parent so header ⇄ scan chips stay in sync. */
  onChanged: () => void;
}

const TRIP_TYPES = ['personal', 'business', 'mixed'];

export default function TripHeader({
  tripId, name, startDate, endDate, tripType, destinations, travelerCount, onChanged,
}: TripHeaderProps) {
  const startStr = startDate ? startDate.split('T')[0] : '';
  const endStr = endDate ? endDate.split('T')[0] : '';

  const [nameVal, setNameVal] = useState(name);
  const [start, setStart] = useState(startStr);
  const [end, setEnd] = useState(endStr);
  const [type, setType] = useState(tripType || 'personal');
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);
  const [busyDest, setBusyDest] = useState(false);

  // Re-sync local edit state when the parent reloads new values.
  useEffect(() => { setNameVal(name); }, [name]);
  useEffect(() => { setStart(startStr); }, [startStr]);
  useEffect(() => { setEnd(endStr); }, [endStr]);
  useEffect(() => { setType(tripType || 'personal'); }, [tripType]);

  const dirty = nameVal !== name || start !== startStr || end !== endStr || type !== (tripType || 'personal');

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/trips/${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameVal || undefined,
          startDate: start || undefined,
          endDate: end || undefined,
          tripType: type,
        }),
      });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1500);
      onChanged();
    } catch { /* surfaced via no state change; user can retry */ }
    finally { setSaving(false); }
  };

  // ── Destination add (autocomplete) / remove — same endpoints the scan uses ──
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Destination[]>([]);
  const [open, setOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  const existing = new Set(destinations.map(d => d.name.toLowerCase()));
  const onQ = (v: string) => {
    setQ(v);
    const r = searchDestinations(v, 8).filter(d => d.type === 'city' && !existing.has(d.name.toLowerCase()));
    setResults(r);
    setOpen(r.length > 0 && v.length > 0);
  };

  const addDest = async (d: Destination) => {
    setQ(''); setResults([]); setOpen(false); setBusyDest(true);
    try {
      await fetch(`/api/trips/${tripId}/destinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: d.name, country: d.country }),
      });
      onChanged();
    } catch { /* ignore */ }
    finally { setBusyDest(false); }
  };

  const removeDest = async (d: TripHeaderDestination) => {
    setBusyDest(true);
    try {
      // Mirror DestinationSelector: resortId for resort-based, destinationId for name-based.
      const body = d.resortId && d.resortId !== d.id ? { resortId: d.resortId } : { destinationId: d.id };
      await fetch(`/api/trips/${tripId}/destinations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onChanged();
    } catch { /* ignore */ }
    finally { setBusyDest(false); }
  };

  const clickOutside = useCallback((e: MouseEvent) => {
    if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpen(false);
  }, []);
  useEffect(() => {
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [clickOutside]);

  return (
    <div className="bg-white border border-border rounded-lg shadow-sm p-4">
      {/* Title row: editable name + Update */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <input
          value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          aria-label="Trip name"
          className="text-2xl font-bold text-text-primary bg-transparent border-0 border-b border-transparent hover:border-border focus:border-brand-purple outline-none flex-1 min-w-0"
        />
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-brand-purple text-white hover:bg-brand-purple-hover disabled:opacity-50 shrink-0"
        >
          {savedTick ? <><Check className="w-4 h-4" /> Saved</> : saving ? 'Updating…' : <><Save className="w-4 h-4" /> Update</>}
        </button>
      </div>

      {/* Facts row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {/* Destinations (committed; add/remove persist immediately) */}
        <div className="flex items-center gap-1.5 flex-wrap relative" ref={ddRef}>
          <MapPin className="w-4 h-4 text-brand-purple shrink-0" aria-hidden="true" />
          {destinations.map(d => (
            <span key={d.id || d.name} className="inline-flex items-center gap-1 bg-brand-purple/10 text-brand-purple text-xs px-2 py-0.5 rounded-full">
              {d.name}
              <button type="button" aria-label={`Remove ${d.name}`} disabled={busyDest}
                onClick={() => removeDest(d)} className="hover:text-brand-purple/60 disabled:opacity-50">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            value={q}
            onChange={e => onQ(e.target.value)}
            onFocus={() => { if (results.length > 0 && q.length > 0) setOpen(true); }}
            placeholder={destinations.length ? 'Add destination' : 'Add a destination'}
            aria-label="Add destination"
            className="text-xs bg-transparent outline-none min-w-[110px] py-1 text-text-primary placeholder:text-text-faint"
          />
          {open && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-border z-50 max-h-[260px] overflow-y-auto min-w-[220px]">
              {results.map(d => (
                <button key={`${d.type}-${d.name}`} onClick={() => addDest(d)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-row">
                  <MapPin className="w-3.5 h-3.5 text-text-faint shrink-0" aria-hidden="true" />
                  <span className="font-medium text-text-primary truncate">{d.name}</span>
                  <span className="text-xs text-text-faint ml-auto shrink-0">{d.country}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-brand-purple shrink-0" aria-hidden="true" />
          <input type="date" value={start} onChange={e => setStart(e.target.value)} aria-label="Start date"
            className="bg-transparent outline-none text-sm text-text-primary" />
          <span className="text-text-faint">—</span>
          <input type="date" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} aria-label="End date"
            className="bg-transparent outline-none text-sm text-text-primary" />
        </div>

        {/* Travelers — READ-ONLY count + Manage link (full editor = PR-31) */}
        <div className="flex items-center gap-1.5 text-text-secondary">
          <Users className="w-4 h-4 text-brand-purple shrink-0" aria-hidden="true" />
          <span>{travelerCount} {travelerCount === 1 ? 'traveler' : 'travelers'}</span>
          <Link href={`/budgets/trips/${tripId}#travelers`} className="text-xs text-brand-purple underline">Manage</Link>
        </div>

        {/* Trip type */}
        <div className="flex items-center gap-1">
          {TRIP_TYPES.map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`text-[11px] px-2 py-0.5 rounded-full border capitalize transition-colors ${type === t ? 'bg-brand-purple text-white border-brand-purple' : 'border-border text-text-muted hover:border-brand-purple'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
