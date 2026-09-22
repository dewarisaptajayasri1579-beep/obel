import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, ClipboardCheck } from "lucide-react"
import { Card, Breadcrumb, TombolPintasan, type Pintasan } from "@/components/ui"
import { getCurrentUser } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { OpnameForm } from "./OpnameForm"

interface StoreDto { id: string; name: string; status: string; defaultPetugasId: string | null }
interface QuotaDto { storeId: string; productId: string; quotaQty: number; isActive: boolean }
interface ProductDto { id: string; name: string; code: string; unit: string; sellPrice: number }
interface StockTokoRow { storeId: string; productId: string; stock: number }
interface CompanyDto { name: string; legalName: string | null; address: string | null; phone: string | null; logoUrl: string | null }

export default async function OpnameBaruPage() {
  const user = await getCurrentUser()
  if (user.role === "owner") redirect("/operasional/opname")

  const accessToken = await getAccessToken()
  const [storesRaw, quotasRaw, products, stockRows, company] = await Promise.all([
    backendFetch<StoreDto[]>("/toko", { accessToken }),
    backendFetch<QuotaDto[]>("/toko/quotas", { accessToken }),
    backendFetch<ProductDto[]>("/produk", { accessToken }),
    backendFetch<StockTokoRow[]>("/stock/toko", { accessToken }),
    backendFetch<CompanyDto>("/company", { accessToken }).catch(() => null),
  ])

  const stores = storesRaw.filter((s) => s.status === "AKTIF" && (user.role !== "sales" || s.defaultPetugasId === user.id))
  const quotas = quotasRaw.filter((q) => q.isActive)

  const stockMap: Record<string, number> = {}
  for (const s of stockRows) stockMap[`${s.storeId}-${s.productId}`] = s.stock

  const quotasByStore: Record<string, { productId: string; productName: string; productCode: string; unit: string; quotaQty: number; stockSistem: number; sellPrice: number }[]> = {}
  for (const q of quotas) {
    const product = products.find((p) => p.id === q.productId)
    if (!product) continue
    if (!quotasByStore[q.storeId]) quotasByStore[q.storeId] = []
    quotasByStore[q.storeId].push({
      productId: q.productId,
      productName: product.name,
      productCode: product.code,
      unit: product.unit,
      quotaQty: q.quotaQty,
      stockSistem: stockMap[`${q.storeId}-${q.productId}`] ?? 0,
      sellPrice: product.sellPrice,
    })
  }

  const daftarPintasan: Pintasan[] = [
    { tombol: ["Enter"], arti: "Di kolom Fisik: pindah ke baris berikutnya" },
    { tombol: ["Tab"], arti: "Sama dengan Enter, kebiasaan dari web" },
    { tombol: ["Ctrl", "S"], arti: "Selesaikan (buka konfirmasi)" },
    { tombol: ["Ctrl", "P"], arti: "Preview dokumen" },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Operasional Lapangan" },
            { label: "Stock Opname (Parfum)", href: "/operasional/opname" },
            { label: "Buat Baru" },
          ]}
        />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Link
              href="/operasional/opname"
              className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <ClipboardCheck className="w-5 h-5 text-[#0544cc] dark:text-blue-400 mt-1.5 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">Buat Stock Opname</h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
                Isi stock fisik tiap produk — terjual, refill, dan tagihan dihitung otomatis begitu disimpan (langsung Selesai, tidak bisa diedit lagi).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3.5 self-end sm:self-auto">
            <span className="text-xs font-bold text-slate-500 dark:text-fg-muted uppercase tracking-wide text-right">
              No. Bukti: <span className="font-mono normal-case italic text-slate-400 dark:text-fg-muted/70">Otomatis saat disimpan</span>
            </span>
            <TombolPintasan daftar={daftarPintasan} />
          </div>
        </div>

        <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
          <OpnameForm
            stores={stores.map((s) => ({ value: s.id, label: s.name }))}
            quotasByStore={quotasByStore}
            currentUserName={user.name}
            company={company}
          />
        </Card>
      </div>
  )
}
