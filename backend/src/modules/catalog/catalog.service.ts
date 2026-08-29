import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

    const stocks = await this.prisma.boothStock.findMany({ where: { boothId } });
    const stockByProduct = new Map(stocks.map((s) => [s.productId, s.qtyOnHand]));

    return products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category?.name ?? null,
      sellPrice: Number(product.sellPrice),
      qtyOnHand: stockByProduct.get(product.id) ?? 0,
    }));
  }
}
