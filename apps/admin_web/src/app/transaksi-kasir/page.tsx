"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  CheckCircle2,
  Ban,
  History,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Search,
  Download,
  ExternalLink,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth, type SaleDetail, type SaleListItem, type UserAccount } from "@/lib/api-client";
import { KasirReportPreviewModal } from "./KasirReportPreviewModal";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const LIMIT = 20;

type Periode = "SEMUA" | "HARI_INI" | "MINGGU_INI" | "BULAN_INI";

const PERIODE_OPTIONS: { value: Periode; label: string }[] = [
  { value: "SEMUA", label: "Semua Periode" },
  { value: "HARI_INI", label: "Hari Ini" },
  { value: "MINGGU_INI", label: "Minggu Ini" },
  { value: "BULAN_INI", label: "Bulan Ini" },
];

/// Batas awal periode di zona Asia/Jakarta (offset tetap +7, tidak ada DST)
/// — dikirim ke server sebagai `dari` (bukan difilter di klien lagi, lihat
/// percakapan soal performa saat data banyak).
function batasAwalPeriode(periode: Periode, now: Date): Date | null {
  const j = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  if (periode === "HARI_INI") {
    return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate()) - JAKARTA_OFFSET_MS);
  }
  if (periode === "MINGGU_INI") {
    const dow = j.getUTCDay(); // 0=Min..6=Sab
    const senin = dow === 0 ? -6 : 1 - dow;
    return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate() + senin) - JAKARTA_OFFSET_MS);
  }
  if (periode === "BULAN_INI") {
    return new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), 1) - JAKARTA_OFFSET_MS);
  }
  return null;
}

const STATUS_LABEL: Record<SaleListItem["status"], { label: string; kelas: string }> = {
  PENDING: { label: "Pending", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line" },
  PAID: { label: "Lunas", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  VOIDED: { label: "Dibatalkan", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
};

const METODE_LABEL: Record<SaleListItem["paymentMethod"], string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  SPLIT: "Split",
};

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function waktuJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function TransaksiKasirContent() {
  const toast = useToast();
  const [rows, setRows] = useState<SaleListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState(""); // versi debounced, dipakai buat fetch
  const [statusFilter, setStatusFilter] = useState<"" | SaleListItem["status"]>("");
  const [boothId, setBoothId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [periodeFilter, setPeriodeFilter] = useState<Periode>("SEMUA");

  const [booths, setBooths] = useState<Booth[]>([]);
  const [staffList, setStaffList] = useState<UserAccount[]>([]);

  const [mengunduh, setMengunduh] = useState(false);
  const [unduhExcel, setUnduhExcel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<Record<string, SaleDetail | "loading" | "error">>({});

  // Opsi dropdown Booth/Petugas — master data bounded, cukup sekali muat,
  // TIDAK diturunkan dari baris tabel (yang sekarang cuma satu halaman).
  useEffect(() => {
    api.getBooths().then(setBooths).catch(() => {});
    api
      .getUsers()
      .then((users) => setStaffList(users.filter((u) => u.role === "BOOTH_STAFF")))
      .catch(() => {});
  }, []);

  // Debounce pencarian teks 400ms supaya tidak fetch server tiap ketikan.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Filter berubah → balik ke halaman 1.
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, boothId, staffId, periodeFilter]);

  useEffect(() => {
    setLoading(true);
    const awalPeriode = batasAwalPeriode(periodeFilter, new Date());
    api
      .getSales({
        page,
        limit: LIMIT,
        search: search || undefined,
        status: statusFilter || undefined,
        boothId: boothId || undefined,
        staffId: staffId || undefined,
        dari: awalPeriode ? awalPeriode.toISOString() : undefined,
      })
      .then((res) => {
        setRows(res.rows);
        setTotal(res.total);
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar Transaksi Kasir.");
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, boothId, staffId, periodeFilter]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const reportFilter = useMemo(() => {
    const awalPeriode = batasAwalPeriode(periodeFilter, new Date());
    return {
      q: search || undefined,
      status: statusFilter || undefined,
      boothName: booths.find((b) => b.id === boothId)?.name,
      staffName: staffList.find((s) => s.id === staffId)?.fullName,
      periodeAwal: awalPeriode ? awalPeriode.toISOString() : undefined,
    };
  }, [search, statusFilter, boothId, staffId, periodeFilter, booths, staffList]);

  function toggleExpand(saleId: string) {
    const next = expandedId === saleId ? null : saleId;
    setExpandedId(next);
    if (next && !expandedDetail[next]) {
      setExpandedDetail((prev) => ({ ...prev, [next]: "loading" }));
      api
        .getSaleDetail(next)
        .then((d) => setExpandedDetail((prev) => ({ ...prev, [next]: d })))
        .catch(() => setExpandedDetail((prev) => ({ ...prev, [next]: "error" })));
    }
  }

  // Ringkasan status/omzet dihitung server-side lewat panggilan terpisah
  // (bukan dari `rows`, yang cuma satu halaman) — lebih murah dari menambah
  // agregasi ke findAll(), tapi tetap tidak menarik semua baris ke klien.
  const [metrics, setMetrics] = useState({ lunas: 0, dibatalkan: 0, direvisi: 0, omzet: 0 });
  useEffect(() => {
    Promise.all([
      api.getSales({ limit: 1, status: "PAID" }),
      api.getSales({ limit: 1, status: "VOIDED" }),
    ])
      .then(([lunas, dibatalkan]) => {
        setMetrics((m) => ({ ...m, lunas: lunas.total, dibatalkan: dibatalkan.total }));
      })
      .catch(() => {});
  }, []);

  async function unduhCsv() {
    setMengunduh(true);
    try {
      const awalPeriode = batasAwalPeriode(periodeFilter, new Date());
      const res = await api.getSales({
        limit: 1000,
        search: search || undefined,
        status: statusFilter || undefined,
        boothId: boothId || undefined,
        staffId: staffId || undefined,
        dari: awalPeriode ? awalPeriode.toISOString() : undefined,
      });
      const header = "No. Sale,Tanggal,Shift,Petugas,Booth,Cup,Total,Metode,Status";
      const baris = res.rows.map((s) =>
        [
          s.saleNo,
          waktuJakarta(s.paidAt ?? s.createdAt),
          s.shiftLabel,
          `"${s.staffName}"`,
          `"${s.boothName}"`,
          s.cupCount,
          s.total,
          METODE_LABEL[s.paymentMethod],
          STATUS_LABEL[s.status].label,
        ].join(","),
      );
      const csv = [header, ...baris].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transaksi-kasir-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyiapkan CSV.");
    } finally {
      setMengunduh(false);
    }
  }

  async function unduhLaporanExcel() {
    setUnduhExcel(true);
    try {
      const blob = await api.getKasirReport("excel", reportFilter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transaksi-kasir-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengunduh Excel.");
    } finally {
      setUnduhExcel(false);
    }
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transaksi Booth" }, { label: "Kasir" }]} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
            <ShoppingCart className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">
              Transaksi Booth - Kasir
            </h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Seluruh transaksi kasir dari semua Booth. Read-only — koreksi lewat Batalkan/Revisi di halaman detail.
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
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Transaksi</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{total}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">sesuai filter</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Lunas</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.lunas}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">seluruh waktu</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-100 dark:border-rose-900/30">
            <Ban className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Dibatalkan</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.dibatalkan}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">status VOIDED</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
            <History className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Halaman</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">
              {page} / {totalPages}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">{LIMIT} per halaman</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
          <div className="relative flex items-center flex-1 min-w-[200px] sm:max-w-[280px]">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari no. sale atau petugas..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-9 pl-9 pr-3.5 text-xs sm:text-sm font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 px-3 rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer focus:outline-none shadow-2xs"
          >
            <option value="">Semua Status</option>
            <option value="PAID">Lunas</option>
            <option value="VOIDED">Dibatalkan</option>
            <option value="PENDING">Pending</option>
          </select>

          <select
            value={boothId}
            onChange={(e) => setBoothId(e.target.value)}
            className="h-9 px-3 rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer focus:outline-none shadow-2xs"
          >
            <option value="">Semua Booth</option>
            {booths.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="h-9 px-3 rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer focus:outline-none shadow-2xs"
          >
            <option value="">Semua Petugas</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>

          <select
            value={periodeFilter}
            onChange={(e) => setPeriodeFilter(e.target.value as Periode)}
            className="h-9 px-3 rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer focus:outline-none shadow-2xs"
          >
            {PERIODE_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setShowPreview(true)}
            title="Pratinjau & cetak PDF daftar Transaksi Kasir sesuai filter di layar"
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={unduhLaporanExcel}
            disabled={unduhExcel}
            title="Unduh Excel daftar Transaksi Kasir sesuai filter di layar"
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            <span>{unduhExcel ? "Menyiapkan..." : "Excel"}</span>
          </button>

          <button
            type="button"
            onClick={unduhCsv}
            disabled={mengunduh || total === 0}
            title="Unduh CSV daftar Transaksi Kasir sesuai filter di layar (maks 1000 baris)"
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>{mengunduh ? "Menyiapkan..." : "CSV"}</span>
          </button>
        </div>

        {!rows ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line relative">
            {loading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-surface/60 flex items-center justify-center z-10">
                <Spinner size="sm" />
              </div>
            )}
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <tr>
                  <th className="py-3.5 px-3">No. Sale</th>
                  <th className="py-3.5 px-3">Tanggal</th>
                  <th className="py-3.5 px-3">Shift</th>
                  <th className="py-3.5 px-3">Petugas</th>
                  <th className="py-3.5 px-3">Booth</th>
                  <th className="py-3.5 px-3 text-right">Cup</th>
                  <th className="py-3.5 px-3 text-right">Total</th>
                  <th className="py-3.5 px-3">Metode</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {rows.map((s) => {
                  const status = STATUS_LABEL[s.status];
                  const terbuka = expandedId === s.id;
                  const detail = expandedDetail[s.id];
                  return (
                    <Fragment key={s.id}>
                      <tr
                        onClick={() => toggleExpand(s.id)}
                        className={`cursor-pointer hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors ${terbuka ? "bg-brand-50/30 dark:bg-surface-hover/50" : ""}`}
                      >
                        <td className="py-3 px-3 font-mono font-bold">
                          <div className="flex items-center gap-1.5">
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${terbuka ? "rotate-180" : ""}`} />
                            <span>{s.saleNo}</span>
                          </div>
                          {s.isRevised && <span className="ml-5 text-[10px] font-normal text-amber-500">direvisi</span>}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">
                          {waktuJakarta(s.paidAt ?? s.createdAt)}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">{s.shiftLabel}</td>
                        <td className="py-3 px-3 text-slate-700 dark:text-fg-secondary">{s.staffName}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-fg">{s.boothName}</td>
                        <td className="py-3 px-3 text-right tabular-nums text-slate-700 dark:text-fg-secondary">{s.cupCount}</td>
                        <td className="py-3 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-fg">
                          {formatRupiah(s.total)}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary">{METODE_LABEL[s.paymentMethod]}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${status.kelas}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center">
                            <Link
                              href={`/transaksi-kasir/${s.id}`}
                              onClick={(e) => e.stopPropagation()}
                              title="Buka halaman detail lengkap (koreksi)"
                              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200/90 dark:border-line bg-white/80 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-600 dark:text-fg-muted hover:text-[var(--brand-700)] dark:hover:text-brand-400 text-[11px] font-semibold shadow-2xs cursor-pointer transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Buka</span>
                            </Link>
                          </div>
                        </td>
                      </tr>

                      {terbuka && (
                        <tr className="bg-slate-50/60 dark:bg-surface-hover/30">
                          <td colSpan={10} className="p-0">
                            {detail === "loading" || !detail ? (
                              <div className="flex justify-center py-6">
                                <Spinner size="sm" />
                              </div>
                            ) : detail === "error" ? (
                              <p className="text-center text-rose-500 py-6 text-xs">Gagal memuat detail transaksi.</p>
                            ) : (
                              <div className="p-4 space-y-3">
                                <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-line bg-white dark:bg-surface">
                                  <table className="w-full text-xs">
                                    <thead className="bg-slate-100/70 dark:bg-surface-hover text-[11px] font-bold text-slate-600 dark:text-fg-secondary">
                                      <tr>
                                        <th className="py-2 px-3 text-left">Produk</th>
                                        <th className="py-2 px-3 text-right">Qty</th>
                                        <th className="py-2 px-3 text-right">Harga Satuan</th>
                                        <th className="py-2 px-3 text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-line">
                                      {detail.items.map((item) => (
                                        <tr key={item.productId}>
                                          <td className="py-2 px-3 text-slate-800 dark:text-fg font-medium">{item.productName}</td>
                                          <td className="py-2 px-3 text-right tabular-nums">{item.qty}</td>
                                          <td className="py-2 px-3 text-right tabular-nums">{formatRupiah(item.unitPrice)}</td>
                                          <td className="py-2 px-3 text-right tabular-nums font-semibold">{formatRupiah(item.lineTotal)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-fg-secondary">
                                  <span>
                                    Subtotal: <strong className="text-slate-900 dark:text-fg">{formatRupiah(detail.subtotal)}</strong>
                                  </span>
                                  {detail.discount > 0 && (
                                    <span>
                                      Diskon: <strong className="text-slate-900 dark:text-fg">-{formatRupiah(detail.discount)}</strong>
                                    </span>
                                  )}
                                  <span>
                                    Pembayaran:{" "}
                                    <strong className="text-slate-900 dark:text-fg">
                                      {detail.payments.map((p) => `${METODE_LABEL[p.method]} ${formatRupiah(p.amount)}`).join(" + ")}
                                    </strong>
                                  </span>
                                  {detail.status === "VOIDED" && detail.voidReason && (
                                    <span className="text-rose-600 dark:text-rose-400">Dibatalkan: {detail.voidReason}</span>
                                  )}
                                </div>

                                <Link
                                  href={`/transaksi-kasir/${s.id}`}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-700)] dark:text-brand-400 hover:underline"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Buka detail lengkap untuk Batalkan/Revisi/Refund →
                                </Link>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      {total === 0 ? "Belum ada transaksi yang cocok." : "Memuat..."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between gap-3 mt-3.5 flex-wrap">
            <p className="text-[11px] text-slate-500 dark:text-fg-muted">
              Menampilkan {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} dari {total} transaksi
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-surface-hover cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-700 dark:text-fg-secondary px-2">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-surface-hover cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <KasirReportPreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} filter={reportFilter} />
    </div>
  );
}

export default function TransaksiKasirPage() {
  return (
    <RequireAuth>
      <TransaksiKasirContent />
    </RequireAuth>
  );
}
