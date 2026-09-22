"use client";

import { useEffect, useState } from "react";
import { FileText, Printer, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { Modal, Button, Spinner } from "@/components/ui";
import { LaporanProdukPrintable, type BarisLaporanProduk } from "./print/LaporanProdukPrintable";

interface DataLaporanProduk {
  rows: BarisLaporanProduk[];
  labelPenyaring: string;
  company: { name: string; legalName: string | null; address: string | null; phone: string | null } | null;
  dicetakOleh: string;
}

/** Pratinjau daftar Master Produk sebelum PDF-nya dibuka — pola & isi disamakan persis dengan
 *  `PurchaseOrderReportPreviewModal`, sampai ke langkah zoom dan tombol kakinya. Dipanggil dari
 *  tombol "PDF" di ProdukPanel, GANTI dari sebelumnya yang langsung `<a target="_blank">` ke
 *  berkas PDF-nya tanpa pratinjau. */
export function ProdukReportPreviewModal({ isOpen, onClose, query }: { isOpen: boolean; onClose: () => void; query: string }) {
  const [zoom, setZoom] = useState<number>(0.75);
  const [data, setData] = useState<DataLaporanProduk | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pdfHref = `/api/laporan/produk/pdf${query}`;

  // Penampil PDF bawaan peramban (dibuka lewat tab baru ini) sudah punya tombol cetaknya
  // sendiri — tidak perlu window.print() di sini, cukup buka PDF-nya.
  const handlePrint = () => {
    const printWindow = window.open(pdfHref, "_blank");
    if (printWindow) printWindow.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError("");
    setData(null);
    fetch(`/api/laporan/produk${query}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(body?.error || "Gagal memuat pratinjau");
        setData(body);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat pratinjau"))
      .finally(() => setLoading(false));
  }, [isOpen, query]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-surface-hover flex items-center justify-center text-[#0544cc] dark:text-blue-400">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-lg font-black text-slate-800 dark:text-fg">Preview Daftar Produk</span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full flex-wrap gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-surface px-2 py-1 rounded-xl border border-slate-200/80 dark:border-line">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.05).toFixed(2))))}
              className="p-1 rounded hover:bg-white dark:hover:bg-surface-hover text-slate-700 dark:text-fg cursor-pointer transition-colors"
              title="Perkecil Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono font-bold text-xs text-slate-800 dark:text-fg w-11 text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.1, Number((z + 0.05).toFixed(2))))}
              className="p-1 rounded hover:bg-white dark:hover:bg-surface-hover text-slate-700 dark:text-fg cursor-pointer transition-colors"
              title="Perbesar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3.5 bg-slate-300 dark:bg-line mx-1" />
            <button
              type="button"
              onClick={() => setZoom(0.75)}
              className={`px-2 py-0.5 text-[11px] font-bold rounded-lg cursor-pointer transition-colors ${
                zoom === 0.75 ? "bg-[#0544cc] text-white shadow-xs" : "text-slate-600 dark:text-fg-muted hover:bg-white dark:hover:bg-surface-hover"
              }`}
            >
              Pas (75%)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Tutup
            </Button>
            <a href={pdfHref} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm" leftIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                Buka di Tab Baru
              </Button>
            </a>
            <Button variant="primary" size="sm" leftIcon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
              Cetak Dokumen
            </Button>
          </div>
        </div>
      }
    >
      {/* Tingginya dibatasi di sini, bukan mengandalkan tinggi modal: daftar produk A4 landscape
          dengan banyak baris bisa nyaris setinggi layar dan menutupi kepala modal. */}
      <div className="bg-slate-100/70 dark:bg-surface-hover/50 p-2 sm:p-3 rounded-2xl overflow-auto max-h-[45vh] flex justify-center items-start min-h-[300px]">
        {error ? (
          <div className="py-16 flex justify-center items-center w-full">
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{error}</p>
          </div>
        ) : loading || !data ? (
          <div className="py-16 flex justify-center items-center w-full">
            <Spinner />
          </div>
        ) : (
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
              width: "1000px",
              marginBottom: `${Math.min(0, (zoom - 1) * 900)}px`,
              transition: "transform 0.15s ease",
            }}
          >
            <LaporanProdukPrintable
              rows={data.rows}
              labelPenyaring={data.labelPenyaring}
              company={data.company}
              dicetakOleh={data.dicetakOleh}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
