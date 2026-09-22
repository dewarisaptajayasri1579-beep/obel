import { Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service.js"
import { StockLedgerService, periodeBulan } from "../stock-ledger/stock-ledger.service.js"
import { resolveReportPeriod } from "../common/report-period.util.js"

export type JenisLokasi = "WAREHOUSE" | "SALES" | "STORE"

export interface BarisRekapStok {
  locationType: JenisLokasi
  locationId: string
  locationName: string
  saldoAwal: number
  debet: number
  kredit: number
  saldoAkhir: number
}

const JENIS: JenisLokasi[] = ["WAREHOUSE", "SALES", "STORE"]

/** Rekap stok satu produk, dibaca seperti buku besar: Saldo Awal (seluruh mutasi SEBELUM periode)
 *  + Debet (masuk) − Kredit (keluar) = Saldo Akhir, dipecah per lokasi penyimpanan.
 *
 *  Semua angkanya diturunkan dari `StockLedger` — SATU-SATUNYA sumber kebenaran stok di app ini
 *  (tidak ada kolom "stok saat ini" yang disimpan di mana pun). Konsekuensinya angka di sini
 *  dijamin cocok dengan halaman `stock/gudang`, `stock/sales`, `stock/toko`, dan Neraca, karena
 *  keempatnya menjumlahkan tabel yang sama.
 *
 *  `locationId` artinya bergantung `locationType`: Warehouse.id (WAREHOUSE), User.id sales
 *  (SALES), atau Store.id (STORE). */
@Injectable()
export class StockProdukService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockLedger: StockLedgerService
  ) {}

  /** Stok per produk yang dipecah gudang/sales/toko, LENGKAP dengan saldo awal/debet/kredit
   *  periode berjalan — dipakai kolom Stok di Master Produk sekaligus tabel rincian saat baris
   *  produknya dibuka.
   *
   *  Tiga groupBy untuk SELURUH produk sekaligus, bukan satu permintaan per baris tabel: daftar
   *  produk dibuka jauh lebih sering daripada rekap per produk, dan N+1 di situ terasa langsung.
   *
   *  `saldoAkhir` = saldo SEPANJANG MASA (saldo awal + mutasi periode), jadi kolom Gudang/Sales/
   *  Toko di daftar tetap menunjukkan stok yang benar-benar ada sekarang — bukan cuma pergerakan
   *  bulan ini. Yang dibatasi periode hanya debet & kreditnya. */
  async ringkas(query: { from?: string; to?: string } = {}) {
    const periode = resolveReportPeriod(query)

    // TIDAK ada satu pun query ke `stock_ledger` di sini — seluruhnya dari dua tabel cache:
    //  - saldo akhir: `stock_balances` (saldo berjalan), dimundurkan oleh bulan-bulan SESUDAH
    //    periode (untuk bulan berjalan, nol baris)
    //  - debet & kredit: `stock_monthly_balances` bulan itu, satu baris per produk x lokasi
    //  - saldo awal diturunkan mundur: awal = akhir − debet + kredit
    // Biaya ketiganya tidak lagi naik mengikuti banyaknya mutasi yang pernah terjadi.
    const periodeKunci = periodeBulan(periode.from)
    const [saldoSekarang, bulanIni, bulanSesudah] = await Promise.all([
      this.prisma.stockBalance.groupBy({ by: ["productId", "locationType"], _sum: { qty: true } }),
      this.prisma.stockMonthlyBalance.groupBy({
        by: ["productId", "locationType"],
        _sum: { debet: true, kredit: true },
        where: { period: periodeKunci },
      }),
      this.prisma.stockMonthlyBalance.groupBy({
        by: ["productId", "locationType"],
        _sum: { debet: true, kredit: true },
        where: { period: { gt: periodeKunci } },
      }),
    ])

    const kosong = () => ({ saldoAwal: 0, debet: 0, kredit: 0, saldoAkhir: 0 })
    type Baris = {
      productId: string
      gudang: ReturnType<typeof kosong>
      sales: ReturnType<typeof kosong>
      toko: ReturnType<typeof kosong>
      gudangTotal: number
      salesTotal: number
      tokoTotal: number
      total: number
    }
    const peta = new Map<string, Baris>()

    const baris = (productId: string) => {
      const ada = peta.get(productId)
      if (ada) return ada
      const baru: Baris = {
        productId,
        gudang: kosong(),
        sales: kosong(),
        toko: kosong(),
        gudangTotal: 0,
        salesTotal: 0,
        tokoTotal: 0,
        total: 0,
      }
      peta.set(productId, baru)
      return baru
    }

    const bagian = (b: Baris, tipe: string) =>
      tipe === "WAREHOUSE" ? b.gudang : tipe === "SALES" ? b.sales : tipe === "STORE" ? b.toko : null

    // Saldo sekarang dulu (jadi patokan), baru dimundurkan oleh bulan-bulan sesudah periode.
    const sekarang = new Map<string, number>()
    for (const r of saldoSekarang) sekarang.set(`${r.productId}|${r.locationType}`, r._sum.qty ?? 0)
    for (const r of bulanSesudah) {
      const k = `${r.productId}|${r.locationType}`
      sekarang.set(k, (sekarang.get(k) ?? 0) - ((r._sum.debet ?? 0) - (r._sum.kredit ?? 0)))
    }
    for (const [k, nilai] of sekarang) {
      const [productId, tipe] = k.split("|")
      const sisi = bagian(baris(productId), tipe)
      if (sisi) sisi.saldoAkhir = nilai
    }

    for (const r of bulanIni) {
      const sisi = bagian(baris(r.productId), r.locationType)
      if (!sisi) continue
      sisi.debet += r._sum.debet ?? 0
      sisi.kredit += r._sum.kredit ?? 0
    }

    for (const b of peta.values()) {
      for (const sisi of [b.gudang, b.sales, b.toko]) sisi.saldoAwal = sisi.saldoAkhir - sisi.debet + sisi.kredit
      b.gudangTotal = b.gudang.saldoAkhir
      b.salesTotal = b.sales.saldoAkhir
      b.tokoTotal = b.toko.saldoAkhir
      b.total = b.gudangTotal + b.salesTotal + b.tokoTotal
    }

    return { period: { from: periode.from.toISOString(), to: periode.to.toISOString() }, rows: Array.from(peta.values()) }
  }

  rekonsiliasi() {
    return this.stockLedger.periksaSaldo(this.prisma)
  }

  bangunUlangSaldo() {
    return this.prisma.$transaction((tx) => this.stockLedger.bangunUlangSaldo(tx))
  }

  /** Akumulasi mutasi BULANAN untuk satu produk atau satu divisi (Tahap 23 langkah 4).
   *
   *  Sumbernya `StockMonthlyBalance` (Tahap 19), BUKAN menjumlah ulang seluruh `StockLedger`
   *  tiap halaman dibuka — itulah alasan tabel saldo bulanan itu dibangun. Saldo awal periode
   *  tetap butuh seluruh bulan SEBELUMNYA, tapi itu pun dibaca dari tabel yang sama.
   *
   *  Nilai dipajang DUA-DUANYA (keputusan Owner): nilai persediaan (x harga beli, angka yang
   *  cocok dengan Neraca) dan potensi omzet (x harga jual toko). Dua angka itu beda maksud dan
   *  gampang tertukar, jadi jangan pernah dikirim sebagai satu kolom "nilai" saja. */
  async mutasiBulanan(query: { productId?: string; businessTypeId?: string; from?: string; to?: string }) {
    const period = resolveReportPeriod(query)
    const bulanMulai = `${period.from.getFullYear()}-${String(period.from.getMonth() + 1).padStart(2, "0")}`
    const bulanAkhir = `${period.to.getFullYear()}-${String(period.to.getMonth() + 1).padStart(2, "0")}`

    const produk = await this.prisma.product.findMany({
      where: {
        ...(query.productId ? { id: query.productId } : {}),
        ...(query.businessTypeId ? { businessTypeId: query.businessTypeId } : {}),
      },
      select: { id: true, code: true, name: true, unit: true, costPrice: true, sellPrice: true },
    })
    if (produk.length === 0) {
      return { produk: [], bulan: [], perLokasi: [], summary: { saldoAkhir: 0, nilaiPersediaan: 0, nilaiPotensi: 0 } }
    }
    const productIds = produk.map((p) => p.id)

    // Harga rata-rata tertimbang tidak dipakai: yang diminta nilai PERSEDIAAN dan POTENSI
    // OMZET pada harga yang berlaku sekarang, bukan harga historis tiap transaksi.
    const hargaBeli = new Map(produk.map((p) => [p.id, Number(p.costPrice)]))
    const hargaJual = new Map(produk.map((p) => [p.id, Number(p.sellPrice)]))

    const saldoBulanan = await this.prisma.stockMonthlyBalance.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, locationType: true, locationId: true, period: true, debet: true, kredit: true },
    })

    // ── saldo awal = seluruh mutasi SEBELUM bulan pertama periode ─────────────
    let saldoAwal = 0
    const perBulan = new Map<string, { masuk: number; keluar: number }>()
    const perLokasi = new Map<string, { locationType: string; locationId: string; masuk: number; keluar: number; saldo: number }>()

    for (const b of saldoBulanan) {
      const selisih = b.debet - b.kredit
      if (b.period < bulanMulai) {
        saldoAwal += selisih
        const kunciL = `${b.locationType}::${b.locationId}`
        const l = perLokasi.get(kunciL) ?? { locationType: b.locationType, locationId: b.locationId, masuk: 0, keluar: 0, saldo: 0 }
        l.saldo += selisih
        perLokasi.set(kunciL, l)
        continue
      }
      if (b.period > bulanAkhir) continue

      const m = perBulan.get(b.period) ?? { masuk: 0, keluar: 0 }
      m.masuk += b.debet
      m.keluar += b.kredit
      perBulan.set(b.period, m)

      const kunciL = `${b.locationType}::${b.locationId}`
      const l = perLokasi.get(kunciL) ?? { locationType: b.locationType, locationId: b.locationId, masuk: 0, keluar: 0, saldo: 0 }
      l.masuk += b.debet
      l.keluar += b.kredit
      l.saldo += selisih
      perLokasi.set(kunciL, l)
    }

    // Nilai per unit: kalau yang diminta SATU produk, pakai harganya sendiri; kalau se-divisi,
    // pakai rata-rata sederhana harga produk di dalamnya — jumlah unitnya bercampur, jadi angka
    // rupiahnya memang perkiraan dan tidak boleh dipakai sebagai nilai persediaan resmi.
    const satuProduk = produk.length === 1 ? produk[0] : null
    const beliPerUnit = satuProduk ? hargaBeli.get(satuProduk.id)! : produk.reduce((n, p) => n + Number(p.costPrice), 0) / produk.length
    const jualPerUnit = satuProduk ? hargaJual.get(satuProduk.id)! : produk.reduce((n, p) => n + Number(p.sellPrice), 0) / produk.length

    const namaLok = await this.namaLokasi()
    let berjalan = saldoAwal
    const bulan = [...perBulan.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodeBulan, m]) => {
        const awal = berjalan
        const akhir = awal + m.masuk - m.keluar
        berjalan = akhir
        return {
          period: periodeBulan,
          saldoAwal: awal,
          masuk: m.masuk,
          keluar: m.keluar,
          saldoAkhir: akhir,
          nilaiPersediaan: akhir * beliPerUnit,
          nilaiPotensi: akhir * jualPerUnit,
        }
      })

    return {
      produk: produk.map((p) => ({ id: p.id, code: p.code, name: p.name, unit: p.unit })),
      /** Dipakai layar untuk memberi tahu bahwa angka rupiah se-divisi itu perkiraan. */
      hargaCampuran: !satuProduk,
      bulan,
      perLokasi: [...perLokasi.values()]
        // `namaLokasi()` mengembalikan peta PER JENIS lokasi (WAREHOUSE/SALES/STORE), bukan satu
        // peta gabungan — id gudang & id toko bisa saja sama nilainya, jadi jenisnya harus ikut.
        .map((l) => ({
          ...l,
          locationName: namaLok[l.locationType as keyof typeof namaLok]?.get(l.locationId) ?? "(lokasi tidak dikenal)",
        }))
        .filter((l) => l.saldo !== 0 || l.masuk !== 0 || l.keluar !== 0)
        .sort((a, b) => b.saldo - a.saldo),
      summary: {
        saldoAkhir: berjalan,
        nilaiPersediaan: berjalan * beliPerUnit,
        nilaiPotensi: berjalan * jualPerUnit,
      },
    }
  }

  private async namaLokasi() {
    const [warehouses, salesUsers, stores] = await Promise.all([
      this.prisma.warehouse.findMany({ select: { id: true, name: true } }),
      this.prisma.user.findMany({ where: { role: "sales" }, select: { id: true, name: true } }),
      this.prisma.store.findMany({ select: { id: true, name: true } }),
    ])
    const peta: Record<JenisLokasi, Map<string, string>> = {
      WAREHOUSE: new Map(warehouses.map((w) => [w.id, w.name])),
      SALES: new Map(salesUsers.map((u) => [u.id, u.name])),
      STORE: new Map(stores.map((s) => [s.id, s.name])),
    }
    return peta
  }

  async rekap(productId: string, query: { from?: string; to?: string }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException("Produk tidak ditemukan")

    const periode = resolveReportPeriod(query)

    // Tiga groupBy, bukan menarik seluruh baris ledger lalu dijumlahkan di Node: jumlah mutasi
    // satu produk tumbuh terus seumur pemakaian, dan yang dibutuhkan cuma angka ringkasannya.
    // Debet/kredit harus dua query terpisah karena `groupBy` tidak bisa memisahkan tanda.
    // Seluruhnya dari `stock_monthly_balances`, tanpa menyentuh ledger sama sekali: baris satu
    // produk paling banyak sejumlah (lokasi × bulan), bukan sebanyak mutasi yang pernah terjadi.
    // Saldo awal = Σ(debet−kredit) SEMUA bulan sebelum periode — inilah yang dulu berupa query
    // "seluruh mutasi sebelum tanggal X" yang biayanya naik terus seumur pemakaian.
    const periodeKunci = periodeBulan(periode.from)
    const [bulanan, nama] = await Promise.all([
      this.prisma.stockMonthlyBalance.findMany({
        where: { productId, period: { lte: periodeKunci } },
        select: { locationType: true, locationId: true, period: true, debet: true, kredit: true },
      }),
      this.namaLokasi(),
    ])

    const awalPerLokasi = new Map<string, number>()
    const debetPerLokasi = new Map<string, number>()
    const kreditPerLokasi = new Map<string, number>()
    for (const b of bulanan) {
      const k = `${b.locationType}|${b.locationId}`
      if (b.period === periodeKunci) {
        debetPerLokasi.set(k, (debetPerLokasi.get(k) ?? 0) + b.debet)
        kreditPerLokasi.set(k, (kreditPerLokasi.get(k) ?? 0) + b.kredit)
      } else {
        awalPerLokasi.set(k, (awalPerLokasi.get(k) ?? 0) + b.debet - b.kredit)
      }
    }

    const sections = JENIS.map((tipe) => {
      const ids = new Set(
        bulanan.filter((b) => b.locationType === tipe).map((b) => b.locationId)
      )
      const rows: BarisRekapStok[] = Array.from(ids)
        .map((id) => {
          const k = `${tipe}|${id}`
          const saldoAwal = awalPerLokasi.get(k) ?? 0
          const debet = debetPerLokasi.get(k) ?? 0
          const kredit = kreditPerLokasi.get(k) ?? 0
          return {
            locationType: tipe,
            locationId: id,
            // Lokasi yang sudah dihapus/berganti peran tetap ditampilkan dengan penanda, bukan
            // disembunyikan — stoknya beneran pernah ada di situ dan angkanya ikut menjumlah.
            locationName: nama[tipe].get(id) ?? "(lokasi tidak dikenal)",
            saldoAwal,
            debet,
            kredit,
            saldoAkhir: saldoAwal + debet - kredit,
          }
        })
        .filter((r) => r.saldoAwal !== 0 || r.debet !== 0 || r.kredit !== 0)
        .sort((a, b) => a.locationName.localeCompare(b.locationName))

      const total = rows.reduce(
        (acc, r) => ({
          saldoAwal: acc.saldoAwal + r.saldoAwal,
          debet: acc.debet + r.debet,
          kredit: acc.kredit + r.kredit,
          saldoAkhir: acc.saldoAkhir + r.saldoAkhir,
        }),
        { saldoAwal: 0, debet: 0, kredit: 0, saldoAkhir: 0 }
      )
      return { locationType: tipe, rows, total }
    })

    const grandTotal = sections.reduce(
      (acc, s) => ({
        saldoAwal: acc.saldoAwal + s.total.saldoAwal,
        debet: acc.debet + s.total.debet,
        kredit: acc.kredit + s.total.kredit,
        saldoAkhir: acc.saldoAkhir + s.total.saldoAkhir,
      }),
      { saldoAwal: 0, debet: 0, kredit: 0, saldoAkhir: 0 }
    )

    return {
      product: { id: product.id, code: product.code, name: product.name, unit: product.unit },
      period: { from: periode.from.toISOString(), to: periode.to.toISOString() },
      sections,
      grandTotal,
    }
  }

  /** Rincian mutasi satu produk di SATU lokasi — tujuan klik dari baris rekap. */
  async mutasi(productId: string, query: { locationType: string; locationId: string; from?: string; to?: string }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundException("Produk tidak ditemukan")

    const periode = resolveReportPeriod(query)
    const nama = await this.namaLokasi()

    const [saldoAwalAgg, rows] = await Promise.all([
      this.prisma.stockLedger.aggregate({
        _sum: { qtyChange: true },
        where: {
          productId,
          locationType: query.locationType,
          locationId: query.locationId,
          date: { lt: periode.from },
        },
      }),
      this.prisma.stockLedger.findMany({
        where: {
          productId,
          locationType: query.locationType,
          locationId: query.locationId,
          date: { gte: periode.from, lte: periode.to },
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        include: { petugas: { select: { name: true } } },
      }),
    ])

    const saldoAwal = saldoAwalAgg._sum.qtyChange ?? 0
    let berjalan = saldoAwal

    return {
      product: { id: product.id, code: product.code, name: product.name, unit: product.unit },
      location: {
        locationType: query.locationType,
        locationId: query.locationId,
        locationName: nama[query.locationType as JenisLokasi]?.get(query.locationId) ?? "(lokasi tidak dikenal)",
      },
      period: { from: periode.from.toISOString(), to: periode.to.toISOString() },
      saldoAwal,
      rows: rows.map((r) => {
        // Saldo berjalan dihitung ulang dari Saldo Awal periode, TIDAK memakai `qtyAfter` yang
        // tersimpan: `qtyAfter` adalah saldo sepanjang masa, jadi di laporan berperiode kolomnya
        // akan mulai dari angka yang tidak nyambung dengan Saldo Awal yang tertulis di atasnya.
        berjalan += r.qtyChange
        return {
          id: r.id,
          date: r.date.toISOString(),
          movementType: r.movementType,
          refDocType: r.refDocType,
          refDocNumber: r.refDocNumber,
          debet: r.qtyChange > 0 ? r.qtyChange : 0,
          kredit: r.qtyChange < 0 ? Math.abs(r.qtyChange) : 0,
          saldo: berjalan,
          petugasName: r.petugas?.name ?? null,
          notes: r.notes,
        }
      }),
      saldoAkhir: berjalan,
    }
  }
}
