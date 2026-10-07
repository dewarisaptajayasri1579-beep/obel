"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Minus,
  Plus,
  Send,
  Package,
  FilePlus2,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Bookmark,
  Calendar,
  Clock,
  XCircle,
} from "lucide-react";
import {
  api,
  ApiError,
  type BoothStockRow,
  type Product,
  type RestockRequest,
  type WarehouseStockItem,
} from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { RequireActiveShift, useActiveShift } from "../_components/RequireActiveShift";
import { useHidePetugasNav } from "@/components/layout/PetugasShell";
import { TopBar } from "../_components/TopBar";
import { formatTanggalJakarta } from "../_lib/format";

import { OBBEL, OBBEL_SCALE } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

/// Status pengajuan restok Petugas — REJECTED sengaja ditonjolkan (merah +
/// alasan) karena inilah yang tadinya sama sekali tidak tersorot ke Petugas
/// (endpoint GET /restock-requests/mine sudah lama ada, tapi belum pernah
/// dipanggil dari layar manapun).
const RESTOCK_REQUEST_STATUS_STYLE: Record<
  RestockRequest["status"],
  { label: string; bg: string; fg: string; icon: typeof Clock }
> = {
  REQUESTED: { label: "Diajukan", bg: "#FFF8E1", fg: "#B45309", icon: Clock },
  APPROVED: { label: "Disetujui & Dikirim", bg: OBBEL_SCALE[50], fg: GREEN, icon: CheckCircle2 },
  REJECTED: { label: "Ditolak", bg: "#FEE2E2", fg: "#D21919", icon: XCircle },
  CANCELLED: { label: "Dibatalkan", bg: "#F1F5F9", fg: "#64748B", icon: Ban },
};

const STATUS_STYLE: Record<BoothStockRow["status"], { bg: string; fg: string; bar: string; icon: typeof CheckCircle2 }> = {
  Aman: { bg: OBBEL_SCALE[50], fg: GREEN, bar: OBBEL_SCALE[600], icon: CheckCircle2 },
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

type Tab = "STOK" | "RESTOCK";

const petaStokGudang = (rows: WarehouseStockItem[]) => new Map(rows.map((r) => [r.productId, r.qtyOnHand]));
type FilterStatus = "SEMUA" | BoothStockRow["status"];

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "SEMUA", label: "Semua Status" },
  { value: "Aman", label: "Aman" },
  { value: "Menipis", label: "Menipis" },
  { value: "Kritis", label: "Kritis" },
  { value: "Habis", label: "Habis" },
];

const VALID_TABS: Tab[] = ["STOK", "RESTOCK"];

function StokContent() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Tab mengikuti ?tab= di URL (mis. notifikasi Restock Ditolak membuka ?tab=restock).
  const tabFromQuery = searchParams.get("tab")?.toUpperCase();
  const tab: Tab = VALID_TABS.includes(tabFromQuery as Tab) ? (tabFromQuery as Tab) : "STOK";
  const [loading, setLoading] = useState(true);
  const [stock, setStock] = useState<BoothStockRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [requestQty, setRequestQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [cari, setCari] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("SEMUA");
  const [filterOpen, setFilterOpen] = useState(false);
  const shift = useActiveShift();
  const draftKey = `obbel-petugas-restock-draft-${shift.booth.id}`;
  const jamPerShift = (new Date(shift.scheduledEndAt).getTime() - new Date(shift.scheduledStartAt).getTime()) / 3_600_000;
  const sisaJamShift = (new Date(shift.scheduledEndAt).getTime() - Date.now()) / 3_600_000;
  const [qtyTerjual7Hari, setQtyTerjual7Hari] = useState<Map<string, number>>(new Map());
  const [saranDihitung, setSaranDihitung] = useState(false);
  const [riwayatRestock, setRiwayatRestock] = useState<RestockRequest[]>([]);
  // Stok Gudang per produk — permintaan restock dibatasi ke angka ini (backend
  // juga menolak yang melebihi, RESTOCK_EXCEEDS_WAREHOUSE). null = gagal dimuat,
  // tampilan tanpa batas dan backend tetap menjaga.
  const [stokGudang, setStokGudang] = useState<Map<string, number> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [stockRows, productList, terlaris, restockRequests, gudang] = await Promise.all([
          api.getMyBoothStock(),
          api.getProducts(),
          api.getTerlarisMine().catch(() => []),
          api.getMyRestockRequests().catch(() => []),
          api.getWarehouseStock().catch(() => null),
        ]);
        if (gudang) setStokGudang(petaStokGudang(gudang));
        setStock(stockRows);
        setProducts(productList.filter((p) => p.active));
        setQtyTerjual7Hari(new Map(terlaris.map((t) => [t.productId, t.qty])));
        setRiwayatRestock(restockRequests);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat stok booth.");
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  const batasGudang = (productId: string) => stokGudang?.get(productId) ?? Infinity;

  /// Saran restock satu produk, tidak lebih dari stok Gudang.
  function saranUntuk(p: Product): number {
    const saran = hitungSaranRestock({
      qtyTerjual7Hari: qtyTerjual7Hari.get(p.id) ?? 0,
      minimumQty: p.minimumQty,
      stokSaatIni: stock.find((s) => s.productId === p.id)?.qtyOnHand ?? 0,
      sisaJamShift,
      jamPerShift,
    });
    return Math.min(saran, batasGudang(p.id));
  }

  function saranSemua(): Record<string, number> {
    return Object.fromEntries(products.map((p) => [p.id, saranUntuk(p)]));
  }

  /// Nilai awal stepper = saran restock (lihat hitungSaranRestock), TAPI
  /// hanya sekali begitu semua datanya siap — supaya perubahan manual
  /// Petugas di stepper tidak ketiban ulang tiap re-render. Draft
  /// tersimpan (localStorage per Booth) menang atas saran kalau ada.
  useEffect(() => {
    if (saranDihitung || products.length === 0) return;
    const draftRaw = typeof window !== "undefined" ? localStorage.getItem(draftKey) : null;
    if (draftRaw) {
      try {
        // Draft lama bisa melebihi stok Gudang sekarang — dipangkas.
        const draft: Record<string, number> = JSON.parse(draftRaw);
        setRequestQty(Object.fromEntries(Object.entries(draft).map(([id, q]) => [id, Math.min(q, batasGudang(id))])));
        setSaranDihitung(true);
        return;
      } catch {
        localStorage.removeItem(draftKey);
      }
    }

    setRequestQty(saranSemua());
    setSaranDihitung(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saranDihitung, products]);

  function changeRequestQty(p: Product, delta: number) {
    const sekarang = requestQty[p.id] ?? 0;
    const batas = batasGudang(p.id);
    if (delta > 0 && sekarang + delta > batas) {
      toast.warning(batas === 0 ? `Stok Gudang ${p.name} sedang kosong.` : `Stok Gudang ${p.name} tinggal ${batas} cup.`);
      return;
    }
    setRequestQty((prev) => ({ ...prev, [p.id]: Math.max(0, sekarang + delta) }));
  }

  function handlePilihSemua(checked: boolean) {
    if (!checked) {
      setRequestQty({});
      return;
    }
    setRequestQty(saranSemua());
  }

  function handleSimpanDraft() {
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
      localStorage.removeItem(draftKey);
      api.getMyRestockRequests().then(setRiwayatRestock).catch(() => {});
    } catch (err) {
      // Stok Gudang berubah sejak halaman dibuka — muat ulang supaya batasnya benar.
      if (err instanceof ApiError && err.code === "RESTOCK_EXCEEDS_WAREHOUSE") {
        api.getWarehouseStock().then((g) => setStokGudang(petaStokGudang(g))).catch(() => {});
      }
      toast.error(err instanceof ApiError ? err.message : "Gagal mengirim permintaan restock.");
    } finally {
      setSubmitting(false);
    }
  }

  const itemDiajukan = Object.values(requestQty).filter((q) => q > 0).length;
  const totalCupDiajukan = Object.values(requestQty).reduce((sum, q) => sum + q, 0);
  const semuaTerpilih =
    products.length > 0 && products.every((p) => (requestQty[p.id] ?? 0) > 0 || batasGudang(p.id) === 0);

  useHidePetugasNav(tab === "RESTOCK");

  useEffect(() => {
    if (tabFromQuery === "RIWAYAT") router.replace("/petugas/riwayat-stok");
  }, [tabFromQuery, router]);

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
    <div className="min-h-screen bg-[#F7F9F6]">
      <TopBar title="Stok" subtitle={shift.booth.name} back="/petugas" />

      {/* Segmented control: dua segmen sama lebar, teksnya tidak pernah turun baris. */}
      <div className="px-4 pt-3">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white border border-slate-200 p-1">
          {(
            [
              ["STOK", "Stok Booth", Package],
              ["RESTOCK", "Ajukan Restock", FilePlus2],
            ] as [Tab, string, typeof Package][]
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => router.replace(`/petugas/stok?tab=${key}`, { scroll: false })}
              className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold whitespace-nowrap transition"
              style={tab === key ? { backgroundColor: GREEN, color: "white" } : { color: "#475569" }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : tab === "STOK" ? (
        <div className="p-4">
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="rounded-xl p-2.5" style={{ backgroundColor: OBBEL_SCALE[50] }}>
              <Package size={16} style={{ color: GREEN }} />
              <p className="text-xs text-slate-600 mt-1.5">Total Item</p>
              <p className="text-lg font-extrabold text-slate-900">{ringkasan.total}</p>
              <p className="text-[11px] text-slate-400">produk</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: OBBEL_SCALE[50] }}>
              <CheckCircle2 size={16} style={{ color: GREEN }} />
              <p className="text-xs mt-1.5" style={{ color: GREEN }}>Aman</p>
              <p className="text-lg font-extrabold" style={{ color: GREEN }}>{ringkasan.aman}</p>
              <p className="text-[11px] text-slate-400">produk</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: "#FFF3E0" }}>
              <AlertTriangle size={16} style={{ color: "#C2740C" }} />
              <p className="text-xs mt-1.5" style={{ color: "#C2740C" }}>Kritis</p>
              <p className="text-lg font-extrabold" style={{ color: "#C2740C" }}>{ringkasan.kritis}</p>
              <p className="text-[11px] text-slate-400">produk</p>
            </div>
            <div className="rounded-xl p-2.5" style={{ backgroundColor: "#FEE2E2" }}>
              <Ban size={16} style={{ color: "#D21919" }} />
              <p className="text-xs mt-1.5" style={{ color: "#D21919" }}>Habis</p>
              <p className="text-lg font-extrabold" style={{ color: "#D21919" }}>{ringkasan.habis}</p>
              <p className="text-[11px] text-slate-400">produk</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 h-10">
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari produk..."
                className="flex-1 min-w-0 text-base outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setFilterOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-xl border px-3 h-10 text-sm font-bold"
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
                      className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold"
                      style={filterStatus === o.value ? { backgroundColor: OBBEL_SCALE[50], color: GREEN } : { color: "#475569" }}
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
              <p className="text-base text-slate-500 text-center py-10">Tidak ada produk yang cocok.</p>
            ) : (
              stockTersaring.map((s) => {
                const style = STATUS_STYLE[s.status];
                const Icon = style.icon;
                const pct = s.minimumQty <= 0 ? 100 : Math.min(100, Math.round((s.qtyOnHand / s.minimumQty) * 100));
                return (
                  <div key={s.productId} className="rounded-2xl bg-white border border-slate-200 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base text-slate-900 truncate">{s.productName}</p>
                        <p className="text-sm text-slate-400 truncate">{s.categoryName ?? "Tanpa Kategori"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-extrabold text-slate-900">{s.qtyOnHand} cup</p>
                        <p className="text-xs text-slate-400">Min. {s.minimumQty} cup</p>
                      </div>
                      <span
                        className="flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1.5 shrink-0"
                        style={{ backgroundColor: style.bg, color: style.fg }}
                      >
                        <Icon size={12} />
                        {s.status}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 mt-3 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: style.bar }} />
                    </div>
                    {s.dalamProsesKembali > 0 && (
                      <p className="text-xs font-semibold text-sky-600 mt-2">{s.dalamProsesKembali} cup Proses Kembali ke Gudang</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 pb-36">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-base font-extrabold text-slate-900">Pilih Produk untuk Direstock</p>
            <label className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer" style={{ color: GREEN }}>
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
              const gudang = stokGudang?.get(p.id);
              const gudangKosong = gudang === 0;
              return (
                <div key={p.id} className="rounded-2xl bg-white border border-slate-200 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-base text-slate-900 truncate">{p.name}</p>
                      <p className="text-sm text-slate-500">
                        Stok {stockRow?.qtyOnHand ?? 0} cup
                        {gudang !== undefined && (
                          <>
                            {" · "}
                            <span className={gudangKosong ? "font-bold text-rose-600" : undefined}>
                              {gudangKosong ? "Gudang kosong" : `Gudang ${gudang} cup`}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className="flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 shrink-0"
                      style={{ backgroundColor: style.bg, color: style.fg }}
                    >
                      <Icon size={12} />
                      {status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-3">
                    <p className="text-sm text-slate-500">
                      Saran <span className="font-bold text-slate-700">{saranUntuk(p)} cup</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => changeRequestQty(p, -1)} className="w-10 h-10 rounded-full border flex items-center justify-center active:bg-slate-100">
                        <Minus size={18} />
                      </button>
                      <span className="w-10 text-center text-base font-bold rounded-lg py-1.5" style={{ backgroundColor: OBBEL_SCALE[50], color: GREEN }}>
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeRequestQty(p, 1)}
                        disabled={gudangKosong || qty >= batasGudang(p.id)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white active:opacity-80 disabled:opacity-30"
                        style={{ backgroundColor: GREEN }}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {riwayatRestock.length > 0 && (
            <div className="mt-6">
              <p className="text-base font-extrabold text-slate-900 mb-2.5">Riwayat Pengajuan</p>
              <div className="flex flex-col gap-2">
                {riwayatRestock.slice(0, 5).map((r) => {
                  const style = RESTOCK_REQUEST_STATUS_STYLE[r.status];
                  const Icon = style.icon;
                  const totalQty = r.items.reduce((sum, i) => sum + i.qtyRequested, 0);
                  return (
                    <div key={r.id} className="rounded-2xl bg-white border border-slate-200 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 truncate">{r.requestNo}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={10} /> {formatTanggalJakarta(r.createdAt)} · {r.items.length} produk · {totalQty} cup
                          </p>
                        </div>
                        <span
                          className="flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 shrink-0"
                          style={{ backgroundColor: style.bg, color: style.fg }}
                        >
                          <Icon size={12} />
                          {style.label}
                        </span>
                      </div>
                      {r.status === "REJECTED" && r.rejectReason && (
                        <p className="text-xs font-semibold mt-2 pt-2 border-t border-dashed border-slate-200" style={{ color: "#D21919" }}>
                          Alasan ditolak: {r.rejectReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Latar seperti bottom nav (PetugasShell): produk yang di-scroll tidak tampak di sekeliling bar. */}
          <div className="fixed inset-x-0 bottom-0 z-20 pt-6 pb-4 px-4 bg-linear-to-t from-[#F7F9F6] from-70% to-transparent pointer-events-none">
            <div className="max-w-md mx-auto pointer-events-auto bg-white rounded-3xl shadow-[0_12px_32px_-8px_rgba(11,93,52,0.3)] border border-slate-100 p-3 flex items-center gap-2.5">
              <div className="flex-1 min-w-0 pl-1">
                <p className="text-sm font-bold text-slate-900 leading-tight">{itemDiajukan} produk dipilih</p>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">Total {totalCupDiajukan} cup</p>
              </div>
              <button
                type="button"
                onClick={handleSimpanDraft}
                className="flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm font-bold shrink-0"
                style={{ borderColor: GREEN, color: GREEN }}
              >
                <Bookmark size={14} /> Draft
              </button>
              <button
                type="button"
                onClick={handleSubmitRestock}
                disabled={submitting || totalCupDiajukan === 0}
                className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold text-white shrink-0 disabled:opacity-50"
                style={{ backgroundColor: GREEN }}
              >
                {submitting ? <Spinner size="sm" color="white" /> : (
                  <>
                    <Send size={14} /> Kirim
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      )}
    </div>
  );
}

export default function StokPage() {
  return (
    <RequirePetugasAuth>
      {/* useSearchParams wajib dibungkus Suspense di App Router. */}
      <Suspense
        fallback={
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        }
      >
        <RequireActiveShift title="Stok">
          <StokContent />
        </RequireActiveShift>
      </Suspense>
    </RequirePetugasAuth>
  );
}
