"use client";

import { useRef } from "react";
import { Printer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { SaleDetail } from "@/lib/api-client";
import { LEBAR_STRUK, buatStrukPenjualan, labelMetodeBayar, type PrintLine } from "@/lib/receipt";
import { usePerusahaan } from "@/lib/use-perusahaan";

/// Struk kertas 58mm: baris dari lib/receipt.ts (sama persis dengan yang dicetak Booth), font
/// monospace selebar LEBAR_STRUK karakter; judul ukuran 2 ditampilkan dua kali lebih besar.
/// Gaya ditulis inline supaya ikut terbawa saat disalin ke jendela cetak.
function StrukKertas({ baris }: { baris: PrintLine[] }) {
  return (
    <div style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12, lineHeight: 1.35, width: `${LEBAR_STRUK}ch`, margin: "0 auto", color: "#000" }}>
      {baris.map((b, i) => (
        <div
          key={i}
          style={{
            whiteSpace: "pre",
            textAlign: b.align,
            fontWeight: b.bold ? 700 : 400,
            fontSize: b.size === 2 ? "2em" : undefined,
            lineHeight: b.size === 2 ? 1.1 : undefined,
          }}
        >
          {b.text || " "}
        </div>
      ))}
    </div>
  );
}

/// Pratinjau & cetak struk satu transaksi kasir dari browser desktop Admin (printer biasa atau
/// "Save as PDF"). Isinya disusun oleh buatStrukPenjualan yang sama dengan struk thermal Booth,
/// ditandai REPRINT BILL karena struk aslinya sudah dicetak Barista saat pembayaran.
export function SaleNotaPreviewModal({
  isOpen,
  onClose,
  sale,
}: {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleDetail | null;
}) {
  const perusahaan = usePerusahaan();
  const kertas = useRef<HTMLDivElement>(null);

  const baris = sale
    ? buatStrukPenjualan({
        perusahaan,
        boothName: sale.boothName,
        saleNo: sale.saleNo,
        waktuIso: sale.paidAt ?? sale.createdAt,
        barista: sale.staffName,
        items: sale.items.map((i) => ({ name: i.productName, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        metode: labelMetodeBayar(sale.paymentMethod),
        cetakUlang: true,
      })
    : [];

  function cetak() {
    if (!sale || !kertas.current) return;
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) return;
    w.document.write(
      `<html><head><title>Struk ${sale.saleNo}</title><style>body{margin:0;padding:16px}@page{margin:8mm}</style></head><body>${kertas.current.innerHTML}</body></html>`,
    );
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
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-(--brand-700) dark:text-brand-400 border border-brand-100 dark:border-brand-500/20">
              {sale.saleNo}
            </span>
          )}
        </span>
      }
      size="sm"
    >
      {sale && (
        <div className="space-y-3">
          <div ref={kertas} className="rounded-xl border border-slate-200 dark:border-line bg-white p-4 overflow-x-auto">
            <StrukKertas baris={baris} />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={cetak}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-(--brand-700) text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
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
