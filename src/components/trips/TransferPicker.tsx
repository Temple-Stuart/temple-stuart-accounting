'use client';

import { useState } from 'react';

interface TransferOption {
  id: string;
  type: string;
  direction: 'arrival' | 'departure';
  vehicle: {
    code: string;
    category: string;
    description: string;
    seats: number;
    bags: number;
    imageURL?: string;
  };
  provider: {
    code: string;
    name: string;
  };
  price: number;
  currency: string;
  distance: string | null;
  pickupTime: string;
  dropoffTime: string | null;
}

interface Props {
  destinationName: string;
  resortId: string;
  airportCode: string;
  arrivalDateTime: string;    // Airport → Resort
  departureDateTime: string;  // Resort → Airport
  passengers: number;
  selectedArrival: TransferOption | null;
  selectedDeparture: TransferOption | null;
  onSelectArrival: (transfer: TransferOption) => void;
  onSelectDeparture: (transfer: TransferOption) => void;
}

const TRANSFER_TYPES = [
  { code: 'PRIVATE', label: 'Private Car', icon: '🚗' },
  { code: 'SHARED', label: 'Shared Shuttle', icon: '🚐' },
  { code: 'TAXI', label: 'Taxi', icon: '🚕' },
];

export default function TransferPicker({
  destinationName,
  resortId,
  airportCode,
  arrivalDateTime,
  departureDateTime,
  passengers,
  selectedArrival,
  selectedDeparture,
  onSelectArrival,
  onSelectDeparture,
}: Props) {
  const [arrivalTransfers, setArrivalTransfers] = useState<TransferOption[]>([]);
  const [departureTransfers, setDepartureTransfers] = useState<TransferOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [searched, setSearched] = useState(false);
  const [transferType, setTransferType] = useState('PRIVATE');
  const [activeTab, setActiveTab] = useState<'arrival' | 'departure'>('arrival');

  // Manual entry state
  const [manualArrivalPrice, setManualArrivalPrice] = useState<string>('');
  const [manualDeparturePrice, setManualDeparturePrice] = useState<string>('');

  const fetchTransfers = async (type: string = transferType) => {
    setLoading(true);
    setError('');
    
    try {
      // Fetch both arrival and departure transfers
      const [arrivalRes, departureRes] = await Promise.all([
        fetch(`/api/travel/transfers?resortId=${resortId}&dateTime=${encodeURIComponent(arrivalDateTime)}&passengers=${passengers}&transferType=${type}`),
        fetch(`/api/travel/transfers?resortId=${resortId}&dateTime=${encodeURIComponent(departureDateTime)}&passengers=${passengers}&transferType=${type}&direction=departure`),
      ]);
      
      if (!arrivalRes.ok || !departureRes.ok) {
        throw new Error('Failed to fetch transfers');
      }
      
      const [arrivalData, departureData] = await Promise.all([
        arrivalRes.json(),
        departureRes.json(),
      ]);
      
      if (arrivalData.error) setError(arrivalData.error);
      
      // Tag transfers with direction
      const taggedArrivals = (arrivalData.transfers || []).map((t: TransferOption) => ({ ...t, direction: 'arrival' as const }));
      const taggedDepartures = (departureData.transfers || []).map((t: TransferOption) => ({ ...t, direction: 'departure' as const }));
      
      setArrivalTransfers(taggedArrivals);
      setDepartureTransfers(taggedDepartures);
      setSearched(true);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transfers');
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type: string) => {
    setTransferType(type);
    fetchTransfers(type);
  };

  const formatTime = (isoTime: string) => {
    if (!isoTime) return '';
    const date = new Date(isoTime);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleManualSubmit = (direction: 'arrival' | 'departure') => {
    const price = direction === 'arrival' ? manualArrivalPrice : manualDeparturePrice;
    if (!price) return;
    const manualTransfer = {
      id: `manual-${direction}-${Date.now()}`,
      type: 'MANUAL',
      direction,
      vehicle: { code: 'MANUAL', category: 'Manual Entry', description: 'Uber/Lyft (manual)', seats: passengers, bags: passengers },
      provider: { code: 'MANUAL', name: 'Manual Entry' },
      price: parseFloat(price),
      currency: 'USD',
      distance: null,
      pickupTime: direction === 'arrival' ? arrivalDateTime : departureDateTime,
      dropoffTime: null,
    };
    if (direction === 'arrival') {
      onSelectArrival(manualTransfer);
      setManualArrivalPrice('');
    } else {
      onSelectDeparture(manualTransfer);
      setManualDeparturePrice('');
    }
  };

  const totalPrice = (selectedArrival?.price || 0) + (selectedDeparture?.price || 0);
  const currentTransfers = activeTab === 'arrival' ? arrivalTransfers : departureTransfers;
  const currentSelected = activeTab === 'arrival' ? selectedArrival : selectedDeparture;
  const onSelect = activeTab === 'arrival' ? onSelectArrival : onSelectDeparture;

  return (
    <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-100 flex justify-between items-center"
        onClick={() => (arrivalTransfers.length > 0 || searched) ? setExpanded(!expanded) : fetchTransfers()}
      >
        <div>
          <div className="font-medium">{destinationName}</div>
          <div className="text-sm text-gray-500">
            {airportCode} ↔ Resort • {passengers} passengers
          </div>
          <div className="text-xs text-gray-400 mt-1">
            🛬 {formatDate(arrivalDateTime)} • 🛫 {formatDate(departureDateTime)}
          </div>
        </div>
        
        {(selectedArrival || selectedDeparture) ? (
          <div className="text-right">
            <div className="text-green-400 font-bold">${totalPrice.toFixed(0)}</div>
            <div className="text-xs text-gray-500">
              {selectedArrival && selectedDeparture ? 'Round trip' : 'One way'}
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); fetchTransfers(); }}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-gray-900 rounded text-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? '⏳ Loading...' : '🚗 Search Transfers'}
          </button>
        )}
      </div>

      {/* Selected Transfer Summary */}
      {(selectedArrival || selectedDeparture) && !expanded && (
        <div className="px-4 pb-3 border-t border-gray-200">
          {selectedArrival && (
            <div className="flex justify-between items-center text-sm pt-2">
              <div>
                <span className="text-blue-400">🛬 Arrival:</span>
                <span className="ml-2 text-gray-600">{selectedArrival.vehicle.description}</span>
                <span className="ml-2 text-gray-400">${selectedArrival.price.toFixed(0)}</span>
              </div>
            </div>
          )}
          {selectedDeparture && (
            <div className="flex justify-between items-center text-sm pt-1">
              <div>
                <span className="text-orange-400">🛫 Departure:</span>
                <span className="ml-2 text-gray-600">{selectedDeparture.vehicle.description}</span>
                <span className="ml-2 text-gray-400">${selectedDeparture.price.toFixed(0)}</span>
              </div>
            </div>
          )}
          <button 
            onClick={() => setExpanded(true)}
            className="text-xs text-blue-400 hover:text-blue-300 mt-2"
          >
            Change
          </button>
        </div>
      )}

      {/* Transfer Options */}
      {expanded && (
        <div className="border-t border-gray-200 max-h-[500px] overflow-y-auto">
          {/* Direction Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('arrival')}
              className={`flex-1 py-2 px-3 text-sm flex items-center justify-center gap-2 ${
                activeTab === 'arrival'
                  ? 'bg-blue-600 text-gray-900'
                  : 'bg-white text-gray-500 hover:bg-gray-100'
              }`}
            >
              🛬 Arrival
              {selectedArrival && <span className="text-xs">✓</span>}
            </button>
            <button
              onClick={() => setActiveTab('departure')}
              className={`flex-1 py-2 px-3 text-sm flex items-center justify-center gap-2 ${
                activeTab === 'departure'
                  ? 'bg-orange-600 text-gray-900'
                  : 'bg-white text-gray-500 hover:bg-gray-100'
              }`}
            >
              🛫 Departure
              {selectedDeparture && <span className="text-xs">✓</span>}
            </button>
          </div>

          {/* Transfer Type Tabs */}
          <div className="flex border-b border-gray-200">
            {TRANSFER_TYPES.map(type => (
              <button
                key={type.code}
                onClick={() => handleTypeChange(type.code)}
                className={`flex-1 py-2 px-3 text-sm ${
                  transferType === type.code
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-white text-gray-500 hover:bg-gray-100'
                }`}
              >
                {type.icon} {type.label}
              </button>
            ))}
          </div>

          {/* Direction Label */}
          <div className="px-4 py-2 bg-white text-xs text-gray-500">
            {activeTab === 'arrival' 
              ? `${airportCode} → ${destinationName} • ${formatDate(arrivalDateTime)}`
              : `${destinationName} → ${airportCode} • ${formatDate(departureDateTime)}`
            }
          </div>

          {error && (
            <div className="p-4 text-red-400 text-sm">{error}</div>
          )}
          

          {/* Manual Entry Section */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="text-sm text-gray-600 font-medium mb-2">
              {activeTab === 'arrival' ? '🛬 Arrival' : '🛫 Departure'} - Enter manually:
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                value={activeTab === 'arrival' ? manualArrivalPrice : manualDeparturePrice}
                onChange={(e) => activeTab === 'arrival' ? setManualArrivalPrice(e.target.value) : setManualDeparturePrice(e.target.value)}
                placeholder="Total cost"
                className="flex-1 bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 text-sm"
              />
              <button
                onClick={() => handleManualSubmit(activeTab)}
                disabled={!(activeTab === 'arrival' ? manualArrivalPrice : manualDeparturePrice)}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                Use This
              </button>
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <span className="text-gray-400">Check prices:</span>
              <a href="https://www.uber.com/us/en/price-estimate/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Uber ↗</a>
              <a href="https://www.lyft.com/rider/fare-estimate" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Lyft ↗</a>
            </div>
          </div>
          {loading && (
            <div className="p-4 text-gray-500 text-sm text-center">Loading transfers...</div>
          )}

          {currentTransfers.length === 0 && searched && !loading && !error && (
            <div className="p-4 text-gray-400 text-sm">
              No {transferType.toLowerCase()} transfers found for this route.
              <div className="mt-2 text-xs">
                Try a different transfer type or check that the airport code is correct.
              </div>
            </div>
          )}

          {currentTransfers.map((transfer) => (
            <div
              key={transfer.id}
              onClick={() => {
                onSelect({ ...transfer, direction: activeTab });
              }}
              className={`p-4 border-b border-gray-200 last:border-b-0 cursor-pointer transition-colors ${
                currentSelected?.id === transfer.id 
                  ? 'bg-blue-600/20 border-l-2 border-l-blue-500' 
                  : 'hover:bg-gray-200/50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{transfer.vehicle.description}</div>
                  <div className="text-sm text-gray-500">
                    {transfer.provider.name}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    👥 {transfer.vehicle.seats} seats • 🧳 {transfer.vehicle.bags} bags
                    {transfer.distance && <span className="ml-2">• 📍 {transfer.distance}</span>}
                  </div>
                  {transfer.pickupTime && (
                    <div className="text-xs text-gray-400 mt-1">
                      ⏰ Pickup: {formatTime(transfer.pickupTime)}
                      {transfer.dropoffTime && ` → ${formatTime(transfer.dropoffTime)}`}
                    </div>
                  )}
                </div>
                <div className="ml-4 text-right">
                  <div className="text-xl font-bold text-green-400">${transfer.price.toFixed(0)}</div>
                  <div className="text-xs text-gray-500">{transfer.currency}</div>
                  <div className="text-xs text-blue-400">${(transfer.price / passengers).toFixed(0)}/person</div>
                </div>
              </div>
            </div>
          ))}

          {currentTransfers.length > 0 && (
            <div className="p-3 bg-white text-xs text-gray-400 text-center">
              ⚠️ Test data from Amadeus API — prices may not reflect actual rates
            </div>
          )}
        </div>
      )}
    </div>
  );
}
