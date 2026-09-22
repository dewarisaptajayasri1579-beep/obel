"use client"

import { Card, StatTile } from "@/components/ui"
import { formatRupiah } from "@/lib/format"
import { ReportFilterBar } from "@/components/laporan/ReportFilterBar"
import { Package, ReceiptText, TrendingUp } from "lucide-react"
import { TabelGayaSales, type KolomGayaSales } from "@/components/TabelGayaSales"

export interface BarisRanking {
  productId: string
  productCode: string
  productName: string
  unit: string
  qtyTerjual: number
  omzet: number
  margin: number
}

/** Tab "Ranking Penjualan" di halaman Produk (Tahap 23 langkah 1).
 *
 *  Angkanya datang dari endpoint yang SAMA dengan halaman `/laporan/analisa-penjualan`
 *  (`GET /analisa/penjualan`) — bukan query baru. Dua layar yang menjawab pertanyaan yang sama
 *  dengan dua query berbeda adalah cara tercepat membuat angkanya berbeda.
 *
 *  Bedanya dengan halaman laporan itu: di sini fokusnya PERINGKAT (nomor urut, top-3 disorot,
 *  kolom margin disandingkan langsung dengan omzet), bukan rekap lengkap untuk dicetak. */
export function TabRankingPenjualan({
  rows,
  summary,
  from,
  to,
  storeId,
  storeOptions,
}: {
  rows: BarisRanking[]
  summary: { totalQty: number; totalOmzet: number; totalMargin: number }
  from: string
  to: string
  storeId?: string
  storeOptions: { value: string; label: string }[]
}) {
  // Sudah diurutkan omzet menurun dari backend; disalin supaya tidak mengandalkan urutan itu
  // diam-diam kalau backend berubah.
  const urut = [...rows].sort((a, b) => b.omzet - a.omzet)

  const kolom: KolomGayaSales<BarisRanking>[] = [
    {
      key: "rank",
      header: "Rank",
      align: "center",
      // Badge tiga besar mengikuti urutan tampilan SAAT INI — kalau user mengurutkan ulang lewat
      // header kolom lain, lencananya ikut menyesuaikan, bukan angka rank asli dari backend.
      cell: (_r, i) => (
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${
            i === 0
              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400"
              : i === 1
                ? "bg-slate-200 text-slate-700 dark:bg-surface-hover dark:text-fg-secondary"
                : i === 2
                  ? "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-400"
                  : "text-slate-500 dark:text-fg-muted"
          }`}
        >
          {i + 1}
        </span>
      ),
    },
    {
      key: "produk",
      header: "Produk",
      filterValue: (r) => `${r.productName} ${r.productCode}`,
      cell: (r) => (
        <>
          <span className="font-mono text-[10px] font-bold mr-1.5 text-slate-500">{r.productCode}</span>
          <span className="text-slate-800 dark:text-fg font-medium">{r.productName}</span>
        </>
      ),
    },
    {
      key: "qtyTerjual",
      header: "Qty Terjual",
      align: "right",
      sortValue: (r) => r.qtyTerjual,
      cell: (r) => (
        <span className={`tabular-nums ${r.qtyTerjual !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
          {r.qtyTerjual.toLocaleString("id-ID")} {r.unit}
        </span>
      ),
    },
    {
      key: "omzet",
      header: "Omzet",
      align: "right",
      sortValue: (r) => r.omzet,
      cell: (r) => <span className="font-extrabold text-slate-900 dark:text-fg tabular-nums">{formatRupiah(r.omzet)}</span>,
    },
    {
      key: "margin",
      header: "Margin",
      align: "right",
      sortValue: (r) => r.margin,
      // Margin bisa negatif (dijual di bawah harga beli) — dibedakan warnanya, karena justru
      // baris itulah yang perlu ketahuan.
      cell: (r) => (
        <span className={`font-bold tabular-nums ${r.margin < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
          {formatRupiah(r.margin)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      {/* `compact` — tinggi isian & tombolnya disamakan dengan form Purchase Order (permintaan
          Owner). Tanpa itu, bilah filter setinggi 56px yang melar selebar kartu mengambil alih
          layar, padahal di tab ini yang dicari tabel peringkatnya. */}
      <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
        <ReportFilterBar compact from={from} to={to} storeId={storeId} storeOptions={storeOptions} />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Total Qty Terjual" value={summary.totalQty.toLocaleString("id-ID")} icon={Package} color="blue" />
        <StatTile label="Total Omzet" value={formatRupiah(summary.totalOmzet)} icon={ReceiptText} color="emerald" />
        <StatTile label="Total Margin" value={formatRupiah(summary.totalMargin)} icon={TrendingUp} color={summary.totalMargin < 0 ? "rose" : "slate"} />
      </div>

      <Card variant="panel" padding="lg">
        <TabelGayaSales
          kolom={kolom}
          rows={urut}
          rowKey={(r) => r.productId}
          pageSize={10}
          searchPlaceholder="Cari produk atau kode..."
          emptyMessage="Belum ada penjualan pada periode ini."
        />
        <p className="text-[11px] text-slate-500 dark:text-fg-muted mt-3">
          Parfum dihitung dari Stock Opname, Plastik &amp; Kaos Kaki dari Penjualan Langsung — digabung, sumber angkanya sama dengan halaman Laporan &gt; Analisa
          Penjualan.
        </p>
      </Card>
    </div>
  )
}
