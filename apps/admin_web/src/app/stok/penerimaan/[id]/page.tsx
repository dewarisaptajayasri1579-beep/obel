"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Keyboard, PackagePlus } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Product, type StockReceipt } from "@/lib/api-client";
import { PenerimaanForm } from "../PenerimaanForm";

const STATUS_LABEL: Record<StockReceipt["status"], { label: string; kelas: string }> = {
  DRAFT: { label: "Draft", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line" },
  POSTED: { label: "Posted", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  REVISED: { label: "Revised", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
};

function DetailPenerimaanContent({ id }: { id: string }) {
  const toast = useToast();
  const [receipt, setReceipt] = useState<StockReceipt | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [tidakAda, setTidakAda] = useState(false);

  useEffect(() => {
    Promise.all([api.getStockReceipt(id), api.getProducts()])
      .then(([r, p]) => {
        setReceipt(r);
        setProducts(p);
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat dokumen.");
        setTidakAda(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const status = receipt ? STATUS_LABEL[receipt.status] : null;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Transaksi" },
          { label: "Tambah Stok Gudang", href: "/stok/penerimaan" },
          { label: receipt?.receiptNo ?? "Detail" },
        ]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href="/stok/penerimaan"
            className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
            aria-label="Kembali ke daftar Tambah Stok Gudang"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <PackagePlus className="w-5 h-5 text-[var(--brand-700)] dark:text-brand-400 mt-1.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">
                {receipt?.receiptNo ?? "Memuat..."}
              </h1>
              {status && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${status.kelas}`}>
                  {status.label}
                </span>
              )}
              {receipt && receipt.versionNo > 1 && (
                <span className="text-xs font-semibold text-slate-400 dark:text-fg-muted">versi {receipt.versionNo}</span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              {receipt?.status === "DRAFT"
                ? "Masih Draft — ubah angkanya lalu Simpan atau Posting."
                : "Dokumen sudah final — angkanya tidak bisa diedit langsung."}
            </p>
          </div>
        </div>
        {receipt?.status === "DRAFT" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-fg-muted">
            <Keyboard className="w-3.5 h-3.5" />
            Ctrl+S Simpan Draft · Ctrl+Enter Posting
          </span>
        )}
      </div>

      <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
        {tidakAda ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-fg-muted">
            Dokumen tidak ditemukan.{" "}
            <Link href="/stok/penerimaan" className="font-semibold text-[var(--brand-700)] hover:underline">
              Kembali ke daftar
            </Link>
          </div>
        ) : !receipt || !products ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <PenerimaanForm products={products} initial={receipt} onChanged={setReceipt} />
        )}
      </Card>
    </div>
  );
}

export default function DetailPenerimaanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <DetailPenerimaanContent id={id} />
    </RequireAuth>
  );
}
