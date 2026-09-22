import type { ProductDto } from "./types"

/** Nilai form produk beserta pembentuknya, SENGAJA dipisah dari `ProdukForm.tsx`.
 *
 *  `ProdukForm.tsx` bertanda `"use client"`, dan fungsi yang diekspor dari berkas client tidak
 *  bisa dipanggil dari server component — yang bisa cuma dirender sebagai komponen atau dioper
 *  sebagai props. Halaman `/baru` dan `/[id]/edit` adalah server component dan perlu menyusun
 *  nilai awalnya di server, jadi pembentuknya harus tinggal di modul netral seperti ini. */

const NONE = "__none__"

export const TANPA_SUPPLIER = NONE

export interface ProdukFormValues {
  id?: string
  code: string
  name: string
  businessTypeId: string
  category: string
  variant: string
  size: string
  unit: string
  sellPrice: number
  costPrice: number
  supplierId: string
  consignmentPrice: number
  minStock: number
  /** URL foto produk; kosong = belum ada foto. Yang disimpan alamatnya, bukan berkasnya. */
  photoUrl: string
  isActive: boolean
}

export const nilaiAwalProduk = (businessTypeId: string): ProdukFormValues => ({
  code: "",
  name: "",
  businessTypeId,
  category: "",
  variant: "",
  size: "",
  unit: "pcs",
  sellPrice: 0,
  costPrice: 0,
  supplierId: NONE,
  consignmentPrice: 0,
  minStock: 0,
  photoUrl: "",
  isActive: true,
})

/** Mengubah baris produk dari backend jadi nilai awal form halaman edit. */
export const keFormValues = (p: ProductDto): ProdukFormValues => ({
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
  supplierId: p.supplierId || NONE,
  consignmentPrice: p.consignmentPrice ?? 0,
  minStock: p.minStock ?? 0,
  photoUrl: p.photoUrl ?? "",
  isActive: p.isActive,
})
