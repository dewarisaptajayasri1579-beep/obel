"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { LineChartCard, BarChartCard, PieChartCard } from "@/components/ui/charts";
import { api, ApiError, type ReportsSummary } from "@/lib/api-client";
import { Download } from "lucide-react";

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function LaporanContent() {
  const toast = useToast();
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api
      .getReportsSummary()
      .then(setData)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat Laporan."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.exportReportsCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "laporan-obbel.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengunduh laporan.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Laporan</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">Tren penjualan, ranking Booth, dan ranking produk 7 hari terakhir.</p>
        </div>
        <Button leftIcon={<Download className="w-4 h-4" />} onClick={handleExport} isLoading={exporting}>
          Export CSV
        </Button>
      </div>

      {!data ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          <LineChartCard
            title="Tren Omzet 7 Hari"
            description="Omzet harian (Rp), sale PAID"
            data={data.salesTrend.map((d) => ({ tanggal: d.date.slice(5), omzet: d.omzet }))}
            xKey="tanggal"
            series={[{ key: "omzet", label: "Omzet" }]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BarChartCard
              title="Ranking Booth"
              description="Omzet per Booth (7 hari terakhir)"
              data={data.boothRanking.map((b) => ({ booth: b.boothName, omzet: b.omzet }))}
              xKey="booth"
              series={[{ key: "omzet", label: "Omzet" }]}
            />

            <PieChartCard
              title="Ranking Produk"
              description="Cup terjual per produk (7 hari terakhir)"
              data={data.productRanking.map((p) => ({ label: p.productName, value: p.qty }))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6">
              <CardHeader className="p-0 mb-3">
                <CardTitle>Detail Ranking Booth</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {data.boothRanking.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-fg-muted">Belum ada penjualan.</p>
                )}
                {data.boothRanking.map((b, i) => (
                  <div key={b.boothName} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-fg">
                      {i + 1}. {b.boothName}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-fg">
                      {formatRupiah(b.omzet)} · {b.cup} cup
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <CardHeader className="p-0 mb-3">
                <CardTitle>Detail Ranking Produk</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {data.productRanking.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-fg-muted">Belum ada penjualan.</p>
                )}
                {data.productRanking.map((p, i) => (
                  <div key={p.productName} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-fg">
                      {i + 1}. {p.productName}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-fg">{p.qty} cup</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function LaporanPage() {
  return (
    <RequireAuth>
      <LaporanContent />
    </RequireAuth>
  );
}
