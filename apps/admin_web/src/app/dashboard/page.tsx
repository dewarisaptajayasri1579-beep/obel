"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { Alert } from "@/components/ui/Alert";
import { StatTile } from "@/components/ui/StatTile";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { LineChartCard, BarChartCard, PieChartCard } from "@/components/ui/charts";
import { api, ApiError, type AdminDashboard, type ReportsSummary } from "@/lib/api-client";
import { Truck, Receipt, AlertTriangle, Store, Undo2, RefreshCw, Download } from "lucide-react";
import { DashboardTabs } from "./DashboardTabs";
import { SalesReportPanel } from "./SalesReportPanel";
import { PeriodFilterBar } from "./PeriodFilterBar";
import { usePeriodFilter } from "./usePeriodFilter";

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function RingkasanTab() {
  const { session } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const periodFilter = usePeriodFilter();

  useEffect(() => {
    api
      .getAdminDashboard()
      .then(setData)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat dashboard."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">
          Selamat datang, {session?.profile.fullName}
        </h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">
          Ringkasan operasional Obbel Coffee & Milk hari ini.
        </p>
      </div>

      <PeriodFilterBar {...periodFilter} />

      {!data ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          {data.reconciliationCasesOpen > 0 && (
            <Link href="/koreksi">
              <Alert variant="warning" title="Perlu Rekonsiliasi">
                Ada {data.reconciliationCasesOpen} kasus yang memerlukan tinjauan Admin. Klik untuk membuka Riwayat & Koreksi Data.
              </Alert>
            </Link>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Omzet Hari Ini" value={formatRupiah(data.omzetToday)} icon={Receipt} color="emerald" />
            <StatTile label="Cup Terjual" value={`${data.cupSoldToday} cup`} icon={Receipt} color="blue" />
            <StatTile label="Booth Aktif" value={data.activeBoothsCount} icon={Store} color="slate" />
            <StatTile
              label="Item Stok Menipis"
              value={data.lowStockCount}
              icon={AlertTriangle}
              color={data.lowStockCount > 0 ? "amber" : "slate"}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile label="Distribusi Pending" value={data.pendingDistributions} icon={Truck} color="blue" />
            <StatTile label="Restock Pending" value={data.pendingRestock} icon={RefreshCw} color="purple" />
            <StatTile label="Return Pending" value={data.pendingReturns} icon={Undo2} color="amber" />
          </div>

          <SalesReportPanel start={periodFilter.start} end={periodFilter.end} />
        </>
      )}
    </div>
  );
}

function LaporanTab() {
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
          <p className="text-sm text-slate-500 dark:text-fg-muted">
            Tren penjualan, ranking Booth, dan ranking produk 7 hari terakhir.
          </p>
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

function DashboardLaporanContent() {
  return (
    <DashboardTabs
      isi={{
        ringkasan: <RingkasanTab />,
        laporan: <LaporanTab />,
      }}
    />
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardLaporanContent />
    </RequireAuth>
  );
}
