import type { Product } from "@/lib/api-client";

export interface ProdukFormValues {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  sellPrice: number;
  imageUrl: string;
  isActive: boolean;
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
  };
}
