"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Coffee,
  PackageSearch,
  Search,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth, type ShiftAdminHistoryItem, type ShiftReport, type UserAccount } from "@/lib/api-client";
import { TRANSAKSI_BOOTH_FILTER_KEYS, usePersistedFilter } from "@/lib/use-persisted-filter";

type Tab = "SEMUA" | "PERLU_APPROVE" | "SELISIH";

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function waktuJakarta(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

const RETUR_BADGE: Record<string, { label: string; kelas: string }> = {
  SUBMITTED: { label: "Stok Kembali: Menunggu", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
  RECEIVED: { label: "Stok Kembali: Diterima", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  DISCREPANCY: { label: "Stok Kembali: Selisih", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
  CANCELLED: { label: "Stok Kembali: Dibatalkan", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line" },
};

const SETORAN_BADGE: Record<string, { label: string; kelas: string }> = {
  PENDING: { label: "Setor Uang: Menunggu", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
  CONFIRMED: { label: "Setor Uang: Diterima", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  DISCREPANCY: { label: "Setor Uang: Selisih", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
};

function needsApproval(r: ShiftAdminHistoryItem): boolean {
  return r.returStatus === "SUBMITTED" || r.setoranStatus === "PENDING";
}

/// Isi detail satu Laporan Kembali — dipakai baik di kartu "Perlu Approve"
/// maupun di baris tabel utama, supaya approve Stok Kembali/Setor Uang bisa
/// dilakukan dari kedua tempat tanpa duplikasi logic.
function LaporanDetail({
  report,
  shiftId,
  onChanged,
}: {
  report: ShiftReport;
  shiftId: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const retur = report.retur;
  const setoran = report.setoran;

  const [returQty, setReturQty] = useState<Record<string, number>>(
    Object.fromEntries((retur?.items ?? []).map((i) => [i.productId, i.qtySubmitted])),
  );
  const [returNote, setReturNote] = useState("");
  const [submittingRetur, setSubmittingRetur] = useState(false);

  const [depositAmount, setDepositAmount] = useState<number>(setoran?.expectedAmount ?? 0);
  const [depositNote, setDepositNote] = useState("");
  const [submittingSetoran, setSubmittingSetoran] = useState(false);

  const returAdaBeda = retur ? retur.items.some((i) => (returQty[i.productId] ?? i.qtySubmitted) !== i.qtySubmitted) : false;
  const setoranAdaBeda = setoran ? depositAmount !== setoran.expectedAmount : false;

  async function approveRetur() {
    if (!retur) return;
    if (returAdaBeda && !returNote.trim()) {
      toast.warning("Catatan wajib diisi kalau qty Stok Kembali yang diterima berbeda dari yang diajukan.");
      return;
    }
    setSubmittingRetur(true);
    try {
      await api.receiveReturn(
        retur.id,
        retur.items.map((i) => ({ productId: i.productId, qtyReceived: returQty[i.productId] ?? i.qtySubmitted })),
        returNote.trim() || undefined,
      );
      toast.success("Stok Kembali di-approve.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal approve Stok Kembali.");
    } finally {
      setSubmittingRetur(false);
    }
  }

  async function approveSetoran() {
    if (!setoran) return;
    if (setoranAdaBeda && !depositNote.trim()) {
      toast.warning("Catatan wajib diisi kalau jumlah Setor Uang berbeda dari yang seharusnya.");
      return;
    }
    setSubmittingSetoran(true);
    try {
      await api.confirmCashDeposit(shiftId, { depositedAmount: depositAmount, note: depositNote.trim() || undefined });
      toast.success("Setor Uang di-approve.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal approve Setor Uang.");
    } finally {
      setSubmittingSetoran(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold text-slate-700 dark:text-fg mb-2">Rekap Stok Produk</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-line bg-white dark:bg-surface">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/70 dark:bg-surface-hover text-[11px] font-bold text-slate-600 dark:text-fg-secondary">
              <tr>
                <th className="py-2 px-3 text-left">Produk</th>
                <th className="py-2 px-3 text-center">Awal</th>
                <th className="py-2 px-3 text-center">Restock</th>
                <th className="py-2 px-3 text-center">Terjual</th>
                <th className="py-2 px-3 text-center">Retur</th>
                <th className="py-2 px-3 text-center">Sisa Sistem</th>
                <th className="py-2 px-3 text-center">Stok Fisik</th>
                <th className="py-2 px-3 text-center">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-line">
              {report.items.map((it) => (
                <tr key={it.productId}>
                  <td className="py-2 px-3 text-slate-800 dark:text-fg font-medium">{it.productName}</td>
                  <td className="py-2 px-3 text-center tabular-nums">{it.stokAwal}</td>
                  <td className="py-2 px-3 text-center tabular-nums">{it.restock}</td>
                  <td className="py-2 px-3 text-center tabular-nums">{it.terjual}</td>
                  <td className="py-2 px-3 text-center tabular-nums">{it.retur}</td>
                  <td className="py-2 px-3 text-center tabular-nums font-semibold">{it.sisaSistem}</td>
                  <td className="py-2 px-3 text-center tabular-nums">{it.stokFisik ?? "-"}</td>
                  <td
                    className={`py-2 px-3 text-center tabular-nums font-semibold ${
                      it.selisih === 0 ? "text-slate-400 dark:text-fg-muted" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {it.selisih === 0 ? "0" : it.selisih > 0 ? `+${it.selisih}` : it.selisih}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.catatan && <p className="text-xs text-slate-500 dark:text-fg-muted mt-2">Catatan Petugas: {report.catatan}</p>}
      </div>

      {/* Stok Kembali ke Gudang */}
      <div className="rounded-xl border border-slate-200/70 dark:border-line bg-white dark:bg-surface overflow-hidden">
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-slate-100 dark:border-line bg-slate-50/60 dark:bg-surface-hover/40">
          <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold text-slate-800 dark:text-fg flex-1">Stok Kembali ke Gudang</p>
          {retur && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${RETUR_BADGE[retur.status].kelas}`}>
              {RETUR_BADGE[retur.status].label}
            </span>
          )}
        </div>

        {!retur ? (
          <p className="text-xs text-slate-400 dark:text-fg-muted px-3.5 py-4">Tidak ada sisa stok yang dikembalikan ke Gudang.</p>
        ) : (
          <div className="p-3.5 space-y-3">
            <div className="overflow-x-auto rounded-lg border border-slate-200/60 dark:border-line">
              <table className="w-full text-xs">
                <thead className="bg-slate-100/70 dark:bg-surface-hover text-[11px] font-bold text-slate-600 dark:text-fg-secondary">
                  <tr>
                    <th className="py-2 px-3 text-left">Produk</th>
                    <th className="py-2 px-3 text-center">Diajukan</th>
                    <th className="py-2 px-3 text-center">{retur.status === "SUBMITTED" ? "Diterima (edit jika beda)" : "Diterima"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-line">
                  {retur.items.map((item) => (
                    <tr key={item.productId}>
                      <td className="py-2 px-3 text-slate-800 dark:text-fg font-medium">{item.productName}</td>
                      <td className="py-2 px-3 text-center tabular-nums">{item.qtySubmitted}</td>
                      <td className="py-2 px-3 text-center">
                        {retur.status === "SUBMITTED" ? (
                          <input
                            type="number"
                            min={0}
                            value={returQty[item.productId] ?? item.qtySubmitted}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              setReturQty((prev) => ({ ...prev, [item.productId]: Math.max(0, Number(e.target.value) || 0) }))
                            }
                            className={`w-20 mx-auto block rounded-lg border px-2 py-1 text-xs text-center ${
                              (returQty[item.productId] ?? item.qtySubmitted) !== item.qtySubmitted
                                ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10"
                                : "border-slate-200 dark:border-line"
                            }`}
                          />
                        ) : (
                          <span className="tabular-nums font-semibold">{item.qtyReceived ?? "-"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {retur.status === "SUBMITTED" ? (
              <>
                <textarea
                  value={returNote}
                  onChange={(e) => setReturNote(e.target.value)}
                  placeholder={returAdaBeda ? "Catatan wajib diisi — ada qty yang berbeda dari diajukan..." : "Catatan (opsional)..."}
                  rows={2}
                  className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand-700)]/10 ${
                    returAdaBeda ? "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10" : "border-slate-200 dark:border-line"
                  }`}
                />
                <button
                  type="button"
                  onClick={approveRetur}
                  disabled={submittingRetur || (returAdaBeda && !returNote.trim())}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-700)] text-white text-xs font-bold py-2.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:opacity-90 transition"
                >
                  {submittingRetur ? <Spinner size="sm" color="white" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                  Approve Stok Kembali
                </button>
              </>
            ) : (
              retur.receiveNote && <p className="text-xs text-slate-500 dark:text-fg-muted">Catatan Admin: {retur.receiveNote}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-bold text-slate-700 dark:text-fg mb-2">Rekap Penjualan</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-line bg-white dark:bg-surface">
          <table className="w-full text-xs">
            <thead className="bg-slate-100/70 dark:bg-surface-hover text-[11px] font-bold text-slate-600 dark:text-fg-secondary">
              <tr>
                <th className="py-2 px-3 text-left">No Transaksi</th>
                <th className="py-2 px-3 text-center">Jml Cup</th>
                <th className="py-2 px-3 text-center">Nominal</th>
                <th className="py-2 px-3 text-center">Tunai</th>
                <th className="py-2 px-3 text-center">QRIS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-line">
              {report.transaksi.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400 dark:text-fg-muted">
                    Belum ada transaksi.
                  </td>
                </tr>
              ) : (
                report.transaksi.map((t) => (
                  <tr key={t.saleId}>
                    <td className="py-2 px-3 text-slate-800 dark:text-fg font-medium whitespace-nowrap">{t.saleNo}</td>
                    <td className="py-2 px-3 text-center tabular-nums">{t.cupCount}</td>
                    <td className="py-2 px-3 text-center tabular-nums font-semibold">{formatRupiah(t.total)}</td>
                    <td className="py-2 px-3 text-center tabular-nums">{t.tunai > 0 ? formatRupiah(t.tunai) : "-"}</td>
                    <td className="py-2 px-3 text-center tabular-nums">{t.qris > 0 ? formatRupiah(t.qris) : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-lg bg-white dark:bg-surface border border-slate-200/70 dark:border-line p-3">
          <p className="text-[10px] text-slate-500 dark:text-fg-muted">Total Penjualan</p>
          <p className="font-extrabold text-sm mt-1 text-slate-900 dark:text-fg">{formatRupiah(report.totalPenjualan)}</p>
        </div>
        <div className="rounded-lg bg-white dark:bg-surface border border-slate-200/70 dark:border-line p-3">
          <p className="text-[10px] text-slate-500 dark:text-fg-muted">Kas Tunai</p>
          <p className="font-extrabold text-sm mt-1 text-slate-900 dark:text-fg">{formatRupiah(report.kasTunai)}</p>
        </div>
        <div className="rounded-lg bg-white dark:bg-surface border border-slate-200/70 dark:border-line p-3">
          <p className="text-[10px] text-slate-500 dark:text-fg-muted">Kas QRIS</p>
          <p className="font-extrabold text-sm mt-1 text-slate-900 dark:text-fg">{formatRupiah(report.kasQris)}</p>
        </div>
      </div>

      {/* Setor Uang Tunai */}
      <div className="rounded-xl border border-slate-200/70 dark:border-line bg-white dark:bg-surface overflow-hidden">
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-slate-100 dark:border-line bg-slate-50/60 dark:bg-surface-hover/40">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Banknote className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold text-slate-800 dark:text-fg flex-1">Setor Uang Tunai</p>
          {setoran && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${SETORAN_BADGE[setoran.status].kelas}`}>
              {SETORAN_BADGE[setoran.status].label}
            </span>
          )}
        </div>

        {!setoran ? (
          <p className="text-xs text-slate-400 dark:text-fg-muted px-3.5 py-4">Tidak ada penjualan Tunai di shift ini.</p>
        ) : (
          <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-fg-muted">Seharusnya Disetor (Kas Tunai)</span>
              <span className="font-bold text-slate-800 dark:text-fg">{formatRupiah(setoran.expectedAmount)}</span>
            </div>

            {setoran.status === "PENDING" ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-fg-muted shrink-0">Diterima Admin</span>
                  <input
                    type="number"
                    min={0}
                    value={depositAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value) || 0))}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs text-right font-semibold ${
                      setoranAdaBeda ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10" : "border-slate-200 dark:border-line"
                    }`}
                  />
                </div>
                <textarea
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  placeholder={setoranAdaBeda ? "Catatan wajib diisi — jumlah setoran berbeda dari seharusnya..." : "Catatan (opsional)..."}
                  rows={2}
                  className={`w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand-700)]/10 ${
                    setoranAdaBeda ? "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10" : "border-slate-200 dark:border-line"
                  }`}
                />
                <button
                  type="button"
                  onClick={approveSetoran}
                  disabled={submittingSetoran || (setoranAdaBeda && !depositNote.trim())}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-700)] text-white text-xs font-bold py-2.5 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed hover:opacity-90 transition"
                >
                  {submittingSetoran ? <Spinner size="sm" color="white" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                  Approve Setor Uang
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-fg-muted">Diterima Admin</span>
                  <span className="font-bold text-slate-800 dark:text-fg">{formatRupiah(setoran.depositedAmount ?? 0)}</span>
                </div>
                {setoran.note && <p className="text-xs text-slate-500 dark:text-fg-muted">Catatan Admin: {setoran.note}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TransaksiLaporanKembaliContent() {
  const toast = useToast();
  const [rows, setRows] = useState<ShiftAdminHistoryItem[] | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [staffList, setStaffList] = useState<UserAccount[]>([]);
  const [tabRaw, setTabRaw] = usePersistedFilter("transaksi-laporan-kembali:tab", "SEMUA");
  const tab = tabRaw as Tab;
  const setTab = (v: Tab) => setTabRaw(v);
  const [boothId, setBoothId] = usePersistedFilter(TRANSAKSI_BOOTH_FILTER_KEYS.boothId, "");
  const [staffId, setStaffId] = usePersistedFilter(TRANSAKSI_BOOTH_FILTER_KEYS.staffId, "");
  const [search, setSearch] = usePersistedFilter("transaksi-laporan-kembali:search", "");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedPendingId, setExpandedPendingId] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);
  const [reportById, setReportById] = useState<Record<string, ShiftReport | "loading" | "error">>({});

  function load() {
    api
      .getShiftAdminHistory()
      .then((all) => setRows(all.filter((r) => r.status === "CLOSED")))
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar Laporan Kembali.");
        setRows([]);
      });
  }

  useEffect(() => {
    api.getBooths().then(setBooths).catch(() => {});
    api
      .getUsers()
      .then((users) => setStaffList(users.filter((u) => u.role === "BOOTH_STAFF")))
      .catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadReport(id: string) {
    setReportById((prev) => ({ ...prev, [id]: "loading" }));
    api
      .getShiftReport(id)
      .then((rpt) => setReportById((prev) => ({ ...prev, [id]: rpt })))
      .catch(() => setReportById((prev) => ({ ...prev, [id]: "error" })));
  }

  function refreshAfterAction(id: string) {
    loadReport(id);
    load();
  }

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === "SELISIH" && !r.adaSelisih) return false;
      if (tab === "PERLU_APPROVE" && !needsApproval(r)) return false;
      if (boothId && r.boothId !== boothId) return false;
      if (staffId && r.staffId !== staffId) return false;
      if (q && !r.boothName.toLowerCase().includes(q) && !r.staffName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, tab, boothId, staffId, search]);

  const pending = useMemo(() => (rows ?? []).filter(needsApproval), [rows]);

  const filterAktif = search.trim() !== "" || boothId !== "" || staffId !== "" || tab !== "SEMUA";

  function resetFilter() {
    setSearch("");
    setBoothId("");
    setStaffId("");
    setTab("SEMUA");
  }

  const jumlahSelisih = rows?.filter((r) => r.adaSelisih).length ?? 0;
  const totalCup = rows?.reduce((sum, r) => sum + r.totalJualCup, 0) ?? 0;

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!reportById[id]) loadReport(id);
  }

  function togglePendingExpand(id: string) {
    if (expandedPendingId === id) {
      setExpandedPendingId(null);
      return;
    }
    setExpandedPendingId(id);
    if (!reportById[id]) loadReport(id);
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transaksi Booth" }, { label: "Laporan Kembali" }]} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
            <ClipboardList className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">
              Transaksi Booth - Laporan Kembali
            </h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Laporan stok &amp; kas dari Check Out Petugas Booth. Sisa Stok Fisik otomatis masuk sebagai Return ke Gudang —
              Admin approve Stok Kembali dan Setor Uang di sini.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20">
            <ClipboardList className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Laporan</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{rows?.length ?? 0}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">seluruh Booth</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
            <Clock className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Perlu Approve</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{pending.length}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">Stok Kembali / Setor Uang</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-100 dark:border-rose-900/30">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Ada Selisih Stok</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{jumlahSelisih}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">stok fisik ≠ sistem</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0 border border-sky-100 dark:border-sky-900/30">
            <Coffee className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Jual Cup</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{totalCup}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">seluruh laporan</p>
          </div>
        </div>
      </div>

      {!!pending.length && (
        <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowPending((v) => !v)}
            className="w-full flex items-center gap-3 p-3.5 text-left cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-200 dark:border-amber-900/40">
              <PackageSearch className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-fg">Perlu Approve ({pending.length})</p>
              <p className="text-[11px] text-slate-500 dark:text-fg-muted mt-0.5">
                Laporan Kembali yang Stok Kembali dan/atau Setor Uang-nya masih menunggu di-approve Admin.
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-fg-muted transition-transform ${showPending ? "rotate-180" : ""}`} />
          </button>

          {showPending && (
            <div className="border-t border-amber-200/70 dark:border-amber-900/40 divide-y divide-amber-100 dark:divide-amber-900/30">
              {pending.map((r) => {
                const terbuka = expandedPendingId === r.id;
                const report = reportById[r.id];
                return (
                  <div key={r.id} className="bg-white/70 dark:bg-surface">
                    <button
                      type="button"
                      onClick={() => togglePendingExpand(r.id)}
                      className="w-full flex items-center gap-3 p-3 text-left cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-fg-muted shrink-0 transition-transform ${terbuka ? "rotate-180" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-slate-800 dark:text-fg">{r.boothName}</span>
                          <span className="text-xs text-slate-600 dark:text-fg-secondary">— {r.staffName}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">{waktuJakarta(r.closedAt)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {r.returStatus === "SUBMITTED" && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${RETUR_BADGE.SUBMITTED.kelas}`}>
                            Stok
                          </span>
                        )}
                        {r.setoranStatus === "PENDING" && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${SETORAN_BADGE.PENDING.kelas}`}>
                            Uang
                          </span>
                        )}
                      </div>
                    </button>

                    {terbuka && (
                      <div className="border-t border-amber-100 dark:border-amber-900/30 p-3.5 bg-slate-50/40 dark:bg-surface-hover/20">
                        {report === "loading" || report === undefined ? (
                          <div className="flex justify-center py-8">
                            <Spinner />
                          </div>
                        ) : report === "error" ? (
                          <p className="text-xs text-rose-600 dark:text-rose-400 py-4 text-center">Gagal memuat Laporan Kembali.</p>
                        ) : (
                          <LaporanDetail report={report} shiftId={r.id} onChanged={() => refreshAfterAction(r.id)} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
          <div className="relative flex items-center flex-1 min-w-[200px] sm:max-w-[280px]">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari booth atau petugas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full h-9 pl-9 pr-8 text-xs sm:text-sm font-medium rounded-xl bg-white/90 dark:bg-surface border text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs ${
                search.trim() !== "" ? "border-amber-400 dark:border-amber-500/50" : "border-slate-200/90 dark:border-line"
              }`}
            />
            {search.trim() !== "" && (
              <button
                type="button"
                onClick={() => setSearch("")}
                title="Bersihkan pencarian"
                className="absolute right-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-fg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="w-44">
            <Select
              options={booths.map((b) => ({ value: b.id, label: b.name }))}
              value={boothId}
              onChange={setBoothId}
              placeholder="Semua Booth"
              sizeVariant="sm"
              className="!h-9"
              active={boothId !== ""}
            />
          </div>

          <div className="w-44">
            <Select
              options={staffList.map((s) => ({ value: s.id, label: s.fullName }))}
              value={staffId}
              onChange={setStaffId}
              placeholder="Semua Petugas"
              sizeVariant="sm"
              className="!h-9"
              active={staffId !== ""}
            />
          </div>

          <div className="flex gap-2">
            {([
              ["SEMUA", "Semua"],
              ["PERLU_APPROVE", "Perlu Approve"],
              ["SELISIH", "Ada Selisih"],
            ] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`h-9 px-3 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  tab === key
                    ? "bg-[var(--brand-700)] text-white"
                    : "bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-600 dark:text-fg-secondary hover:bg-slate-50 dark:hover:bg-surface-hover"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filterAktif && (
            <button
              type="button"
              onClick={resetFilter}
              title="Hapus semua filter yang aktif"
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/15 hover:bg-amber-100 dark:hover:bg-amber-900/25 border border-amber-200 dark:border-amber-900/40 text-xs font-semibold text-amber-700 dark:text-amber-400 cursor-pointer transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {!rows ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <tr>
                  <th className="py-3.5 px-3">Tanggal</th>
                  <th className="py-3.5 px-3">Booth</th>
                  <th className="py-3.5 px-3">Petugas</th>
                  <th className="py-3.5 px-3">Waktu Check Out</th>
                  <th className="py-3.5 px-3 text-center">Total Jual Cup</th>
                  <th className="py-3.5 px-3 text-center">Stok Kembali</th>
                  <th className="py-3.5 px-3 text-center">Setor Uang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {filtered.map((r) => {
                  const terbuka = expandedId === r.id;
                  const report = reportById[r.id];
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => toggleExpand(r.id)}
                        className={`cursor-pointer hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors ${terbuka ? "bg-brand-50/30 dark:bg-surface-hover/50" : ""}`}
                      >
                        <td className="py-3 px-3 font-mono font-bold whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${terbuka ? "rotate-180" : ""}`} />
                            <span>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(r.businessDate))}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-fg">{r.boothName}</td>
                        <td className="py-3 px-3 text-slate-700 dark:text-fg-secondary">{r.staffName}</td>
                        <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">{waktuJakarta(r.closedAt)}</td>
                        <td className="py-3 px-3 text-center tabular-nums text-slate-700 dark:text-fg-secondary">{r.totalJualCup} cup</td>
                        <td className="py-3 px-3 text-center">
                          {r.returStatus ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${RETUR_BADGE[r.returStatus].kelas}`}>
                              {RETUR_BADGE[r.returStatus].label.replace("Stok Kembali: ", "")}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-fg-muted text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {r.setoranStatus ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${SETORAN_BADGE[r.setoranStatus].kelas}`}>
                              {SETORAN_BADGE[r.setoranStatus].label.replace("Setor Uang: ", "")}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-fg-muted text-[11px]">-</span>
                          )}
                        </td>
                      </tr>

                      {terbuka && (
                        <tr className="bg-slate-50/60 dark:bg-surface-hover/30">
                          <td colSpan={7} className="p-0">
                            <div className="p-4">
                              {report === "loading" || report === undefined ? (
                                <div className="flex justify-center py-8">
                                  <Spinner />
                                </div>
                              ) : report === "error" ? (
                                <p className="text-xs text-rose-600 dark:text-rose-400 py-4 text-center">Gagal memuat Laporan Kembali.</p>
                              ) : (
                                <LaporanDetail report={report} shiftId={r.id} onChanged={() => refreshAfterAction(r.id)} />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      Tidak ada Laporan Kembali yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TransaksiLaporanKembaliPage() {
  return (
    <RequireAuth>
      <TransaksiLaporanKembaliContent />
    </RequireAuth>
  );
}
