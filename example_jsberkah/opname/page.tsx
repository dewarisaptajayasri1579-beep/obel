import { Breadcrumb } from "@/components/ui"
import { getCurrentUser } from "@/lib/current-user"
import { getAccessToken } from "@/lib/session"
import { backendFetch } from "@/lib/backend-client"
import { OpnamePanel, type OpnameRow } from "./OpnamePanel"

export default async function OpnamePage() {
  const user = await getCurrentUser()
  const rows = await backendFetch<OpnameRow[]>("/opname", { accessToken: await getAccessToken() })

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Operasional Lapangan" }, { label: "Stock Opname (Parfum)" }]} />
      <OpnamePanel rows={rows} canCreate={user.role !== "owner"} />
    </div>
  )
}
