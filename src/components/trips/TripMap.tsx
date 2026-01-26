'use client';

import { useEffect, useState } from 'react';

interface Trip {
  id: string;
  name: string;
  destination: string | null;
  activity: string | null;
  latitude: string | null;
  longitude: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface TripMapProps {
  trips: Trip[];
  onTripClick?: (tripId: string) => void;
}

export default function TripMap({ trips, onTripClick }: TripMapProps) {
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [Polyline, setPolyline] = useState<any>(null);
  const [L, setL] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    import('react-leaflet').then((mod) => {
      setMapContainer(() => mod.MapContainer);
      setTileLayer(() => mod.TileLayer);
      setMarker(() => mod.Marker);
      setPopup(() => mod.Popup);
      setPolyline(() => mod.Polyline);
    });
    import('leaflet').then((mod) => {
      setL(() => mod.default);
    });
  }, []);

  if (!mounted || !MapContainer || !TileLayer || !Marker || !Popup || !Polyline || !L) {
    return (
      <div className="aspect-[2/1] w-full bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-gray-400">Loading map...</div>
      </div>
    );
  }

  // Filter trips with coordinates and sort by start date
  const tripsWithCoords = trips
    .filter(t => t.latitude && t.longitude)
    .sort((a, b) => {
      if (!a.startDate || !b.startDate) return 0;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

  if (tripsWithCoords.length === 0) {
    return (
      <div className="aspect-[2/1] w-full bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">🗺️</div>
          <p>No trip locations to display</p>
          <p className="text-sm">Commit trips to see them on the map</p>
        </div>
      </div>
    );
  }

  // Calculate center
  const lats = tripsWithCoords.map(t => parseFloat(t.latitude!));
  const lngs = tripsWithCoords.map(t => parseFloat(t.longitude!));
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  // Bounds for fitBounds
  const bounds: [number, number][] = tripsWithCoords.map(t => [
    parseFloat(t.latitude!), 
    parseFloat(t.longitude!)
  ]);

  // Create polyline coordinates (connecting lines)
  const polylinePositions: [number, number][] = tripsWithCoords.map(t => [
    parseFloat(t.latitude!),
    parseFloat(t.longitude!)
  ]);

  // Create numbered marker icon
  const createNumberedIcon = (number: number) => {
    return L.divIcon({
      className: 'custom-numbered-marker',
      html: `<div style="
        background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
      ">${number}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  };

  return (
    <div className="aspect-[2/1] w-full">
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={4}
        className="w-full h-full rounded-xl z-0"
        style={{ aspectRatio: '1/1' }}
        whenReady={(e: any) => {
          const mapInstance = e.target;
          if (bounds.length > 0) {
            const leafletBounds = L.latLngBounds(bounds);
            mapInstance.fitBounds(leafletBounds, { padding: [50, 50], maxZoom: 6 });
          }
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Connecting lines */}
        {polylinePositions.length > 1 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: '#7c3aed',
              weight: 3,
              opacity: 0.7,
              dashArray: '10, 10',
            }}
          />
        )}
        
        {/* Numbered markers */}
        {tripsWithCoords.map((trip, index) => (
          <Marker
            key={trip.id}
            position={[parseFloat(trip.latitude!), parseFloat(trip.longitude!)]}
            icon={createNumberedIcon(index + 1)}
            eventHandlers={{
              click: () => onTripClick?.(trip.id),
            }}
          >
            <Popup>
              <div className="text-sm min-w-[150px]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center font-bold">
                    {index + 1}
                  </span>
                  <span className="font-bold">{trip.destination || trip.name}</span>
                </div>
                {trip.startDate && (
                  <div className="text-xs text-gray-500">
                    {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {trip.endDate && ` - ${new Date(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
