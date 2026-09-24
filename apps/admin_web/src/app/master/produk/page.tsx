"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  api,
  ApiError,
  type Booth,
  type Product,
  type ProductCategory,
  type RingkasStokProduk,
} from "@/lib/api-client";
import { ProdukTabs } from "./ProdukTabs";
import { TabMain } from "./TabMain";
import { TabMutasiStok } from "./TabMutasiStok";
import { TabSebaranStok } from "./TabSebaranStok";
import { TabPengaturan } from "./TabPengaturan";
import { periodeBerjalanJakarta } from "./PeriodeFilter";

/// Halaman Produk (Data Operasional). Dua tab: Main (daftar & CRUD) dan Mutasi
/// Stok (Rekap & Rinci).
///
/// Kartu ringkasan sengaja TIDAK di sini melainkan di dalam tab Main — angkanya
/// ikut menyusut mengikuti penyaring tabel, jadi tempatnya harus menyatu dengan
/// penyaringnya. Kalau dipasang di level halaman, angka yang tampil saat tabel
/// tersaring akan terbaca sebagai angka seluruh katalog.
function ProdukContent() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [ringkas, setRingkas] = useState<Map<string, RingkasStokProduk>>(new Map());
  const [periode] = useState(periodeBerjalanJakarta());

  const load = useCallback(async () => {
    try {
      // Ringkasan stok ditarik sekali untuk SELURUH produk, bukan per baris
      // tabel — daftar produk jauh lebih sering dibuka daripada rincian satu
      // produk, dan N+1 di situ langsung terasa.
      const [productList, categoryList, boothList, ringkasList] = await Promise.all([
        api.getProducts(),
        api.getProductCategories(),
        api.getBooths(),
        api.getStockRingkas(periode).catch(() => null),
      ]);
      setProducts(productList);
      setCategories(categoryList);
      setBooths(boothList);
      setRingkas(new Map((ringkasList?.rows ?? []).map((r) => [r.productId, r])));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Produk.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode]);

  useEffect(() => {
    load();
  }, [load]);

  if (!products) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Breadcrumb
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Data Operasional" }, { label: "Produk" }]}
      />

      <ProdukTabs
        isi={{
          main: (
            <TabMain
              products={products}
              categories={categories}
              ringkas={ringkas}
              periode={periode}
              onReload={load}
            />
          ),
          mutasi: <TabMutasiStok products={products} booths={booths} />,
          sebaran: <TabSebaranStok />,
          pengaturan: <TabPengaturan products={products} onReload={load} />,
        }}
      />
    </div>
  );
}

export default function ProdukPage() {
  return (
    <RequireAuth>
      <ProdukContent />
    </RequireAuth>
  );
}
