import { Injectable } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { nomorMovementBerikutnya } from '../../common/doc-no';
import { AdjustWarehouseStockDto } from './dto/adjust-warehouse-stock.dto';

@Injectable()
export class WarehouseStockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const products = await this.prisma.product.findMany({
      where: { active: true },
      include: { warehouseStock: true },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => ({
      productId: p.id,
      sku: p.sku,
      name: p.name,
      qtyOnHand: p.warehouseStock?.qtyOnHand ?? 0,
    }));
  }

  /// Adjustment berbasis target qty (server menghitung delta) sesuai pola
  /// adjust_stock di docs/obbel-coffee-ai-docs/09-api-rpc-contract.md §12.
  /// Ini bukan sistem koreksi penuh (lihat 24-data-consistency...md) — cukup
  /// untuk mengisi/mengoreksi stok Gudang di tahap awal.
  async adjust(dto: AdjustWarehouseStockDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.warehouseStock.findUnique({ where: { productId: dto.productId } });
      const currentQty = current?.qtyOnHand ?? 0;
      const delta = dto.targetQty - currentQty;

      const updated = await tx.warehouseStock.upsert({
        where: { productId: dto.productId },
        create: { productId: dto.productId, qtyOnHand: dto.targetQty },
        update: { qtyOnHand: dto.targetQty, version: { increment: 1 } },
      });

      if (delta !== 0) {
        const today = new Date();
        const businessDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
        await tx.stockMovement.create({
          data: {
            movementNo: await nomorMovementBerikutnya(tx, 'ADJ'),
            movementType: StockMovementType.ADJUSTMENT,
            productId: dto.productId,
            qty: Math.abs(delta),
            toBoothId: null,
            // Arah dikodekan di referenceType karena mutasi Gudang tidak punya
            // from/to booth yang bisa menandainya, sementara `qty` selalu positif.
            // Tanpa penanda ini, baris penambahan dan pengurangan stok Gudang
            // tidak bisa dibedakan saat riwayat dibaca ulang — satu-satunya
            // petunjuk tinggal `note`, dan note bisa ditimpa `dto.reason`.
            // Lihat arah.util.ts di modul stock-movements.
            referenceType: delta > 0 ? 'warehouse_stock_adjustment_in' : 'warehouse_stock_adjustment_out',
            referenceId: dto.productId,
            businessDate,
            createdBy: actorId,
            note: dto.reason ?? (delta > 0 ? 'Penambahan stok gudang' : 'Pengurangan stok gudang'),
          },
        });
      }

      return { productId: updated.productId, qtyOnHand: updated.qtyOnHand, delta };
    });
  }
}
