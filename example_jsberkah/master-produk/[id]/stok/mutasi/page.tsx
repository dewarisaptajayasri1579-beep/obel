import Link from "next/link"
import { ArrowLeft, ArrowLeftRight } from "lucide-react"
import { Breadcrumb } from "@/components/ui"
import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { PeriodeStokFilter } from "../PeriodeStokFilter"
import { JUDUL_LOKASI, keTanggalInput, labelMutasi, tanggalPanjang, tanggalWaktu, type JenisLokasi } from "../stok-labels"

interface BarisMutasi {
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

interface DataMutasi {
  product: { id: string; code: string; name: string; unit: string }
  location: { locationType: JenisLokasi; locationId: string; locationName: string }
  period: { from: string; to: string }
  saldoAwal: number
  rows: BarisMutasi[]
  saldoAkhir: number
}

const angka = (n: number) => n.toLocaleString("id-ID")

/** Rincian mutasi keluar-masuk stok satu produk di SATU lokasi — tujuan klik dari baris Rekap
 *  Stok Produk ("Sales A = 50" → dari mana angka 50 itu).
 *
 *  Kolom Saldo dihitung berjalan dari Saldo Awal periode (backend), BUKAN dari `qtyAfter` yang
 *  tersimpan di ledger: `qtyAfter` adalah saldo sepanjang masa, jadi di laporan berperiode
 *  kolomnya akan mulai dari angka yang tidak nyambung dengan Saldo Awal di barisnya sendiri. */
export default async function MutasiStokProdukPage({
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

  const qs = new URLSearchParams({ locationType: teks("tipe"), locationId: teks("lokasi") })
  if (teks("from")) qs.set("from", teks("from"))
  if (teks("to")) qs.set("to", teks("to"))

  const data = await backendFetch<DataMutasi>(`/stock/produk/${id}/mutasi?${qs}`, { accessToken: await getAccessToken() })

  const basePath = `/master/produk/${id}/stok/mutasi`
  const paramLanjut: Record<string, string> = { tipe: teks("tipe"), lokasi: teks("lokasi") }
  if (back) paramLanjut.back = back

  const rekapQs = new URLSearchParams()
  if (teks("from")) rekapQs.set("from", teks("from"))
  if (teks("to")) rekapQs.set("to", teks("to"))
  if (back) rekapQs.set("back", back)
  const kembaliKeRekap = `/master/produk/${id}/stok${rekapQs.toString() ? `?${rekapQs}` : ""}`

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Data Operasional" },
          { label: "Produk", href: `/master/produk${back ? `?${back}` : ""}` },
          { label: data.product.code },
          { label: "Rekap Stok", href: kembaliKeRekap },
          { label: data.location.locationName },
        ]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href={kembaliKeRekap}
            className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
            aria-label="Kembali ke rekap stok"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <ArrowLeftRight className="w-5 h-5 text-[#0544cc] dark:text-blue-400 mt-1.5 flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">Mutasi Stok</h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              <span className="font-mono font-bold text-[#0544cc] dark:text-blue-400">{data.product.code}</span> — {data.product.name} ·{" "}
              <span className="font-bold">
                {JUDUL_LOKASI[data.location.locationType] ?? data.location.locationType}: {data.location.locationName}
              </span>
            </p>
          </div>
        </div>
        <PeriodeStokFilter from={keTanggalInput(data.period.from)} basePath={basePath} extraParams={paramLanjut} />
      </div>

      <div className="rounded-xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/60 dark:bg-blue-500/5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-fg-secondary">
        Periode {tanggalPanjang(data.period.from)} s.d. {tanggalPanjang(data.period.to)}
        <span className="font-normal text-slate-500 dark:text-fg-muted">
          {" "}
          · {data.rows.length} mutasi · Saldo {angka(data.saldoAwal)} →{" "}
          <span className="font-bold text-slate-900 dark:text-fg">
            {angka(data.saldoAkhir)} {data.product.unit}
          </span>
        </span>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-blue-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Jenis Mutasi</th>
                <th className="py-3 px-3">Dokumen</th>
                <th className="py-3 px-3 text-right">Masuk</th>
                <th className="py-3 px-3 text-right">Keluar</th>
                <th className="py-3 px-3 text-right">Saldo</th>
                <th className="py-3 px-3">Petugas</th>
                <th className="py-3 px-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-line">
              <tr className="bg-slate-50/70 dark:bg-surface-hover/40 font-semibold">
                <td className="py-2.5 px-3 text-slate-500 dark:text-fg-muted" colSpan={5}>
                  Saldo Awal — seluruh mutasi sebelum {tanggalPanjang(data.period.from)}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-slate-700 dark:text-fg-secondary">{angka(data.saldoAwal)}</td>
                <td colSpan={2} />
              </tr>

              {data.rows.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                  <td className="py-2.5 px-3 text-slate-700 dark:text-fg-secondary whitespace-nowrap">{tanggalWaktu(r.date)}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-fg">{labelMutasi(r.movementType)}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-fg-muted">{r.refDocNumber || "—"}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{r.debet ? `+${angka(r.debet)}` : "—"}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-rose-600 dark:text-rose-400">{r.kredit ? `−${angka(r.kredit)}` : "—"}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-fg">{angka(r.saldo)}</td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-fg-muted">{r.petugasName || "—"}</td>
                  <td className="py-2.5 px-3 text-slate-500 dark:text-fg-muted">{r.notes || "—"}</td>
                </tr>
              ))}

              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 dark:text-fg-muted">
                    Tidak ada mutasi pada periode ini — saldonya tidak berubah.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50/70 dark:bg-surface-hover font-bold border-t border-slate-200 dark:border-line">
                <td className="py-2.5 px-3" colSpan={3}>
                  Total Periode
                </td>
                <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">
                  +{angka(data.rows.reduce((s, r) => s + r.debet, 0))}
                </td>
                <td className="py-2.5 px-3 text-right text-rose-700 dark:text-rose-400">−{angka(data.rows.reduce((s, r) => s + r.kredit, 0))}</td>
                <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-fg">{angka(data.saldoAkhir)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
