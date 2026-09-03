import { Injectable } from '@nestjs/common';
import { ReturnStatus, StockMovementType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { CorrectionsService } from '../corrections/corrections.service';
import { ReconciliationCasesService } from '../reconciliation-cases/reconciliation-cases.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReceiveReturnDto } from './dto/receive-return.dto';
import { CancelReturnDto, CorrectReturnReceiptDto, ReviseReturnDto } from './dto/correction.dto';

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliationCases: ReconciliationCasesService,
    private readonly corrections: CorrectionsService,
  ) {}

  findAll() {
    return this.prisma.stockReturn.findMany({
      include: { booth: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForBooth(boothId: string) {
    return this.prisma.stockReturn.findMany({
      where: { boothId },
      include: { booth: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /// Booth Staff mengajukan return. Sesuai BR-013, qty default = seluruh
  /// stok Booth saat ini (biasanya dipanggil setelah closing). Stok
  /// langsung dikeluarkan dari booth_stocks supaya "tidak boleh dijual
  /// lagi" begitu diajukan.
  async create(dto: CreateReturnDto, boothId: string, staffId: string) {
    let items = dto.items;
    if (!items || items.length === 0) {
      const currentStocks = await this.prisma.boothStock.findMany({
        where: { boothId, qtyOnHand: { gt: 0 } },
      });
      items = currentStocks.map((s) => ({ productId: s.productId, qty: s.qtyOnHand }));
    }
    if (items.length === 0) {
      throw new DomainError('NO_STOCK_TO_RETURN', 'Tidak ada stok Booth untuk dikembalikan.');
    }

    const returnId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      for (const item of items!) {
        const decremented = await tx.boothStock.updateMany({
          where: { boothId, productId: item.productId, qtyOnHand: { gte: item.qty } },
          data: { qtyOnHand: { decrement: item.qty }, version: { increment: 1 } },
        });
        if (decremented.count !== 1) {
          throw new DomainError('INSUFFICIENT_STOCK', 'Qty return melebihi stok Booth saat ini.', {
            productId: item.productId,
          });
        }
      }

      await tx.stockReturn.create({
        data: {
          id: returnId,
          returnNo: generateDocNo('RTN'),
          boothId,
          status: ReturnStatus.SUBMITTED,
          idempotencyKey: randomUUID(),
          submittedById: staffId,
          note: dto.note,
          items: {
            createMany: { data: items!.map((i) => ({ productId: i.productId, qtySubmitted: i.qty })) },
          },
        },
      });
    });

    return this.loadWithRelations(returnId);
  }

  /// Mirrors receive_stock_return (§09): warehouse hanya bertambah sesuai
  /// qty actual received (BR-013). Beda submitted vs received -> DISCREPANCY,
  /// tapi tidak memblokir penerimaan (dokumen fisik tetap final).
  async receive(id: string, dto: ReceiveReturnDto, actorId: string) {
    const stockReturn = await this.loadWithRelations(id);
    if (!stockReturn) {
      throw new DomainError('NOT_FOUND', 'Return tidak ditemukan.');
    }
    if (stockReturn.status === ReturnStatus.RECEIVED || stockReturn.status === ReturnStatus.DISCREPANCY) {
      return stockReturn;
    }
    if (stockReturn.status !== ReturnStatus.SUBMITTED) {
      throw new DomainError('RETURN_NOT_PENDING', 'Return ini tidak sedang menunggu diterima.');
    }

    const qtyByProduct = new Map(dto.items.map((i) => [i.productId, i.qtyReceived]));
    const receivedAt = new Date();
    const businessDate = businessDateOf(receivedAt);
    let hasDiscrepancy = false;

    await this.prisma.$transaction(async (tx) => {
      for (const item of stockReturn.items) {
        const qtyReceived = qtyByProduct.get(item.productId) ?? item.qtySubmitted;
        if (qtyReceived !== item.qtySubmitted) hasDiscrepancy = true;

        await tx.stockReturnItem.update({
          where: { id: item.id },
          data: { qtyReceived },
        });

        if (qtyReceived > 0) {
          await tx.warehouseStock.upsert({
            where: { productId: item.productId },
            create: { productId: item.productId, qtyOnHand: qtyReceived },
            update: { qtyOnHand: { increment: qtyReceived }, version: { increment: 1 } },
          });

          await tx.stockMovement.create({
            data: {
              movementNo: generateDocNo('MOV'),
              movementType: StockMovementType.RETURN_TO_WAREHOUSE,
              productId: item.productId,
              qty: qtyReceived,
              fromBoothId: stockReturn.boothId,
              referenceType: 'stock_return',
              referenceId: stockReturn.id,
              businessDate,
              occurredAt: receivedAt,
              createdBy: actorId,
            },
          });
        }
      }

      await tx.stockReturn.update({
        where: { id },
        data: {
          status: hasDiscrepancy ? ReturnStatus.DISCREPANCY : ReturnStatus.RECEIVED,
          receivedAt,
          receivedById: actorId,
        },
      });
    });

    return this.loadWithRelations(id);
  }

  /// TX-09 — Cancel return SUBMITTED yang belum diterima Gudang. Kembalikan
  /// stok ke Booth.
  async cancelReturn(user: JwtPayload, id: string, dto: CancelReturnDto) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.loadWithRelations(existing.entityId);
    }

    const stockReturn = await this.loadWithRelations(id);
    if (!stockReturn) {
      throw new DomainError('NOT_FOUND', 'Return tidak ditemukan.');
    }
    if (stockReturn.status !== ReturnStatus.SUBMITTED) {
      throw new DomainError('RETURN_NOT_CANCELLABLE', 'Hanya return SUBMITTED yang dapat dibatalkan.', {
        status: stockReturn.status,
      });
    }
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const item of stockReturn.items) {
        await tx.boothStock.upsert({
          where: { boothId_productId: { boothId: stockReturn.boothId, productId: item.productId } },
          create: { boothId: stockReturn.boothId, productId: item.productId, qtyOnHand: item.qtySubmitted },
          update: { qtyOnHand: { increment: item.qtySubmitted }, version: { increment: 1 } },
        });
        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: StockMovementType.VOID_REVERSAL,
            productId: item.productId,
            qty: item.qtySubmitted,
            toBoothId: stockReturn.boothId,
            referenceType: 'return_cancel',
            referenceId: stockReturn.id,
            businessDate: businessDateOf(now),
            occurredAt: now,
            createdBy: user.sub,
          },
        });
      }

      await tx.stockReturn.update({ where: { id: stockReturn.id }, data: { status: ReturnStatus.CANCELLED } });

      await this.corrections.record(tx, {
        entityType: 'stock_return',
        entityId: stockReturn.id,
        transactionGroupId: stockReturn.transactionGroupId,
        correctionType: 'VOID',
        originalVersionId: stockReturn.id,
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: { boothRestored: stockReturn.items.map((i) => ({ productId: i.productId, qty: i.qtySubmitted })) },
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
    });

    return this.loadWithRelations(stockReturn.id);
  }

  /// TX-09 — Revisi qty/produk return yang masih SUBMITTED (belum diterima
  /// Gudang). Reverse V1 sepenuhnya ke Booth, lalu post V2 dengan qty baru
  /// (DC-003), sama seperti reviseDistribution.
  async reviseReturn(user: JwtPayload, id: string, dto: ReviseReturnDto) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.loadWithRelations(existing.replacementVersionId ?? existing.entityId);
    }

    const stockReturn = await this.loadWithRelations(id);
    if (!stockReturn) {
      throw new DomainError('NOT_FOUND', 'Return tidak ditemukan.');
    }
    if (stockReturn.status !== ReturnStatus.SUBMITTED) {
      throw new DomainError('RETURN_NOT_REVISABLE', 'Hanya return SUBMITTED yang dapat direvisi.', {
        status: stockReturn.status,
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

    const oldQtyByProduct = new Map(stockReturn.items.map((i) => [i.productId, i.qtySubmitted]));
    const newQtyByProduct = new Map(dto.items.map((i) => [i.productId, i.qty]));
    const allProductIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]);

    const newReturnId = randomUUID();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const productId of allProductIds) {
        const oldQty = oldQtyByProduct.get(productId) ?? 0;
        const newQty = newQtyByProduct.get(productId) ?? 0;
        const delta = newQty - oldQty;
        if (delta === 0) continue;

        if (delta > 0) {
          const decremented = await tx.boothStock.updateMany({
            where: { boothId: stockReturn.boothId, productId, qtyOnHand: { gte: delta } },
            data: { qtyOnHand: { decrement: delta }, version: { increment: 1 } },
          });
          if (decremented.count !== 1) {
            throw new DomainError('INSUFFICIENT_STOCK', 'Stok Booth tidak cukup untuk revisi return.', { productId });
          }
        } else {
          await tx.boothStock.upsert({
            where: { boothId_productId: { boothId: stockReturn.boothId, productId } },
            create: { boothId: stockReturn.boothId, productId, qtyOnHand: -delta },
            update: { qtyOnHand: { increment: -delta }, version: { increment: 1 } },
          });
        }

        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: delta > 0 ? StockMovementType.RETURN_TO_WAREHOUSE : StockMovementType.VOID_REVERSAL,
            productId,
            qty: Math.abs(delta),
            fromBoothId: delta > 0 ? stockReturn.boothId : null,
            toBoothId: delta < 0 ? stockReturn.boothId : null,
            referenceType: 'return_revision',
            referenceId: newReturnId,
            businessDate: businessDateOf(now),
            occurredAt: now,
            createdBy: user.sub,
          },
        });
      }

      await tx.stockReturn.update({ where: { id: stockReturn.id }, data: { status: ReturnStatus.CANCELLED } });

      await tx.stockReturn.create({
        data: {
          id: newReturnId,
          returnNo: generateDocNo('RTN'),
          boothId: stockReturn.boothId,
          status: ReturnStatus.SUBMITTED,
          idempotencyKey: dto.idempotencyKey,
          submittedById: user.sub,
          note: stockReturn.note,
          transactionGroupId: stockReturn.transactionGroupId,
          versionNo: stockReturn.versionNo + 1,
          revisionOfId: stockReturn.id,
          items: {
            createMany: {
              data: dto.items.map((item) => ({ productId: item.productId, qtySubmitted: item.qty })),
            },
          },
        },
      });

      await this.corrections.record(tx, {
        entityType: 'stock_return',
        entityId: stockReturn.id,
        transactionGroupId: stockReturn.transactionGroupId,
        correctionType: 'REVISION',
        originalVersionId: stockReturn.id,
        replacementVersionId: newReturnId,
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

    return this.loadWithRelations(newReturnId);
  }

  /// TX-10 — Koreksi penerimaan return setelah RECEIVED/DISCREPANCY.
  /// `qty_received` lama tidak diedit (DC-008); delta diterapkan langsung
  /// ke warehouse_stocks (COR-08).
  async correctReceipt(user: JwtPayload, id: string, dto: CorrectReturnReceiptDto) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.loadWithRelations(existing.entityId);
    }

    const stockReturn = await this.loadWithRelations(id);
    if (!stockReturn) {
      throw new DomainError('NOT_FOUND', 'Return tidak ditemukan.');
    }
    if (stockReturn.status !== ReturnStatus.RECEIVED && stockReturn.status !== ReturnStatus.DISCREPANCY) {
      throw new DomainError('RETURN_NOT_RECEIVED', 'Return ini belum diterima Gudang.', {
        status: stockReturn.status,
      });
    }
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);

    const correctedQtyByProduct = new Map(dto.items.map((i) => [i.productId, i.qty]));
    const now = new Date();
    const deltas: { productId: string; delta: number }[] = [];

    for (const item of stockReturn.items) {
      const correctedQty = correctedQtyByProduct.get(item.productId);
      if (correctedQty === undefined) continue;
      const recordedQty = item.qtyReceived ?? item.qtySubmitted;
      const delta = correctedQty - recordedQty;
      if (delta !== 0) deltas.push({ productId: item.productId, delta });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const { productId, delta } of deltas) {
          if (delta > 0) {
            await tx.warehouseStock.upsert({
              where: { productId },
              create: { productId, qtyOnHand: delta },
              update: { qtyOnHand: { increment: delta }, version: { increment: 1 } },
            });
          } else {
            const decremented = await tx.warehouseStock.updateMany({
              where: { productId, qtyOnHand: { gte: -delta } },
              data: { qtyOnHand: { decrement: -delta }, version: { increment: 1 } },
            });
            if (decremented.count !== 1) {
              throw new DomainError('INSUFFICIENT_STOCK', 'Koreksi akan membuat stok Gudang negatif.', { productId });
            }
          }

          await tx.stockMovement.create({
            data: {
              movementNo: generateDocNo('MOV'),
              movementType: StockMovementType.ADJUSTMENT,
              productId,
              qty: Math.abs(delta),
              referenceType: 'return_receipt_correction',
              referenceId: stockReturn.id,
              businessDate: businessDateOf(now),
              occurredAt: now,
              createdBy: user.sub,
            },
          });
        }

        if (deltas.length > 0 && stockReturn.status !== ReturnStatus.DISCREPANCY) {
          await tx.stockReturn.update({ where: { id: stockReturn.id }, data: { status: ReturnStatus.DISCREPANCY } });
        }

        await this.corrections.record(tx, {
          entityType: 'stock_return',
          entityId: stockReturn.id,
          transactionGroupId: stockReturn.transactionGroupId,
          correctionType: 'ADJUSTMENT',
          originalVersionId: stockReturn.id,
          reasonCode: dto.reasonCode,
          reasonNote: dto.reasonNote,
          impactSnapshot: { deltas },
          createdById: user.sub,
          idempotencyKey: dto.idempotencyKey,
        });
      });
    } catch (err) {
      if (err instanceof DomainError && err.code === 'INSUFFICIENT_STOCK') {
        // Skenario persis contoh dokumen §12: "received return sudah dipakai
        // distribusi lain" — jangan paksa balance, buka kasus rekonsiliasi.
        const reconciliationCase = await this.reconciliationCases.create({
          sourceEntityType: 'stock_return',
          sourceEntityId: stockReturn.id,
          severity: 'CRITICAL',
          reasonCode: dto.reasonCode,
          details: { deltas, error: err.message, correctionInput: dto },
        });
        throw new DomainError(
          'RECONCILIATION_REQUIRED',
          `Koreksi tidak bisa diterapkan otomatis karena stok Gudang akan negatif (kemungkinan sudah didistribusikan lagi). Dibuat kasus rekonsiliasi ${reconciliationCase.caseNo}.`,
          { caseId: reconciliationCase.id, caseNo: reconciliationCase.caseNo },
        );
      }
      throw err;
    }

    return this.loadWithRelations(stockReturn.id);
  }

  private loadWithRelations(id: string) {
    return this.prisma.stockReturn.findUnique({
      where: { id },
      include: { booth: true, items: { include: { product: true } } },
    });
  }
}
