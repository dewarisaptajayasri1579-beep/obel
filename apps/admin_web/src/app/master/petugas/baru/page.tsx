"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Keyboard, UserRound } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth } from "@/lib/api-client";
import { PetugasForm } from "../PetugasForm";
import { nilaiAwalPetugas } from "../form-values";

/// Tambah Petugas — halaman tersendiri (bukan modal): lihat alasannya di `PetugasForm`.
function PetugasBaruContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const back = searchParams.get("back") ?? "";
  const [booths, setBooths] = useState<Booth[] | null>(null);

  useEffect(() => {
    api
      .getBooths()
      .then(setBooths)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar Booth.");
        setBooths([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kembali = `/master/petugas${back ? `?${back}` : ""}`;

  const opsiBooth = useMemo(() => (booths ?? []).map((b) => ({ value: b.id, label: b.name })), [booths]);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Data Operasional" },
          { label: "Petugas", href: kembali },
          { label: "Tambah Baru" },
        ]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href={kembali}
            className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
            aria-label="Kembali ke daftar Petugas"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <UserRound className="w-5 h-5 text-[var(--brand-700)] dark:text-brand-400 mt-1.5 flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">
              Tambah Petugas
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
        {!booths ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <PetugasForm mode="create" initial={nilaiAwalPetugas()} booths={opsiBooth} back={back} />
        )}
      </Card>
    </div>
  );
}

export default function PetugasBaruPage() {
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
        <PetugasBaruContent />
      </Suspense>
    </RequireAuth>
  );
}
