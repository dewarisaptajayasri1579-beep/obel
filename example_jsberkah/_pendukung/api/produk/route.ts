import { NextResponse } from "next/server"

import { getAccessToken } from "@/lib/session"
import { backendFetch, BackendError } from "@/lib/backend-client"

/** Proxy tipis ke backend NestJS (`/produk`) — website tidak lagi query Prisma langsung
 *  (Tahap 0g, `tahapan.md`). Body diteruskan apa adanya, validasi sudah dilakukan backend
 *  (`class-validator`). */
export async function GET() {
  const accessToken = await getAccessToken()
  try {
    const products = await backendFetch("/produk", { accessToken })
    return NextResponse.json(products)
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Gagal menghubungi server" }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const accessToken = await getAccessToken()
  const body = await request.json().catch(() => null)
  try {
    const product = await backendFetch("/produk", { method: "POST", body, accessToken })
    return NextResponse.json({ ok: true, product }, { status: 201 })
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Gagal menghubungi server" }, { status: 502 })
  }
}
