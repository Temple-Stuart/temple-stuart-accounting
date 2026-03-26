'use client';

import { useEffect, useState } from 'react';

interface Destination {
  id: string;
  resortId: string;
  name?: string;
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
  height?: string;
}

export default function DestinationMap({ destinations, selectedName, onDestinationClick, height = '500px' }: DestinationMapProps) {
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [Polyline, setPolyline] = useState<any>(null);
  const [Tooltip, setTooltip] = useState<any>(null);
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
      setTooltip(() => mod.Tooltip);
    });
    import('leaflet').then((mod) => {
      setL(() => mod.default);
    });
  }, []);

  if (!mounted || !MapContainer || !TileLayer || !Marker || !Popup || !L) {
    return (
      <div className="bg-gray-100 rounded-lg flex items-center justify-center" style={{ height }}>
        <div className="text-gray-400 text-sm">Loading map...</div>
      </div>
    );
  }

  // Filter destinations that have coordinates
  const locationsWithCoords = destinations.filter(d =>
    d.resort?.latitude != null && d.resort?.longitude != null
  ).map(d => ({
    id: d.resortId,
    name: d.resort!.name,
    lat: typeof d.resort!.latitude === 'string' ? parseFloat(d.resort!.latitude) : Number(d.resort!.latitude),
    lng: typeof d.resort!.longitude === 'string' ? parseFloat(d.resort!.longitude) : Number(d.resort!.longitude),
  }));

  if (locationsWithCoords.length === 0) {
    return (
      <div className="bg-gray-100 rounded-lg flex items-center justify-center" style={{ height }}>
        <div className="text-center text-gray-400">
          <p className="text-sm">Add destinations to see them on the map</p>
        </div>
      </div>
    );
  }

  // Calculate initial center
  const centerLat = locationsWithCoords.reduce((sum, l) => sum + l.lat, 0) / locationsWithCoords.length;
  const centerLng = locationsWithCoords.reduce((sum, l) => sum + l.lng, 0) / locationsWithCoords.length;

  // Bounds for fitBounds
  const bounds: [number, number][] = locationsWithCoords.map(l => [l.lat, l.lng]);

  // Route polyline: connect destinations in order
  const routePositions: [number, number][] = locationsWithCoords.map(l => [l.lat, l.lng]);

  // Create marker icons
  const createIcon = (isSelected: boolean) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background-color: ${isSelected ? '#22c55e' : '#7c3aed'};
        width: ${isSelected ? '16px' : '12px'};
        height: ${isSelected ? '16px' : '12px'};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: isSelected ? [16, 16] : [12, 12],
      iconAnchor: isSelected ? [8, 8] : [6, 6],
      popupAnchor: [0, -8],
    });
  };

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={5}
      className="rounded-lg z-0"
      style={{ height }}
      worldCopyJump={false}
      maxBounds={[[-90, -180], [90, 180]]}
      maxBoundsViscosity={1.0}
      minZoom={2}
      whenReady={(e: any) => {
        const mapInstance = e.target;
        if (bounds.length > 0) {
          const leafletBounds = L.latLngBounds(bounds);
          mapInstance.fitBounds(leafletBounds, { padding: [50, 50], maxZoom: 10 });
        }
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        noWrap={true}
      />
      {/* Route lines connecting destinations in order */}
      {Polyline && routePositions.length > 1 && (
        <Polyline
          positions={routePositions}
          pathOptions={{ color: '#7c3aed', weight: 2, opacity: 0.5, dashArray: '6 4' }}
        />
      )}
      {locationsWithCoords.map((loc, idx) => (
        <Marker
          key={loc.id}
          position={[loc.lat, loc.lng]}
          icon={createIcon(loc.name === selectedName)}
          eventHandlers={{
            click: () => onDestinationClick?.(loc.id, loc.name),
          }}
        >
          {Tooltip && (
            <Tooltip direction="top" offset={[0, -8]} permanent className="map-city-label">
              <span className="text-[11px] font-medium text-gray-700">{loc.name}</span>
            </Tooltip>
          )}
          <Popup>
            <div className="text-sm font-medium">
              {loc.name === selectedName && <span className="text-green-500">● </span>}
              {loc.name}
              {idx < locationsWithCoords.length - 1 && (
                <span className="text-gray-400 text-xs block">Stop {idx + 1}</span>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
