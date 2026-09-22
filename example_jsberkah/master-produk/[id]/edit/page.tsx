import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Package, Keyboard } from "lucide-react"
import { Card, Breadcrumb } from "@/components/ui"
import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { ProdukForm } from "../../ProdukForm"
import { keFormValues } from "../../form-values"
import type { ProductDto, BusinessTypeDto, SupplierDto } from "../../types"

/** Edit Produk — halaman tersendiri, dicapai dengan mengeklik kode/nama produk di daftar.
 *
 *  `back` membawa keadaan daftar yang ditinggalkan (penyaring + halaman ke berapa) supaya Batal
 *  maupun Simpan mengembalikan pemakai ke tempat yang sama, bukan ke halaman 1.
 *
 *  Produknya diambil dari daftar `GET /produk` lalu dicari `id`-nya — backend belum punya
 *  `GET /produk/:id` dan master produk ini jumlahnya ratusan, bukan puluhan ribu; menambah
 *  endpoint baru cuma untuk ini belum sepadan. */
export default async function ProdukEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requirePageRole(["owner", "admin"])
  const { id } = await params
  const sp = await searchParams
  const back = typeof sp.back === "string" ? sp.back : ""
  const accessToken = await getAccessToken()

  const [products, businessTypes, suppliersRaw] = await Promise.all([
    backendFetch<ProductDto[]>("/produk", { accessToken }),
    backendFetch<BusinessTypeDto[]>("/business-types", { accessToken }),
    backendFetch<SupplierDto[]>("/supplier", { accessToken }),
  ])

  const product = products.find((p) => p.id === id)
  if (!product) notFound()

  // Supplier nonaktif tetap ditampilkan KALAU produk ini memang masih menunjuk ke situ —
  // kalau tidak, membuka form lalu menyimpannya diam-diam menghapus supplier default produk.
  const suppliers = suppliersRaw.filter((s) => s.isActive || s.id === product.supplierId)
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
          { label: product.code },
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
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">Edit Produk</h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              <span className="font-mono font-bold text-[#0544cc] dark:text-blue-400">{product.code}</span> — {product.name}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-fg-muted">
          <Keyboard className="w-3.5 h-3.5" />
          Ctrl+S simpan · Esc batal
        </span>
      </div>

      <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
        <ProdukForm
          mode="edit"
          initial={keFormValues(product)}
          businessTypes={businessTypes.map((b) => ({ value: b.id, label: b.name }))}
          suppliers={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          sizeOptions={sizeOptions}
          back={back}
        />
      </Card>
    </div>
  )
}
