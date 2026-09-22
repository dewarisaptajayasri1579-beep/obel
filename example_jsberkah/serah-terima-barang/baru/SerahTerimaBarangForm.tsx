"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Check } from "lucide-react";
import { Select, Input, DatePicker, Button, Alert, Modal, RincianKonfirmasi, useToast } from "@/components/ui";
import { Table, TableContainer, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { useHotkey } from "@/hooks/useHotkey";
import { useFokusAwal } from "@/hooks/useFokusAwal";
import { DocumentPreviewModal } from "@/components/transaksi/DocumentPreviewModal";
import { ProductCodeInput, NumberCell } from "@/components/transaksi/GridCells";
import { SerahTerimaBarangPrintable, type SerahTerimaBarangPrintableData } from "./SerahTerimaBarangPrintable";

type Option = { value: string; label: string };

interface LineState {
  id: number;
  productId: string;
  productCode: string;
  productName: string;
  qty: number;
  /** Cuma terisi di mode lihat (`initialData`) dan cuma kalau STB sudah Dikonfirmasi/Ditolak
   *  Sales — read-only, diisi Sales lewat Android, bukan bisa diketik dari sini. */
  qtyFisik?: number | null;
  alasanSelisih?: string | null;
}

let lineSeq = 0;
const blankLine = (): LineState => ({ id: ++lineSeq, productId: "", productCode: "", productName: "", qty: 1 });

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Field pemadat, menyamai tinggi baris tabel item (34px) — pola sama PurchaseOrderForm.
const COMPACT_FIELD = "!text-xs !h-8.5 !min-h-[34px] !rounded-lg !bg-white dark:!bg-surface shadow-2xs";
const COMPACT_LABEL = "text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none";

export interface SerahTerimaBarangInitialData {
  id: string;
  stbNumber: string;
  date: string;
  status: "MENUNGGU_KONFIRMASI" | "DIKONFIRMASI" | "DITOLAK";
  creatorName: string | null;
  salesId: string;
  warehouseId: string;
  notes: string;
  items: { productId: string; productCode: string; productName: string; qty: number; qtyFisik: number | null; alasanSelisih: string | null }[];
}

/** Form Serah Terima Barang — dipakai DUA tempat: bikin baru (`/pembelian/serah-terima-barang/baru`)
 *  dan lihat dokumen yang sudah tersimpan (`/pembelian/serah-terima-barang/[id]`, lewat
 *  `initialData`) — SATU komponen sama persis, pola sama `PurchaseOrderForm.tsx`. STB tidak
 *  pernah bisa diedit setelah dibuat (beda dari PO yang masih bisa diedit selagi DRAFT) — begitu
 *  `initialData` ada, `readOnly` SELALU true (lihat `[id]/page.tsx`). Disederhanakan dari
 *  `PurchaseOrderForm.tsx`: TIDAK ada harga/Total Rupiah (ini pemindahan tanggung jawab stok,
 *  bukan transaksi jual-beli) dan cuma SATU aksi simpan (bukan draft+posting terpisah) karena
 *  begitu disimpan, statusnya langsung "Menunggu Konfirmasi" dan bola pindah ke Sales
 *  (konfirmasi/tolak lewat Android), bukan ke Admin lagi. */
export const SerahTerimaBarangForm: React.FC<{
  salesOptions: Option[];
  warehouses: Option[];
  products: { id: string; name: string; code: string }[];
  stockByWarehouse: Record<string, Record<string, number>>;
  initialData?: SerahTerimaBarangInitialData;
  readOnly?: boolean;
  currentUserName?: string;
  company?: SerahTerimaBarangPrintableData["company"];
}> = ({ salesOptions, warehouses, products, stockByWarehouse, initialData, readOnly = false, currentUserName, company = null }) => {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!initialData;

  const [date, setDate] = useState(initialData?.date.slice(0, 10) ?? today());
  const [salesId, setSalesId] = useState(initialData?.salesId ?? salesOptions[0]?.value ?? "");
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId ?? warehouses[0]?.value ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [lines, setLines] = useState<LineState[]>(
    initialData?.items.length
      ? initialData.items.map((i) => ({
          id: ++lineSeq,
          productId: i.productId,
          productCode: i.productCode,
          productName: i.productName,
          qty: i.qty,
          qtyFisik: i.qtyFisik,
          alasanSelisih: i.alasanSelisih,
        }))
      : [blankLine()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cols = 2; // Kode Produk, Qty

  useFokusAwal(formRef, !readOnly);

  const stockHere = stockByWarehouse[warehouseId] ?? {};
  const productOptions = products
    .filter((p) => (stockHere[p.id] ?? 0) >= 1)
    .map((p) => ({ id: p.id, name: p.name, code: p.code, stock: stockHere[p.id] ?? 0 }));

  const requestedByProduct = lines.reduce<Record<string, number>>((acc, l) => {
    if (l.productId && l.qty > 0) acc[l.productId] = (acc[l.productId] ?? 0) + l.qty;
    return acc;
  }, {});
  const filledCount = lines.filter((l) => l.productId).length;
  const totalQty = lines.reduce((sum, l) => sum + (l.productId ? l.qty : 0), 0);
  const tampilkanQtyFisik = isEdit && initialData!.status === "DIKONFIRMASI";

  const printableData: SerahTerimaBarangPrintableData = {
    stbNumber: initialData?.stbNumber ?? null,
    date,
    status: initialData?.status ?? null,
    salesName: salesOptions.find((s) => s.value === salesId)?.label ?? "",
    warehouseName: warehouses.find((w) => w.value === warehouseId)?.label ?? "",
    notes,
    lines: lines.filter((l) => l.productId).map((l) => ({ productCode: l.productCode, productName: l.productName, qty: l.qty })),
    dibuatOleh: initialData?.creatorName || currentUserName || null,
    company,
  };

  const gagalkan = (pesan: string) => toast.error(pesan);

  const updateLine = (id: number, patch: Partial<LineState>) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const focusCell = useCallback((row: number, col: number) => {
    const target = gridRef.current?.querySelector<HTMLInputElement>(`[data-cell="${row}-${col}"]`);
    target?.focus();
  }, []);

  const keluarDariTabel = () => {
    const tabel = gridRef.current;
    if (!tabel) return;
    const wadah = tabel.closest("form, [data-isian-form]") ?? document.body;
    const berikutnya = Array.from(wadah.querySelectorAll<HTMLElement>('input,select,textarea,button[role="combobox"]')).find(
      (el) =>
        !(el as HTMLInputElement).disabled &&
        el.tabIndex !== -1 &&
        el.offsetParent !== null &&
        !tabel.contains(el) &&
        (tabel.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    );
    berikutnya?.focus();
    if (berikutnya instanceof HTMLInputElement) berikutnya.select();
  };

  const advance = (rowIndex: number, colIndex: number, productIdBaru?: string) => {
    const current = lines[rowIndex];
    const isLastRow = rowIndex === lines.length - 1;
    const productId = productIdBaru || current?.productId;

    if (isLastRow && !productId) {
      keluarDariTabel();
      return;
    }
    if (colIndex < cols - 1) {
      focusCell(rowIndex, colIndex + 1);
      return;
    }
    if (isLastRow) setLines((prev) => [...prev, blankLine()]);
    requestAnimationFrame(() => focusCell(rowIndex + 1, 0));
  };

  const removeLine = (id: number) => {
    setLines((prev) => {
      const next = prev.filter((l) => l.id !== id);
      return next.length ? next : [blankLine()];
    });
  };

  const cellProps = (row: number, col: number, id: number) => ({
    "data-cell": `${row}-${col}`,
    disabled: readOnly,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key.toLowerCase() === "d" && e.ctrlKey) {
        e.preventDefault();
        removeLine(id);
        requestAnimationFrame(() => focusCell(Math.max(0, row - 1), 0));
        return;
      }
      if (e.key === "Tab" && e.shiftKey) {
        if (col > 0) {
          e.preventDefault();
          focusCell(row, col - 1);
        } else if (row > 0) {
          e.preventDefault();
          focusCell(row - 1, cols - 1);
        }
      }
    },
  });

  const pickProduct = (id: number, productId: string) => {
    const product = productOptions.find((p) => p.id === productId);
    if (!product) return;
    updateLine(id, { productId, productCode: product.code, productName: product.name });
  };

  const validate = (): { productId: string; qty: number }[] | null => {
    if (!salesId || !warehouseId) {
      gagalkan("Sales dan gudang asal wajib dipilih");
      return null;
    }
    const validLines = lines.filter((l) => l.productId && l.qty > 0).map((l) => ({ productId: l.productId, qty: l.qty }));
    if (validLines.length === 0) {
      gagalkan("Minimal 1 baris item (produk, qty) wajib diisi lengkap");
      return null;
    }
    const overflow = Object.entries(requestedByProduct).find(([pid, qty]) => qty > (stockHere[pid] ?? 0));
    if (overflow) {
      gagalkan("Ada qty yang melebihi stok gudang — periksa lagi baris item");
      return null;
    }
    return validLines;
  };

  const requestSave = () => {
    if (validate()) setConfirmSave(true);
  };

  const submit = async () => {
    const validLines = validate();
    if (!validLines) {
      setConfirmSave(false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/serah-terima-barang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, salesId, warehouseId, notes: notes || undefined, items: validLines }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        gagalkan(data?.error || "Gagal menyimpan Serah Terima Barang");
        return;
      }
      toast.success(`STB ${data.serahTerimaBarang.stbNumber} dibuat`);
      router.push(`/pembelian/serah-terima-barang/${data.serahTerimaBarang.id}`);
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

  if (!readOnly && salesOptions.length === 0) {
    return <Alert variant="warning">Belum ada user dengan role Sales. Tambahkan dulu lewat Pengaturan &gt; Manajemen Pengguna.</Alert>;
  }

  return (
    <div ref={formRef} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <DatePicker
          label="Tanggal"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
          disabled={readOnly}
        />
        <div data-fokus-awal>
          <Select
            label="Sales"
            options={salesOptions}
            value={salesId}
            onChange={setSalesId}
            sizeVariant="sm"
            className={COMPACT_FIELD}
            labelClassName={COMPACT_LABEL}
            disabled={readOnly}
          />
        </div>
        <Select
          label="Gudang Asal"
          options={warehouses}
          value={warehouseId}
          // Select buka/pilih dropdown-nya sendiri lewat Enter (Select.tsx: handleTriggerKeyDown
          // buka, handleListKeyDown pilih+tutup) — begitu gudang BENERAN kepilih (Enter maupun
          // klik), baru lompat ke Kode baris pertama. JANGAN pasang onKeyDownCapture custom di
          // sini, itu kepasang di fase capture SEBELUM handler internal Select sempat jalan
          // (pernah jadi bug di PurchaseOrderForm — Enter di trigger yang masih tertutup malah
          // langsung lompat tanpa pernah buka dropdown-nya).
          onChange={(value) => {
            setWarehouseId(value);
            requestAnimationFrame(() => focusCell(0, 0));
          }}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
          disabled={readOnly}
        />
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-sm font-bold text-slate-700 dark:text-fg">Baris Item</p>
          {!readOnly && (
            <span className="text-xs text-slate-500 dark:text-fg-muted">— ketik kode/nama produk lalu tekan Enter, baris berikutnya muncul sendiri</span>
          )}
        </div>

        <div ref={gridRef} className="rounded-xl bg-slate-50/70 dark:bg-surface-hover/40 border border-slate-200/80 dark:border-line p-2.5 sm:p-3">
          <TableContainer className="bg-transparent! border-0! shadow-none! rounded-none!">
            <Table>
              <TableHeader className="bg-transparent!">
                <TableRow>
                  <TableHead className="w-10 px-2.5! py-2! text-[11px]!">No.</TableHead>
                  <TableHead className="w-64 px-2.5! py-2! text-[11px]!">Kode</TableHead>
                  <TableHead className="min-w-36 px-2.5! py-2! text-[11px]!">Nama Produk</TableHead>
                  <TableHead className="w-24 px-2.5! py-2! text-[11px]!">{tampilkanQtyFisik ? "Qty Rencana" : "Qty"}</TableHead>
                  {tampilkanQtyFisik && <TableHead className="w-24 px-2.5! py-2! text-[11px]!">Qty Fisik</TableHead>}
                  <TableHead className="w-10 px-2.5! py-2!" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => {
                  const stock = stockHere[line.productId] ?? 0;
                  const qtyExceeds = !!line.productId && requestedByProduct[line.productId] > stock;
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="px-2.5! py-1.5! text-xs">{index + 1}</TableCell>
                      <TableCell className="px-2.5! py-1.5!">
                        <ProductCodeInput
                          value={line.productCode}
                          products={productOptions}
                          onPick={(productId) => pickProduct(line.id, productId)}
                          onAdvance={(productIdBaru) => advance(index, 0, productIdBaru)}
                          renderSuggestionExtra={(p) => `stok ${p.stock}`}
                          inputProps={cellProps(index, 0, line.id)}
                        />
                      </TableCell>
                      <TableCell className="px-2.5! py-1.5! text-xs text-slate-600 dark:text-fg-muted">
                        {line.productName || "—"}
                        {line.alasanSelisih && <span className="block text-[11px] text-rose-500 dark:text-rose-400">{line.alasanSelisih}</span>}
                      </TableCell>
                      <TableCell className="px-2.5! py-1.5!">
                        <NumberCell
                          value={line.qty}
                          onChange={(qty) => updateLine(line.id, { qty })}
                          onAdvance={() => advance(index, 1)}
                          error={qtyExceeds}
                          inputProps={cellProps(index, 1, line.id)}
                        />
                      </TableCell>
                      {tampilkanQtyFisik && (
                        <TableCell
                          className={`px-2.5! py-1.5! text-xs font-semibold ${
                            line.qtyFisik == null
                              ? "text-slate-400 dark:text-fg-muted"
                              : line.qtyFisik === line.qty
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                          }`}
                          title="Read-only — diisi Sales lewat Android"
                        >
                          {line.qtyFisik ?? "—"}
                        </TableCell>
                      )}
                      <TableCell className="px-2.5! py-1.5!">
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          disabled={readOnly}
                          tabIndex={-1}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-30 disabled:pointer-events-none"
                          aria-label="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mt-2.5 gap-2.5">
            <p className="text-[11px] text-slate-500 dark:text-fg-muted">
              {readOnly
                ? "Ctrl+P untuk pratinjau/cetak dokumen ini."
                : "Produk yang stoknya 0 di gudang ini tidak muncul di saran. Ctrl+D menghapus baris yang sedang fokus."}
            </p>
            <div className="w-full max-w-xs rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-line space-y-1 p-2.5 text-xs">
              <div className="flex justify-between">
                <span>Jumlah Baris</span>
                <span className="font-bold">{filledCount}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-line pt-1">
                <span className="font-bold">Total Qty</span>
                <strong className="text-[#0544cc] dark:text-blue-400">{totalQty}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Input
        label="Catatan (opsional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        sizeVariant="sm"
        className={COMPACT_FIELD}
        labelClassName={COMPACT_LABEL}
        placeholder="Keterangan tambahan"
        disabled={readOnly}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !readOnly) {
            e.preventDefault();
            requestSave();
          }
        }}
      />

      <div className="flex items-center justify-between flex-wrap gap-3 border-t border-slate-200/60 dark:border-line pt-4">
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-fg-muted uppercase">Total Qty</p>
          <p className="text-xl font-black text-[#0544cc] dark:text-blue-400">{totalQty}</p>
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
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-[#0544cc] hover:bg-[#043aa8] text-white font-semibold text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{submitting ? "Memproses..." : "Simpan Serah Terima"}</span>
              <span className="text-[9px] font-mono opacity-80 font-normal">(Ctrl+S)</span>
            </button>
          )}
        </div>
      </div>

      <DocumentPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Preview Serah Terima Barang"
        docNumber={printableData.stbNumber}
        renderDocument={() => <SerahTerimaBarangPrintable data={printableData} />}
      />

      {/* Salinan tersembunyi (`.print-only`, lihat globals.css) buat "Cetak Dokumen" beneran. */}
      <SerahTerimaBarangPrintable data={printableData} className="print-only" />

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
              <span className="text-lg font-black text-slate-800 dark:text-fg">Simpan Serah Terima Barang?</span>
            </div>
          }
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="secondary" onClick={() => setConfirmSave(false)} disabled={submitting}>
                Periksa Lagi
              </Button>
              <Button variant="primary" leftIcon={<Check className="w-3.5 h-3.5" />} onClick={submit} isLoading={submitting}>
                Ya, Simpan
              </Button>
            </div>
          }
        >
          <RincianKonfirmasi
            catatan={
              <>
                Stok belum berpindah — Sales harus <strong className="font-semibold">konfirmasi lewat Android</strong> dulu. Kalau ditolak, stok tetap di
                gudang.
              </>
            }
            akibat={[
              { label: `Baris item — ${filledCount} jenis barang`, nilai: `${totalQty} unit` },
              { label: "Diserahkan ke Sales", nilai: salesOptions.find((s) => s.value === salesId)?.label ?? "-" },
              { label: "Dari gudang", nilai: warehouses.find((w) => w.value === warehouseId)?.label ?? "-" },
              { label: "Status berubah jadi", nilai: "Menunggu Konfirmasi", redup: true },
            ]}
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
