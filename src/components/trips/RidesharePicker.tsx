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
    <div className="bg-white rounded border border-border overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-bg-row flex justify-between items-center"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="font-medium">{destinationName}</div>
          <div className="text-sm text-text-muted">
            From {airportCode} • {travelers} travelers • Round trip
          </div>
        </div>
        
        {selectedRideshare ? (
          <div className="text-right">
            <div className="text-brand-green font-bold">${selectedRideshare.totalPrice.toFixed(0)}</div>
            <div className="text-xs text-text-muted">{selectedRideshare.notes}</div>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="px-4 py-2 bg-brand-purple text-white rounded text-sm hover:bg-brand-purple"
          >
            🚕 Estimate Cost
          </button>
        )}
      </div>

      {/* Selected Summary */}
      {selectedRideshare && !expanded && (
        <div className="px-4 pb-3 border-t border-border">
          <div className="flex justify-between items-center text-sm pt-2">
            <div>
              <span className="text-text-secondary">${selectedRideshare.perPerson.toFixed(0)}/person</span>
              <span className="ml-2 text-text-faint">{selectedRideshare.notes}</span>
            </div>
            <button 
              onClick={() => setExpanded(true)}
              className="text-xs text-brand-purple hover:text-brand-purple-hover"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Estimate Options */}
      {expanded && (
        <div className="border-t border-border p-4">
          {/* Quick Estimates */}
          <div className="text-sm text-text-muted mb-3">Quick estimate by distance:</div>
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
                      ? 'border-brand-purple bg-brand-purple/20'
                      : 'border-border hover:border-brand-purple/40'
                  }`}
                >
                  <div className="font-medium text-text-primary">{estimate.label}</div>
                  <div className="text-sm text-brand-green">${roundTrip.toFixed(0)} round trip</div>
                  <div className="text-xs text-text-faint">${(roundTrip / travelers).toFixed(0)}/person</div>
                </button>
              );
            })}
          </div>

          {/* Custom Entry */}
          <div className="border-t border-border pt-4">
            <div className="text-sm text-text-muted mb-2">Or enter your own estimate:</div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-text-muted">$</span>
                <input
                  type="number"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="Round trip total"
                  className="flex-1 bg-white border border-border rounded px-3 py-2 text-text-primary"
                />
              </div>
              <button
                onClick={handleCustomSubmit}
                disabled={!customPrice}
                className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green disabled:opacity-50"
              >
                Use
              </button>
            </div>
            {customPrice && (
              <div className="text-xs text-text-faint mt-1">
                ${(parseFloat(customPrice) / travelers).toFixed(0)}/person
              </div>
            )}
          </div>

          {/* Price Check Links */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs text-text-faint mb-2">Check actual prices:</div>
            <div className="flex gap-2">
              <a 
                href="https://www.uber.com/us/en/price-estimate/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-bg-row text-text-secondary rounded hover:bg-brand-purple-wash/40"
              >
                Uber ↗
              </a>
              <a 
                href="https://www.lyft.com/rider/fare-estimate" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-3 py-1 text-xs bg-bg-row text-text-secondary rounded hover:bg-brand-purple-wash/40"
              >
                Lyft ↗
              </a>
            </div>
          </div>

          <div className="mt-3 text-xs text-text-faint">
            💡 Estimates assume {travelers > 3 ? 'XL vehicle (4+ passengers)' : 'standard vehicle'}. 
            Prices vary by time of day and demand.
          </div>
        </div>
      )}
    </div>
  );
}
