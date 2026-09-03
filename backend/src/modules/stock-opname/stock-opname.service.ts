import { Injectable } from '@nestjs/common';
import { OpnameLocationType, OpnameStatus, Prisma, StockMovementType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { startOfTodayJakarta } from '../../common/jakarta-date';
import { CorrectionsService } from '../corrections/corrections.service';
import { ReconciliationCasesService } from '../reconciliation-cases/reconciliation-cases.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ConfirmOpnameDto, RecountOpnameDto, StartOpnameDto } from './dto/opname.dto';

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/// TX-11/TX-12 — Stock Opname standalone (terpisah dari Closing Count
/// shift), untuk Gudang maupun Booth (05-feature-specification.md §B11).
@Injectable()
export class StockOpnameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly corrections: CorrectionsService,
    private readonly reconciliationCases: ReconciliationCasesService,
  ) {}

  findAll() {
    return this.prisma.stockOpname.findMany({
      include: { booth: true, countedBy: true, items: { include: { product: true } } },
      orderBy: { snapshotAt: 'desc' },
    });
  }

  /// Step 1-2: pilih lokasi + snapshot expected stock dari saldo saat ini.
  async start(dto: StartOpnameDto, user: JwtPayload) {
    const products = await this.prisma.product.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });

    let expectedByProduct: Map<string, number>;
    if (dto.locationType === OpnameLocationType.WAREHOUSE) {
      const stocks = await this.prisma.warehouseStock.findMany();
      expectedByProduct = new Map(stocks.map((s) => [s.productId, s.qtyOnHand]));
    } else {
      const stocks = await this.prisma.boothStock.findMany({ where: { boothId: dto.boothId } });
      expectedByProduct = new Map(stocks.map((s) => [s.productId, s.qtyOnHand]));
    }

    const opname = await this.prisma.stockOpname.create({
      data: {
        opnameNo: generateDocNo('OPN'),
        locationType: dto.locationType,
        boothId: dto.locationType === OpnameLocationType.BOOTH ? dto.boothId : null,
        businessDate: startOfTodayJakarta(),
        status: OpnameStatus.DRAFT,
        countedById: user.sub,
        items: {
          createMany: {
            data: products.map((p) => ({
              productId: p.id,
              expectedQty: expectedByProduct.get(p.id) ?? 0,
              actualQty: expectedByProduct.get(p.id) ?? 0,
              discrepancyQty: 0,
            })),
          },
        },
      },
      include: { booth: true, countedBy: true, items: { include: { product: true } } },
    });

    return opname;
  }

  /// Step 3-5: preview selisih dihitung client-side dari expected vs input
  /// actual sebelum submit. Endpoint ini hanya untuk pull ulang state DRAFT.
  async findOne(id: string) {
    const opname = await this.loadWithRelations(id);
    if (!opname) {
      throw new DomainError('NOT_FOUND', 'Stock opname tidak ditemukan.');
    }
    return opname;
  }

  /// Step 6-7: Konfirmasi — post adjustment movements per item, lock opname.
  async confirm(id: string, dto: ConfirmOpnameDto, user: JwtPayload) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.loadWithRelations(existing.entityId);
    }

    const opname = await this.loadWithRelations(id);
    if (!opname) {
      throw new DomainError('NOT_FOUND', 'Stock opname tidak ditemukan.');
    }
    if (opname.status !== OpnameStatus.DRAFT) {
      throw new DomainError('OPNAME_NOT_DRAFT', 'Hanya opname DRAFT yang dapat dikonfirmasi.', {
        status: opname.status,
      });
    }

    const actualByProduct = new Map(dto.items.map((i) => [i.productId, i.actualQty]));
    const hasDiscrepancy = opname.items.some(
      (item) => (actualByProduct.get(item.productId) ?? item.expectedQty) !== item.expectedQty,
    );
    if (hasDiscrepancy) {
      this.corrections.validateReason(dto.reasonCode, dto.reasonNote);
    }

    const now = new Date();
    const businessDate = businessDateOf(now);

    await this.prisma.$transaction(async (tx) => {
      for (const item of opname.items) {
        const actualQty = actualByProduct.get(item.productId) ?? item.expectedQty;
        const discrepancy = actualQty - item.expectedQty;

        await tx.stockOpnameItem.update({
          where: { id: item.id },
          data: { actualQty, discrepancyQty: discrepancy },
        });

        if (discrepancy === 0) continue;

        if (opname.locationType === OpnameLocationType.WAREHOUSE) {
          await this.applyWarehouseDelta(tx, item.productId, discrepancy);
        } else {
          await this.applyBoothDelta(tx, opname.boothId!, item.productId, discrepancy);
        }

        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: StockMovementType.ADJUSTMENT,
            productId: item.productId,
            qty: Math.abs(discrepancy),
            toBoothId: opname.locationType === OpnameLocationType.BOOTH && discrepancy > 0 ? opname.boothId : null,
            fromBoothId: opname.locationType === OpnameLocationType.BOOTH && discrepancy < 0 ? opname.boothId : null,
            referenceType: 'stock_opname',
            referenceId: opname.id,
            businessDate,
            occurredAt: now,
            createdBy: user.sub,
          },
        });
      }

      await tx.stockOpname.update({
        where: { id: opname.id },
        data: {
          status: OpnameStatus.CONFIRMED,
          confirmedAt: now,
          correctionReasonCode: hasDiscrepancy ? dto.reasonCode : null,
          note: dto.reasonNote,
        },
      });

      await this.corrections.record(tx, {
        entityType: 'stock_opname',
        entityId: opname.id,
        transactionGroupId: opname.transactionGroupId,
        correctionType: 'ADJUSTMENT',
        originalVersionId: opname.id,
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: {
          deltas: opname.items.map((item) => ({
            productId: item.productId,
            expectedQty: item.expectedQty,
            actualQty: actualByProduct.get(item.productId) ?? item.expectedQty,
          })),
        },
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
    });

    return this.loadWithRelations(opname.id);
  }

  /// TX-11/12 salah input setelah CONFIRMED — Recount (COR-07): opname lama
  /// tetap ada (immutable, DC-008), versi baru menyimpan compensating delta
  /// relatif terhadap actual versi sebelumnya, bukan overwrite.
  async recount(id: string, dto: RecountOpnameDto, user: JwtPayload) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.loadWithRelations(existing.replacementVersionId ?? existing.entityId);
    }

    const previous = await this.loadWithRelations(id);
    if (!previous) {
      throw new DomainError('NOT_FOUND', 'Stock opname tidak ditemukan.');
    }
    if (previous.status !== OpnameStatus.CONFIRMED) {
      throw new DomainError('OPNAME_NOT_CONFIRMED', 'Hanya opname CONFIRMED yang dapat di-recount.', {
        status: previous.status,
      });
    }
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);

    const newActualByProduct = new Map(dto.items.map((i) => [i.productId, i.actualQty]));
    const newOpnameId = randomUUID();
    const now = new Date();
    const businessDate = businessDateOf(now);

    try {
      await this.prisma.$transaction(async (tx) => {
      const newItemsData = [];
      for (const item of previous.items) {
        const newActual = newActualByProduct.get(item.productId) ?? item.actualQty;
        const compensatingDelta = newActual - item.actualQty;
        const newDiscrepancy = newActual - item.expectedQty;

        newItemsData.push({
          productId: item.productId,
          expectedQty: item.expectedQty,
          actualQty: newActual,
          discrepancyQty: newDiscrepancy,
        });

        if (compensatingDelta === 0) continue;

        if (previous.locationType === OpnameLocationType.WAREHOUSE) {
          await this.applyWarehouseDelta(tx, item.productId, compensatingDelta);
        } else {
          await this.applyBoothDelta(tx, previous.boothId!, item.productId, compensatingDelta);
        }

        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: StockMovementType.ADJUSTMENT,
            productId: item.productId,
            qty: Math.abs(compensatingDelta),
            toBoothId:
              previous.locationType === OpnameLocationType.BOOTH && compensatingDelta > 0 ? previous.boothId : null,
            fromBoothId:
              previous.locationType === OpnameLocationType.BOOTH && compensatingDelta < 0 ? previous.boothId : null,
            referenceType: 'stock_opname_recount',
            referenceId: newOpnameId,
            businessDate,
            occurredAt: now,
            createdBy: user.sub,
          },
        });
      }

      await tx.stockOpname.update({ where: { id: previous.id }, data: { status: OpnameStatus.SUPERSEDED } });

      await tx.stockOpname.create({
        data: {
          id: newOpnameId,
          opnameNo: generateDocNo('OPN'),
          locationType: previous.locationType,
          boothId: previous.boothId,
          businessDate: previous.businessDate,
          status: OpnameStatus.CONFIRMED,
          transactionGroupId: previous.transactionGroupId,
          versionNo: previous.versionNo + 1,
          revisionOfId: previous.id,
          snapshotAt: previous.snapshotAt,
          confirmedAt: now,
          countedById: user.sub,
          correctionReasonCode: dto.reasonCode,
          note: dto.reasonNote,
          items: { createMany: { data: newItemsData } },
        },
      });

      await this.corrections.record(tx, {
        entityType: 'stock_opname',
        entityId: previous.id,
        transactionGroupId: previous.transactionGroupId,
        correctionType: 'RECOUNT',
        originalVersionId: previous.id,
        replacementVersionId: newOpnameId,
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: {
          compensatingDeltas: previous.items.map((item) => ({
            productId: item.productId,
            delta: (newActualByProduct.get(item.productId) ?? item.actualQty) - item.actualQty,
          })),
        },
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
      });
    } catch (err) {
      if (err instanceof DomainError && err.code === 'INSUFFICIENT_STOCK') {
        // Doc §12 contoh ke-3: "physical count conflict" — recount tidak
        // boleh memaksa balance, buka kasus rekonsiliasi untuk Admin.
        const reconciliationCase = await this.reconciliationCases.create({
          sourceEntityType: 'stock_opname',
          sourceEntityId: previous.id,
          severity: 'CRITICAL',
          reasonCode: dto.reasonCode,
          details: { error: err.message, correctionInput: dto },
        });
        throw new DomainError(
          'RECONCILIATION_REQUIRED',
          `Recount tidak bisa diterapkan otomatis karena akan membuat stok negatif. Dibuat kasus rekonsiliasi ${reconciliationCase.caseNo}.`,
          { caseId: reconciliationCase.id, caseNo: reconciliationCase.caseNo },
        );
      }
      throw err;
    }

    return this.loadWithRelations(newOpnameId);
  }

  private async applyWarehouseDelta(tx: Prisma.TransactionClient, productId: string, delta: number) {
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
        throw new DomainError('INSUFFICIENT_STOCK', 'Koreksi opname akan membuat stok Gudang negatif.', { productId });
      }
    }
  }

  private async applyBoothDelta(
    tx: Prisma.TransactionClient,
    boothId: string,
    productId: string,
    delta: number,
  ) {
    if (delta > 0) {
      await tx.boothStock.upsert({
        where: { boothId_productId: { boothId, productId } },
        create: { boothId, productId, qtyOnHand: delta },
        update: { qtyOnHand: { increment: delta }, version: { increment: 1 } },
      });
    } else {
      const decremented = await tx.boothStock.updateMany({
        where: { boothId, productId, qtyOnHand: { gte: -delta } },
        data: { qtyOnHand: { decrement: -delta }, version: { increment: 1 } },
      });
      if (decremented.count !== 1) {
        throw new DomainError('INSUFFICIENT_STOCK', 'Koreksi opname akan membuat stok Booth negatif.', { productId });
      }
    }
  }

  private loadWithRelations(id: string) {
    return this.prisma.stockOpname.findUnique({
      where: { id },
      include: { booth: true, countedBy: true, items: { include: { product: true } } },
    });
  }
}
