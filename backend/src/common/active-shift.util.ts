import type { Prisma } from '@prisma/client';

/// Cari ShiftSession OPEN milik satu Petugas di satu Booth, dipakai untuk
/// menandai `StockMovement.shiftSessionId` saat Petugas melakukan aksi non-sale
/// di Booth (terima distribusi, adjustment, return) — lihat
/// docs/obbel-coffee-ai-docs/26-monitoring-realtime.md soal kebutuhan analisa
/// per-shift. `SALE` sudah mengisi ini lewat shift yang dipakai checkout
/// (sales.service.ts); helper ini menutup jenis movement lain yang sebelumnya
/// tidak pernah menandai shift-nya sama sekali.
///
/// Sengaja SELALU boleh null (Petugas tanpa shift OPEN, atau Admin yang
/// bertindak atas nama Booth) — shiftSessionId di StockMovement memang
/// nullable, dan aksi ini tidak boleh gagal cuma karena atribusi shift tidak
/// bisa ditentukan.
export async function cariShiftTerbukaBoothStaff(
  tx: Prisma.TransactionClient,
  boothId: string,
  staffId: string,
): Promise<string | null> {
  const shift = await tx.shiftSession.findFirst({
    where: { boothId, staffId, status: 'OPEN' },
    select: { id: true },
    orderBy: { openedAt: 'desc' },
  });
  return shift?.id ?? null;
}
