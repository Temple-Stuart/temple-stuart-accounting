'use client';

import { useState, useEffect } from 'react';

interface Props {
  tripId: string;
  activity: string;
  onSelect: (destination: any) => void;
}

const ACTIVITY_CONFIG: Record<string, { title: string; columns: { key: string; label: string; format?: (v: any) => string }[] }> = {
  snowboard: {
    title: '🏂 Ski Resorts (Ikon Pass)',
    columns: [
      { key: 'name', label: 'Resort' },
      { key: 'region', label: 'Region' },
      { key: 'verticalDrop', label: 'Vert', format: v => v ? `${v.toLocaleString()}ft` : '-' },
      { key: 'avgSnowfall', label: 'Snow', format: v => v ? `${v}"` : '-' },
      { key: 'nearestAirport', label: 'Airport' },
    ]
  },
  mtb: {
    title: '🚵 Mountain Bike Parks',
    columns: [
      { key: 'name', label: 'Resort' },
      { key: 'region', label: 'Region' },
      { key: 'verticalDrop', label: 'Vert', format: v => v ? `${v.toLocaleString()}ft` : '-' },
      { key: 'nearestAirport', label: 'Airport' },
    ]
  },
  hike: {
    title: '🏕️ Hiking & Camping',
    columns: [
      { key: 'name', label: 'Resort' },
      { key: 'region', label: 'Region' },
      { key: 'nearestAirport', label: 'Airport' },
    ]
  },
  climb: {
    title: '🧗 Rock Climbing',
    columns: [
      { key: 'name', label: 'Resort' },
      { key: 'region', label: 'Region' },
      { key: 'nearestAirport', label: 'Airport' },
    ]
  },
  surf: {
    title: '🏄 Surf Spots',
    columns: [
      { key: 'name', label: 'Spot' },
      { key: 'country', label: 'Country' },
      { key: 'waveConsistency', label: 'Waves', format: v => v ? `${v}/10` : '-' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
      { key: 'nomadScore', label: 'Nomad', format: v => v ? `${v}/10` : '-' },
      { key: 'nearestAirport', label: 'Airport' },
    ]
  },
  kitesurf: {
    title: '🪁 Kite Surf Spots',
    columns: [
      { key: 'name', label: 'Spot' },
      { key: 'country', label: 'Country' },
      { key: 'waveConsistency', label: 'Wind', format: v => v ? `${v}/10` : '-' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
      { key: 'nomadScore', label: 'Nomad', format: v => v ? `${v}/10` : '-' },
    ]
  },
  sail: {
    title: '⛵ Sailing Destinations',
    columns: [
      { key: 'name', label: 'Spot' },
      { key: 'country', label: 'Country' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
      { key: 'nomadScore', label: 'Nomad', format: v => v ? `${v}/10` : '-' },
    ]
  },
  golf: {
    title: '⛳ Golf Courses',
    columns: [
      { key: 'name', label: 'Course' },
      { key: 'city', label: 'City' },
      { key: 'country', label: 'Country' },
      { key: 'greenFee', label: 'Green Fee', format: v => v ? `$${v}` : '-' },
      { key: 'sceneryRating', label: 'Scenery', format: v => v ? `${v}/10` : '-' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
    ]
  },
  bike: {
    title: '🚴 Cycling Destinations',
    columns: [
      { key: 'city', label: 'City' },
      { key: 'country', label: 'Country' },
      { key: 'terrainType', label: 'Terrain' },
      { key: 'routeVariety', label: 'Routes', format: v => v ? `${v}/10` : '-' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
      { key: 'nomadScore', label: 'Nomad', format: v => v ? `${v}/10` : '-' },
    ]
  },
  run: {
    title: '🏃 Marathons & Races',
    columns: [
      { key: 'raceName', label: 'Race' },
      { key: 'city', label: 'City' },
      { key: 'raceType', label: 'Type' },
      { key: 'typicalMonth', label: 'When' },
      { key: 'entryFee', label: 'Entry', format: v => v ? `$${v}` : '-' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
    ]
  },
  triathlon: {
    title: '🏊 Triathlons',
    columns: [
      { key: 'eventName', label: 'Event' },
      { key: 'city', label: 'City' },
      { key: 'distance', label: 'Distance' },
      { key: 'typicalMonth', label: 'When' },
      { key: 'entryFee', label: 'Entry', format: v => v ? `$${v}` : '-' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
    ]
  },
  skate: {
    title: '🛹 Skateparks',
    columns: [
      { key: 'parkName', label: 'Park' },
      { key: 'city', label: 'City' },
      { key: 'country', label: 'Country' },
      { key: 'parkRating', label: 'Rating', format: v => v ? `${v}/10` : '-' },
      { key: 'parkSize', label: 'Size' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
    ]
  },
  festival: {
    title: '🎪 Festivals & Concerts',
    columns: [
      { key: 'festivalName', label: 'Festival' },
      { key: 'city', label: 'City' },
      { key: 'genre', label: 'Genre' },
      { key: 'typicalMonth', label: 'When' },
      { key: 'ticketCost', label: 'Ticket', format: v => v ? `$${v}` : '-' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
    ]
  },
  conference: {
    title: '🎤 Startup & Fintech Hubs',
    columns: [
      { key: 'city', label: 'City' },
      { key: 'country', label: 'Country' },
      { key: 'startupScene', label: 'Startup', format: v => v ? `${v}/10` : '-' },
      { key: 'fintechFocus', label: 'Fintech', format: v => v ? `${v}/10` : '-' },
      { key: 'coworkingCount', label: 'Cowork' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
    ]
  },
  nomad: {
    title: '💼 Digital Nomad Cities',
    columns: [
      { key: 'city', label: 'City' },
      { key: 'country', label: 'Country' },
      { key: 'wifiSpeed', label: 'WiFi', format: v => v ? `${v}Mbps` : '-' },
      { key: 'nomadCommunity', label: 'Community', format: v => v ? `${v}/10` : '-' },
      { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
      { key: 'visaEase', label: 'Visa' },
    ]
  },
};

export default function ActivityDestinationSelector({ tripId, activity, onSelect }: Props) {
  const [destinations, setDestinations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const config = ACTIVITY_CONFIG[activity] || ACTIVITY_CONFIG.nomad;

  useEffect(() => {
    loadDestinations();
  }, [activity]);

  const loadDestinations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/destinations?activity=${activity}`);
      if (res.ok) {
        const data = await res.json();
        setDestinations(data.destinations || []);
      }
    } catch (err) {
      console.error('Failed to load destinations:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = destinations.filter(d => {
    const searchLower = search.toLowerCase();
    return (
      (d.name?.toLowerCase().includes(searchLower)) ||
      (d.city?.toLowerCase().includes(searchLower)) ||
      (d.country?.toLowerCase().includes(searchLower)) ||
      (d.region?.toLowerCase().includes(searchLower)) ||
      (d.raceName?.toLowerCase().includes(searchLower)) ||
      (d.eventName?.toLowerCase().includes(searchLower)) ||
      (d.parkName?.toLowerCase().includes(searchLower)) ||
      (d.festivalName?.toLowerCase().includes(searchLower))
    );
  });

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
    
    const dest = destinations.find(d => d.id === id);
    if (dest) onSelect(dest);
  };

  if (loading) {
    return <div className="text-text-muted py-4">Loading destinations...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-text-primary">{config.title}</h3>
        <span className="text-sm text-text-faint">{destinations.length} destinations</span>
      </div>

      <input
        type="text"
        placeholder="Search destinations..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded mb-4 focus:outline-none focus:border-brand-accent"
      />

      <div className="overflow-x-auto max-h-96 overflow-y-auto border border-border rounded">
        <table className="w-full text-sm">
          <thead className="bg-bg-row sticky top-0">
            <tr>
              <th className="text-left py-2 px-3 text-text-muted font-medium"></th>
              {config.columns.map(col => (
                <th key={col.key} className="text-left py-2 px-3 text-text-muted font-medium whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(dest => (
              <tr
                key={dest.id}
                onClick={() => toggleSelect(dest.id)}
                className={`border-t border-border-light cursor-pointer hover:bg-bg-row transition-colors ${
                  selected.has(dest.id) ? 'bg-brand-accent/10' : ''
                }`}
              >
                <td className="py-2 px-3">
                  <input
                    type="checkbox"
                    checked={selected.has(dest.id)}
                    onChange={() => {}}
                    className="rounded border-border"
                  />
                </td>
                {config.columns.map(col => (
                  <td key={col.key} className="py-2 px-3 text-text-secondary whitespace-nowrap">
                    {col.format ? col.format(dest[col.key]) : (dest[col.key] || '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected.size > 0 && (
        <div className="mt-4 p-3 bg-brand-accent/10 border border-brand-accent/30 rounded">
          <span className="text-sm text-brand-accent font-medium">
            {selected.size} destination{selected.size > 1 ? 's' : ''} selected for comparison
          </span>
        </div>
      )}
    </div>
  );
}
