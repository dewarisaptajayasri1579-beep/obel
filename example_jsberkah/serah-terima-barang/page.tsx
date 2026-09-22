import { Breadcrumb } from "@/components/ui"
import { requirePageRole } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { SerahTerimaBarangPanel, type SerahTerimaBarangRow } from "./SerahTerimaBarangPanel"

export default async function SerahTerimaBarangPage() {
  const user = await requirePageRole(["owner", "admin"])
  const rows = await backendFetch<SerahTerimaBarangRow[]>("/serah-terima-barang", { accessToken: await getAccessToken() })

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Pembelian" }, { label: "Serah Terima Barang" }]} />
      <SerahTerimaBarangPanel rows={rows} canCreate={user.role === "admin"} />
    </div>
  )
}
