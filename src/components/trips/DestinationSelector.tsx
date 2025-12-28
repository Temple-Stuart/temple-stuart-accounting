'use client';

import { useState, useEffect } from 'react';

interface Destination {
  id: string;
  name?: string;
  city?: string;
  country?: string;
  region?: string;
  nearestAirport?: string;
  // Activity-specific fields
  waveConsistency?: number;
  nomadScore?: number;
  monthlyRent?: number;
  greenFee?: number;
  routeVariety?: number;
  raceName?: string;
  eventName?: string;
  parkName?: string;
  festivalName?: string;
}

interface SelectedDestination {
  id: string;
  resortId: string;
  resort: Destination;
}

interface Props {
  tripId: string;
  activity: string | null;
  selectedDestinations: SelectedDestination[];
  onDestinationsChange: () => void;
}

const ACTIVITY_CONFIG: Record<string, { label: string; nameField: string; columns: { key: string; label: string; format?: (v: any) => string }[] }> = {
  snowboard: { label: '🏂 Ski Resorts', nameField: 'name', columns: [
    { key: 'region', label: 'Region' },
    { key: 'nearestAirport', label: 'Airport' },
  ]},
  mtb: { label: '🚵 Mountain Bike', nameField: 'name', columns: [
    { key: 'region', label: 'Region' },
  ]},
  surf: { label: '🏄 Surf Spots', nameField: 'name', columns: [
    { key: 'country', label: 'Country' },
    { key: 'waveConsistency', label: 'Waves', format: v => v ? `${v}/10` : '-' },
    { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
    { key: 'nomadScore', label: 'Nomad', format: v => v ? `${v}/10` : '-' },
  ]},
  kitesurf: { label: '🪁 Kite Spots', nameField: 'name', columns: [
    { key: 'country', label: 'Country' },
    { key: 'nomadScore', label: 'Nomad', format: v => v ? `${v}/10` : '-' },
  ]},
  sail: { label: '⛵ Sailing', nameField: 'name', columns: [
    { key: 'country', label: 'Country' },
  ]},
  golf: { label: '⛳ Golf Courses', nameField: 'name', columns: [
    { key: 'city', label: 'City' },
    { key: 'greenFee', label: 'Green Fee', format: v => v ? `$${v}` : '-' },
    { key: 'nomadScore', label: 'Nomad', format: v => v ? `${v}/10` : '-' },
  ]},
  bike: { label: '🚴 Cycling', nameField: 'city', columns: [
    { key: 'country', label: 'Country' },
    { key: 'terrainType', label: 'Terrain' },
    { key: 'nomadScore', label: 'Nomad', format: v => v ? `${v}/10` : '-' },
  ]},
  run: { label: '🏃 Races', nameField: 'raceName', columns: [
    { key: 'city', label: 'City' },
    { key: 'raceType', label: 'Type' },
    { key: 'typicalMonth', label: 'Month' },
  ]},
  triathlon: { label: '🏊 Triathlons', nameField: 'eventName', columns: [
    { key: 'city', label: 'City' },
    { key: 'distance', label: 'Distance' },
    { key: 'typicalMonth', label: 'Month' },
  ]},
  skate: { label: '🛹 Skateparks', nameField: 'parkName', columns: [
    { key: 'city', label: 'City' },
    { key: 'parkRating', label: 'Rating', format: v => v ? `${v}/10` : '-' },
  ]},
  festival: { label: '🎪 Festivals', nameField: 'festivalName', columns: [
    { key: 'city', label: 'City' },
    { key: 'genre', label: 'Genre' },
    { key: 'typicalMonth', label: 'Month' },
  ]},
  conference: { label: '🎤 Conferences', nameField: 'city', columns: [
    { key: 'country', label: 'Country' },
    { key: 'startupScene', label: 'Startup', format: v => v ? `${v}/10` : '-' },
  ]},
  nomad: { label: '💼 Nomad Cities', nameField: 'city', columns: [
    { key: 'country', label: 'Country' },
    { key: 'nomadCommunity', label: 'Community', format: v => v ? `${v}/10` : '-' },
    { key: 'monthlyRent', label: 'Rent', format: v => v ? `$${v}` : '-' },
  ]},
};

export default function DestinationSelector({ tripId, activity, selectedDestinations, onDestinationsChange }: Props) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const config = ACTIVITY_CONFIG[activity || 'snowboard'] || ACTIVITY_CONFIG.snowboard;

  useEffect(() => {
    loadDestinations();
  }, [activity]);

  const loadDestinations = async () => {
    if (!activity) return;
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

  const getDisplayName = (dest: Destination): string => {
    const field = config.nameField as keyof Destination;
    return (dest[field] as string) || dest.name || dest.city || 'Unknown';
  };

  const addDestination = async (destinationId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/destinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resortId: destinationId })
      });
      if (res.ok) {
        onDestinationsChange();
      }
    } catch (err) {
      console.error('Failed to add destination:', err);
    }
  };

  const removeDestination = async (destinationId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/destinations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resortId: destinationId })
      });
      if (res.ok) {
        onDestinationsChange();
      }
    } catch (err) {
      console.error('Failed to remove destination:', err);
    }
  };

  const selectedIds = new Set(selectedDestinations.map(d => d.resortId));

  const filteredDestinations = destinations.filter(dest => {
    const name = getDisplayName(dest).toLowerCase();
    const country = (dest.country || '').toLowerCase();
    const city = (dest.city || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || country.includes(query) || city.includes(query);
  });

  if (!activity) {
    return (
      <div className="text-center py-8 text-gray-500">
        No activity selected for this trip
      </div>
    );
  }

  return (
    <div>
      {/* Selected Destinations */}
      {selectedDestinations.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Selected for comparison:</h4>
          <div className="flex flex-wrap gap-2">
            {selectedDestinations.map(dest => (
              <div key={dest.id} className="flex items-center gap-2 bg-[#b4b237]/20 border border-[#b4b237]/40 rounded-lg px-3 py-1.5">
                <span className="text-sm font-medium text-gray-900">{getDisplayName(dest.resort)}</span>
                <button
                  onClick={() => removeDestination(dest.resortId)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Destination Button */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="px-4 py-2 bg-[#b4b237] text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium"
      >
        {showPicker ? 'Close' : `+ Add ${config.label}`}
      </button>

      {/* Destination Picker */}
      {showPicker && (
        <div className="mt-4 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search destinations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#b4b237]"
            />
          </div>

          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Name</th>
                    {config.columns.map(col => (
                      <th key={col.key} className="text-left py-2 px-3 font-medium text-gray-500">{col.label}</th>
                    ))}
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDestinations.map(dest => {
                    const isSelected = selectedIds.has(dest.id);
                    return (
                      <tr 
                        key={dest.id} 
                        className={`border-t border-gray-100 ${isSelected ? 'bg-[#b4b237]/10' : 'hover:bg-gray-50'}`}
                      >
                        <td className="py-2 px-3 font-medium text-gray-900">{getDisplayName(dest)}</td>
                        {config.columns.map(col => (
                          <td key={col.key} className="py-2 px-3 text-gray-600">
                            {col.format ? col.format((dest as any)[col.key]) : ((dest as any)[col.key] || '-')}
                          </td>
                        ))}
                        <td className="py-2 px-3">
                          {isSelected ? (
                            <button
                              onClick={() => removeDestination(dest.id)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              onClick={() => addDestination(dest.id)}
                              className="px-2 py-1 text-xs bg-[#b4b237] text-white rounded hover:shadow"
                            >
                              Add
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
