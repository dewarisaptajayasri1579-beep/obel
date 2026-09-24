"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, CircleMarker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { BoothAktifCard, ShiftJourney } from "@/lib/api-client";
import { kategoriBooth, type KategoriKartu } from "./kategori";

function formatRupiah(n: number): string {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export type SumberLokasi = "booth" | "realtime";

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

/// Menit sejak `lastLocationAt` — dipakai buat label kesegaran ping di
/// tooltip mode Realtime, supaya Admin tahu titik itu masih relevan atau
/// sudah basi (mis. petugas sudah lama tidak dapat sinyal GPS/internet).
function menitSejak(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function jamJakarta(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

export function BoothMapView({
  booths,
  selectedId,
  onSelect,
  sumberLokasi,
  journey,
}: {
  booths: BoothAktifCard[];
  selectedId: string | null;
  onSelect: (boothId: string) => void;
  sumberLokasi: SumberLokasi;
  /** Jalur perjalanan booth yang sedang disorot (`selectedId`) — cuma diminta
   *  parent saat mode Realtime & ada booth terpilih. `undefined` = belum ada
   *  yang disorot, `null` = lagi dimuat / gagal dimuat. */
  journey?: ShiftJourney | null;
}) {
  const dengankoordinat = useMemo(() => {
    if (sumberLokasi === "realtime") {
      return booths.filter(
        (b): b is BoothAktifCard & { lastLocationLatitude: number; lastLocationLongitude: number } =>
          b.lastLocationLatitude !== null && b.lastLocationLongitude !== null,
      );
    }
    return booths.filter(
      (b): b is BoothAktifCard & { latitude: number; longitude: number } => b.latitude !== null && b.longitude !== null,
    );
  }, [booths, sumberLokasi]);

  const koordinatOf = (b: BoothAktifCard): [number, number] =>
    sumberLokasi === "realtime"
      ? [b.lastLocationLatitude as number, b.lastLocationLongitude as number]
      : [b.latitude as number, b.longitude as number];

  /// Garis jalur (path ping GPS) + titik jual, urutan kronologis dari
  /// checkInLatitude/Longitude (kalau ada) lalu tiap ping — supaya garis
  /// selalu mulai dari titik Check-In, bukan ping pertama yang belum tentu
  /// persis di lokasi Check-In.
  const jalurPoints = useMemo<[number, number][]>(() => {
    if (!journey) return [];
    const awal: [number, number][] =
      journey.checkInLatitude !== null && journey.checkInLongitude !== null
        ? [[journey.checkInLatitude, journey.checkInLongitude]]
        : [];
    return [...awal, ...journey.path.map((p): [number, number] => [p.latitude, p.longitude])];
  }, [journey]);

  const pusat = useMemo<[number, number]>(() => {
    if (dengankoordinat.length === 0) return PUSAT_FALLBACK;
    const koords = dengankoordinat.map(koordinatOf);
    const lat = koords.reduce((s, [la]) => s + la, 0) / koords.length;
    const lng = koords.reduce((s, [, lo]) => s + lo, 0) / koords.length;
    return [lat, lng];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dengankoordinat, sumberLokasi]);

  /// Reference points HARUS stabil selama isi datanya sama, karena FitBounds
  /// men-trigger ulang map.fitBounds/setView tiap kali `points` berubah
  /// reference. Tanpa useMemo di sini, klik marker (yang cuma mengubah state
  /// `selectedId` di parent) ikut membuat array baru tiap render dan peta
  /// zoom ulang ke bounds — membatalkan zoom-out manual user.
  ///
  /// Begitu ada jalur (booth sedang disorot), fit ke jalur itu SAJA — supaya
  /// Admin lihat keseluruhan rute booth yang dipilih, bukan tetap zoom-out
  /// ke semua booth lain yang sudah diredupkan.
  const points = useMemo<[number, number][]>(() => {
    if (jalurPoints.length > 0) return jalurPoints;
    return dengankoordinat.map(koordinatOf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dengankoordinat, sumberLokasi, jalurPoints]);

  const labelKosong =
    sumberLokasi === "realtime"
      ? "Booth belum ada ping lokasi realtime (petugas belum check-in / belum kirim GPS), tidak tampil di peta."
      : "Booth belum punya titik lokasi, tidak tampil di peta.";

  return (
    <div className="flex-1 min-w-0 rounded-2xl overflow-hidden border border-slate-200/90 dark:border-line" style={{ height: 560 }}>
      <MapContainer center={pusat} zoom={15} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />
        {jalurPoints.length > 1 && (
          <Polyline positions={jalurPoints} pathOptions={{ color: "#0B5D34", weight: 3, opacity: 0.8 }} />
        )}
        {journey?.sales.map((sale) => (
          <CircleMarker
            key={sale.saleId}
            center={[sale.latitude, sale.longitude]}
            radius={7}
            pathOptions={{ color: "#E57C23", fillColor: "#E57C23", fillOpacity: 0.9, weight: 2 }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {jamJakarta(sale.capturedAt)} · {sale.qty} cup · {formatRupiah(sale.total)}
            </Tooltip>
          </CircleMarker>
        ))}
        {dengankoordinat.map((booth) => (
          <Marker
            key={booth.boothId}
            position={koordinatOf(booth)}
            icon={buatIkon(kategoriBooth(booth))}
            eventHandlers={{ click: () => onSelect(booth.boothId) }}
            opacity={selectedId && selectedId !== booth.boothId ? 0.35 : 1}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              {booth.boothCode} · {booth.staffName ?? "Tidak ada petugas"}
              {sumberLokasi === "realtime" && booth.lastLocationAt && (
                <> · {menitSejak(booth.lastLocationAt)} menit lalu</>
              )}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      {booths.length > dengankoordinat.length && (
        <p className="text-[11px] text-slate-400 dark:text-fg-disabled px-3 py-1.5 bg-white/90 dark:bg-surface border-t border-slate-200/90 dark:border-line">
          {booths.length - dengankoordinat.length} {labelKosong}
        </p>
      )}
    </div>
  );
}
