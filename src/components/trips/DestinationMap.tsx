'use client';

import { useEffect, useState, useRef } from 'react';

interface Destination {
  id: string;
  resortId: string;
  resort?: {
    name: string;
    latitude?: string | number | null;
    longitude?: string | number | null;
  };
}

interface DestinationMapProps {
  destinations: Destination[];
  selectedName?: string | null;
  onDestinationClick?: (resortId: string, name: string) => void;
}

// Component to handle fitBounds after map loads
function FitBoundsHandler({ map, bounds, L }: { map: any; bounds: [number, number][]; L: any }) {
  useEffect(() => {
    if (map && bounds.length > 0 && L) {
      const leafletBounds = L.latLngBounds(bounds);
      map.fitBounds(leafletBounds, { padding: [30, 30], maxZoom: 10 });
    }
  }, [map, bounds, L]);
  return null;
}

export default function DestinationMap({ destinations, selectedName, onDestinationClick }: DestinationMapProps) {
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [useMapEvents, setUseMapEvents] = useState<any>(null);
  const [L, setL] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    import('react-leaflet').then((mod) => {
      setMapContainer(() => mod.MapContainer);
      setTileLayer(() => mod.TileLayer);
      setMarker(() => mod.Marker);
      setPopup(() => mod.Popup);
      setUseMapEvents(() => mod.useMapEvents);
    });
    import('leaflet').then((mod) => {
      setL(() => mod.default);
    });
  }, []);

  if (!mounted || !MapContainer || !TileLayer || !Marker || !Popup || !L) {
    return (
      <div className="h-48 bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-gray-400">Loading map...</div>
      </div>
    );
  }

  // Filter destinations that have coordinates
  const locationsWithCoords = destinations.filter(d => 
    d.resort?.latitude && d.resort?.longitude
  ).map(d => ({
    id: d.resortId,
    name: d.resort!.name,
    lat: typeof d.resort!.latitude === 'string' ? parseFloat(d.resort!.latitude) : Number(d.resort!.latitude),
    lng: typeof d.resort!.longitude === 'string' ? parseFloat(d.resort!.longitude) : Number(d.resort!.longitude),
  }));

  if (locationsWithCoords.length === 0) {
    return (
      <div className="h-48 bg-gray-100 rounded-xl flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="text-3xl mb-2">🗺️</div>
          <p className="text-sm">Add destinations to see them on the map</p>
        </div>
      </div>
    );
  }

  // Calculate initial center (will be overridden by fitBounds)
  const centerLat = locationsWithCoords.reduce((sum, l) => sum + l.lat, 0) / locationsWithCoords.length;
  const centerLng = locationsWithCoords.reduce((sum, l) => sum + l.lng, 0) / locationsWithCoords.length;

  // Bounds for fitBounds
  const bounds: [number, number][] = locationsWithCoords.map(l => [l.lat, l.lng]);

  // Create icons
  const createIcon = (isSelected: boolean) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background-color: ${isSelected ? '#22c55e' : '#b4b237'};
        width: ${isSelected ? '28px' : '20px'};
        height: ${isSelected ? '28px' : '20px'};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: all 0.2s;
      "></div>`,
      iconSize: isSelected ? [28, 28] : [20, 20],
      iconAnchor: isSelected ? [14, 14] : [10, 10],
      popupAnchor: [0, -10],
    });
  };

  // Map events handler component
  const MapController = () => {
    const mapInstance = useMapEvents({
      load: () => {}
    });
    
    useEffect(() => {
      if (mapInstance && bounds.length > 0) {
        const leafletBounds = L.latLngBounds(bounds);
        mapInstance.fitBounds(leafletBounds, { padding: [30, 30], maxZoom: 10 });
      }
    }, [mapInstance]);
    
    return null;
  };

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={5}
      className="h-48 rounded-xl z-0"
      style={{ height: '192px' }}
      whenReady={(e: any) => {
        const mapInstance = e.target;
        if (bounds.length > 0) {
          const leafletBounds = L.latLngBounds(bounds);
          mapInstance.fitBounds(leafletBounds, { padding: [30, 30], maxZoom: 10 });
        }
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locationsWithCoords.map(loc => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lng]}
          icon={createIcon(loc.name === selectedName)}
          eventHandlers={{
            click: () => onDestinationClick?.(loc.id, loc.name),
          }}
        >
          <Popup>
            <div className="text-sm font-medium">
              {loc.name === selectedName && <span className="text-green-600">✓ </span>}
              {loc.name}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
