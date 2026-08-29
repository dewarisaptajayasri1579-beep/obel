/// Default dipakai HANYA saat Admin belum mengisi threshold untuk
/// Booth-produk tertentu (lihat BoothStockThreshold di schema.prisma).
/// Begitu Admin mengisi, angka Admin yang berlaku — ini bukan hardcode
/// yang dilarang AGENTS.md, melainkan fallback aman sebelum dikonfigurasi.
export const DEFAULT_MINIMUM_QTY = 25;
export const DEFAULT_CRITICAL_QTY = 10;

export type StockStatus = 'Aman' | 'Menipis' | 'Kritis' | 'Habis';

/// Sesuai BR-007 08-business-rules.md.
export function resolveStockStatus(qty: number, minimumQty: number, criticalQty: number): StockStatus {
  if (qty <= 0) return 'Habis';
  if (qty <= criticalQty) return 'Kritis';
  if (qty <= minimumQty) return 'Menipis';
  return 'Aman';
}
