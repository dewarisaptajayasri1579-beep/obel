import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { ActivityLogService } from '../../common/activity-log.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/// Awalan kode barang. Bukan angka ajaib yang tersebar: satu-satunya tempat
/// pola kode produk didefinisikan.
const SKU_PREFIX = 'OBL';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async findAll() {
    const products = await this.prisma.product.findMany({
      // Soft-deleted tidak pernah tampil di daftar biasa — lihat AGENTS.md
      // "Aturan Soft Delete". Nonaktif TETAP tampil, hanya digeser ke bawah.
      where: { deletedAt: null },
      include: { category: true },
      // active DESC dulu: nonaktif otomatis ke bawah pada urutan bawaan,
      // tanpa pemakai perlu memilih sortir apa pun.
      orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category?.name ?? null,
      sellPrice: Number(p.sellPrice),
      imageUrl: p.imageUrl,
      active: p.active,
      minimumQty: p.minimumQty,
      criticalQty: p.criticalQty,
    }));
  }

  findCategories() {
    return this.prisma.productCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  /// Tambah kategori dari form Produk (Select kategori dengan opsi "Tambah
  /// kategori ..."). Nama dicek dulu case-insensitive supaya dua admin yang
  /// mengetik "Snack" / "snack" tidak berakhir jadi dua baris kategori kembar
  /// — yang belakangan cukup dikembalikan kategori yang sudah ada.
  async createCategory(dto: CreateProductCategoryDto) {
    const name = dto.name.trim();
    const existing = await this.prisma.productCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      return existing;
    }

    return this.buatKategoriDenganKodeUnik(name);
  }

  /// Kode kategori dibuat otomatis dari nama (mis. "Kopi Susu" -> `KOPI-SUSU`)
  /// karena form Produk hanya meminta nama, sama seperti SKU produk yang
  /// dibuatkan server, bukan diketik pemakai.
  private kodeDariNama(nama: string, percobaan: number): string {
    const dasar =
      nama
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 20) || 'KATEGORI';
    return percobaan === 0 ? dasar : `${dasar}-${percobaan + 1}`;
  }

  private async buatKategoriDenganKodeUnik(nama: string, percobaan = 0): Promise<Prisma.ProductCategoryGetPayload<Record<string, never>>> {
    try {
      const terakhir = await this.prisma.productCategory.aggregate({ _max: { sortOrder: true } });
      return await this.prisma.productCategory.create({
        data: {
          code: this.kodeDariNama(nama, percobaan),
          name: nama,
          sortOrder: (terakhir._max.sortOrder ?? 0) + 1,
        },
      });
    } catch (err) {
      const bentrokKode = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (bentrokKode && percobaan < 5) {
        return this.buatKategoriDenganKodeUnik(nama, percobaan + 1);
      }
      throw err;
    }
  }

  /// Kode barang berikutnya: `OBL-0001`, `OBL-0002`, dst.
  ///
  /// Nomor diambil dari kode TERBESAR yang sudah ada, bukan dari jumlah produk —
  /// menghitung baris akan mengulang nomor begitu ada produk yang dihapus, dan
  /// kode yang berulang berarti dua produk berbeda memakai penanda yang sama di
  /// nota lama. Kode berpola lain (mis. `OBL-ALM` warisan seed) sengaja
  /// diabaikan: yang dicari cuma urutan numeriknya.
  private async kodeBerikutnya(tx: Prisma.TransactionClient): Promise<string> {
    const terakhir = await tx.product.findMany({
      where: { sku: { startsWith: `${SKU_PREFIX}-` } },
      select: { sku: true },
    });

    const tertinggi = terakhir.reduce((maks, p) => {
      const cocok = /^OBL-(\d+)$/.exec(p.sku);
      return cocok ? Math.max(maks, Number(cocok[1])) : maks;
    }, 0);

    return `${SKU_PREFIX}-${String(tertinggi + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateProductDto, actorId: string, actorName: string) {
    if (dto.sku) {
      const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
      if (existing) {
        throw new ConflictException(`SKU "${dto.sku}" sudah dipakai.`);
      }
    }

    // Pembuatan kode dan penyimpanan dijalankan dalam satu transaksi, lalu
    // diulang kalau unique constraint-nya tetap kena — dua admin yang menekan
    // Simpan bersamaan bisa membaca nomor tertinggi yang sama, dan constraint
    // di kolom `sku` adalah penjaga terakhir yang menangkapnya.
    const product = await this.buatDenganKodeUnik(dto);

    await this.activityLog.record(this.prisma, {
      entityType: 'product',
      entityId: product.id,
      action: 'CREATE',
      actorId,
      actorName,
      note: `Produk ${product.sku} "${product.name}" dibuat.`,
    });

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category?.name ?? null,
      sellPrice: Number(product.sellPrice),
      imageUrl: product.imageUrl,
      active: product.active,
      minimumQty: product.minimumQty,
      criticalQty: product.criticalQty,
    };
  }

  private async buatDenganKodeUnik(dto: CreateProductDto, percobaan = 0): Promise<Prisma.ProductGetPayload<{ include: { category: true } }>> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const sku = dto.sku ?? (await this.kodeBerikutnya(tx));
        return tx.product.create({
          data: {
            sku,
            name: dto.name,
            categoryId: dto.categoryId,
            sellPrice: BigInt(dto.sellPrice),
            imageUrl: dto.imageUrl,
          },
          include: { category: true },
        });
      });
    } catch (err) {
      const bentrokKode =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && !dto.sku;
      if (bentrokKode && percobaan < 5) {
        return this.buatDenganKodeUnik(dto, percobaan + 1);
      }
      throw err;
    }
  }

  /// TX-15 — Update master price/nama/status. Berlaku hanya untuk sale
  /// BARU: SaleItem.unitPrice sudah snapshot harga saat transaksi dibuat
  /// (lihat sales.service.ts createPaidSale), jadi mengubah Product di
  /// sini tidak pernah merestate omzet histori.
  async update(id: string, dto: UpdateProductDto, actorId: string, actorName: string) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new DomainError('NOT_FOUND', 'Produk tidak ditemukan.');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
        sellPrice: dto.sellPrice !== undefined ? BigInt(dto.sellPrice) : undefined,
        active: dto.active,
        imageUrl: dto.imageUrl,
        minimumQty: dto.minimumQty,
        criticalQty: dto.criticalQty,
      },
      include: { category: true },
    });

    // Diaktifkan/dinonaktifkan dicatat sebagai aksi TERSENDIRI ("ngapain"
    // harus jelas dari satu baris log, bukan diselipkan di dalam "UPDATE"
    // generik) — inilah kasus yang paling sering dilihat kembali saat
    // menyelidiki kenapa satu produk tiba-tiba hilang dari layar Jual.
    if (dto.active !== undefined && dto.active !== existing.active) {
      await this.activityLog.record(this.prisma, {
        entityType: 'product',
        entityId: product.id,
        action: dto.active ? 'ACTIVATE' : 'DEACTIVATE',
        actorId,
        actorName,
        note: `Produk ${product.sku} ${dto.active ? 'diaktifkan' : 'dinonaktifkan'}.`,
      });
    } else {
      await this.activityLog.record(this.prisma, {
        entityType: 'product',
        entityId: product.id,
        action: 'UPDATE',
        actorId,
        actorName,
        note: `Produk ${product.sku} diperbarui.`,
      });
    }

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category?.name ?? null,
      sellPrice: Number(product.sellPrice),
      imageUrl: product.imageUrl,
      active: product.active,
      minimumQty: product.minimumQty,
      criticalQty: product.criticalQty,
    };
  }

  /// Hapus (soft) — HANYA boleh kalau produk tidak pernah tersentuh transaksi
  /// apa pun. Kalau sudah ada histori, tolak dan arahkan ke Nonaktifkan:
  /// menghapus produk yang pernah terjual akan membuat baris StockMovement
  /// dan SaleItem lama menunjuk ke produk yang "tidak ada", padahal ia harus
  /// tetap bisa dibaca di laporan dan nota lama selamanya.
  async remove(id: string, actorId: string, actorName: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) {
      throw new DomainError('NOT_FOUND', 'Produk tidak ditemukan.');
    }

    const [
      movementCount,
      saleItemCount,
      distributionItemCount,
      restockItemCount,
      returnItemCount,
      opnameItemCount,
      warehouseStock,
      boothStockAgg,
    ] = await Promise.all([
      this.prisma.stockMovement.count({ where: { productId: id } }),
      this.prisma.saleItem.count({ where: { productId: id } }),
      this.prisma.stockDistributionItem.count({ where: { productId: id } }),
      this.prisma.restockRequestItem.count({ where: { productId: id } }),
      this.prisma.stockReturnItem.count({ where: { productId: id } }),
      this.prisma.stockOpnameItem.count({ where: { productId: id } }),
      this.prisma.warehouseStock.findUnique({ where: { productId: id } }),
      this.prisma.boothStock.aggregate({ where: { productId: id }, _sum: { qtyOnHand: true } }),
    ]);

    const totalHistori =
      movementCount + saleItemCount + distributionItemCount + restockItemCount + returnItemCount + opnameItemCount;
    const sisaStok = (warehouseStock?.qtyOnHand ?? 0) + (boothStockAgg._sum.qtyOnHand ?? 0);

    if (totalHistori > 0) {
      throw new DomainError(
        'PRODUCT_HAS_HISTORY',
        `Produk "${product.name}" tidak bisa dihapus karena sudah punya ${totalHistori} riwayat transaksi. Gunakan Nonaktifkan.`,
        { movementCount, saleItemCount, distributionItemCount, restockItemCount, returnItemCount, opnameItemCount },
      );
    }
    if (sisaStok > 0) {
      throw new DomainError(
        'PRODUCT_HAS_STOCK',
        `Produk "${product.name}" masih punya sisa stok ${sisaStok} di gudang/booth. Habiskan atau adjustment ke 0 dulu.`,
        { sisaStok },
      );
    }

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });

    await this.activityLog.record(this.prisma, {
      entityType: 'product',
      entityId: id,
      action: 'SOFT_DELETE',
      actorId,
      actorName,
      note: `Produk ${product.sku} "${product.name}" dihapus (tidak ada riwayat transaksi).`,
    });

    return { id, deleted: true };
  }
}
