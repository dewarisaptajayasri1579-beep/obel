"use client";

import { useEffect, useState } from "react";
import { Store, Coffee, Users2, AlertTriangle, ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type SalesReport, type StockNeglectRow } from "@/lib/api-client";

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

export function SalesReportPanel({ start, end }: { start: string; end: string }) {
  const toast = useToast();
  const [data, setData] = useState<SalesReport | null>(null);
  const [neglect, setNeglect] = useState<StockNeglectRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRumus, setShowRumus] = useState(false);

  useEffect(() => {
    if (start > end) return;
    setLoading(true);
    Promise.all([api.getSalesReport(start, end), api.getStockNeglectReport(start, end)])
      .then(([sales, neglectRows]) => {
        setData(sales);
        setNeglect(neglectRows);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat laporan penjualan."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  return (
    <div className="space-y-5">
      {start > end ? (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Tanggal mulai tidak boleh setelah tanggal akhir.</p>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !data ? null : (
        <>
          <Card className="p-5">
            <CardHeader className="p-0 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20">
                  <Store className="w-4 h-4" />
                </div>
                <CardTitle>Penjualan Terbanyak per Booth</CardTitle>
              </div>
            </CardHeader>
            <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
              <table className="w-full text-xs text-left">
                <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Booth</th>
                    <th className="py-2.5 px-3 text-right">Cup Terjual</th>
                    <th className="py-2.5 px-3 text-right">Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                  {data.byBooth.map((b, i) => (
                    <tr key={b.boothId}>
                      <td className="py-2.5 px-3 text-slate-400 dark:text-fg-muted">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-fg">{b.boothName}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-fg-secondary">{b.cupSold} cup</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--brand-700)] dark:text-brand-400">{formatRupiah(b.omzet)}</td>
                    </tr>
                  ))}
                  {data.byBooth.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-slate-500 dark:text-fg-muted py-8">
                        Belum ada penjualan pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader className="p-0 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
                  <Coffee className="w-4 h-4" />
                </div>
                <CardTitle>Produk Terlaris</CardTitle>
              </div>
            </CardHeader>
            <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
              <table className="w-full text-xs text-left">
                <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Nama Produk</th>
                    <th className="py-2.5 px-3 text-right">Jumlah Cup Terjual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                  {data.byProduct.map((p, i) => (
                    <tr key={p.productId}>
                      <td className="py-2.5 px-3 text-slate-400 dark:text-fg-muted">{i + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-fg">{p.productName}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-fg">{p.cupSold} cup</td>
                    </tr>
                  ))}
                  {data.byProduct.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-slate-500 dark:text-fg-muted py-8">
                        Belum ada penjualan pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader className="p-0 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-100 dark:border-blue-900/30">
                  <Users2 className="w-4 h-4" />
                </div>
                <CardTitle>Penjualan per Petugas</CardTitle>
              </div>
            </CardHeader>
            <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
              <table className="w-full text-xs text-left">
                <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                  <tr>
                    <th className="py-2.5 px-3">Petugas</th>
                    <th className="py-2.5 px-3">Booth</th>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3 text-right">Cup Terjual</th>
                    <th className="py-2.5 px-3 text-right">Nominal Terjual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                  {data.byStaffShift.map((s) => (
                    <tr key={`${s.staffId}__${s.boothId}__${s.tanggal}__${s.shift}`}>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-fg">{s.staffName}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-fg-secondary">{s.boothName}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-fg-secondary whitespace-nowrap">
                        {new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${s.tanggal}T00:00:00+07:00`))}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-fg-secondary">{s.shift}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-fg-secondary">{s.cupSold} cup</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--brand-700)] dark:text-brand-400">{formatRupiah(s.omzet)}</td>
                    </tr>
                  ))}
                  {data.byStaffShift.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-slate-500 dark:text-fg-muted py-8">
                        Belum ada penjualan pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader className="p-0 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-100 dark:border-rose-900/30">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <CardTitle>Petugas Diam — Stok Menipis/Habis Tanpa Request</CardTitle>
                  <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
                    Insiden Menipis/Kritis/Habis yang bertahan ≥4 jam tanpa Petugas mengajukan Request Stok — potensi penjualan yang hilang.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRumus((v) => !v)}
                  className="shrink-0 flex items-center gap-1 px-2.5 h-7 rounded-lg text-[11px] font-bold text-slate-500 dark:text-fg-muted border border-slate-200/90 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors"
                >
                  Lihat Rumus
                  <ChevronDown className={`w-3 h-3 transition-transform ${showRumus ? "rotate-180" : ""}`} />
                </button>
              </div>

              {showRumus && (
                <div className="mt-3.5 rounded-xl bg-slate-50 dark:bg-surface-hover/60 border border-slate-200/80 dark:border-line p-4 text-xs text-slate-600 dark:text-fg-secondary space-y-2.5">
                  <p className="font-bold text-slate-800 dark:text-fg">Rumus "Diam" (4 syarat, semua harus terpenuhi):</p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>
                      <b>Stok masuk status Menipis/Kritis/Habis</b> — dihitung dari saldo stok Booth vs ambang batas Booth itu
                      (<i>BoothStockThreshold</i>, atau default produk kalau Booth belum punya threshold sendiri).
                    </li>
                    <li>
                      <b>Berlangsung ≥ 4 jam</b> sampai stok kembali Aman (atau masih berlangsung sampai akhir periode filter) — supaya
                      penurunan sesaat yang langsung pulih sendiri tidak ikut terhitung.
                    </li>
                    <li>
                      <b>Tidak ada Request Stok</b> yang diajukan Petugas untuk produk itu, baik selama insiden berlangsung maupun
                      sampai <b>12 jam sebelum</b> insiden mulai (menghargai Petugas yang sudah minta duluan sebelum benar-benar menipis).
                    </li>
                    <li>
                      <b>Diatribusikan</b> ke Petugas yang shift-nya sedang terbuka (Check-In) di Booth itu saat insiden pertama kali mulai.
                    </li>
                  </ol>
                  <p className="text-[11px] text-slate-400 dark:text-fg-muted pt-1 border-t border-slate-200/70 dark:border-line">
                    Angka 4 jam &amp; 12 jam masih default awal — beri tahu Admin kalau perlu disesuaikan.
                  </p>
                </div>
              )}
            </CardHeader>
            <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
              <table className="w-full text-xs text-left">
                <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                  <tr>
                    <th className="py-2.5 px-3">Petugas</th>
                    <th className="py-2.5 px-3">Booth</th>
                    <th className="py-2.5 px-3 text-right">Jumlah Insiden</th>
                    <th className="py-2.5 px-3 text-right">Total Jam Diam</th>
                    <th className="py-2.5 px-3">Produk Terdampak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                  {(neglect ?? []).map((n) => (
                    <tr key={`${n.staffId}__${n.boothId}`}>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-fg">{n.staffName}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-fg-secondary">{n.boothName}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400">{n.jumlahInsiden}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-fg-secondary">{n.totalJamDiam} jam</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-fg-secondary">{n.produk.join(", ")}</td>
                    </tr>
                  ))}
                  {(neglect ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-500 dark:text-fg-muted py-8">
                        Tidak ada insiden "diam" pada periode ini — semua Petugas responsif.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
