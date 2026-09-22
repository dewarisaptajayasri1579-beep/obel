"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Printer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { api, type FilterLaporanProduk } from "@/lib/api-client";

/// Pratinjau PDF daftar produk sebelum dicetak — pola yang sama dengan PDF di
/// jsBerkah: berkasnya dilihat dulu, baru diputuskan mau dicetak atau tidak.
///
/// PDF ditarik sebagai Blob (bukan <iframe src> ke URL backend) karena token
/// Obbel ada di localStorage, bukan cookie — iframe tidak akan membawanya.
export function ProdukReportPreviewModal({
  isOpen,
  onClose,
  filter,
}: {
  isOpen: boolean;
  onClose: () => void;
  filter: FilterLaporanProduk;
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
      .getProductReport("pdf", filter)
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
      // Blob URL wajib dilepas: tanpa ini tiap kali modal dibuka menyisakan
      // satu salinan PDF di memori sampai tab ditutup.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, filter.q, filter.kategoriId, filter.status]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pratinjau Daftar Produk" size="lg">
      <div className="space-y-3">
        <p className="text-[11px] text-slate-500 dark:text-fg-muted">
          Isinya mengikuti filter yang sedang aktif di layar.
        </p>

        <div className="h-[60vh] rounded-xl border border-slate-200 dark:border-line overflow-hidden bg-slate-50 dark:bg-surface-hover">
          {gagal ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-fg-muted">
              Gagal membuat pratinjau.
            </div>
          ) : url ? (
            <iframe src={url} title="Pratinjau PDF daftar produk" className="w-full h-full" />
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
              const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Pratinjau PDF daftar produk"]');
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
