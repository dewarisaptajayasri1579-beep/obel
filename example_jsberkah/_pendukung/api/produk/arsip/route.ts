import { NextResponse } from "next/server"

import { getAccessToken } from "@/lib/session"
import { backendFetch, BackendError } from "@/lib/backend-client"

/** Isi layar Arsip (Tahap 20) — data yang di-soft-delete, lengkap dengan siapa & kapan & kenapa.
 *  Pembatasan owner-only ada di @Roles backend, bukan di sini: proxy ini cuma meneruskan token. */
export async function GET() {
  const accessToken = await getAccessToken()
  try {
    const data = await backendFetch("/produk/arsip", { accessToken })
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Gagal menghubungi server" }, { status: 502 })
  }
}
