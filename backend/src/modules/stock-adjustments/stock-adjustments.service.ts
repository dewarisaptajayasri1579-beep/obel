import { Injectable } from '@nestjs/common';
import { OpnameLocationType, StockMovementType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { CorrectionsService } from '../corrections/corrections.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateStockAdjustmentDto, ReverseStockAdjustmentDto } from './dto/create-stock-adjustment.dto';

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/// TX-13 — Manual Stock Adjustment. BUKAN jalan pintas edit stok bebas:
/// Admin memilih lokasi+produk+target qty+reason, server hitung delta
/// (05-feature-specification.md §B12, 24-...md §7 TX-13).
@Injectable()
export class StockAdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly corrections: CorrectionsService,
  ) {}

  findAll() {
    return this.prisma.transactionCorrection.findMany({
      where: { entityType: 'stock_adjustment' },
      include: { createdBy: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async create(dto: CreateStockAdjustmentDto, user: JwtPayload) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return existing;
    }
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);

    const currentQty = await this.getCurrentQty(dto.locationType, dto.boothId, dto.productId);
    const delta = dto.targetQty - currentQty;
    const adjustmentId = randomUUID();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (delta !== 0) {
        if (dto.locationType === OpnameLocationType.WAREHOUSE) {
          if (delta > 0) {
            await tx.warehouseStock.upsert({
              where: { productId: dto.productId },
              create: { productId: dto.productId, qtyOnHand: delta },
              update: { qtyOnHand: { increment: delta }, version: { increment: 1 } },
            });
          } else {
            const decremented = await tx.warehouseStock.updateMany({
              where: { productId: dto.productId, qtyOnHand: { gte: -delta } },
              data: { qtyOnHand: { decrement: -delta }, version: { increment: 1 } },
            });
            if (decremented.count !== 1) {
              throw new DomainError('INSUFFICIENT_STOCK', 'Adjustment akan membuat stok Gudang negatif.');
            }
          }
        } else {
          if (delta > 0) {
            await tx.boothStock.upsert({
              where: { boothId_productId: { boothId: dto.boothId!, productId: dto.productId } },
              create: { boothId: dto.boothId!, productId: dto.productId, qtyOnHand: delta },
              update: { qtyOnHand: { increment: delta }, version: { increment: 1 } },
            });
          } else {
            const decremented = await tx.boothStock.updateMany({
              where: { boothId: dto.boothId!, productId: dto.productId, qtyOnHand: { gte: -delta } },
              data: { qtyOnHand: { decrement: -delta }, version: { increment: 1 } },
            });
            if (decremented.count !== 1) {
              throw new DomainError('INSUFFICIENT_STOCK', 'Adjustment akan membuat stok Booth negatif.');
            }
          }
        }

        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: StockMovementType.ADJUSTMENT,
            productId: dto.productId,
            qty: Math.abs(delta),
            toBoothId: dto.locationType === OpnameLocationType.BOOTH && delta > 0 ? dto.boothId : null,
            fromBoothId: dto.locationType === OpnameLocationType.BOOTH && delta < 0 ? dto.boothId : null,
            referenceType: 'stock_adjustment',
            referenceId: adjustmentId,
            businessDate: businessDateOf(now),
            occurredAt: now,
            createdBy: user.sub,
          },
        });
      }

      await this.corrections.record(tx, {
        entityType: 'stock_adjustment',
        entityId: adjustmentId,
        transactionGroupId: adjustmentId,
        correctionType: 'ADJUSTMENT',
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: {
          locationType: dto.locationType,
          boothId: dto.boothId ?? null,
          productId: dto.productId,
          before: currentQty,
          after: dto.targetQty,
          delta,
        },
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
    });

    return this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
  }

  /// Reverse adjustment yang salah — original tetap ada, reversal jadi
  /// correction baru dengan delta terbalik (COR-09).
  async reverse(adjustmentId: string, dto: ReverseStockAdjustmentDto, user: JwtPayload) {
    const existingReversal = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existingReversal) {
      return existingReversal;
    }

    const original = await this.prisma.transactionCorrection.findFirst({
      where: { entityType: 'stock_adjustment', entityId: adjustmentId, correctionType: 'ADJUSTMENT' },
      orderBy: { createdAt: 'asc' },
    });
    if (!original) {
      throw new DomainError('NOT_FOUND', 'Adjustment tidak ditemukan.');
    }
    const alreadyReversed = await this.prisma.transactionCorrection.count({
      where: { entityType: 'stock_adjustment', entityId: adjustmentId, correctionType: 'VOID' },
    });
    if (alreadyReversed > 0) {
      throw new DomainError('ADJUSTMENT_ALREADY_REVERSED', 'Adjustment ini sudah pernah di-reverse.');
    }
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);

    const snapshot = original.impactSnapshot as {
      locationType: OpnameLocationType;
      boothId: string | null;
      productId: string;
      delta: number;
    };
    const inverseDelta = -snapshot.delta;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (inverseDelta !== 0) {
        if (snapshot.locationType === OpnameLocationType.WAREHOUSE) {
          if (inverseDelta > 0) {
            await tx.warehouseStock.upsert({
              where: { productId: snapshot.productId },
              create: { productId: snapshot.productId, qtyOnHand: inverseDelta },
              update: { qtyOnHand: { increment: inverseDelta }, version: { increment: 1 } },
            });
          } else {
            const decremented = await tx.warehouseStock.updateMany({
              where: { productId: snapshot.productId, qtyOnHand: { gte: -inverseDelta } },
              data: { qtyOnHand: { decrement: -inverseDelta }, version: { increment: 1 } },
            });
            if (decremented.count !== 1) {
              throw new DomainError('INSUFFICIENT_STOCK', 'Reversal akan membuat stok Gudang negatif.');
            }
          }
        } else {
          if (inverseDelta > 0) {
            await tx.boothStock.upsert({
              where: { boothId_productId: { boothId: snapshot.boothId!, productId: snapshot.productId } },
              create: { boothId: snapshot.boothId!, productId: snapshot.productId, qtyOnHand: inverseDelta },
              update: { qtyOnHand: { increment: inverseDelta }, version: { increment: 1 } },
            });
          } else {
            const decremented = await tx.boothStock.updateMany({
              where: { boothId: snapshot.boothId!, productId: snapshot.productId, qtyOnHand: { gte: -inverseDelta } },
              data: { qtyOnHand: { decrement: -inverseDelta }, version: { increment: 1 } },
            });
            if (decremented.count !== 1) {
              throw new DomainError('INSUFFICIENT_STOCK', 'Reversal akan membuat stok Booth negatif.');
            }
          }
        }

        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: StockMovementType.VOID_REVERSAL,
            productId: snapshot.productId,
            qty: Math.abs(inverseDelta),
            toBoothId: snapshot.locationType === OpnameLocationType.BOOTH && inverseDelta > 0 ? snapshot.boothId : null,
            fromBoothId: snapshot.locationType === OpnameLocationType.BOOTH && inverseDelta < 0 ? snapshot.boothId : null,
            referenceType: 'stock_adjustment_reversal',
            referenceId: adjustmentId,
            businessDate: businessDateOf(now),
            occurredAt: now,
            createdBy: user.sub,
          },
        });
      }

      await this.corrections.record(tx, {
        entityType: 'stock_adjustment',
        entityId: adjustmentId,
        transactionGroupId: original.transactionGroupId,
        correctionType: 'VOID',
        originalVersionId: original.id,
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: { ...snapshot, delta: inverseDelta },
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
    });

    return this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
  }

  private async getCurrentQty(locationType: OpnameLocationType, boothId: string | undefined, productId: string) {
    if (locationType === OpnameLocationType.WAREHOUSE) {
      const stock = await this.prisma.warehouseStock.findUnique({ where: { productId } });
      return stock?.qtyOnHand ?? 0;
    }
    const stock = await this.prisma.boothStock.findUnique({
      where: { boothId_productId: { boothId: boothId!, productId } },
    });
    return stock?.qtyOnHand ?? 0;
  }
}
