'use client';

import { useState } from 'react';

interface HotelOption {
  hotelId: string;
  name: string;
  rating: string | null;
  cityName: string;
  totalPrice: number;
  currency: string;
  perNight: number;
  perPersonPerNight: number;
  nights: number;
  roomDescription: string;
  bedType: string;
  beds: number;
}

interface Props {
  destinationName: string;
  resortId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  rooms: number;
  bedsNeeded: number;
  selectedHotel: HotelOption | null;
  onSelectHotel: (hotel: HotelOption) => void;
}

export default function HotelPicker({
  destinationName,
  resortId,
  checkInDate,
  checkOutDate,
  adults,
  rooms,
  bedsNeeded,
  selectedHotel,
  onSelectHotel,
}: Props) {
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [searched, setSearched] = useState(false);
  
  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  // Calculate nights
  const nights = Math.ceil(
    (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const fetchHotels = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(
        `/api/travel/hotels?resortId=${resortId}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&adults=${adults}&rooms=${rooms}&radius=30`
      );
      
      if (!res.ok) {
        throw new Error('Failed to fetch hotels');
      }
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      }
      
      setHotels(data.hotels || []);
      setSearched(true);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch hotels');
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualName || !manualPrice) return;
    
    const totalPrice = parseFloat(manualPrice);
    const manualHotel: HotelOption = {
      hotelId: `manual-${Date.now()}`,
      name: manualName,
      rating: null,
      cityName: destinationName,
      totalPrice,
      currency: 'USD',
      perNight: totalPrice / nights,
      perPersonPerNight: totalPrice / nights / adults,
      nights,
      roomDescription: 'Manual entry',
      bedType: '',
      beds: bedsNeeded,
    };
    
    onSelectHotel(manualHotel);
    setExpanded(false);
  };

  const renderStars = (rating: string | null) => {
    if (!rating) return null;
    const stars = parseInt(rating);
    return '⭐'.repeat(Math.min(stars, 5));
  };

  return (
    <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-100 flex justify-between items-center"
        onClick={() => hotels.length > 0 || searched ? setExpanded(!expanded) : fetchHotels()}
      >
        <div>
          <div className="font-medium">{destinationName}</div>
          <div className="text-sm text-gray-500">
            {checkInDate} to {checkOutDate} • {bedsNeeded} beds needed • {nights} nights
          </div>
        </div>
        
        {selectedHotel ? (
          <div className="text-right">
            <div className="text-green-400 font-bold">${selectedHotel.totalPrice.toFixed(0)}</div>
            <div className="text-xs text-gray-500">{selectedHotel.name}</div>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); fetchHotels(); }}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-gray-900 rounded text-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? '⏳ Loading...' : '🔍 Search Hotels'}
          </button>
        )}
      </div>

      {/* Selected Hotel Summary */}
      {selectedHotel && !expanded && (
        <div className="px-4 pb-3 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm pt-2">
            <div>
              <span className="text-gray-600">{selectedHotel.name}</span>
              <span className="ml-2 text-gray-400">
                ${selectedHotel.perNight.toFixed(0)}/night • ${(selectedHotel.totalPrice / adults).toFixed(0)}/person
              </span>
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

      {/* Hotel Options List */}
      {expanded && (
        <div className="border-t border-gray-200 max-h-[500px] overflow-y-auto">
          {error && (
            <div className="p-4 text-red-400 text-sm">{error}</div>
          )}
          
          {/* Manual Entry Section - Always show */}
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="text-sm text-gray-500 mb-3">
              {hotels.length === 0 && searched 
                ? "No hotels found via API. Enter lodging details manually:"
                : "Or enter lodging manually:"}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Hotel/Airbnb name"
                className="bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 text-sm"
              />
              <div className="flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <input
                  type="number"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder={`Total for ${nights} nights`}
                  className="flex-1 bg-gray-100 border border-gray-300 rounded px-3 py-2 text-gray-900 text-sm"
                />
              </div>
              <button
                onClick={handleManualSubmit}
                disabled={!manualName || !manualPrice}
                className="bg-green-600 text-gray-900 rounded px-4 py-2 text-sm hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Use This
              </button>
            </div>
            {manualPrice && (
              <div className="text-xs text-gray-400 mt-2">
                ${(parseFloat(manualPrice) / nights).toFixed(0)}/night • ${(parseFloat(manualPrice) / adults).toFixed(0)}/person
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-gray-400">Search on:</span>
              <a href="https://www.airbnb.com" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Airbnb ↗</a>
              <a href="https://www.vrbo.com" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">VRBO ↗</a>
              <a href="https://www.booking.com" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Booking.com ↗</a>
              <a href="https://www.expedia.com" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300">Expedia ↗</a>
            </div>
          </div>

          {/* API Results */}
          {hotels.length > 0 && (
            <div className="text-xs text-gray-400 px-4 py-2 bg-gray-50">
              {hotels.length} hotels from Amadeus API (test data):
            </div>
          )}
          
          {hotels.map((hotel) => (
            <div
              key={hotel.hotelId}
              onClick={() => {
                onSelectHotel(hotel);
                setExpanded(false);
              }}
              className={`p-4 border-b border-gray-200 last:border-b-0 cursor-pointer transition-colors ${
                selectedHotel?.hotelId === hotel.hotelId 
                  ? 'bg-blue-600/20 border-l-2 border-l-blue-500' 
                  : 'hover:bg-gray-200/50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{hotel.name}</div>
                  <div className="text-sm text-gray-500">
                    {hotel.cityName}
                    {hotel.rating && <span className="ml-2">{renderStars(hotel.rating)}</span>}
                  </div>
                  {hotel.roomDescription && (
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {hotel.roomDescription}
                    </div>
                  )}
                  {hotel.beds > 0 ? (
                    <div className={`text-xs mt-1 ${hotel.beds >= bedsNeeded ? 'text-green-400' : 'text-yellow-400'}`}>
                      🛏️ {hotel.beds} {hotel.bedType || 'bed(s)'} {hotel.beds >= bedsNeeded ? '✓' : `(need ${bedsNeeded})`}
                    </div>
                  ) : null}
                </div>
                <div className="ml-4 text-right">
                  <div className="text-xl font-bold text-green-400">${hotel.totalPrice.toFixed(0)}</div>
                  <div className="text-xs text-gray-500">total ({hotel.nights} nights)</div>
                  <div className="text-xs text-gray-400">${hotel.perNight.toFixed(0)}/night</div>
                  <div className="text-xs text-blue-400">${(hotel.totalPrice / adults).toFixed(0)}/person</div>
                </div>
              </div>
            </div>
          ))}

          {hotels.length > 0 && (
            <div className="p-3 bg-white text-xs text-gray-400 text-center">
              ⚠️ Test data from Amadeus API — prices may not reflect actual rates
            </div>
          )}
        </div>
      )}
    </div>
  );
}
