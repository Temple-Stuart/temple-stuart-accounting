'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import { searchDestinations, type Destination } from '@/lib/destinations';

interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  rsvpStatus: string;
  isOwner: boolean;
}

interface Trip {
  id: string;
  name: string;
  destination: string | null;
  activity: string | null;
  month: number;
  year: number;
  daysTravel: number;
  daysRiding: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  committedAt: string | null;
  latitude: string | null;
  longitude: string | null;
  destinationPhoto: string | null;
  participants: Participant[];
  _count: {
    expenses: number;
    itinerary: number;
    budget_line_items: number;
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ACTIVITIES: Record<string, string> = {
  surf: 'Surf', kitesurf: 'Kitesurf', sail: 'Sail', snowboard: 'Snowboard', ski: 'Ski',
  scuba: 'Scuba', mtb: 'MTB', climbing: 'Climbing', hiking: 'Hiking', fishing: 'Fishing',
  golf: 'Golf', roadcycle: 'Road Cycling', moto: 'Moto', hike: 'Hike', climb: 'Climb',
  bike: 'Bike', run: 'Run', triathlon: 'Triathlon', skate: 'Skate', festival: 'Festival',
  conference: 'Conference', nomad: 'Nomad',
};

const ACTIVITY_COLORS: Record<string, string> = {
  surf: '#3b82f6', kitesurf: '#06b6d4', sail: '#6366f1', snowboard: '#8b5cf6', ski: '#7c3aed',
  scuba: '#14b8a6', mtb: '#f97316', climbing: '#ef4444', hiking: '#22c55e', fishing: '#10b981',
  golf: '#84cc16', roadcycle: '#eab308', moto: '#f43f5e', hike: '#16a34a', climb: '#dc2626',
  bike: '#ea580c', run: '#ec4899', triathlon: '#2563eb', skate: '#9333ea', festival: '#d946ef',
  conference: '#6b7280', nomad: '#f59e0b',
};

const TRIP_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'mixed', label: 'Mixed' },
];

export default function TripsPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── PR-37a: in-page create-trip form (replaces the AppLayout search bar +
  // its extra hop to /budgets/trips/new). POSTs /api/trips directly →
  // redirects to the new trip's detail page. ──
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

  useEffect(() => { loadTrips(); }, []);

  const loadTrips = async () => {
    try {
      const res = await fetch('/api/trips');
      if (res.ok) {
        const data = await res.json();
        const sortedTrips = (data.trips || []).sort((a: Trip, b: Trip) => {
          const dateA = a.startDate ? new Date(a.startDate).getTime() : new Date(a.year, a.month - 1, 1).getTime();
          const dateB = b.startDate ? new Date(b.startDate).getTime() : new Date(b.year, b.month - 1, 1).getTime();
          return dateA - dateB;
        });
        setTrips(sortedTrips);
      }
    } catch (error) {
      console.error('Failed to load trips:', error);
    } finally {
      setLoading(false);
    }
  };

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
      router.push(`/budgets/trips/${newId}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create trip');
      setCreating(false);
    }
  };

  const deleteTrip = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/trips/${id}`, { method: 'DELETE' });
      if (res.ok) setTrips(trips.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete trip:', error);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-bg-terminal">
        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">

          {/* ── PR-37a: Create-trip form (POSTs /api/trips directly → detail).
              Basic styling; full detail-page-template adoption is PR-37b. ── */}
          <div className="bg-white border border-border mb-4">
            <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
              Plan a new trip
            </div>
            <div className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                {/* Trip name */}
                <label className="flex flex-col gap-1 lg:flex-[3] min-w-0">
                  <span className="text-[11px] text-text-muted">Trip name *</span>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g., Bali Surf Trip 2026"
                    className="border border-border rounded px-3 py-2 text-sm bg-white"
                  />
                </label>

                {/* Destinations with autocomplete */}
                <div className="flex flex-col gap-1 lg:flex-[3] min-w-0 relative" ref={dropdownRef}>
                  <span className="text-[11px] text-text-muted">Destination(s)</span>
                  <div className="flex flex-wrap items-center gap-1 border border-border rounded px-2 py-1.5 bg-white min-h-[38px]">
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
                  <span className="text-[11px] text-text-muted">Start *</span>
                  <input
                    type="date"
                    value={startDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setStartDate(e.target.value)}
                    className="border border-border rounded px-2 py-2 text-sm bg-white"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-text-muted">End *</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || new Date().toISOString().split('T')[0]}
                    onChange={e => setEndDate(e.target.value)}
                    className="border border-border rounded px-2 py-2 text-sm bg-white"
                  />
                </label>

                {/* Travelers */}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-text-muted">Travelers</span>
                  <select
                    value={travelers}
                    onChange={e => setTravelers(+e.target.value)}
                    className="border border-border rounded px-2 py-2 text-sm bg-white"
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
                  className="px-6 py-2 bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm rounded disabled:opacity-50 whitespace-nowrap"
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
            </div>
          </div>

          {/* Trip List */}
          <div className="bg-white border border-border mb-4">
            <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
              All Trips
            </div>

            {trips.length === 0 ? (
              <div className="p-8 text-center text-text-faint">
                <p className="text-sm mb-4">No trips yet. Use the form above to create your first trip.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-brand-purple-hover text-white">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Trip</th>
                      <th className="px-3 py-2 text-left font-medium">Destination</th>
                      <th className="px-3 py-2 text-left font-medium">Activity</th>
                      <th className="px-3 py-2 text-left font-medium">Dates</th>
                      <th className="px-3 py-2 text-center font-medium">Days</th>
                      <th className="px-3 py-2 text-center font-medium">Crew</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                      <th className="px-3 py-2 text-center font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trips.map(trip => (
                      <tr key={trip.id} onClick={() => router.push(`/budgets/trips/${trip.id}`)}
                        className="hover:bg-bg-row cursor-pointer">
                        <td className="px-3 py-3">
                          <div className="font-medium text-text-primary">{trip.name}</div>
                        </td>
                        <td className="px-3 py-3 text-text-secondary">{trip.destination || '—'}</td>
                        <td className="px-3 py-3">
                          {trip.activity && (
                            <span className="px-2 py-0.5 text-[10px] text-white"
                              style={{ backgroundColor: ACTIVITY_COLORS[trip.activity] || '#6b7280' }}>
                              {ACTIVITIES[trip.activity] || trip.activity}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 font-mono text-text-secondary">
                          {trip.startDate
                            ? `${new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(trip.endDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            : `${MONTHS[trip.month - 1]} ${trip.year}`}
                        </td>
                        <td className="px-3 py-3 text-center font-mono">{trip.daysTravel}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex -space-x-1 justify-center">
                            {trip.participants.slice(0, 3).map(p => (
                              <div key={p.id}
                                className={`w-5 h-5 rounded-full border border-white flex items-center justify-center text-[8px] font-bold text-white ${
                                  p.rsvpStatus === 'confirmed' ? 'bg-emerald-500' : 'bg-text-faint'
                                }`}>
                                {p.firstName[0]}
                              </div>
                            ))}
                            {trip.participants.length > 3 && (
                              <div className="w-5 h-5 rounded-full border border-white bg-border flex items-center justify-center text-[8px] text-text-secondary">
                                +{trip.participants.length - 3}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-0.5 text-[10px] ${
                            trip.committedAt ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {trip.committedAt ? 'Committed' : 'Planning'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={(e) => deleteTrip(trip.id, e)}
                            className="text-text-faint hover:text-brand-red text-xs px-2 py-1">
                            {deleting === trip.id ? '...' : '×'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
