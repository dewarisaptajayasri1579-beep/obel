import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const MINIMUM_QTY = 25;
const CRITICAL_QTY = 10;

function statusFor(qty: number): string {
  if (qty <= 0) return 'Habis';
  if (qty <= CRITICAL_QTY) return 'Kritis';
  if (qty <= MINIMUM_QTY) return 'Menipis';
  return 'Aman';
}

@Injectable()
export class BoothStockService {
  constructor(private readonly prisma: PrismaService) {}

  /// Monitor Stok Booth (05-feature-specification.md §B5) — lintas semua
  /// Booth, dipakai Admin/Owner untuk melihat matrix stok.
  async findAll() {
    const stocks = await this.prisma.boothStock.findMany({
      include: { booth: true, product: true },
      orderBy: [{ booth: { name: 'asc' } }, { product: { sortOrder: 'asc' } }],
    });

    return stocks.map((s) => ({
      boothId: s.boothId,
      boothName: s.booth.name,
      productId: s.productId,
      productName: s.product.name,
      qtyOnHand: s.qtyOnHand,
      status: statusFor(s.qtyOnHand),
    }));
  }
}
