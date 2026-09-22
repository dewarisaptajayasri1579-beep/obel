import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/// Awalan kode barang. Bukan angka ajaib yang tersebar: satu-satunya tempat
/// pola kode produk didefinisikan.
const SKU_PREFIX = 'OBL';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const products = await this.prisma.product.findMany({
      include: { category: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category?.name ?? null,
      sellPrice: Number(p.sellPrice),
      imageUrl: p.imageUrl,
      active: p.active,
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

  async create(dto: CreateProductDto) {
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

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category?.name ?? null,
      sellPrice: Number(product.sellPrice),
      imageUrl: product.imageUrl,
      active: product.active,
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
  async update(id: string, dto: UpdateProductDto) {
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
      },
      include: { category: true },
    });

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category?.name ?? null,
      sellPrice: Number(product.sellPrice),
      imageUrl: product.imageUrl,
      active: product.active,
    };
  }
}
