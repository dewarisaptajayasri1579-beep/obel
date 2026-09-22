import { StockMovement, StockMovementType } from '@prisma/client';

/// Lokasi stok. `WAREHOUSE` = Gudang Pusat (Obbel baru punya satu gudang);
/// selain itu berisi Booth.id.
export const WAREHOUSE = 'WAREHOUSE' as const;
export type LokasiStok = typeof WAREHOUSE | (string & {});

export interface DampakMutasi {
  /// Perubahan saldo di lokasi yang diminta. Positif = masuk, negatif = keluar,
  /// 0 = mutasi ini tidak menyentuh lokasi tersebut.
  delta: number;
  /// true kalau arahnya tidak bisa dipastikan dari baris movement. Hanya terjadi
  /// pada baris LAMA yang ditulis sebelum arah dikodekan di referenceType
  /// (lihat warehouse-stock.service.ts & returns.service.ts). Baris seperti ini
  /// ditandai supaya UI bisa memberi peringatan alih-alih diam-diam menyajikan
  /// angka yang mungkin terbalik.
  perluVerifikasi: boolean;
}

const TIDAK_MENYENTUH: DampakMutasi = { delta: 0, perluVerifikasi: false };

/// Penyimpulan arah mutasi dari skema LAMA `stock_movements`, di mana `qty`
/// selalu positif dan arah harus disimpulkan dari kombinasi movementType +
/// fromBoothId/toBoothId + referenceType.
///
/// Sengaja diisolasi di satu file. Saat skema baru punya kolom `qty_change`
/// bertanda (docsV2/02-mutasi-stok.md), file ini dihapus utuh dan tidak ada
/// sisa logika penyimpulan yang tertinggal tersebar di service lain.
export function dampakMutasi(m: StockMovement, lokasi: LokasiStok): DampakMutasi {
  const diGudang = lokasi === WAREHOUSE;
  const qty = m.qty;

  switch (m.movementType) {
    // Gudang → Booth. Baris dengan toBoothId menyentuh dua sisi; baris tanpa
    // booth sama sekali (revisi distribusi) hanya menyentuh Gudang.
    case StockMovementType.WAREHOUSE_TO_BOOTH:
      if (diGudang) return { delta: -qty, perluVerifikasi: false };
      if (m.toBoothId === lokasi) return { delta: qty, perluVerifikasi: false };
      return TIDAK_MENYENTUH;

    // Selalu keluar dari booth asal. Tidak pernah menyentuh Gudang.
    case StockMovementType.SALE:
      if (!diGudang && m.fromBoothId === lokasi) return { delta: -qty, perluVerifikasi: false };
      return TIDAK_MENYENTUH;

    // Masuk ke Gudang. Pengurangan di sisi booth TIDAK punya baris movement
    // (stok booth dikurangi saat return diajukan, bukan saat diterima) — itu
    // celah di ledger lama yang baru tertutup di docsV2 dok 05.
    case StockMovementType.RETURN_TO_WAREHOUSE:
      if (diGudang) return { delta: qty, perluVerifikasi: false };
      return TIDAK_MENYENTUH;

    // Pembalikan. Booth ditandai lewat from/to; tanpa keduanya berarti Gudang,
    // dan pembalikan di Gudang selalu berarti stok kembali masuk.
    case StockMovementType.VOID_REVERSAL:
      if (m.toBoothId) return !diGudang && m.toBoothId === lokasi ? { delta: qty, perluVerifikasi: false } : TIDAK_MENYENTUH;
      if (m.fromBoothId) return !diGudang && m.fromBoothId === lokasi ? { delta: -qty, perluVerifikasi: false } : TIDAK_MENYENTUH;
      return diGudang ? { delta: qty, perluVerifikasi: false } : TIDAK_MENYENTUH;

    case StockMovementType.ADJUSTMENT:
      if (m.toBoothId) return !diGudang && m.toBoothId === lokasi ? { delta: qty, perluVerifikasi: false } : TIDAK_MENYENTUH;
      if (m.fromBoothId) return !diGudang && m.fromBoothId === lokasi ? { delta: -qty, perluVerifikasi: false } : TIDAK_MENYENTUH;
      return diGudang ? adjustmentGudang(m, qty) : TIDAK_MENYENTUH;

    // Saldo awal. Dulu tidak pernah dipakai; sekarang dipakai oleh backfill
    // rekonsiliasi (scripts/reconcile-stock.ts) untuk mencatat stok yang sudah
    // ada di saldo tapi tidak punya asal-usul di buku besar.
    case StockMovementType.OPENING:
      if (m.toBoothId) return !diGudang && m.toBoothId === lokasi ? { delta: qty, perluVerifikasi: false } : TIDAK_MENYENTUH;
      if (m.fromBoothId) return !diGudang && m.fromBoothId === lokasi ? { delta: -qty, perluVerifikasi: false } : TIDAK_MENYENTUH;
      return diGudang ? adjustmentGudang(m, qty) : TIDAK_MENYENTUH;

    // Tidak pernah ditulis kode mana pun (lihat docsV2/04-migrasi.md §1).
    case StockMovementType.RESTOCK:
    default:
      return TIDAK_MENYENTUH;
  }
}

/// Adjustment di Gudang tidak punya from/to booth untuk menandai arah, jadi
/// arahnya dibaca dari sufiks referenceType. Baris yang ditulis SEBELUM sufiks
/// itu ada terpaksa ditebak dari `note` — dan kalau note-nya pun sudah ditimpa
/// alasan bebas, baris itu ditandai perluVerifikasi.
function adjustmentGudang(m: StockMovement, qty: number): DampakMutasi {
  if (m.referenceType.endsWith('_in')) return { delta: qty, perluVerifikasi: false };
  if (m.referenceType.endsWith('_out')) return { delta: -qty, perluVerifikasi: false };

  const note = m.note?.toLowerCase() ?? '';
  if (note.includes('penambahan')) return { delta: qty, perluVerifikasi: false };
  if (note.includes('pengurangan')) return { delta: -qty, perluVerifikasi: false };

  // Ditebak sebagai penambahan karena itu kasus terbanyak (pengisian stok awal),
  // tapi ditandai supaya tidak dianggap angka pasti.
  return { delta: qty, perluVerifikasi: true };
}

/// Keterangan manusiawi per baris riwayat, diturunkan dari referenceType.
const KETERANGAN: Record<string, string> = {
  warehouse_stock_adjustment: 'Penyesuaian stok Gudang',
  warehouse_stock_adjustment_in: 'Penambahan stok Gudang',
  warehouse_stock_adjustment_out: 'Pengurangan stok Gudang',
  stock_distribution: 'Distribusi ke Booth',
  distribution_cancel: 'Pembatalan distribusi',
  distribution_revision: 'Revisi distribusi',
  distribution_receipt_correction: 'Koreksi penerimaan distribusi',
  sale: 'Penjualan',
  sale_void: 'Pembatalan penjualan',
  sale_revision: 'Revisi penjualan',
  sale_refund: 'Refund penjualan',
  stock_return: 'Pengembalian dari Booth',
  stock_return_submit: 'Pengembalian diajukan',
  return_cancel: 'Pembatalan pengembalian',
  return_revision: 'Revisi pengembalian',
  return_receipt_correction: 'Koreksi penerimaan pengembalian',
  return_receipt_correction_in: 'Koreksi penerimaan pengembalian',
  return_receipt_correction_out: 'Koreksi penerimaan pengembalian',
  opening_balance_backfill_in: 'Saldo awal (penyesuaian buku besar)',
  opening_balance_backfill_out: 'Saldo awal (penyesuaian buku besar)',
  stock_receipt_in: 'Tambah Stok Gudang',
  stock_receipt_reversal_out: 'Pembalikan Tambah Stok Gudang (revisi)',
  shift_closing: 'Selisih tutup shift',
  stock_opname: 'Stock opname',
  stock_adjustment: 'Adjustment stok',
  stock_adjustment_reversal: 'Pembatalan adjustment',
};

export function keteranganMutasi(m: StockMovement): string {
  return KETERANGAN[m.referenceType] ?? m.referenceType.replace(/_/g, ' ');
}
