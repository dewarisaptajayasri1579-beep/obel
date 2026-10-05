"use client";

import { Fragment, useEffect, useState } from "react";
import { Clock, FileSpreadsheet, FileText, PackageCheck, TrendingDown, Undo2, XCircle } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type AngkaRekapPengembalian, type Booth, type Product, type RekapPengembalianData } from "@/lib/api-client";
import { TRANSAKSI_BOOTH_FILTER_KEYS, usePersistedFilter } from "@/lib/use-persisted-filter";

/** "YYYY-MM-DD" kalender Asia/Jakarta. */
function tanggalJakarta(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

const HARI_INI = tanggalJakarta(new Date());
const AWAL_BULAN = `${HARI_INI.slice(0, 8)}01`;

const KOLOM: { key: keyof AngkaRekapPengembalian; label: string; title: string }[] = [
  { key: "jumlahDokumen", label: "Dokumen", title: "Jumlah dokumen pengembalian yang sudah diterima Gudang" },
  { key: "qtyDiajukan", label: "Diajukan", title: "Qty yang diajukan Barista (dokumen yang sudah diterima)" },
  { key: "qtyDiterima", label: "Diterima", title: "Qty diterima Gudang, setelah Koreksi Penerimaan" },
  { key: "selisih", label: "Selisih", title: "Diterima − Diajukan" },
  { key: "rusak", label: "Rusak", title: "Selisih dengan Tindak Lanjut Rusak" },
  { key: "gantiRugi", label: "Ganti Rugi", title: "Selisih yang dibebankan ke Barista" },
  { key: "lainnya", label: "Lainnya", title: "Selisih dengan Tindak Lanjut Lainnya" },
  { key: "menunggu", label: "Menunggu", title: "Qty diajukan yang belum di-approve Admin (tidak ikut dihitung di kolom lain)" },
];

function Angka({ k, nilai }: { k: keyof AngkaRekapPengembalian; nilai: number }) {
  let warna = "text-slate-700 dark:text-fg-secondary";
  if (nilai === 0) warna = "text-slate-300 dark:text-fg-muted";
  else if (k === "selisih") warna = "text-rose-600 dark:text-rose-400";
  else if (k === "menunggu") warna = "text-amber-600 dark:text-amber-400";
  return <span className={warna}>{k === "selisih" && nilai > 0 ? `+${nilai}` : nilai}</span>;
}

function RekapPengembalianContent() {
  const toast = useToast();
  const [data, setData] = useState<RekapPengembalianData | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dateFrom, setDateFrom] = usePersistedFilter("laporan-pengembalian-stok:dari", AWAL_BULAN);
  const [dateTo, setDateTo] = usePersistedFilter("laporan-pengembalian-stok:sampai", HARI_INI);
  const [boothId, setBoothId] = usePersistedFilter(TRANSAKSI_BOOTH_FILTER_KEYS.boothId, "");
  const [productId, setProductId] = usePersistedFilter("laporan-pengembalian-stok:produk", "");
  const [unduhing, setUnduhing] = useState<"pdf" | "excel" | null>(null);

  const filter = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    boothId: boothId || undefined,
    productId: productId || undefined,
  };

  useEffect(() => {
    api.getBooths().then(setBooths).catch(() => {});
    api.getProducts().then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api
      .getStockReturnRecap(filter)
      .then(setData)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat Rekap Pengembalian Stok.");
        setData({
          booths: [],
          total: { jumlahDokumen: 0, qtyDiajukan: 0, qtyDiterima: 0, selisih: 0, rusak: 0, gantiRugi: 0, lainnya: 0, menunggu: 0 },
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, boothId, productId]);

  const filterAktif = dateFrom !== AWAL_BULAN || dateTo !== HARI_INI || boothId !== "" || productId !== "";

  function resetFilter() {
    setDateFrom(AWAL_BULAN);
    setDateTo(HARI_INI);
    setBoothId("");
    setProductId("");
  }

  async function unduh(format: "pdf" | "excel") {
    setUnduhing(format);
    try {
      const blob = await api.getStockReturnRecapFile(format, filter);
      const url = URL.createObjectURL(blob);
      if (format === "pdf") {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `rekap-pengembalian-stok-${HARI_INI}.xlsx`;
        a.click();
      }
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengunduh laporan.");
    } finally {
      setUnduhing(null);
    }
  }

  const total = data?.total;
  const kartu = [
    { label: "Diterima Gudang", nilai: `${total?.qtyDiterima ?? 0} cup`, ket: `dari ${total?.qtyDiajukan ?? 0} cup diajukan`, icon: PackageCheck, warna: "emerald" },
    { label: "Selisih", nilai: `${total?.selisih ?? 0} cup`, ket: `Rusak ${total?.rusak ?? 0} · Ganti Rugi ${total?.gantiRugi ?? 0} · Lainnya ${total?.lainnya ?? 0}`, icon: TrendingDown, warna: "rose" },
    { label: "Menunggu Approve", nilai: `${total?.menunggu ?? 0} cup`, ket: "belum dihitung di Diterima", icon: Clock, warna: "amber" },
    { label: "Dokumen Diterima", nilai: `${total?.jumlahDokumen ?? 0}`, ket: "dokumen pengembalian", icon: Undo2, warna: "sky" },
  ] as const;
  const WARNA_IKON: Record<(typeof kartu)[number]["warna"], string> = {
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30",
    rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30",
    amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30",
    sky: "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/30",
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Transaksi Booth" }, { label: "Rekap Pengembalian Stok" }]} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-100 dark:border-sky-900/30 shadow-2xs">
            <Undo2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Rekap Pengembalian Stok</h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Stok yang dikembalikan Booth ke Gudang per Booth &amp; Produk. Periode memakai tanggal shift.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => unduh("pdf")}
            disabled={unduhing !== null}
            title="Pratinjau & cetak PDF Rekap Pengembalian Stok sesuai filter di layar"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200/90 dark:border-line bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg-secondary text-xs font-semibold shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={() => unduh("excel")}
            disabled={unduhing !== null}
            title="Unduh Excel Rekap Pengembalian Stok sesuai filter di layar"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200/90 dark:border-line bg-white/90 dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg-secondary text-xs font-semibold shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{unduhing === "excel" ? "Menyiapkan..." : "Excel"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kartu.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${WARNA_IKON[k.warna]}`}>
              <k.icon className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">{k.label}</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{k.nilai}</p>
              <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">{k.ket}</p>
            </div>
          </div>
        ))}
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
                dateFrom !== AWAL_BULAN ? "border-amber-400 dark:border-amber-500/50" : "border-slate-200/90 dark:border-line"
              }`}
            />
            <span className="text-xs text-slate-400 dark:text-fg-muted">s/d</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom || undefined}
              className={`h-9 px-2.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border text-slate-800 dark:text-fg focus:outline-none focus:border-(--brand-700) focus:ring-2 focus:ring-(--brand-700)/10 transition-colors shadow-2xs ${
                dateTo !== HARI_INI ? "border-amber-400 dark:border-amber-500/50" : "border-slate-200/90 dark:border-line"
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

          <div className="w-48">
            <Select
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              value={productId}
              onChange={setProductId}
              placeholder="Semua Produk"
              sizeVariant="sm"
              className="h-9!"
              active={productId !== ""}
            />
          </div>

          {filterAktif && (
            <button
              type="button"
              onClick={resetFilter}
              title="Kembalikan filter ke bulan ini, semua Booth & Produk"
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
                  <th className="py-3.5 px-3">Produk</th>
                  {KOLOM.map((k) => (
                    <th key={k.key} title={k.title} className="py-3.5 px-3 text-right whitespace-nowrap">
                      {k.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {data.booths.map((booth) => (
                  <Fragment key={booth.boothId}>
                    <tr className="bg-slate-50/80 dark:bg-surface-hover/50">
                      <td colSpan={KOLOM.length + 1} className="py-2.5 px-3 font-bold text-slate-800 dark:text-fg">
                        {booth.boothName}
                      </td>
                    </tr>
                    {booth.rows.map((r) => (
                      <tr key={r.productId}>
                        <td className="py-3 px-3 pl-6 font-medium text-slate-800 dark:text-fg">{r.productName}</td>
                        {KOLOM.map((k) => (
                          <td key={k.key} className="py-3 px-3 text-right tabular-nums">
                            <Angka k={k.key} nilai={r[k.key]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="py-3 px-3 pl-6 text-slate-600 dark:text-fg-secondary">Subtotal {booth.boothName}</td>
                      {KOLOM.map((k) => (
                        <td key={k.key} className="py-3 px-3 text-right tabular-nums">
                          <Angka k={k.key} nilai={booth.subtotal[k.key]} />
                        </td>
                      ))}
                    </tr>
                  </Fragment>
                ))}

                {data.booths.length === 0 && (
                  <tr>
                    <td colSpan={KOLOM.length + 1} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      Tidak ada pengembalian stok sesuai filter.
                    </td>
                  </tr>
                )}
              </tbody>
              {data.booths.length > 0 && (
                <tfoot className="bg-brand-50/70 dark:bg-surface-hover/80 border-t border-slate-200/80 dark:border-line font-bold">
                  <tr>
                    <td className="py-3.5 px-3 text-slate-900 dark:text-fg">Grand Total</td>
                    {KOLOM.map((k) => (
                      <td key={k.key} className="py-3.5 px-3 text-right tabular-nums">
                        <Angka k={k.key} nilai={data.total[k.key]} />
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RekapPengembalianStokPage() {
  return (
    <RequireAuth>
      <RekapPengembalianContent />
    </RequireAuth>
  );
}
