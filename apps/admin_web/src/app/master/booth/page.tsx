"use client";

import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth, type Product } from "@/lib/api-client";
import { BoothTabs } from "./BoothTabs";
import { TabMain } from "./TabMain";
import { TabMutasiBooth } from "./TabMutasiBooth";
import { TabRiwayatPenjualan } from "./TabRiwayatPenjualan";
import { TabSettingPetugas } from "./TabSettingPetugas";

/// Halaman Booth (Data Operasional). Empat tab — lihat BoothTabs.tsx untuk
/// alasan pola tab-nya. `products` ikut dimuat di sini (bukan di dalam
/// masing-masing tab) karena dipakai tab Mutasi Stok & Mutasi Penjualan
/// sekaligus, sama seperti pola di halaman Produk.
function BoothContent() {
  const toast = useToast();
  const [booths, setBooths] = useState<Booth[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    try {
      const [boothList, productList] = await Promise.all([api.getBooths(), api.getProducts()]);
      setBooths(boothList);
      setProducts(productList);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Booth.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!booths) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Breadcrumb
        items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Data Operasional" }, { label: "Booth" }]}
      />

      <BoothTabs
        isi={{
          main: <TabMain booths={booths} onReload={load} />,
          "mutasi-stok": (
            <TabMutasiBooth
              booths={booths}
              products={products}
              jenis="SEMUA"
              judul="Mutasi Stok"
              deskripsi="Semua jenis pergerakan stok (distribusi, penjualan, adjustment, return) per Booth."
            />
          ),
          "mutasi-penjualan": (
            <TabMutasiBooth
              booths={booths}
              products={products}
              jenis="PENJUALAN"
              judul="Mutasi Penjualan"
              deskripsi="Cup keluar khusus akibat penjualan (tidak termasuk restock/adjustment/return) per Booth."
            />
          ),
          "riwayat-penjualan": <TabRiwayatPenjualan booths={booths} />,
          "setting-petugas": <TabSettingPetugas booths={booths} />,
        }}
      />
    </div>
  );
}

export default function BoothPage() {
  return (
    <RequireAuth>
      <BoothContent />
    </RequireAuth>
  );
}
