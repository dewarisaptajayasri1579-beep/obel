import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import type { DataPerusahaanLaporan } from "@/lib/laporan/excel-builder"
import { LaporanSerahTerimaBarangPrintable, STATUS_LABEL_STB, type BarisLaporanSerahTerimaBarang } from "./LaporanSerahTerimaBarangPrintable"

/** Halaman print-only daftar Serah Terima Barang — satu-satunya tujuannya dibuka headless
 *  Chromium (`api/laporan/serah-terima-barang/pdf`) supaya PDF-nya persis sama dengan yang
 *  tampil di browser. Pola sama `keuangan/kas-bank/print` (lihat `aturan-tampilan.md` §6). */
export default async function PrintSerahTerimaBarangPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageRole(["owner", "admin"])
  const sp = await searchParams
  const accessToken = await getAccessToken()

  const statusParam = typeof sp.status === "string" ? sp.status : null
  const status = statusParam && statusParam in STATUS_LABEL_STB ? (statusParam as keyof typeof STATUS_LABEL_STB) : null
  const from = typeof sp.from === "string" ? sp.from : null
  const to = typeof sp.to === "string" ? sp.to : null

  const [rowsRaw, company] = await Promise.all([
    backendFetch<BarisLaporanSerahTerimaBarang[]>("/serah-terima-barang", { accessToken }),
    backendFetch<DataPerusahaanLaporan>("/company", { accessToken }).catch(() => null),
  ])

  const rows = rowsRaw.filter((r) => {
    if (status && r.status !== status) return false
    const day = r.date.slice(0, 10)
    if (from && day < from) return false
    if (to && day > to) return false
    return true
  })
  const labelParts = [status ? `Status: ${STATUS_LABEL_STB[status]}` : null, from || to ? `Periode: ${from ?? "awal"} s.d. ${to ?? "sekarang"}` : null].filter(
    Boolean,
  )
  const labelPenyaring = labelParts.length ? labelParts.join(" · ") : "Semua data"

  return <LaporanSerahTerimaBarangPrintable rows={rows} labelPenyaring={labelPenyaring} company={company} dicetakOleh={user.name} />
}
