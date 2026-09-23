import { Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DomainError } from '../../common/domain-error';
import { WAREHOUSE, dampakMutasi, keteranganMutasi, type LokasiStok } from './arah.util';

/// Tab "Mutasi Stok" menghitung SEMUA jenis mutasi; tab "Mutasi Penjualan"
/// (halaman Booth) memakai fungsi & bentuk response yang SAMA, cuma disaring
/// ke movement tipe SALE saja lewat parameter ini — supaya tidak ada
/// perhitungan saldo yang diduplikasi dengan rumus berbeda.
export type JenisMutasi = 'SEMUA' | 'PENJUALAN';

function filterJenis(jenis: JenisMutasi): Prisma.StockMovementWhereInput {
  return jenis === 'PENJUALAN' ? { movementType: StockMovementType.SALE } : {};
}

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

export interface BarisRekapBooth {
  boothId: string;
  boothCode: string;
  boothName: string;
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
  /// Siapa yang menginput baris ini (Profile.fullName) — resolusi manual dari
  /// StockMovement.createdBy, yang cuma menyimpan UUID mentah tanpa relasi
  /// Prisma. Null kalau profile-nya sudah tidak ada (data lama/dihapus).
  petugas: string | null;
  /// Shift saat baris ini terjadi (mis. "Pagi", "Malam") — hanya terisi kalau
  /// movement-nya sudah membawa shiftSessionId (lihat catatan di masing-masing
  /// service penulis StockMovement). Null bukan berarti error, bisa juga
  /// memang mutasi yang tidak terikat satu shift (mis. di Gudang).
  shift: string | null;
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
  async rekap(params: { bulan: number; tahun: number; lokasi: LokasiStok; jenis?: JenisMutasi }): Promise<{
    periode: { bulan: number; tahun: number };
    lokasi: LokasiStok;
    rows: BarisRekapStok[];
    total: Omit<BarisRekapStok, 'productId' | 'sku' | 'name'>;
  }> {
    const { bulan, tahun, lokasi, jenis = 'SEMUA' } = params;
    const { awal, akhir } = this.batasPeriode(bulan, tahun);
    const filter = { ...this.filterLokasi(lokasi), ...filterJenis(jenis) };

    const [products, sebelum, periode] = await Promise.all([
      this.prisma.product.findMany({
        where: { active: true, deletedAt: null },
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

  /// Tab Rekap di halaman Booth — sumbunya dibalik dari `rekap()`: satu baris
  /// per BOOTH (bukan per produk), digabung dari SEMUA produk. Dipakai tab
  /// "Mutasi Stok" (jenis SEMUA) maupun "Mutasi Penjualan" (jenis PENJUALAN)
  /// di halaman Booth — baris yang diklik lalu membuka Rinci lewat `rinci()`
  /// dengan `lokasi` = boothId yang sama.
  async rekapPerBooth(params: { bulan: number; tahun: number; jenis?: JenisMutasi }): Promise<{
    periode: { bulan: number; tahun: number };
    rows: BarisRekapBooth[];
    total: Omit<BarisRekapBooth, 'boothId' | 'boothCode' | 'boothName'>;
  }> {
    const { bulan, tahun, jenis = 'SEMUA' } = params;
    const { awal, akhir } = this.batasPeriode(bulan, tahun);
    const filter = filterJenis(jenis);

    const [booths, sebelum, periode] = await Promise.all([
      this.prisma.booth.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, code: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.stockMovement.findMany({ where: { ...filter, businessDate: { lt: awal } } }),
      this.prisma.stockMovement.findMany({ where: { ...filter, businessDate: { gte: awal, lt: akhir } } }),
    ]);

    const saldoAwal = new Map<string, number>();
    const masuk = new Map<string, number>();
    const keluar = new Map<string, number>();
    const ragu = new Set<string>();

    for (const b of booths) {
      for (const m of sebelum) {
        const { delta, perluVerifikasi } = dampakMutasi(m, b.id);
        if (delta === 0) continue;
        saldoAwal.set(b.id, (saldoAwal.get(b.id) ?? 0) + delta);
        if (perluVerifikasi) ragu.add(b.id);
      }
      for (const m of periode) {
        const { delta, perluVerifikasi } = dampakMutasi(m, b.id);
        if (delta === 0) continue;
        if (delta > 0) masuk.set(b.id, (masuk.get(b.id) ?? 0) + delta);
        else keluar.set(b.id, (keluar.get(b.id) ?? 0) - delta);
        if (perluVerifikasi) ragu.add(b.id);
      }
    }

    const rows: BarisRekapBooth[] = booths.map((b) => {
      const awalQty = saldoAwal.get(b.id) ?? 0;
      const masukQty = masuk.get(b.id) ?? 0;
      const keluarQty = keluar.get(b.id) ?? 0;
      return {
        boothId: b.id,
        boothCode: b.code,
        boothName: b.name,
        saldoAwal: awalQty,
        masuk: masukQty,
        keluar: keluarQty,
        saldoAkhir: awalQty + masukQty - keluarQty,
        perluVerifikasi: ragu.has(b.id),
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

    return { periode: { bulan, tahun }, rows, total };
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
        where: { deletedAt: null },
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

  /// Riwayat Stok utk Petugas Booth (`GET /stock-movements/mine`) — daftar
  /// mentah movement yang menyentuh Booth ybs (dari JWT, tidak bisa dipilih
  /// bebas), TIDAK memakai mesin rekap saldo (dampakMutasi dkk) di atas —
  /// ini cuma feed riwayat, bukan kartu stok bersaldo.
  async mutasiUntukBooth(boothId: string, params?: { dari?: Date; sampai?: Date }): Promise<
    {
      id: string;
      movementNo: string;
      movementType: StockMovementType;
      productId: string;
      productName: string;
      qty: number;
      direction: 'IN' | 'OUT';
      occurredAt: Date;
      note: string | null;
    }[]
  > {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        OR: [{ fromBoothId: boothId }, { toBoothId: boothId }],
        ...(params?.dari || params?.sampai
          ? { occurredAt: { gte: params?.dari, lte: params?.sampai } }
          : {}),
      },
      include: { product: true },
      orderBy: { occurredAt: 'desc' },
    });

    return movements.map((m) => ({
      id: m.id,
      movementNo: m.movementNo,
      movementType: m.movementType,
      productId: m.productId,
      productName: m.product.name,
      qty: m.qty,
      direction: m.toBoothId === boothId ? 'IN' : 'OUT',
      occurredAt: m.occurredAt,
      note: m.note,
    }));
  }

  /// Layar "Riwayat Stok" (tab ke-3 Ajukan Restock) Petugas Booth — ledger
  /// SATU produk dgn saldo berjalan, dikunci ke Booth dari JWT + rentang
  /// TANGGAL bebas (bukan bulan kalender kayak `rinci()` Admin, mockup-nya
  /// pakai preset "7 hari terakhir" dst). Pakai mesin arah yang SAMA
  /// (dampakMutasi/keteranganMutasi) — tidak ada rumus saldo kedua yg beda.
  async rinciUntukBooth(params: {
    boothId: string;
    productId: string;
    dari: Date;
    sampai: Date;
  }): Promise<{
    product: { id: string; name: string };
    periode: { dari: string; sampai: string };
    ringkasan: { stokAwal: number; masuk: number; keluar: number; stokAkhir: number };
    rows: {
      id: string;
      tanggal: string;
      movementNo: string;
      jenis: 'MASUK' | 'KELUAR' | 'PENYESUAIAN';
      qty: number;
      stokAkhir: number;
      keterangan: string;
    }[];
  }> {
    const { boothId, productId } = params;
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true, name: true } });
    if (!product) throw new DomainError('NOT_FOUND', 'Produk tidak ditemukan.', { productId });

    // Dinormalkan ke granularitas HARI (bukan timestamp persis) — `businessDate`
    // adalah kolom DATE polos jam 00:00; menerima timestamp apa adanya dari
    // client bisa memotong hari pertama periode kalau jam-nya bukan 00:00.
    // Batas atas EKSKLUSIF hari setelah `sampai`, supaya tanggal `sampai`
    // sendiri ikut penuh.
    const dari = new Date(Date.UTC(params.dari.getUTCFullYear(), params.dari.getUTCMonth(), params.dari.getUTCDate()));
    const sampai = new Date(
      Date.UTC(params.sampai.getUTCFullYear(), params.sampai.getUTCMonth(), params.sampai.getUTCDate() + 1),
    );

    const filterBooth: Prisma.StockMovementWhereInput = { OR: [{ fromBoothId: boothId }, { toBoothId: boothId }] };

    const [sebelum, periode] = await Promise.all([
      this.prisma.stockMovement.findMany({ where: { ...filterBooth, productId, businessDate: { lt: dari } } }),
      this.prisma.stockMovement.findMany({
        where: { ...filterBooth, productId, businessDate: { gte: dari, lt: sampai } },
        orderBy: [{ businessDate: 'asc' }, { occurredAt: 'asc' }],
      }),
    ]);

    let saldo = 0;
    for (const m of sebelum) {
      saldo += dampakMutasi(m, boothId).delta;
    }
    const stokAwal = saldo;

    let masuk = 0;
    let keluar = 0;
    const rows: {
      id: string;
      tanggal: string;
      movementNo: string;
      jenis: 'MASUK' | 'KELUAR' | 'PENYESUAIAN';
      qty: number;
      stokAkhir: number;
      keterangan: string;
    }[] = [];

    for (const m of periode) {
      const { delta } = dampakMutasi(m, boothId);
      if (delta === 0) continue;
      saldo += delta;
      if (delta > 0) masuk += delta;
      else keluar += -delta;

      const jenis: 'MASUK' | 'KELUAR' | 'PENYESUAIAN' =
        m.movementType === StockMovementType.ADJUSTMENT || m.movementType === StockMovementType.VOID_REVERSAL
          ? 'PENYESUAIAN'
          : delta > 0
            ? 'MASUK'
            : 'KELUAR';

      rows.push({
        id: m.id,
        tanggal: m.occurredAt.toISOString(),
        movementNo: m.movementNo,
        jenis,
        qty: delta,
        stokAkhir: saldo,
        keterangan: keteranganMutasi(m),
      });
    }

    return {
      product,
      periode: { dari: dari.toISOString(), sampai: sampai.toISOString() },
      ringkasan: { stokAwal, masuk, keluar, stokAkhir: saldo },
      rows,
    };
  }

  /// `StockMovement.createdBy` cuma menyimpan UUID mentah (tidak ada relasi
  /// Prisma ke Profile — lihat schema.prisma), dan `shiftSessionId` menunjuk
  /// ke ShiftSession yang labelnya (Pagi/Malam) ada di ShiftTemplate. Dua-duanya
  /// diresolusi di sini lewat batch query supaya baris Rinci sebanyak apa pun
  /// tetap dua query tambahan, bukan N+1.
  private async resolvePetugasDanShift(
    movements: { createdBy: string; shiftSessionId: string | null }[],
  ): Promise<{ namaPetugas: Map<string, string>; labelShift: Map<string, string> }> {
    const profileIds = [...new Set(movements.map((m) => m.createdBy))];
    const shiftIds = [...new Set(movements.map((m) => m.shiftSessionId).filter((id): id is string => !!id))];

    const [profiles, shifts] = await Promise.all([
      profileIds.length
        ? this.prisma.profile.findMany({ where: { id: { in: profileIds } }, select: { id: true, fullName: true } })
        : Promise.resolve([]),
      shiftIds.length
        ? this.prisma.shiftSession.findMany({
            where: { id: { in: shiftIds } },
            select: { id: true, shiftTemplate: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);

    return {
      namaPetugas: new Map(profiles.map((p) => [p.id, p.fullName])),
      labelShift: new Map(shifts.map((s) => [s.id, s.shiftTemplate.name])),
    };
  }

  /// Tab Rinci — kartu stok satu produk: saldo awal, tiap mutasi, saldo berjalan.
  async rinci(params: {
    productId: string;
    bulan: number;
    tahun: number;
    lokasi: LokasiStok;
    jenis?: JenisMutasi;
  }): Promise<{
    product: { id: string; sku: string; name: string };
    periode: { bulan: number; tahun: number };
    lokasi: LokasiStok;
    ringkasan: { saldoAwal: number; masuk: number; keluar: number; saldoAkhir: number };
    rows: BarisRinciMutasi[];
    perluVerifikasi: boolean;
  }> {
    const { productId, bulan, tahun, lokasi, jenis = 'SEMUA' } = params;
    const { awal, akhir } = this.batasPeriode(bulan, tahun);
    const filter = { ...this.filterLokasi(lokasi), ...filterJenis(jenis) };

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

    const { namaPetugas, labelShift } = await this.resolvePetugasDanShift(periode);

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
        petugas: namaPetugas.get(m.createdBy) ?? null,
        shift: m.shiftSessionId ? labelShift.get(m.shiftSessionId) ?? null : null,
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
