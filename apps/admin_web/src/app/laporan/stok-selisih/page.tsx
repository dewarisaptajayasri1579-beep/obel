"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileSpreadsheet, FileText, HandCoins, PackageX, Truck, XCircle } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth, type JenisStokSelisih, type StokSelisihData, type TindakLanjutStokSelisih } from "@/lib/api-client";
import { TRANSAKSI_BOOTH_FILTER_KEYS, usePersistedFilter } from "@/lib/use-persisted-filter";

function tanggalJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

const JENIS_BADGE: Record<JenisStokSelisih, { label: string; kelas: string }> = {
  KIRIM_STOK: { label: "Kirim Stok", kelas: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" },
  PENGEMBALIAN_STOK: { label: "Pengembalian Stok", kelas: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20" },
};

const TINDAK_LANJUT_BADGE: Record<TindakLanjutStokSelisih, { label: string; kelas: string }> = {
  RUSAK: { label: "Rusak", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
  GANTI_RUGI_PETUGAS: { label: "Ganti Rugi Petugas", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
  LAINNYA: { label: "Lainnya", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line" },
};

type TabJenis = "SEMUA" | JenisStokSelisih;

function StokSelisihContent() {
  const toast = useToast();
  const [data, setData] = useState<StokSelisihData | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [dateFrom, setDateFrom] = usePersistedFilter("laporan-stok-selisih:dari", "");
  const [dateTo, setDateTo] = usePersistedFilter("laporan-stok-selisih:sampai", "");
  const [boothId, setBoothId] = usePersistedFilter(TRANSAKSI_BOOTH_FILTER_KEYS.boothId, "");
  const [tabRaw, setTabRaw] = usePersistedFilter("laporan-stok-selisih:jenis", "SEMUA");
  const tab = tabRaw as TabJenis;
  const setTab = (v: TabJenis) => setTabRaw(v);
  const [unduhing, setUnduhing] = useState<"pdf" | "excel" | null>(null);

  const filter = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    boothId: boothId || undefined,
    jenis: tab === "SEMUA" ? undefined : tab,
  };

  useEffect(() => {
    api.getBooths().then(setBooths).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api
      .getStockDiscrepancyReport(filter)
      .then(setData)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat Rekap Stok Selisih.");
        setData({ rows: [], totalSelisih: 0, totalKejadian: 0, totalGantiRugi: 0, perProduk: [] });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, boothId, tab]);

  const filterAktif = dateFrom !== "" || dateTo !== "" || boothId !== "" || tab !== "SEMUA";

  function resetFilter() {
    setDateFrom("");
    setDateTo("");
    setBoothId("");
    setTab("SEMUA");
  }

  const rows = data?.rows ?? [];

  async function unduh(format: "pdf" | "excel") {
    setUnduhing(format);
    try {
      const blob = await api.getStockDiscrepancyReportFile(format, filter);
      const url = URL.createObjectURL(blob);
      if (format === "pdf") {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `stok-selisih-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transaksi Booth" }, { label: "Rekap Stok Selisih" }]} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/30 shadow-2xs">
            <PackageX className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Rekap Stok Selisih</h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Selisih Kirim Stok &amp; Pengembalian Stok yang sudah diberi Tindak Lanjut Admin (Rusak / Ganti Rugi Petugas / Lainnya).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => unduh("pdf")}
            disabled={unduhing !== null}
            title="Pratinjau & cetak PDF Rekap Stok Selisih sesuai filter di layar"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200/90 dark:border-line bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg-secondary text-xs font-semibold shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={() => unduh("excel")}
            disabled={unduhing !== null}
            title="Unduh Excel Rekap Stok Selisih sesuai filter di layar"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200/90 dark:border-line bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg-secondary text-xs font-semibold shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{unduhing === "excel" ? "Menyiapkan..." : "Excel"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/30">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Qty Selisih</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{data?.totalSelisih ?? 0} cup</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">sesuai filter</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-100 dark:border-amber-900/30">
            <Truck className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Kejadian</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{data?.totalKejadian ?? 0}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">baris selisih</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 border border-violet-100 dark:border-violet-900/30">
            <HandCoins className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Ganti Rugi Petugas</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{data?.totalGantiRugi ?? 0}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">kejadian dibebankan Petugas</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted mb-1.5">Produk Paling Sering Selisih</p>
          {data && data.perProduk.length > 0 ? (
            <p className="text-sm font-bold text-slate-900 dark:text-fg">
              {data.perProduk[0].productName}
              <span className="ml-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">{data.perProduk[0].totalSelisih} cup</span>
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
              className={`h-9 px-2.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border text-slate-800 dark:text-fg focus:outline-none focus:border-(--brand-700) focus:ring-2 focus:ring-(--brand-700)/10 transition-colors shadow-2xs ${
                dateFrom ? "border-amber-400 dark:border-amber-500/50" : "border-slate-200/90 dark:border-line"
              }`}
            />
            <span className="text-xs text-slate-400 dark:text-fg-muted">s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className={`h-9 px-2.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border text-slate-800 dark:text-fg focus:outline-none focus:border-(--brand-700) focus:ring-2 focus:ring-(--brand-700)/10 transition-colors shadow-2xs ${
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
              className="h-9!"
              active={boothId !== ""}
            />
          </div>

          <div className="flex gap-2">
            {([
              ["SEMUA", "Semua"],
              ["KIRIM_STOK", "Kirim Stok"],
              ["PENGEMBALIAN_STOK", "Pengembalian Stok"],
            ] as [TabJenis, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`h-9 px-3 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  tab === key
                    ? "bg-(--brand-700) text-white"
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
                  <th className="py-3.5 px-3">Tanggal</th>
                  <th className="py-3.5 px-3">Jenis</th>
                  <th className="py-3.5 px-3">Booth</th>
                  <th className="py-3.5 px-3">Petugas</th>
                  <th className="py-3.5 px-3">Produk</th>
                  <th className="py-3.5 px-3 text-right">Selisih</th>
                  <th className="py-3.5 px-3">Tindak Lanjut</th>
                  <th className="py-3.5 px-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-fg">{r.docNo}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">{tanggalJakarta(r.tanggal)}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${JENIS_BADGE[r.jenis].kelas}`}>
                        {JENIS_BADGE[r.jenis].label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-fg-secondary">{r.boothName}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-fg">{r.staffName ?? "-"}</td>
                    <td className="py-3 px-3 text-slate-800 dark:text-fg font-medium">{r.productName}</td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-rose-600 dark:text-rose-400">
                      {r.selisih > 0 ? `+${r.selisih}` : r.selisih}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${TINDAK_LANJUT_BADGE[r.tindakLanjut].kelas}`}>
                        {TINDAK_LANJUT_BADGE[r.tindakLanjut].label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 dark:text-fg-muted">{r.catatan ?? "-"}</td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      Tidak ada Stok Selisih yang tercatat sesuai filter.
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

export default function StokSelisihPage() {
  return (
    <RequireAuth>
      <StokSelisihContent />
    </RequireAuth>
  );
}
