import { NextResponse } from "next/server"

import { getAccessToken } from "@/lib/session"
import { backendFetch, BackendError } from "@/lib/backend-client"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accessToken = await getAccessToken()
  const body = await request.json().catch(() => null)
  try {
    const product = await backendFetch(`/produk/${id}`, { method: "PATCH", body, accessToken })
    return NextResponse.json({ ok: true, product })
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Gagal menghubungi server" }, { status: 502 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accessToken = await getAccessToken()
  // Alasan hapus wajib, divalidasi backend (HapusDto) — diteruskan apa adanya.
  const body = await request.json().catch(() => null)
  try {
    await backendFetch(`/produk/${id}`, { method: "DELETE", body, accessToken })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Gagal menghubungi server" }, { status: 502 })
  }
}
