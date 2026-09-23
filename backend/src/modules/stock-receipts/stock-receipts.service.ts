import { Injectable } from '@nestjs/common';
import { Prisma, StockMovementType, StockReceiptStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { generateDocNo } from '../../common/doc-no';
import { ActivityLogService } from '../../common/activity-log.service';
import { CreateStockReceiptDto } from './dto/create-stock-receipt.dto';
import { UpdateStockReceiptDto } from './dto/update-stock-receipt.dto';

function businessDateOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/// Kode error unique-constraint Prisma — dipakai untuk retry saat dua
/// permintaan bersamaan kebetulan membaca nomor tertinggi yang sama.
const KODE_UNIQUE_VIOLATION = 'P2002';
const MAKS_PERCOBAAN_NOMOR = 5;

/// Tambah Stok Gudang — DRAFT tidak menyentuh stok sama sekali; stok baru
/// bergerak saat Posting. Revisi atas dokumen POSTED selalu berupa dokumen
/// BARU (lineage lewat transactionGroupId/versionNo/revisionOfId) yang saat
/// di-posting membalik efek versi lama lalu menerapkan angka baru, atomik
/// dalam satu transaksi — dokumen lama tidak pernah diedit langsung.
@Injectable()
export class StockReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  /// Nomor bukti sederhana: `TRM-000001` sampai `TRM-999999`, naik satu per
  /// dokumen. Diambil dari nomor TERBESAR yang sudah ada (bukan dari jumlah
  /// baris) — pola sama dengan kode SKU Produk (`OBL-0001`) di
  /// products.service.ts, supaya nomor tidak pernah terulang walau ada
  /// dokumen yang lebih dulu dibuat lalu dihapus dari rentang pencarian.
  private async nomorBerikutnya(tx: Prisma.TransactionClient): Promise<string> {
    const semua = await tx.stockReceipt.findMany({
      where: { receiptNo: { startsWith: 'TRM-' } },
      select: { receiptNo: true },
    });

    const tertinggi = semua.reduce((maks, r) => {
      const cocok = /^TRM-(\d{6})$/.exec(r.receiptNo);
      return cocok ? Math.max(maks, Number(cocok[1])) : maks;
    }, 0);

    if (tertinggi >= 999999) {
      throw new DomainError('RECEIPT_NO_EXHAUSTED', 'Nomor bukti Tambah Stok Gudang sudah mencapai batas 999999.');
    }

    return `TRM-${String(tertinggi + 1).padStart(6, '0')}`;
  }

  private include() {
    return {
      items: { include: { product: { select: { id: true, sku: true, name: true } } }, orderBy: { product: { name: 'asc' as const } } },
      createdBy: { select: { id: true, username: true, fullName: true } },
      postedBy: { select: { id: true, username: true, fullName: true } },
      // Dua arah rantai revisi: dari dokumen REVISI, `revisionOf` menunjuk ke
      // dokumen ASAL ("revisi dari TRM-000001"); dari dokumen ASAL, `revisedBy`
      // menunjuk ke revisi terbarunya ("sudah digantikan oleh TRM-000002").
      // Sebelum ini keduanya cuma ID mentah (`revisionOfId`), UI tidak bisa
      // menampilkan nomor buktinya tanpa fetch terpisah.
      revisionOf: { select: { id: true, receiptNo: true, versionNo: true } },
      revisedBy: { select: { id: true, receiptNo: true, versionNo: true } },
    };
  }

  findAll() {
    return this.prisma.stockReceipt.findMany({
      include: this.include(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id }, include: this.include() });
    if (!receipt) throw new DomainError('NOT_FOUND', 'Dokumen Tambah Stok Gudang tidak ditemukan.');
    return receipt;
  }

  /// Dokumen dibuat sekali sebagai DRAFT, ATAU langsung diposting kalau
  /// `dto.status === 'POSTED'` — dua tombol (Simpan Draft / Posting) di
  /// layar sama-sama lewat method ini, cuma beda status tujuan.
  async create(dto: CreateStockReceiptDto, actorId: string, actorName: string) {
    const existing = await this.prisma.stockReceipt.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existing) return this.findOne(existing.id);

    const receiptDate = businessDateOf(new Date(dto.receiptDate));
    const items = dto.items.filter((i) => i.qtyReceived > 0);

    if (dto.status === 'POSTED' && items.length === 0) {
      throw new DomainError('EMPTY_RECEIPT', 'Isi minimal satu baris Qty Terima sebelum Posting.');
    }

    let receiptId = '';
    for (let percobaan = 0; percobaan < MAKS_PERCOBAAN_NOMOR; percobaan++) {
      receiptId = randomUUID();
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.stockReceipt.create({
            data: {
              id: receiptId,
              receiptNo: await this.nomorBerikutnya(tx),
              status: StockReceiptStatus.DRAFT,
              receiptDate,
              note: dto.note,
              idempotencyKey: dto.idempotencyKey,
              createdById: actorId,
              items: { createMany: { data: items.map((i) => ({ productId: i.productId, qtyReceived: i.qtyReceived })) } },
            },
          });

          await this.activityLog.record(tx, {
            entityType: 'stock_receipt',
            entityId: receiptId,
            action: 'CREATE',
            actorId,
            actorName,
            note: `Draft Tambah Stok Gudang dibuat, ${items.length} baris.`,
          });

          if (dto.status === 'POSTED') {
            await this.postDalamTransaksi(tx, receiptId, actorId, actorName);
          }
        });
        break;
      } catch (err) {
        // Dua permintaan bersamaan bisa membaca nomor tertinggi yang sama —
        // constraint unik di receiptNo menangkapnya, coba lagi dengan nomor
        // yang sudah bertambah satu. Error lain (mis. stok tidak cukup)
        // dilempar apa adanya, tidak diulang.
        const bentrokNomor = err instanceof Prisma.PrismaClientKnownRequestError && err.code === KODE_UNIQUE_VIOLATION;
        if (!bentrokNomor || percobaan === MAKS_PERCOBAAN_NOMOR - 1) throw err;
      }
    }

    return this.findOne(receiptId);
  }

  /// Hanya boleh mengubah dokumen yang MASIH DRAFT. `items` kalau dikirim
  /// menggantikan seluruh baris (hapus lalu buat ulang) — lebih sederhana
  /// dan tetap aman karena belum ada movement yang bergantung padanya.
  async update(id: string, dto: UpdateStockReceiptDto, actorId: string, actorName: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id } });
    if (!receipt) throw new DomainError('NOT_FOUND', 'Dokumen Tambah Stok Gudang tidak ditemukan.');
    if (receipt.status !== StockReceiptStatus.DRAFT) {
      throw new DomainError('RECEIPT_NOT_EDITABLE', 'Hanya dokumen berstatus Draft yang bisa diubah.', { status: receipt.status });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.stockReceipt.update({
        where: { id },
        data: {
          receiptDate: dto.receiptDate ? businessDateOf(new Date(dto.receiptDate)) : undefined,
          note: dto.note,
        },
      });

      if (dto.items) {
        const items = dto.items.filter((i) => i.qtyReceived > 0);
        await tx.stockReceiptItem.deleteMany({ where: { receiptId: id } });
        if (items.length > 0) {
          await tx.stockReceiptItem.createMany({
            data: items.map((i) => ({ receiptId: id, productId: i.productId, qtyReceived: i.qtyReceived })),
          });
        }
      }

      await this.activityLog.record(tx, {
        entityType: 'stock_receipt',
        entityId: id,
        action: 'UPDATE',
        actorId,
        actorName,
        note: 'Draft Tambah Stok Gudang diperbarui.',
      });
    });

    return this.findOne(id);
  }

  /// Hanya dokumen DRAFT yang boleh dihapus — belum pernah menyentuh stok
  /// sama sekali (lihat postDalamTransaksi: efek stok baru terjadi saat
  /// Posting), jadi hard-delete di sini tidak melanggar "Posted transactions
  /// are never hard-deleted" di AGENTS.md. `StockReceiptItem` ikut terhapus
  /// lewat `onDelete: Cascade` di schema.
  async remove(id: string, actorId: string, actorName: string) {
    const receipt = await this.prisma.stockReceipt.findUnique({ where: { id } });
    if (!receipt) throw new DomainError('NOT_FOUND', 'Dokumen Tambah Stok Gudang tidak ditemukan.');
    if (receipt.status !== StockReceiptStatus.DRAFT) {
      throw new DomainError('RECEIPT_NOT_DRAFT', 'Hanya dokumen berstatus Draft yang bisa dihapus. Dokumen Posted memakai jalur Revisi.', {
        status: receipt.status,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await this.activityLog.record(tx, {
        entityType: 'stock_receipt',
        entityId: id,
        action: 'DELETE',
        actorId,
        actorName,
        note: `Draft ${receipt.receiptNo} dihapus.`,
      });
      await tx.stockReceipt.delete({ where: { id } });
    });
  }

  /// Tombol Posting. DRAFT biasa: cukup terapkan qty-nya. DRAFT hasil Revisi
  /// (`revisionOfId` terisi): membalik dulu efek dokumen asal, baru
  /// menerapkan angka baru — dua-duanya dalam SATU transaksi, supaya tidak
  /// pernah ada jeda saat stok sempat "hilang" di antara reversal dan
  /// penerapan ulang.
  async post(id: string, actorId: string, actorName: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.postDalamTransaksi(tx, id, actorId, actorName);
    });
    return this.findOne(id);
  }

  private async postDalamTransaksi(tx: Prisma.TransactionClient, id: string, actorId: string, actorName: string) {
    const receipt = await tx.stockReceipt.findUnique({ where: { id }, include: { items: true } });
    if (!receipt) throw new DomainError('NOT_FOUND', 'Dokumen Tambah Stok Gudang tidak ditemukan.');
    if (receipt.status !== StockReceiptStatus.DRAFT) {
      throw new DomainError('RECEIPT_NOT_DRAFT', 'Hanya dokumen berstatus Draft yang bisa diposting.', { status: receipt.status });
    }
    if (receipt.items.length === 0) {
      throw new DomainError('EMPTY_RECEIPT', 'Isi minimal satu baris Qty Terima sebelum Posting.');
    }

    const now = new Date();

    if (receipt.revisionOfId) {
      const asal = await tx.stockReceipt.findUnique({ where: { id: receipt.revisionOfId }, include: { items: true } });
      if (!asal || asal.status !== StockReceiptStatus.POSTED) {
        throw new DomainError('REVISION_SOURCE_INVALID', 'Dokumen asal revisi tidak ditemukan atau bukan berstatus Posted.');
      }

      // Hanya produk yang qty-nya BENAR-BENAR berubah yang menulis baris
      // ledger — produk yang tidak ikut diedit tidak boleh kelihatan seperti
      // "keluar lalu masuk lagi" di riwayat, itu bikin bingung (lihat
      // percakapan yang menemukan ini). Efeknya juga membetulkan false
      // positive INSUFFICIENT_STOCK lama: dulu syaratnya "stok ≥ qty PENUH
      // versi lama" walau perubahan aktualnya kecil; sekarang syaratnya cuma
      // "stok ≥ selisih yang benar-benar berkurang".
      const qtyAsalByProduct = new Map(asal.items.map((i) => [i.productId, i.qtyReceived]));
      const qtyBaruByProduct = new Map(receipt.items.map((i) => [i.productId, i.qtyReceived]));
      const semuaProductId = new Set([...qtyAsalByProduct.keys(), ...qtyBaruByProduct.keys()]);

      for (const productId of semuaProductId) {
        const qtyAsal = qtyAsalByProduct.get(productId) ?? 0;
        const qtyBaru = qtyBaruByProduct.get(productId) ?? 0;
        const delta = qtyBaru - qtyAsal;
        if (delta === 0) continue;

        if (delta < 0) {
          const berkurang = -delta;
          const dikurangi = await tx.warehouseStock.updateMany({
            where: { productId, qtyOnHand: { gte: berkurang } },
            data: { qtyOnHand: { decrement: berkurang }, version: { increment: 1 } },
          });
          if (dikurangi.count !== 1) {
            throw new DomainError(
              'INSUFFICIENT_STOCK',
              'Revisi ini akan membuat stok Gudang negatif — sebagian stok dari dokumen asal sudah terlanjur didistribusikan/terjual.',
              { productId },
            );
          }
          await tx.stockMovement.create({
            data: {
              movementNo: generateDocNo('MOV'),
              movementType: StockMovementType.ADJUSTMENT,
              productId,
              qty: berkurang,
              referenceType: 'stock_receipt_reversal_out',
              referenceId: asal.id,
              businessDate: businessDateOf(now),
              occurredAt: now,
              createdBy: actorId,
              note: `Dikurangi ${berkurang} karena direvisi oleh ${receipt.receiptNo} (qty ${qtyAsal} → ${qtyBaru}).`,
            },
          });
        } else {
          await tx.warehouseStock.upsert({
            where: { productId },
            create: { productId, qtyOnHand: delta },
            update: { qtyOnHand: { increment: delta }, version: { increment: 1 } },
          });
          await tx.stockMovement.create({
            data: {
              movementNo: generateDocNo('MOV'),
              movementType: StockMovementType.OPENING,
              productId,
              qty: delta,
              referenceType: 'stock_receipt_in',
              referenceId: receipt.id,
              businessDate: receipt.receiptDate,
              occurredAt: now,
              createdBy: actorId,
              note: qtyAsal > 0 ? `Ditambah ${delta} karena direvisi dari ${asal.receiptNo} (qty ${qtyAsal} → ${qtyBaru}).` : undefined,
            },
          });
        }
      }

      await tx.stockReceipt.update({ where: { id: asal.id }, data: { status: StockReceiptStatus.REVISED } });
    } else {
      for (const item of receipt.items) {
        await tx.warehouseStock.upsert({
          where: { productId: item.productId },
          create: { productId: item.productId, qtyOnHand: item.qtyReceived },
          update: { qtyOnHand: { increment: item.qtyReceived }, version: { increment: 1 } },
        });
        await tx.stockMovement.create({
          data: {
            movementNo: generateDocNo('MOV'),
            movementType: StockMovementType.OPENING,
            productId: item.productId,
            qty: item.qtyReceived,
            referenceType: 'stock_receipt_in',
            referenceId: receipt.id,
            businessDate: receipt.receiptDate,
            occurredAt: now,
            createdBy: actorId,
          },
        });
      }
    }

    await tx.stockReceipt.update({
      where: { id },
      data: { status: StockReceiptStatus.POSTED, postedAt: now, postedById: actorId },
    });

    await this.activityLog.record(tx, {
      entityType: 'stock_receipt',
      entityId: id,
      action: receipt.revisionOfId ? 'POST_REVISION' : 'POST',
      actorId,
      actorName,
      note: `${receipt.receiptNo} diposting, ${receipt.items.length} baris, stok Gudang bertambah.`,
    });
  }

  /// Tombol Revisi — bukan mengedit dokumen POSTED, melainkan membuat DRAFT
  /// baru berisi salinan angka terkininya untuk diedit ulang. Perubahan
  /// stoknya baru terjadi saat draft ini di-posting (lihat postDalamTransaksi).
  async startRevision(id: string, actorId: string, actorName: string) {
    const asal = await this.prisma.stockReceipt.findUnique({ where: { id }, include: { items: true } });
    if (!asal) throw new DomainError('NOT_FOUND', 'Dokumen Tambah Stok Gudang tidak ditemukan.');
    if (asal.status !== StockReceiptStatus.POSTED) {
      throw new DomainError('RECEIPT_NOT_POSTED', 'Hanya dokumen berstatus Posted yang bisa direvisi.', { status: asal.status });
    }

    const sudahDirevisi = await this.prisma.stockReceipt.findUnique({ where: { revisionOfId: id } });
    if (sudahDirevisi) {
      throw new DomainError('REVISION_ALREADY_EXISTS', 'Dokumen ini sudah punya revisi. Buka revisinya, bukan mulai yang baru.', {
        revisionId: sudahDirevisi.id,
      });
    }

    let revisiId = '';
    for (let percobaan = 0; percobaan < MAKS_PERCOBAAN_NOMOR; percobaan++) {
      revisiId = randomUUID();
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.stockReceipt.create({
            data: {
              id: revisiId,
              receiptNo: await this.nomorBerikutnya(tx),
              status: StockReceiptStatus.DRAFT,
              receiptDate: asal.receiptDate,
              note: asal.note,
              idempotencyKey: randomUUID(),
              createdById: actorId,
              transactionGroupId: asal.transactionGroupId,
              versionNo: asal.versionNo + 1,
              revisionOfId: asal.id,
              items: { createMany: { data: asal.items.map((i) => ({ productId: i.productId, qtyReceived: i.qtyReceived })) } },
            },
          });

          await this.activityLog.record(tx, {
            entityType: 'stock_receipt',
            entityId: revisiId,
            action: 'CREATE_REVISION',
            actorId,
            actorName,
            note: `Revisi ke-${asal.versionNo + 1} dari ${asal.receiptNo} dimulai.`,
          });
        });
        break;
      } catch (err) {
        const bentrokNomor = err instanceof Prisma.PrismaClientKnownRequestError && err.code === KODE_UNIQUE_VIOLATION;
        if (!bentrokNomor || percobaan === MAKS_PERCOBAAN_NOMOR - 1) throw err;
      }
    }

    return this.findOne(revisiId);
  }
}
