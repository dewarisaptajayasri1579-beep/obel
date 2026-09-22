import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveStockStatus } from '../../common/stock-status';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /// Mirrors get_booth_pos_catalog(booth_id) from
  /// docs/obbel-coffee-ai-docs/09-api-rpc-contract.md.
  async getBoothCatalog(boothId: string) {
    const products = await this.prisma.product.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const [stocks, thresholds] = await Promise.all([
      this.prisma.boothStock.findMany({ where: { boothId } }),
      this.prisma.boothStockThreshold.findMany({ where: { boothId } }),
    ]);
    const stockByProduct = new Map(stocks.map((s) => [s.productId, s.qtyOnHand]));
    const thresholdByProduct = new Map(thresholds.map((t) => [t.productId, t]));

    return products.map((product) => {
      const qtyOnHand = stockByProduct.get(product.id) ?? 0;
      const threshold = thresholdByProduct.get(product.id);
      const minimumQty = threshold?.minimumQty ?? product.minimumQty;
      const criticalQty = threshold?.criticalQty ?? product.criticalQty;
      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category?.name ?? null,
        sellPrice: Number(product.sellPrice),
        imageUrl: product.imageUrl,
        qtyOnHand,
        status: resolveStockStatus(qtyOnHand, minimumQty, criticalQty),
      };
    });
  }
}
