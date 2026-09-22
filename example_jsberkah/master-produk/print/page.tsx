import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { bacaPenyaringProduk, saringProduk, labelPenyaringProduk } from "@/lib/produk-filter"
import { keBarisProduk, type ProductDto, type BusinessTypeDto, type SupplierDto } from "../types"
import { LaporanProdukPrintable } from "./LaporanProdukPrintable"

interface DataPerusahaan {
  name: string
  legalName: string | null
  address: string | null
  phone: string | null
}

/** Halaman print-only daftar produk — satu-satunya tujuannya dibuka headless Chromium
 *  (`api/laporan/produk/pdf`) supaya PDF-nya persis sama dengan yang tampil di browser, bukan
 *  layout PDF terpisah yang gampang divergen. Pola sama `pembelian/purchase-order/print`.
 *
 *  Ada di balik login (`requirePageRole`) karena isinya rekap internal — konsekuensinya route
 *  PDF-nya harus meneruskan cookie sesi ke Chromium (lihat `RenderPdfOptions.cookieHeader`).
 *
 *  Penyaring `q`/`bisnis`/`status` dijalankan lewat `saringProduk`, fungsi yang SAMA dengan yang
 *  dipakai panel di layar — bukan penyaringan terpisah yang gampang berbeda hasilnya. */
export default async function PrintDaftarProdukPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requirePageRole(["owner", "admin"])
  const sp = await searchParams
  const accessToken = await getAccessToken()

  const params = new URLSearchParams()
  for (const key of ["q", "bisnis", "status"]) {
    const nilai = sp[key]
    if (typeof nilai === "string" && nilai) params.set(key, nilai)
  }
  const penyaring = bacaPenyaringProduk(params)

  const [products, businessTypes, suppliers, company] = await Promise.all([
    backendFetch<ProductDto[]>("/produk", { accessToken }),
    backendFetch<BusinessTypeDto[]>("/business-types", { accessToken }),
    backendFetch<SupplierDto[]>("/supplier", { accessToken }),
    backendFetch<DataPerusahaan>("/company", { accessToken }).catch(() => null),
  ])

  const namaBisnis = (id: string) => businessTypes.find((b) => b.id === id)?.name ?? "-"
  const namaSupplier = (id: string) => suppliers.find((s) => s.id === id)?.name ?? "-"

  const rows = saringProduk(products.map((p) => keBarisProduk(p)), penyaring)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      variant: p.variant,
      size: p.size,
      unit: p.unit,
      businessTypeName: namaBisnis(p.businessTypeId),
      supplierName: p.supplierId ? namaSupplier(p.supplierId) : "-",
      sellPrice: p.sellPrice,
      costPrice: p.costPrice,
      isActive: p.isActive,
    }))

  return (
    <LaporanProdukPrintable
      rows={rows}
      labelPenyaring={labelPenyaringProduk(penyaring, penyaring.bisnis ? namaBisnis(penyaring.bisnis) : null)}
      company={company}
      dicetakOleh={user.name}
    />
  )
}
