"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Select, Button, Modal, RincianKonfirmasi, Alert, Badge, useToast } from "@/components/ui";
import { Table, TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { useHotkey } from "@/hooks/useHotkey";
import { useFokusAwal } from "@/hooks/useFokusAwal";
import { formatRupiah } from "@/lib/format";
import { DocumentPreviewModal } from "@/components/transaksi/DocumentPreviewModal";
import { NumberCell } from "@/components/transaksi/GridCells";
import { OpnamePrintable, type OpnamePrintableData } from "./OpnamePrintable";

type Option = { value: string; label: string };
type QuotaItem = { productId: string; productName: string; productCode: string; unit: string; quotaQty: number; stockSistem: number; sellPrice: number };

export interface OpnameInitialData {
  id: string;
  opnameNumber: string;
  date: string;
  status: "DRAFT" | "SELESAI";
  storeId: string;
  petugasName: string;
  items: {
    productId: string;
    productCode: string;
    productName: string;
    quotaQty: number;
    stockSistem: number;
    stockFisik: number;
    terjualQty: number;
    refillQty: number;
    selisihType: string;
    subtotalTagihan: number;
  }[];
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Form Stock Opname — dipakai DUA tempat: bikin baru (`baru/`) dan lihat opname yang sudah
 *  tersimpan (`[id]/`, lewat `initialData`), pola sama `SetorForm.tsx`. Beda MENDASAR dari
 *  Setor/PO/STB: baris item di sini BUKAN grid dinamis (tambah/hapus produk bebas) — daftarnya
 *  FIXED, satu baris per produk yang punya kuota aktif di toko terpilih (`quotasByStore`), cuma
 *  kolom "Stock Fisik" yang bisa diketik. Makanya TIDAK pakai `GridCells.ProductCodeInput` (tidak
 *  ada pemilihan produk sama sekali) — cukup `NumberCell` per baris, Enter/Tab pindah ke baris
 *  berikutnya. Tidak ada Koreksi (backend tidak punya endpoint pembalik untuk Opname — stock
 *  count bukan transaksi jual-beli yang wajar "dikoreksi" lewat dokumen baru). */
export const OpnameForm: React.FC<{
  stores: Option[];
  quotasByStore: Record<string, QuotaItem[]>;
  initialData?: OpnameInitialData;
  currentUserName?: string;
  company?: OpnamePrintableData["company"];
}> = ({ stores, quotasByStore, initialData, currentUserName, company = null }) => {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!initialData;
  const readOnly = isEdit;

  const [storeId, setStoreId] = useState(initialData?.storeId ?? stores[0]?.value ?? "");
  const [fisik, setFisik] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useFokusAwal(formRef, !readOnly);

  const quotaItems = useMemo(() => quotasByStore[storeId] ?? [], [quotasByStore, storeId]);

  const preview = useMemo(() => {
    if (readOnly) {
      return initialData!.items.map((i) => ({
        productId: i.productId,
        productCode: i.productCode,
        productName: i.productName,
        unit: "",
        quotaQty: i.quotaQty,
        stockSistem: i.stockSistem,
        stockFisik: i.stockFisik,
        terjualQty: i.terjualQty,
        refillQty: i.refillQty,
        isRetur: i.selisihType === "RETUR_LEBIH",
        subtotal: i.subtotalTagihan,
      }));
    }
    return quotaItems.map((item) => {
      const stockFisik = fisik[item.productId] ?? item.stockSistem;
      const isRetur = stockFisik > item.stockSistem;
      const terjualQty = isRetur ? 0 : item.stockSistem - stockFisik;
      const refillQty = Math.max(0, item.quotaQty - stockFisik);
      const subtotal = terjualQty * item.sellPrice;
      return { ...item, stockFisik, isRetur, terjualQty, refillQty, subtotal };
    });
  }, [readOnly, initialData, quotaItems, fisik]);

  const totalTagihan = preview.reduce((sum, p) => sum + p.subtotal, 0);

  const printableData: OpnamePrintableData = {
    opnameNumber: initialData?.opnameNumber ?? null,
    date: initialData?.date ?? today(),
    status: initialData?.status ?? null,
    storeName: stores.find((s) => s.value === storeId)?.label ?? "",
    petugasName: initialData?.petugasName ?? currentUserName ?? "",
    lines: preview.map((p) => ({
      productCode: p.productCode,
      productName: p.productName,
      quotaQty: p.quotaQty,
      stockSistem: p.stockSistem,
      stockFisik: p.stockFisik,
      terjualQty: p.terjualQty,
      refillQty: p.refillQty,
      isRetur: p.isRetur,
      subtotal: p.subtotal,
    })),
    total: totalTagihan,
    dibuatOleh: initialData?.petugasName || currentUserName || null,
    company,
  };

  const gagalkan = (pesan: string) => toast.error(pesan);

  const focusCell = useCallback((row: number) => {
    const target = gridRef.current?.querySelector<HTMLInputElement>(`[data-cell="${row}"]`);
    target?.focus();
  }, []);

  const cellProps = (row: number) => ({ "data-cell": `${row}`, disabled: readOnly });

  const advance = (rowIndex: number) => {
    if (rowIndex < quotaItems.length - 1) {
      focusCell(rowIndex + 1);
      return;
    }
    // Baris terakhir — lompat keluar tabel ke field berikutnya (Catatan/tombol Simpan), sama
    // konsepnya dengan `keluarDariTabel()` di form grid dinamis (PO/Setor), disederhanakan
    // karena di sini tidak ada baris baru yang perlu dimunculkan sendiri.
    const tabel = gridRef.current;
    if (!tabel) return;
    const wadah = tabel.closest("form, [data-isian-form]") ?? document.body;
    const berikutnya = Array.from(wadah.querySelectorAll<HTMLElement>('input,select,textarea,button[role="combobox"]')).find(
      (el) => !(el as HTMLInputElement).disabled && el.tabIndex !== -1 && el.offsetParent !== null && !tabel.contains(el),
    );
    berikutnya?.focus();
  };

  const requestSave = () => {
    if (quotaItems.length === 0) {
      gagalkan("Toko belum punya produk dengan kuota aktif");
      return;
    }
    setConfirmSave(true);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, items: quotaItems.map((i) => ({ productId: i.productId, stockFisik: fisik[i.productId] ?? i.stockSistem })) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        gagalkan(data?.error || "Gagal menyimpan Stock Opname");
        return;
      }
      toast.success(`Stock Opname ${data.stockOpname.opnameNumber} selesai`);
      router.push(`/operasional/opname/${data.stockOpname.id}`);
    } catch {
      gagalkan("Gagal menghubungi server");
    } finally {
      setSubmitting(false);
      setConfirmSave(false);
    }
  };

  useHotkey({ key: "s", ctrl: true, allowInEditable: true }, () => !readOnly && requestSave());
  useHotkey({ key: "Enter", ctrl: true, allowInEditable: true }, () => !readOnly && requestSave());
  useHotkey({ key: "p", ctrl: true, allowInEditable: true }, () => setShowPreview(true));

  return (
    <div ref={formRef} className="space-y-5">
      {!readOnly && (
        <div data-fokus-awal className="max-w-sm">
          <Select
            label="Toko"
            options={stores}
            value={storeId}
            onChange={(v) => {
              setStoreId(v);
              setFisik({});
              requestAnimationFrame(() => focusCell(0));
            }}
            sizeVariant="sm"
          />
        </div>
      )}

      {!readOnly && quotaItems.length === 0 ? (
        <Alert variant="warning">Toko ini belum punya produk dengan kuota parfum aktif — atur kuota dulu di Master Data &gt; Toko &amp; Kuota.</Alert>
      ) : (
        <div ref={gridRef} className="rounded-xl bg-slate-50/70 dark:bg-surface-hover/40 border border-slate-200/80 dark:border-line p-2.5 sm:p-3">
          <TableContainer className="bg-transparent! border-0! shadow-none! rounded-none!">
            <Table>
              <TableHeader className="bg-transparent!">
                <TableRow>
                  <TableHead className="w-10 px-2.5! py-2! text-[11px]!">No.</TableHead>
                  <TableHead className="min-w-36 px-2.5! py-2! text-[11px]!">Produk</TableHead>
                  <TableHead className="w-20 px-2.5! py-2! text-[11px]! text-right">Kuota</TableHead>
                  <TableHead className="w-20 px-2.5! py-2! text-[11px]! text-right">Sistem</TableHead>
                  <TableHead className="w-24 px-2.5! py-2! text-[11px]!">Fisik</TableHead>
                  <TableHead className="w-20 px-2.5! py-2! text-[11px]! text-right">Terjual</TableHead>
                  <TableHead className="w-20 px-2.5! py-2! text-[11px]! text-right">Refill</TableHead>
                  <TableHead className="text-right px-2.5! py-2! text-[11px]!">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((p, index) => (
                  <TableRow key={p.productId}>
                    <TableCell className="px-2.5! py-1.5! text-xs">{index + 1}</TableCell>
                    <TableCell className="px-2.5! py-1.5! text-xs text-slate-700 dark:text-fg-secondary">
                      <span className="font-mono text-[10px] font-bold mr-1.5 text-slate-500">{p.productCode}</span>
                      {p.productName}
                      {p.isRetur && (
                        <Badge variant="warning" className="ml-2">
                          Retur
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-2.5! py-1.5! text-xs text-right text-slate-600 dark:text-fg-muted">{p.quotaQty}</TableCell>
                    <TableCell className="px-2.5! py-1.5! text-xs text-right text-slate-600 dark:text-fg-muted">{p.stockSistem}</TableCell>
                    <TableCell className="px-2.5! py-1.5!">
                      <NumberCell
                        value={p.stockFisik}
                        onChange={(v) => setFisik((prev) => ({ ...prev, [p.productId]: v }))}
                        onAdvance={() => advance(index)}
                        inputProps={cellProps(index)}
                      />
                    </TableCell>
                    <TableCell className="px-2.5! py-1.5! text-xs text-right text-slate-600 dark:text-fg-muted">{p.terjualQty}</TableCell>
                    <TableCell className="px-2.5! py-1.5! text-xs text-right text-slate-600 dark:text-fg-muted">{p.refillQty}</TableCell>
                    <TableCell className="px-2.5! py-1.5! text-right text-xs font-bold text-slate-900 dark:text-fg">{formatRupiah(p.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {!readOnly && (
            <p className="text-[11px] text-slate-500 dark:text-fg-muted mt-2.5">
              Daftar produk tetap (dari kuota aktif toko ini) — cuma kolom Fisik yang diketik, sisanya dihitung otomatis.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 border-t border-slate-200/60 dark:border-line pt-4">
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-fg-muted uppercase">Total Tagihan</p>
          <p className="text-xl font-black text-[#0544cc] dark:text-blue-400">{formatRupiah(totalTagihan)}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-line bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg font-medium text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <span>Preview</span>
            <span className="text-[9px] font-mono opacity-80 font-normal">(Ctrl+P)</span>
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={requestSave}
              disabled={submitting || quotaItems.length === 0}
              className="px-4 py-1.5 rounded-lg bg-[#0544cc] hover:bg-[#043aa8] text-white font-semibold text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{submitting ? "Memproses..." : "Selesaikan Opname"}</span>
              <span className="text-[9px] font-mono opacity-80 font-normal">(Ctrl+S)</span>
            </button>
          )}
        </div>
      </div>

      <DocumentPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Preview Stock Opname"
        docNumber={printableData.opnameNumber}
        renderDocument={() => <OpnamePrintable data={printableData} />}
      />

      {/* Salinan tersembunyi (`.print-only`) buat "Cetak Dokumen" beneran. */}
      <OpnamePrintable data={printableData} className="print-only" />

      {!readOnly && (
        <Modal
          isOpen={confirmSave}
          onClose={() => setConfirmSave(false)}
          size="md"
          title={
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-surface-hover flex items-center justify-center text-[#0544cc] dark:text-blue-400">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-slate-800 dark:text-fg">Selesaikan Stock Opname?</span>
            </div>
          }
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="secondary" onClick={() => setConfirmSave(false)} disabled={submitting}>
                Periksa Lagi
              </Button>
              <Button variant="primary" leftIcon={<Check className="w-3.5 h-3.5" />} onClick={submit} isLoading={submitting}>
                Ya, Selesaikan
              </Button>
            </div>
          }
        >
          <RincianKonfirmasi
            catatan={
              <>
                Status langsung <strong className="font-semibold">Selesai</strong> — tidak bisa diedit lagi setelah ini. Stock toko &amp; stock Sales ikut disesuaikan (terjual/refill/selisih).
              </>
            }
            akibat={[
              { label: `Jumlah produk dihitung`, nilai: `${preview.length} produk` },
              { label: "Total Tagihan", nilai: formatRupiah(totalTagihan) },
              { label: "Toko", nilai: stores.find((s) => s.value === storeId)?.label ?? "-" },
            ]}
            terbilangDari={totalTagihan}
          />
        </Modal>
      )}

      {submitting && <SavingOverlay />}
    </div>
  );
};

const SavingOverlay: React.FC = () => (
  <div className="fixed inset-0 z-100 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-150">
    <div className="flex flex-col items-center gap-4 px-8 py-7 rounded-2xl bg-white dark:bg-surface shadow-2xl border border-slate-200/80 dark:border-line">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-line" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#0544cc] dark:border-t-blue-400 animate-spin" />
      </div>
      <p className="text-xs font-bold tracking-[0.15em] text-slate-500 dark:text-fg-muted uppercase font-mono">
        <span className="animate-pulse">--- proses simpan ---</span>
      </p>
    </div>
  </div>
);
