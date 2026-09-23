"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Printer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { api } from "@/lib/api-client";

/// Pratinjau nota PDF satu dokumen Serah Terima Stok — pola sama persis
/// dengan PenerimaanNotaPreviewModal.tsx (Tambah Stok Gudang), sumbernya
/// /reports/stock-handovers/:id/pdf.
export function SerahTerimaNotaPreviewModal({
  isOpen,
  onClose,
  handoverId,
  docNo,
}: {
  isOpen: boolean;
  onClose: () => void;
  handoverId: string;
  docNo: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let objectUrl: string | null = null;
    let batal = false;

    setUrl(null);
    setGagal(false);

    api
      .getStockHandoverNotaPdf(handoverId)
      .then((blob) => {
        if (batal) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!batal) setGagal(true);
      });

    return () => {
      batal = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, handoverId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5 flex-wrap">
          <span>Pratinjau Bukti Serah Terima Stok</span>
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border border-brand-100 dark:border-brand-500/20">
            {docNo}
          </span>
        </span>
      }
      size="lg"
    >
      <div className="space-y-3">
        <div className="h-[60vh] rounded-xl border border-slate-200 dark:border-line overflow-hidden bg-slate-50 dark:bg-surface-hover">
          {gagal ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-fg-muted">Gagal membuat nota.</div>
          ) : url ? (
            <iframe src={url} title="Pratinjau nota Serah Terima Stok" className="w-full h-full" />
          ) : (
            <div className="h-full flex items-center justify-center">
              <Spinner />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={!url}
            onClick={() => url && window.open(url, "_blank")}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            Buka Tab Baru
          </button>
          <button
            type="button"
            disabled={!url}
            onClick={() => {
              const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Pratinjau nota Serah Terima Stok"]');
              frame?.contentWindow?.print();
            }}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[var(--brand-700)] text-white text-xs font-bold shadow-xs cursor-pointer transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak
          </button>
        </div>
      </div>
    </Modal>
  );
}
