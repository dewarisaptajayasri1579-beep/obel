"use client";

import { useState } from "react";
import { Printer, ZoomIn, ZoomOut } from "lucide-react";
import { Modal, Button } from "@/components/ui";

/** Modal pratinjau dokumen transaksi (nota/bukti) — generik lewat render-prop, dipakai SEMUA
 *  form Transaksi dengan Detail (§7.1 aturan-tampilan.md) untuk tombol "Preview". Beda dari
 *  `laporan/ReportPreviewModal.tsx` (itu untuk laporan Rekap/Rinci yang datanya di-fetch dari
 *  endpoint JSON) — ini dokumen SATU transaksi, datanya sudah ada di tangan pemanggil (state
 *  form saat ini, atau data yang sudah tersimpan), jadi tidak ada fetch/loading di sini.
 *
 *  Extract dari `PurchaseOrderPreviewModal.tsx` (acuan pertama) supaya form baru (Serah Terima
 *  Barang, dst) tidak menyalin ulang boilerplate zoom+modal — cukup kirim `renderDocument()`
 *  yang me-render komponen `XPrintable` miliknya sendiri. */
export function DocumentPreviewModal({
  isOpen,
  onClose,
  title,
  docNumber,
  renderDocument,
  defaultZoom = 0.85,
  documentWidth = 760,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Badge nomor dokumen di judul modal — null/undefined kalau belum tersimpan. */
  docNumber?: string | null;
  renderDocument: () => React.ReactNode;
  defaultZoom?: number;
  documentWidth?: number;
}) {
  const [zoom, setZoom] = useState<number>(defaultZoom);

  // Modal ditutup dulu sebelum window.print() — biar bingkai modal (backdrop/judul/footer,
  // bukan bagian dari salinan `.print-only`) tidak ikut kepotret di render terakhir sebelum
  // dialog print browser muncul.
  const handlePrint = () => {
    onClose();
    requestAnimationFrame(() => window.print());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-surface-hover flex items-center justify-center text-[#0544cc] dark:text-blue-400">
            <Printer className="w-4 h-4" />
          </div>
          <div>
            <span className="text-lg font-black text-slate-800 dark:text-fg">{title}</span>
            {docNumber && (
              <span className="ml-2 text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100/70 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                {docNumber}
              </span>
            )}
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-surface px-2 py-1 rounded-xl border border-slate-200/80 dark:border-line">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.05).toFixed(2))))}
              className="p-1 rounded hover:bg-white dark:hover:bg-surface-hover text-slate-700 dark:text-fg cursor-pointer transition-colors"
              title="Perkecil Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono font-bold text-xs text-slate-800 dark:text-fg w-11 text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.15, Number((z + 0.05).toFixed(2))))}
              className="p-1 rounded hover:bg-white dark:hover:bg-surface-hover text-slate-700 dark:text-fg cursor-pointer transition-colors"
              title="Perbesar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3.5 bg-slate-300 dark:bg-line mx-1" />
            <button
              type="button"
              onClick={() => setZoom(defaultZoom)}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-lg cursor-pointer transition-colors ${
                zoom === defaultZoom ? "bg-[#0544cc] text-white shadow-xs" : "text-slate-600 dark:text-fg-muted hover:bg-white dark:hover:bg-surface-hover"
              }`}
            >
              Pas ({Math.round(defaultZoom * 100)}%)
            </button>
            <button
              type="button"
              onClick={() => setZoom(1.0)}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-lg cursor-pointer transition-colors ${
                zoom === 1.0 ? "bg-[#0544cc] text-white shadow-xs" : "text-slate-600 dark:text-fg-muted hover:bg-white dark:hover:bg-surface-hover"
              }`}
            >
              100%
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Tutup
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
              Cetak Dokumen
            </Button>
          </div>
        </div>
      }
    >
      <div className="bg-slate-100/70 dark:bg-surface-hover/50 p-2 sm:p-3 rounded-2xl overflow-hidden flex justify-center items-start">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            width: `${documentWidth}px`,
            marginBottom: `${Math.min(0, (zoom - 1) * 530)}px`,
            transition: "transform 0.15s ease",
          }}
        >
          {renderDocument()}
        </div>
      </div>
    </Modal>
  );
}
