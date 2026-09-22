import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, PackageCheck } from "lucide-react"
import { Card, Breadcrumb, TombolPintasan, type Pintasan } from "@/components/ui"
import { getCurrentUser } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { SerahTerimaBarangForm } from "./SerahTerimaBarangForm"

interface UserDto { id: string; name: string; role: string }
interface WarehouseDto { id: string; name: string; isActive: boolean }
interface ProductDto { id: string; name: string; code: string }
interface StockGudangRow { productId: string; warehouseId: string; stock: number }

export default async function SerahTerimaBarangBaruPage() {
  const user = await getCurrentUser()
  if (user.role !== "admin") redirect("/pembelian/serah-terima-barang")

  const accessToken = await getAccessToken()
  const [users, warehousesRaw, products, stockRows] = await Promise.all([
    backendFetch<UserDto[]>("/users", { accessToken }),
    backendFetch<WarehouseDto[]>("/gudang", { accessToken }),
    backendFetch<ProductDto[]>("/produk", { accessToken }),
    backendFetch<StockGudangRow[]>("/stock/gudang", { accessToken }),
  ])

  const salesUsers = users.filter((u) => u.role === "sales")
  const warehouses = warehousesRaw.filter((w) => w.isActive)

  // productId -> stock, per gudang -- dipakai form buat nge-nonaktifkan/nunjukin stok 0 di
  // dropdown produk (sebelumnya form nggak tau stok sama sekali, baru ketahuan gagal pas submit
  // karena backend nolak qty > stock gudang saat ini).
  const stockByWarehouse: Record<string, Record<string, number>> = {}
  for (const row of stockRows) {
    (stockByWarehouse[row.warehouseId] ??= {})[row.productId] = row.stock
  }

  const daftarPintasan: Pintasan[] = [
    { tombol: ["Enter"], arti: "Di baris Produk: maju ke kolom berikutnya, baris baru muncul sendiri" },
    { tombol: ["Tab"], arti: "Sama dengan Enter, kebiasaan dari web" },
    { tombol: ["Ctrl", "D"], arti: "Hapus baris yang sedang fokus" },
    { tombol: ["Ctrl", "S"], arti: "Simpan (buka konfirmasi)" },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Pembelian" },
            { label: "Serah Terima Barang", href: "/pembelian/serah-terima-barang" },
            { label: "Baru" },
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
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">Serah Terima Barang Baru</h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
                Nomor STB digenerate otomatis. Stock BELUM pindah sampai Sales konfirmasi lewat Android.
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
          <SerahTerimaBarangForm
            salesOptions={salesUsers.map((u) => ({ value: u.id, label: u.name }))}
            warehouses={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            products={products.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
            stockByWarehouse={stockByWarehouse}
          />
        </Card>
      </div>
  )
}
