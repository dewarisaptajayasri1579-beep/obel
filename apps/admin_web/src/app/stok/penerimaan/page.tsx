"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  MoreVertical,
  PackagePlus,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PortalMenu } from "@/components/ui/PortalMenu";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type StockReceipt } from "@/lib/api-client";
import { PenerimaanReportPreviewModal } from "./PenerimaanReportPreviewModal";
import { PenerimaanNotaPreviewModal } from "./PenerimaanNotaPreviewModal";

const STATUS_LABEL: Record<StockReceipt["status"], { label: string; kelas: string }> = {
  DRAFT: { label: "Draft", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line" },
  POSTED: { label: "Posted", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  REVISED: { label: "Revised", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
};

function tanggalJakarta(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function PenerimaanContent() {
  const toast = useToast();
  const [receipts, setReceipts] = useState<StockReceipt[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | StockReceipt["status"]>("");
  const [unduhExcel, setUnduhExcel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [notaTarget, setNotaTarget] = useState<StockReceipt | null>(null);
  const [hapusTarget, setHapusTarget] = useState<StockReceipt | null>(null);
  const [menghapus, setMenghapus] = useState(false);
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
      .getStockReceipts()
      .then(setReceipts)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat daftar Tambah Stok Gudang.");
        setReceipts([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!receipts) return [];
    const q = search.trim().toLowerCase();
    return receipts.filter((r) => {
      const cocokTeks = !q || r.receiptNo.toLowerCase().includes(q) || (r.note ?? "").toLowerCase().includes(q);
      const cocokStatus = !statusFilter || r.status === statusFilter;
      return cocokTeks && cocokStatus;
    });
  }, [receipts, search, statusFilter]);

  const metrics = useMemo(
    () => ({
      total: receipts?.length ?? 0,
      draft: receipts?.filter((r) => r.status === "DRAFT").length ?? 0,
      posted: receipts?.filter((r) => r.status === "POSTED").length ?? 0,
      revised: receipts?.filter((r) => r.status === "REVISED").length ?? 0,
    }),
    [receipts],
  );

  const reportFilter = useMemo(() => ({ q: search.trim() || undefined, status: statusFilter || undefined }), [search, statusFilter]);

  async function unduhLaporanExcel() {
    setUnduhExcel(true);
    try {
      const blob = await api.getStockReceiptReport("excel", reportFilter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terima-stok-gudang-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengunduh Excel.");
    } finally {
      setUnduhExcel(false);
    }
  }

  async function hapusDraft() {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      await api.deleteStockReceipt(hapusTarget.id);
      toast.success(`Draft ${hapusTarget.receiptNo} dihapus.`);
      setReceipts((semua) => semua?.filter((r) => r.id !== hapusTarget.id) ?? semua);
      setHapusTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menghapus draft.");
    } finally {
      setMenghapus(false);
    }
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transaksi Kantor" }, { label: "Tambah Stok Gudang" }]} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
            <PackagePlus className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">
              Tambah Stok Gudang
            </h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Barang masuk ke Gudang Pusat. Posting menambah stok &amp; tercatat di Mutasi Stok.
            </p>
          </div>
        </div>

        <Link href="/stok/penerimaan/baru">
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Tambah
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20">
            <ClipboardList className="w-4.5 h-4.5" />
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
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Draft</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.draft}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">belum diposting</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Posted</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.posted}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">stok sudah bertambah</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
            <History className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Revised</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.revised}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">sudah digantikan revisi</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
          <div className="relative flex items-center flex-1 min-w-[200px] sm:max-w-[280px]">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari no. bukti atau keterangan..."
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
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="REVISED">Revised</option>
          </select>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setShowPreview(true)}
            title="Pratinjau & cetak PDF daftar Tambah Stok Gudang sesuai filter di layar"
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={unduhLaporanExcel}
            disabled={unduhExcel}
            title="Unduh Excel daftar Tambah Stok Gudang sesuai filter di layar"
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover border border-slate-200/90 dark:border-line shadow-2xs text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            <span>{unduhExcel ? "Menyiapkan..." : "Excel"}</span>
          </button>
        </div>

        {!receipts ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <tr>
                  <th className="py-3.5 px-3">No. Bukti</th>
                  <th className="py-3.5 px-3">Tanggal</th>
                  <th className="py-3.5 px-3">Keterangan</th>
                  <th className="py-3.5 px-3 text-right">Jenis Produk</th>
                  <th className="py-3.5 px-3 text-right">Total Qty</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {filtered.map((r) => {
                  const totalQty = r.items.reduce((s, i) => s + i.qtyReceived, 0);
                  const status = STATUS_LABEL[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold">
                        <Link href={`/stok/penerimaan/${r.id}`} className="text-[var(--brand-700)] dark:text-brand-400 hover:underline">
                          {r.receiptNo}
                        </Link>
                        {r.versionNo > 1 && (
                          <span className="ml-1.5 text-[10px] font-normal text-slate-400 dark:text-fg-muted">v{r.versionNo}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">
                        {tanggalJakarta(r.receiptDate)}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-fg-muted">{r.note || "—"}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-slate-700 dark:text-fg-secondary">
                        {r.items.length}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-fg">
                        {totalQty}
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
                                href={`/stok/penerimaan/${r.id}`}
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

                              {r.status === "DRAFT" && (
                                <>
                                  <div className="my-1 border-t border-slate-100 dark:border-line" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionMenuRowId(null);
                                      setHapusTarget(r);
                                    }}
                                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-left cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus Draft</span>
                                  </button>
                                </>
                              )}
                            </PortalMenu>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      {receipts.length === 0 ? "Belum ada dokumen Tambah Stok Gudang." : "Tidak ada yang cocok dengan pencarian."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PenerimaanReportPreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} filter={reportFilter} />

      {notaTarget && (
        <PenerimaanNotaPreviewModal
          isOpen={!!notaTarget}
          onClose={() => setNotaTarget(null)}
          receiptId={notaTarget.id}
          receiptNo={notaTarget.receiptNo}
        />
      )}

      <Modal isOpen={!!hapusTarget} onClose={() => setHapusTarget(null)} title="Hapus Draft Tambah Stok Gudang" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-fg-muted">
            Hapus draft <strong className="text-slate-800 dark:text-fg font-mono">{hapusTarget?.receiptNo}</strong>? Dokumen ini
            belum pernah diposting dan belum menyentuh stok Gudang sama sekali, jadi aman dihapus. Tindakan ini tidak bisa
            dibatalkan.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setHapusTarget(null)}>
              Batal
            </Button>
            <Button variant="danger" size="sm" isLoading={menghapus} onClick={hapusDraft}>
              Hapus
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function PenerimaanPage() {
  return (
    <RequireAuth>
      <PenerimaanContent />
    </RequireAuth>
  );
}
