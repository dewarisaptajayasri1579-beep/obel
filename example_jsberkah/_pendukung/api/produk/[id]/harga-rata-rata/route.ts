import { NextResponse } from "next/server"

import { getAccessToken } from "@/lib/session"
import { backendFetch, BackendError } from "@/lib/backend-client"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accessToken = await getAccessToken()
  try {
    return NextResponse.json(await backendFetch(`/produk/${id}/harga-rata-rata`, { accessToken }))
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Gagal menghubungi server" }, { status: 502 })
  }
}
