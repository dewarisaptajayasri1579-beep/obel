"use client";

import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";

const IKON = L.divIcon({
  html: `<div class="relative w-6 h-6 flex items-center justify-center">
    <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[var(--brand-700)] border-2 border-white shadow-md"></span>
  </div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export function AbsenMiniMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <div className="h-36 rounded-xl overflow-hidden border border-slate-200 dark:border-line">
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        minZoom={14}
        maxZoom={19}
        scrollWheelZoom
        dragging
        doubleClickZoom
        zoomControl
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" minZoom={14} maxZoom={19} />
        <Marker position={[latitude, longitude]} icon={IKON} />
      </MapContainer>
    </div>
  );
}
