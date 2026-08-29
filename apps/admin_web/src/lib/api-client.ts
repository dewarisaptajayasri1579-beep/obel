/// Client HTTP tipis ke Backend API (Node.js/NestJS) — satu backend yang
/// sama dipakai Petugas Booth, Admin Pusat, dan Owner (AGENTS.md).
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

/// Error dari Backend API mengikuti envelope {code, message, details} di
/// docs/obbel-coffee-ai-docs/09-api-rpc-contract.md §15.
export class ApiError extends Error {
  code: string
  details?: Record<string, unknown>

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.details = details
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    if (data && typeof data === "object" && "code" in data) {
      const message = Array.isArray(data.message) ? data.message.join(", ") : String(data.message)
      throw new ApiError(data.code, message, data.details)
    }
    throw new ApiError("UNKNOWN_ERROR", `Terjadi kesalahan (${res.status}).`)
  }

  return data as T
}

export interface LoginResponse {
  accessToken: string
  profile: {
    id: string
    username: string
    fullName: string
    role: "BOOTH_STAFF" | "ADMIN" | "OWNER"
    defaultBoothId: string | null
  }
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: { username, password } }),
  // Endpoint admin lain (booths, products, distributions, dst.) menyusul begitu
  // backend menyediakannya — lihat timeline "Opsi A" di percakapan project.
}
