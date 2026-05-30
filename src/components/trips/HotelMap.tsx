'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- react-leaflet components
   are held in state from a dynamic import for SSR safety (same pattern as
   DestinationMap.tsx); precise generic typing isn't practical across the async
   boundary. */

// ─── Single-hotel map (Travel-PR-22) ─────────────────────────────────────────
// Reuses the itinerary's Leaflet + CARTO setup (see DestinationMap.tsx): dynamic
// import of react-leaflet/leaflet for SSR safety, CARTO light tiles. Centers on
// the hotel's lat/lng with one marker. The detail page only mounts this when
// lat/lng are present, so there is no broken-embed case.

import { useEffect, useState } from 'react';

interface HotelMapProps {
  latitude: number;
  longitude: number;
  label: string;
  height?: string;
}

export default function HotelMap({ latitude, longitude, label, height = '280px' }: HotelMapProps) {
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [L, setL] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  if (!mounted || !MapContainer || !TileLayer || !Marker || !L) {
    return (
      <div className="bg-gray-100 rounded-lg flex items-center justify-center border border-border" style={{ height }}>
        <div className="text-gray-400 text-sm">Loading map…</div>
      </div>
    );
  }

  const icon = L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color:#7c3aed;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  });

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={14}
      className="rounded-lg z-0 border border-border"
      style={{ height }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <Marker position={[latitude, longitude]} icon={icon}>
        <Popup>
          <div className="text-sm font-medium">{label}</div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
