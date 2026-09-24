"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { Check, Eye, Save, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useHotkey } from "@/hooks/useHotkey";
import { useFokusAwal } from "@/hooks/useFokusAwal";
import { api, ApiError, BASE_URL, getToken, type ActiveAssignment, type Product, type WarehouseStockItem } from "@/lib/api-client";
import { SerahTerimaLivePreview } from "./SerahTerimaLivePreview";

const COMPACT_FIELD = "!text-xs !h-8.5 !min-h-8.5 !rounded-lg !bg-white dark:!bg-surface shadow-2xs";
const COMPACT_LABEL = "text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none";
const TANPA_KATEGORI = "Tanpa Kategori";

/// Badge Keterangan Dokumen di form ini cuma bisa jadi "Kirim Stok (Awal)"
/// atau "Kirim Stok (Re-Stok)" (never "Pengajuan dari Petugas" — itu cuma
/// muncul lewat alur pengajuan Petugas, bukan dari form Kirim Stok Admin).
/// Ditebak dari riwayat Booth: kalau Booth ini belum punya kiriman yang
/// sudah Diproses/Diterima SEJAK Petugas ybs Check-In (bukan awal hari
/// kalender — shift Malam yang check-in lewat tengah malam tetap dianggap
/// "Awal" untuk kiriman pertamanya), kiriman berikutnya jadi Awal — meniru
/// logic computeJenisFor di stock-handovers.service.ts.
const KETERANGAN_STOK_AWAL = { label: "Kirim Stok (Awal)", kelas: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" };
const KETERANGAN_RE_STOK = { label: "Kirim Stok (Re-Stok)", kelas: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" };

interface BarisProduk {
  productId: string;
  sku: string;
  name: string;
  minimumQty: number;
  criticalQty: number;
}

/// Warna label "Gudang: N" mengikuti status stok yang sama dengan BR-007
/// (backend/src/common/stock-status.ts) — Habis/Kritis merah, Menipis kuning,
/// Aman hijau — supaya konsisten dengan badge status di halaman lain, cuma
/// dipadatkan jadi 3 warna (tanpa admin_web punya salinan resolveStockStatus
/// sendiri). Tebal (font-bold) kalau masih ada sisa stok sama sekali.
function warnaGudang(gudang: number, minimumQty: number, criticalQty: number): string {
  if (gudang <= 0 || gudang <= criticalQty) return "text-rose-600 dark:text-rose-400";
  if (gudang <= minimumQty) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

/// Form "Kirim Stok" — satu-satunya cara membuat dokumen Serah Terima Stok
/// baru (Admin → Petugas Aktif). Berbeda dari PenerimaanForm.tsx (Tambah
/// Stok Gudang) yang punya 3 keadaan Draft/Posted/Revised: Serah Terima Stok
/// tidak punya Draft — begitu dikirim, langsung berstatus Diproses (StockDistribution
/// SENT) dan koreksinya lewat halaman detail (Batalkan/Revisi), bukan edit
/// ulang di sini. Pola tabel produk (kategori, keyboard cascade, tfoot) &
/// hotkeys tetap mengikuti PenerimaanForm.tsx persis.
export function SerahTerimaForm({ products, prefillBoothId }: { products: Product[]; prefillBoothId?: string }) {
  const router = useRouter();
  const toast = useToast();

  const [assignments, setAssignments] = useState<ActiveAssignment[]>([]);
  const [staffId, setStaffId] = useState("");
  const [note, setNote] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [mengirim, setMengirim] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [gudangQty, setGudangQty] = useState<Record<string, number>>({});
  const [terisiOtomatis, setTerisiOtomatis] = useState(false);
  const [keteranganDokumen, setKeteranganDokumen] = useState<typeof KETERANGAN_STOK_AWAL | null>(null);

  const formRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useFokusAwal(formRef, true);

  useEffect(() => {
    api
      .getActiveAssignments()
      .then(setAssignments)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar Petugas Aktif."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Datang dari tombol "Kirim Stok" di panel Booth Aktif (Kritis/Habis) —
  // begitu Petugas Aktif untuk Booth itu ketemu, pilih otomatis lalu isi Qty
  // Kirim sesuai kekurangan tiap produk yang statusnya Menipis/Kritis/Habis
  // (target: naik sampai pas di ambang Aman == minimumQty).
  useEffect(() => {
    if (!prefillBoothId || terisiOtomatis) return;
    const assignment = assignments.find((a) => a.boothId === prefillBoothId);
    if (!assignment) return;
    setStaffId(assignment.staffId);
    setTerisiOtomatis(true);

    api
      .getBoothStock({ boothId: prefillBoothId })
      .then((rows) => {
        const kekurangan = rows.filter((r) => r.status !== "Aman" && r.minimumQty > r.qtyOnHand);
        if (kekurangan.length === 0) return;
        setQty((prev) => {
          const next = { ...prev };
          for (const r of kekurangan) next[r.productId] = r.minimumQty - r.qtyOnHand;
          return next;
        });
        toast.success(`Qty Kirim terisi otomatis untuk ${kekurangan.length} produk yang Menipis/Kritis/Habis.`);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat Stok Booth untuk auto-isi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillBoothId, assignments, terisiOtomatis]);

  // Label "Gudang: N" di samping tiap baris Qty Kirim — cuma tampil di form
  // ini, bukan disimpan/dikirim. Ambil snapshot awal via REST (fallback kalau
  // socket belum konek), lalu ikuti live lewat WebSocket (backend/src/modules/
  // warehouse-stock/warehouse-stock.gateway.ts, pola sama seperti Booth Aktif)
  // supaya kalau ada Tambah Stok Gudang lain diposting sambil form ini masih
  // terbuka, angkanya ikut ter-update tanpa reload.
  useEffect(() => {
    let batal = false;
    api
      .getWarehouseStock()
      .then((rows) => {
        if (batal) return;
        setGudangQty(Object.fromEntries(rows.map((r) => [r.productId, r.qtyOnHand])));
      })
      .catch(() => {
        // Diam-diam gagal — label cuma bantuan visual, tidak boleh
        // menghalangi form utama kalau REST-nya bermasalah.
      });

    const socket: Socket = io(`${BASE_URL}/warehouse-stock`, { auth: { token: getToken() } });
    socket.on("warehouse-stock:snapshot", (rows: WarehouseStockItem[]) => {
      if (batal) return;
      setGudangQty(Object.fromEntries(rows.map((r) => [r.productId, r.qtyOnHand])));
    });

    return () => {
      batal = true;
      socket.disconnect();
    };
  }, []);

  const selectedAssignment = assignments.find((a) => a.staffId === staffId);
  const selectedBoothId = selectedAssignment?.boothId;
  const selectedOpenedAt = selectedAssignment?.openedAt;

  useEffect(() => {
    if (!selectedBoothId || !selectedOpenedAt) {
      setKeteranganDokumen(null);
      return;
    }
    let batal = false;
    setKeteranganDokumen(null);
    api
      .getStockHandovers({ boothId: selectedBoothId, limit: 10 })
      .then((res) => {
        if (batal) return;
        const bukaSesi = new Date(selectedOpenedAt).getTime();
        const sudahAdaSejakCheckIn = res.rows.some(
          (r) => r.jenis !== null && r.status !== "DIBATALKAN" && new Date(r.date).getTime() >= bukaSesi,
        );
        setKeteranganDokumen(sudahAdaSejakCheckIn ? KETERANGAN_RE_STOK : KETERANGAN_STOK_AWAL);
      })
      .catch(() => {
        if (!batal) setKeteranganDokumen(KETERANGAN_RE_STOK);
      });
    return () => {
      batal = true;
    };
  }, [selectedBoothId, selectedOpenedAt]);

  const kelompok = useMemo(() => {
    const perKategori = new Map<string, BarisProduk[]>();
    for (const p of products) {
      if (!p.active) continue;
      const kunci = p.category ?? TANPA_KATEGORI;
      if (!perKategori.has(kunci)) perKategori.set(kunci, []);
      perKategori.get(kunci)!.push({ productId: p.id, sku: p.sku, name: p.name, minimumQty: p.minimumQty, criticalQty: p.criticalQty });
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

  const urutanBaris = useMemo(() => kelompok.flatMap((k) => k.rows), [kelompok]);
  const totalBaris = urutanBaris.filter((b) => (qty[b.productId] ?? 0) > 0).length;
  const totalQty = Object.values(qty).reduce((s, n) => s + (n || 0), 0);

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

  function validasi(): boolean {
    if (!staffId) {
      toast.warning("Pilih Petugas tujuan terlebih dahulu.");
      return false;
    }
    if (totalBaris === 0) {
      toast.error("Isi minimal satu baris Qty Kirim sebelum mengirim.");
      return false;
    }
    return true;
  }

  async function kirimStok() {
    if (!validasi()) return;
    setMengirim(true);
    try {
      await api.createStockHandover({
        staffId,
        items: urutanBaris
          .map((b) => ({ productId: b.productId, qty: qty[b.productId] ?? 0 }))
          .filter((i) => i.qty > 0),
        note: note || undefined,
      });
      toast.success(`Stok berhasil dikirim ke ${selectedAssignment?.staffName ?? "Petugas"}.`);
      router.push("/serah-terima-stok");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengirim stok.");
    } finally {
      setMengirim(false);
    }
  }

  useHotkey({ key: "p", ctrl: true, allowInEditable: true }, () => setShowLivePreview(true));
  useHotkey({ key: "Enter", ctrl: true, allowInEditable: true }, () => {
    if (mengirim) return;
    if (validasi()) setKonfirmasi(true);
  });

  return (
    <div ref={formRef} data-isian-form className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div data-fokus-awal>
          <Select
            label="Petugas (sedang Aktif)"
            placeholder={assignments.length === 0 ? "Belum ada Petugas Aktif" : "Pilih Petugas"}
            options={assignments.map((a) => ({ value: a.staffId, label: a.staffName }))}
            value={staffId}
            onChange={setStaffId}
            disabled={terisiOtomatis}
            sizeVariant="sm"
            className={COMPACT_FIELD}
            labelClassName={COMPACT_LABEL}
          />
          {terisiOtomatis && (
            <p className="text-[10px] text-slate-400 dark:text-fg-muted mt-1">
              Petugas terkunci karena Booth tujuan sudah ditentukan dari panel Booth Aktif.
            </p>
          )}
        </div>

        <div className="w-full flex flex-col gap-1.5">
          <span className={COMPACT_LABEL}>Booth Tujuan</span>
          <div className="h-8.5 min-h-8.5 px-3 rounded-lg border border-dashed border-slate-300/90 dark:border-line bg-slate-50/70 dark:bg-surface-hover/40 flex items-center">
            {selectedAssignment ? (
              <span className="text-xs font-bold text-slate-700 dark:text-fg-secondary">{selectedAssignment.boothName}</span>
            ) : (
              <span className="text-xs italic text-slate-400 dark:text-fg-muted">Ikut Petugas yang dipilih</span>
            )}
          </div>
        </div>

        <div className="w-full flex flex-col gap-1.5">
          <span className={COMPACT_LABEL}>No. Dokumen</span>
          <div className="h-8.5 min-h-8.5 px-3 rounded-lg border border-dashed border-slate-300/90 dark:border-line bg-slate-50/70 dark:bg-surface-hover/40 flex items-center">
            <span className="text-xs italic text-slate-400 dark:text-fg-muted">Otomatis saat dikirim</span>
          </div>
        </div>
      </div>

      {terisiOtomatis && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200/80 dark:border-amber-900/40 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          Qty Kirim terisi otomatis sesuai produk yang Menipis/Kritis/Habis di Booth ini — cek ulang sebelum Kirim.
        </div>
      )}

      {keteranganDokumen && (
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200/80 dark:border-line bg-slate-50/70 dark:bg-surface-hover/40 text-[11px]">
          <span className="font-bold text-slate-500 dark:text-fg-muted uppercase tracking-wide">Keterangan Dokumen:</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold border ${keteranganDokumen.kelas}`}>
            {keteranganDokumen.label}
          </span>
          <span className="text-slate-400 dark:text-fg-muted font-medium">
            — otomatis ditentukan sistem sesuai riwayat Booth.
          </span>
        </div>
      )}

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (opsional)..."
        className={`w-full px-3 rounded-lg border border-slate-200/90 dark:border-line text-xs font-medium text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-(--brand-700) focus:ring-2 focus:ring-(--brand-700)/10 ${COMPACT_FIELD}`}
      />

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <p className="text-sm font-bold text-slate-700 dark:text-fg">Qty Kirim per Produk</p>
          <span className="text-xs text-slate-500 dark:text-fg-muted">— isi Qty Kirim, Enter turun ke baris berikutnya</span>
        </div>

        <div ref={gridRef} className="rounded-xl bg-slate-50/70 dark:bg-surface-hover/40 border border-slate-200/80 dark:border-line p-2.5 sm:p-3">
          <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-line bg-white dark:bg-surface">
            <table className="w-full text-xs">
              <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <tr>
                  <th className="w-10 py-2.5 px-3 text-center">No.</th>
                  <th className="py-2.5 px-3 text-left">Kode</th>
                  <th className="py-2.5 px-3 text-left">Nama Produk</th>
                  <th className="py-2.5 px-3 text-right w-48">Qty Kirim</th>
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
                    gudangQty={gudangQty}
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

          <p className="text-[11px] text-slate-500 dark:text-fg-muted mt-2.5">
            Baris dengan Qty Kirim 0 tidak ikut terkirim.
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200/60 dark:border-line pt-4 space-y-2.5">
        <p className="text-[11px] text-slate-500 dark:text-fg-muted">
          Enter di tiap baris turun ke baris berikutnya · Ctrl+P Pratinjau · Ctrl+Enter Kirim
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push("/serah-terima-stok")}
            className="px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-line bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg font-medium text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Batal</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLivePreview(true)}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-line bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg font-semibold text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Pratinjau</span>
            <span className="text-[9px] font-mono opacity-80 font-normal">(Ctrl+P)</span>
          </button>

          <button
            type="button"
            onClick={() => validasi() && setKonfirmasi(true)}
            disabled={mengirim}
            className="px-4 py-1.5 rounded-lg bg-(--brand-700) hover:bg-(--brand-800) text-white font-semibold text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{mengirim ? "Mengirim..." : "Kirim Stok"}</span>
            <span className="text-[9px] font-mono opacity-80 font-normal">(Ctrl+Enter)</span>
          </button>
        </div>
      </div>

      <Modal
        isOpen={konfirmasi}
        onClose={() => setKonfirmasi(false)}
        title="Kirim Stok ke Petugas?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setKonfirmasi(false)} disabled={mengirim}>
              Periksa Lagi
            </Button>
            <Button
              variant="primary"
              leftIcon={<Check className="w-3.5 h-3.5" />}
              isLoading={mengirim}
              onClick={async () => {
                await kirimStok();
                setKonfirmasi(false);
              }}
            >
              Ya, Kirim
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs">
          <p className="leading-relaxed text-slate-600 dark:text-fg-secondary">
            Stok Gudang akan <strong className="font-semibold">berkurang sesuai angka di bawah</strong> dan tercatat
            berstatus Diproses — Petugas perlu konfirmasi terima sebelum stok Booth bertambah.
          </p>
          <div className="rounded-xl border border-slate-200/80 dark:border-line overflow-hidden">
            <p className="px-3 py-1.5 bg-slate-50/80 dark:bg-surface-hover text-[11px] font-bold text-slate-600 dark:text-fg-muted uppercase tracking-wider">
              Yang akan terkirim
            </p>
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-fg-secondary">
                <span>Petugas</span>
                <span className="font-semibold">{selectedAssignment?.staffName ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-fg-secondary">
                <span>Booth</span>
                <span className="font-semibold">{selectedAssignment?.boothName ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-fg-secondary">
                <span>Jumlah baris terisi</span>
                <span className="tabular-nums font-semibold">{totalBaris} produk</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-700 dark:text-fg-secondary">
                <span>Total Qty</span>
                <span className="tabular-nums font-semibold">{totalQty}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showLivePreview} onClose={() => setShowLivePreview(false)} title="Pratinjau Dokumen" size="lg">
        <SerahTerimaLivePreview
          staffName={selectedAssignment?.staffName ?? null}
          boothName={selectedAssignment?.boothName ?? null}
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
  gudangQty,
}: {
  nama: string;
  rows: BarisProduk[];
  urutanBaris: BarisProduk[];
  qty: Record<string, number>;
  setQtyBaris: (productId: string, nilai: number) => void;
  focusBaris: (index: number) => void;
  gudangQty: Record<string, number>;
}) {
  return (
    <>
      <tr className="bg-slate-50 dark:bg-surface-hover/60">
        <td colSpan={4} className="py-1.5 px-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-fg-muted">{nama}</span>
          <span className="ml-2 text-[10px] font-normal text-slate-400 dark:text-fg-muted">· {rows.length} produk</span>
        </td>
      </tr>
      {rows.map((b) => {
        const index = urutanBaris.findIndex((u) => u.productId === b.productId);
        const nilai = qty[b.productId] ?? 0;
        const gudang = gudangQty[b.productId] ?? 0;
        const kurang = nilai > 0 && nilai > gudang;
        return (
          <tr key={b.productId} className={nilai > 0 ? "bg-brand-50/30 dark:bg-brand-500/5" : undefined}>
            <td className="py-1.5 px-3 text-center text-slate-400 dark:text-fg-muted">{index + 1}</td>
            <td className="py-1.5 px-3 font-mono text-[11px] text-slate-500 dark:text-fg-muted">{b.sku}</td>
            <td className="py-1.5 px-3 text-slate-800 dark:text-fg font-medium">{b.name}</td>
            <td className="py-1.5 px-3 text-right">
              <div className="flex items-center justify-end gap-2">
                <span
                  title="Sisa Stok Gudang saat ini"
                  className={`text-[10px] tabular-nums whitespace-nowrap ${gudang > 0 ? "font-bold" : "font-semibold"} ${
                    kurang ? "text-rose-600 dark:text-rose-400" : warnaGudang(gudang, b.minimumQty, b.criticalQty)
                  }`}
                >
                  Gudang: {gudang}
                </span>
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
                  className={`w-24 h-8 px-2 text-right text-xs font-bold tabular-nums rounded-md border bg-white dark:bg-surface focus:outline-none focus:ring-2 ${
                    kurang
                      ? "border-rose-300 dark:border-rose-900/50 focus:border-rose-500 focus:ring-rose-500/10"
                      : "border-slate-200 dark:border-line focus:border-(--brand-700) focus:ring-(--brand-700)/10"
                  }`}
                />
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}
