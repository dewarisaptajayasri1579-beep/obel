import { NextResponse } from "next/server"

import { getAccessToken } from "@/lib/session"
import { backendFetch, BackendError } from "@/lib/backend-client"

/** Pulihkan data yang di-soft-delete (Tahap 20). Owner-only, dijaga @Roles di backend. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accessToken = await getAccessToken()
  try {
    const data = await backendFetch(`/produk/${id}/restore`, { method: "POST", accessToken })
    return NextResponse.json({ ok: true, data })
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Gagal menghubungi server" }, { status: 502 })
  }
}
