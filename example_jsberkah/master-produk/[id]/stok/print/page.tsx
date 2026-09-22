import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { LaporanRekapStokPrintable, type BarisCetak, type RingkasanCetak } from "./LaporanRekapStokPrintable"
import type { JenisLokasi } from "../stok-labels"

interface DataRekap {
  product: { id: string; code: string; name: string; unit: string }
  period: { from: string; to: string }
  sections: { locationType: JenisLokasi; rows: BarisCetak[]; total: RingkasanCetak }[]
  grandTotal: RingkasanCetak
}

interface DataPerusahaan {
  name: string
  legalName: string | null
  address: string | null
  phone: string | null
}

/** Halaman print-only Rekap Stok Produk — sumber PDF-nya (`api/laporan/rekap-stok/[id]/pdf`),
 *  dirender headless Chromium. Ada di balik login, jadi route PDF-nya meneruskan cookie sesi.
 *  Pola sama `master/produk/print` dan `pembelian/purchase-order/print`. */
export default async function PrintRekapStokPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requirePageRole(["owner", "admin"])
  const { id } = await params
  const sp = await searchParams
  const teks = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : "")

  const qs = new URLSearchParams()
  if (teks("from")) qs.set("from", teks("from"))
  if (teks("to")) qs.set("to", teks("to"))

  const accessToken = await getAccessToken()
  const [data, company] = await Promise.all([
    backendFetch<DataRekap>(`/stock/produk/${id}/rekap${qs.toString() ? `?${qs}` : ""}`, { accessToken }),
    backendFetch<DataPerusahaan>("/company", { accessToken }).catch(() => null),
  ])

  return (
    <LaporanRekapStokPrintable
      product={data.product}
      period={data.period}
      sections={data.sections}
      grandTotal={data.grandTotal}
      company={company}
      dicetakOleh={user.name}
    />
  )
}
