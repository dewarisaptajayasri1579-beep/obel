import { Injectable } from '@nestjs/common';
import { DistributionStatus, StockMovementType, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateDistributionDto } from './dto/create-distribution.dto';
import { ReceiveDistributionDto } from './dto/receive-distribution.dto';

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class DistributionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.stockDistribution.findMany({
      include: { booth: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingForBooth(boothId: string) {
    const distributions = await this.prisma.stockDistribution.findMany({
      where: { boothId, status: DistributionStatus.SENT },
      include: { booth: true, items: { include: { product: true } } },
      orderBy: { sentAt: 'asc' },
    });
    return distributions.map(this.toResponse);
  }

  /// Kirim distribusi (Admin). Digabung create+SENT dalam satu langkah untuk
  /// MVP, sesuai rekomendasi BR-003: "deduct Gudang saat SENT". Atomik dan
  /// idempotent (BR-017) seperti create_paid_sale.
  async create(dto: CreateDistributionDto, actorId: string) {
    const existing = await this.prisma.stockDistribution.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      return this.toResponse((await this.loadWithRelations(existing.id))!);
    }

    const booth = await this.prisma.booth.findUnique({ where: { id: dto.boothId } });
    if (!booth || booth.status !== 'ACTIVE') {
      throw new DomainError('BOOTH_INACTIVE', 'Booth tidak ditemukan atau tidak aktif.');
    }

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const item of dto.items) {
      const product = productById.get(item.productId);
      if (!product || !product.active) {
        throw new DomainError('PRODUCT_INACTIVE', 'Salah satu produk tidak aktif atau tidak ditemukan.', {
          productId: item.productId,
        });
      }
    }

    const distributionId = randomUUID();
    const sentAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const decremented = await tx.warehouseStock.updateMany({
          where: { productId: item.productId, qtyOnHand: { gte: item.qty } },
          data: { qtyOnHand: { decrement: item.qty }, version: { increment: 1 } },
        });
        if (decremented.count !== 1) {
          const current = await tx.warehouseStock.findUnique({ where: { productId: item.productId } });
          const product = productById.get(item.productId)!;
          throw new DomainError('INSUFFICIENT_STOCK', `Stok Gudang ${product.name} tidak cukup.`, {
            productId: item.productId,
            available: current?.qtyOnHand ?? 0,
            requested: item.qty,
          });
        }
      }

      await tx.stockDistribution.create({
        data: {
          id: distributionId,
          distributionNo: generateDocNo('DIST'),
          boothId: dto.boothId,
          status: DistributionStatus.SENT,
          idempotencyKey: dto.idempotencyKey,
          sentAt,
          createdById: actorId,
          note: dto.note,
          items: {
            createMany: {
              data: dto.items.map((item) => ({ productId: item.productId, qtySent: item.qty })),
            },
          },
        },
      });
    });

    return this.toResponse((await this.loadWithRelations(distributionId))!);
  }

  /// Terima distribusi (Booth Staff). Menambah booth_stocks + mencatat
  /// stock_movements WAREHOUSE_TO_BOOTH. Idempotent lewat pengecekan status:
  /// distribusi yang sudah RECEIVED tidak diproses ulang (BR-017).
  async receive(distributionId: string, dto: ReceiveDistributionDto, user: JwtPayload) {
    const distribution = await this.loadWithRelations(distributionId);
    if (!distribution) {
      throw new DomainError('NOT_FOUND', 'Distribusi tidak ditemukan.');
    }
    if (user.role === UserRole.BOOTH_STAFF && distribution.boothId !== user.boothId) {
      throw new DomainError('UNAUTHORIZED_BOOTH', 'Distribusi ini bukan untuk booth Anda.');
    }
    if (distribution.status === DistributionStatus.RECEIVED) {
      return this.toResponse(distribution);
    }
    if (distribution.status !== DistributionStatus.SENT) {
      throw new DomainError('DISTRIBUTION_NOT_SENT', 'Distribusi ini tidak sedang menunggu penerimaan.');
    }

    const qtyByProduct = new Map(dto.items.map((i) => [i.productId, i.actualQty]));
    const receivedAt = new Date();
    const businessDate = businessDateOf(receivedAt);

    await this.prisma.$transaction(async (tx) => {
      for (const item of distribution.items) {
        const actualQty = qtyByProduct.get(item.productId) ?? item.qtySent;

        await tx.stockDistributionItem.update({
          where: { id: item.id },
          data: { qtyReceived: actualQty },
        });

        if (actualQty > 0) {
          await tx.boothStock.upsert({
            where: { boothId_productId: { boothId: distribution.boothId, productId: item.productId } },
            create: { boothId: distribution.boothId, productId: item.productId, qtyOnHand: actualQty },
            update: { qtyOnHand: { increment: actualQty }, version: { increment: 1 } },
          });

          await tx.stockMovement.create({
            data: {
              movementNo: generateDocNo('MOV'),
              movementType: StockMovementType.WAREHOUSE_TO_BOOTH,
              productId: item.productId,
              qty: actualQty,
              toBoothId: distribution.boothId,
              referenceType: 'stock_distribution',
              referenceId: distribution.id,
              businessDate,
              occurredAt: receivedAt,
              createdBy: user.sub,
            },
          });
        }
      }

      const hasDiscrepancy = distribution.items.some(
        (item) => (qtyByProduct.get(item.productId) ?? item.qtySent) !== item.qtySent,
      );

      await tx.stockDistribution.update({
        where: { id: distribution.id },
        data: {
          status: hasDiscrepancy ? DistributionStatus.DISCREPANCY : DistributionStatus.RECEIVED,
          receivedAt,
          receivedById: user.sub,
        },
      });
    });

    return this.toResponse((await this.loadWithRelations(distributionId))!);
  }

  private loadWithRelations(id: string) {
    return this.prisma.stockDistribution.findUnique({
      where: { id },
      include: { booth: true, items: { include: { product: true } } },
    });
  }

  private toResponse(distribution: NonNullable<Awaited<ReturnType<DistributionsService['loadWithRelations']>>>) {
    return {
      id: distribution.id,
      distributionNo: distribution.distributionNo,
      status: distribution.status,
      boothId: distribution.boothId,
      boothName: distribution.booth.name,
      sentAt: distribution.sentAt,
      receivedAt: distribution.receivedAt,
      note: distribution.note,
      items: distribution.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        sellPrice: Number(item.product.sellPrice),
        qtySent: item.qtySent,
        qtyReceived: item.qtyReceived,
      })),
    };
  }
}
