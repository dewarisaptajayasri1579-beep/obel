import Link from "next/link"
import { ArrowLeft, Package, Keyboard } from "lucide-react"
import { Card, Breadcrumb } from "@/components/ui"
import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { ProdukForm } from "../ProdukForm"
import { nilaiAwalProduk } from "../form-values"
import type { BusinessTypeDto, SupplierDto, ProductDto } from "../types"

/** Tambah Produk — halaman tersendiri (bukan modal): lihat alasannya di `ProdukForm`. */
export default async function ProdukBaruPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageRole(["owner", "admin"])
  const sp = await searchParams
  const back = typeof sp.back === "string" ? sp.back : ""
  const accessToken = await getAccessToken()

  const [businessTypes, suppliersRaw, products] = await Promise.all([
    backendFetch<BusinessTypeDto[]>("/business-types", { accessToken }),
    backendFetch<SupplierDto[]>("/supplier", { accessToken }),
    backendFetch<ProductDto[]>("/produk", { accessToken }),
  ])
  const suppliers = suppliersRaw.filter((s) => s.isActive)
  // Saran dropdown "Ukuran" dari ukuran yang sudah pernah dipakai produk lain — supaya
  // "60ml"/"60 ml"/"60ML" tidak ikut bercampur jadi ukuran berbeda cuma karena beda cara ketik.
  const sizeOptions = Array.from(new Set(products.map((p) => p.size?.trim()).filter((s): s is string => !!s))).sort()
  const kembali = `/master/produk${back ? `?${back}` : ""}`

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Data Operasional" },
          { label: "Produk", href: kembali },
          { label: "Tambah Baru" },
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
          <Package className="w-5 h-5 text-[#0544cc] dark:text-blue-400 mt-1.5 flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">Tambah Produk</h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              Isi dari atas ke bawah — tekan Enter untuk lompat ke isian berikutnya.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-fg-muted">
          <Keyboard className="w-3.5 h-3.5" />
          Ctrl+S simpan · Ctrl+Enter simpan &amp; tambah lagi · Esc batal
        </span>
      </div>

      <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
        <ProdukForm
          mode="create"
          initial={nilaiAwalProduk(businessTypes[0]?.id ?? "")}
          businessTypes={businessTypes.map((b) => ({ value: b.id, label: b.name }))}
          suppliers={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          sizeOptions={sizeOptions}
          back={back}
        />
      </Card>
    </div>
  )
}
