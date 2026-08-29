"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { StatTile } from "@/components/ui/StatTile";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type AdminDashboard } from "@/lib/api-client";
import { Truck, Receipt, AlertTriangle, Store, Undo2, RefreshCw } from "lucide-react";

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function DashboardContent() {
  const { session } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<AdminDashboard | null>(null);

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

      {!data ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
