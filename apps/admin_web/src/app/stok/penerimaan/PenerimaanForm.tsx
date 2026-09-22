"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, History, Printer, Save, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useHotkey } from "@/hooks/useHotkey";
import { useFokusAwal } from "@/hooks/useFokusAwal";
import { api, ApiError, type Product, type StockReceipt } from "@/lib/api-client";
import { PenerimaanNotaPreviewModal } from "./PenerimaanNotaPreviewModal";
import { PenerimaanLivePreview } from "./PenerimaanLivePreview";

const COMPACT_FIELD = "!text-xs !h-8.5 !min-h-[34px] !rounded-lg !bg-white dark:!bg-surface shadow-2xs";
const COMPACT_LABEL = "text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none";
const TANPA_KATEGORI = "Tanpa Kategori";

function hariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface BarisProduk {
  productId: string;
  sku: string;
  name: string;
}

/// Form Tambah Stok Gudang — SATU komponen untuk tiga keadaan:
///   1. Baru (tanpa `initial`) — tabel kosong (qty 0 di semua baris), dua
///      tombol (Simpan Draft / Posting) SAMA-SAMA memanggil `POST
///      /stock-receipts`, cuma beda `status` tujuan.
///   2. Draft tersimpan (`initial.status === "DRAFT"`) — tabel terisi
///      qty yang sudah tersimpan, PATCH untuk Simpan Draft, endpoint /post
///      untuk Posting.
///   3. Posted/Revised (`initial.status !== "DRAFT"`) — seluruhnya
///      read-only, tombol Revisi menggantikan Simpan/Posting.
///
/// Tabel SELALU berisi baris untuk SEMUA produk aktif (bukan grid dinamis
/// tambah-baris) — pola diambil dari OpnameForm.tsx jsBerkah, bukan dari
/// SerahTerimaBarangForm.tsx yang menambah baris satu-satu (lihat
/// example_jsberkah/opname/README.md untuk perbandingannya).
export function PenerimaanForm({
  products,
  initial,
}: {
  products: Product[];
  initial?: StockReceipt;
}) {
  const router = useRouter();
  const toast = useToast();
  const readOnly = !!initial && initial.status !== "DRAFT";

  const [receiptDate, setReceiptDate] = useState(initial?.receiptDate.slice(0, 10) ?? hariIni());
  const [note, setNote] = useState(initial?.note ?? "");
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const awal: Record<string, number> = {};
    for (const item of initial?.items ?? []) awal[item.productId] = item.qtyReceived;
    return awal;
  });
  const [simpanDraft, setSimpanDraft] = useState(false);
  const [posting, setPosting] = useState(false);
  const [merevisi, setMerevisi] = useState(false);
  /// Dialog konfirmasi SEBELUM aksi benar-benar dijalankan — terutama untuk
  /// Posting, yang mengubah stok Gudang dan tidak bisa diedit langsung lagi
  /// setelahnya. Tombol Simpan/Posting cuma MEMBUKA dialog ini; aksi
  /// sungguhan (simpanSebagaiDraft/lakukanPosting) baru jalan saat tombol
  /// konfirmasi di dalam dialog ditekan.
  const [konfirmasi, setKonfirmasi] = useState<"draft" | "posting" | null>(null);
  const [showNota, setShowNota] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  useFokusAwal(formRef, !readOnly);

  /// Baris tabel: SEMUA produk aktif, dikelompokkan per kategori (abjad,
  /// "Tanpa Kategori" selalu terakhir) — pola sama seperti Tab Main & Tab
  /// Mutasi Stok → Rekap di halaman Produk, supaya tiga tempat ini terasa
  /// satu sistem.
  const kelompok = useMemo(() => {
    const perKategori = new Map<string, BarisProduk[]>();
    for (const p of products) {
      if (!p.active) continue;
      const kunci = p.category ?? TANPA_KATEGORI;
      if (!perKategori.has(kunci)) perKategori.set(kunci, []);
      perKategori.get(kunci)!.push({ productId: p.id, sku: p.sku, name: p.name });
    }
    for (const rows of perKategori.values()) rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
    return Array.from(perKategori.entries())
      .map(([nama, rows]) => ({ nama, rows }))
      .sort((a, b) => {
        if (a.nama === TANPA_KATEGORI) return 1;
        if (b.nama === TANPA_KATEGORI) return -1;
        return a.nama.localeCompare(b.nama, "id");
      });
  }, [products]);

  /// Urutan VISUAL baris (lintas kelompok kategori) — inilah yang dipakai
  /// keyboard cascade, supaya Enter di baris terakhir satu kategori lanjut
  /// mulus ke baris pertama kategori berikutnya, bukan berhenti per kelompok.
  const urutanBaris = useMemo(() => kelompok.flatMap((k) => k.rows), [kelompok]);

  const totalBaris = urutanBaris.filter((b) => (qty[b.productId] ?? 0) > 0).length;
  const totalQty = Object.values(qty).reduce((s, n) => s + (n || 0), 0);

  /// Hanya baris yang Qty Terima-nya sudah diisi — pratinjau menunjukkan APA
  /// YANG AKAN TERSIMPAN, bukan seluruh daftar produk seperti tabel input.
  const kelompokTerisi = useMemo(
    () =>
      kelompok
        .map((k) => ({ nama: k.nama, rows: k.rows.filter((b) => (qty[b.productId] ?? 0) > 0).map((b) => ({ sku: b.sku, name: b.name, qty: qty[b.productId] })) }))
        .filter((k) => k.rows.length > 0),
    [kelompok, qty],
  );

  function focusBaris(index: number) {
    if (index < 0 || index >= urutanBaris.length) {
      keluarDariTabel();
      return;
    }
    const target = gridRef.current?.querySelector<HTMLInputElement>(`[data-row="${index}"]`);
    target?.focus();
    target?.select();
  }

  /// Baris terakhir ditekan Enter → lompat ke elemen fokusable berikutnya
  /// SETELAH tabel (tombol Simpan/Posting), bukan berhenti diam.
  ///
  /// `!tabel.contains(el)` WAJIB ada — `compareDocumentPosition` menandai
  /// keturunan (baris-baris di DALAM tabel) sebagai "FOLLOWING" juga per
  /// spesifikasi DOM, bukan cuma elemen yang datang setelahnya di luar
  /// tabel. Tanpa pengecualian ini, pencarian menemukan balik baris PERTAMA
  /// tabel (elemen "following" pertama yang cocok), sehingga Enter di baris
  /// terakhir terasa "loncat balik ke atas" alih-alih keluar ke tombol.
  function keluarDariTabel() {
    const tabel = gridRef.current;
    if (!tabel) return;
    const wadah = tabel.closest("[data-isian-form]") ?? document.body;
    const berikutnya = Array.from(
      wadah.querySelectorAll<HTMLElement>('input:not([type="hidden"]),button'),
    ).find(
      (el) =>
        !(el as HTMLInputElement).disabled &&
        el.tabIndex !== -1 &&
        el.offsetParent !== null &&
        !tabel.contains(el) &&
        (tabel.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    );
    berikutnya?.focus();
  }

  function setQtyBaris(productId: string, nilai: number) {
    setQty((prev) => ({ ...prev, [productId]: Math.max(0, nilai) }));
  }

  function payloadItems() {
    return urutanBaris
      .map((b) => ({ productId: b.productId, qtyReceived: qty[b.productId] ?? 0 }))
      .filter((i) => i.qtyReceived > 0);
  }

  async function simpanSebagaiDraft() {
    setSimpanDraft(true);
    try {
      if (initial) {
        await api.updateStockReceipt(initial.id, { receiptDate, note: note || undefined, items: payloadItems() });
        toast.success("Draft diperbarui.");
        router.refresh();
      } else {
        const dibuat = await api.createStockReceipt({
          idempotencyKey: idempotencyKey.current,
          receiptDate,
          note: note || undefined,
          status: "DRAFT",
          items: payloadItems(),
        });
        toast.success(`Draft ${dibuat.receiptNo} disimpan.`);
        router.push(`/stok/penerimaan/${dibuat.id}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan draft.");
    } finally {
      setSimpanDraft(false);
    }
  }

  async function lakukanPosting() {
    if (totalBaris === 0) {
      toast.error("Isi minimal satu baris Qty Terima sebelum Posting.");
      return;
    }
    setPosting(true);
    try {
      if (initial) {
        // Draft yang sudah tersimpan mungkin baru saja diubah — simpan dulu
        // angka terbaru, baru posting, supaya tidak ada perubahan yang
        // ketinggalan di layar tapi belum sempat tersimpan.
        await api.updateStockReceipt(initial.id, { receiptDate, note: note || undefined, items: payloadItems() });
        await api.postStockReceipt(initial.id);
        toast.success(`${initial.receiptNo} diposting — stok Gudang bertambah.`);
        router.push(`/stok/penerimaan/${initial.id}`);
        router.refresh();
      } else {
        const dibuat = await api.createStockReceipt({
          idempotencyKey: idempotencyKey.current,
          receiptDate,
          note: note || undefined,
          status: "POSTED",
          items: payloadItems(),
        });
        toast.success(`${dibuat.receiptNo} diposting — stok Gudang bertambah.`);
        router.push(`/stok/penerimaan/${dibuat.id}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memposting dokumen.");
    } finally {
      setPosting(false);
    }
  }

  async function mulaiRevisi() {
    if (!initial) return;
    setMerevisi(true);
    try {
      const revisi = await api.reviseStockReceipt(initial.id);
      toast.success(`Revisi ${revisi.receiptNo} dibuat — lanjutkan mengubah angkanya.`);
      router.push(`/stok/penerimaan/${revisi.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memulai revisi.");
    } finally {
      setMerevisi(false);
    }
  }

  useHotkey({ key: "p", ctrl: true, allowInEditable: true }, () => !readOnly && setShowLivePreview(true));
  useHotkey({ key: "s", ctrl: true, allowInEditable: true }, () => !readOnly && !posting && setKonfirmasi("draft"));
  useHotkey({ key: "Enter", ctrl: true, allowInEditable: true }, () => {
    if (readOnly || simpanDraft) return;
    if (totalBaris === 0) {
      toast.error("Isi minimal satu baris Qty Terima sebelum Posting.");
      return;
    }
    setKonfirmasi("posting");
  });

  return (
    <div ref={formRef} data-isian-form className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <DatePicker
          label="Tanggal"
          value={receiptDate}
          onChange={(e) => setReceiptDate(e.target.value)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
          disabled={readOnly}
        />

        <Input
          label="Keterangan (opsional)"
          data-fokus-awal
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="mis. kiriman dari CV Kopi Jaya"
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
          disabled={readOnly}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !readOnly) {
              e.preventDefault();
              focusBaris(0);
            }
          }}
        />

        <div className="w-full flex flex-col gap-1.5">
          <span className={COMPACT_LABEL}>No. Bukti</span>
          <div className="h-8.5 min-h-[34px] px-3 rounded-lg border border-dashed border-slate-300/90 dark:border-line bg-slate-50/70 dark:bg-surface-hover/40 flex items-center">
            {initial ? (
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-fg-secondary">{initial.receiptNo}</span>
            ) : (
              <span className="text-xs italic text-slate-400 dark:text-fg-muted">Otomatis saat disimpan</span>
            )}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-sm font-bold text-slate-700 dark:text-fg">Qty Terima per Produk</p>
          {!readOnly && (
            <span className="text-xs text-slate-500 dark:text-fg-muted">
              — isi Qty Terima, Enter turun ke baris berikutnya
            </span>
          )}
        </div>

        <div
          ref={gridRef}
          className="rounded-xl bg-slate-50/70 dark:bg-surface-hover/40 border border-slate-200/80 dark:border-line p-2.5 sm:p-3"
        >
          <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-line bg-white dark:bg-surface">
            <table className="w-full text-xs">
              <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <tr>
                  <th className="w-10 py-2.5 px-3 text-center">No.</th>
                  <th className="py-2.5 px-3 text-left">Kode</th>
                  <th className="py-2.5 px-3 text-left">Nama Produk</th>
                  <th className="py-2.5 px-3 text-right w-32">Qty Terima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line">
                {kelompok.map((k) => (
                  <RenderKelompokBaris
                    key={k.nama}
                    nama={k.nama}
                    rows={k.rows}
                    urutanBaris={urutanBaris}
                    qty={qty}
                    setQtyBaris={setQtyBaris}
                    focusBaris={focusBaris}
                    readOnly={readOnly}
                  />
                ))}
                {urutanBaris.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-slate-500 dark:text-fg-muted py-8 text-xs">
                      Belum ada produk aktif.
                    </td>
                  </tr>
                )}
              </tbody>
              {urutanBaris.length > 0 && (
                <tfoot className="bg-slate-50/80 dark:bg-surface-hover border-t-2 border-slate-200 dark:border-line">
                  <tr className="text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                    <td colSpan={3} className="py-2.5 px-3 uppercase tracking-wide">
                      Total · {totalBaris} produk
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-900 dark:text-fg">{totalQty}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {!readOnly && (
            <p className="text-[11px] text-slate-500 dark:text-fg-muted mt-2.5">
              Baris dengan Qty Terima 0 tidak ikut tersimpan sebagai item dokumen.
            </p>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface p-4 text-xs text-slate-600 dark:text-fg-muted space-y-1">
          <p>
            Diposting oleh <strong className="text-slate-800 dark:text-fg">{initial?.postedBy?.fullName ?? "-"}</strong>{" "}
            pada {initial?.postedAt ? new Date(initial.postedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-"}.
          </p>
          {initial?.status === "REVISED" && (
            <p className="text-amber-600 dark:text-amber-400 font-semibold">
              Dokumen ini sudah digantikan oleh versi revisi yang lebih baru — angkanya di atas bukan lagi yang
              berlaku.
            </p>
          )}
        </div>
      )}

      <div className="border-t border-slate-200/60 dark:border-line pt-4 space-y-2.5">
        {!readOnly && (
          <p className="text-[11px] text-slate-500 dark:text-fg-muted">
            Enter di Keterangan lompat ke baris pertama tabel, Enter di tiap baris turun ke baris berikutnya ·
            Ctrl+P Pratinjau · Ctrl+S Simpan Draft · Ctrl+Enter Posting
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push("/stok/penerimaan")}
            className="px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-line bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg font-medium text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>{readOnly ? "Kembali" : "Batal"}</span>
          </button>

          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowLivePreview(true)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-line bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg font-semibold text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Pratinjau</span>
              <span className="text-[9px] font-mono opacity-80 font-normal">(Ctrl+P)</span>
            </button>
          )}

          {readOnly && (initial?.status === "POSTED" || initial?.status === "REVISED") && (
            <button
              type="button"
              onClick={() => setShowNota(true)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-line bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg font-semibold text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Nota</span>
            </button>
          )}

          {readOnly && initial?.status === "POSTED" && (
            <button
              type="button"
              onClick={mulaiRevisi}
              disabled={merevisi}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
            >
              <History className="w-3.5 h-3.5" />
              <span>{merevisi ? "Menyiapkan..." : "Revisi"}</span>
            </button>
          )}

          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => setKonfirmasi("draft")}
                disabled={simpanDraft || posting}
                className="px-3.5 py-1.5 rounded-lg border border-[var(--brand-700)] bg-white dark:bg-surface hover:bg-brand-50 dark:hover:bg-brand-950/30 text-[var(--brand-700)] dark:text-brand-400 font-semibold text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{simpanDraft ? "Menyimpan..." : "Simpan (Draft)"}</span>
                <span className="text-[9px] font-mono opacity-80 font-normal">(Ctrl+S)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (totalBaris === 0) {
                    toast.error("Isi minimal satu baris Qty Terima sebelum Posting.");
                    return;
                  }
                  setKonfirmasi("posting");
                }}
                disabled={simpanDraft || posting}
                className="px-4 py-1.5 rounded-lg bg-[var(--brand-700)] hover:bg-[var(--brand-800)] text-white font-semibold text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{posting ? "Memposting..." : "Posting"}</span>
                <span className="text-[9px] font-mono opacity-80 font-normal">(Ctrl+Enter)</span>
              </button>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={konfirmasi !== null}
        onClose={() => setKonfirmasi(null)}
        title={konfirmasi === "posting" ? "Posting Tambah Stok Gudang?" : "Simpan sebagai Draft?"}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setKonfirmasi(null)} disabled={simpanDraft || posting}>
              Periksa Lagi
            </Button>
            <Button
              variant={konfirmasi === "posting" ? "primary" : "outline"}
              leftIcon={<Check className="w-3.5 h-3.5" />}
              isLoading={konfirmasi === "posting" ? posting : simpanDraft}
              onClick={async () => {
                if (konfirmasi === "posting") await lakukanPosting();
                else await simpanSebagaiDraft();
                setKonfirmasi(null);
              }}
            >
              {konfirmasi === "posting" ? "Ya, Posting" : "Ya, Simpan"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="leading-relaxed text-slate-600 dark:text-fg-secondary">
            {konfirmasi === "posting" ? (
              <>
                Stok Gudang akan <strong className="font-semibold">bertambah sesuai angka di bawah</strong> dan
                tercatat di Mutasi Stok. Dokumen yang sudah Posted tidak bisa diedit langsung lagi — koreksi
                lewat tombol Revisi.
              </>
            ) : (
              <>Disimpan sebagai Draft — stok Gudang belum berubah sampai dokumen ini diposting.</>
            )}
          </p>
          <div className="rounded-xl border border-slate-200/80 dark:border-line overflow-hidden">
            <p className="px-3 py-1.5 bg-slate-50/80 dark:bg-surface-hover text-[11px] font-bold text-slate-600 dark:text-fg-muted uppercase tracking-wider">
              Yang akan tersimpan
            </p>
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-fg-secondary">
                <span>Jumlah baris terisi</span>
                <span className="tabular-nums font-semibold">{totalBaris} produk</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-fg-secondary">
                <span>Total Qty</span>
                <span className="tabular-nums font-semibold">{totalQty}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-fg-muted">
                <span>Tanggal</span>
                <span className="tabular-nums font-semibold">{receiptDate}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {initial && (
        <PenerimaanNotaPreviewModal
          isOpen={showNota}
          onClose={() => setShowNota(false)}
          receiptId={initial.id}
          receiptNo={initial.receiptNo}
        />
      )}

      <Modal isOpen={showLivePreview} onClose={() => setShowLivePreview(false)} title="Pratinjau Dokumen" size="lg">
        <PenerimaanLivePreview
          receiptNo={initial?.receiptNo ?? null}
          receiptDate={receiptDate}
          note={note}
          groups={kelompokTerisi}
          totalBaris={totalBaris}
          totalQty={totalQty}
        />
      </Modal>
    </div>
  );
}

function RenderKelompokBaris({
  nama,
  rows,
  urutanBaris,
  qty,
  setQtyBaris,
  focusBaris,
  readOnly,
}: {
  nama: string;
  rows: BarisProduk[];
  urutanBaris: BarisProduk[];
  qty: Record<string, number>;
  setQtyBaris: (productId: string, nilai: number) => void;
  focusBaris: (index: number) => void;
  readOnly: boolean;
}) {
  return (
    <>
      <tr className="bg-slate-50 dark:bg-surface-hover/60">
        <td colSpan={4} className="py-1.5 px-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-fg-muted">
            {nama}
          </span>
          <span className="ml-2 text-[10px] font-normal text-slate-400 dark:text-fg-muted">· {rows.length} produk</span>
        </td>
      </tr>
      {rows.map((b) => {
        const index = urutanBaris.findIndex((u) => u.productId === b.productId);
        const nilai = qty[b.productId] ?? 0;
        return (
          <tr key={b.productId} className={nilai > 0 ? "bg-brand-50/30 dark:bg-brand-500/5" : undefined}>
            <td className="py-1.5 px-3 text-center text-slate-400 dark:text-fg-muted">{index + 1}</td>
            <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500 dark:text-fg-muted">{b.sku}</td>
            <td className="py-1.5 px-3 text-slate-800 dark:text-fg font-medium">{b.name}</td>
            <td className="py-1.5 px-3 text-right">
              {readOnly ? (
                <span className={`tabular-nums font-bold ${nilai > 0 ? "text-slate-900 dark:text-fg" : "text-slate-300 dark:text-fg-muted"}`}>
                  {nilai}
                </span>
              ) : (
                <input
                  type="number"
                  min={0}
                  data-row={index}
                  value={nilai === 0 ? "" : nilai}
                  placeholder="0"
                  onChange={(e) => setQtyBaris(b.productId, e.target.value === "" ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      focusBaris(index + 1);
                    }
                  }}
                  className="w-24 h-8 px-2 text-right text-xs font-bold tabular-nums rounded-md border border-slate-200 dark:border-line bg-white dark:bg-surface focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10"
                />
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
