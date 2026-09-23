/// Client HTTP tipis ke Backend API (Node.js/NestJS) — satu backend yang
/// sama dipakai Petugas Booth, Admin Pusat, dan Owner (AGENTS.md).
export const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"

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

const ADMIN_SESSION_STORAGE_KEY = "obbel-admin-session"
const PETUGAS_SESSION_STORAGE_KEY = "obbel-petugas-session"

/// Bentuk response daftar yang dipaginasi di server — dipakai Transaksi
/// Kasir, Tambah Stok Gudang, Serah Terima Stok (lihat percakapan soal
/// performa: ketiganya dulu ambil SEMUA baris sekaligus tanpa batas).
export interface Paginated<T> {
  rows: T[]
  total: number
  page: number
  limit: number
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value))
  }
  const s = qs.toString()
  return s ? `?${s}` : ""
}

/// Admin dan Web Petugas Booth (/petugas/*) SENGAJA punya slot sesi
/// localStorage terpisah (lihat auth-context.tsx `areaKeyFor`) — supaya dua
/// role bisa login bersamaan di browser yang sama tanpa saling menimpa.
/// `getToken()` di sini dipakai LANGSUNG oleh `request()` (bukan lewat
/// context React), jadi harus ikut logika area yang sama berdasarkan
/// halaman yang sedang dibuka.
function currentSessionStorageKey(): string {
  if (typeof window === "undefined") return ADMIN_SESSION_STORAGE_KEY
  return window.location.pathname.startsWith("/petugas") ? PETUGAS_SESSION_STORAGE_KEY : ADMIN_SESSION_STORAGE_KEY
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(currentSessionStorageKey())
    if (!raw) return null
    return (JSON.parse(raw) as { token?: string }).token ?? null
  } catch {
    return null
  }
}

/// Token expired/invalid di tengah pemakaian (bukan salah username/password
/// saat login) — bersihkan sesi lalu paksa balik ke /login supaya user tidak
/// terjebak di halaman yang terus menampilkan toast "Unauthorized". Satu
/// halaman biasanya memanggil beberapa API sekaligus, jadi beberapa 401 bisa
/// datang bersamaan — flag ini mencegah redirect/reload terpicu berkali-kali
/// (itu yang bikin layar login berkedip lalu putih blank).
let reauthInFlight = false

function forceReauth() {
  if (typeof window === "undefined" || reauthInFlight) return
  // Web Petugas Booth (app/petugas/) punya halaman login sendiri, beda dari
  // /login admin — redirect 401 harus balik ke shell yang sedang dipakai,
  // bukan selalu ke login Admin.
  const isPetugas = window.location.pathname.startsWith("/petugas")
  const loginPath = isPetugas ? "/petugas/login" : "/login"
  if (window.location.pathname === loginPath) return
  reauthInFlight = true
  localStorage.removeItem(currentSessionStorageKey())
  window.location.href = loginPath
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
    // Dicek via `name` saja (bukan `instanceof DOMException`) — runtime fetch
    // Next.js dev (undici) kadang melempar AbortError sebagai Error biasa,
    // bukan DOMException, kalau instanceof-nya kelewat malah lolos jadi
    // overlay Runtime Error merah alih-alih toast ini.
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("TIMEOUT", "Koneksi ke server timeout. Periksa jaringan Anda lalu coba lagi.")
    }
    throw new ApiError("NETWORK_ERROR", "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.")
  } finally {
    clearTimeout(timeoutId)
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") {
      forceReauth()
    }
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
  address: string | null
  latitude: number | null
  longitude: number | null
  /// Kode QRIS statis Booth ini, ditampilkan di layar Kasir Petugas saat
  /// metode QRIS/Split dipilih. Diunggah Admin di Data Booth.
  qrisImageUrl: string | null
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

/// Tab "Sebaran Stok" (halaman Produk) — satu baris per produk, kolom Gudang +
/// In Proses + tiap Booth, per tanggal (bukan rentang bulan).
export interface BarisSebaranStokBooth {
  boothId: string;
  boothName: string;
  qty: number;
  /// Status warna BR-007 (Aman/Menipis/Kritis/Habis) dari ambang minimumQty/
  /// criticalQty (override per Booth kalau ada, fallback ke default produk).
  status: "Aman" | "Menipis" | "Kritis" | "Habis";
  /// true kalau Booth ini PERNAH menerima distribusi produk ini (sampai
  /// tanggal yang dipilih) — dipakai membedakan qty 0 karena memang belum
  /// pernah diserahterimakan (abu-abu, bukan masalah) vs qty 0 karena sempat
  /// ada tapi sekarang habis (merah, Kritis/Habis sungguhan).
  pernahDikirim: boolean;
}

export interface BarisSebaranStok {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  gudang: number;
  inProses: number;
  perBooth: BarisSebaranStokBooth[];
  total: number;
}

export interface SebaranStokResponse {
  tanggal: string;
  booths: { boothId: string; boothName: string }[];
  rows: BarisSebaranStok[];
}

/// Tab "Sebaran Penjualan" (menu Transaksi Kasir) — satu baris per produk,
/// kolom tiap Booth + Total, per tanggal bisnis (Asia/Jakarta). Angkanya qty
/// cup terjual (status PAID), pola sama dengan BarisSebaranStok tapi tanpa
/// Gudang/In Proses (tidak relevan di penjualan).
export interface BarisSebaranPenjualan {
  productId: string;
  sku: string;
  name: string;
  category: string | null;
  perBooth: { boothId: string; boothName: string; qty: number; omzet: number }[];
  totalQty: number;
  totalOmzet: number;
}

export interface SebaranPenjualanResponse {
  dari: string;
  sampai: string;
  booths: { boothId: string; boothName: string; locationName: string | null }[];
  rows: BarisSebaranPenjualan[];
  /// Baris footer "Total Qty" + "Total Jual" (Rp) per kolom Booth, dihitung
  /// dari SEMUA produk (bukan cuma yang lolos filter pencarian di layar).
  totalPerBooth: { boothId: string; boothName: string; qty: number; omzet: number }[];
  grandTotalQty: number;
  grandTotalOmzet: number;
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
  /// Nama Petugas yang menginput baris ini. Null kalau profile-nya sudah
  /// tidak ada.
  petugas: string | null
  /// Label shift (mis. "Pagi"/"Malam") saat baris ini terjadi. Null kalau
  /// movement-nya tidak terikat satu shift (mis. mutasi di Gudang, atau
  /// movement lama sebelum shift ikut dicatat).
  shift: string | null
}

export interface RinciMutasiResponse {
  product: { id: string; sku: string; name: string }
  periode: { bulan: number; tahun: number }
  lokasi: string
  ringkasan: { saldoAwal: number; masuk: number; keluar: number; saldoAkhir: number }
  rows: BarisRinciMutasi[]
  perluVerifikasi: boolean
}

/// Tab "Mutasi Stok"/"Mutasi Penjualan" di halaman Booth — rekap per Booth
/// (bukan per produk seperti `BarisRekapStok`), dipakai bersama parameter
/// `jenis` ("SEMUA" | "PENJUALAN").
export interface BarisRekapBooth {
  boothId: string
  boothCode: string
  boothName: string
  saldoAwal: number
  masuk: number
  keluar: number
  saldoAkhir: number
  perluVerifikasi: boolean
}

export interface RekapBoothResponse {
  periode: { bulan: number; tahun: number }
  rows: BarisRekapBooth[]
  total: { saldoAwal: number; masuk: number; keluar: number; saldoAkhir: number; perluVerifikasi: boolean }
}

export type JenisMutasi = "SEMUA" | "PENJUALAN"

export interface BarisRiwayatPenjualanBooth {
  id: string
  saleNo: string
  boothId: string
  boothName: string
  staffName: string
  shift: string
  status: "PAID" | "VOIDED"
  total: number
  cupCount: number
  paymentMethod: "CASH" | "QRIS"
  paidAt: string | null
}

export interface RekapHarianShift {
  shift: string
  cup: number
  omzet: number
}

export interface RekapHarianBooth {
  tanggal: string
  cup: number
  omzet: number
  perShift: RekapHarianShift[]
}

export interface RiwayatPenjualanBoothResponse {
  periode: { bulan: number; tahun: number }
  rows: BarisRiwayatPenjualanBooth[]
  rekapHarian: RekapHarianBooth[]
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

export type DiscrepancyReasonCode = "LEBIH" | "KURANG" | "RUSAK" | "LAINNYA"

export interface DistributionItem {
  id: string
  productId: string
  productName: string
  productCategory: string | null
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
  receivedById: string | null
  receivedByName: string | null
  note: string | null
  items: DistributionItem[]
}

/// Serah Terima Stok — 1 transaksi gabungan (RestockRequest + StockDistribution
/// di backend, disatukan di sini). `id` berprefix "req_"/"dist_", dipakai apa
/// adanya di endpoint aksi (approve/reject/receive/cancel/revise/correct).
export type TindakLanjutSelisih = "RUSAK" | "SALAH_HITUNG" | "GANTI_RUGI_PETUGAS" | "LAINNYA"

export interface StockHandoverItem {
  productId: string
  productName: string
  qty: number
  qtyReceived: number | null
  sellPrice?: number
  discrepancyReasonCode?: DiscrepancyReasonCode | null
  discrepancyNote?: string | null
}

export interface StockHandover {
  id: string
  kind: "request" | "distribution"
  docNo: string
  status: "DIAJUKAN" | "DIPROSES" | "DITERIMA" | "DITOLAK" | "DIBATALKAN"
  sumber: "PETUGAS" | "ADMIN"
  jenis: "STOK_AWAL" | "RE_STOK" | null
  boothId: string
  boothName: string
  staffName: string | null
  date: string
  note: string | null
  rejectReason?: string | null
  discrepancy?: boolean
  items: StockHandoverItem[]
}

export interface FilterLaporanSerahTerima {
  q?: string
  status?: StockHandover["status"]
}

export interface FilterLaporanStokRusak {
  dateFrom?: string
  dateTo?: string
  boothId?: string
}

export interface BarisStokRusak {
  distributionId: string
  distributionNo: string
  boothName: string
  staffName: string | null
  productName: string
  qtySent: number
  qtyReceived: number
  qtyRusak: number
  receivedAt: string
  reasonNote: string | null
}

export interface StokRusakData {
  rows: BarisStokRusak[]
  totalQtyRusak: number
  totalKejadian: number
  perProduk: { productName: string; totalQtyRusak: number; kejadian: number }[]
}

/// Stok yang masih Diproses (in-transit) — belum dikonfirmasi diterima
/// Petugas. Satu baris per dokumen/transaksi (bukan per produk).
export interface StockHandoverInTransitProductItem {
  productId: string
  productName: string
  productCategory: string | null
  qty: number
}

export interface StockHandoverInTransitTransaction {
  distributionId: string
  distributionNo: string
  boothId: string
  boothName: string
  staffName: string | null
  sentAt: string | null
  totalQty: number
  items: StockHandoverInTransitProductItem[]
}

/// Petugas yang sedang Aktif (sudah Check-In) — dipakai picker "Petugas" di
/// Serah Terima Stok; Booth ikut otomatis, tidak dipilih manual.
export interface ActiveAssignment {
  shiftSessionId: string
  staffId: string
  staffName: string
  boothId: string
  boothName: string
  openedAt: string | null
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
  /// Dokumen ASAL kalau ini adalah dokumen revisi ("revisi dari TRM-000001").
  revisionOf: { id: string; receiptNo: string; versionNo: number } | null
  /// Dokumen revisi terbaru kalau dokumen ini SUDAH direvisi ("digantikan
  /// oleh TRM-000002").
  revisedBy: { id: string; receiptNo: string; versionNo: number } | null
}

export interface ActivityLogEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  actorId: string
  actorName: string
  note: string | null
  occurredAt: string
}

export interface NotificationItem {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  readAt: string | null
  createdAt: string
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

/// Panel filter periode Dashboard (Hari Ini/Minggu Ini/Bulan Ini/Custom) —
/// 3 tabel: penjualan per Booth, produk terlaris, penjualan per Petugas.
export interface SalesReportByProduct {
  productId: string
  productName: string
  cupSold: number
}

export interface SalesReportByBooth {
  boothId: string
  boothName: string
  cupSold: number
  omzet: number
}

export interface SalesReportByStaffShift {
  staffId: string
  staffName: string
  boothId: string
  boothName: string
  tanggal: string
  shift: string
  cupSold: number
  omzet: number
}

export interface SalesReport {
  byProduct: SalesReportByProduct[]
  byBooth: SalesReportByBooth[]
  byStaffShift: SalesReportByStaffShift[]
}

/// "Petugas mana yang sering kehabisan/menipis tapi tidak minta Restock" —
/// lihat dashboard.service.ts getStockNeglectReport untuk definisi parameter
/// (insiden signifikan >= 4 jam, tanpa RestockRequest selama insiden).
export interface StockNeglectRow {
  staffId: string
  staffName: string
  boothId: string
  boothName: string
  jumlahInsiden: number
  totalJamDiam: number
  produk: string[]
}

export interface BoothAktifCard {
  boothId: string
  boothCode: string
  boothName: string
  locationName: string | null
  latitude: number | null
  longitude: number | null
  isActive: boolean
  staffName: string | null
  shiftLabel: string | null
  shiftStartAt: string | null
  cupSoldToday: number
  cupSoldYesterday: number
  omzetToday: number
  stockQty: number
  stockStatus: "Aman" | "Menipis" | "Kritis" | "Habis"
  pendingDistribution: { distributionNo: string; sentAt: string | null; count: number } | null
  topStock: { productName: string; qty: number }[]
}

export interface BoothStockRow {
  boothId: string
  boothName: string
  productId: string
  productName: string
  productImageUrl: string | null
  categoryName: string | null
  qtyOnHand: number
  minimumQty: number
  status: "Aman" | "Menipis" | "Kritis" | "Habis"
}

export type SalePaymentMethod = "CASH" | "QRIS" | "SPLIT"

export interface FilterLaporanKasir {
  q?: string
  status?: "PENDING" | "PAID" | "VOIDED"
  boothName?: string
  staffName?: string
  periodeAwal?: string
}

export interface SaleListItem {
  id: string
  saleNo: string
  boothName: string
  staffName: string
  shiftLabel: string
  status: "PENDING" | "PAID" | "VOIDED"
  total: number
  cupCount: number
  paymentMethod: SalePaymentMethod
  items: { productName: string; qty: number }[]
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
  lineTotal: number
}

export interface SalePaymentRow {
  id: string
  method: SalePaymentMethod
  amount: number
  status: "POSTED" | "REVERSED" | "SUPERSEDED"
  paidAt: string
}

export interface SaleDetail {
  id: string
  saleNo: string
  boothId: string
  boothName: string
  staffName: string
  shiftLabel: string
  status: "PENDING" | "PAID" | "VOIDED"
  subtotal: number
  discount: number
  total: number
  paymentMethod: SalePaymentMethod
  versionNo: number
  revisionOfSaleNo: string | null
  paidAt: string | null
  voidedAt: string | null
  voidReason: string | null
  createdAt: string
  latitude: number | null
  longitude: number | null
  locationCapturedAt: string | null
  payments: SalePaymentRow[]
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

/// Setting Booth-Petugas — Petugas default per Booth × template shift.
/// Bukan jadwal harian (itu ShiftSession); ini cuma pasangan acuan Admin.
export interface BoothShiftAssignment {
  id: string
  boothId: string
  shiftTemplateId: string
  staffId: string | null
  staff: UserAccount | null
  updatedAt: string
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

/* ─── Petugas Booth ────────────────────────────────────────────────────── */

export interface ActiveShift {
  shiftSessionId: string
  booth: { id: string; code: string; name: string }
  shiftName: string
  status: "OPEN" | "CLOSING" | "CLOSED"
  scheduledStartAt: string
  scheduledEndAt: string
  /// Jam Check-In SESUNGGUHNYA (bukan jadwal) — null hanya utk shift yang
  /// belum pernah dibuka (seharusnya tidak terjadi di layar aktif manapun).
  openedAt: string | null
  accessToken?: string
  locationWarning?: string
}

export interface ClosingItem {
  productId: string
  productName: string
  expectedQty: number
  actualQty: number
  discrepancyQty: number
  reasonCode: string | null
}

export interface ClosingResponse {
  id: string
  shiftSessionId: string
  status: "DRAFT" | "CONFIRMED"
  confirmedAt: string | null
  items: ClosingItem[]
  locationWarning?: string
}

export interface ShiftHistoryItem {
  id: string
  businessDate: string
  status: "SCHEDULED" | "OPEN" | "CLOSING" | "CLOSED" | "CANCELLED"
  openedAt: string | null
  closedAt: string | null
  boothName: string
}

export interface ShiftHistoryResponse {
  totalHadir: number
  totalHariKerja: number
  items: ShiftHistoryItem[]
}

export interface ShiftAdminHistoryItem {
  id: string
  businessDate: string
  boothId: string
  boothName: string
  staffId: string
  staffName: string
  status: "SCHEDULED" | "OPEN" | "CLOSING" | "CLOSED" | "CANCELLED"
  openedAt: string | null
  closedAt: string | null
  checkInPhotoUrl: string | null
  checkInLatitude: number | null
  checkInLongitude: number | null
  checkOutPhotoUrl: string | null
  checkOutLatitude: number | null
  checkOutLongitude: number | null
  totalJualCup: number
  adaSelisih: boolean
  returStatus: "SUBMITTED" | "RECEIVED" | "DISCREPANCY" | "CANCELLED" | null
  setoranStatus: "PENDING" | "CONFIRMED" | "DISCREPANCY" | null
}

export interface ShiftReportItem {
  productId: string
  productName: string
  stokAwal: number
  restock: number
  terjual: number
  retur: number
  sisaSistem: number
  stokFisik: number | null
  selisih: number
  reasonCode: string | null
  reasonNote: string | null
}

export interface ShiftReportTransaksi {
  saleId: string
  saleNo: string
  cupCount: number
  total: number
  tunai: number
  qris: number
}

export interface ShiftReportReturItem {
  productId: string
  productName: string
  qtySubmitted: number
  qtyReceived: number | null
}

export interface ShiftReportRetur {
  id: string
  returnNo: string
  status: "SUBMITTED" | "RECEIVED" | "DISCREPANCY" | "CANCELLED"
  note: string | null
  receiveNote: string | null
  submittedAt: string
  receivedAt: string | null
  items: ShiftReportReturItem[]
}

export interface ShiftReportSetoran {
  status: "PENDING" | "CONFIRMED" | "DISCREPANCY"
  expectedAmount: number
  depositedAmount: number | null
  note: string | null
  confirmedAt: string | null
}

export interface ShiftReport {
  boothName: string
  shiftTemplateName: string
  staffName: string
  status: "SCHEDULED" | "OPEN" | "CLOSING" | "CLOSED" | "CANCELLED"
  businessDate: string
  items: ShiftReportItem[]
  transaksi: ShiftReportTransaksi[]
  totalPenjualan: number
  kasTunai: number
  kasQris: number
  catatan: string | null
  retur: ShiftReportRetur | null
  setoran: ShiftReportSetoran | null
}

export interface MyBoothShiftAssignment {
  id: string
  boothId: string
  booth: Booth
  shiftTemplateId: string
  shiftTemplate: ShiftTemplate
  staffId: string | null
  updatedAt: string
}

export interface MyStockMovement {
  id: string
  movementNo: string
  movementType: "OPENING" | "WAREHOUSE_TO_BOOTH" | "SALE" | "RESTOCK" | "RETURN_TO_WAREHOUSE" | "ADJUSTMENT" | "VOID_REVERSAL"
  productId: string
  productName: string
  qty: number
  direction: "IN" | "OUT"
  occurredAt: string
  note: string | null
}

export interface StockLedgerRow {
  id: string
  tanggal: string
  movementNo: string
  jenis: "MASUK" | "KELUAR" | "PENYESUAIAN"
  qty: number
  stokAkhir: number
  keterangan: string
}

export interface StockLedgerResponse {
  product: { id: string; name: string }
  periode: { dari: string; sampai: string }
  ringkasan: { stokAwal: number; masuk: number; keluar: number; stokAkhir: number }
  rows: StockLedgerRow[]
}

export interface PaymentSplitInput {
  method: "CASH" | "QRIS"
  amount: number
}

export interface SaleResult {
  id: string
  saleNo: string
  subtotal: number
  discount: number
  total: number
  paymentMethod: "CASH" | "QRIS" | "SPLIT"
  payments: PaymentSplitInput[]
  paidAt: string | null
}

export interface DraftSaleItem {
  productId: string
  productName: string
  unitPrice: number
  qty: number
}

export interface DraftSale {
  id: string
  saleNo: string
  subtotal: number
  discount: number
  total: number
  createdAt: string
  items: DraftSaleItem[]
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
  createBooth: (input: {
    code: string
    name: string
    locationName?: string
    address?: string
    latitude?: number
    longitude?: number
  }) => request<Booth>("/booths", { method: "POST", body: input }),
  updateBooth: (
    id: string,
    input: {
      name?: string
      locationName?: string
      address?: string
      latitude?: number
      longitude?: number
      status?: "ACTIVE" | "INACTIVE"
      qrisImageUrl?: string
    },
  ) => request<Booth>(`/booths/${id}`, { method: "PATCH", body: input }),
  uploadBoothQris: async (file: File) => {
    const token = getToken()
    const body = new FormData()
    body.append("file", file)
    const res = await fetch(`${BASE_URL}/booths/upload-qris`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    })
    const data = await res.json()
    if (!res.ok) {
      const message = Array.isArray(data?.message) ? data.message.join(", ") : String(data?.message ?? "Gagal mengunggah kode QRIS.")
      throw new ApiError(data?.code ?? "UPLOAD_FAILED", message, data?.details)
    }
    return data as { qrisImageUrl: string }
  },

  getProducts: () => request<Product[]>("/products"),
  /// Ranking terlaris 7 hari terakhir milik booth staff yg login — dihitung
  /// on-the-fly dari ledger stock_movements, tidak ada tabel log terpisah.
  getTerlarisMine: () => request<{ productId: string; qty: number }[]>("/products/terlaris-mine"),
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
  updateUser: (id: string, input: { fullName?: string; defaultBoothId?: string; active?: boolean }) =>
    request<UserAccount>(`/users/${id}`, { method: "PATCH", body: input }),
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

  getStockHandovers: (params?: {
    page?: number
    limit?: number
    search?: string
    status?: StockHandover["status"]
    boothId?: string
  }) => request<Paginated<StockHandover>>(`/stock-handovers${toQueryString(params ?? {})}`),
  getStockHandoverInTransit: () => request<StockHandoverInTransitTransaction[]>("/stock-handovers/in-transit"),
  getStockHandover: (id: string) => request<StockHandover>(`/stock-handovers/${id}`),
  getStockHandoverActivityLog: (id: string) => request<ActivityLogEntry[]>(`/stock-handovers/${id}/activity-log`),
  getActiveAssignments: () => request<ActiveAssignment[]>("/shifts/active-assignments"),
  createStockHandover: (input: { staffId: string; items: { productId: string; qty: number }[]; note?: string }) =>
    request<Distribution>("/stock-handovers", { method: "POST", body: input }),
  approveStockHandover: (id: string, items: { productId: string; qtyApproved: number }[]) =>
    request<RestockRequest>(`/stock-handovers/${id}/approve`, { method: "POST", body: { items } }),
  rejectStockHandover: (id: string, reason: string) =>
    request<RestockRequest>(`/stock-handovers/${id}/reject`, { method: "POST", body: { reason } }),
  receiveStockHandover: (id: string, items: { productId: string; actualQty: number }[]) =>
    request<Distribution>(`/stock-handovers/${id}/receive`, { method: "POST", body: { items } }),
  cancelStockHandover: (id: string, input: { idempotencyKey: string; reasonCode: ReasonCode; reasonNote?: string }) =>
    request<Distribution>(`/stock-handovers/${id}/cancel`, { method: "POST", body: input }),
  reviseStockHandover: (
    id: string,
    input: { idempotencyKey: string; items: { productId: string; qty: number }[]; reasonCode: ReasonCode; reasonNote?: string },
  ) => request<Distribution>(`/stock-handovers/${id}/revise`, { method: "POST", body: input }),
  correctStockHandoverReceipt: (
    id: string,
    input: {
      idempotencyKey: string
      items: { productId: string; qty: number; tindakLanjut?: TindakLanjutSelisih; tindakLanjutNote?: string }[]
      reasonCode: ReasonCode
      reasonNote?: string
    },
  ) => request<Distribution>(`/stock-handovers/${id}/correct-receipt`, { method: "POST", body: input }),

  getStockHandoverReport: async (format: "pdf" | "excel", filter: FilterLaporanSerahTerima = {}) => {
    const params = new URLSearchParams()
    if (filter.q) params.set("q", filter.q)
    if (filter.status) params.set("status", filter.status)
    const qs = params.toString()

    const res = await fetch(`${BASE_URL}/reports/stock-handovers/${format}${qs ? `?${qs}` : ""}`, {
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    })
    if (!res.ok) {
      throw new ApiError("REPORT_FAILED", "Gagal membuat laporan. Coba lagi sebentar lagi.")
    }
    return res.blob()
  },

  getStockDamageReport: (filter: FilterLaporanStokRusak = {}) => {
    const params = new URLSearchParams()
    if (filter.dateFrom) params.set("dateFrom", filter.dateFrom)
    if (filter.dateTo) params.set("dateTo", filter.dateTo)
    if (filter.boothId) params.set("boothId", filter.boothId)
    const qs = params.toString()
    return request<StokRusakData>(`/reports/stock-damage${qs ? `?${qs}` : ""}`)
  },
  getStockDamageReportFile: async (format: "pdf" | "excel", filter: FilterLaporanStokRusak = {}) => {
    const params = new URLSearchParams()
    if (filter.dateFrom) params.set("dateFrom", filter.dateFrom)
    if (filter.dateTo) params.set("dateTo", filter.dateTo)
    if (filter.boothId) params.set("boothId", filter.boothId)
    const qs = params.toString()

    const res = await fetch(`${BASE_URL}/reports/stock-damage/${format}${qs ? `?${qs}` : ""}`, {
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    })
    if (!res.ok) {
      throw new ApiError("REPORT_FAILED", "Gagal membuat laporan. Coba lagi sebentar lagi.")
    }
    return res.blob()
  },

  getStockHandoverNotaPdf: async (id: string) => {
    const res = await fetch(`${BASE_URL}/reports/stock-handovers/${id}/pdf`, {
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    })
    if (!res.ok) {
      throw new ApiError("REPORT_FAILED", "Gagal membuat nota. Coba lagi sebentar lagi.")
    }
    return res.blob()
  },

  getReturns: () => request<StockReturn[]>("/returns"),
  receiveReturn: (id: string, items: { productId: string; qtyReceived: number }[], note?: string) =>
    request<StockReturn>(`/returns/${id}/receive`, { method: "POST", body: { items, note } }),
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
  getSalesReport: (start: string, end: string) =>
    request<SalesReport>(`/dashboard/sales-report?start=${start}&end=${end}`),
  getStockNeglectReport: (start: string, end: string) =>
    request<StockNeglectRow[]>(`/dashboard/stock-neglect-report?start=${start}&end=${end}`),
  getBoothAktif: () => request<BoothAktifCard[]>("/dashboard/booth-aktif"),
  getReportsSummary: () => request<ReportsSummary>("/reports/summary"),
  exportReportsCsv: () => fetchCsvBlob("/reports/export"),
  getBoothStock: (params?: { boothId?: string }) => request<BoothStockRow[]>(`/booth-stock${toQueryString(params ?? {})}`),
  getSales: (params?: {
    page?: number
    limit?: number
    search?: string
    status?: SaleListItem["status"]
    boothId?: string
    staffId?: string
    dari?: string
    sampai?: string
  }) => request<Paginated<SaleListItem>>(`/sales${toQueryString(params ?? {})}`),
  getSaleDetail: (id: string) => request<SaleDetail>(`/sales/${id}`),

  getKasirReport: async (format: "pdf" | "excel", filter: FilterLaporanKasir = {}) => {
    const params = new URLSearchParams()
    if (filter.q) params.set("q", filter.q)
    if (filter.status) params.set("status", filter.status)
    if (filter.boothName) params.set("boothName", filter.boothName)
    if (filter.staffName) params.set("staffName", filter.staffName)
    if (filter.periodeAwal) params.set("periodeAwal", filter.periodeAwal)
    const qs = params.toString()

    const res = await fetch(`${BASE_URL}/reports/sales/${format}${qs ? `?${qs}` : ""}`, {
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    })
    if (!res.ok) {
      throw new ApiError("REPORT_FAILED", "Gagal membuat laporan. Coba lagi sebentar lagi.")
    }
    return res.blob()
  },
  getSaleActivityLog: (id: string) => request<ActivityLogEntry[]>(`/sales/${id}/activity-log`),
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
  updateShiftTemplate: (
    id: string,
    input: { name?: string; startTime?: string; endTime?: string; active?: boolean },
  ) => request<ShiftTemplate>(`/shift-templates/${id}`, { method: "PATCH", body: input }),
  deleteShiftTemplate: (id: string) =>
    request<{ id: string; deleted: boolean }>(`/shift-templates/${id}`, { method: "DELETE" }),

  getBoothShiftAssignments: () => request<BoothShiftAssignment[]>("/booth-shift-assignments"),
  upsertBoothShiftAssignment: (input: { boothId: string; shiftTemplateId: string; staffId: string | null; force?: boolean }) =>
    request<BoothShiftAssignment>("/booth-shift-assignments", { method: "PUT", body: input }),

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

  getNotifications: () => request<NotificationItem[]>("/notifications"),

  getStockRingkas: (params: { bulan: number; tahun: number }) =>
    request<RingkasStokResponse>(`/stock-movements/ringkas?bulan=${params.bulan}&tahun=${params.tahun}`),

  getStockReceipts: (params?: { page?: number; limit?: number; search?: string; status?: StockReceipt["status"] }) =>
    request<Paginated<StockReceipt>>(`/stock-receipts${toQueryString(params ?? {})}`),
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
  /// Cuma berhasil untuk dokumen berstatus Draft — backend menolak selain itu
  /// (lihat StockReceiptsService.remove, AGENTS.md "Posted transactions are
  /// never hard-deleted").
  deleteStockReceipt: (id: string) => request<null>(`/stock-receipts/${id}`, { method: "DELETE" }),
  getStockReceiptActivityLog: (id: string) => request<ActivityLogEntry[]>(`/stock-receipts/${id}/activity-log`),

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

  getSebaranStok: (tanggal: string) =>
    request<SebaranStokResponse>(`/stock-movements/sebaran?tanggal=${encodeURIComponent(tanggal)}`),
  getSebaranPenjualan: (dari: string, sampai: string) =>
    request<SebaranPenjualanResponse>(`/sales/sebaran?dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`),
  getStockRekap: (params: { bulan: number; tahun: number; lokasi?: string; jenis?: JenisMutasi }) =>
    request<RekapStokResponse>(
      `/stock-movements/rekap?bulan=${params.bulan}&tahun=${params.tahun}&lokasi=${encodeURIComponent(params.lokasi ?? "WAREHOUSE")}&jenis=${params.jenis ?? "SEMUA"}`,
    ),
  getStockRinci: (params: { productId: string; bulan: number; tahun: number; lokasi?: string; jenis?: JenisMutasi }) =>
    request<RinciMutasiResponse>(
      `/stock-movements/rinci?productId=${params.productId}&bulan=${params.bulan}&tahun=${params.tahun}&lokasi=${encodeURIComponent(params.lokasi ?? "WAREHOUSE")}&jenis=${params.jenis ?? "SEMUA"}`,
    ),
  /// Tab Mutasi Stok/Mutasi Penjualan di halaman Booth — satu baris per
  /// Booth (bukan per produk), lihat StockMovementsService.rekapPerBooth.
  getStockRekapBooth: (params: { bulan: number; tahun: number; jenis?: JenisMutasi }) =>
    request<RekapBoothResponse>(
      `/stock-movements/rekap-booth?bulan=${params.bulan}&tahun=${params.tahun}&jenis=${params.jenis ?? "SEMUA"}`,
    ),
  /// Tab Riwayat Penjualan di halaman Booth — daftar transaksi sebulan +
  /// Rekap Harian per shift. `boothId` opsional: kosong berarti semua Booth.
  getRiwayatPenjualanBooth: (params: { boothId?: string; bulan: number; tahun: number }) =>
    request<RiwayatPenjualanBoothResponse>(
      `/sales/riwayat-booth?bulan=${params.bulan}&tahun=${params.tahun}${params.boothId ? `&boothId=${params.boothId}` : ""}`,
    ),

  getReconciliationCases: () => request<ReconciliationCaseRecord[]>("/reconciliation-cases"),
  resolveReconciliationCase: (id: string, input: { status: "RESOLVED" | "IGNORED"; resolutionNote?: string }) =>
    request<ReconciliationCaseRecord>(`/reconciliation-cases/${id}/resolve`, { method: "POST", body: input }),

  /* ─── Petugas Booth ──────────────────────────────────────────────────── */

  getMyAssignment: () => request<MyBoothShiftAssignment | null>("/booth-shift-assignments/mine"),
  getActiveShift: () => request<ActiveShift>("/shifts/active"),
  checkIn: (input: { boothId?: string; latitude: number; longitude: number; photoUrl: string }) =>
    request<ActiveShift>("/shifts/check-in", { method: "POST", body: input }),
  uploadAttendancePhoto: async (file: File) => {
    const token = getToken()
    const body = new FormData()
    body.append("file", file)
    const res = await fetch(`${BASE_URL}/shifts/attendance/photo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    })
    const data = await res.json()
    if (!res.ok) {
      const message = Array.isArray(data?.message) ? data.message.join(", ") : String(data?.message ?? "Gagal mengunggah foto.")
      throw new ApiError(data?.code ?? "UPLOAD_FAILED", message, data?.details)
    }
    return data as { photoUrl: string }
  },
  startClosing: (shiftSessionId: string) =>
    request<ClosingResponse>(`/shifts/${shiftSessionId}/closing/start`, { method: "POST" }),
  confirmClosing: (
    shiftSessionId: string,
    input: {
      items: { productId: string; actualQty: number; reasonCode?: string; reasonNote?: string }[]
      checkOutLatitude: number
      checkOutLongitude: number
      checkOutPhotoUrl: string
    },
  ) => request<ClosingResponse>(`/shifts/${shiftSessionId}/closing/confirm`, { method: "POST", body: input }),
  getShiftHistory: (month?: string) =>
    request<ShiftHistoryResponse>(`/shifts/history${month ? `?month=${month}` : ""}`),
  getShiftAdminHistory: () => request<ShiftAdminHistoryItem[]>("/shifts/admin-history"),
  getShiftReport: (shiftSessionId: string) => request<ShiftReport>(`/shifts/${shiftSessionId}/report`),
  confirmCashDeposit: (shiftSessionId: string, input: { depositedAmount: number; note?: string }) =>
    request<{ status: "PENDING" | "CONFIRMED" | "DISCREPANCY" }>(`/shifts/${shiftSessionId}/cash-deposit/confirm`, {
      method: "POST",
      body: input,
    }),

  getPendingDistributions: () => request<Distribution[]>("/distributions/pending"),
  getMyDistributions: () => request<Distribution[]>("/distributions/mine"),
  receiveDistribution: (
    id: string,
    items: { productId: string; actualQty: number; reasonCode?: DiscrepancyReasonCode; reasonNote?: string }[],
    note?: string,
  ) => request<Distribution>(`/distributions/${id}/receive`, { method: "POST", body: { items, note } }),

  /// Salah satu WAJIB diisi: `paymentMethod` (satu metode) atau `payments`
  /// (Split, >=2 baris, jumlahnya harus PAS sama dengan total setelah diskon).
  createSale: (input: {
    idempotencyKey: string
    shiftSessionId: string
    paymentMethod?: "CASH" | "QRIS"
    payments?: PaymentSplitInput[]
    discount?: number
    items: { productId: string; qty: number }[]
  }) => request<SaleResult>("/sales", { method: "POST", body: input }),

  /// "Simpan Draft" — stok BELUM dipotong, baru dipotong saat `payDraftSale`.
  createDraftSale: (input: {
    idempotencyKey: string
    shiftSessionId: string
    items: { productId: string; qty: number }[]
    discount?: number
  }) => request<DraftSale>("/sales/draft", { method: "POST", body: input }),
  getMyDrafts: () => request<DraftSale[]>("/sales/drafts"),
  payDraftSale: (
    saleId: string,
    input: { paymentMethod?: "CASH" | "QRIS"; payments?: PaymentSplitInput[] },
  ) => request<SaleResult>(`/sales/${saleId}/pay`, { method: "POST", body: input }),
  deleteDraftSale: (saleId: string) => request<{ id: string; deleted: boolean }>(`/sales/${saleId}/draft`, { method: "DELETE" }),

  createRestockRequest: (input: { items: { productId: string; qty: number }[]; note?: string }) =>
    request<RestockRequest>("/restock-requests", { method: "POST", body: input }),
  getMyRestockRequests: () => request<RestockRequest[]>("/restock-requests/mine"),

  getMyBoothStock: () => request<BoothStockRow[]>("/booth-stock/mine"),
  getMyStockMovements: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams()
    if (params?.from) qs.set("from", params.from)
    if (params?.to) qs.set("to", params.to)
    const suffix = qs.toString()
    return request<MyStockMovement[]>(`/stock-movements/mine${suffix ? `?${suffix}` : ""}`)
  },
  /// Ledger satu produk + saldo berjalan, dikunci ke Booth staff yg login —
  /// dipakai tab "Riwayat Stok".
  getMyStockLedger: (params: { productId: string; from: string; to: string }) =>
    request<StockLedgerResponse>(
      `/stock-movements/rinci-mine?productId=${params.productId}&from=${params.from}&to=${params.to}`,
    ),

  getMyProfile: () => request<UserAccount>("/users/me"),
  updateMyProfile: (input: { fullName?: string }) => request<UserAccount>("/users/me", { method: "PATCH", body: input }),
}
