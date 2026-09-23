"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileSpreadsheet,
  FileText,
  MoreVertical,
  PackageSearch,
  Printer,
  Search,
  Send,
  Truck,
  X,
  XCircle,
} from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { PortalMenu } from "@/components/ui/PortalMenu";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type StockHandover, type StockHandoverInTransitTransaction } from "@/lib/api-client";
import { usePersistedFilter } from "@/lib/use-persisted-filter";
import { SerahTerimaNotaPreviewModal } from "./SerahTerimaNotaPreviewModal";
import { SerahTerimaReportPreviewModal } from "./SerahTerimaReportPreviewModal";

const STATUS_LABEL: Record<StockHandover["status"], { label: string; kelas: string }> = {
  DIAJUKAN: { label: "Diajukan", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line" },
  DIPROSES: { label: "Diproses", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
  DITERIMA: { label: "Diterima", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  DITOLAK: { label: "Ditolak", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
  DIBATALKAN: { label: "Dibatalkan", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line" },
};

const LIMIT = 20;
const TANPA_KATEGORI = "Tanpa Kategori";

/// Badge Status "Diterima" perlu dibedakan dari "Diterima · Selisih" (qty
/// diterima Petugas != qty dikirim) — sebelumnya backend sudah kirim flag
/// `discrepancy` tapi tidak pernah dicek di sini, jadi dokumen selisih
/// kelihatan sama persis dengan yang normal.
function statusBadge(r: StockHandover): { label: string; kelas: string } {
  if (r.status === "DITERIMA" && r.discrepancy) {
    return { label: "Diterima · Selisih", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" };
  }
  return STATUS_LABEL[r.status];
}

/// Kelompokkan baris produk berdasarkan Kategori (abjad, "Tanpa Kategori" di
/// akhir), produk dalam tiap Kategori diurutkan abjad juga — backend sudah
/// urut begini, tapi grouping visual (header per Kategori) tetap dibangun di
/// sini karena API cuma balikin array flat.
function kelompokKategori<T extends { productName: string; productCategory: string | null }>(
  items: T[],
): { nama: string; rows: T[] }[] {
  const perKategori = new Map<string, T[]>();
  for (const item of items) {
    const kunci = item.productCategory ?? TANPA_KATEGORI;
    if (!perKategori.has(kunci)) perKategori.set(kunci, []);
    perKategori.get(kunci)!.push(item);
  }
  for (const rows of perKategori.values()) rows.sort((a, b) => a.productName.localeCompare(b.productName, "id"));
  return Array.from(perKategori.entries())
    .map(([nama, rows]) => ({ nama, rows }))
    .sort((a, b) => {
      if (a.nama === TANPA_KATEGORI) return 1;
      if (b.nama === TANPA_KATEGORI) return -1;
      return a.nama.localeCompare(b.nama, "id");
    });
}

/// Gabungan jenis+sumber jadi satu label yang langsung menjelaskan asal
/// dokumen — sebelumnya Jenis ("Stok Awal"/"Re-Stok") dan Sumber
/// ("Admin"/"Petugas") ditampilkan terpisah, jadi baris pengajuan Petugas
/// (jenis masih null) terlihat kosong ("-") padahal itu Ajukan Stok dari
/// Petugas. Urutan pengecekan: STOK_AWAL menang duluan (jarang lewat
/// pengajuan Petugas), baru kind "request" (jenis selalu null), baru
/// RE_STOK dibedakan Admin/Petugas.
function keteranganDokumen(r: StockHandover): { label: string; kelas: string } {
  if (r.jenis === "STOK_AWAL") {
    return { label: "Kirim Stok (Awal)", kelas: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" };
  }
  if (r.kind === "request") {
    return { label: "Pengajuan dari Petugas", kelas: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20" };
  }
  if (r.sumber === "ADMIN") {
    return { label: "Kirim Stok (Re-Stok)", kelas: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" };
  }
  return { label: "Re-Stok dari Petugas", kelas: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20" };
}

function tanggalJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function waktuJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function SerahTerimaStokContent() {
  const toast = useToast();
  const [rows, setRows] = useState<StockHandover[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [inTransit, setInTransit] = useState<StockHandoverInTransitTransaction[] | null>(null);
  const [showInTransit, setShowInTransit] = useState(true);
  const [expandedInTransitId, setExpandedInTransitId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = usePersistedFilter("serah-terima-stok:search", "");
  const [search, setSearch] = useState("");
  const [statusFilterRaw, setStatusFilterRaw] = usePersistedFilter("serah-terima-stok:status", "");
  const statusFilter = statusFilterRaw as "" | StockHandover["status"];
  const setStatusFilter = (v: "" | StockHandover["status"]) => setStatusFilterRaw(v);
  const [unduhExcel, setUnduhExcel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [notaTarget, setNotaTarget] = useState<StockHandover | null>(null);
  const [actionMenuRowId, setActionMenuRowId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [metrics, setMetrics] = useState({ diajukan: 0, diproses: 0, diterima: 0 });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest?.("[data-action-menu]")) setActionMenuRowId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    api
      .getStockHandoverInTransit()
      .then(setInTransit)
      .catch(() => setInTransit([]));
  }, []);

  // Kartu ringkasan per status — panggilan ringan terpisah (limit:1), bukan
  // dari `rows` yang sekarang cuma satu halaman.
  useEffect(() => {
    Promise.all([
      api.getStockHandovers({ limit: 1, status: "DIAJUKAN" }),
      api.getStockHandovers({ limit: 1, status: "DIPROSES" }),
      api.getStockHandovers({ limit: 1, status: "DITERIMA" }),
    ])
      .then(([diajukan, diproses, diterima]) =>
        setMetrics({ diajukan: diajukan.total, diproses: diproses.total, diterima: diterima.total }),
      )
      .catch(() => {});
  }, []);

  // Debounce pencarian 400ms supaya tidak fetch server tiap ketikan.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    setLoading(true);
    api
      .getStockHandovers({ page, limit: LIMIT, search: search || undefined, status: statusFilter || undefined })
      .then((res) => {
        setRows(res.rows);
        setTotal(res.total);
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar Serah Terima Stok.");
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const reportFilter = { q: search || undefined, status: statusFilter || undefined };
  const filterAktif = searchInput.trim() !== "" || statusFilter !== "";

  function resetFilter() {
    setSearchInput("");
    setStatusFilter("");
  }

  async function unduhLaporanExcel() {
    setUnduhExcel(true);
    try {
      const blob = await api.getStockHandoverReport("excel", reportFilter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `serah-terima-stok-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transaksi" }, { label: "Serah Terima Stok" }]} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
            <Truck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">
              Serah Terima Stok
            </h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Kirim stok ke Petugas Aktif, atau proses pengajuan dari Petugas.
            </p>
          </div>
        </div>

        <Link href="/serah-terima-stok/baru">
          <Button variant="primary" size="sm" leftIcon={<Send className="w-3.5 h-3.5" />}>
            Kirim Stok
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20">
            <Truck className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Dokumen</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{total}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">sesuai filter</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-line">
            <Clock className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Diajukan</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.diajukan}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">menunggu diproses</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
            <Truck className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Diproses</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.diproses}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">menunggu diterima</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Diterima</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.diterima}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">stok booth sudah bertambah</p>
          </div>
        </div>
      </div>

      {!!inTransit?.length && (
        <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 shadow-2xs overflow-hidden">
          <button
            type="button"
            onClick={() => setShowInTransit((v) => !v)}
            className="w-full flex items-center gap-3 p-3.5 text-left cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-200 dark:border-amber-900/40">
              <PackageSearch className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-fg">Stok Sedang Diproses (In-Transit)</p>
              <p className="text-[11px] text-slate-500 dark:text-fg-muted mt-0.5">
                {inTransit.length} dokumen masih dalam perjalanan, belum dikonfirmasi diterima Petugas.
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-fg-muted transition-transform ${showInTransit ? "rotate-180" : ""}`} />
          </button>

          {showInTransit && (
            <div className="border-t border-amber-200/70 dark:border-amber-900/40 divide-y divide-amber-100 dark:divide-amber-900/30">
              {inTransit.map((trx) => {
                const terbuka = expandedInTransitId === trx.distributionId;
                return (
                  <div key={trx.distributionId} className="bg-white/70 dark:bg-surface">
                    <button
                      type="button"
                      onClick={() => setExpandedInTransitId(terbuka ? null : trx.distributionId)}
                      className="w-full flex items-center gap-3 p-3 text-left cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-colors"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-fg-muted shrink-0 transition-transform ${terbuka ? "rotate-180" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-slate-800 dark:text-fg">{trx.distributionNo}</span>
                          <span className="text-xs text-slate-600 dark:text-fg-secondary">
                            <span className="font-semibold text-slate-800 dark:text-fg">{trx.boothName}</span>
                            {" — "}
                            {trx.staffName ?? "Petugas belum Check-In"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">
                          {trx.sentAt ? waktuJakarta(trx.sentAt) : "-"} · {trx.items.length} produk
                        </p>
                      </div>
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400 shrink-0">{trx.totalQty} cup</span>
                    </button>

                    {terbuka && (
                      <div className="border-t border-amber-100 dark:border-amber-900/30 overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-amber-100/40 dark:bg-amber-900/15 text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                            <tr>
                              <th className="py-2 px-3.5 pl-10">Produk</th>
                              <th className="py-2 px-3.5 text-right">Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30">
                            {kelompokKategori(trx.items).map((k) => (
                              <Fragment key={k.nama}>
                                <tr className="bg-amber-100/20 dark:bg-amber-900/5">
                                  <td colSpan={2} className="py-1.5 px-3.5 pl-10">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-fg-muted">{k.nama}</span>
                                  </td>
                                </tr>
                                {k.rows.map((item) => (
                                  <tr key={item.productId}>
                                    <td className="py-2 px-3.5 pl-10 font-medium text-slate-700 dark:text-fg-secondary">{item.productName}</td>
                                    <td className="py-2 px-3.5 text-right font-bold text-slate-700 dark:text-fg-secondary">{item.qty} cup</td>
                                  </tr>
                                ))}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
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
              placeholder="Cari no. dokumen atau petugas..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`w-full h-9 pl-9 pr-8 text-xs sm:text-sm font-medium rounded-xl bg-white/90 dark:bg-surface border text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs ${
                searchInput.trim() !== "" ? "border-amber-400 dark:border-amber-500/50" : "border-slate-200/90 dark:border-line"
              }`}
            />
            {searchInput.trim() !== "" && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                title="Bersihkan pencarian"
                className="absolute right-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-fg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="w-40">
            <Select
              options={[
                { value: "DIAJUKAN", label: "Diajukan" },
                { value: "DIPROSES", label: "Diproses" },
                { value: "DITERIMA", label: "Diterima" },
                { value: "DITOLAK", label: "Ditolak" },
                { value: "DIBATALKAN", label: "Dibatalkan" },
              ]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              placeholder="Semua Status"
              sizeVariant="sm"
              className="!h-9"
              active={statusFilter !== ""}
            />
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

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setShowPreview(true)}
            title="Pratinjau & cetak PDF daftar Serah Terima Stok sesuai filter di layar"
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={unduhLaporanExcel}
            disabled={unduhExcel}
            title="Unduh Excel daftar Serah Terima Stok sesuai filter di layar"
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            <span>{unduhExcel ? "Menyiapkan..." : "Excel"}</span>
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
                  <th className="py-3.5 px-3">No. Dokumen</th>
                  <th className="py-3.5 px-3">Tanggal</th>
                  <th className="py-3.5 px-3">Petugas</th>
                  <th className="py-3.5 px-3">Booth</th>
                  <th className="py-3.5 px-3">Keterangan</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {rows.map((r) => {
                  const status = statusBadge(r);
                  const keterangan = keteranganDokumen(r);
                  const terbuka = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                    <tr
                      onClick={() => setExpandedId(terbuka ? null : r.id)}
                      className={`cursor-pointer hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors ${terbuka ? "bg-brand-50/30 dark:bg-surface-hover/50" : ""}`}
                    >
                      <td className="py-3 px-3 font-mono font-bold">
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${terbuka ? "rotate-180" : ""}`} />
                          <Link
                            href={`/serah-terima-stok/${r.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[var(--brand-700)] dark:text-brand-400 hover:underline"
                          >
                            {r.docNo}
                          </Link>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">
                        {tanggalJakarta(r.date)}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-fg">{r.staffName ?? "-"}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary">{r.boothName}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${keterangan.kelas}`}>
                          {keterangan.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${status.kelas}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotaTarget(r);
                            }}
                            title="Pratinjau & cetak nota dokumen ini"
                            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200/90 dark:border-line bg-white/80 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-600 dark:text-fg-muted hover:text-[var(--brand-700)] dark:hover:text-brand-400 text-[11px] font-semibold shadow-2xs cursor-pointer transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          <div className="relative" data-action-menu>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const buka = actionMenuRowId !== r.id;
                                setActionMenuAnchor(buka ? e.currentTarget : null);
                                setActionMenuRowId(buka ? r.id : null);
                              }}
                              className={`w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:text-[var(--brand-700)] dark:hover:text-brand-400 shadow-2xs cursor-pointer transition-colors ${
                                actionMenuRowId === r.id
                                  ? "bg-brand-50 text-[var(--brand-700)] border-brand-300"
                                  : "bg-white/80 dark:bg-surface hover:bg-slate-50"
                              }`}
                              title="Aksi Lainnya"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            <PortalMenu
                              open={actionMenuRowId === r.id}
                              anchor={actionMenuAnchor}
                              width={200}
                              onClose={() => setActionMenuRowId(null)}
                              className="rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-xl py-1.5 text-left"
                            >
                              <Link
                                href={`/serah-terima-stok/${r.id}`}
                                onClick={() => setActionMenuRowId(null)}
                                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-fg hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors text-left"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                <span>Lihat Detail</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMenuRowId(null);
                                  setNotaTarget(r);
                                }}
                                className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-fg hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors text-left cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5 text-[var(--brand-700)]" />
                                <span>Cetak Nota</span>
                              </button>
                            </PortalMenu>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {terbuka && (
                      <tr className="bg-slate-50/60 dark:bg-surface-hover/30">
                        <td colSpan={7} className="p-0">
                          <div className="p-4">
                            <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-line bg-white dark:bg-surface">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-100/70 dark:bg-surface-hover text-[11px] font-bold text-slate-600 dark:text-fg-secondary">
                                  <tr>
                                    <th className="py-2 px-3 text-left">Produk</th>
                                    <th className="py-2 px-3 text-right">Qty Dikirim/Diajukan</th>
                                    <th className="py-2 px-3 text-right">Qty Diterima</th>
                                    <th className="py-2 px-3 text-right">Selisih</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-line">
                                  {r.items.map((item) => {
                                    const selisih = item.qtyReceived == null ? null : item.qtyReceived - item.qty;
                                    return (
                                      <tr key={item.productId} className={selisih ? "bg-rose-50/40 dark:bg-rose-900/10" : undefined}>
                                        <td className="py-2 px-3 text-slate-800 dark:text-fg font-medium">{item.productName}</td>
                                        <td className="py-2 px-3 text-right tabular-nums font-semibold">{item.qty}</td>
                                        <td
                                          className={`py-2 px-3 text-right tabular-nums font-semibold ${
                                            selisih ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-fg-secondary"
                                          }`}
                                        >
                                          {item.qtyReceived ?? "-"}
                                        </td>
                                        <td className="py-2 px-3 text-right tabular-nums font-bold text-rose-600 dark:text-rose-400">
                                          {selisih ? (selisih > 0 ? `+${selisih}` : selisih) : "-"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {r.note && (
                              <div
                                className={`mt-2.5 rounded-lg border px-3 py-2 text-xs ${
                                  r.discrepancy
                                    ? "border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 text-rose-700 dark:text-rose-400"
                                    : "border-slate-200 dark:border-line bg-slate-50 dark:bg-surface-hover/40 text-slate-500 dark:text-fg-muted"
                                }`}
                              >
                                <span className="font-bold">Catatan: </span>
                                {r.note}
                              </div>
                            )}
                            <Link
                              href={`/serah-terima-stok/${r.id}`}
                              className="inline-block mt-3 text-xs font-semibold text-[var(--brand-700)] dark:text-brand-400 hover:underline"
                            >
                              Buka detail lengkap →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      {total === 0 ? "Belum ada dokumen Serah Terima Stok." : "Memuat..."}
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
              Menampilkan {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} dari {total} dokumen
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

      <SerahTerimaReportPreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} filter={reportFilter} />

      {notaTarget && (
        <SerahTerimaNotaPreviewModal
          isOpen={!!notaTarget}
          onClose={() => setNotaTarget(null)}
          handoverId={notaTarget.id}
          docNo={notaTarget.docNo}
        />
      )}
    </div>
  );
}

export default function SerahTerimaStokPage() {
  return (
    <RequireAuth>
      <SerahTerimaStokContent />
    </RequireAuth>
  );
}
