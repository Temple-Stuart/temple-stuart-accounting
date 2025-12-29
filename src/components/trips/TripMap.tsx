'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

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

const ACTIVITY_COLORS: Record<string, string> = {
  surf: '#3b82f6',
  kitesurf: '#06b6d4',
  sail: '#6366f1',
  snowboard: '#a855f7',
  ski: '#8b5cf6',
  scuba: '#14b8a6',
  mtb: '#f97316',
  climbing: '#ef4444',
  hiking: '#22c55e',
  fishing: '#10b981',
  golf: '#84cc16',
  roadcycle: '#eab308',
  moto: '#f43f5e',
  hike: '#16a34a',
  climb: '#dc2626',
  bike: '#ea580c',
  run: '#ec4899',
  triathlon: '#2563eb',
  skate: '#9333ea',
  festival: '#d946ef',
  conference: '#6b7280',
  nomad: '#f59e0b',
};

function TripMapInner({ trips, onTripClick }: TripMapProps) {
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    // Dynamic import of Leaflet components
    import('react-leaflet').then((mod) => {
      setMapContainer(() => mod.MapContainer);
      setTileLayer(() => mod.TileLayer);
      setMarker(() => mod.Marker);
      setPopup(() => mod.Popup);
    });
    import('leaflet').then((mod) => {
      setL(() => mod.default);
    });
  }, []);

  if (!MapContainer || !TileLayer || !Marker || !Popup || !L) {
    return (
      <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-gray-400">Loading map...</div>
      </div>
    );
  }

  const tripsWithCoords = trips.filter(t => t.latitude && t.longitude);

  if (tripsWithCoords.length === 0) {
    return (
      <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">🗺️</div>
          <p>No trip locations to display</p>
          <p className="text-sm">Commit trips to see them on the map</p>
        </div>
      </div>
    );
  }

  // Calculate center and bounds
  const lats = tripsWithCoords.map(t => parseFloat(t.latitude!));
  const lngs = tripsWithCoords.map(t => parseFloat(t.longitude!));
  const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
  const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

  // Create custom icon
  const createIcon = (color: string) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
  };

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={tripsWithCoords.length === 1 ? 6 : 3}
      className="h-64 rounded-xl z-0"
      style={{ height: '256px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {tripsWithCoords.map(trip => (
        <Marker
          key={trip.id}
          position={[parseFloat(trip.latitude!), parseFloat(trip.longitude!)]}
          icon={createIcon(ACTIVITY_COLORS[trip.activity || ''] || '#b4b237')}
          eventHandlers={{
            click: () => onTripClick?.(trip.id),
          }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-bold">{trip.name}</div>
              <div className="text-gray-500">{trip.destination}</div>
              {trip.startDate && (
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate!).toLocaleDateString()}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

// Export with no SSR
export default function TripMap(props: TripMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-64 bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-gray-400">Loading map...</div>
      </div>
    );
  }

  return <TripMapInner {...props} />;
}
