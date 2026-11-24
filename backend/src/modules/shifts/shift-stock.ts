import { Prisma, PrismaClient, ShiftStatus, StockMovementType } from '@prisma/client';
import { dampakMutasi } from '../stock-movements/arah.util';

type Db = PrismaClient | Prisma.TransactionClient;

/// Stok yang dipegang satu shift di booth-nya, diturunkan dari buku besar: semua movement
/// ber-shiftSessionId shift ini (terima kiriman, jual, void/revisi/refund, retur, pindah booth)
/// ditambah Koreksi Penerimaan Admin atas kiriman yang diterima shift ini (movement Admin tidak
/// ber-shiftSessionId, lihat getShiftReport). Stok masih disimpan per booth (BoothStock), jadi
/// ini satu-satunya cara memisahkan stok dua shift yang OPEN bersamaan di booth yang sama.
export async function stokMilikShift(db: Db, shift: { id: string; boothId: string }): Promise<Map<string, number>> {
  const movements = await db.stockMovement.findMany({ where: { shiftSessionId: shift.id } });
  const kirimanDiterima = [
    ...new Set(
      movements
        .filter((m) => m.movementType === StockMovementType.WAREHOUSE_TO_BOOTH && m.toBoothId === shift.boothId && m.referenceId)
        .map((m) => m.referenceId as string),
    ),
  ];
  const koreksi =
    kirimanDiterima.length === 0
      ? []
      : await db.stockMovement.findMany({
          where: { referenceType: 'distribution_receipt_correction', referenceId: { in: kirimanDiterima } },
        });

  const qty = new Map<string, number>();
  for (const m of [...movements, ...koreksi]) {
    const { delta } = dampakMutasi(m, shift.boothId);
    if (delta !== 0) qty.set(m.productId, (qty.get(m.productId) ?? 0) + delta);
  }
  return qty;
}

/// Stok booth yang menjadi tanggung jawab shift ini saat Check-Out: BoothStock dikurangi stok
/// milik shift LAIN yang masih OPEN di booth yang sama (mis. Barista Shift 2 sudah menerima
/// stoknya sebelum Shift 1 Check-Out). Stok tanpa pemilik (mis. retur yang dibatalkan setelah
/// shift lama ditutup) tetap ikut shift ini, sama seperti sebelumnya.
///
/// Dua batas bawah 0 disengaja: Kasir masih menjual dari stok booth bersama, jadi shift lain bisa
/// "minus" (menjual stok shift ini) dan angka akhir bisa di bawah 0 kalau proyeksi drift. Dalam
/// kedua kasus Check-Out tidak boleh terblokir; selisihnya tetap terlihat di rekonsiliasi.
export async function stokUntukCheckOut(
  db: Db,
  shift: { id: string; boothId: string },
): Promise<{ productId: string; qtyOnHand: number }[]> {
  const [boothStocks, shiftLain] = await Promise.all([
    db.boothStock.findMany({ where: { boothId: shift.boothId } }),
    db.shiftSession.findMany({
      where: { boothId: shift.boothId, status: { in: [ShiftStatus.OPEN, ShiftStatus.CLOSING] }, id: { not: shift.id } },
      select: { id: true, boothId: true },
    }),
  ]);

  const milikLain = new Map<string, number>();
  for (const lain of shiftLain) {
    for (const [productId, qty] of await stokMilikShift(db, lain)) {
      if (qty > 0) milikLain.set(productId, (milikLain.get(productId) ?? 0) + qty);
    }
  }

  return boothStocks.map((s) => ({
    productId: s.productId,
    qtyOnHand: Math.max(0, s.qtyOnHand - (milikLain.get(s.productId) ?? 0)),
  }));
}
