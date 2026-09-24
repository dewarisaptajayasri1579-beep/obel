"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Keyboard, Store } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api-client";
import { BoothForm } from "../BoothForm";
import { nilaiAwalBooth, nomorBoothBerikutnya, type BoothFormValues } from "../form-values";

/// Tambah Booth — halaman tersendiri (bukan modal): lihat alasannya di `BoothForm`.
function BoothBaruContent() {
  const searchParams = useSearchParams();
  const back = searchParams.get("back") ?? "";
  const kembali = `/master/booth${back ? `?${back}` : ""}`;

  // Kode & Nama Booth diisi otomatis lanjut nomor urut terbesar yang sudah
  // ada (lihat nomorBoothBerikutnya) — form baru dirender setelah nomor ini
  // didapat, bukan sesudah (BoothForm cuma baca `initial` sekali lewat
  // useState, prop yang berubah belakangan tidak akan kepakai).
  const [initial, setInitial] = useState<BoothFormValues | null>(null);

  useEffect(() => {
    let batal = false;
    api
      .getBooths()
      .then((booths) => {
        if (!batal) setInitial(nilaiAwalBooth(nomorBoothBerikutnya(booths)));
      })
      .catch(() => {
        if (!batal) setInitial(nilaiAwalBooth());
      });
    return () => {
      batal = true;
    };
  }, []);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Data Operasional" },
          { label: "Booth", href: kembali },
          { label: "Tambah Baru" },
        ]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href={kembali}
            className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
            aria-label="Kembali ke daftar Booth"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Store className="w-5 h-5 text-[var(--brand-700)] dark:text-brand-400 mt-1.5 flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">
              Tambah Booth
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              Isi dari atas ke bawah — tekan Enter untuk lompat ke isian berikutnya.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-fg-muted">
          <Keyboard className="w-3.5 h-3.5" />
          Ctrl+S simpan · Ctrl+Enter simpan &amp; tambah lagi · Esc batal
        </span>
      </div>

      <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
        {initial ? (
          <BoothForm mode="create" initial={initial} back={back} />
        ) : (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
      </Card>
    </div>
  );
}

export default function BoothBaruPage() {
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
        <BoothBaruContent />
      </Suspense>
    </RequireAuth>
  );
}
