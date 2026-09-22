import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ClipboardCheck } from "lucide-react"
import { Card, Breadcrumb, TombolPintasan, type Pintasan } from "@/components/ui"
import { getCurrentUser } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch, BackendError } from "@/lib/backend-client"
import { formatDateLong } from "@/lib/format"
import { OpnameForm } from "../baru/OpnameForm"

interface StoreDto { id: string; name: string; status: string; defaultPetugasId: string | null }
interface CompanyDto { name: string; legalName: string | null; address: string | null; phone: string | null; logoUrl: string | null }

interface OpnameDetail {
  id: string
  opnameNumber: string
  date: string
  status: "DRAFT" | "SELESAI"
  storeId: string
  store: { name: string }
  petugas: { name: string }
  items: {
    id: string
    productId: string
    quotaQty: number
    stockSistem: number
    stockFisik: number
    terjualQty: number
    refillQty: number
    selisihType: string
    subtotalTagihan: string | number
    product: { name: string; code: string }
  }[]
}

/** Detail Stock Opname — SATU komponen sama persis dengan `baru/` (`OpnameForm` lewat
 *  `initialData`), pola persis `pembelian/purchase-order/[id]/page.tsx`. `readOnly` SELALU true
 *  begitu `initialData` ada — Stock Opname tidak pernah bisa diedit/dibatalkan/dikoreksi sama
 *  sekali (bukan cuma "belum ada fiturnya" — backend cuma punya create/findAll/findOne, tidak
 *  ada endpoint lain untuk modul ini). */
export default async function OpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await getCurrentUser()
  const { id } = await params
  const accessToken = await getAccessToken()

  let opname: OpnameDetail
  try {
    opname = await backendFetch<OpnameDetail>(`/opname/${id}`, { accessToken })
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound()
    throw e
  }

  const [stores, company] = await Promise.all([
    backendFetch<StoreDto[]>("/toko", { accessToken }),
    backendFetch<CompanyDto>("/company", { accessToken }).catch(() => null),
  ])

  const daftarPintasan: Pintasan[] = [{ tombol: ["Ctrl", "P"], arti: "Preview dokumen" }]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Operasional Lapangan" },
            { label: "Stock Opname (Parfum)", href: "/operasional/opname" },
            { label: opname.opnameNumber },
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
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">{opname.opnameNumber}</h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
                {formatDateLong(opname.date)} · {opname.store.name} · {opname.petugas.name}
              </p>
            </div>
          </div>
          <TombolPintasan daftar={daftarPintasan} />
        </div>

        <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
          <OpnameForm
            stores={stores.map((s) => ({ value: s.id, label: s.name }))}
            quotasByStore={{}}
            initialData={{
              id: opname.id,
              opnameNumber: opname.opnameNumber,
              date: opname.date,
              status: opname.status,
              storeId: opname.storeId,
              petugasName: opname.petugas.name,
              items: opname.items.map((i) => ({
                productId: i.productId,
                productCode: i.product.code,
                productName: i.product.name,
                quotaQty: i.quotaQty,
                stockSistem: i.stockSistem,
                stockFisik: i.stockFisik,
                terjualQty: i.terjualQty,
                refillQty: i.refillQty,
                selisihType: i.selisihType,
                subtotalTagihan: Number(i.subtotalTagihan),
              })),
            }}
            company={company}
          />
        </Card>
      </div>
  )
}
