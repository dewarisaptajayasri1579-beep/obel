import type { Product } from "@/lib/api-client";

/// Satu baris Varian Rasa di form; `key` hanya untuk React (varian baru belum punya `id`).
export interface VarianForm {
  key: string;
  id?: string;
  name: string;
  active: boolean;
}

export interface ProdukFormValues {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  sellPrice: number;
  imageUrl: string;
  isActive: boolean;
  variants: VarianForm[];
}

/// Nilai awal form tambah. Kategori dipertahankan dari isian sebelumnya saat
/// "Simpan & Tambah Lagi" — produk yang diinput berurutan hampir selalu dari
/// kategori yang sama, mengosongkannya cuma bikin dipilih ulang tiap baris.
export function nilaiAwalProduk(categoryId = ""): ProdukFormValues {
  return {
    id: "",
    sku: "",
    name: "",
    categoryId,
    sellPrice: 0,
    imageUrl: "",
    isActive: true,
    variants: [],
  };
}

export function keFormValues(p: Product, categoryId: string): ProdukFormValues {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    categoryId,
    sellPrice: p.sellPrice,
    imageUrl: p.imageUrl ?? "",
    isActive: p.active,
    variants: p.variants.map((v) => ({ key: v.id, id: v.id, name: v.name, active: v.active })),
  };
}
