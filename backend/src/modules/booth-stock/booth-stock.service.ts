import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_CRITICAL_QTY, DEFAULT_MINIMUM_QTY, resolveStockStatus } from '../../common/stock-status';

@Injectable()
export class BoothStockService {
  constructor(private readonly prisma: PrismaService) {}

  /// Monitor Stok Booth (05-feature-specification.md §B5) — lintas semua
  /// Booth, dipakai Admin/Owner untuk melihat matrix stok.
  async findAll() {
    const [stocks, thresholds] = await Promise.all([
      this.prisma.boothStock.findMany({
        include: { booth: true, product: true },
        orderBy: [{ booth: { name: 'asc' } }, { product: { sortOrder: 'asc' } }],
      }),
      this.prisma.boothStockThreshold.findMany(),
    ]);
    const thresholdByKey = new Map(thresholds.map((t) => [`${t.boothId}:${t.productId}`, t]));

    return stocks.map((s) => {
      const threshold = thresholdByKey.get(`${s.boothId}:${s.productId}`);
      const minimumQty = threshold?.minimumQty ?? DEFAULT_MINIMUM_QTY;
      const criticalQty = threshold?.criticalQty ?? DEFAULT_CRITICAL_QTY;
      return {
        boothId: s.boothId,
        boothName: s.booth.name,
        productId: s.productId,
        productName: s.product.name,
        qtyOnHand: s.qtyOnHand,
        status: resolveStockStatus(s.qtyOnHand, minimumQty, criticalQty),
      };
    });
  }
}
