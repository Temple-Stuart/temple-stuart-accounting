'use client';

import { useState } from 'react';

interface RideshareEstimate {
  id: string;
  totalPrice: number;
  perPerson: number;
  notes: string;
}

interface Props {
  destinationName: string;
  airportCode: string;
  travelers: number;
  selectedRideshare: RideshareEstimate | null;
  onSelectRideshare: (estimate: RideshareEstimate) => void;
}

// Rough estimates based on typical airport-to-resort distances
const DISTANCE_ESTIMATES = [
  { label: 'Close (< 30 min)', basePrice: 40 },
  { label: 'Medium (30-60 min)', basePrice: 75 },
  { label: 'Far (1-2 hours)', basePrice: 150 },
  { label: 'Very Far (2+ hours)', basePrice: 250 },
];

export default function RidesharePicker({
  destinationName,
  airportCode,
  travelers,
  selectedRideshare,
  onSelectRideshare,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [customPrice, setCustomPrice] = useState('');
  const [selectedDistance, setSelectedDistance] = useState<string | null>(null);

  const handleQuickSelect = (estimate: typeof DISTANCE_ESTIMATES[0]) => {
    // Round trip price (x2), adjusted for larger groups needing XL
    const needsXL = travelers > 3;
    const multiplier = needsXL ? 1.5 : 1;
    const roundTripPrice = estimate.basePrice * 2 * multiplier;
    
    onSelectRideshare({
      id: `rideshare-${Date.now()}`,
      totalPrice: roundTripPrice,
      perPerson: roundTripPrice / travelers,
      notes: `${estimate.label} - Round trip${needsXL ? ' (XL vehicle)' : ''}`,
    });
    setSelectedDistance(estimate.label);
    setExpanded(false);
  };

  const handleCustomSubmit = () => {
    if (!customPrice) return;
    const price = parseFloat(customPrice);
    onSelectRideshare({
      id: `rideshare-custom-${Date.now()}`,
      totalPrice: price,
      perPerson: price / travelers,
      notes: 'Custom estimate',
    });
    setExpanded(false);
  };

  return (
    <div className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-zinc-750 flex justify-between items-center"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="font-medium">{destinationName}</div>
          <div className="text-sm text-zinc-400">
            From {airportCode} • {travelers} travelers • Round trip
          </div>
        </div>
        
        {selectedRideshare ? (
          <div className="text-right">
            <div className="text-green-400 font-bold">${selectedRideshare.totalPrice.toFixed(0)}</div>
            <div className="text-xs text-zinc-400">{selectedRideshare.notes}</div>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500"
          >
            🚕 Estimate Cost
          </button>
        )}
      </div>

      {/* Selected Summary */}
      {selectedRideshare && !expanded && (
        <div className="px-4 pb-3 border-t border-zinc-700">
          <div className="flex justify-between items-center text-sm pt-2">
            <div>
              <span className="text-zinc-300">${selectedRideshare.perPerson.toFixed(0)}/person</span>
              <span className="ml-2 text-zinc-500">{selectedRideshare.notes}</span>
            </div>
            <button 
              onClick={() => setExpanded(true)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Estimate Options */}
      {expanded && (
        <div className="border-t border-zinc-700 p-4">
          {/* Quick Estimates */}
          <div className="text-sm text-zinc-400 mb-3">Quick estimate by distance:</div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {DISTANCE_ESTIMATES.map(estimate => {
              const needsXL = travelers > 3;
              const roundTrip = estimate.basePrice * 2 * (needsXL ? 1.5 : 1);
              return (
                <button
                  key={estimate.label}
                  onClick={() => handleQuickSelect(estimate)}
                  className={`p-3 rounded border text-left transition-colors ${
                    selectedDistance === estimate.label
                      ? 'border-blue-500 bg-blue-600/20'
                      : 'border-zinc-600 hover:border-zinc-500'
                  }`}
                >
                  <div className="font-medium text-white">{estimate.label}</div>
                  <div className="text-sm text-green-400">${roundTrip.toFixed(0)} round trip</div>
                  <div className="text-xs text-zinc-500">${(roundTrip / travelers).toFixed(0)}/person</div>
                </button>
              );
            })}
          </div>

          {/* Custom Entry */}
          <div className="border-t border-zinc-700 pt-4">
            <div className="text-sm text-zinc-400 mb-2">Or enter your own estimate:</div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-zinc-400">$</span>
                <input
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="Round trip total"
                  className="flex-1 bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-white"
                />
              </div>
              <button
                onClick={handleCustomSubmit}
                disabled={!customPrice}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
              >
                Use
              </button>
            </div>
            {customPrice && (
              <div className="text-xs text-zinc-500 mt-1">
                ${(parseFloat(customPrice) / travelers).toFixed(0)}/person
              </div>
            )}
          </div>

          {/* Price Check Links */}
          <div className="mt-4 pt-4 border-t border-zinc-700">
            <div className="text-xs text-zinc-500 mb-2">Check actual prices:</div>
            <div className="flex gap-2">
              <a 
                href="https://www.uber.com/us/en/price-estimate/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600"
              >
                Uber ↗
              </a>
              <a 
                href="https://www.lyft.com/rider/fare-estimate" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600"
              >
                Lyft ↗
              </a>
            </div>
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            💡 Estimates assume {travelers > 3 ? 'XL vehicle (4+ passengers)' : 'standard vehicle'}. 
            Prices vary by time of day and demand.
          </div>
        </div>
      )}
    </div>
  );
}
