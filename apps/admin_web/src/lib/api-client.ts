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

function getToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("obbel-admin-session")
    if (!raw) return null
    return (JSON.parse(raw) as { token?: string }).token ?? null
  } catch {
    return null
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export interface Booth {
  id: string
  code: string
  name: string
  locationName: string | null
  status: "ACTIVE" | "INACTIVE"
}

export interface ProductCategory {
  id: string
  code: string
  name: string
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string | null
  sellPrice: number
  active: boolean
}

export interface UserAccount {
  id: string
  username: string
  fullName: string
  role: "BOOTH_STAFF" | "ADMIN" | "OWNER"
  defaultBoothId: string | null
  active: boolean
}

export interface WarehouseStockItem {
  productId: string
  sku: string
  name: string
  qtyOnHand: number
}

export interface DistributionItem {
  id: string
  productId: string
  productName: string
  sellPrice: number
  qtySent: number
  qtyReceived: number | null
}

export interface Distribution {
  id: string
  distributionNo: string
  status: "SENT" | "RECEIVED" | "DISCREPANCY" | "CANCELLED" | "DRAFT"
  boothId: string
  boothName: string
  sentAt: string | null
  receivedAt: string | null
  note: string | null
  items: DistributionItem[]
}

export interface RestockRequestItemView {
  id: string
  productId: string
  qtyRequested: number
  product: { id: string; name: string; sellPrice: number }
}

export interface StockReturnItemView {
  id: string
  productId: string
  qtySubmitted: number
  qtyReceived: number | null
  product: { id: string; name: string }
}

export interface StockReturn {
  id: string
  returnNo: string
  status: "SUBMITTED" | "RECEIVED" | "DISCREPANCY" | "CANCELLED"
  boothId: string
  booth: { id: string; name: string }
  note: string | null
  submittedAt: string
  receivedAt: string | null
  items: StockReturnItemView[]
}

export interface RestockRequest {
  id: string
  requestNo: string
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED"
  boothId: string
  booth: { id: string; name: string }
  note: string | null
  rejectReason: string | null
  createdAt: string
  items: RestockRequestItemView[]
  distribution: { id: string; distributionNo: string; status: string } | null
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: { username, password } }),

  getBooths: () => request<Booth[]>("/booths"),
  createBooth: (input: { code: string; name: string; locationName?: string }) =>
    request<Booth>("/booths", { method: "POST", body: input }),

  getProducts: () => request<Product[]>("/products"),
  getProductCategories: () => request<ProductCategory[]>("/products/categories"),
  createProduct: (input: { sku: string; name: string; categoryId?: string; sellPrice: number }) =>
    request<Product>("/products", { method: "POST", body: input }),

  getUsers: () => request<UserAccount[]>("/users"),
  createUser: (input: {
    username: string
    password: string
    fullName: string
    role: "BOOTH_STAFF" | "ADMIN" | "OWNER"
    defaultBoothId?: string
  }) => request<UserAccount>("/users", { method: "POST", body: input }),

  getWarehouseStock: () => request<WarehouseStockItem[]>("/warehouse-stock"),
  adjustWarehouseStock: (input: { productId: string; targetQty: number; reason?: string }) =>
    request<{ productId: string; qtyOnHand: number; delta: number }>("/warehouse-stock/adjust", {
      method: "POST",
      body: input,
    }),

  getDistributions: () => request<Distribution[]>("/distributions"),
  createDistribution: (input: {
    idempotencyKey: string
    boothId: string
    items: { productId: string; qty: number }[]
    note?: string
  }) => request<Distribution>("/distributions", { method: "POST", body: input }),

  getRestockRequests: () => request<RestockRequest[]>("/restock-requests"),
  approveRestockRequest: (id: string, items: { productId: string; qtyApproved: number }[]) =>
    request<RestockRequest>(`/restock-requests/${id}/approve`, { method: "POST", body: { items } }),
  rejectRestockRequest: (id: string, reason: string) =>
    request<RestockRequest>(`/restock-requests/${id}/reject`, { method: "POST", body: { reason } }),

  getReturns: () => request<StockReturn[]>("/returns"),
  receiveReturn: (id: string, items: { productId: string; qtyReceived: number }[]) =>
    request<StockReturn>(`/returns/${id}/receive`, { method: "POST", body: { items } }),
}
