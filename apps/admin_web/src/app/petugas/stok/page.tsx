"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Minus,
  Plus,
  Send,
  Package,
  FilePlus2,
  History,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Ban,
  ImageOff,
  Store,
  FileText,
  Bookmark,
  Calendar,
  ArrowUp,
  ArrowDown,
  Equal,
  Download,
  ChevronDown,
} from "lucide-react";
import { api, ApiError, type ActiveShift, type BoothStockRow, type Product, type StockLedgerResponse } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { useHidePetugasNav } from "@/components/layout/PetugasShell";
import { TopBar } from "../_components/TopBar";
import { formatTanggalJakarta, formatJamJakarta } from "../_lib/format";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

const STATUS_STYLE: Record<BoothStockRow["status"], { bg: string; fg: string; bar: string; icon: typeof CheckCircle2 }> = {
  Aman: { bg: "#E8F5E9", fg: GREEN, bar: "#1F9254", icon: CheckCircle2 },
  Menipis: { bg: "#FFF8E1", fg: "#B45309", bar: "#D9A441", icon: AlertTriangle },
  Kritis: { bg: "#FFF3E0", fg: "#C2740C", bar: "#E38A1F", icon: AlertTriangle },
  Habis: { bg: "#FEE2E2", fg: "#D21919", bar: "#D21919", icon: Ban },
};

/// Saran qty Ajukan Restock — dipakai sbg nilai awal stepper per produk
/// (Petugas tetap bisa ubah manual). Rumusnya:
///
///   avgPerJam       = qtyTerjual7Hari ÷ (jamPerShift × 7)
///   prediksiTerjual = avgPerJam × sisaJamShift  (sampai scheduledEndAt shift aktif)
///   saran           = bulat_ke_atas(prediksiTerjual + minimumQty − stokSaatIni), min 0
///
/// Sisa jam shift dihitung dari sekarang, bukan cuma tetap — makin dekat ke
/// akhir shift, prediksi terjualnya makin kecil, jadi saran qty ikut turun.
/// `minimumQty` produk dijadikan buffer aman (bukan cuma pas habis).
function hitungSaranRestock(params: {
  qtyTerjual7Hari: number;
  minimumQty: number;
  stokSaatIni: number;
  sisaJamShift: number;
  jamPerShift: number;
}): number {
  const { qtyTerjual7Hari, minimumQty, stokSaatIni, sisaJamShift, jamPerShift } = params;
  const avgPerJam = jamPerShift > 0 ? qtyTerjual7Hari / (jamPerShift * 7) : 0;
  const prediksiTerjual = avgPerJam * Math.max(0, sisaJamShift);
  return Math.max(0, Math.ceil(prediksiTerjual + minimumQty - stokSaatIni));
}

type Periode = "HARI_INI" | "7_HARI" | "30_HARI" | "BULAN_INI";

const PERIODE_LABEL: Record<Periode, string> = {
  HARI_INI: "Hari Ini",
  "7_HARI": "7 Hari Terakhir",
  "30_HARI": "30 Hari Terakhir",
  BULAN_INI: "Bulan Ini",
};

/// Rentang tanggal utk dropdown "Periode" di Riwayat Stok. Backend
/// (`rinciUntukBooth`) sendiri sudah menormalkan ke granularitas hari,
/// jadi cukup kirim timestamp `from`/`to` apa adanya.
function rentangPeriode(preset: Periode): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  switch (preset) {
    case "HARI_INI":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "30_HARI":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "BULAN_INI":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

type Tab = "STOK" | "RESTOCK" | "RIWAYAT";
type FilterStatus = "SEMUA" | BoothStockRow["status"];

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "SEMUA", label: "Semua Status" },
  { value: "Aman", label: "Aman" },
  { value: "Menipis", label: "Menipis" },
  { value: "Kritis", label: "Kritis" },
  { value: "Habis", label: "Habis" },
];

function StokContent() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("STOK");
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<BoothStockRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [requestQty, setRequestQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [cari, setCari] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("SEMUA");
  const [filterOpen, setFilterOpen] = useState(false);
  const [shift, setShift] = useState<ActiveShift | null>(null);
  const [qtyTerjual7Hari, setQtyTerjual7Hari] = useState<Map<string, number>>(new Map());
  const [saranDihitung, setSaranDihitung] = useState(false);
  const [ledgerProductId, setLedgerProductId] = useState<string | null>(null);
  const [ledgerPeriode, setLedgerPeriode] = useState<Periode>("7_HARI");
  const [ledger, setLedger] = useState<StockLedgerResponse | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [stockRows, productList, active, terlaris] = await Promise.all([
          api.getMyBoothStock(),
          api.getProducts(),
          api.getActiveShift(),
          api.getTerlarisMine().catch(() => []),
        ]);
        setStock(stockRows);
        setProducts(productList.filter((p) => p.active));
        setShift(active);
        setQtyTerjual7Hari(new Map(terlaris.map((t) => [t.productId, t.qty])));
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat stok booth.");
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  /// Nilai awal stepper = saran restock (lihat hitungSaranRestock), TAPI
  /// hanya sekali begitu semua datanya siap — supaya perubahan manual
  /// Petugas di stepper tidak ketiban ulang tiap re-render. Draft
  /// tersimpan (localStorage per Booth) menang atas saran kalau ada.
  useEffect(() => {
    if (saranDihitung || !shift || products.length === 0) return;
    const draftKey = `obbel-petugas-restock-draft-${shift.booth.id}`;
    const draftRaw = typeof window !== "undefined" ? localStorage.getItem(draftKey) : null;
    if (draftRaw) {
      try {
        setRequestQty(JSON.parse(draftRaw));
        setSaranDihitung(true);
        return;
      } catch {
        localStorage.removeItem(draftKey);
      }
    }

    const jamPerShift =
      (new Date(shift.scheduledEndAt).getTime() - new Date(shift.scheduledStartAt).getTime()) / 3_600_000;
    const sisaJamShift = (new Date(shift.scheduledEndAt).getTime() - Date.now()) / 3_600_000;

    const saran: Record<string, number> = {};
    for (const p of products) {
      const stockRow = stock.find((s) => s.productId === p.id);
      saran[p.id] = hitungSaranRestock({
        qtyTerjual7Hari: qtyTerjual7Hari.get(p.id) ?? 0,
        minimumQty: p.minimumQty,
        stokSaatIni: stockRow?.qtyOnHand ?? 0,
        sisaJamShift,
        jamPerShift,
      });
    }
    setRequestQty(saran);
    setSaranDihitung(true);
  }, [saranDihitung, shift, products, stock, qtyTerjual7Hari]);

  // Produk default utk dropdown "Pilih Stok" — begitu daftar produk siap,
  // sekali saja (bukan tiap re-render, biar pilihan manual Petugas tidak
  // ketiban ulang).
  useEffect(() => {
    if (ledgerProductId || products.length === 0) return;
    setLedgerProductId(products[0].id);
  }, [ledgerProductId, products]);

  useEffect(() => {
    if (tab !== "RIWAYAT" || !ledgerProductId) return;
    setLoadingLedger(true);
    const { from, to } = rentangPeriode(ledgerPeriode);
    api
      .getMyStockLedger({ productId: ledgerProductId, from, to })
      .then(setLedger)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat riwayat stok."))
      .finally(() => setLoadingLedger(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ledgerProductId, ledgerPeriode]);

  function handleExportRiwayat() {
    if (!ledger) return;
    const header = "Tanggal/Jam,Jenis Mutasi,Qty,Stok Akhir,Keterangan";
    const baris = ledger.rows.map((r) =>
      [formatTanggalJakarta(r.tanggal), r.jenis, r.qty, r.stokAkhir, `"${r.keterangan.replace(/"/g, '""')}"`].join(","),
    );
    const csv = [header, ...baris].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `riwayat-stok-${ledger.product.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function changeRequestQty(productId: string, delta: number) {
    setRequestQty((prev) => ({ ...prev, [productId]: Math.max(0, (prev[productId] ?? 0) + delta) }));
  }

  const draftKey = shift ? `obbel-petugas-restock-draft-${shift.booth.id}` : null;

  function handlePilihSemua(checked: boolean) {
    if (!checked) {
      setRequestQty({});
      return;
    }
    const jamPerShift = shift
      ? (new Date(shift.scheduledEndAt).getTime() - new Date(shift.scheduledStartAt).getTime()) / 3_600_000
      : 0;
    const sisaJamShift = shift ? (new Date(shift.scheduledEndAt).getTime() - Date.now()) / 3_600_000 : 0;
    const saran: Record<string, number> = {};
    for (const p of products) {
      const stockRow = stock.find((s) => s.productId === p.id);
      saran[p.id] = hitungSaranRestock({
        qtyTerjual7Hari: qtyTerjual7Hari.get(p.id) ?? 0,
        minimumQty: p.minimumQty,
        stokSaatIni: stockRow?.qtyOnHand ?? 0,
        sisaJamShift,
        jamPerShift,
      });
    }
    setRequestQty(saran);
  }

  function handleSimpanDraft() {
    if (!draftKey) return;
    localStorage.setItem(draftKey, JSON.stringify(requestQty));
    toast.success("Draft pengajuan restock disimpan di perangkat ini.");
  }

  async function handleSubmitRestock() {
    const items = Object.entries(requestQty)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }));
    if (items.length === 0) {
      toast.warning("Isi jumlah produk yang mau diajukan restock.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createRestockRequest({ items });
      toast.success("Permintaan restock berhasil dikirim.");
      setRequestQty({});
      if (draftKey) localStorage.removeItem(draftKey);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengirim permintaan restock.");
    } finally {
      setSubmitting(false);
    }
  }

  const itemDiajukan = Object.values(requestQty).filter((q) => q > 0).length;
  const totalCupDiajukan = Object.values(requestQty).reduce((sum, q) => sum + q, 0);
  const itemKritisRestock = products.filter((p) => {
    const s = stock.find((row) => row.productId === p.id)?.status;
    return s === "Kritis" || s === "Habis";
  }).length;
  const semuaTerpilih = products.length > 0 && products.every((p) => (requestQty[p.id] ?? 0) > 0);

  useHidePetugasNav(tab === "RESTOCK");

  // Kartu ringkasan cuma 4 kotak (ikut mockup) — level "Menipis" digabung ke
  // "Kritis" DI KARTU SAJA (keduanya sama-sama "perlu direstock segera",
  // Menipis belum separah Habis tapi tidak lagi "Aman"), supaya totalnya
  // tetap pas (Aman+Kritis+Habis = Total Item) tanpa perlu kartu ke-5. Badge
  // per baris di bawah TETAP pakai 4 level asli (Aman/Menipis/Kritis/Habis)
  // — jadi tidak ada informasi yang hilang, cuma diringkas di ringkasannya.
  const ringkasan = useMemo(() => {
    const aman = stock.filter((s) => s.status === "Aman").length;
    const habis = stock.filter((s) => s.status === "Habis").length;
    const kritis = stock.length - aman - habis;
    return { total: stock.length, aman, kritis, habis };
  }, [stock]);

  const stockTersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return stock.filter((s) => {
      if (filterStatus !== "SEMUA" && s.status !== filterStatus) return false;
      if (!q) return true;
      return s.productName.toLowerCase().includes(q) || (s.categoryName ?? "").toLowerCase().includes(q);
    });
  }, [stock, cari, filterStatus]);

  return (
    <div className="min-h-screen bg-[#F7F9F6] pb-10">
      <TopBar title="Stok" subtitle="Kelola stok bahan dan produk di booth" back="/petugas" />

      <div className="px-4 pt-3 flex gap-2">
        {(
          [
            ["STOK", "Stok Booth", Package],
            ["RESTOCK", "Ajukan Restock", FilePlus2],
            ["RIWAYAT", "Riwayat Stok", History],
          ] as [Tab, string, typeof Package][]
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold"
            style={
              tab === key
                ? { backgroundColor: GREEN, color: "white" }
                : { backgroundColor: "white", color: "#475569", border: "1px solid #E2E8F0" }
            }
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : tab === "STOK" ? (
        <div className="p-4">
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="rounded-xl p-2.5" style={{ backgroundColor: "#E8F5E9" }}>
              <Package size={16} style={{ color: GREEN }} />
              <p className="text-[10px] text-slate-600 mt-1.5">Total Item</p>
              <p className="text-lg font-extrabold text-slate-900">{ringkasan.total}</p>
              <p className="text-[9px] text-slate-400">produk</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: "#E8F5E9" }}>
              <CheckCircle2 size={16} style={{ color: GREEN }} />
              <p className="text-[10px] mt-1.5" style={{ color: GREEN }}>Aman</p>
              <p className="text-lg font-extrabold" style={{ color: GREEN }}>{ringkasan.aman}</p>
              <p className="text-[9px] text-slate-400">produk</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: "#FFF3E0" }}>
              <AlertTriangle size={16} style={{ color: "#C2740C" }} />
              <p className="text-[10px] mt-1.5" style={{ color: "#C2740C" }}>Kritis</p>
              <p className="text-lg font-extrabold" style={{ color: "#C2740C" }}>{ringkasan.kritis}</p>
              <p className="text-[9px] text-slate-400">produk</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: "#FEE2E2" }}>
              <Ban size={16} style={{ color: "#D21919" }} />
              <p className="text-[10px] mt-1.5" style={{ color: "#D21919" }}>Habis</p>
              <p className="text-lg font-extrabold" style={{ color: "#D21919" }}>{ringkasan.habis}</p>
              <p className="text-[9px] text-slate-400">produk</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 h-10">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari produk..."
                className="flex-1 min-w-0 text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl border px-3 h-10 text-xs font-bold"
                style={
                  filterStatus !== "SEMUA"
                    ? { backgroundColor: GREEN, borderColor: GREEN, color: "white" }
                    : { backgroundColor: "white", borderColor: "#E2E8F0", color: "#475569" }
                }
              >
                <SlidersHorizontal size={14} />
                Filter
              </button>
              {filterOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg z-20 p-1.5">
                  {FILTER_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        setFilterStatus(o.value);
                        setFilterOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold"
                      style={filterStatus === o.value ? { backgroundColor: "#E8F5E9", color: GREEN } : { color: "#475569" }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {stockTersaring.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">Tidak ada produk yang cocok.</p>
            ) : (
              stockTersaring.map((s) => {
                const style = STATUS_STYLE[s.status];
                const Icon = style.icon;
                const pct = s.minimumQty <= 0 ? 100 : Math.min(100, Math.round((s.qtyOnHand / s.minimumQty) * 100));
                return (
                  <div key={s.productId} className="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                      {s.productImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.productImageUrl} alt={s.productName} className="w-full h-full object-cover" />
                      ) : (
                        <ImageOff size={18} className="text-slate-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{s.productName}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {s.categoryName ?? "Tanpa Kategori"} / {s.boothName}
                      </p>
                    </div>

                    <div className="w-24 shrink-0">
                      <p className="text-sm font-extrabold text-right" style={{ color: style.fg }}>
                        {s.qtyOnHand} cup
                      </p>
                      <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: style.bar }} />
                      </div>
                      <p className="text-[10px] text-slate-400 text-right mt-1">Min. {s.minimumQty} cup</p>
                    </div>

                    <span
                      className="flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-1.5 shrink-0"
                      style={{ backgroundColor: style.bg, color: style.fg }}
                    >
                      <Icon size={12} />
                      {s.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : tab === "RESTOCK" ? (
        <div className="p-4 pb-32">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#E4F3E9" }}>
              <Store size={20} style={{ color: GREEN }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-sm text-slate-900 truncate">{shift?.booth.name ?? "-"}</p>
              <p className="text-[11px] text-slate-500">Butuh Restock Hari Ini</p>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Calendar size={11} /> {formatTanggalJakarta(new Date().toISOString())}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl p-2.5" style={{ backgroundColor: "#E8F5E9" }}>
              <FileText size={16} style={{ color: GREEN }} />
              <p className="text-lg font-extrabold text-slate-900 mt-1.5">{itemDiajukan}</p>
              <p className="text-[10px] text-slate-500">item diajukan</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: "#FFF3E0" }}>
              <AlertTriangle size={16} style={{ color: "#C2740C" }} />
              <p className="text-lg font-extrabold mt-1.5" style={{ color: "#C2740C" }}>{itemKritisRestock}</p>
              <p className="text-[10px] text-slate-500">item kritis</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: "#E1EEFB" }}>
              <Package size={16} style={{ color: "#1D63D8" }} />
              <p className="text-lg font-extrabold mt-1.5" style={{ color: "#1D63D8" }}>{totalCupDiajukan}</p>
              <p className="text-[10px] text-slate-500">estimasi total cup</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-2.5">
            <p className="text-sm font-extrabold text-slate-900">Pilih Produk untuk Direstock</p>
            <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer" style={{ color: GREEN }}>
              Pilih Semua
              <input
                type="checkbox"
                checked={semuaTerpilih}
                onChange={(e) => handlePilihSemua(e.target.checked)}
                className="w-4 h-4 rounded accent-current"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2.5">
            {products.map((p) => {
              const stockRow = stock.find((s) => s.productId === p.id);
              const status = stockRow?.status ?? "Aman";
              const style = STATUS_STYLE[status];
              const Icon = style.icon;
              const qty = requestQty[p.id] ?? 0;
              return (
                <div key={p.id} className="rounded-2xl bg-white border border-slate-200 p-3.5 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {stockRow?.productImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={stockRow.productImageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff size={16} className="text-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-500 mb-1">Stok saat ini {stockRow?.qtyOnHand ?? 0} cup</p>
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5"
                      style={{ backgroundColor: style.bg, color: style.fg }}
                    >
                      <Icon size={10} />
                      {status}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <p className="text-[10px] text-slate-400 whitespace-nowrap">
                      Saran restock <span className="font-bold text-slate-600">{hitungSaranRestock({
                        qtyTerjual7Hari: qtyTerjual7Hari.get(p.id) ?? 0,
                        minimumQty: p.minimumQty,
                        stokSaatIni: stockRow?.qtyOnHand ?? 0,
                        sisaJamShift: shift ? (new Date(shift.scheduledEndAt).getTime() - Date.now()) / 3_600_000 : 0,
                        jamPerShift: shift
                          ? (new Date(shift.scheduledEndAt).getTime() - new Date(shift.scheduledStartAt).getTime()) / 3_600_000
                          : 0,
                      })} cup</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => changeRequestQty(p.id, -1)} className="w-7 h-7 rounded-full border flex items-center justify-center">
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold rounded-lg py-1" style={{ backgroundColor: "#E8F5E9", color: GREEN }}>
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeRequestQty(p.id, 1)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: GREEN }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="fixed bottom-4 inset-x-4 z-20">
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-[0_12px_32px_-8px_rgba(11,93,52,0.3)] border border-slate-100 p-3 flex items-center gap-2.5">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E8F5E9" }}>
                  <Package size={14} style={{ color: GREEN }} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-900 leading-tight">{itemDiajukan} item dipilih</p>
                  <p className="text-[10px] text-slate-500 leading-tight">Total {totalCupDiajukan} cup</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSimpanDraft}
                className="flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-xs font-bold shrink-0"
                style={{ borderColor: GREEN, color: GREEN }}
              >
                <Bookmark size={14} /> Draft
              </button>
              <button
                type="button"
                onClick={handleSubmitRestock}
                disabled={submitting || totalCupDiajukan === 0}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: GREEN }}
              >
                {submitting ? <Spinner size="sm" color="white" /> : (
                  <>
                    <Send size={14} /> Kirim Pengajuan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#E4F3E9" }}>
              <Store size={20} style={{ color: GREEN }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-sm text-slate-900 truncate">{shift?.booth.name ?? "-"}</p>
              <p className="text-[11px] text-slate-500">Pilih produk untuk melihat riwayat stok</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Pilih Stok</p>
              <div className="relative">
                <select
                  value={ledgerProductId ?? ""}
                  onChange={(e) => setLedgerProductId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-2.5 text-sm font-semibold text-slate-800"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500 mb-1">Periode</p>
              <div className="relative">
                <select
                  value={ledgerPeriode}
                  onChange={(e) => setLedgerPeriode(e.target.value as Periode)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-2.5 text-sm font-semibold text-slate-800"
                >
                  {(Object.keys(PERIODE_LABEL) as Periode[]).map((p) => (
                    <option key={p} value={p}>
                      {PERIODE_LABEL[p]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {loadingLedger || !ledger ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 mb-5">
                <div className="rounded-xl p-2.5 bg-slate-50 border border-slate-100">
                  <Package size={15} className="text-slate-500" />
                  <p className="text-[10px] text-slate-500 mt-1.5">Stok Awal</p>
                  <p className="text-base font-extrabold text-slate-900">{ledger.ringkasan.stokAwal}</p>
                </div>
                <div className="rounded-xl p-2.5" style={{ backgroundColor: "#E8F5E9" }}>
                  <ArrowUp size={15} style={{ color: GREEN }} />
                  <p className="text-[10px] mt-1.5" style={{ color: GREEN }}>Masuk</p>
                  <p className="text-base font-extrabold" style={{ color: GREEN }}>{ledger.ringkasan.masuk}</p>
                </div>
                <div className="rounded-xl p-2.5" style={{ backgroundColor: "#FEE2E2" }}>
                  <ArrowDown size={15} style={{ color: "#D21919" }} />
                  <p className="text-[10px] mt-1.5" style={{ color: "#D21919" }}>Keluar</p>
                  <p className="text-base font-extrabold" style={{ color: "#D21919" }}>{ledger.ringkasan.keluar}</p>
                </div>
                <div className="rounded-xl p-2.5 bg-slate-50 border border-slate-100">
                  <Package size={15} className="text-slate-500" />
                  <p className="text-[10px] text-slate-500 mt-1.5">Stok Akhir</p>
                  <p className="text-base font-extrabold text-slate-900">{ledger.ringkasan.stokAkhir}</p>
                </div>
              </div>

              <p className="text-sm font-extrabold text-slate-900">Riwayat Mutasi Stok</p>
              <p className="text-[11px] text-slate-500 mb-3">Catatan masuk dan keluar stok produk terpilih</p>

              <div className="flex flex-col gap-2 mb-4">
                {ledger.rows.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10">Belum ada mutasi pada periode ini.</p>
                ) : (
                  ledger.rows
                    .slice()
                    .reverse()
                    .map((r) => {
                      const jenisStyle =
                        r.jenis === "MASUK"
                          ? { bg: "#E8F5E9", fg: GREEN, Icon: ArrowUp }
                          : r.jenis === "KELUAR"
                            ? { bg: "#FEE2E2", fg: "#D21919", Icon: ArrowDown }
                            : { bg: "#E1EEFB", fg: "#1D63D8", Icon: Equal };
                      const JenisIcon = jenisStyle.Icon;
                      return (
                        <div key={r.id} className="rounded-xl bg-white border border-slate-200 p-3.5 flex items-center gap-3">
                          <div className="w-20 shrink-0">
                            <p className="text-xs font-bold text-slate-800">{formatTanggalJakarta(r.tanggal)}</p>
                            <p className="text-[10px] text-slate-400">{formatJamJakarta(r.tanggal)}</p>
                          </div>
                          <span
                            className="flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-1 shrink-0"
                            style={{ backgroundColor: jenisStyle.bg, color: jenisStyle.fg }}
                          >
                            <JenisIcon size={10} />
                            {r.jenis === "MASUK" ? "Masuk" : r.jenis === "KELUAR" ? "Keluar" : "Penyesuaian"}
                          </span>
                          <p className="text-sm font-extrabold w-14 text-right shrink-0" style={{ color: jenisStyle.fg }}>
                            {r.qty > 0 ? "+" : ""}{r.qty}
                          </p>
                          <p className="text-xs font-bold text-slate-700 w-10 text-right shrink-0">{r.stokAkhir}</p>
                          <p className="text-[11px] text-slate-500 flex-1 min-w-0 truncate">{r.keterangan}</p>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-3.5 flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E8F5E9" }}>
                    <ArrowUp size={14} style={{ color: GREEN }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 leading-tight">Total Masuk</p>
                    <p className="text-sm font-extrabold text-slate-900 leading-tight">{ledger.ringkasan.masuk} cup</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
                    <ArrowDown size={14} style={{ color: "#D21919" }} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 leading-tight">Total Keluar</p>
                    <p className="text-sm font-extrabold text-slate-900 leading-tight">{ledger.ringkasan.keluar} cup</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportRiwayat}
                  className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 shrink-0"
                >
                  <Download size={13} /> Export
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function StokPage() {
  return (
    <RequirePetugasAuth>
      <StokContent />
    </RequirePetugasAuth>
  );
}
