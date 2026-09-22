"use client"

import { Card, StatTile, Tab, TabList, TabPanel, TabPanels, Tabs } from "@/components/ui"
import { formatRupiah } from "@/lib/format"
import { ReportFilterBar } from "@/components/laporan/ReportFilterBar"
import { PilihProduk } from "./PilihProduk"
import { Boxes, Store, MapPin, ReceiptText, Truck, LayoutGrid } from "lucide-react"
import { TabelGayaSales, type KolomGayaSales } from "@/components/TabelGayaSales"

export interface BarisSebaranToko {
  storeId: string
  storeName: string
  kabupatenId: string | null
  kabupatenName: string
  stok: number
  qtyTerjual: number
  omzet: number
}

export interface BarisSebaranArea {
  areaId: string | null
  areaName: string
  jumlahToko: number
  stok: number
  qtyTerjual: number
  omzet: number
}

export interface BarisSebaranSales {
  salesId: string
  salesName: string
  stok: number
  qtyTerjual: number
  omzet: number
}

export interface BarisSebaranKabupaten {
  kabupatenId: string | null
  kabupatenName: string
  jumlahToko: number
  stok: number
  qtyTerjual: number
  omzet: number
}

export interface BarisRekapSebaranProduk {
  productId: string
  productCode: string
  productName: string
  unit: string
  stokToko: number
  stokSales: number
  qtyTerjual: number
  omzet: number
}

/** Tab "Sebaran" di halaman Produk (Tahap 23 langkah 3, diperluas jadi 2 sub-tab).
 *
 *  Rinci = tampilan aslinya: SATU produk terpilih (`PilihProduk`) — ada di toko mana saja,
 *  berapa sisanya, berapa yang terjual di sana, direkap per Area/Kabupaten/Sales.
 *
 *  Rekap = SEMUA produk sekaligus, tanpa perlu pilih satu: stok toko/sales + terjual/omzet
 *  periode ini per produk. Dibangun dari data yang SAMA dengan tab Main (`/stock/produk/ringkas`)
 *  dan tab Ranking Penjualan (`/analisa/penjualan`) — bukan query baru. */
export function TabSebaran({
  produkId,
  produkOptions,
  product,
  perToko,
  perSales,
  perArea,
  perKabupaten,
  summary,
  semuaProduk,
  from,
  to,
}: {
  produkId: string
  produkOptions: { value: string; label: string }[]
  product: { code: string; name: string; unit: string } | null
  perToko: BarisSebaranToko[]
  perSales: BarisSebaranSales[]
  perArea: BarisSebaranArea[]
  perKabupaten: BarisSebaranKabupaten[]
  summary: { totalStok: number; totalStokSales: number; totalTerjual: number; totalOmzet: number; jumlahToko: number }
  /** SELURUH produk — paginasi & pencarian ditangani `TabelGayaSales` di client. */
  semuaProduk: BarisRekapSebaranProduk[]
  from: string
  to: string
}) {
  const satuan = product?.unit ?? ""

  const kolomRekap: KolomGayaSales<BarisRekapSebaranProduk>[] = [
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
      key: "stokToko",
      header: "Stok di Toko",
      align: "right",
      sortValue: (p) => p.stokToko,
      cell: (p) => (
        <span className={`tabular-nums ${p.stokToko !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
          {p.stokToko.toLocaleString("id-ID")} {p.unit}
        </span>
      ),
    },
    {
      key: "stokSales",
      header: "Dibawa Sales",
      align: "right",
      sortValue: (p) => p.stokSales,
      cell: (p) => (
        <span className={`tabular-nums ${p.stokSales !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
          {p.stokSales.toLocaleString("id-ID")} {p.unit}
        </span>
      ),
    },
    {
      key: "qtyTerjual",
      header: "Terjual",
      align: "right",
      sortValue: (p) => p.qtyTerjual,
      cell: (p) => (
        <span className={`tabular-nums ${p.qtyTerjual !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
          {p.qtyTerjual.toLocaleString("id-ID")} {p.unit}
        </span>
      ),
    },
    {
      key: "omzet",
      header: "Omzet",
      align: "right",
      sortValue: (p) => p.omzet,
      cell: (p) => <span className="tabular-nums font-extrabold text-slate-900 dark:text-fg">{formatRupiah(p.omzet)}</span>,
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
                <PilihProduk produkId={produkId} options={produkOptions} />
                <ReportFilterBar compact from={from} to={to} />
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatTile label="Stok di Toko" value={`${summary.totalStok.toLocaleString("id-ID")} ${satuan}`} icon={Boxes} color="blue" />
              <StatTile label="Dibawa Sales" value={`${summary.totalStokSales.toLocaleString("id-ID")} ${satuan}`} icon={Truck} color="amber" />
              <StatTile label="Terjual Periode Ini" value={`${summary.totalTerjual.toLocaleString("id-ID")} ${satuan}`} icon={ReceiptText} color="emerald" />
              <StatTile label="Omzet Periode Ini" value={formatRupiah(summary.totalOmzet)} icon={ReceiptText} color="emerald" />
              <StatTile label="Tersebar di" value={`${summary.jumlahToko} toko`} icon={Store} color="slate" />
            </div>

            {/* AREA di paling atas — inilah pengelompokan yang dipakai Owner membaca sebaran
                (Area = kumpulan kabupaten). Kabupaten & toko di bawahnya jadi rinciannya. */}
            <Card variant="panel" padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-[#0544cc] dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Per Area</h2>
              </div>
              <TabelSebaran
                kolomPertama="Area"
                satuan={satuan}
                baris={perArea.map((a) => ({
                  kunci: a.areaId ?? a.areaName,
                  nama: a.areaName,
                  keterangan: `${a.jumlahToko} toko`,
                  tanpaWilayah: a.areaId === null,
                  stok: a.stok,
                  qtyTerjual: a.qtyTerjual,
                  omzet: a.omzet,
                }))}
                kosong="Produk ini belum pernah masuk ke toko mana pun."
              />
              {perArea.some((a) => a.areaId === null) && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-3">
                  Ada toko yang belum masuk Area mana pun — muncul sebagai &quot;Belum Masuk Area&quot; (kabupatennya ada tapi belum dikelompokkan) atau
                  &quot;Tanpa Wilayah&quot; (tokonya sendiri belum diisi wilayahnya). Atur di Master Data &rsaquo; Area Sales.
                </p>
              )}
            </Card>

            {/* PER SALES — stok yang belum sampai ke toko mana pun karena masih dibawa sales.
                Sengaja dipisah dari tabel wilayah: barang ini belum punya lokasi geografis, jadi
                memaksanya masuk salah satu Area akan membuat jumlah per-Area lebih besar daripada
                yang benar. */}
            <Card variant="panel" padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-[#0544cc] dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Dibawa Sales</h2>
              </div>
              <TabelSebaran
                kolomPertama="Sales"
                satuan={satuan}
                labelStok="Sedang Dibawa"
                baris={perSales.map((s) => ({
                  kunci: s.salesId,
                  nama: s.salesName,
                  keterangan: s.stok > 0 ? "sedang membawa barang" : "tidak sedang membawa",
                  tanpaWilayah: false,
                  stok: s.stok,
                  qtyTerjual: s.qtyTerjual,
                  omzet: s.omzet,
                }))}
                kosong="Tidak ada sales yang membawa atau menjual produk ini pada periode ini."
              />
            </Card>

            <Card variant="panel" padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-[#0544cc] dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Per Kabupaten</h2>
              </div>
              <TabelSebaran
                kolomPertama="Kabupaten"
                satuan={satuan}
                baris={perKabupaten.map((k) => ({
                  kunci: k.kabupatenId ?? "__tanpa__",
                  nama: k.kabupatenName,
                  keterangan: `${k.jumlahToko} toko`,
                  tanpaWilayah: k.kabupatenId === null,
                  stok: k.stok,
                  qtyTerjual: k.qtyTerjual,
                  omzet: k.omzet,
                }))}
                kosong="Produk ini belum pernah masuk ke toko mana pun."
              />
            </Card>

            <Card variant="panel" padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <Store className="w-4 h-4 text-[#0544cc] dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Per Toko</h2>
              </div>
              <TabelSebaran
                kolomPertama="Toko"
                satuan={satuan}
                baris={perToko.map((t) => ({
                  kunci: t.storeId,
                  nama: t.storeName,
                  keterangan: t.kabupatenName,
                  tanpaWilayah: t.kabupatenId === null,
                  stok: t.stok,
                  qtyTerjual: t.qtyTerjual,
                  omzet: t.omzet,
                }))}
                kosong="Produk ini belum pernah masuk ke toko mana pun."
              />
            </Card>
          </TabPanel>

          <TabPanel value="rekap">
            <div className="flex items-center gap-2 mb-3">
              <LayoutGrid className="w-4 h-4 text-[#0544cc] dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Sebaran Semua Produk</h2>
              <span className="text-[11px] text-slate-500 dark:text-fg-muted">— stok berjalan, terjual/omzet untuk periode filter</span>
            </div>
            <TabelGayaSales
              kolom={kolomRekap}
              // Bawaan diurut stok terbanyak dulu (toko + sales digabung) — sama pola dengan Rekap
              // Mutasi Stok. Tetap bisa diurut ulang lewat header kolom lain.
              rows={[...semuaProduk].sort((a, b) => b.stokToko + b.stokSales - (a.stokToko + a.stokSales))}
              rowKey={(p) => p.productId}
              pageSize={5}
              searchPlaceholder="Cari produk atau kode..."
              emptyMessage="Belum ada produk."
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  )
}

interface BarisSebaranTabel {
  kunci: string
  nama: string
  keterangan: string
  tanpaWilayah: boolean
  stok: number
  qtyTerjual: number
  omzet: number
}

function TabelSebaran({
  kolomPertama,
  satuan,
  baris,
  kosong,
  labelStok = "Stok Sekarang",
}: {
  kolomPertama: string
  satuan: string
  labelStok?: string
  baris: BarisSebaranTabel[]
  kosong: string
}) {
  const kolom: KolomGayaSales<BarisSebaranTabel>[] = [
    {
      key: "nama",
      header: kolomPertama,
      filterValue: (b) => b.nama,
      cell: (b) => (
        <>
          <span className={`font-medium ${b.tanpaWilayah ? "text-amber-700 dark:text-amber-400" : "text-slate-800 dark:text-fg"}`}>{b.nama}</span>
          <span className="block text-[11px] text-slate-500 dark:text-fg-muted">{b.keterangan}</span>
        </>
      ),
    },
    {
      key: "stok",
      header: labelStok,
      align: "right",
      sortValue: (b) => b.stok,
      // Stok 0 diredupkan — tokonya tetap dipajang karena periode ini sempat menjual, tapi angka
      // nolnya tidak perlu ikut menarik perhatian.
      cell: (b) => (
        <span className={`tabular-nums ${b.stok === 0 ? "text-slate-400 dark:text-fg-muted" : "text-slate-800 dark:text-fg font-semibold"}`}>
          {b.stok.toLocaleString("id-ID")} {satuan}
        </span>
      ),
    },
    {
      key: "qtyTerjual",
      header: "Terjual",
      align: "right",
      sortValue: (b) => b.qtyTerjual,
      cell: (b) => (
        <span className="tabular-nums text-slate-700 dark:text-fg-secondary">
          {b.qtyTerjual.toLocaleString("id-ID")} {satuan}
        </span>
      ),
    },
    {
      key: "omzet",
      header: "Omzet",
      align: "right",
      sortValue: (b) => b.omzet,
      cell: (b) => <span className="font-extrabold tabular-nums text-slate-900 dark:text-fg">{formatRupiah(b.omzet)}</span>,
    },
  ]

  return <TabelGayaSales kolom={kolom} rows={baris} rowKey={(b) => b.kunci} pageSize={10} searchPlaceholder={`Cari ${kolomPertama.toLowerCase()}...`} emptyMessage={kosong} />
}
