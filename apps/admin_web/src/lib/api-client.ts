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

const REQUEST_TIMEOUT_MS = 15_000

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = getToken()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    // Timeout & putus koneksi selalu jadi ApiError berpesan jelas
    // (docs/11-notification-printing-offline.md §8: "timeout message jelas"),
    // bukan TypeError mentah dari fetch() yang jatuh ke toast generik.
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("TIMEOUT", "Koneksi ke server timeout. Periksa jaringan Anda lalu coba lagi.")
    }
    throw new ApiError("NETWORK_ERROR", "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.")
  } finally {
    clearTimeout(timeoutId)
  }

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
  imageUrl: string | null
  active: boolean
  /// Default stok Menipis/Kritis produk ini di seluruh booth — dipakai
  /// sebagai fallback kalau booth tertentu belum punya threshold sendiri
  /// (lihat BoothStockThreshold & BR-007).
  minimumQty: number
  criticalQty: number
}

/// Rekap & riwayat mutasi stok (GET /stock-movements/*). Dihitung backend dari
/// ledger `stock_movements`; klien tidak pernah menyimpulkan arah mutasi sendiri.
export interface BarisRekapStok {
  productId: string
  sku: string
  name: string
  saldoAwal: number
  masuk: number
  keluar: number
  saldoAkhir: number
  perluVerifikasi: boolean
}

export interface RekapStokResponse {
  periode: { bulan: number; tahun: number }
  lokasi: string
  rows: BarisRekapStok[]
  total: { saldoAwal: number; masuk: number; keluar: number; saldoAkhir: number; perluVerifikasi: boolean }
}

export interface BarisRinciMutasi {
  id: string
  tanggal: string
  movementNo: string
  keterangan: string
  arah: "MASUK" | "KELUAR"
  qty: number
  saldo: number
  perluVerifikasi: boolean
}

export interface RinciMutasiResponse {
  product: { id: string; sku: string; name: string }
  periode: { bulan: number; tahun: number }
  lokasi: string
  ringkasan: { saldoAwal: number; masuk: number; keluar: number; saldoAkhir: number }
  rows: BarisRinciMutasi[]
  perluVerifikasi: boolean
}

export interface SaldoLokasi {
  tipe: "WAREHOUSE" | "BOOTH"
  lokasiId: string
  nama: string
  saldoAwal: number
  masuk: number
  keluar: number
  saldoAkhir: number
  perluVerifikasi: boolean
}

export interface RingkasStokProduk {
  productId: string
  sku: string
  name: string
  lokasi: SaldoLokasi[]
  total: { saldoAwal: number; masuk: number; keluar: number; saldoAkhir: number; perluVerifikasi: boolean }
}

export interface RingkasStokResponse {
  periode: { bulan: number; tahun: number }
  rows: RingkasStokProduk[]
}

export interface CompanyProfile {
  id: string
  name: string
  legalName: string | null
  address: string | null
  phone: string | null
  logoUrl: string | null
  updatedAt: string
}

export interface FilterLaporanProduk {
  q?: string
  kategoriId?: string
  status?: "active" | "inactive"
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

/// Tambah Stok Gudang. DRAFT tidak menyentuh stok; POSTED sudah menambah
/// WarehouseStock dan tercatat di /stock-movements. REVISED = digantikan
/// versi revisi yang lebih baru (dokumen tetap ada untuk riwayat).
export interface StockReceiptItem {
  id: string
  productId: string
  qtyReceived: number
  product: { id: string; sku: string; name: string }
}

export interface FilterLaporanPenerimaan {
  q?: string
  status?: "DRAFT" | "POSTED" | "REVISED"
}

export interface StockReceipt {
  id: string
  receiptNo: string
  status: "DRAFT" | "POSTED" | "REVISED"
  receiptDate: string
  note: string | null
  postedAt: string | null
  createdAt: string
  transactionGroupId: string
  versionNo: number
  revisionOfId: string | null
  items: StockReceiptItem[]
  createdBy: { id: string; username: string; fullName: string }
  postedBy: { id: string; username: string; fullName: string } | null
}

export interface RestockRequestItemView {
  id: string
  productId: string
  qtyRequested: number
  product: { id: string; name: string; sellPrice: number }
}

export interface ReportsSummary {
  salesTrend: { date: string; omzet: number; cup: number }[]
  boothRanking: { boothName: string; omzet: number; cup: number }[]
  productRanking: { productName: string; qty: number }[]
}

export interface AdminDashboard {
  omzetToday: number
  cupSoldToday: number
  transactionCountToday: number
  activeBoothsCount: number
  lowStockCount: number
  pendingDistributions: number
  pendingRestock: number
  pendingReturns: number
  reconciliationCasesOpen: number
}

export interface BoothStockRow {
  boothId: string
  boothName: string
  productId: string
  productName: string
  qtyOnHand: number
  status: "Aman" | "Menipis" | "Kritis" | "Habis"
}

export interface SaleListItem {
  id: string
  saleNo: string
  boothName: string
  staffName: string
  status: "PENDING" | "PAID" | "VOIDED"
  total: number
  cupCount: number
  paymentMethod: "CASH" | "QRIS"
  paidAt: string | null
  createdAt: string
  versionNo?: number
  isRevised?: boolean
}

export interface SaleDetailItem {
  productId: string
  productName: string
  unitPrice: number
  qty: number
}

export interface SaleDetail {
  id: string
  saleNo: string
  boothName: string
  staffName: string
  status: "PENDING" | "PAID" | "VOIDED"
  total: number
  paymentMethod: "CASH" | "QRIS"
  versionNo: number
  items: SaleDetailItem[]
}

export interface SaleRefund {
  id: string
  refundNo: string
  saleId: string
  condition: "REFUND_NO_STOCK_RETURN" | "REFUND_WITH_STOCK_RETURN" | "PARTIAL_REFUND"
  amount: number
  reasonCode: string
  reasonNote: string | null
  createdByName: string
  createdAt: string
  items: { productId: string; productName: string; qty: number; unitPrice: number; lineTotal: number; stockReturned: boolean }[]
}

export interface SaleCorrectionImpact {
  omzetDelta: number
  cupSoldDelta: number
  stockDeltas: { productId: string; productName: string; qtyDelta: number }[]
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

export interface ShiftTemplate {
  id: string
  name: string
  startTime: string
  endTime: string
  active: boolean
}

export interface BoothStockThreshold {
  productId: string
  productName: string
  minimumQty: number
  criticalQty: number
  isCustomized: boolean
}

export type ReasonCode =
  | "WRONG_PRODUCT"
  | "WRONG_QTY"
  | "WRONG_BOOTH"
  | "WRONG_SHIFT"
  | "WRONG_PAYMENT_METHOD"
  | "DUPLICATE_TRANSACTION"
  | "TRANSACTION_NEVER_HAPPENED"
  | "WRONG_PHYSICAL_COUNT"
  | "DAMAGED"
  | "SPILLED"
  | "LOST"
  | "FOUND"
  | "DATA_ENTRY_ERROR"
  | "SYSTEM_ERROR"
  | "OTHER"

/// docs/obbel-coffee-ai-docs/24-data-consistency-correction-reversal.md §10.
export const REASON_CODE_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: "WRONG_PRODUCT", label: "Salah Produk" },
  { value: "WRONG_QTY", label: "Salah Qty" },
  { value: "WRONG_BOOTH", label: "Salah Booth" },
  { value: "WRONG_SHIFT", label: "Salah Shift" },
  { value: "WRONG_PAYMENT_METHOD", label: "Salah Metode Pembayaran" },
  { value: "DUPLICATE_TRANSACTION", label: "Transaksi Duplikat" },
  { value: "TRANSACTION_NEVER_HAPPENED", label: "Transaksi Tidak Pernah Terjadi" },
  { value: "WRONG_PHYSICAL_COUNT", label: "Salah Hitung Fisik" },
  { value: "DAMAGED", label: "Rusak" },
  { value: "SPILLED", label: "Tumpah" },
  { value: "LOST", label: "Hilang" },
  { value: "FOUND", label: "Ditemukan" },
  { value: "DATA_ENTRY_ERROR", label: "Salah Input Data" },
  { value: "SYSTEM_ERROR", label: "Error Sistem" },
  { value: "OTHER", label: "Lainnya" },
]

export interface StockOpnameItem {
  id: string
  productId: string
  productName: string
  expectedQty: number
  actualQty: number
  discrepancyQty: number
}

export interface StockOpname {
  id: string
  opnameNo: string
  locationType: "WAREHOUSE" | "BOOTH"
  boothId: string | null
  booth: { id: string; name: string } | null
  status: "DRAFT" | "CONFIRMED" | "SUPERSEDED"
  versionNo: number
  snapshotAt: string
  confirmedAt: string | null
  countedBy: { id: string; fullName: string }
  note: string | null
  items: StockOpnameItem[]
}

export interface ReconciliationCaseRecord {
  id: string
  caseNo: string
  sourceEntityType: string
  sourceEntityId: string
  status: "OPEN" | "RESOLVED" | "IGNORED"
  severity: "INFO" | "WARNING" | "CRITICAL"
  reasonCode: ReasonCode
  details: Record<string, unknown>
  resolvedBy: { id: string; fullName: string } | null
  resolutionNote: string | null
  createdAt: string
}

export interface TransactionCorrectionRecord {
  id: string
  entityType: string
  entityId: string
  transactionGroupId: string
  correctionType: "VOID" | "REVISION" | "RECOUNT" | "ADJUSTMENT" | "PAYMENT_CORRECTION"
  originalVersionId: string | null
  replacementVersionId: string | null
  reasonCode: ReasonCode
  reasonNote: string | null
  impactSnapshot: Record<string, unknown>
  createdBy: { id: string; fullName: string }
  createdAt: string
  entityLabel: string | null
}

export interface StockAdjustmentRecord {
  id: string
  entityId: string
  correctionType: "ADJUSTMENT" | "VOID"
  reasonCode: ReasonCode
  reasonNote: string | null
  impactSnapshot: {
    locationType: "WAREHOUSE" | "BOOTH"
    boothId: string | null
    productId: string
    before: number
    after: number
    delta: number
  }
  createdBy: { id: string; fullName: string }
  createdAt: string
}

async function fetchCsvBlob(path: string): Promise<Blob> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!res.ok) {
    throw new ApiError("EXPORT_FAILED", `Gagal mengunduh laporan (${res.status}).`)
  }
  return res.blob()
}

export const api = {
  login: (username: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: { username, password } }),

  getBooths: () => request<Booth[]>("/booths"),
  createBooth: (input: { code: string; name: string; locationName?: string }) =>
    request<Booth>("/booths", { method: "POST", body: input }),

  getProducts: () => request<Product[]>("/products"),
  getProductCategories: () => request<ProductCategory[]>("/products/categories"),
  createProductCategory: (input: { name: string }) =>
    request<ProductCategory>("/products/categories", { method: "POST", body: input }),
  getCompanyProfile: () => request<CompanyProfile>("/company-profile"),
  updateCompanyProfile: (input: { name: string; legalName?: string; address?: string; phone?: string; logoUrl?: string }) =>
    request<CompanyProfile>("/company-profile", { method: "PATCH", body: input }),
  uploadCompanyLogo: async (file: File) => {
    const token = getToken()
    const body = new FormData()
    body.append("file", file)
    const res = await fetch(`${BASE_URL}/company-profile/upload-logo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    })
    const data = await res.json()
    if (!res.ok) {
      const message = Array.isArray(data?.message) ? data.message.join(", ") : String(data?.message ?? "Gagal mengunggah logo.")
      throw new ApiError(data?.code ?? "UPLOAD_FAILED", message, data?.details)
    }
    return data as { logoUrl: string }
  },

  uploadProductImage: async (file: File) => {
    const token = getToken()
    const body = new FormData()
    body.append("file", file)
    const res = await fetch(`${BASE_URL}/products/upload-image`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    })
    const data = await res.json()
    if (!res.ok) {
      const message = Array.isArray(data?.message) ? data.message.join(", ") : String(data?.message ?? "Gagal mengunggah foto produk.")
      throw new ApiError(data?.code ?? "UPLOAD_FAILED", message, data?.details)
    }
    return data as { imageUrl: string }
  },
  /// `sku` opsional — backend membuatkannya otomatis (`OBL-0001`). Dikirim
  /// hanya oleh jalur seed/impor data lama, tidak oleh form.
  createProduct: (input: { sku?: string; name: string; categoryId?: string; sellPrice: number; imageUrl?: string }) =>
    request<Product>("/products", { method: "POST", body: input }),
  updateProduct: (
    id: string,
    input: {
      name?: string
      categoryId?: string
      sellPrice?: number
      active?: boolean
      imageUrl?: string | null
      minimumQty?: number
      criticalQty?: number
    },
  ) => request<Product>(`/products/${id}`, { method: "PATCH", body: input }),
  /// Ditolak (ApiError code PRODUCT_HAS_HISTORY / PRODUCT_HAS_STOCK) kalau
  /// produk pernah tersentuh transaksi atau masih ada sisa stok — pesan dari
  /// backend sudah menjelaskan alasannya, tampilkan apa adanya lewat toast.
  deleteProduct: (id: string) => request<{ id: string; deleted: boolean }>(`/products/${id}`, { method: "DELETE" }),

  getUsers: () => request<UserAccount[]>("/users"),
  createUser: (input: {
    username: string
    password: string
    fullName: string
    role: "BOOTH_STAFF" | "ADMIN" | "OWNER"
    defaultBoothId?: string
  }) => request<UserAccount>("/users", { method: "POST", body: input }),
  resetUserPassword: (id: string, newPassword: string) =>
    request<UserAccount>(`/users/${id}/reset-password`, { method: "POST", body: { newPassword } }),

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
  cancelDistribution: (id: string, input: { idempotencyKey: string; reasonCode: ReasonCode; reasonNote?: string }) =>
    request<Distribution>(`/distributions/${id}/cancel`, { method: "POST", body: input }),
  reviseDistribution: (
    id: string,
    input: { idempotencyKey: string; items: { productId: string; qty: number }[]; reasonCode: ReasonCode; reasonNote?: string },
  ) => request<Distribution>(`/distributions/${id}/revise`, { method: "POST", body: input }),
  correctDistributionReceipt: (
    id: string,
    input: { idempotencyKey: string; items: { productId: string; qty: number }[]; reasonCode: ReasonCode; reasonNote?: string },
  ) => request<Distribution>(`/distributions/${id}/correct-receipt`, { method: "POST", body: input }),

  getRestockRequests: () => request<RestockRequest[]>("/restock-requests"),
  approveRestockRequest: (id: string, items: { productId: string; qtyApproved: number }[]) =>
    request<RestockRequest>(`/restock-requests/${id}/approve`, { method: "POST", body: { items } }),
  rejectRestockRequest: (id: string, reason: string) =>
    request<RestockRequest>(`/restock-requests/${id}/reject`, { method: "POST", body: { reason } }),

  getReturns: () => request<StockReturn[]>("/returns"),
  receiveReturn: (id: string, items: { productId: string; qtyReceived: number }[]) =>
    request<StockReturn>(`/returns/${id}/receive`, { method: "POST", body: { items } }),
  cancelReturn: (id: string, input: { idempotencyKey: string; reasonCode: ReasonCode; reasonNote?: string }) =>
    request<StockReturn>(`/returns/${id}/cancel`, { method: "POST", body: input }),
  reviseReturn: (
    id: string,
    input: { idempotencyKey: string; items: { productId: string; qty: number }[]; reasonCode: ReasonCode; reasonNote?: string },
  ) => request<StockReturn>(`/returns/${id}/revise`, { method: "POST", body: input }),
  correctReturnReceipt: (
    id: string,
    input: { idempotencyKey: string; items: { productId: string; qty: number }[]; reasonCode: ReasonCode; reasonNote?: string },
  ) => request<StockReturn>(`/returns/${id}/correct-receipt`, { method: "POST", body: input }),

  getAdminDashboard: () => request<AdminDashboard>("/dashboard/admin"),
  getReportsSummary: () => request<ReportsSummary>("/reports/summary"),
  exportReportsCsv: () => fetchCsvBlob("/reports/export"),
  getBoothStock: () => request<BoothStockRow[]>("/booth-stock"),
  getSales: () => request<SaleListItem[]>("/sales"),
  getSaleDetail: (id: string) => request<SaleDetail>(`/sales/${id}`),
  previewVoidSale: (id: string) => request<SaleCorrectionImpact>(`/sales/${id}/preview-void`, { method: "POST" }),
  voidSale: (id: string, input: { idempotencyKey: string; reasonCode: ReasonCode; reasonNote?: string }) =>
    request(`/sales/${id}/void`, { method: "POST", body: input }),
  previewReviseSale: (id: string, input: { items: { productId: string; qty: number }[]; paymentMethod?: "CASH" | "QRIS" }) =>
    request<SaleCorrectionImpact>(`/sales/${id}/preview-revise`, { method: "POST", body: input }),
  reviseSale: (
    id: string,
    input: {
      idempotencyKey: string
      items: { productId: string; qty: number }[]
      paymentMethod?: "CASH" | "QRIS"
      reasonCode: ReasonCode
      reasonNote?: string
    },
  ) => request(`/sales/${id}/revise`, { method: "POST", body: input }),
  revisePaymentMethod: (id: string, input: { idempotencyKey: string; method: "CASH" | "QRIS"; reasonCode: ReasonCode; reasonNote?: string }) =>
    request(`/sales/${id}/revise-payment`, { method: "POST", body: input }),
  getSaleRefunds: (id: string) => request<SaleRefund[]>(`/sales/${id}/refunds`),
  createSaleRefund: (
    id: string,
    input: {
      idempotencyKey: string
      items: { productId: string; qty: number; stockReturned?: boolean }[]
      condition: "REFUND_NO_STOCK_RETURN" | "REFUND_WITH_STOCK_RETURN" | "PARTIAL_REFUND"
      reasonCode: ReasonCode
      reasonNote?: string
    },
  ) => request<SaleRefund>(`/sales/${id}/refund`, { method: "POST", body: input }),

  getShiftTemplates: () => request<ShiftTemplate[]>("/shift-templates"),
  createShiftTemplate: (input: { name: string; startTime: string; endTime: string }) =>
    request<ShiftTemplate>("/shift-templates", { method: "POST", body: input }),

  getBoothStockThresholds: (boothId: string) =>
    request<BoothStockThreshold[]>(`/booth-stock-thresholds?boothId=${boothId}`),
  bulkUpsertBoothStockThresholds: (
    boothId: string,
    items: { productId: string; minimumQty: number; criticalQty: number }[],
  ) =>
    request<BoothStockThreshold[]>("/booth-stock-thresholds/bulk", {
      method: "POST",
      body: { boothId, items },
    }),

  getStockOpnames: () => request<StockOpname[]>("/stock-opname"),
  getStockOpname: (id: string) => request<StockOpname>(`/stock-opname/${id}`),
  startStockOpname: (input: { locationType: "WAREHOUSE" | "BOOTH"; boothId?: string }) =>
    request<StockOpname>("/stock-opname", { method: "POST", body: input }),
  confirmStockOpname: (
    id: string,
    input: { idempotencyKey: string; items: { productId: string; actualQty: number }[]; reasonCode: ReasonCode; reasonNote?: string },
  ) => request<StockOpname>(`/stock-opname/${id}/confirm`, { method: "POST", body: input }),
  recountStockOpname: (
    id: string,
    input: { idempotencyKey: string; items: { productId: string; actualQty: number }[]; reasonCode: ReasonCode; reasonNote?: string },
  ) => request<StockOpname>(`/stock-opname/${id}/recount`, { method: "POST", body: input }),

  getStockAdjustments: () => request<StockAdjustmentRecord[]>("/stock-adjustments"),
  createStockAdjustment: (input: {
    idempotencyKey: string
    locationType: "WAREHOUSE" | "BOOTH"
    boothId?: string
    productId: string
    targetQty: number
    reasonCode: ReasonCode
    reasonNote?: string
  }) => request<StockAdjustmentRecord>("/stock-adjustments", { method: "POST", body: input }),
  reverseStockAdjustment: (id: string, input: { idempotencyKey: string; reasonCode: ReasonCode; reasonNote?: string }) =>
    request<StockAdjustmentRecord>(`/stock-adjustments/${id}/reverse`, { method: "POST", body: input }),

  getTransactionCorrections: () => request<TransactionCorrectionRecord[]>("/transaction-corrections"),

  getNotifications: () =>
    request<{ id: string; title: string; message: string; type: "info" | "success" | "warning" | "error"; readAt: string | null; createdAt: string }[]>(
      "/notifications",
    ),

  getStockRingkas: (params: { bulan: number; tahun: number }) =>
    request<RingkasStokResponse>(`/stock-movements/ringkas?bulan=${params.bulan}&tahun=${params.tahun}`),

  getStockReceipts: () => request<StockReceipt[]>("/stock-receipts"),
  getStockReceipt: (id: string) => request<StockReceipt>(`/stock-receipts/${id}`),
  createStockReceipt: (input: {
    idempotencyKey: string
    receiptDate: string
    note?: string
    status?: "DRAFT" | "POSTED"
    items: { productId: string; qtyReceived: number }[]
  }) => request<StockReceipt>("/stock-receipts", { method: "POST", body: input }),
  updateStockReceipt: (
    id: string,
    input: { receiptDate?: string; note?: string; items?: { productId: string; qtyReceived: number }[] },
  ) => request<StockReceipt>(`/stock-receipts/${id}`, { method: "PATCH", body: input }),
  postStockReceipt: (id: string) => request<StockReceipt>(`/stock-receipts/${id}/post`, { method: "PATCH" }),
  reviseStockReceipt: (id: string) => request<StockReceipt>(`/stock-receipts/${id}/revise`, { method: "POST" }),

  getStockReceiptReport: async (format: "pdf" | "excel", filter: FilterLaporanPenerimaan = {}) => {
    const params = new URLSearchParams()
    if (filter.q) params.set("q", filter.q)
    if (filter.status) params.set("status", filter.status)
    const qs = params.toString()

    const res = await fetch(`${BASE_URL}/reports/stock-receipts/${format}${qs ? `?${qs}` : ""}`, {
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    })
    if (!res.ok) {
      throw new ApiError("REPORT_FAILED", "Gagal membuat laporan. Coba lagi sebentar lagi.")
    }
    return res.blob()
  },

  getStockReceiptNotaPdf: async (id: string) => {
    const res = await fetch(`${BASE_URL}/reports/stock-receipts/${id}/pdf`, {
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    })
    if (!res.ok) {
      throw new ApiError("REPORT_FAILED", "Gagal membuat nota. Coba lagi sebentar lagi.")
    }
    return res.blob()
  },

  /// Laporan diambil sebagai Blob lewat fetch ber-Authorization, BUKAN <a href>
  /// langsung ke backend: token Obbel ada di localStorage, bukan cookie, jadi
  /// navigasi biasa tidak membawa kredensialnya dan selalu kena 401.
  getProductReport: async (format: "pdf" | "excel", filter: FilterLaporanProduk = {}) => {
    const params = new URLSearchParams()
    if (filter.q) params.set("q", filter.q)
    if (filter.kategoriId) params.set("kategoriId", filter.kategoriId)
    if (filter.status) params.set("status", filter.status)
    const qs = params.toString()

    const res = await fetch(`${BASE_URL}/reports/products/${format}${qs ? `?${qs}` : ""}`, {
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    })
    if (!res.ok) {
      throw new ApiError("REPORT_FAILED", "Gagal membuat laporan. Coba lagi sebentar lagi.")
    }
    return res.blob()
  },

  getStockRekap: (params: { bulan: number; tahun: number; lokasi?: string }) =>
    request<RekapStokResponse>(
      `/stock-movements/rekap?bulan=${params.bulan}&tahun=${params.tahun}&lokasi=${encodeURIComponent(params.lokasi ?? "WAREHOUSE")}`,
    ),
  getStockRinci: (params: { productId: string; bulan: number; tahun: number; lokasi?: string }) =>
    request<RinciMutasiResponse>(
      `/stock-movements/rinci?productId=${params.productId}&bulan=${params.bulan}&tahun=${params.tahun}&lokasi=${encodeURIComponent(params.lokasi ?? "WAREHOUSE")}`,
    ),

  getReconciliationCases: () => request<ReconciliationCaseRecord[]>("/reconciliation-cases"),
  resolveReconciliationCase: (id: string, input: { status: "RESOLVED" | "IGNORED"; resolutionNote?: string }) =>
    request<ReconciliationCaseRecord>(`/reconciliation-cases/${id}/resolve`, { method: "POST", body: input }),
}
