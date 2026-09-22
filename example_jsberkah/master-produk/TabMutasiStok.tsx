"use client"

import { Card, StatTile, Tab, TabList, TabPanel, TabPanels, Tabs } from "@/components/ui"
import { formatRupiah } from "@/lib/format"
import { ReportFilterBar } from "@/components/laporan/ReportFilterBar"
import { PilihProduk } from "./PilihProduk"
import { PilihLokasiMutasi } from "./PilihLokasiMutasi"
import { labelMutasi } from "./[id]/stok/stok-labels"
import { Boxes, Coins, TrendingUp, Warehouse, LayoutGrid, History, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { TabelGayaSales, type KolomGayaSales } from "@/components/TabelGayaSales"

export interface BarisBulan {
  period: string
  saldoAwal: number
  masuk: number
  keluar: number
  saldoAkhir: number
  nilaiPersediaan: number
  nilaiPotensi: number
}

export interface BarisLokasi {
  locationType: string
  locationId: string
  locationName: string
  masuk: number
  keluar: number
  saldo: number
}

export interface BarisRekapSemuaProduk {
  productId: string
  productCode: string
  productName: string
  unit: string
  gudang: number
  sales: number
  toko: number
  total: number
}

export interface BarisRiwayatMutasi {
  id: string
  date: string
  movementType: string
  refDocType: string | null
  refDocNumber: string | null
  debet: number
  kredit: number
  saldo: number
  petugasName: string | null
  notes: string | null
}

/** Respons `GET /stock/produk/:id/mutasi` — riwayat keluar-masuk SATU produk di SATU lokasi
 *  spesifik (beda dari `perLokasi`/`BarisLokasi` di atas yang cuma agregat per jenis lokasi,
 *  bukan baris per transaksi). Sumber angka yang sama dipakai halaman drill-down
 *  `[id]/stok/mutasi/page.tsx` (dari klik baris Rekap Stok) — di sini dipilih langsung lewat
 *  `PilihLokasiMutasi`, tanpa perlu pindah halaman. */
export interface RiwayatMutasiLokasi {
  product: { id: string; code: string; name: string; unit: string }
  location: { locationType: string; locationId: string; locationName: string }
  saldoAwal: number
  rows: BarisRiwayatMutasi[]
  saldoAkhir: number
}

const LABEL_LOKASI: Record<string, string> = { WAREHOUSE: "Gudang", SALES: "Dibawa Sales", STORE: "Di Toko" }

const namaBulan = (period: string) => {
  const [tahun, bulan] = period.split("-")
  const nama = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][Number(bulan) - 1] ?? bulan
  return `${nama} ${tahun}`
}

/** Tab "Mutasi Stok" di halaman Produk (Tahap 23 langkah 4, diperluas jadi 2 sub-tab).
 *
 *  Rinci = tampilan aslinya: SATU produk terpilih (`PilihProduk`), akumulasi bulanan + rincian
 *  per lokasi. Angkanya dari `StockMonthlyBalance` (Tahap 19).
 *
 *  Rekap = SEMUA produk sekaligus, tanpa perlu pilih satu: saldo per lokasi (Gudang/Sales/Toko).
 *  Dibangun dari `GET /stock/produk/ringkas` yang SAMA dengan yang dipakai kolom Stok di tab
 *  Main — bukan query baru — supaya angkanya dijamin cocok antar tab.
 *
 *  Nilai dipajang DUA-DUANYA sesuai keputusan Owner, dan labelnya sengaja tegas: "Nilai
 *  Persediaan" (x harga beli, angka yang cocok dengan Neraca) vs "Potensi Omzet" (x harga jual).
 *  Dua angka ini beda maksud dan paling gampang tertukar kalau cuma ditulis "nilai". */
export function TabMutasiStok({
  produkId,
  produkOptions,
  divisiOptions,
  businessTypeId,
  bulan,
  perLokasi,
  summary,
  hargaCampuran,
  satuan,
  semuaProduk,
  from,
  to,
  lokasiTipe,
  lokasiId,
  gudangOptions,
  salesOptions,
  tokoOptions,
  riwayat,
}: {
  produkId: string
  produkOptions: { value: string; label: string }[]
  divisiOptions: { value: string; label: string }[]
  businessTypeId?: string
  bulan: BarisBulan[]
  perLokasi: BarisLokasi[]
  summary: { saldoAkhir: number; nilaiPersediaan: number; nilaiPotensi: number }
  hargaCampuran: boolean
  satuan: string
  /** SELURUH produk — paginasi & pencarian ditangani `TabelGayaSales` di client, bukan dipotong
   *  di server (lihat catatan `page.tsx`). */
  semuaProduk: BarisRekapSemuaProduk[]
  from: string
  to: string
  /** Filter lokasi spesifik untuk "Riwayat Keluar-Masuk" — kosong berarti belum dipilih. */
  lokasiTipe: string
  lokasiId: string
  gudangOptions: { value: string; label: string }[]
  salesOptions: { value: string; label: string }[]
  tokoOptions: { value: string; label: string }[]
  /** `null` = belum dipilih (lokasiTipe/lokasiId kosong) ATAU gagal ditarik dari server. */
  riwayat: RiwayatMutasiLokasi | null
}) {
  const totalMasuk = bulan.reduce((n, b) => n + b.masuk, 0)
  const totalKeluar = bulan.reduce((n, b) => n + b.keluar, 0)

  const kolomBulan: KolomGayaSales<BarisBulan>[] = [
    { key: "bulan", header: "Bulan", filterValue: (b) => namaBulan(b.period), cell: (b) => <span className="font-semibold text-slate-800 dark:text-fg">{namaBulan(b.period)}</span> },
    {
      key: "saldoAwal",
      header: "Saldo Awal",
      align: "right",
      sortValue: (b) => b.saldoAwal,
      cell: (b) => (
        <span className={`tabular-nums ${b.saldoAwal !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
          {b.saldoAwal.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      key: "masuk",
      header: "Masuk",
      align: "right",
      sortValue: (b) => b.masuk,
      cell: (b) => <span className="tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">+{b.masuk.toLocaleString("id-ID")}</span>,
    },
    {
      key: "keluar",
      header: "Keluar",
      align: "right",
      sortValue: (b) => b.keluar,
      cell: (b) => <span className="tabular-nums font-semibold text-rose-600 dark:text-rose-400">−{b.keluar.toLocaleString("id-ID")}</span>,
    },
    {
      key: "saldoAkhir",
      header: "Saldo Akhir",
      align: "right",
      sortValue: (b) => b.saldoAkhir,
      cell: (b) => <span className="tabular-nums font-extrabold text-slate-900 dark:text-fg">{b.saldoAkhir.toLocaleString("id-ID")}</span>,
    },
    {
      key: "nilaiPersediaan",
      header: "Nilai Persediaan",
      align: "right",
      sortValue: (b) => b.nilaiPersediaan,
      cell: (b) => (
        <span className={`tabular-nums ${b.nilaiPersediaan !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
          {formatRupiah(b.nilaiPersediaan)}
        </span>
      ),
    },
    {
      key: "nilaiPotensi",
      header: "Potensi Omzet",
      align: "right",
      sortValue: (b) => b.nilaiPotensi,
      cell: (b) => (
        <span className={`tabular-nums ${b.nilaiPotensi !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
          {formatRupiah(b.nilaiPotensi)}
        </span>
      ),
    },
  ]

  const kolomLokasi: KolomGayaSales<BarisLokasi>[] = [
    {
      key: "lokasi",
      header: "Lokasi",
      filterValue: (l) => l.locationName,
      cell: (l) => <span className="font-medium text-slate-800 dark:text-fg">{l.locationName}</span>,
    },
    {
      key: "jenis",
      header: "Jenis",
      filterValue: (l) => LABEL_LOKASI[l.locationType] ?? l.locationType,
      cell: (l) => <span className="text-slate-600 dark:text-fg-muted">{LABEL_LOKASI[l.locationType] ?? l.locationType}</span>,
    },
    {
      key: "masuk",
      header: "Masuk",
      align: "right",
      sortValue: (l) => l.masuk,
      cell: (l) => <span className="tabular-nums text-emerald-700 dark:text-emerald-400">+{l.masuk.toLocaleString("id-ID")}</span>,
    },
    {
      key: "keluar",
      header: "Keluar",
      align: "right",
      sortValue: (l) => l.keluar,
      cell: (l) => <span className="tabular-nums text-rose-600 dark:text-rose-400">−{l.keluar.toLocaleString("id-ID")}</span>,
    },
    {
      key: "saldo",
      header: "Saldo",
      align: "right",
      sortValue: (l) => l.saldo,
      cell: (l) => (
        <span className="tabular-nums font-extrabold text-slate-900 dark:text-fg">
          {l.saldo.toLocaleString("id-ID")} {satuan}
        </span>
      ),
    },
  ]

  const kolomRiwayat: KolomGayaSales<BarisRiwayatMutasi>[] = [
    { key: "date", header: "Tanggal", sortValue: (r) => r.date, cell: (r) => new Date(r.date).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) },
    {
      key: "movementType",
      header: "Jenis Mutasi",
      filterValue: (r) => labelMutasi(r.movementType),
      cell: (r) => <span className="font-semibold text-slate-800 dark:text-fg">{labelMutasi(r.movementType)}</span>,
    },
    {
      key: "refDocNumber",
      header: "Dokumen",
      filterValue: (r) => r.refDocNumber ?? "",
      cell: (r) => <span className="font-mono text-[11px] text-slate-500 dark:text-fg-muted">{r.refDocNumber || "—"}</span>,
    },
    {
      key: "debet",
      header: "Masuk",
      align: "right",
      sortValue: (r) => r.debet,
      cell: (r) =>
        r.debet ? (
          <span className="tabular-nums font-bold text-emerald-700 dark:text-emerald-400">+{r.debet.toLocaleString("id-ID")}</span>
        ) : (
          <span className="text-slate-400 dark:text-fg-muted">—</span>
        ),
    },
    {
      key: "kredit",
      header: "Keluar",
      align: "right",
      sortValue: (r) => r.kredit,
      cell: (r) =>
        r.kredit ? (
          <span className="tabular-nums font-bold text-rose-600 dark:text-rose-400">−{r.kredit.toLocaleString("id-ID")}</span>
        ) : (
          <span className="text-slate-400 dark:text-fg-muted">—</span>
        ),
    },
    {
      key: "saldo",
      header: "Saldo",
      align: "right",
      sortValue: (r) => r.saldo,
      cell: (r) => <span className="tabular-nums font-extrabold text-slate-900 dark:text-fg">{r.saldo.toLocaleString("id-ID")}</span>,
    },
    {
      key: "petugasName",
      header: "Petugas",
      filterValue: (r) => r.petugasName ?? "",
      cell: (r) => <span className="text-slate-600 dark:text-fg-muted">{r.petugasName || "—"}</span>,
    },
    {
      key: "notes",
      header: "Catatan",
      filterValue: (r) => r.notes ?? "",
      cell: (r) => <span className="text-slate-500 dark:text-fg-muted">{r.notes || "—"}</span>,
    },
  ]

  const kolomRekap: KolomGayaSales<BarisRekapSemuaProduk>[] = [
    {
      key: "produk",
      header: "Produk",
      filterValue: (p) => `${p.productName} ${p.productCode}`,
      cell: (p) => (
        <div>
          <span className="font-medium text-slate-800 dark:text-fg">{p.productName}</span>
          <span className="block text-[11px] font-mono text-slate-500 dark:text-fg-muted">{p.productCode}</span>
        </div>
      ),
    },
    {
      key: "gudang",
      header: "Gudang",
      align: "right",
      sortValue: (p) => p.gudang,
      cell: (p) => (
        <span className={`tabular-nums ${p.gudang !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
          {p.gudang.toLocaleString("id-ID")} {p.unit}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Dibawa Sales",
      align: "right",
      sortValue: (p) => p.sales,
      cell: (p) => (
        <span className={`tabular-nums ${p.sales !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
          {p.sales.toLocaleString("id-ID")} {p.unit}
        </span>
      ),
    },
    {
      key: "toko",
      header: "Di Toko",
      align: "right",
      sortValue: (p) => p.toko,
      cell: (p) => (
        <span className={`tabular-nums ${p.toko !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
          {p.toko.toLocaleString("id-ID")} {p.unit}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (p) => p.total,
      cell: (p) => (
        <span className="tabular-nums font-extrabold text-slate-900 dark:text-fg">
          {p.total.toLocaleString("id-ID")} {p.unit}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <Tabs defaultValue="rekap" className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <TabList>
          <Tab value="rekap">Rekap</Tab>
          <Tab value="rinci">Rinci</Tab>
        </TabList>

        <TabPanels>
          <TabPanel value="rinci" className="space-y-5">
            <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
              <div className="flex flex-wrap items-end gap-2.5">
                {/* Produk ATAU Divisi — memilih divisi mengosongkan pilihan produk di server, jadi
                    angkanya jadi gabungan seluruh produk divisi itu. */}
                <PilihProduk produkId={produkId} options={produkOptions} />
                <ReportFilterBar compact from={from} to={to} businessTypeId={businessTypeId} businessTypeOptions={divisiOptions} />
              </div>
              {/* Jenis Lokasi + lokasi spesifik — khusus untuk tabel "Riwayat Keluar-Masuk" di
                  bawah, terpisah dari filter Produk/Divisi/Periode di atas karena butuh SATU
                  produk (bukan gabungan divisi) dan SATU lokasi persis. */}
              <div className="flex flex-wrap items-end gap-2.5 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-line">
                <PilihLokasiMutasi lokasiTipe={lokasiTipe} lokasiId={lokasiId} gudangOptions={gudangOptions} salesOptions={salesOptions} tokoOptions={tokoOptions} />
              </div>
            </Card>

            {hargaCampuran && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Sedang menampilkan gabungan satu divisi — angka rupiahnya <strong>perkiraan</strong>, dihitung dari rata-rata harga produk di dalamnya. Untuk
                nilai persediaan yang bisa dipertanggungjawabkan, pilih satu produk.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile label="Saldo Akhir" value={`${summary.saldoAkhir.toLocaleString("id-ID")} ${satuan}`} icon={Boxes} color="blue" />
              <StatTile label="Nilai Persediaan" value={formatRupiah(summary.nilaiPersediaan)} icon={Coins} color="emerald" />
              <StatTile label="Potensi Omzet" value={formatRupiah(summary.nilaiPotensi)} icon={TrendingUp} color="amber" />
              <StatTile label="Masuk / Keluar" value={`${totalMasuk.toLocaleString("id-ID")} / ${totalKeluar.toLocaleString("id-ID")}`} icon={Warehouse} color="slate" />
            </div>

            <Card variant="panel" padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-[#0544cc] dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Riwayat Keluar-Masuk</h2>
              </div>

              {!lokasiTipe || !lokasiId ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-line px-4 py-8 text-center text-sm text-slate-500 dark:text-fg-muted">
                  Pilih Jenis Lokasi dan lokasinya di atas untuk melihat riwayat keluar-masuk produk ini per transaksi.
                </div>
              ) : riwayat ? (
                <>
                  <p className="text-xs font-semibold text-slate-600 dark:text-fg-muted mb-3">
                    {riwayat.location.locationName} · {riwayat.rows.length} mutasi pada periode terpilih
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <StatTile label="Saldo Awal" value={`${riwayat.saldoAwal.toLocaleString("id-ID")} ${riwayat.product.unit}`} icon={Boxes} color="slate" />
                    <StatTile
                      label="Debet (Masuk)"
                      value={`+${riwayat.rows.reduce((n, r) => n + r.debet, 0).toLocaleString("id-ID")} ${riwayat.product.unit}`}
                      icon={ArrowDownToLine}
                      color="emerald"
                    />
                    <StatTile
                      label="Kredit (Keluar)"
                      value={`−${riwayat.rows.reduce((n, r) => n + r.kredit, 0).toLocaleString("id-ID")} ${riwayat.product.unit}`}
                      icon={ArrowUpFromLine}
                      color="rose"
                    />
                    <StatTile label="Saldo Akhir" value={`${riwayat.saldoAkhir.toLocaleString("id-ID")} ${riwayat.product.unit}`} icon={Boxes} color="blue" />
                  </div>
                  <TabelGayaSales
                    kolom={kolomRiwayat}
                    rows={riwayat.rows}
                    rowKey={(r) => r.id}
                    pageSize={10}
                    searchPlaceholder="Cari jenis mutasi, dokumen, atau petugas..."
                    emptyMessage="Tidak ada mutasi pada periode ini — saldonya tidak berubah."
                  />
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-line px-4 py-8 text-center text-sm text-slate-500 dark:text-fg-muted">
                  Gagal memuat riwayat mutasi untuk lokasi ini.
                </div>
              )}
            </Card>

            <Card variant="panel" padding="lg">
              <h2 className="text-sm font-bold text-slate-800 dark:text-fg mb-3">Akumulasi Bulanan</h2>
              <TabelGayaSales
                kolom={kolomBulan}
                rows={bulan}
                rowKey={(b) => b.period}
                pageSize={12}
                searchPlaceholder="Cari bulan..."
                emptyMessage="Tidak ada mutasi pada periode ini."
              />
              <p className="text-[11px] text-slate-500 dark:text-fg-muted mt-3">
                <strong>Nilai Persediaan</strong> = saldo akhir × harga beli — angka yang cocok dengan Neraca. <strong>Potensi Omzet</strong> = saldo akhir ×
                harga jual toko, yaitu nilainya kalau semuanya terjual. Keduanya bukan hal yang sama.
              </p>
            </Card>

          </TabPanel>

          <TabPanel value="rekap" className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <LayoutGrid className="w-4 h-4 text-[#0544cc] dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Saldo Semua Produk per Lokasi</h2>
                <span className="text-[11px] text-slate-500 dark:text-fg-muted">— saldo berjalan, tidak dibatasi periode</span>
              </div>
              <TabelGayaSales
                kolom={kolomRekap}
                // Bawaan diurut Total terbesar dulu — produk yang stoknya paling banyak paling
                // relevan dilihat lebih dulu. Tetap bisa diurut ulang lewat header kolom lain.
                rows={[...semuaProduk].sort((a, b) => b.total - a.total)}
                rowKey={(p) => p.productId}
                pageSize={5}
                searchPlaceholder="Cari produk atau kode..."
                emptyMessage="Belum ada produk."
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <LayoutGrid className="w-4 h-4 text-[#0544cc] dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Rincian per Lokasi</h2>
                <span className="text-[11px] text-slate-500 dark:text-fg-muted">
                  — {produkOptions.find((o) => o.value === produkId)?.label ?? "produk terpilih"}, ikut filter Produk/Divisi & Periode di tab Rinci
                </span>
              </div>
              <TabelGayaSales
                kolom={kolomLokasi}
                rows={perLokasi}
                rowKey={(l) => `${l.locationType}-${l.locationId}`}
                pageSize={10}
                searchPlaceholder="Cari lokasi..."
                emptyMessage="Belum ada stok di lokasi mana pun."
              />
              <p className="text-[11px] text-slate-500 dark:text-fg-muted mt-3">
                Masuk/keluar di sini dihitung untuk periode yang dipilih, sedangkan Saldo adalah posisi sepanjang masa — jadi lokasi bisa punya saldo tanpa ada
                mutasi di periode ini.
              </p>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  )
}
