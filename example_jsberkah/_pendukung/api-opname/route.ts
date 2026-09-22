import { NextResponse } from "next/server"

import { getAccessToken } from "@/lib/session"
import { backendFetch, BackendError } from "@/lib/backend-client"

export async function POST(request: Request) {
  const accessToken = await getAccessToken()
  const body = await request.json().catch(() => null)
  try {
    const result = await backendFetch("/opname", { method: "POST", body, accessToken })
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: "Gagal menghubungi server" }, { status: 502 })
  }
}
