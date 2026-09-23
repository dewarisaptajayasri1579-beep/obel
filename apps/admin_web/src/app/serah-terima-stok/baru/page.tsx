"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Keyboard, Truck } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Product } from "@/lib/api-client";
import { SerahTerimaForm } from "../SerahTerimaForm";

function KirimStokContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const prefillBoothId = searchParams.get("boothId") || undefined;
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    api
      .getProducts()
      .then(setProducts)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar produk.");
        setProducts([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Transaksi" },
          { label: "Serah Terima Stok", href: "/serah-terima-stok" },
          { label: "Kirim Stok" },
        ]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href="/serah-terima-stok"
            className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
            aria-label="Kembali ke daftar Serah Terima Stok"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Truck className="w-5 h-5 text-[var(--brand-700)] dark:text-brand-400 mt-1.5 flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">
              Kirim Stok ke Petugas
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              Pilih Petugas yang sedang Aktif — Booth ikut otomatis.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-fg-muted">
          <Keyboard className="w-3.5 h-3.5" />
          Ctrl+P Pratinjau · Ctrl+Enter Kirim
        </span>
      </div>

      <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
        {!products ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <SerahTerimaForm products={products} prefillBoothId={prefillBoothId} />
        )}
      </Card>
    </div>
  );
}

export default function KirimStokPage() {
  return (
    <RequireAuth>
      {/* useSearchParams wajib dibungkus Suspense di App Router. */}
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        }
      >
        <KirimStokContent />
      </Suspense>
    </RequireAuth>
  );
}
