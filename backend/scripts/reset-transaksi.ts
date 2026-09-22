/// Reset seluruh transaksi & histori — DIPERTAHANKAN: Product, ProductCategory,
/// Booth, Profile (user), ShiftTemplate, BoothStockThreshold.
///
/// Dijalankan sekali atas permintaan eksplisit pemilik data untuk memulai ulang
/// dari nol. TIDAK dipasang sebagai npm script permanen — sengaja dijalankan
/// manual (`npx ts-node scripts/reset-transaksi.ts`) supaya tidak pernah
/// terpicu tidak sengaja lewat automation.
///
/// Urutan penghapusan mengikuti dependensi foreign key: anak sebelum induk.
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      await tx.saleRefundItem.deleteMany();
      await tx.saleRefund.deleteMany();
      await tx.payment.deleteMany();
      await tx.saleItem.deleteMany();
      await tx.sale.deleteMany();

      await tx.restockRequestItem.deleteMany();
      await tx.restockRequest.deleteMany(); // referensi ke StockDistribution, hapus dulu
      await tx.stockDistributionItem.deleteMany();
      await tx.stockDistribution.deleteMany();

      await tx.stockReturnItem.deleteMany();
      await tx.stockReturn.deleteMany();

      await tx.shiftStockCountItem.deleteMany();
      await tx.shiftStockCount.deleteMany();

      await tx.stockOpnameItem.deleteMany();
      await tx.stockOpname.deleteMany();

      await tx.transactionCorrection.deleteMany();
      await tx.reconciliationCase.deleteMany();

      await tx.stockMovement.deleteMany();
      await tx.shiftSession.deleteMany();

      // Saldo direset ke 0, barisnya TETAP ADA (bukan dihapus) — produk yang
      // sudah pernah dikonfigurasi stoknya tidak perlu dibuat ulang barisnya.
      await tx.warehouseStock.updateMany({ data: { qtyOnHand: 0 } });
      await tx.boothStock.updateMany({ data: { qtyOnHand: 0 } });
    },
    { timeout: 30_000 },
  );

  const sisa = {
    Product: await prisma.product.count(),
    ProductCategory: await prisma.productCategory.count(),
    Booth: await prisma.booth.count(),
    Profile: await prisma.profile.count(),
    ShiftTemplate: await prisma.shiftTemplate.count(),
    BoothStockThreshold: await prisma.boothStockThreshold.count(),
    Sale: await prisma.sale.count(),
    StockMovement: await prisma.stockMovement.count(),
    ShiftSession: await prisma.shiftSession.count(),
    StockDistribution: await prisma.stockDistribution.count(),
    RestockRequest: await prisma.restockRequest.count(),
    StockReturn: await prisma.stockReturn.count(),
    StockOpname: await prisma.stockOpname.count(),
    TransactionCorrection: await prisma.transactionCorrection.count(),
    ReconciliationCase: await prisma.reconciliationCase.count(),
  };

  console.log('Selesai. Sisa baris per tabel:');
  console.table(sisa);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
