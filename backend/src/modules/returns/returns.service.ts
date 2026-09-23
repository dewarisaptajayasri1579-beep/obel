import { Injectable } from '@nestjs/common';
import { Prisma, ReturnStatus, StockMovementType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { nomorSekuensialBerikutnya, nomorMovementBerikutnya } from '../../common/doc-no';
import { cariShiftTerbukaBoothStaff } from '../../common/active-shift.util';
import { CorrectionsService } from '../corrections/corrections.service';
import { ReconciliationCasesService } from '../reconciliation-cases/reconciliation-cases.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReceiveReturnDto } from './dto/receive-return.dto';
import { CancelReturnDto, CorrectReturnReceiptDto, ReviseReturnDto } from './dto/correction.dto';

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/// Kode error unique-constraint Prisma & batas percobaan ulang — dipakai saat
/// dua permintaan bersamaan kebetulan membaca nomor urut tertinggi yang sama
/// (sama pola dgn StockReceiptsService.nomorBerikutnya).
const KODE_UNIQUE_VIOLATION = 'P2002';
const MAKS_PERCOBAAN_NOMOR = 5;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliationCases: ReconciliationCasesService,
    private readonly corrections: CorrectionsService,
  ) {}

  /// Nomor Return sederhana: `RTN-000001` naik satu per dokumen, pola sama
  /// dengan StockReceiptsService.nomorBerikutnya ("Tambah Stok Gudang").
  private async nomorReturnBerikutnya(tx: Prisma.TransactionClient): Promise<string> {
    const semua = await tx.stockReturn.findMany({
      where: { returnNo: { startsWith: 'RTN-' } },
      select: { returnNo: true },
    });
    return nomorSekuensialBerikutnya(
      semua.map((r) => r.returnNo),
      'RTN',
    );
  }

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
  async create(dto: CreateReturnDto, boothId: string, staffId: string, shiftSessionIdOverride?: string) {
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

    const now = new Date();
    let returnId = '';

    for (let percobaan = 0; percobaan < MAKS_PERCOBAAN_NOMOR; percobaan++) {
      returnId = randomUUID();
      try {
        await this.prisma.$transaction(async (tx) => {
      const shiftSessionId = shiftSessionIdOverride ?? (await cariShiftTerbukaBoothStaff(tx, boothId, staffId));

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

        // Pengurangan stok Booth WAJIB meninggalkan jejak di buku besar.
        // Sebelumnya baris ini tidak ada: stok booth berkurang saat return
        // diajukan, tapi satu-satunya movement yang tertulis adalah
        // RETURN_TO_WAREHOUSE di sisi Gudang saat Admin menerima. Akibatnya
        // buku besar booth selalu lebih besar dari saldonya, dan selisihnya
        // tumbuh tiap kali ada return — ini penyebab utama 15 dari 16 produk
        // Booth 1 tidak bisa direkonsiliasi (lihat scripts/reconcile-stock.ts).
        //
        // fromBoothId yang terisi sudah cukup menandai arah keluar, jadi
        // arahnya tidak pernah ambigu saat riwayat dibaca ulang.
        await tx.stockMovement.create({
          data: {
            movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
            movementType: StockMovementType.ADJUSTMENT,
            productId: item.productId,
            qty: item.qty,
            fromBoothId: boothId,
            toBoothId: null,
            referenceType: 'stock_return_submit',
            referenceId: returnId,
            businessDate: businessDateOf(now),
            occurredAt: now,
            createdBy: staffId,
            shiftSessionId,
            note: 'Stok keluar dari Booth saat pengembalian diajukan.',
          },
        });
      }

      await tx.stockReturn.create({
        data: {
          id: returnId,
          returnNo: await this.nomorReturnBerikutnya(tx),
          boothId,
          status: ReturnStatus.SUBMITTED,
          idempotencyKey: randomUUID(),
          submittedById: staffId,
          note: dto.note,
          shiftSessionId: shiftSessionIdOverride ?? null,
          items: {
            createMany: { data: items!.map((i) => ({ productId: i.productId, qtySubmitted: i.qty })) },
          },
        },
      });
        });
        break;
      } catch (err) {
        const bentrokNomor = err instanceof Prisma.PrismaClientKnownRequestError && err.code === KODE_UNIQUE_VIOLATION;
        if (!bentrokNomor || percobaan === MAKS_PERCOBAAN_NOMOR - 1) throw err;
      }
    }

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
    const hasDiscrepancy = stockReturn.items.some(
      (item) => (qtyByProduct.get(item.productId) ?? item.qtySubmitted) !== item.qtySubmitted,
    );
    if (hasDiscrepancy && !dto.note?.trim()) {
      throw new DomainError(
        'DISCREPANCY_REASON_REQUIRED',
        'Catatan wajib diisi kalau qty Stok Kembali yang diterima berbeda dari yang diajukan.',
      );
    }

    const receivedAt = new Date();
    const businessDate = businessDateOf(receivedAt);

    await this.prisma.$transaction(async (tx) => {
      for (const item of stockReturn.items) {
        const qtyReceived = qtyByProduct.get(item.productId) ?? item.qtySubmitted;

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
              movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
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
          receiveNote: dto.note?.trim() || null,
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
            movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
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

    const now = new Date();
    let newReturnId = '';

    try {
      for (let percobaan = 0; percobaan < MAKS_PERCOBAAN_NOMOR; percobaan++) {
      newReturnId = randomUUID();
      try {
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
            movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
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
          returnNo: await this.nomorReturnBerikutnya(tx),
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
      break;
      } catch (err) {
        const bentrokNomor = err instanceof Prisma.PrismaClientKnownRequestError && err.code === KODE_UNIQUE_VIOLATION;
        if (bentrokNomor && percobaan < MAKS_PERCOBAAN_NOMOR - 1) continue;
        throw err;
      }
      }
    } catch (err) {
      if (err instanceof DomainError && err.code === 'INSUFFICIENT_STOCK') {
        const reconciliationCase = await this.reconciliationCases.create({
          sourceEntityType: 'stock_return',
          sourceEntityId: stockReturn.id,
          severity: 'CRITICAL',
          reasonCode: dto.reasonCode,
          details: { error: err.message, correctionInput: dto },
        });
        throw new DomainError(
          'RECONCILIATION_REQUIRED',
          `Revisi tidak bisa diterapkan otomatis karena stok Booth akan negatif. Dibuat kasus rekonsiliasi ${reconciliationCase.caseNo}.`,
          { caseId: reconciliationCase.id, caseNo: reconciliationCase.caseNo },
        );
      }
      throw err;
    }

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
              movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
              movementType: StockMovementType.ADJUSTMENT,
              productId,
              qty: Math.abs(delta),
              // Arah dikodekan di referenceType — mutasi Gudang tidak punya
              // from/to booth, dan `qty` selalu positif. Lihat arah.util.ts.
              referenceType: delta > 0 ? 'return_receipt_correction_in' : 'return_receipt_correction_out',
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
