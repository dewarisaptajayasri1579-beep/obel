"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Keyboard, Package } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Product, type ProductCategory } from "@/lib/api-client";
import { ProdukForm } from "../../ProdukForm";
import { keFormValues } from "../../form-values";

function ProdukEditContent({ id }: { id: string }) {
  const toast = useToast();
  const searchParams = useSearchParams();
  const back = searchParams.get("back") ?? "";

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [tidakAda, setTidakAda] = useState(false);

  useEffect(() => {
    Promise.all([api.getProducts(), api.getProductCategories()])
      .then(([produk, kategori]) => {
        const p = produk.find((x) => x.id === id) ?? null;
        setProduct(p);
        setCategories(kategori);
        if (!p) setTidakAda(true);
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat data produk.");
        setTidakAda(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const kembali = `/master/produk${back ? `?${back}` : ""}`;

  // Referensi array stabil — lihat catatan di halaman "Tambah Baru" / ProdukForm.
  const opsiKategori = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Data Operasional" },
          { label: "Produk", href: kembali },
          { label: product?.name ?? "Ubah" },
        ]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href={kembali}
            className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
            aria-label="Kembali ke daftar produk"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Package className="w-5 h-5 text-[var(--brand-700)] dark:text-brand-400 mt-1.5 flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">
              Ubah Produk
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              {product ? `${product.sku} — ${product.name}` : "Memuat data produk..."}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-fg-muted">
          <Keyboard className="w-3.5 h-3.5" />
          Ctrl+S simpan · Esc batal
        </span>
      </div>

      <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
        {tidakAda ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-fg-muted">
            Produk tidak ditemukan.{" "}
            <Link href={kembali} className="font-semibold text-[var(--brand-700)] hover:underline">
              Kembali ke daftar
            </Link>
          </div>
        ) : !product ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <ProdukForm
            mode="edit"
            initial={keFormValues(product, categories.find((c) => c.name === product.category)?.id ?? "")}
            categories={opsiKategori}
            back={back}
          />
        )}
      </Card>
    </div>
  );
}

export default function ProdukEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        }
      >
        <ProdukEditContent id={id} />
      </Suspense>
    </RequireAuth>
  );
}
