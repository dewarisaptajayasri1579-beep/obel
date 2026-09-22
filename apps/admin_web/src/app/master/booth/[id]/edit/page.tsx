"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Keyboard, Store } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth } from "@/lib/api-client";
import { BoothForm } from "../../BoothForm";
import { keFormValues } from "../../form-values";

function BoothEditContent({ id }: { id: string }) {
  const toast = useToast();
  const searchParams = useSearchParams();
  const back = searchParams.get("back") ?? "";

  const [booth, setBooth] = useState<Booth | null>(null);
  const [tidakAda, setTidakAda] = useState(false);

  useEffect(() => {
    api
      .getBooths()
      .then((booths) => {
        const b = booths.find((x) => x.id === id) ?? null;
        setBooth(b);
        if (!b) setTidakAda(true);
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Booth.");
        setTidakAda(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const kembali = `/master/booth${back ? `?${back}` : ""}`;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Data Operasional" },
          { label: "Booth", href: kembali },
          { label: booth?.name ?? "Ubah" },
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
              Ubah Booth
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              {booth ? `${booth.code} — ${booth.name}` : "Memuat data Booth..."}
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
            Booth tidak ditemukan.{" "}
            <Link href={kembali} className="font-semibold text-[var(--brand-700)] hover:underline">
              Kembali ke daftar
            </Link>
          </div>
        ) : !booth ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <BoothForm mode="edit" initial={keFormValues(booth)} back={back} />
        )}
      </Card>
    </div>
  );
}

export default function BoothEditPage({ params }: { params: Promise<{ id: string }> }) {
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
        <BoothEditContent id={id} />
      </Suspense>
    </RequireAuth>
  );
}
