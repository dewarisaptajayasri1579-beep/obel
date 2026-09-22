import { Card, Breadcrumb } from "@/components/ui"
import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { ArsipPanel, type BarisArsip } from "@/components/ArsipPanel"
import type { FilterableColumn } from "@/components/ui"

interface ArsipDto extends BarisArsip {
  code: string
  name: string
  unit: string
}

/** Arsip Produk (Tahap 20) — Owner-only, sama seperti @Roles("owner") di endpoint backend.
 *  requirePageRole di sini bukan pengaman utamanya (itu tetap backend), tapi supaya Admin tidak
 *  dikirim ke halaman yang isinya pasti 403. */
export default async function ArsipProdukPage() {
  await requirePageRole(["owner"])
  const rows = await backendFetch<ArsipDto[]>("/produk/arsip", { accessToken: await getAccessToken() })

  const columns: FilterableColumn<ArsipDto>[] = [
    { key: "code", header: "Kode", cell: (p) => <span className="font-mono text-xs font-bold text-slate-600 dark:text-fg-muted">{p.code}</span>, filterValue: (p) => p.code },
    { key: "name", header: "Nama", cell: (p) => <span className="font-bold text-slate-800 dark:text-fg">{p.name}</span>, filterValue: (p) => p.name },
    { key: "unit", header: "Satuan", cell: (p) => p.unit },
  ]

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Data Operasional" }, { label: "Produk", href: "/master/produk" }, { label: "Arsip" }]} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-fg tracking-tight">Arsip Produk</h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
          Data yang sudah dihapus beserta siapa yang menghapus, kapan, dan alasannya. Bisa dipulihkan kapan saja.
        </p>
      </div>

      <Card variant="panel" padding="lg">
        <ArsipPanel
          rows={rows}
          columns={columns}
          endpoint="/api/produk"
          entitas="Produk"
          label={(r) => r.name}
        />
      </Card>
    </div>
  )
}
