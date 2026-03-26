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
  waveConsistency?: number | null;
  waveType?: string | null;
  waterTempLow?: number | null;
  waterTempHigh?: number | null;
  bestMonths?: string | null;
  greenFee?: number | null;
  sceneryRating?: number | null;
  courseRating?: number | null;
  routeVariety?: number | null;
  terrainType?: string | null;
  raceType?: string | null;
  distance?: string | null;
  typicalMonth?: string | null;
  genre?: string | null;
  durationDays?: number | null;
  parkRating?: number | null;
  parkSize?: string | null;
  startupScene?: number | null;
  nomadCommunity?: number | null;
  wifiSpeed?: number | null;
  nomadScore?: number | null;
}

interface SelectedDestination {
  id: string;
  resortId: string;
  resort: Resort;
}

interface Props {
  activity?: string | null;
  tripId: string;
  selectedDestinations: SelectedDestination[];
  onDestinationsChange: () => void;
  selectedDestinationId?: string | null;
  onSelectDestination?: (resortId: string, resortName: string) => void;
}

const ACTIVITY_COLUMNS: Record<string, { key: string; label: string; align: string; format: (r: Resort) => string }[]> = {
  snowboard: [
    { key: 'verticalDrop', label: 'Vertical', align: 'right', format: r => r.verticalDrop ? `${r.verticalDrop.toLocaleString()} ft` : '-' },
    { key: 'avgSnowfall', label: 'Snowfall', align: 'right', format: r => r.avgSnowfall ? `${r.avgSnowfall}"` : '-' },
  ],
  mtb: [
    { key: 'verticalDrop', label: 'Vertical', align: 'right', format: r => r.verticalDrop ? `${r.verticalDrop.toLocaleString()} ft` : '-' },
  ],
  surf: [
    { key: 'waveConsistency', label: 'Waves', align: 'center', format: r => r.waveConsistency ? `${r.waveConsistency}/10` : '-' },
    { key: 'waveType', label: 'Type', align: 'left', format: r => r.waveType || '-' },
    { key: 'waterTemp', label: 'Water °F', align: 'center', format: r => r.waterTempLow && r.waterTempHigh ? `${r.waterTempLow}-${r.waterTempHigh}` : '-' },
    { key: 'bestMonths', label: 'Best Months', align: 'left', format: r => r.bestMonths || '-' },
  ],
  kitesurf: [
    { key: 'waveConsistency', label: 'Wind', align: 'center', format: r => r.waveConsistency ? `${r.waveConsistency}/10` : '-' },
    { key: 'bestMonths', label: 'Best Months', align: 'left', format: r => r.bestMonths || '-' },
  ],
  sail: [
    { key: 'waveConsistency', label: 'Conditions', align: 'center', format: r => r.waveConsistency ? `${r.waveConsistency}/10` : '-' },
    { key: 'bestMonths', label: 'Best Months', align: 'left', format: r => r.bestMonths || '-' },
  ],
  golf: [
    { key: 'courseRating', label: 'Rating', align: 'center', format: r => r.courseRating ? `${r.courseRating}` : '-' },
    { key: 'sceneryRating', label: 'Scenery', align: 'center', format: r => r.sceneryRating ? `${r.sceneryRating}/10` : '-' },
  ],
  bike: [
    { key: 'routeVariety', label: 'Routes', align: 'center', format: r => r.routeVariety ? `${r.routeVariety}/10` : '-' },
    { key: 'terrainType', label: 'Terrain', align: 'left', format: r => r.terrainType || '-' },
  ],
  run: [
    { key: 'raceType', label: 'Type', align: 'left', format: r => r.raceType || '-' },
    { key: 'typicalMonth', label: 'When', align: 'left', format: r => r.typicalMonth || '-' },
  ],
  triathlon: [
    { key: 'distance', label: 'Distance', align: 'left', format: r => r.distance || '-' },
    { key: 'typicalMonth', label: 'When', align: 'left', format: r => r.typicalMonth || '-' },
  ],
  festival: [
    { key: 'genre', label: 'Genre', align: 'left', format: r => r.genre || '-' },
    { key: 'typicalMonth', label: 'When', align: 'left', format: r => r.typicalMonth || '-' },
    { key: 'durationDays', label: 'Days', align: 'center', format: r => r.durationDays ? `${r.durationDays}` : '-' },
  ],
  skate: [
    { key: 'parkRating', label: 'Rating', align: 'center', format: r => r.parkRating ? `${r.parkRating}/10` : '-' },
    { key: 'parkSize', label: 'Size', align: 'left', format: r => r.parkSize || '-' },
  ],
  conference: [
    { key: 'startupScene', label: 'Startup', align: 'center', format: r => r.startupScene ? `${r.startupScene}/10` : '-' },
    { key: 'nomadScore', label: 'Nomad', align: 'center', format: r => r.nomadScore ? `${r.nomadScore}/10` : '-' },
  ],
  nomad: [
    { key: 'nomadCommunity', label: 'Community', align: 'center', format: r => r.nomadCommunity ? `${r.nomadCommunity}/10` : '-' },
    { key: 'wifiSpeed', label: 'WiFi', align: 'center', format: r => r.wifiSpeed ? `${r.wifiSpeed} Mbps` : '-' },
  ],
};

export default function DestinationSelector({ 
  tripId, 
  activity, 
  selectedDestinations, 
  onDestinationsChange,
  selectedDestinationId,
  onSelectDestination 
}: Props) {
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Record<string, Resort[]>>>({});
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const columns = ACTIVITY_COLUMNS[activity || 'all'] || ACTIVITY_COLUMNS.all || [];

  useEffect(() => {
    loadResorts();
  }, [activity]);

  const loadResorts = async () => {
    try {
      const res = await fetch('/api/resorts?activity=' + (activity || 'all'));
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

  const removeDestination = async (resortId: string, destinationId?: string) => {
    try {
      // Use destinationId for name-based destinations, resortId for resort-based
      const body = destinationId ? { destinationId } : { resortId };
      const res = await fetch(`/api/trips/${tripId}/destinations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
        r.region?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <div>
      {/* Selected Destinations Pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {selectedDestinations.map(d => (
          <div
            key={d.id}
            className={`flex items-center gap-2 rounded-full px-3 py-1 ${
              selectedDestinationId === d.resortId 
                ? 'bg-brand-accent text-white' 
                : 'bg-brand-accent/20 border border-brand-accent/40'
            }`}
          >
            <span className={`text-sm ${selectedDestinationId === d.resortId ? 'text-white' : 'text-text-secondary'}`}>
              {d.resort.name}
              {selectedDestinationId === d.resortId && ' ✓'}
            </span>
            <button
              onClick={() => removeDestination(d.resortId, d.resortId === d.id ? d.id : undefined)}
              className={`text-xs ${selectedDestinationId === d.resortId ? 'text-white/70 hover:text-white' : 'text-text-faint hover:text-brand-red'}`}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="px-3 py-1 bg-bg-row text-text-secondary rounded-full text-sm hover:bg-border"
        >
          + Add Destination
        </button>
      </div>

      {/* Destination Picker */}
      {showPicker && (
        <div className="bg-bg-row rounded p-4 border border-border mb-4">
          <input
            type="text"
            placeholder="Search destinations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-border rounded px-3 py-2 text-text-primary text-sm mb-4"
            autoFocus
          />

          {searchQuery ? (
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
                        ? 'bg-brand-accent/20 text-text-secondary'
                        : 'hover:bg-border text-text-secondary'
                    }`}
                  >
                    <span>
                      {resort.name}
                      <span className="text-text-faint ml-2 text-xs">
                        {resort.state ? `${resort.state}, ` : ''}{resort.country}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-text-faint text-sm">No destinations found</p>
              )}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {Object.entries(grouped).map(([country, regions]) => (
                <div key={country} className="mb-4">
                  <h4 className="text-xs font-semibold text-text-muted uppercase mb-2">{country}</h4>
                  {Object.entries(regions).map(([region, regionResorts]) => (
                    <div key={region} className="mb-2">
                      <h5 className="text-xs text-text-faint mb-1 ml-2">{region}</h5>
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
                                ? 'bg-brand-accent/20 text-text-secondary'
                                : 'hover:bg-border text-text-secondary'
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
              className="px-4 py-1 text-sm bg-border text-text-primary rounded hover:bg-border"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Comparison Table - Activity Specific Columns */}
      {selectedDestinations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {onSelectDestination && (
                  <th className="text-center py-2 px-2 text-text-muted w-16">Select</th>
                )}
                <th className="text-left py-2 px-3 text-text-muted">Destination</th>
                <th className="text-left py-2 px-3 text-text-muted">Location</th>
                {columns.map(col => (
                  <th key={col.key} className={`text-${col.align} py-2 px-3 text-text-muted`}>{col.label}</th>
                ))}
                <th className="text-center py-2 px-3 text-text-muted">Airport</th>
              </tr>
            </thead>
            <tbody>
              {selectedDestinations.map(d => (
                <tr 
                  key={d.id} 
                  className={`border-b border-border ${selectedDestinationId === d.resortId ? 'bg-brand-accent/10' : ''}`}
                >
                  {onSelectDestination && (
                    <td className="py-2 px-2 text-center">
                      {selectedDestinationId === d.resortId ? (
                        <span className="text-brand-accent font-bold">✓</span>
                      ) : (
                        <button
                          onClick={() => onSelectDestination(d.resortId, d.resort.name)}
                          className="px-2 py-1 text-xs bg-brand-accent text-white rounded hover:bg-brand-accent-dark transition-all"
                        >
                          Select
                        </button>
                      )}
                    </td>
                  )}
                  <td className="py-2 px-3 font-medium">{d.resort.name}</td>
                  <td className="py-2 px-3 text-text-muted">
                    {d.resort.state ? `${d.resort.state}, ` : ''}{d.resort.country}
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className={`py-2 px-3 text-${col.align}`}>{col.format(d.resort)}</td>
                  ))}
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
