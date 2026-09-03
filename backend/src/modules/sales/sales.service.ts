import { Injectable } from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SaleStatus,
  ShiftStatus,
  StockMovementType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { effectiveByGroup } from '../../common/effective-version';
import { CorrectionsService } from '../corrections/corrections.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ReviseSaleDto, RevisePaymentDto } from './dto/revise-sale.dto';
import { VoidSaleDto } from './dto/void-sale.dto';
import { CreateRefundDto } from './dto/create-refund.dto';

interface StockDelta {
  productId: string;
  productName: string;
  qtyDelta: number;
}

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly corrections: CorrectionsService,
  ) {}

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

  /// Sales list untuk Admin (05-feature-specification.md §B7). Hanya
  /// menampilkan versi efektif (terbaru) per transaction_group_id — versi
  /// lama yang sudah direvisi disembunyikan dari list ini (tetap terlihat
  /// di Riwayat & Koreksi Data), sesuai "effective sale versions"
  /// (docs/24-data-consistency-correction-reversal.md §14).
  async findAll() {
    const sales = await this.prisma.sale.findMany({
      where: { status: { in: [SaleStatus.PAID, SaleStatus.VOIDED] } },
      include: { booth: true, staff: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return effectiveByGroup(sales)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 200)
      .map((s) => ({
        id: s.id,
        saleNo: s.saleNo,
        boothName: s.booth.name,
        staffName: s.staff.fullName,
        status: s.status,
        total: Number(s.total),
        cupCount: s.items.reduce((sum, i) => sum + i.qty, 0),
        paymentMethod: s.paymentMethod,
        paidAt: s.paidAt,
        createdAt: s.createdAt,
        versionNo: s.versionNo,
        isRevised: s.versionNo > 1,
      }));
  }

  /// Detail satu sale untuk modal koreksi Admin Web.
  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { booth: true, staff: true, items: true, payments: true },
    });
    if (!sale) {
      throw new DomainError('NOT_FOUND', 'Sale tidak ditemukan.');
    }
    const activePayment = sale.payments.find((p) => p.status === PaymentStatus.POSTED) ?? null;
    return {
      id: sale.id,
      saleNo: sale.saleNo,
      boothName: sale.booth.name,
      staffName: sale.staff.fullName,
      status: sale.status,
      total: Number(sale.total),
      paymentMethod: activePayment?.method ?? sale.paymentMethod,
      versionNo: sale.versionNo,
      items: sale.items.map((i) => ({
        productId: i.productId,
        productName: i.productNameSnapshot,
        unitPrice: Number(i.unitPrice),
        qty: i.qty,
      })),
    };
  }

  /// TX-03.A — Impact Preview untuk Void Sale (§6).
  async previewVoidSale(saleId: string) {
    const sale = await this.loadVoidableSale(saleId);
    return this.buildVoidImpact(sale);
  }

  /// TX-03.A — Void Sale. Reverse seluruh stock ke Booth, reverse payment,
  /// original sale tetap ada dengan status VOIDED (DC-004, COR-01).
  async voidSale(user: JwtPayload, saleId: string, dto: VoidSaleDto) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.toSaleResponse(existing.entityId);
    }

    const sale = await this.loadVoidableSale(saleId);
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);
    const impact = this.buildVoidImpact(sale);
    const voidedAt = new Date();
    const businessDate = businessDateOf(voidedAt);

    await this.prisma.$transaction(async (tx) => {
      for (const delta of impact.stockDeltas) {
        await tx.boothStock.upsert({
          where: { boothId_productId: { boothId: sale.boothId, productId: delta.productId } },
          create: { boothId: sale.boothId, productId: delta.productId, qtyOnHand: delta.qtyDelta },
          update: { qtyOnHand: { increment: delta.qtyDelta }, version: { increment: 1 } },
        });

        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: StockMovementType.VOID_REVERSAL,
            productId: delta.productId,
            qty: delta.qtyDelta,
            toBoothId: sale.boothId,
            referenceType: 'sale_void',
            referenceId: sale.id,
            shiftSessionId: sale.shiftSessionId,
            businessDate,
            occurredAt: voidedAt,
            createdBy: user.sub,
          },
        });
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.VOIDED,
          voidedAt,
          voidReason: dto.reasonNote ? `${dto.reasonCode}: ${dto.reasonNote}` : dto.reasonCode,
        },
      });

      await tx.payment.updateMany({
        where: { saleId: sale.id, status: PaymentStatus.POSTED },
        data: { status: PaymentStatus.REVERSED },
      });

      await this.corrections.record(tx, {
        entityType: 'sale',
        entityId: sale.id,
        transactionGroupId: sale.transactionGroupId,
        correctionType: 'VOID',
        originalVersionId: sale.id,
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: impact,
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
    });

    return this.toSaleResponse(sale.id);
  }

  /// TX-03.B/C — Impact Preview untuk Revisi Sale (§6).
  async previewReviseSale(saleId: string, dto: Pick<ReviseSaleDto, 'items' | 'paymentMethod'>) {
    const sale = await this.loadVoidableSale(saleId);
    const { impact } = await this.buildRevisionPlan(sale, dto.items);
    return impact;
  }

  /// TX-03.B/C/D — Revisi qty/produk/payment sekaligus. Atomic: reverse V1,
  /// post V2 dengan transaction_group_id yang sama + version_no+1
  /// (DC-003, COR-02).
  async reviseSale(user: JwtPayload, saleId: string, dto: ReviseSaleDto) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.toSaleResponse(existing.replacementVersionId ?? existing.entityId);
    }

    const sale = await this.loadVoidableSale(saleId);
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);
    const { impact, newItemsData, newTotal, activePayment } = await this.buildRevisionPlan(
      sale,
      dto.items,
    );
    const paymentMethod = dto.paymentMethod ?? sale.paymentMethod;
    const newSaleId = randomUUID();
    const newSaleNo = generateDocNo('OBL');
    const revisedAt = new Date();
    const businessDate = businessDateOf(sale.paidAt ?? revisedAt);

    await this.prisma.$transaction(async (tx) => {
      for (const delta of impact.stockDeltas) {
        if (delta.qtyDelta > 0) {
          const decremented = await tx.boothStock.updateMany({
            where: { boothId: sale.boothId, productId: delta.productId, qtyOnHand: { gte: delta.qtyDelta } },
            data: { qtyOnHand: { decrement: delta.qtyDelta }, version: { increment: 1 } },
          });
          if (decremented.count !== 1) {
            throw new DomainError('INSUFFICIENT_STOCK', `Stok ${delta.productName} tidak cukup untuk revisi.`, {
              productId: delta.productId,
            });
          }
          await tx.stockMovement.create({
            data: {
              movementNo: generateDocNo('MOV'),
              movementType: StockMovementType.SALE,
              productId: delta.productId,
              qty: delta.qtyDelta,
              fromBoothId: sale.boothId,
              referenceType: 'sale_revision',
              referenceId: newSaleId,
              shiftSessionId: sale.shiftSessionId,
              businessDate,
              occurredAt: revisedAt,
              createdBy: user.sub,
            },
          });
        } else if (delta.qtyDelta < 0) {
          await tx.boothStock.upsert({
            where: { boothId_productId: { boothId: sale.boothId, productId: delta.productId } },
            create: { boothId: sale.boothId, productId: delta.productId, qtyOnHand: -delta.qtyDelta },
            update: { qtyOnHand: { increment: -delta.qtyDelta }, version: { increment: 1 } },
          });
          await tx.stockMovement.create({
            data: {
              movementNo: generateDocNo('MOV'),
              movementType: StockMovementType.VOID_REVERSAL,
              productId: delta.productId,
              qty: -delta.qtyDelta,
              toBoothId: sale.boothId,
              referenceType: 'sale_revision',
              referenceId: newSaleId,
              shiftSessionId: sale.shiftSessionId,
              businessDate,
              occurredAt: revisedAt,
              createdBy: user.sub,
            },
          });
        }
      }

      await tx.sale.create({
        data: {
          id: newSaleId,
          saleNo: newSaleNo,
          idempotencyKey: dto.idempotencyKey,
          boothId: sale.boothId,
          shiftSessionId: sale.shiftSessionId,
          staffId: sale.staffId,
          status: SaleStatus.PAID,
          subtotal: newTotal,
          discount: 0n,
          total: newTotal,
          paymentMethod,
          paidAt: sale.paidAt,
          transactionGroupId: sale.transactionGroupId,
          versionNo: sale.versionNo + 1,
          revisionOfId: sale.id,
        },
      });
      await tx.saleItem.createMany({ data: newItemsData.map((item) => ({ ...item, saleId: newSaleId })) });

      if (activePayment) {
        await tx.payment.update({ where: { id: activePayment.id }, data: { status: PaymentStatus.SUPERSEDED } });
      }
      await tx.payment.create({
        data: {
          saleId: newSaleId,
          method: paymentMethod,
          amount: newTotal,
          paidAt: revisedAt,
          transactionGroupId: activePayment?.transactionGroupId ?? randomUUID(),
          versionNo: (activePayment?.versionNo ?? 0) + 1,
          revisionOfId: activePayment?.id ?? null,
        },
      });

      await this.corrections.record(tx, {
        entityType: 'sale',
        entityId: sale.id,
        transactionGroupId: sale.transactionGroupId,
        correctionType: 'REVISION',
        originalVersionId: sale.id,
        replacementVersionId: newSaleId,
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: impact,
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
    });

    return this.toSaleResponse(newSaleId);
  }

  /// TX-04 — Revisi metode pembayaran saja. Tidak ada stock/omzet effect
  /// (COR-03): hanya ledger Payment yang berubah, Sale tetap immutable.
  async revisePayment(user: JwtPayload, saleId: string, dto: RevisePaymentDto) {
    const existing = await this.corrections.findExistingByIdempotencyKey(dto.idempotencyKey);
    if (existing) {
      return this.toSaleResponse(saleId);
    }

    const sale = await this.loadVoidableSale(saleId);
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);
    const activePayment = sale.payments.find((p) => p.status === PaymentStatus.POSTED) ?? null;

    await this.prisma.$transaction(async (tx) => {
      if (activePayment) {
        await tx.payment.update({ where: { id: activePayment.id }, data: { status: PaymentStatus.SUPERSEDED } });
      }
      await tx.payment.create({
        data: {
          saleId: sale.id,
          method: dto.method,
          amount: sale.total,
          transactionGroupId: activePayment?.transactionGroupId ?? randomUUID(),
          versionNo: (activePayment?.versionNo ?? 0) + 1,
          revisionOfId: activePayment?.id ?? null,
        },
      });

      await this.corrections.record(tx, {
        entityType: 'payment',
        entityId: activePayment?.id ?? sale.id,
        transactionGroupId: activePayment?.transactionGroupId ?? sale.transactionGroupId,
        correctionType: 'PAYMENT_CORRECTION',
        originalVersionId: activePayment?.id ?? null,
        reasonCode: dto.reasonCode,
        reasonNote: dto.reasonNote,
        impactSnapshot: { from: activePayment?.method ?? sale.paymentMethod, to: dto.method },
        createdById: user.sub,
        idempotencyKey: dto.idempotencyKey,
      });
    });

    return this.toSaleResponse(sale.id);
  }

  /// TX-14 — Customer Sales Return/Refund. BEDA dari Void: sale asli benar
  /// dan memang terjadi, tetap PAID; ini dokumen baru untuk kejadian bisnis
  /// setelahnya. Stok hanya bertambah kalau item ditandai stockReturned.
  async createRefund(user: JwtPayload, saleId: string, dto: CreateRefundDto) {
    const existingRefund = await this.prisma.saleRefund.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existingRefund) {
      return this.toRefundResponse(existingRefund.id);
    }

    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, refunds: { include: { items: true } } },
    });
    if (!sale) {
      throw new DomainError('NOT_FOUND', 'Sale tidak ditemukan.');
    }
    if (sale.status !== SaleStatus.PAID) {
      throw new DomainError('SALE_NOT_REFUNDABLE', 'Hanya sale berstatus PAID yang dapat di-refund.', {
        status: sale.status,
      });
    }
    this.corrections.validateReason(dto.reasonCode, dto.reasonNote);

    const itemBySale = new Map(sale.items.map((i) => [i.productId, i]));
    const alreadyRefundedByProduct = new Map<string, number>();
    for (const refund of sale.refunds) {
      for (const item of refund.items) {
        alreadyRefundedByProduct.set(item.productId, (alreadyRefundedByProduct.get(item.productId) ?? 0) + item.qty);
      }
    }

    let amount = 0n;
    const refundItemsData: Prisma.SaleRefundItemCreateManySaleRefundInput[] = [];
    const stockDeltas: { productId: string; qty: number }[] = [];

    for (const item of dto.items) {
      const saleItem = itemBySale.get(item.productId);
      if (!saleItem) {
        throw new DomainError('PRODUCT_NOT_IN_SALE', 'Produk ini tidak ada di sale asli.', { productId: item.productId });
      }
      const alreadyRefunded = alreadyRefundedByProduct.get(item.productId) ?? 0;
      if (alreadyRefunded + item.qty > saleItem.qty) {
        throw new DomainError('REFUND_EXCEEDS_SALE_QTY', `Qty refund melebihi qty sale untuk produk ini.`, {
          productId: item.productId,
          saleQty: saleItem.qty,
          alreadyRefunded,
          requested: item.qty,
        });
      }

      const lineTotal = saleItem.unitPrice * BigInt(item.qty);
      amount += lineTotal;
      refundItemsData.push({
        productId: item.productId,
        qty: item.qty,
        unitPrice: saleItem.unitPrice,
        lineTotal,
        stockReturned: dto.condition === 'REFUND_WITH_STOCK_RETURN' || item.stockReturned === true,
      });

      if (dto.condition === 'REFUND_WITH_STOCK_RETURN' || item.stockReturned === true) {
        stockDeltas.push({ productId: item.productId, qty: item.qty });
      }
    }

    const refundId = randomUUID();
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const { productId, qty } of stockDeltas) {
        await tx.boothStock.upsert({
          where: { boothId_productId: { boothId: sale.boothId, productId } },
          create: { boothId: sale.boothId, productId, qtyOnHand: qty },
          update: { qtyOnHand: { increment: qty }, version: { increment: 1 } },
        });
        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: StockMovementType.ADJUSTMENT,
            productId,
            qty,
            toBoothId: sale.boothId,
            referenceType: 'sale_refund',
            referenceId: refundId,
            shiftSessionId: sale.shiftSessionId,
            businessDate: businessDateOf(now),
            occurredAt: now,
            createdBy: user.sub,
          },
        });
      }

      await tx.saleRefund.create({
        data: {
          id: refundId,
          refundNo: generateDocNo('RFD'),
          saleId: sale.id,
          condition: dto.condition,
          amount,
          reasonCode: dto.reasonCode,
          reasonNote: dto.reasonNote,
          createdById: user.sub,
          idempotencyKey: dto.idempotencyKey,
          items: { createMany: { data: refundItemsData } },
        },
      });
    });

    return this.toRefundResponse(refundId);
  }

  async listRefunds(saleId: string) {
    const refunds = await this.prisma.saleRefund.findMany({
      where: { saleId },
      include: { items: { include: { product: true } }, createdBy: true },
      orderBy: { createdAt: 'desc' },
    });
    return refunds.map((r) => this.formatRefund(r));
  }

  private async toRefundResponse(refundId: string) {
    const refund = await this.prisma.saleRefund.findUniqueOrThrow({
      where: { id: refundId },
      include: { items: { include: { product: true } }, createdBy: true },
    });
    return this.formatRefund(refund);
  }

  private formatRefund(
    refund: Prisma.SaleRefundGetPayload<{ include: { items: { include: { product: true } }; createdBy: true } }>,
  ) {
    return {
      id: refund.id,
      refundNo: refund.refundNo,
      saleId: refund.saleId,
      condition: refund.condition,
      amount: Number(refund.amount),
      reasonCode: refund.reasonCode,
      reasonNote: refund.reasonNote,
      createdByName: refund.createdBy.fullName,
      createdAt: refund.createdAt,
      items: refund.items.map((i) => ({
        productId: i.productId,
        productName: i.product.name,
        qty: i.qty,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
        stockReturned: i.stockReturned,
      })),
    };
  }

  private async loadVoidableSale(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, payments: true },
    });
    if (!sale) {
      throw new DomainError('NOT_FOUND', 'Sale tidak ditemukan.');
    }
    if (sale.status !== SaleStatus.PAID) {
      throw new DomainError('SALE_NOT_CORRECTABLE', 'Hanya sale berstatus PAID yang dapat dikoreksi.', {
        status: sale.status,
      });
    }
    return sale;
  }

  private buildVoidImpact(sale: Awaited<ReturnType<SalesService['loadVoidableSale']>>) {
    const stockDeltas: StockDelta[] = sale.items.map((item) => ({
      productId: item.productId,
      productName: item.productNameSnapshot,
      qtyDelta: item.qty,
    }));
    return {
      omzetDelta: -Number(sale.total),
      cupSoldDelta: -sale.items.reduce((sum, i) => sum + i.qty, 0),
      stockDeltas,
    };
  }

  private async buildRevisionPlan(
    sale: Awaited<ReturnType<SalesService['loadVoidableSale']>>,
    newItems: { productId: string; qty: number }[],
  ) {
    const productIds = [...new Set(newItems.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const productById = new Map(products.map((p) => [p.id, p]));
    const oldQtyByProduct = new Map(sale.items.map((i) => [i.productId, i.qty]));

    for (const item of newItems) {
      const product = productById.get(item.productId);
      if (!product || !product.active) {
        throw new DomainError('PRODUCT_INACTIVE', 'Salah satu produk tidak aktif atau tidak ditemukan.', {
          productId: item.productId,
        });
      }
    }

    const oldItemBySnapshot = new Map(sale.items.map((i) => [i.productId, i]));
    let newTotal = 0n;
    const newItemsData: Prisma.SaleItemCreateManyInput[] = [];
    for (const item of newItems) {
      const existingItem = oldItemBySnapshot.get(item.productId);
      const product = productById.get(item.productId)!;
      const unitPrice = existingItem?.unitPrice ?? product.sellPrice;
      const lineTotal = unitPrice * BigInt(item.qty);
      newTotal += lineTotal;
      newItemsData.push({
        id: randomUUID(),
        saleId: '',
        productId: item.productId,
        productNameSnapshot: existingItem?.productNameSnapshot ?? product.name,
        unitPrice,
        qty: item.qty,
        lineTotal,
      });
    }

    const newQtyByProduct = new Map(newItems.map((i) => [i.productId, i.qty]));
    const allProductIds = new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]);
    const stockDeltas: StockDelta[] = [];
    for (const productId of allProductIds) {
      const oldQty = oldQtyByProduct.get(productId) ?? 0;
      const newQty = newQtyByProduct.get(productId) ?? 0;
      const qtyDelta = newQty - oldQty;
      if (qtyDelta === 0) continue;
      const name =
        oldItemBySnapshot.get(productId)?.productNameSnapshot ??
        productById.get(productId)?.name ??
        productId;
      stockDeltas.push({ productId, productName: name, qtyDelta });
    }

    const activePayment = sale.payments.find((p) => p.status === PaymentStatus.POSTED) ?? null;

    return {
      impact: {
        omzetDelta: Number(newTotal) - Number(sale.total),
        cupSoldDelta:
          newItems.reduce((sum, i) => sum + i.qty, 0) - sale.items.reduce((sum, i) => sum + i.qty, 0),
        stockDeltas,
      },
      newItemsData,
      newTotal,
      activePayment,
    };
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
