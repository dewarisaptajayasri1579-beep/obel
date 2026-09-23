import { Injectable } from '@nestjs/common';
import { DistributionStatus, Prisma, StockMovementType, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { nomorSekuensialBerikutnya, nomorMovementBerikutnya } from '../../common/doc-no';
import { cariShiftTerbukaBoothStaff } from '../../common/active-shift.util';
import { ActivityLogService } from '../../common/activity-log.service';
import { CorrectionsService } from '../corrections/corrections.service';
import { ReconciliationCasesService } from '../reconciliation-cases/reconciliation-cases.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateDistributionDto } from './dto/create-distribution.dto';
import { ReceiveDistributionDto } from './dto/receive-distribution.dto';
import { CancelDistributionDto, CorrectReceiptDto, ReviseDistributionDto } from './dto/correction.dto';

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/// Kode error unique-constraint Prisma & batas percobaan ulang — dipakai saat
/// dua permintaan bersamaan kebetulan membaca nomor urut tertinggi yang sama
/// (sama pola dgn StockReceiptsService.nomorBerikutnya).
const KODE_UNIQUE_VIOLATION = 'P2002';
const MAKS_PERCOBAAN_NOMOR = 5;

/// Label keterangan movement ADJUSTMENT per Tindak Lanjut Koreksi Penerimaan
/// — supaya "Koreksi penerimaan distribusi" di Rekap Mutasi Stok langsung
/// kelihatan alasannya tanpa buka detail dokumen.
const TINDAK_LANJUT_KETERANGAN: Record<string, string> = {
  RUSAK: 'Rusak',
  SALAH_HITUNG: 'Salah Hitung',
  GANTI_RUGI_PETUGAS: 'Ganti Rugi Petugas',
  LAINNYA: 'Lainnya',
};

@Injectable()
export class DistributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly corrections: CorrectionsService,
    private readonly reconciliationCases: ReconciliationCasesService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /// Nomor Serah Terima Stok sederhana: `DIST-000001` naik satu per distribusi,
  /// diambil dari nomor TERBESAR yang sudah ada — pola sama dengan
  /// StockReceiptsService.nomorBerikutnya ("Tambah Stok Gudang").
  private async nomorDistribusiBerikutnya(tx: Prisma.TransactionClient): Promise<string> {
    const semua = await tx.stockDistribution.findMany({
      where: { distributionNo: { startsWith: 'DIST-' } },
      select: { distributionNo: true },
    });
    return nomorSekuensialBerikutnya(
      semua.map((d) => d.distributionNo),
      'DIST',
    );
  }

  async findAll() {
    const distributions = await this.prisma.stockDistribution.findMany({
      include: { booth: true, receivedBy: true, items: { include: { product: { include: { category: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return distributions.map(this.toResponse);
  }

  async findPendingForBooth(boothId: string) {
    const distributions = await this.prisma.stockDistribution.findMany({
      where: { boothId, status: DistributionStatus.SENT },
      include: { booth: true, receivedBy: true, items: { include: { product: { include: { category: true } } } } },
      orderBy: { sentAt: 'asc' },
    });
    return distributions.map(this.toResponse);
  }

  /// Layar "Terima Stok" Petugas Booth (tab Semua/Menunggu/Selesai) — beda
  /// dari findPendingForBooth() yang cuma SENT, ini SEMUA status supaya tab
  /// "Selesai" (RECEIVED/DISCREPANCY) ikut punya isi, bukan selalu kosong.
  async findAllForBooth(boothId: string) {
    const distributions = await this.prisma.stockDistribution.findMany({
      where: { boothId },
      include: { booth: true, receivedBy: true, items: { include: { product: { include: { category: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return distributions.map(this.toResponse);
  }

  /// Kirim distribusi (Admin). Digabung create+SENT dalam satu langkah untuk
  /// MVP, sesuai rekomendasi BR-003: "deduct Gudang saat SENT". Atomik dan
  /// idempotent (BR-017) seperti create_paid_sale.
  async create(dto: CreateDistributionDto, actorId: string, actorName: string) {
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

    for (let percobaan = 0; percobaan < MAKS_PERCOBAAN_NOMOR; percobaan++) {
      try {
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

            // Ledger Gudang-keluar dicatat DI SINI (qty dikirim penuh, saat
            // warehouseStock benar-benar berkurang) — bukan cuma di receive()
            // yang cuma mencatat qty yang BENAR-BENAR diterima Petugas.
            // Sebelum ini, item yang qtyReceived-nya 0 (semua rusak) sama
            // sekali tidak punya baris movement, jadi Rekap Mutasi Stok
            // Gudang diam-diam tidak pernah menyusut untuk baris itu padahal
            // stoknya sudah pasti berkurang (lihat arah.util.ts WAREHOUSE_TO_BOOTH
            // — baris tanpa toBoothId dianggap murni Gudang-keluar).
            await tx.stockMovement.create({
              data: {
                movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
                movementType: StockMovementType.WAREHOUSE_TO_BOOTH,
                productId: item.productId,
                qty: item.qty,
                referenceType: 'stock_distribution',
                referenceId: distributionId,
                businessDate: businessDateOf(sentAt),
                occurredAt: sentAt,
                createdBy: actorId,
              },
            });
          }

          const distributionNo = await this.nomorDistribusiBerikutnya(tx);

          await tx.stockDistribution.create({
            data: {
              id: distributionId,
              distributionNo,
              boothId: dto.boothId,
              status: DistributionStatus.SENT,
              idempotencyKey: dto.idempotencyKey,
              sentAt,
              createdById: actorId,
              sentToId: dto.sentToId,
              note: dto.note,
              items: {
                createMany: {
                  data: dto.items.map((item) => ({ productId: item.productId, qtySent: item.qty })),
                },
              },
            },
          });

          await this.activityLog.record(tx, {
            entityType: 'stock_distribution',
            entityId: distributionId,
            action: 'SENT',
            actorId,
            actorName,
            note: `Dikirim ke Booth ${booth.name}, ${dto.items.length} baris.`,
          });
        });
        break;
      } catch (err) {
        const bentrokNomor = err instanceof Prisma.PrismaClientKnownRequestError && err.code === KODE_UNIQUE_VIOLATION;
        if (!bentrokNomor || percobaan === MAKS_PERCOBAAN_NOMOR - 1) throw err;
      }
    }

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
    const reasonByProduct = new Map(dto.items.map((i) => [i.productId, { reasonCode: i.reasonCode, reasonNote: i.reasonNote }]));
    const receivedAt = new Date();
    const businessDate = businessDateOf(receivedAt);

    await this.prisma.$transaction(async (tx) => {
      const shiftSessionId = await cariShiftTerbukaBoothStaff(tx, distribution.boothId, user.sub);

      for (const item of distribution.items) {
        const actualQty = qtyByProduct.get(item.productId) ?? item.qtySent;
        const reason = actualQty !== item.qtySent ? reasonByProduct.get(item.productId) : undefined;

        await tx.stockDistributionItem.update({
          where: { id: item.id },
          data: {
            qtyReceived: actualQty,
            discrepancyReasonCode: reason?.reasonCode ?? null,
            discrepancyNote: reason?.reasonNote ?? null,
          },
        });

        if (actualQty > 0) {
          await tx.boothStock.upsert({
            where: { boothId_productId: { boothId: distribution.boothId, productId: item.productId } },
            create: { boothId: distribution.boothId, productId: item.productId, qtyOnHand: actualQty },
            update: { qtyOnHand: { increment: actualQty }, version: { increment: 1 } },
          });

          await tx.stockMovement.create({
            data: {
              movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
              movementType: StockMovementType.WAREHOUSE_TO_BOOTH,
              productId: item.productId,
              qty: actualQty,
              toBoothId: distribution.boothId,
              referenceType: 'stock_distribution',
              referenceId: distribution.id,
              businessDate,
              occurredAt: receivedAt,
              createdBy: user.sub,
              shiftSessionId,
            },
          });
        }
      }

      const hasDiscrepancy = distribution.items.some(
        (item) => (qtyByProduct.get(item.productId) ?? item.qtySent) !== item.qtySent,
      );

      // Catatan Petugas (alasan selisih per produk) disimpan di DUA tempat:
      // activity log (riwayat lengkap) DAN `note` dokumen ini (supaya langsung
      // kelihatan di list/detail Admin tanpa perlu buka tab Riwayat Aktivitas
      // dulu — lihat keluhan "tidak ada keterangan selisih" di sisi Admin).
      const catatanSelisih = hasDiscrepancy && dto.note ? dto.note : undefined;

      await tx.stockDistribution.update({
        where: { id: distribution.id },
        data: {
          status: hasDiscrepancy ? DistributionStatus.DISCREPANCY : DistributionStatus.RECEIVED,
          receivedAt,
          receivedById: user.sub,
          ...(catatanSelisih
            ? {
                note: distribution.note
                  ? `${distribution.note} | Catatan Petugas (selisih): ${catatanSelisih}`
                  : `Catatan Petugas (selisih): ${catatanSelisih}`,
              }
            : {}),
        },
      });

      await this.activityLog.record(tx, {
        entityType: 'stock_distribution',
        entityId: distribution.id,
        action: hasDiscrepancy ? 'RECEIVED_WITH_DISCREPANCY' : 'RECEIVED',
        actorId: user.sub,
        actorName: user.username,
        note:
          (hasDiscrepancy ? 'Diterima dengan selisih qty.' : 'Diterima sesuai qty dikirim.') +
          (catatanSelisih ? ` Catatan Petugas: ${catatanSelisih}` : ''),
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
            movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
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

      await this.activityLog.record(tx, {
        entityType: 'stock_distribution',
        entityId: distribution.id,
        action: 'CANCELLED',
        actorId: user.sub,
        actorName: user.username,
        note: dto.reasonNote ?? dto.reasonCode,
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

    const now = new Date();
    let newDistributionId = '';

    try {
      for (let percobaan = 0; percobaan < MAKS_PERCOBAAN_NOMOR; percobaan++) {
      newDistributionId = randomUUID();
      try {
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
            movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
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
          distributionNo: await this.nomorDistribusiBerikutnya(tx),
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

      await this.activityLog.record(tx, {
        entityType: 'stock_distribution',
        entityId: distribution.id,
        action: 'REVISED',
        actorId: user.sub,
        actorName: user.username,
        note: `Direvisi menjadi dokumen baru (v${distribution.versionNo + 1}). ${dto.reasonNote ?? dto.reasonCode}`,
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
          sourceEntityType: 'stock_distribution',
          sourceEntityId: distribution.id,
          severity: 'CRITICAL',
          reasonCode: dto.reasonCode,
          details: { error: err.message, correctionInput: dto },
        });
        throw new DomainError(
          'RECONCILIATION_REQUIRED',
          `Revisi tidak bisa diterapkan otomatis karena stok Gudang akan negatif. Dibuat kasus rekonsiliasi ${reconciliationCase.caseNo}.`,
          { caseId: reconciliationCase.id, caseNo: reconciliationCase.caseNo },
        );
      }
      throw err;
    }

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
    const tindakLanjutByProduct = new Map(dto.items.map((i) => [i.productId, i.tindakLanjut]));
    const tindakLanjutNoteByProduct = new Map(dto.items.map((i) => [i.productId, i.tindakLanjutNote]));
    const now = new Date();
    const deltas: { productId: string; delta: number }[] = [];

    for (const item of distribution.items) {
      const correctedQty = correctedQtyByProduct.get(item.productId);
      if (correctedQty === undefined) continue;
      const recordedQty = item.qtyReceived ?? item.qtySent;
      const delta = correctedQty - recordedQty;
      if (delta !== 0) deltas.push({ productId: item.productId, delta });
    }

    // Ganti Rugi Petugas dibebankan ke Petugas yang mengonfirmasi terima —
    // tanpa itu tidak ada yang bisa ditagih, jadi tolak di depan sebelum
    // transaksi jalan (bukan partial-apply lalu gagal di tengah).
    const adaGantiRugi = dto.items.some((i) => i.tindakLanjut === 'GANTI_RUGI_PETUGAS');
    if (adaGantiRugi && !distribution.receivedById) {
      throw new DomainError(
        'NO_RECEIVER',
        'Tidak bisa mencatat Ganti Rugi Petugas — dokumen ini belum punya Petugas yang menerima.',
      );
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

          const tindakLanjutBaris = tindakLanjutByProduct.get(productId);
          await tx.stockMovement.create({
            data: {
              movementNo: await nomorMovementBerikutnya(tx, 'MOV'),
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
              note: tindakLanjutBaris ? TINDAK_LANJUT_KETERANGAN[tindakLanjutBaris] : (dto.reasonNote ?? dto.reasonCode),
            },
          });
        }

        if (deltas.length > 0 && distribution.status !== DistributionStatus.DISCREPANCY) {
          await tx.stockDistribution.update({
            where: { id: distribution.id },
            data: { status: DistributionStatus.DISCREPANCY },
          });
        }

        const liabilities: { productId: string; qty: number; totalAmount: string }[] = [];
        const catatanLainnya: string[] = [];
        for (const item of distribution.items) {
          const tindakLanjut = tindakLanjutByProduct.get(item.productId);
          if (!tindakLanjut) continue;
          const itemNote = tindakLanjutNoteByProduct.get(item.productId);

          if (tindakLanjut === 'RUSAK') {
            await tx.stockDistributionItem.update({
              where: { id: item.id },
              data: { discrepancyReasonCode: 'RUSAK' },
            });
          } else if (tindakLanjut === 'SALAH_HITUNG') {
            await tx.stockDistributionItem.update({
              where: { id: item.id },
              data: { discrepancyReasonCode: null },
            });
          } else if (tindakLanjut === 'GANTI_RUGI_PETUGAS') {
            const correctedQty = correctedQtyByProduct.get(item.productId) ?? (item.qtyReceived ?? item.qtySent);
            const qtyRugi = item.qtySent - correctedQty;
            if (qtyRugi <= 0) continue;
            const unitPrice = item.product.sellPrice;
            const totalAmount = unitPrice * BigInt(qtyRugi);
            await tx.staffLiability.create({
              data: {
                distributionId: distribution.id,
                productId: item.productId,
                staffId: distribution.receivedById!,
                qty: qtyRugi,
                unitPrice,
                totalAmount,
                note: itemNote ?? dto.reasonNote,
                createdById: user.sub,
              },
            });
            liabilities.push({ productId: item.productId, qty: qtyRugi, totalAmount: totalAmount.toString() });
          } else if (tindakLanjut === 'LAINNYA' && itemNote) {
            catatanLainnya.push(`${item.product.name}: ${itemNote}`);
          }
        }

        await this.corrections.record(tx, {
          entityType: 'stock_distribution',
          entityId: distribution.id,
          transactionGroupId: distribution.transactionGroupId,
          correctionType: 'ADJUSTMENT',
          originalVersionId: distribution.id,
          reasonCode: dto.reasonCode,
          reasonNote: dto.reasonNote,
          impactSnapshot: { deltas, liabilities },
          createdById: user.sub,
          idempotencyKey: dto.idempotencyKey,
        });

        const catatanGantiRugi =
          liabilities.length > 0
            ? ` Ganti Rugi Petugas: ${liabilities.length} produk, total Rp${liabilities.reduce((s, l) => s + BigInt(l.totalAmount), 0n).toString()}.`
            : '';
        const catatanLainnyaGabungan = catatanLainnya.length > 0 ? ` Lainnya: ${catatanLainnya.join('; ')}.` : '';
        await this.activityLog.record(tx, {
          entityType: 'stock_distribution',
          entityId: distribution.id,
          action: 'RECEIPT_CORRECTED',
          actorId: user.sub,
          actorName: user.username,
          note: (dto.reasonNote ?? dto.reasonCode) + catatanGantiRugi + catatanLainnyaGabungan,
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
      include: { booth: true, receivedBy: true, items: { include: { product: { include: { category: true } } } } },
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
      receivedById: distribution.receivedById,
      receivedByName: distribution.receivedBy?.fullName ?? null,
      note: distribution.note,
      items: distribution.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productCategory: item.product.category?.name ?? null,
        sellPrice: Number(item.product.sellPrice),
        qtySent: item.qtySent,
        qtyReceived: item.qtyReceived,
      })),
    };
  }
}
