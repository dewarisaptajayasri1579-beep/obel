"use client";

import { Printer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { SaleDetail } from "@/lib/api-client";

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function waktuJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

/// Pratinjau & cetak struk satu transaksi kasir — beda dari
/// PenerimaanNotaPreviewModal.tsx (Tambah Stok Gudang) yang mengambil PDF
/// jadi dari backend: struk di sini dirender langsung di klien lalu dicetak
/// lewat window.print() pada jendela baru, karena tidak ada layout PDF
/// khusus struk kasir di backend. Cukup buat Admin cetak dari browser
/// desktop (printer biasa/"Save as PDF") — beda kasus dari cetak struk
/// thermal Bluetooth di booth (lihat percakapan sebelumnya soal itu).
export function SaleNotaPreviewModal({
  isOpen,
  onClose,
  sale,
}: {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleDetail | null;
}) {
  function cetak() {
    if (!sale) return;
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) return;
    const baris = sale.items
      .map(
        (i) =>
          `<tr><td>${i.productName}</td><td style="text-align:right">${i.qty}x</td><td style="text-align:right">${formatRupiah(i.lineTotal)}</td></tr>`,
      )
      .join("");
    w.document.write(`
      <html>
        <head>
          <title>Struk ${sale.saleNo}</title>
          <style>
            body { font-family: monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 16px; }
            h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
            p { margin: 2px 0; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            td { padding: 2px 0; }
            hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
            .total { font-weight: bold; font-size: 13px; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <h1>Obbel Coffee &amp; Milk</h1>
          <p class="center">${sale.boothName} — Shift ${sale.shiftLabel}</p>
          <p class="center">${sale.paidAt ? waktuJakarta(sale.paidAt) : "-"}</p>
          <hr />
          <p>No. ${sale.saleNo}</p>
          <p>Petugas: ${sale.staffName}</p>
          <hr />
          <table>${baris}</table>
          <hr />
          <table>
            <tr><td>Subtotal</td><td style="text-align:right">${formatRupiah(sale.subtotal)}</td></tr>
            ${sale.discount > 0 ? `<tr><td>Diskon</td><td style="text-align:right">-${formatRupiah(sale.discount)}</td></tr>` : ""}
            <tr class="total"><td>Total</td><td style="text-align:right">${formatRupiah(sale.total)}</td></tr>
          </table>
          <hr />
          ${sale.payments.map((p) => `<p>${p.method}: ${formatRupiah(p.amount)}</p>`).join("")}
          <hr />
          <p class="center">Terima kasih!</p>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5 flex-wrap">
          <span>Pratinjau Struk</span>
          {sale && (
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border border-brand-100 dark:border-brand-500/20">
              {sale.saleNo}
            </span>
          )}
        </span>
      }
      size="sm"
    >
      {sale && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 dark:border-line bg-slate-50 dark:bg-surface-hover p-4 font-mono text-xs">
            <p className="text-center font-bold text-sm">Obbel Coffee &amp; Milk</p>
            <p className="text-center text-slate-500">
              {sale.boothName} — Shift {sale.shiftLabel}
            </p>
            <p className="text-center text-slate-500 mb-2">{sale.paidAt ? waktuJakarta(sale.paidAt) : "-"}</p>
            <div className="border-t border-dashed border-slate-300 dark:border-line my-2" />
            <p>No. {sale.saleNo}</p>
            <p>Petugas: {sale.staffName}</p>
            <div className="border-t border-dashed border-slate-300 dark:border-line my-2" />
            {sale.items.map((i) => (
              <div key={i.productId} className="flex justify-between">
                <span>{i.productName}</span>
                <span>
                  {i.qty}x {formatRupiah(i.lineTotal)}
                </span>
              </div>
            ))}
            <div className="border-t border-dashed border-slate-300 dark:border-line my-2" />
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatRupiah(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between">
                <span>Diskon</span>
                <span>-{formatRupiah(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm mt-1">
              <span>Total</span>
              <span>{formatRupiah(sale.total)}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={cetak}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-[var(--brand-700)] text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
