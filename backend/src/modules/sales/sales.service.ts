import { Injectable } from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  ShiftStatus,
  StockMovementType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateSaleDto } from './dto/create-sale.dto';

function generateDocNo(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = randomUUID().slice(0, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  /// Mirrors create_paid_sale from
  /// docs/obbel-coffee-ai-docs/09-api-rpc-contract.md §3 and enforces
  /// BR-002 (no negative stock), BR-004 (sale preconditions), BR-005 (price
  /// authority), BR-017 (idempotency).
  async createPaidSale(user: JwtPayload, dto: CreateSaleDto) {
    const existing = await this.prisma.sale.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { items: true },
    });
    if (existing) {
      return this.toSaleResponse(existing.id);
    }

    const shift = await this.prisma.shiftSession.findUnique({ where: { id: dto.shiftSessionId } });
    if (!shift) {
      throw new DomainError('SHIFT_NOT_OPEN', 'Shift tidak ditemukan.');
    }
    if (shift.status !== ShiftStatus.OPEN) {
      throw new DomainError('SHIFT_NOT_OPEN', 'Shift tidak sedang berjalan.');
    }
    if (user.role === UserRole.BOOTH_STAFF && shift.staffId !== user.sub) {
      throw new DomainError(
        'UNAUTHORIZED_BOOTH',
        'Shift ini bukan milik user yang login.',
      );
    }

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((p) => [p.id, p]));

    for (const item of dto.items) {
      const product = productById.get(item.productId);
      if (!product || !product.active) {
        throw new DomainError(
          'PRODUCT_INACTIVE',
          'Salah satu produk tidak aktif atau tidak ditemukan.',
          { productId: item.productId },
        );
      }
    }

    const saleId = randomUUID();
    const saleNo = generateDocNo('OBL');
    const paidAt = new Date();
    const businessDate = new Date(
      Date.UTC(paidAt.getUTCFullYear(), paidAt.getUTCMonth(), paidAt.getUTCDate()),
    );

    await this.prisma.$transaction(async (tx) => {
      let subtotal = 0n;
      const saleItemsData: Prisma.SaleItemCreateManyInput[] = [];
      const movementsData: Prisma.StockMovementCreateManyInput[] = [];

      for (const item of dto.items) {
        const product = productById.get(item.productId)!;

        const decremented = await tx.boothStock.updateMany({
          where: {
            boothId: shift.boothId,
            productId: item.productId,
            qtyOnHand: { gte: item.qty },
          },
          data: {
            qtyOnHand: { decrement: item.qty },
            version: { increment: 1 },
          },
        });

        if (decremented.count !== 1) {
          const current = await tx.boothStock.findUnique({
            where: { boothId_productId: { boothId: shift.boothId, productId: item.productId } },
          });
          throw new DomainError(
            'INSUFFICIENT_STOCK',
            `Stok ${product.name} tidak cukup.`,
            { productId: item.productId, available: current?.qtyOnHand ?? 0, requested: item.qty },
          );
        }

        const lineTotal = product.sellPrice * BigInt(item.qty);
        subtotal += lineTotal;

        saleItemsData.push({
          id: randomUUID(),
          saleId,
          productId: item.productId,
          productNameSnapshot: product.name,
          unitPrice: product.sellPrice,
          qty: item.qty,
          lineTotal,
        });

        movementsData.push({
          id: randomUUID(),
          movementNo: generateDocNo('MOV'),
          movementType: StockMovementType.SALE,
          productId: item.productId,
          qty: item.qty,
          fromBoothId: shift.boothId,
          toBoothId: null,
          referenceType: 'sale',
          referenceId: saleId,
          shiftSessionId: shift.id,
          businessDate,
          occurredAt: paidAt,
          createdBy: user.sub,
        });
      }

      const total = subtotal;

      await tx.sale.create({
        data: {
          id: saleId,
          saleNo,
          idempotencyKey: dto.idempotencyKey,
          boothId: shift.boothId,
          shiftSessionId: shift.id,
          staffId: user.sub,
          status: 'PAID',
          subtotal,
          discount: 0n,
          total,
          paymentMethod: dto.paymentMethod as PaymentMethod,
          paidAt,
        },
      });

      await tx.saleItem.createMany({ data: saleItemsData });
      await tx.payment.create({
        data: { saleId, method: dto.paymentMethod as PaymentMethod, amount: total, paidAt },
      });
      await tx.stockMovement.createMany({ data: movementsData });
    });

    return this.toSaleResponse(saleId);
  }

  private async toSaleResponse(saleId: string) {
    const sale = await this.prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { items: true },
    });
    const remainingStock = await this.prisma.boothStock.findMany({
      where: { boothId: sale.boothId, productId: { in: sale.items.map((i) => i.productId) } },
    });

    return {
      saleId: sale.id,
      saleNo: sale.saleNo,
      total: Number(sale.total),
      paidAt: sale.paidAt,
      remainingStock: remainingStock.map((s) => ({
        productId: s.productId,
        qtyOnHand: s.qtyOnHand,
      })),
    };
  }
}
