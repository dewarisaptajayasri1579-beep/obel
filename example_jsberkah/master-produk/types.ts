import type { Produk } from "./ProdukPanel"

/** Bentuk data produk apa adanya dari backend NestJS (`GET /produk`) — dipakai bersama oleh
 *  halaman daftar, halaman edit, halaman print, dan ekspor Excel supaya kolom nullable-nya
 *  ditangani dengan cara yang sama di semua tempat. */
export interface ProductDto {
  id: string
  code: string
  name: string
  businessTypeId: string
  category: string | null
  variant: string | null
  size: string | null
  unit: string
  sellPrice: number
  costPrice: number
  supplierId: string | null
  consignmentPrice: number | null
  minStock: number | null
  photoUrl: string | null
  isActive: boolean
}

export interface BusinessTypeDto {
  id: string
  name: string
}

export interface SupplierDto {
  id: string
  name: string
  isActive: boolean
}

/** Satu lokasi dibaca seperti buku besar: Saldo Awal + Debet − Kredit = Saldo Akhir.
 *  `saldoAkhir` adalah saldo SEPANJANG MASA (stok yang benar-benar ada sekarang); yang dibatasi
 *  periode cuma debet & kreditnya. */
export interface SaldoStok {
  saldoAwal: number
  debet: number
  kredit: number
  saldoAkhir: number
}

/** Ringkasan stok per produk dari `GET /stock/produk/ringkas` — produk yang belum pernah punya
 *  mutasi sama sekali TIDAK muncul di daftar ini (bukan berarti error; artinya nol). */
export interface StokProdukDto {
  productId: string
  gudang: SaldoStok
  sales: SaldoStok
  toko: SaldoStok
  gudangTotal: number
  salesTotal: number
  tokoTotal: number
  total: number
}

export interface RingkasStokResponse {
  period: { from: string; to: string }
  rows: StokProdukDto[]
}

const SALDO_NOL: SaldoStok = { saldoAwal: 0, debet: 0, kredit: 0, saldoAkhir: 0 }

export const keBarisProduk = (p: ProductDto, stok?: StokProdukDto): Produk => ({
  id: p.id,
  code: p.code,
  name: p.name,
  businessTypeId: p.businessTypeId,
  category: p.category ?? "",
  variant: p.variant ?? "",
  size: p.size ?? "",
  unit: p.unit,
  sellPrice: p.sellPrice,
  costPrice: p.costPrice,
  supplierId: p.supplierId ?? "",
  consignmentPrice: p.consignmentPrice,
  minStock: p.minStock,
  photoUrl: p.photoUrl ?? "",
  isActive: p.isActive,
  stokGudang: stok?.gudangTotal ?? 0,
  stokSales: stok?.salesTotal ?? 0,
  stokToko: stok?.tokoTotal ?? 0,
  stokTotal: stok?.total ?? 0,
  saldoGudang: stok?.gudang ?? SALDO_NOL,
  saldoSales: stok?.sales ?? SALDO_NOL,
  saldoToko: stok?.toko ?? SALDO_NOL,
})
