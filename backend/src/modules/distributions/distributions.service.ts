import { Injectable } from '@nestjs/common';
import { DistributionStatus, StockMovementType, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { CorrectionsService } from '../corrections/corrections.service';
import { ReconciliationCasesService } from '../reconciliation-cases/reconciliation-cases.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateDistributionDto } from './dto/create-distribution.dto';
import { ReceiveDistributionDto } from './dto/receive-distribution.dto';
import { CancelDistributionDto, CorrectReceiptDto, ReviseDistributionDto } from './dto/correction.dto';

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class DistributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly corrections: CorrectionsService,
    private readonly reconciliationCases: ReconciliationCasesService,
  ) {}

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

  /// TX-01 — Cancel distribusi yang masih SENT (belum RECEIVED). Kembalikan
  /// seluruh stok in-transit ke Gudang (COR-04).
  async cancelDistribution(user: JwtPayload, id: string, dto: CancelDistributionDto) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.toResponse((await this.loadWithRelations(existing.entityId))!);
    }

    const distribution = await this.loadWithRelations(id);
    if (!distribution) {
      throw new DomainError('NOT_FOUND', 'Distribusi tidak ditemukan.');
    }
    if (distribution.status !== DistributionStatus.SENT) {
      throw new DomainError('DISTRIBUTION_NOT_CANCELLABLE', 'Hanya distribusi SENT yang dapat dibatalkan.', {
        status: distribution.status,
      });
    }
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const item of distribution.items) {
        await tx.warehouseStock.upsert({
          where: { productId: item.productId },
          create: { productId: item.productId, qtyOnHand: item.qtySent },
          update: { qtyOnHand: { increment: item.qtySent }, version: { increment: 1 } },
        });
        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: StockMovementType.VOID_REVERSAL,
            productId: item.productId,
            qty: item.qtySent,
            referenceType: 'distribution_cancel',
            referenceId: distribution.id,
            businessDate: businessDateOf(now),
            occurredAt: now,
            createdBy: user.sub,
          },
        });
      }

      await tx.stockDistribution.update({
        where: { id: distribution.id },
        data: { status: DistributionStatus.CANCELLED },
      });

      await this.corrections.record(tx, {
        entityType: 'stock_distribution',
        entityId: distribution.id,
        transactionGroupId: distribution.transactionGroupId,
        correctionType: 'VOID',
        originalVersionId: distribution.id,
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: { warehouseRestored: distribution.items.map((i) => ({ productId: i.productId, qty: i.qtySent })) },
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
    });

    return this.toResponse((await this.loadWithRelations(distribution.id))!);
  }

  /// TX-01 — Revisi qty/produk pada distribusi yang masih SENT. Reverse V1
  /// sepenuhnya ke Gudang, lalu post V2 dengan qty baru (DC-003).
  async reviseDistribution(user: JwtPayload, id: string, dto: ReviseDistributionDto) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.toResponse((await this.loadWithRelations(existing.replacementVersionId ?? existing.entityId))!);
    }

    const distribution = await this.loadWithRelations(id);
    if (!distribution) {
      throw new DomainError('NOT_FOUND', 'Distribusi tidak ditemukan.');
    }
    if (distribution.status !== DistributionStatus.SENT) {
      throw new DomainError('DISTRIBUTION_NOT_REVISABLE', 'Hanya distribusi SENT yang dapat direvisi.', {
        status: distribution.status,
      });
    }
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);

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

    const oldQtyByProduct = new Map(distribution.items.map((i) => [i.productId, i.qtySent]));
    const newQtyByProduct = new Map(dto.items.map((i) => [i.productId, i.qty]));
    const allProductIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]);

    const newDistributionId = randomUUID();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const productId of allProductIds) {
        const oldQty = oldQtyByProduct.get(productId) ?? 0;
        const newQty = newQtyByProduct.get(productId) ?? 0;
        const delta = newQty - oldQty;
        if (delta === 0) continue;

        if (delta > 0) {
          const decremented = await tx.warehouseStock.updateMany({
            where: { productId, qtyOnHand: { gte: delta } },
            data: { qtyOnHand: { decrement: delta }, version: { increment: 1 } },
          });
          if (decremented.count !== 1) {
            throw new DomainError('INSUFFICIENT_STOCK', 'Stok Gudang tidak cukup untuk revisi distribusi.', {
              productId,
            });
          }
        } else {
          await tx.warehouseStock.upsert({
            where: { productId },
            create: { productId, qtyOnHand: -delta },
            update: { qtyOnHand: { increment: -delta }, version: { increment: 1 } },
          });
        }

        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: delta > 0 ? StockMovementType.WAREHOUSE_TO_BOOTH : StockMovementType.VOID_REVERSAL,
            productId,
            qty: Math.abs(delta),
            referenceType: 'distribution_revision',
            referenceId: newDistributionId,
            businessDate: businessDateOf(now),
            occurredAt: now,
            createdBy: user.sub,
          },
        });
      }

      await tx.stockDistribution.update({
        where: { id: distribution.id },
        data: { status: DistributionStatus.CANCELLED },
      });

      await tx.stockDistribution.create({
        data: {
          id: newDistributionId,
          distributionNo: generateDocNo('DIST'),
          boothId: distribution.boothId,
          status: DistributionStatus.SENT,
          idempotencyKey: dto.idempotencyKey,
          sentAt: now,
          createdById: user.sub,
          note: distribution.note,
          transactionGroupId: distribution.transactionGroupId,
          versionNo: distribution.versionNo + 1,
          revisionOfId: distribution.id,
          items: {
            createMany: {
              data: dto.items.map((item) => ({ productId: item.productId, qtySent: item.qty })),
            },
          },
        },
      });

      await this.corrections.record(tx, {
        entityType: 'stock_distribution',
        entityId: distribution.id,
        transactionGroupId: distribution.transactionGroupId,
        correctionType: 'REVISION',
        originalVersionId: distribution.id,
        replacementVersionId: newDistributionId,
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: {
          deltas: [...allProductIds].map((productId) => ({
            productId,
            delta: (newQtyByProduct.get(productId) ?? 0) - (oldQtyByProduct.get(productId) ?? 0),
          })),
        },
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
    });

    return this.toResponse((await this.loadWithRelations(newDistributionId))!);
  }

  /// TX-02 — Koreksi penerimaan setelah distribusi RECEIVED/DISCREPANCY.
  /// `qty_received` lama TIDAK diedit (DC-008); correction menerapkan delta
  /// langsung ke booth_stocks (COR-05).
  async correctReceipt(user: JwtPayload, id: string, dto: CorrectReceiptDto) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.toResponse((await this.loadWithRelations(existing.entityId))!);
    }

    const distribution = await this.loadWithRelations(id);
    if (!distribution) {
      throw new DomainError('NOT_FOUND', 'Distribusi tidak ditemukan.');
    }
    if (distribution.status !== DistributionStatus.RECEIVED && distribution.status !== DistributionStatus.DISCREPANCY) {
      throw new DomainError('DISTRIBUTION_NOT_RECEIVED', 'Distribusi ini belum diterima Booth.', {
        status: distribution.status,
      });
    }
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);

    const correctedQtyByProduct = new Map(dto.items.map((i) => [i.productId, i.qty]));
    const now = new Date();
    const deltas: { productId: string; delta: number }[] = [];

    for (const item of distribution.items) {
      const correctedQty = correctedQtyByProduct.get(item.productId);
      if (correctedQty === undefined) continue;
      const recordedQty = item.qtyReceived ?? item.qtySent;
      const delta = correctedQty - recordedQty;
      if (delta !== 0) deltas.push({ productId: item.productId, delta });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const { productId, delta } of deltas) {
          if (delta > 0) {
            await tx.boothStock.upsert({
              where: { boothId_productId: { boothId: distribution.boothId, productId } },
              create: { boothId: distribution.boothId, productId, qtyOnHand: delta },
              update: { qtyOnHand: { increment: delta }, version: { increment: 1 } },
            });
          } else {
            const decremented = await tx.boothStock.updateMany({
              where: { boothId: distribution.boothId, productId, qtyOnHand: { gte: -delta } },
              data: { qtyOnHand: { decrement: -delta }, version: { increment: 1 } },
            });
            if (decremented.count !== 1) {
              throw new DomainError('INSUFFICIENT_STOCK', 'Koreksi akan membuat stok Booth negatif.', { productId });
            }
          }

          await tx.stockMovement.create({
            data: {
              movementNo: generateDocNo('MOV'),
              movementType: StockMovementType.ADJUSTMENT,
              productId,
              qty: Math.abs(delta),
              toBoothId: delta > 0 ? distribution.boothId : null,
              fromBoothId: delta < 0 ? distribution.boothId : null,
              referenceType: 'distribution_receipt_correction',
              referenceId: distribution.id,
              businessDate: businessDateOf(now),
              occurredAt: now,
              createdBy: user.sub,
            },
          });
        }

        if (deltas.length > 0 && distribution.status !== DistributionStatus.DISCREPANCY) {
          await tx.stockDistribution.update({
            where: { id: distribution.id },
            data: { status: DistributionStatus.DISCREPANCY },
          });
        }

        await this.corrections.record(tx, {
          entityType: 'stock_distribution',
          entityId: distribution.id,
          transactionGroupId: distribution.transactionGroupId,
          correctionType: 'ADJUSTMENT',
          originalVersionId: distribution.id,
          reasonCode: dto.reasonCode,
          reasonNote: dto.reasonNote,
          impactSnapshot: { deltas },
          createdById: user.sub,
          idempotencyKey: dto.idempotencyKey,
        });
      });
    } catch (err) {
      if (err instanceof DomainError && err.code === 'INSUFFICIENT_STOCK') {
        const reconciliationCase = await this.reconciliationCases.create({
          sourceEntityType: 'stock_distribution',
          sourceEntityId: distribution.id,
          severity: 'CRITICAL',
          reasonCode: dto.reasonCode,
          details: { deltas, error: err.message, correctionInput: dto },
        });
        throw new DomainError(
          'RECONCILIATION_REQUIRED',
          `Koreksi tidak bisa diterapkan otomatis karena stok Booth akan negatif. Dibuat kasus rekonsiliasi ${reconciliationCase.caseNo} untuk ditindaklanjuti Admin.`,
          { caseId: reconciliationCase.id, caseNo: reconciliationCase.caseNo },
        );
      }
      throw err;
    }

    return this.toResponse((await this.loadWithRelations(distribution.id))!);
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
