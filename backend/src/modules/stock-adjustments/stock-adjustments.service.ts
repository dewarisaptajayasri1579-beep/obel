import { Injectable } from '@nestjs/common';
import { OpnameLocationType, ReasonCode, StockMovementType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { nomorMovementBerikutnya } from '../../common/doc-no';
import { businessDateOf } from '../../common/jakarta-date';
import { CorrectionsService } from '../corrections/corrections.service';
import { SAFE_PROFILE_SELECT } from '../../common/safe-profile';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateStockAdjustmentDto, ReverseStockAdjustmentDto } from './dto/create-stock-adjustment.dto';
import { WriteOffStockDto } from './dto/write-off-stock.dto';

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
      include: { createdBy: { select: SAFE_PROFILE_SELECT } },
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
    return this.catat({ ...dto, user, before: currentQty, delta: dto.targetQty - currentQty });
  }

  /// TX-13 — Pemusnahan Stok Gudang (BR-041): produk kedaluwarsa / tidak layak jual
  /// dikeluarkan dari Gudang sebanyak `qty`, dengan foto bukti wajib. Dokumennya sama
  /// dengan adjustment (alasan EXPIRED), jadi salah input dibatalkan lewat reverse().
  async writeOff(dto: WriteOffStockDto, user: JwtPayload) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return existing;
    }
    const currentQty = await this.getCurrentQty(OpnameLocationType.WAREHOUSE, undefined, dto.productId);
    if (dto.qty > currentQty) {
      throw new DomainError('INSUFFICIENT_STOCK', `Stok Gudang hanya ${currentQty} cup.`, { available: currentQty });
    }
    return this.catat({
      idempotencyKey: dto.idempotencyKey,
      locationType: OpnameLocationType.WAREHOUSE,
      productId: dto.productId,
      reasonCode: ReasonCode.EXPIRED,
      reasonNote: dto.reasonNote,
      evidencePhotoUrl: dto.photoUrl,
      before: currentQty,
      delta: -dto.qty,
      user,
    });
  }

  /// Posting adjustment: ubah projection stok (pengurangan dijaga atomik supaya tidak
  /// negatif), tulis StockMovement, lalu dokumen koreksi — satu DB transaction.
  private async catat(p: {
    idempotencyKey: string;
    locationType: OpnameLocationType;
    boothId?: string;
    productId: string;
    reasonCode: ReasonCode;
    reasonNote?: string;
    evidencePhotoUrl?: string;
    before: number;
    delta: number;
    user: JwtPayload;
  }) {
    const adjustmentId = randomUUID();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (p.delta !== 0) {
        if (p.locationType === OpnameLocationType.WAREHOUSE) {
          if (p.delta > 0) {
            await tx.warehouseStock.upsert({
              where: { productId: p.productId },
              create: { productId: p.productId, qtyOnHand: p.delta },
              update: { qtyOnHand: { increment: p.delta }, version: { increment: 1 } },
            });
          } else {
            const decremented = await tx.warehouseStock.updateMany({
              where: { productId: p.productId, qtyOnHand: { gte: -p.delta } },
              data: { qtyOnHand: { decrement: -p.delta }, version: { increment: 1 } },
            });
            if (decremented.count !== 1) {
              throw new DomainError('INSUFFICIENT_STOCK', 'Adjustment akan membuat stok Gudang negatif.');
            }
          }
        } else {
          if (p.delta > 0) {
            await tx.boothStock.upsert({
              where: { boothId_productId: { boothId: p.boothId!, productId: p.productId } },
              create: { boothId: p.boothId!, productId: p.productId, qtyOnHand: p.delta },
              update: { qtyOnHand: { increment: p.delta }, version: { increment: 1 } },
            });
          } else {
            const decremented = await tx.boothStock.updateMany({
              where: { boothId: p.boothId!, productId: p.productId, qtyOnHand: { gte: -p.delta } },
              data: { qtyOnHand: { decrement: -p.delta }, version: { increment: 1 } },
            });
            if (decremented.count !== 1) {
              throw new DomainError('INSUFFICIENT_STOCK', 'Adjustment akan membuat stok Booth negatif.');
            }
          }
        }

        await tx.stockMovement.create({
          data: {
            movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
            movementType: StockMovementType.ADJUSTMENT,
            productId: p.productId,
            qty: Math.abs(p.delta),
            toBoothId: p.locationType === OpnameLocationType.BOOTH && p.delta > 0 ? p.boothId : null,
            fromBoothId: p.locationType === OpnameLocationType.BOOTH && p.delta < 0 ? p.boothId : null,
            // Sufiks arah wajib khusus Gudang — lihat arah.util.ts adjustmentGudang().
            referenceType:
              p.locationType === OpnameLocationType.WAREHOUSE
                ? p.delta > 0
                  ? 'stock_adjustment_in'
                  : 'stock_adjustment_out'
                : 'stock_adjustment',
            referenceId: adjustmentId,
            businessDate: businessDateOf(now),
            occurredAt: now,
            createdBy: p.user.sub,
          },
        });
      }

      await this.corrections.record(tx, {
        entityType: 'stock_adjustment',
        entityId: adjustmentId,
        transactionGroupId: adjustmentId,
        correctionType: 'ADJUSTMENT',
        reasonCode: p.reasonCode,
        reasonNote: p.reasonNote,
        evidencePhotoUrl: p.evidencePhotoUrl,
        impactSnapshot: {
          locationType: p.locationType,
          boothId: p.boothId ?? null,
          productId: p.productId,
          before: p.before,
          after: p.before + p.delta,
          delta: p.delta,
        },
        createdById: p.user.sub,
        idempotencyKey: p.idempotencyKey,
      });
    });

    return this.corrections.findExistingByIdempotencyKey(p.idempotencyKey);
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
            movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
            movementType: StockMovementType.VOID_REVERSAL,
            productId: snapshot.productId,
            qty: Math.abs(inverseDelta),
            toBoothId: snapshot.locationType === OpnameLocationType.BOOTH && inverseDelta > 0 ? snapshot.boothId : null,
            fromBoothId: snapshot.locationType === OpnameLocationType.BOOTH && inverseDelta < 0 ? snapshot.boothId : null,
            // Beda dari distribution_cancel/_revision (selalu +), reversal
            // adjustment manual bisa dua arah tergantung arah adjustment
            // aslinya — sufiks arah WAJIB dan tergantung tanda inverseDelta,
            // khusus kasus Gudang (Booth sudah pasti dari from/to booth).
            referenceType:
              snapshot.locationType === OpnameLocationType.WAREHOUSE
                ? inverseDelta > 0
                  ? 'stock_adjustment_reversal_in'
                  : 'stock_adjustment_reversal_out'
                : 'stock_adjustment_reversal',
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
