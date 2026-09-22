import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, PackageCheck } from "lucide-react"
import { Card, Breadcrumb, TombolPintasan, type Pintasan } from "@/components/ui"
import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch, BackendError } from "@/lib/backend-client"
import { formatDateLong } from "@/lib/format"
import { SerahTerimaBarangForm } from "../baru/SerahTerimaBarangForm"

interface UserDto { id: string; name: string; role: string }
interface WarehouseDto { id: string; name: string; isActive: boolean }
interface ProductDto { id: string; name: string; code: string }
interface StockGudangRow { productId: string; warehouseId: string; stock: number }
interface CompanyDto { name: string; legalName: string | null; address: string | null; phone: string | null; logoUrl: string | null }

interface SerahTerimaBarangDetail {
  id: string
  stbNumber: string
  date: string
  status: "MENUNGGU_KONFIRMASI" | "DIKONFIRMASI" | "DITOLAK"
  notes: string | null
  salesId: string
  salesName: string
  warehouseId: string
  warehouseName: string
  creatorName: string | null
  confirmedAt: string | null
  items: { id: string; productId: string; productCode: string; productName: string; qty: number; qtyFisik: number | null; alasanSelisih: string | null }[]
}

const STATUS_LABEL: Record<SerahTerimaBarangDetail["status"], string> = {
  MENUNGGU_KONFIRMASI: "Menunggu Konfirmasi",
  DIKONFIRMASI: "Dikonfirmasi",
  DITOLAK: "Ditolak",
}

const STATUS_STYLE: Record<SerahTerimaBarangDetail["status"], string> = {
  MENUNGGU_KONFIRMASI: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-500/20",
  DIKONFIRMASI: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20",
  DITOLAK: "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-500/20",
}

const STATUS_DOT: Record<SerahTerimaBarangDetail["status"], string> = {
  MENUNGGU_KONFIRMASI: "bg-amber-500",
  DIKONFIRMASI: "bg-emerald-500",
  DITOLAK: "bg-rose-500",
}

/** Detail STB — SATU komponen sama persis dengan `baru/` (`SerahTerimaBarangForm` lewat
 *  `initialData`), pola persis `pembelian/purchase-order/[id]/page.tsx`. `readOnly` SELALU true
 *  di sini (beda dari PO yang readOnly cuma kalau bukan DRAFT) — STB tidak pernah bisa diedit
 *  setelah dibuat, konfirmasi/tolak dilakukan Sales lewat Android, bukan di website. */
export default async function SerahTerimaBarangDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole(["owner", "admin"])
  const { id } = await params
  const accessToken = await getAccessToken()

  let stb: SerahTerimaBarangDetail
  try {
    stb = await backendFetch<SerahTerimaBarangDetail>(`/serah-terima-barang/${id}`, { accessToken })
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound()
    throw e
  }

  const [users, warehousesRaw, products, stockRows, company] = await Promise.all([
    backendFetch<UserDto[]>("/users", { accessToken }),
    backendFetch<WarehouseDto[]>("/gudang", { accessToken }),
    backendFetch<ProductDto[]>("/produk", { accessToken }),
    backendFetch<StockGudangRow[]>("/stock/gudang", { accessToken }),
    backendFetch<CompanyDto>("/company", { accessToken }).catch(() => null),
  ])

  const salesUsers = users.filter((u) => u.role === "sales")
  const warehouses = warehousesRaw.filter((w) => w.isActive)

  const stockByWarehouse: Record<string, Record<string, number>> = {}
  for (const row of stockRows) {
    (stockByWarehouse[row.warehouseId] ??= {})[row.productId] = row.stock
  }

  const daftarPintasan: Pintasan[] = [{ tombol: ["Ctrl", "P"], arti: "Preview dokumen STB" }]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Pembelian" },
            { label: "Serah Terima Barang", href: "/pembelian/serah-terima-barang" },
            { label: stb.stbNumber },
          ]}
        />

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Link
              href="/pembelian/serah-terima-barang"
              className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <PackageCheck className="w-5 h-5 text-[#0544cc] dark:text-blue-400 mt-1.5 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">{stb.stbNumber}</h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
                {formatDateLong(stb.date)} · {stb.salesName} · {stb.warehouseName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3.5 self-end sm:self-auto">
            <div className="flex flex-col items-end gap-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_STYLE[stb.status]}`}>
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[stb.status]}`} />
                {STATUS_LABEL[stb.status]}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-fg-muted/70">dibuat oleh {stb.creatorName ?? "-"}</span>
            </div>
            <TombolPintasan daftar={daftarPintasan} />
          </div>
        </div>

        <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
          <SerahTerimaBarangForm
            salesOptions={salesUsers.map((u) => ({ value: u.id, label: u.name }))}
            warehouses={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            products={products.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
            stockByWarehouse={stockByWarehouse}
            initialData={{
              id: stb.id,
              stbNumber: stb.stbNumber,
              date: stb.date,
              status: stb.status,
              creatorName: stb.creatorName,
              salesId: stb.salesId,
              warehouseId: stb.warehouseId,
              notes: stb.notes ?? "",
              items: stb.items.map((i) => ({
                productId: i.productId,
                productCode: i.productCode,
                productName: i.productName,
                qty: i.qty,
                qtyFisik: i.qtyFisik,
                alasanSelisih: i.alasanSelisih,
              })),
            }}
            readOnly
            currentUserName={user.name}
            company={company}
          />
        </Card>
      </div>
  )
}
