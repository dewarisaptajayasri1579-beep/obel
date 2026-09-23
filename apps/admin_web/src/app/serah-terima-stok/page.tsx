"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
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
} from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { PortalMenu } from "@/components/ui/PortalMenu";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type StockHandover, type StockHandoverInTransitItem } from "@/lib/api-client";
import { SerahTerimaNotaPreviewModal } from "./SerahTerimaNotaPreviewModal";
import { SerahTerimaReportPreviewModal } from "./SerahTerimaReportPreviewModal";

const STATUS_LABEL: Record<StockHandover["status"], { label: string; kelas: string }> = {
  DIAJUKAN: { label: "Diajukan", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line" },
  DIPROSES: { label: "Diproses", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
  DITERIMA: { label: "Diterima", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  DITOLAK: { label: "Ditolak", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
  DIBATALKAN: { label: "Dibatalkan", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line" },
};

const JENIS_LABEL: Record<string, string> = { STOK_AWAL: "Stok Awal", RE_STOK: "Re-Stok" };
const SUMBER_LABEL: Record<string, string> = { PETUGAS: "Petugas", ADMIN: "Admin" };

function tanggalJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function SerahTerimaStokContent() {
  const toast = useToast();
  const [rows, setRows] = useState<StockHandover[] | null>(null);
  const [inTransit, setInTransit] = useState<StockHandoverInTransitItem[] | null>(null);
  const [showInTransit, setShowInTransit] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StockHandover["status"]>("");
  const [unduhExcel, setUnduhExcel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [notaTarget, setNotaTarget] = useState<StockHandover | null>(null);
  const [actionMenuRowId, setActionMenuRowId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest?.("[data-action-menu]")) setActionMenuRowId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    api
      .getStockHandovers()
      .then(setRows)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar Serah Terima Stok.");
        setRows([]);
      });
    api
      .getStockHandoverInTransit()
      .then(setInTransit)
      .catch(() => setInTransit([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const cocokTeks = !q || r.docNo.toLowerCase().includes(q) || (r.staffName ?? "").toLowerCase().includes(q);
      const cocokStatus = !statusFilter || r.status === statusFilter;
      return cocokTeks && cocokStatus;
    });
  }, [rows, search, statusFilter]);

  const metrics = useMemo(
    () => ({
      total: rows?.length ?? 0,
      diajukan: rows?.filter((r) => r.status === "DIAJUKAN").length ?? 0,
      diproses: rows?.filter((r) => r.status === "DIPROSES").length ?? 0,
      diterima: rows?.filter((r) => r.status === "DITERIMA").length ?? 0,
    }),
    [rows],
  );

  const reportFilter = useMemo(() => ({ q: search.trim() || undefined, status: statusFilter || undefined }), [search, statusFilter]);

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
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.total}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">dokumen</p>
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
                {inTransit.length} produk masih dalam perjalanan, belum dikonfirmasi diterima Petugas.
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-fg-muted transition-transform ${showInTransit ? "rotate-180" : ""}`} />
          </button>

          {showInTransit && (
            <div className="border-t border-amber-200/70 dark:border-amber-900/40 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-amber-100/40 dark:bg-amber-900/15 text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                  <tr>
                    <th className="py-2.5 px-3.5">Produk</th>
                    <th className="py-2.5 px-3.5 text-right">Total Qty</th>
                    <th className="py-2.5 px-3.5">Tujuan Booth &amp; Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 dark:divide-amber-900/30 bg-white/70 dark:bg-surface">
                  {inTransit.map((item) => (
                    <tr key={item.productId}>
                      <td className="py-2.5 px-3.5 font-semibold text-slate-800 dark:text-fg">{item.productName}</td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-amber-700 dark:text-amber-400">{item.totalQty} cup</td>
                      <td className="py-2.5 px-3.5 text-slate-600 dark:text-fg-secondary">
                        <div className="flex flex-col gap-1">
                          {item.destinations.map((d) => (
                            <span key={d.boothId}>
                              <span className="font-semibold text-slate-800 dark:text-fg">{d.boothName}</span>
                              {" — "}
                              {d.staffName ?? "Petugas belum Check-In"}
                              <span className="text-slate-400 dark:text-fg-muted"> ({d.qty} cup)</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3.5 text-xs sm:text-sm font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 px-3 rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer focus:outline-none shadow-2xs"
          >
            <option value="">Semua Status</option>
            <option value="DIAJUKAN">Diajukan</option>
            <option value="DIPROSES">Diproses</option>
            <option value="DITERIMA">Diterima</option>
            <option value="DITOLAK">Ditolak</option>
            <option value="DIBATALKAN">Dibatalkan</option>
          </select>

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
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <tr>
                  <th className="py-3.5 px-3">No. Dokumen</th>
                  <th className="py-3.5 px-3">Tanggal</th>
                  <th className="py-3.5 px-3">Petugas</th>
                  <th className="py-3.5 px-3">Booth</th>
                  <th className="py-3.5 px-3">Jenis</th>
                  <th className="py-3.5 px-3">Sumber</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {filtered.map((r) => {
                  const status = STATUS_LABEL[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold">
                        <Link href={`/serah-terima-stok/${r.id}`} className="text-[var(--brand-700)] dark:text-brand-400 hover:underline">
                          {r.docNo}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">
                        {tanggalJakarta(r.date)}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-fg">{r.staffName ?? "-"}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary">{r.boothName}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-muted">{r.jenis ? JENIS_LABEL[r.jenis] : "-"}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-muted">{SUMBER_LABEL[r.sumber]}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${status.kelas}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setNotaTarget(r)}
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
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      {rows.length === 0 ? "Belum ada dokumen Serah Terima Stok." : "Tidak ada yang cocok dengan pencarian."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
