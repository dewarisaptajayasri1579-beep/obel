import type { BoothAktifCard } from "@/lib/api-client";

/// Kategori warna kartu/marker — 4 kelompok sesuai legenda, BUKAN sama persis
/// dengan 4 level stockStatus dari backend (Aman/Menipis/Kritis/Habis):
/// Menipis pada Booth aktif tetap dianggap "Normal" (hijau) di level
/// kartu/peta, supaya legenda tidak perlu kelompok ke-5. Badge status stok
/// yang lebih rinci tetap dipakai di panel detail. Dipakai bersama oleh tab
/// Card (page.tsx) dan tab Map (BoothMapView.tsx) supaya warnanya konsisten.
export type KategoriKartu = "normal" | "kritis" | "habis" | "nonaktif";

export function kategoriBooth(b: BoothAktifCard): KategoriKartu {
  if (!b.isActive) return "nonaktif";
  if (b.stockStatus === "Habis") return "habis";
  if (b.stockStatus === "Kritis") return "kritis";
  return "normal";
}
