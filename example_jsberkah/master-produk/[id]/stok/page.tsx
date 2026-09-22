import Link from "next/link"
import { ArrowLeft, Boxes, FileSpreadsheet, FileText } from "lucide-react"
import { Breadcrumb } from "@/components/ui"
import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { PeriodeStokFilter } from "./PeriodeStokFilter"
import { RekapStokTabs, type BagianRekap, type Ringkasan } from "./RekapStokTabs"
import { keTanggalInput, tanggalPanjang } from "./stok-labels"
import type { BarisHargaRataRata } from "./HargaRataRataTab"

interface DataRekap {
  product: { id: string; code: string; name: string; unit: string }
  period: { from: string; to: string }
  sections: BagianRekap[]
  grandTotal: Ringkasan
}

interface DataHargaRataRata {
  product: { id: string; code: string; name: string; unit: string; averageCostSaatIni: number }
  rows: BarisHargaRataRata[]
}

const angka = (n: number) => n.toLocaleString("id-ID")

/** Rekap Stok Produk — "produk ini ada di mana saja", dibaca seperti buku besar per lokasi:
 *  Saldo Awal + Debet (masuk) − Kredit (keluar) = Saldo Akhir.
 *
 *  Beda sumbu baca dari halaman `stock/gudang`, `stock/sales`, `stock/toko` yang sudah ada —
 *  ketiganya menjawab "apa saja yang ada di lokasi X". Tabel sumbernya sama (`StockLedger`), jadi
 *  angkanya dijamin cocok; jangan dibikin perhitungan stok sendiri di sini.
 *
 *  Tiap baris lokasi bisa diklik ke rincian mutasinya (`./stok/mutasi`). */
export default async function RekapStokProdukPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePageRole(["owner", "admin"])
  const { id } = await params
  const sp = await searchParams
  const teks = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "")
  const back = teks("back")

  const qs = new URLSearchParams()
  if (teks("from")) qs.set("from", teks("from"))
  if (teks("to")) qs.set("to", teks("to"))

  const accessToken = await getAccessToken()
  const [data, hargaRataRataDto] = await Promise.all([
    backendFetch<DataRekap>(`/stock/produk/${id}/rekap${qs.toString() ? `?${qs}` : ""}`, { accessToken }),
    // Riwayat harga rata-rata tidak terikat periode — sengaja tidak dikirim `qs` (from/to).
    // Melengkapi, bukan mematikan halaman: kalau gagal dimuat, tab keempatnya cuma tidak
    // dirender (lihat prop `hargaRataRata` di RekapStokTabs), tiga tab lokasi tetap jalan.
    backendFetch<DataHargaRataRata>(`/produk/${id}/harga-rata-rata`, { accessToken }).catch(() => null),
  ])

  const kembali = `/master/produk${back ? `?${back}` : ""}`
  const basePath = `/master/produk/${id}/stok`
  const paramLanjut = back ? { back } : undefined

  /** Periode + `back` diteruskan apa adanya ke halaman mutasi supaya rincian yang dibuka
   *  memakai periode yang sama dengan rekap yang sedang dilihat, dan jalan pulangnya utuh. */
  const queryMutasi = new URLSearchParams()
  if (teks("from")) queryMutasi.set("from", teks("from"))
  if (teks("to")) queryMutasi.set("to", teks("to"))
  if (back) queryMutasi.set("back", back)

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Data Operasional" },
          { label: "Produk", href: kembali },
          { label: data.product.code, href: `/master/produk/${id}/edit${back ? `?back=${encodeURIComponent(back)}` : ""}` },
          { label: "Rekap Stok" },
        ]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href={kembali}
            className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
            aria-label="Kembali ke daftar produk"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Boxes className="w-5 h-5 text-[#0544cc] dark:text-blue-400 mt-1.5 flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">Rekap Stok Produk</h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              <span className="font-mono font-bold text-[#0544cc] dark:text-blue-400">{data.product.code}</span> — {data.product.name}
              <span className="text-slate-400 dark:text-fg-muted"> · satuan {data.product.unit}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodeStokFilter from={keTanggalInput(data.period.from)} basePath={basePath} extraParams={paramLanjut} />

          {/* Ikut periode yang sedang dilihat — berkas yang terunduh harus berisi persis apa yang
              ada di layar, bukan diam-diam bulan berjalan. PDF dibuka di tab baru (dirender dari
              halaman print-only), Excel diunduh langsung. */}
          <a
            href={`/api/laporan/rekap-stok/${id}/pdf${qs.toString() ? `?${qs}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka PDF rekap stok periode ini"
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>PDF</span>
          </a>
          <a
            href={`/api/laporan/rekap-stok/${id}/excel${qs.toString() ? `?${qs}` : ""}`}
            title="Unduh Excel rekap stok periode ini"
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            <span>Excel</span>
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-fg-secondary">
        Periode {tanggalPanjang(data.period.from)} s.d. {tanggalPanjang(data.period.to)}
        <span className="font-normal text-slate-500 dark:text-fg-muted">
          {" "}
          · Saldo Awal = seluruh mutasi sebelum tanggal mulai · Saldo Akhir keseluruhan{" "}
          <span className="font-bold text-slate-900 dark:text-fg">
            {angka(data.grandTotal.saldoAkhir)} {data.product.unit}
          </span>
        </span>
      </div>

      <RekapStokTabs
        sections={data.sections}
        unit={data.product.unit}
        tabAwal={teks("tab")}
        basePathMutasi={`${basePath}/mutasi`}
        queryDasar={queryMutasi.toString()}
        hargaRataRata={
          hargaRataRataDto ? { rows: hargaRataRataDto.rows, averageCostSaatIni: hargaRataRataDto.product.averageCostSaatIni } : null
        }
      />

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-fg">Grand Total (Gudang + Sales + Toko)</p>
            <p className="text-[11px] text-slate-500 dark:text-fg-muted">
              Seluruh unit produk ini yang masih dimiliki perusahaan, di mana pun letaknya.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Awal</p>
              <p className="font-bold text-slate-700 dark:text-fg-secondary mt-0.5">{angka(data.grandTotal.saldoAwal)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Debet</p>
              <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">+{angka(data.grandTotal.debet)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kredit</p>
              <p className="font-bold text-rose-600 dark:text-rose-400 mt-0.5">−{angka(data.grandTotal.kredit)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Akhir</p>
              <p className="text-lg font-black text-[#0544cc] dark:text-blue-400 leading-tight mt-0.5">
                {angka(data.grandTotal.saldoAkhir)} <span className="text-xs font-bold text-slate-400">{data.product.unit}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
