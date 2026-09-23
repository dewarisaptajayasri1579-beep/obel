"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { BoothAktifCard } from "@/lib/api-client";
import { kategoriBooth, type KategoriKartu } from "./kategori";

/// Ikon custom lewat DivIcon (bukan marker default Leaflet) — dua alasan:
/// (1) marker default Leaflet butuh file gambar yang path-nya sering patah di
/// bundler Next.js/webpack, DivIcon murni HTML+CSS jadi tidak punya masalah
/// itu; (2) supaya warna & animasinya bisa pakai kelas Tailwind yang sama
/// dengan kartu di tab Card (konsisten satu bahasa visual).
function buatIkon(kategori: KategoriKartu): L.DivIcon {
  const warna: Record<KategoriKartu, string> = {
    normal: "bg-emerald-500",
    kritis: "bg-amber-500",
    habis: "bg-rose-500",
    nonaktif: "bg-slate-400",
  };
  const cincin: Record<KategoriKartu, string> = {
    normal: "",
    kritis: "bg-amber-400",
    habis: "bg-rose-400",
    nonaktif: "",
  };
  const adaPing = kategori === "kritis" || kategori === "habis";

  return L.divIcon({
    html: `
      <div class="relative w-7 h-7 flex items-center justify-center">
        ${adaPing ? `<span class="absolute inline-flex h-full w-full rounded-full ${cincin[kategori]} opacity-60 animate-ping"></span>` : ""}
        <span class="relative inline-flex rounded-full h-4 w-4 ${warna[kategori]} border-2 border-white shadow-md"></span>
      </div>
    `,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const PUSAT_FALLBACK: [number, number] = [-7.5361, 110.6021]; // Boyolali

/// Zoom tetap ({zoom=15}) bikin titik yang jauh dari rata-rata koordinat
/// terpotong keluar layar. Komponen ini menyesuaikan `fitBounds` tiap kali
/// daftar titik berubah, supaya SEMUA marker selalu masuk area yang
/// terlihat — baik saat baru dibuka maupun saat datanya live-update.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
  }, [points, map]);

  return null;
}

export function BoothMapView({
  booths,
  selectedId,
  onSelect,
}: {
  booths: BoothAktifCard[];
  selectedId: string | null;
  onSelect: (boothId: string) => void;
}) {
  const dengankoordinat = useMemo(
    () => booths.filter((b): b is BoothAktifCard & { latitude: number; longitude: number } => b.latitude !== null && b.longitude !== null),
    [booths],
  );

  const pusat = useMemo<[number, number]>(() => {
    if (dengankoordinat.length === 0) return PUSAT_FALLBACK;
    const lat = dengankoordinat.reduce((s, b) => s + b.latitude, 0) / dengankoordinat.length;
    const lng = dengankoordinat.reduce((s, b) => s + b.longitude, 0) / dengankoordinat.length;
    return [lat, lng];
  }, [dengankoordinat]);

  return (
    <div className="flex-1 min-w-0 rounded-2xl overflow-hidden border border-slate-200/90 dark:border-line" style={{ height: 560 }}>
      <MapContainer center={pusat} zoom={15} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={dengankoordinat.map((b): [number, number] => [b.latitude, b.longitude])} />
        {dengankoordinat.map((booth) => (
          <Marker
            key={booth.boothId}
            position={[booth.latitude, booth.longitude]}
            icon={buatIkon(kategoriBooth(booth))}
            eventHandlers={{ click: () => onSelect(booth.boothId) }}
            opacity={selectedId && selectedId !== booth.boothId ? 0.55 : 1}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              {booth.boothCode} · {booth.staffName ?? "Tidak ada petugas"}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      {booths.length > dengankoordinat.length && (
        <p className="text-[11px] text-slate-400 dark:text-fg-disabled px-3 py-1.5 bg-white/90 dark:bg-surface border-t border-slate-200/90 dark:border-line">
          {booths.length - dengankoordinat.length} Booth belum punya titik lokasi, tidak tampil di peta.
        </p>
      )}
    </div>
  );
}
