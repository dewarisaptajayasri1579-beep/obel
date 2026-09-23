"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileSpreadsheet, FileText, PackageX, Truck, XCircle } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth, type StokRusakData } from "@/lib/api-client";
import { TRANSAKSI_BOOTH_FILTER_KEYS, usePersistedFilter } from "@/lib/use-persisted-filter";

function tanggalJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function StokRusakContent() {
  const toast = useToast();
  const [data, setData] = useState<StokRusakData | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [dateFrom, setDateFrom] = usePersistedFilter("laporan-stok-rusak:dari", "");
  const [dateTo, setDateTo] = usePersistedFilter("laporan-stok-rusak:sampai", "");
  const [boothId, setBoothId] = usePersistedFilter(TRANSAKSI_BOOTH_FILTER_KEYS.boothId, "");
  const [unduhing, setUnduhing] = useState<"pdf" | "excel" | null>(null);

  const filter = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, boothId: boothId || undefined };

  useEffect(() => {
    api.getBooths().then(setBooths).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api
      .getStockDamageReport(filter)
      .then(setData)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat Laporan Stok Rusak.");
        setData({ rows: [], totalQtyRusak: 0, totalKejadian: 0, perProduk: [] });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, boothId]);

  const filterAktif = dateFrom !== "" || dateTo !== "" || boothId !== "";

  function resetFilter() {
    setDateFrom("");
    setDateTo("");
    setBoothId("");
  }

  async function unduh(format: "pdf" | "excel") {
    setUnduhing(format);
    try {
      const blob = await api.getStockDamageReportFile(format, filter);
      const url = URL.createObjectURL(blob);
      if (format === "pdf") {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `stok-rusak-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
      }
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengunduh laporan.");
    } finally {
      setUnduhing(null);
    }
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transaksi Booth" }, { label: "Laporan Stok Rusak" }]} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-100 dark:border-rose-900/30 shadow-2xs">
            <PackageX className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Laporan Stok Rusak</h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Qty selisih terima yang ditandai &quot;Rusak&quot; oleh Petugas Booth saat konfirmasi terima.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => unduh("pdf")}
            disabled={unduhing !== null}
            title="Pratinjau & cetak PDF Laporan Stok Rusak sesuai filter di layar"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200/90 dark:border-line bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg-secondary text-xs font-semibold shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={() => unduh("excel")}
            disabled={unduhing !== null}
            title="Unduh Excel Laporan Stok Rusak sesuai filter di layar"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200/90 dark:border-line bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg-secondary text-xs font-semibold shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{unduhing === "excel" ? "Menyiapkan..." : "Excel"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-100 dark:border-rose-900/30">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Qty Rusak</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{data?.totalQtyRusak ?? 0} cup</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">sesuai filter</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
            <Truck className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Kejadian</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{data?.totalKejadian ?? 0}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">baris produk rusak</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted mb-1.5">Produk Paling Sering Rusak</p>
          {data && data.perProduk.length > 0 ? (
            <p className="text-sm font-bold text-slate-900 dark:text-fg">
              {data.perProduk[0].productName}
              <span className="ml-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">{data.perProduk[0].totalQtyRusak} cup</span>
            </p>
          ) : (
            <p className="text-sm text-slate-400 dark:text-fg-muted">-</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo || undefined}
              className={`h-9 px-2.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border text-slate-800 dark:text-fg focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs ${
                dateFrom ? "border-amber-400 dark:border-amber-500/50" : "border-slate-200/90 dark:border-line"
              }`}
            />
            <span className="text-xs text-slate-400 dark:text-fg-muted">s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className={`h-9 px-2.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border text-slate-800 dark:text-fg focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs ${
                dateTo ? "border-amber-400 dark:border-amber-500/50" : "border-slate-200/90 dark:border-line"
              }`}
            />
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

        {!data ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
            <table className="w-full text-xs text-left">
              <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                <tr>
                  <th className="py-3.5 px-3">No. Dokumen</th>
                  <th className="py-3.5 px-3">Tanggal Terima</th>
                  <th className="py-3.5 px-3">Booth</th>
                  <th className="py-3.5 px-3">Petugas</th>
                  <th className="py-3.5 px-3">Produk</th>
                  <th className="py-3.5 px-3 text-right">Qty Kirim</th>
                  <th className="py-3.5 px-3 text-right">Qty Terima</th>
                  <th className="py-3.5 px-3 text-right">Qty Rusak</th>
                  <th className="py-3.5 px-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {data.rows.map((r) => (
                  <tr key={`${r.distributionId}-${r.productName}`}>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-fg">{r.distributionNo}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">{tanggalJakarta(r.receivedAt)}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary">{r.boothName}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-fg">{r.staffName ?? "-"}</td>
                    <td className="py-3 px-3 text-slate-800 dark:text-fg font-medium">{r.productName}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-600 dark:text-fg-secondary">{r.qtySent}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-600 dark:text-fg-secondary">{r.qtyReceived}</td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-rose-600 dark:text-rose-400">{r.qtyRusak}</td>
                    <td className="py-3 px-3 text-slate-500 dark:text-fg-muted">{r.reasonNote ?? "-"}</td>
                  </tr>
                ))}

                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      Tidak ada Stok Rusak yang tercatat sesuai filter.
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

export default function StokRusakPage() {
  return (
    <RequireAuth>
      <StokRusakContent />
    </RequireAuth>
  );
}
