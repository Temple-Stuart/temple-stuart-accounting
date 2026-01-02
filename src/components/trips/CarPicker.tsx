'use client';

import { useState } from 'react';

interface CarOption {
  id: string;
  type: string;
  name: string;
  seats: number;
  cargo: string;
  price: number;
  vendor: string;
  perDay: number;
}

interface Props {
  destinationName: string;
  destinationAirport: string;
  pickupDate: string;
  dropoffDate: string;
  travelers: number;
  days: number;
  selectedCar: CarOption | null;
  onSelectCar: (car: CarOption) => void;
}

// Preset vehicle options - user enters price from rental sites
const VEHICLE_OPTIONS = [
  { id: 'suv-mid', type: 'SUV', name: 'Midsize SUV (RAV4, CRV)', seats: 5, cargo: '2-3 boards' },
  { id: 'suv-full', type: 'SUV', name: 'Full-size SUV (4Runner, Tahoe)', seats: 7, cargo: '4-5 boards' },
  { id: 'minivan', type: 'Van', name: 'Minivan (Sienna, Pacifica)', seats: 7, cargo: '5-6 boards' },
  { id: 'passenger-van', type: 'Van', name: 'Passenger Van (Transit)', seats: 12, cargo: '8+ boards' },
  { id: 'suv-luxury', type: 'SUV', name: 'Luxury SUV (Escalade, Navigator)', seats: 7, cargo: '4-5 boards' },
];

const RENTAL_SITES = [
  { name: 'Costco Travel', url: 'https://www.costcotravel.com/Rental-Cars' },
  { name: 'Kayak', url: 'https://www.kayak.com/cars' },
  { name: 'Turo', url: 'https://turo.com' },
  { name: 'Enterprise', url: 'https://www.enterprise.com' },
];

export default function CarPicker({
  destinationName,
  destinationAirport,
  pickupDate,
  dropoffDate,
  travelers,
  days,
  selectedCar,
  onSelectCar,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [vendor, setVendor] = useState('');

  // Filter vehicles that fit the group
  const suitableVehicles = VEHICLE_OPTIONS.filter(v => v.seats >= travelers);

  const handleSelectVehicle = (vehicle: typeof VEHICLE_OPTIONS[0]) => {
    setSelectedType(vehicle.id);
  };

  const handleConfirm = () => {
    if (!selectedType || !price) return;
    
    const vehicle = VEHICLE_OPTIONS.find(v => v.id === selectedType);
    if (!vehicle) return;

    const totalPrice = parseFloat(price);
    onSelectCar({
      id: vehicle.id,
      type: vehicle.type,
      name: vehicle.name,
      seats: vehicle.seats,
      cargo: vehicle.cargo,
      price: totalPrice,
      vendor: vendor || 'Manual Entry',
      perDay: totalPrice / days,
    });
    setExpanded(false);
  };

  return (
    <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-100 flex justify-between items-center"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="font-medium">{destinationName}</div>
          <div className="text-sm text-gray-500">
            Pickup: {destinationAirport} • {days} days • {travelers} travelers + gear
          </div>
        </div>
        
        {selectedCar ? (
          <div className="text-right">
            <div className="text-green-600 font-bold">${selectedCar.price.toFixed(0)}</div>
            <div className="text-xs text-gray-500">{selectedCar.name}</div>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            🚐 Select Vehicle
          </button>
        )}
      </div>

      {/* Selected Car Summary */}
      {selectedCar && !expanded && (
        <div className="px-4 pb-3 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm pt-2">
            <div>
              <span className="text-gray-600">{selectedCar.name}</span>
              <span className="ml-2 text-gray-400">
                ${selectedCar.perDay.toFixed(0)}/day • {selectedCar.vendor}
              </span>
            </div>
            <button 
              onClick={() => setExpanded(true)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Vehicle Selection */}
      {expanded && (
        <div className="border-t border-gray-200 p-4">
          {/* Quick Links to Rental Sites */}
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-2">Search prices on:</div>
            <div className="flex flex-wrap gap-2">
              {RENTAL_SITES.map(site => (
                <a
                  key={site.name}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                >
                  {site.name} ↗
                </a>
              ))}
            </div>
          </div>

          {/* Vehicle Options */}
          <div className="space-y-2 mb-4">
            <div className="text-sm text-gray-500 mb-2">Select vehicle type:</div>
            {suitableVehicles.map(vehicle => (
              <div
                key={vehicle.id}
                onClick={() => handleSelectVehicle(vehicle)}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  selectedType === vehicle.id
                    ? 'border-blue-500 bg-blue-600/20'
                    : 'border-gray-300 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">{vehicle.name}</div>
                    <div className="text-xs text-gray-500">
                      👥 {vehicle.seats} seats • 🏂 {vehicle.cargo}
                    </div>
                  </div>
                  {selectedType === vehicle.id && (
                    <span className="text-blue-600">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Price Entry */}
          {selectedType && (
            <div className="space-y-3 pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">Enter total rental price:</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Total Price ($)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 450"
                    className="w-full mt-1 bg-white border border-gray-300 rounded px-3 py-2 text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Rental Company</label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. Enterprise"
                    className="w-full mt-1 bg-white border border-gray-300 rounded px-3 py-2 text-gray-900"
                  />
                </div>
              </div>
              {price && (
                <div className="text-sm text-gray-500">
                  ${(parseFloat(price) / days).toFixed(0)}/day • ${(parseFloat(price) / travelers).toFixed(0)}/person
                </div>
              )}
              <button
                onClick={handleConfirm}
                disabled={!price}
                className="w-full py-2 bg-green-600 text-gray-900 rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
