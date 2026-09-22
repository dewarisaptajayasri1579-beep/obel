import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { WAREHOUSE, dampakMutasi, keteranganMutasi, type LokasiStok } from './arah.util';

export interface BarisRekapStok {
  productId: string;
  sku: string;
  name: string;
  saldoAwal: number;
  masuk: number;
  keluar: number;
  saldoAkhir: number;
  perluVerifikasi: boolean;
}

export interface BarisRinciMutasi {
  id: string;
  tanggal: string;
  movementNo: string;
  keterangan: string;
  arah: 'MASUK' | 'KELUAR';
  qty: number;
  saldo: number;
  perluVerifikasi: boolean;
}

/// Pembacaan riwayat & rekap stok dari `stock_movements`.
///
/// READ-ONLY sepenuhnya — tidak ada satu pun tulisan di service ini. Rekap masih
/// dihitung on-the-fly dari ledger, bukan dari tabel cache: untuk volume Obbel
/// sekarang masih murah, dan tabel `rekap_stok` (docsV2 dok 03) nanti menggantikan
/// isinya tanpa mengubah bentuk response ini.
///
/// Seluruh periode dihitung dari `businessDate` (tanggal bisnis), BUKAN
/// `occurredAt` — supaya transaksi bertanggal mundur jatuh di bulan yang benar.
@Injectable()
export class StockMovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /// Batas bulan dalam UTC. `businessDate` disimpan sebagai kolom DATE polos
  /// (tanpa jam), jadi pembandingnya harus UTC murni — memakai kalender lokal
  /// server akan menggeser batas bulan sebesar offset zona waktunya.
  private batasPeriode(bulan: number, tahun: number) {
    if (bulan < 1 || bulan > 12) {
      throw new DomainError('PERIODE_INVALID', 'Bulan harus di antara 1 sampai 12.', { bulan });
    }
    if (tahun < 2020 || tahun > 2100) {
      throw new DomainError('PERIODE_INVALID', 'Tahun tidak masuk akal.', { tahun });
    }
    return {
      awal: new Date(Date.UTC(tahun, bulan - 1, 1)),
      akhir: new Date(Date.UTC(tahun, bulan, 1)),
    };
  }

  /// Hanya menarik movement yang mungkin menyentuh lokasi yang diminta. Untuk
  /// Gudang tidak ada penyaring booth yang bisa dipasang di SQL (baris Gudang
  /// ditandai dengan from/to yang dua-duanya null, tapi baris booth pun ikut
  /// relevan lewat pasangannya), jadi penyaringan akhirnya tetap di
  /// `dampakMutasi()` yang mengembalikan delta 0 untuk yang tidak relevan.
  private filterLokasi(lokasi: LokasiStok): Prisma.StockMovementWhereInput {
    if (lokasi === WAREHOUSE) return {};
    return { OR: [{ fromBoothId: lokasi }, { toBoothId: lokasi }] };
  }

  /// Tab Rekap — satu baris per produk untuk satu bulan.
  async rekap(params: { bulan: number; tahun: number; lokasi: LokasiStok }): Promise<{
    periode: { bulan: number; tahun: number };
    lokasi: LokasiStok;
    rows: BarisRekapStok[];
    total: Omit<BarisRekapStok, 'productId' | 'sku' | 'name'>;
  }> {
    const { bulan, tahun, lokasi } = params;
    const { awal, akhir } = this.batasPeriode(bulan, tahun);
    const filter = this.filterLokasi(lokasi);

    const [products, sebelum, periode] = await Promise.all([
      this.prisma.product.findMany({
        where: { active: true },
        select: { id: true, sku: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.stockMovement.findMany({ where: { ...filter, businessDate: { lt: awal } } }),
      this.prisma.stockMovement.findMany({
        where: { ...filter, businessDate: { gte: awal, lt: akhir } },
      }),
    ]);

    const saldoAwal = new Map<string, number>();
    const masuk = new Map<string, number>();
    const keluar = new Map<string, number>();
    const ragu = new Set<string>();

    for (const m of sebelum) {
      const { delta, perluVerifikasi } = dampakMutasi(m, lokasi);
      if (delta === 0) continue;
      saldoAwal.set(m.productId, (saldoAwal.get(m.productId) ?? 0) + delta);
      if (perluVerifikasi) ragu.add(m.productId);
    }

    for (const m of periode) {
      const { delta, perluVerifikasi } = dampakMutasi(m, lokasi);
      if (delta === 0) continue;
      if (delta > 0) masuk.set(m.productId, (masuk.get(m.productId) ?? 0) + delta);
      else keluar.set(m.productId, (keluar.get(m.productId) ?? 0) - delta);
      if (perluVerifikasi) ragu.add(m.productId);
    }

    const rows: BarisRekapStok[] = products.map((p) => {
      const awalQty = saldoAwal.get(p.id) ?? 0;
      const masukQty = masuk.get(p.id) ?? 0;
      const keluarQty = keluar.get(p.id) ?? 0;
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        saldoAwal: awalQty,
        masuk: masukQty,
        keluar: keluarQty,
        saldoAkhir: awalQty + masukQty - keluarQty,
        perluVerifikasi: ragu.has(p.id),
      };
    });

    const total = rows.reduce(
      (acc, r) => ({
        saldoAwal: acc.saldoAwal + r.saldoAwal,
        masuk: acc.masuk + r.masuk,
        keluar: acc.keluar + r.keluar,
        saldoAkhir: acc.saldoAkhir + r.saldoAkhir,
        perluVerifikasi: acc.perluVerifikasi || r.perluVerifikasi,
      }),
      { saldoAwal: 0, masuk: 0, keluar: 0, saldoAkhir: 0, perluVerifikasi: false },
    );

    return { periode: { bulan, tahun }, lokasi, rows, total };
  }

  /// Ringkasan stok SELURUH produk dipecah per lokasi (Gudang Pusat + tiap Booth).
  /// Dipakai kolom "Total Stok" di daftar produk sekaligus tabel di baris yang
  /// dibuka — satu panggilan, bukan satu per baris tabel, karena daftar produk
  /// jauh lebih sering dibuka daripada rincian satu produk dan N+1 di situ
  /// langsung terasa.
  async ringkasPerLokasi(params: { bulan: number; tahun: number }) {
    const { bulan, tahun } = params;
    const { awal, akhir } = this.batasPeriode(bulan, tahun);

    const [products, booths, sebelum, periode] = await Promise.all([
      this.prisma.product.findMany({
        select: { id: true, sku: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.booth.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.stockMovement.findMany({ where: { businessDate: { lt: awal } } }),
      this.prisma.stockMovement.findMany({ where: { businessDate: { gte: awal, lt: akhir } } }),
    ]);

    const lokasiList: { tipe: 'WAREHOUSE' | 'BOOTH'; id: LokasiStok; nama: string }[] = [
      { tipe: 'WAREHOUSE', id: WAREHOUSE, nama: 'Gudang Pusat' },
      ...booths.map((b) => ({ tipe: 'BOOTH' as const, id: b.id as LokasiStok, nama: b.name })),
    ];

    // Satu lintasan per lokasi atas dua kumpulan movement. Movement yang tidak
    // menyentuh lokasi itu mengembalikan delta 0, jadi penyaringnya tetap satu
    // tempat — `dampakMutasi` — bukan tersebar di query.
    const akum = new Map<string, { saldoAwal: number; masuk: number; keluar: number; ragu: boolean }>();
    const kunci = (productId: string, lokasi: LokasiStok) => `${productId}|${lokasi}`;

    for (const lok of lokasiList) {
      for (const m of sebelum) {
        const d = dampakMutasi(m, lok.id);
        if (d.delta === 0) continue;
        const k = kunci(m.productId, lok.id);
        const cur = akum.get(k) ?? { saldoAwal: 0, masuk: 0, keluar: 0, ragu: false };
        cur.saldoAwal += d.delta;
        cur.ragu = cur.ragu || d.perluVerifikasi;
        akum.set(k, cur);
      }
      for (const m of periode) {
        const d = dampakMutasi(m, lok.id);
        if (d.delta === 0) continue;
        const k = kunci(m.productId, lok.id);
        const cur = akum.get(k) ?? { saldoAwal: 0, masuk: 0, keluar: 0, ragu: false };
        if (d.delta > 0) cur.masuk += d.delta;
        else cur.keluar -= d.delta;
        cur.ragu = cur.ragu || d.perluVerifikasi;
        akum.set(k, cur);
      }
    }

    const rows = products.map((p) => {
      const lokasi = lokasiList
        .map((lok) => {
          const a = akum.get(kunci(p.id, lok.id)) ?? { saldoAwal: 0, masuk: 0, keluar: 0, ragu: false };
          return {
            tipe: lok.tipe,
            lokasiId: lok.id,
            nama: lok.nama,
            saldoAwal: a.saldoAwal,
            masuk: a.masuk,
            keluar: a.keluar,
            saldoAkhir: a.saldoAwal + a.masuk - a.keluar,
            perluVerifikasi: a.ragu,
          };
        })
        // Lokasi yang seluruh angkanya nol dibuang — dengan belasan booth,
        // menampilkan semuanya berarti panel rincian penuh baris nol dan yang
        // benar-benar bergerak jadi tenggelam. Membuangnya tidak mengubah total
        // karena yang dibuang memang nol.
        .filter((l) => l.saldoAwal !== 0 || l.masuk !== 0 || l.keluar !== 0);

      const total = lokasi.reduce(
        (acc, l) => ({
          saldoAwal: acc.saldoAwal + l.saldoAwal,
          masuk: acc.masuk + l.masuk,
          keluar: acc.keluar + l.keluar,
          saldoAkhir: acc.saldoAkhir + l.saldoAkhir,
          perluVerifikasi: acc.perluVerifikasi || l.perluVerifikasi,
        }),
        { saldoAwal: 0, masuk: 0, keluar: 0, saldoAkhir: 0, perluVerifikasi: false },
      );

      return { productId: p.id, sku: p.sku, name: p.name, lokasi, total };
    });

    return { periode: { bulan, tahun }, rows };
  }

  /// Tab Rinci — kartu stok satu produk: saldo awal, tiap mutasi, saldo berjalan.
  async rinci(params: {
    productId: string;
    bulan: number;
    tahun: number;
    lokasi: LokasiStok;
  }): Promise<{
    product: { id: string; sku: string; name: string };
    periode: { bulan: number; tahun: number };
    lokasi: LokasiStok;
    ringkasan: { saldoAwal: number; masuk: number; keluar: number; saldoAkhir: number };
    rows: BarisRinciMutasi[];
    perluVerifikasi: boolean;
  }> {
    const { productId, bulan, tahun, lokasi } = params;
    const { awal, akhir } = this.batasPeriode(bulan, tahun);
    const filter = this.filterLokasi(lokasi);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, name: true },
    });
    if (!product) throw new DomainError('NOT_FOUND', 'Produk tidak ditemukan.', { productId });

    const [sebelum, periode] = await Promise.all([
      this.prisma.stockMovement.findMany({ where: { ...filter, productId, businessDate: { lt: awal } } }),
      this.prisma.stockMovement.findMany({
        where: { ...filter, productId, businessDate: { gte: awal, lt: akhir } },
        // businessDate dulu supaya urutan baris sama dengan urutan periodenya;
        // occurredAt jadi pemecah seri untuk transaksi di tanggal yang sama.
        orderBy: [{ businessDate: 'asc' }, { occurredAt: 'asc' }],
      }),
    ]);

    let saldo = 0;
    let ragu = false;
    for (const m of sebelum) {
      const { delta, perluVerifikasi } = dampakMutasi(m, lokasi);
      saldo += delta;
      if (delta !== 0 && perluVerifikasi) ragu = true;
    }
    const saldoAwal = saldo;

    let masuk = 0;
    let keluar = 0;
    const rows: BarisRinciMutasi[] = [];

    for (const m of periode) {
      const { delta, perluVerifikasi } = dampakMutasi(m, lokasi);
      if (delta === 0) continue;
      saldo += delta;
      if (delta > 0) masuk += delta;
      else keluar -= delta;
      if (perluVerifikasi) ragu = true;

      rows.push({
        id: m.id,
        tanggal: m.businessDate.toISOString(),
        movementNo: m.movementNo,
        keterangan: keteranganMutasi(m),
        arah: delta > 0 ? 'MASUK' : 'KELUAR',
        qty: Math.abs(delta),
        saldo,
        perluVerifikasi,
      });
    }

    return {
      product,
      periode: { bulan, tahun },
      lokasi,
      ringkasan: { saldoAwal, masuk, keluar, saldoAkhir: saldoAwal + masuk - keluar },
      rows,
      perluVerifikasi: ragu,
    };
  }
}
