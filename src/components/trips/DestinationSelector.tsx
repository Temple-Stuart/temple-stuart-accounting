'use client';

import { useState, useEffect } from 'react';

interface Resort {
  id: string;
  name: string;
  region: string;
  country: string;
  state: string | null;
  nearestAirport: string | null;
  verticalDrop: number | null;
  avgSnowfall: number | null;
}

interface SelectedDestination {
  id: string;
  resortId: string;
  resort: Resort;
}

interface Props {
  tripId: string;
  selectedDestinations: SelectedDestination[];
  onDestinationsChange: () => void;
}

export default function DestinationSelector({ tripId, selectedDestinations, onDestinationsChange }: Props) {
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Record<string, Resort[]>>>({});
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadResorts();
  }, []);

  const loadResorts = async () => {
    try {
      const res = await fetch('/api/resorts');
      if (res.ok) {
        const data = await res.json();
        setResorts(data.resorts || []);
        setGrouped(data.grouped || {});
      }
    } catch (err) {
      console.error('Failed to load resorts:', err);
    } finally {
      setLoading(false);
    }
  };

  const addDestination = async (resortId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/destinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resortId })
      });
      if (res.ok) {
        onDestinationsChange();
      }
    } catch (err) {
      console.error('Failed to add destination:', err);
    }
  };

  const removeDestination = async (resortId: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/destinations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resortId })
      });
      if (res.ok) {
        onDestinationsChange();
      }
    } catch (err) {
      console.error('Failed to remove destination:', err);
    }
  };

  const isSelected = (resortId: string) => 
    selectedDestinations.some(d => d.resortId === resortId);

  const filteredResorts = searchQuery
    ? resorts.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.region.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const selectedIds = new Set(selectedDestinations.map(d => d.resortId));

  return (
    <div>
      {/* Selected Destinations Pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {selectedDestinations.map(d => (
          <div
            key={d.id}
            className="flex items-center gap-2 bg-blue-600/20 border border-blue-600/40 rounded-full px-3 py-1"
          >
            <span className="text-sm text-blue-300">{d.resort.name}</span>
            <button
              onClick={() => removeDestination(d.resortId)}
              className="text-blue-400 hover:text-red-400 text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm hover:bg-zinc-700"
        >
          + Add Destination
        </button>
      </div>

      {/* Destination Picker */}
      {showPicker && (
        <div className="bg-zinc-800 rounded-lg p-4 border border-zinc-700 mb-4">
          <input
            type="text"
            placeholder="Search resorts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-white text-sm mb-4"
            autoFocus
          />

          {searchQuery ? (
            // Search Results
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredResorts.length > 0 ? (
                filteredResorts.map(resort => (
                  <button
                    key={resort.id}
                    onClick={() => {
                      if (!isSelected(resort.id)) {
                        addDestination(resort.id);
                      }
                      setSearchQuery('');
                    }}
                    disabled={isSelected(resort.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm flex justify-between items-center ${
                      isSelected(resort.id)
                        ? 'bg-blue-600/20 text-blue-300'
                        : 'hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    <span>
                      {resort.name}
                      <span className="text-zinc-500 ml-2 text-xs">
                        {resort.state ? `${resort.state}, ` : ''}{resort.country}
                      </span>
                    </span>
                    {resort.verticalDrop && (
                      <span className="text-xs text-zinc-500">
                        {resort.verticalDrop}ft • {resort.avgSnowfall}"
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-zinc-500 text-sm">No resorts found</p>
              )}
            </div>
          ) : (
            // Grouped List
            <div className="max-h-80 overflow-y-auto">
              {Object.entries(grouped).map(([country, regions]) => (
                <div key={country} className="mb-4">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase mb-2">{country}</h4>
                  {Object.entries(regions).map(([region, regionResorts]) => (
                    <div key={region} className="mb-2">
                      <h5 className="text-xs text-zinc-500 mb-1 ml-2">{region}</h5>
                      <div className="space-y-1">
                        {regionResorts.map(resort => (
                          <button
                            key={resort.id}
                            onClick={() => {
                              if (!isSelected(resort.id)) {
                                addDestination(resort.id);
                              }
                            }}
                            disabled={isSelected(resort.id)}
                            className={`w-full text-left px-3 py-1.5 rounded text-sm flex justify-between items-center ${
                              isSelected(resort.id)
                                ? 'bg-blue-600/20 text-blue-300'
                                : 'hover:bg-zinc-700 text-zinc-300'
                            }`}
                          >
                            <span>{resort.name}</span>
                            {isSelected(resort.id) && <span className="text-xs">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end mt-4">
            <button
              onClick={() => {
                setShowPicker(false);
                setSearchQuery('');
              }}
              className="px-4 py-1 text-sm bg-zinc-700 text-white rounded hover:bg-zinc-600"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {selectedDestinations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left py-2 px-3 text-zinc-400">Resort</th>
                <th className="text-left py-2 px-3 text-zinc-400">Location</th>
                <th className="text-right py-2 px-3 text-zinc-400">Vertical</th>
                <th className="text-right py-2 px-3 text-zinc-400">Snowfall</th>
                <th className="text-center py-2 px-3 text-zinc-400">Airport</th>
              </tr>
            </thead>
            <tbody>
              {selectedDestinations.map(d => (
                <tr key={d.id} className="border-b border-zinc-800">
                  <td className="py-2 px-3 font-medium">{d.resort.name}</td>
                  <td className="py-2 px-3 text-zinc-400">
                    {d.resort.state ? `${d.resort.state}, ` : ''}{d.resort.country}
                  </td>
                  <td className="py-2 px-3 text-right">{d.resort.verticalDrop?.toLocaleString() || '-'} ft</td>
                  <td className="py-2 px-3 text-right">{d.resort.avgSnowfall || '-'}"</td>
                  <td className="py-2 px-3 text-center font-mono text-xs">{d.resort.nearestAirport || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
