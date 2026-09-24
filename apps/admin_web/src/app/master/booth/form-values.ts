import type { Booth } from "@/lib/api-client";

export interface BoothFormValues {
  id: string;
  code: string;
  name: string;
  locationName: string;
  address: string;
  latitude: string;
  longitude: string;
  qrisImageUrl: string;
  isActive: boolean;
}

/// Angka terakhir dalam sebuah teks kode/nama Booth (mis. "BOOTH-016" → 16),
/// 0 kalau tidak ada angka sama sekali.
export function nomorDariKode(teks: string): number {
  return parseInt(teks.match(/(\d+)(?!.*\d)/)?.[1] ?? "0", 10);
}

/// Nomor urut Booth berikutnya (angka terbesar dari kode Booth yang sudah
/// ada + 1) — dipakai supaya Kode & Nama Booth baru langsung terisi lanjut
/// urutan, bukan diketik manual bebas (sumber kode tidak konsisten seperti
/// "BOOTH-PG03200" / "BOOTH-TEST75807" di data lama).
export function nomorBoothBerikutnya(booths: Booth[]): number {
  return booths.reduce((max, b) => Math.max(max, nomorDariKode(b.code)), 0) + 1;
}

export function nilaiAwalBooth(nomorUrut?: number): BoothFormValues {
  return {
    id: "",
    code: nomorUrut ? `BOOTH-${String(nomorUrut).padStart(2, "0")}` : "",
    name: nomorUrut ? `BOOTH ${String(nomorUrut).padStart(3, "0")}` : "",
    locationName: "",
    address: "",
    latitude: "",
    longitude: "",
    qrisImageUrl: "",
    isActive: true,
  };
}

export function keFormValues(b: Booth): BoothFormValues {
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    locationName: b.locationName ?? "",
    address: b.address ?? "",
    latitude: b.latitude === null ? "" : String(b.latitude),
    longitude: b.longitude === null ? "" : String(b.longitude),
    qrisImageUrl: b.qrisImageUrl ?? "",
    isActive: b.status === "ACTIVE",
  };
}
