import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_CRITICAL_QTY, DEFAULT_MINIMUM_QTY } from '../../common/stock-status';
import { BulkUpsertThresholdDto } from './dto/bulk-upsert-threshold.dto';

@Injectable()
export class BoothStockThresholdsService {
  constructor(private readonly prisma: PrismaService) {}

  /// Selalu kembalikan SEMUA produk aktif untuk Booth ini — baris yang
  /// belum di-set Admin diisi nilai default supaya form di Admin Web tidak
  /// pernah kosong (dan tetap terlihat jelas mana yang belum dikustomisasi).
  async getForBooth(boothId: string) {
    const [products, thresholds] = await Promise.all([
      this.prisma.product.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.boothStockThreshold.findMany({ where: { boothId } }),
    ]);
    const thresholdByProduct = new Map(thresholds.map((t) => [t.productId, t]));

    return products.map((p) => {
      const existing = thresholdByProduct.get(p.id);
      return {
        productId: p.id,
        productName: p.name,
        minimumQty: existing?.minimumQty ?? DEFAULT_MINIMUM_QTY,
        criticalQty: existing?.criticalQty ?? DEFAULT_CRITICAL_QTY,
        isCustomized: !!existing,
      };
    });
  }

  async bulkUpsert(dto: BulkUpsertThresholdDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.boothStockThreshold.upsert({
          where: { boothId_productId: { boothId: dto.boothId, productId: item.productId } },
          create: {
            boothId: dto.boothId,
            productId: item.productId,
            minimumQty: item.minimumQty,
            criticalQty: item.criticalQty,
          },
          update: { minimumQty: item.minimumQty, criticalQty: item.criticalQty },
        }),
      ),
    );
    return this.getForBooth(dto.boothId);
  }
}
