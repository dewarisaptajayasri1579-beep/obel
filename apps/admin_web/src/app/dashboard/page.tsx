"use client";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { StatTile } from "@/components/ui/StatTile";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Truck, Receipt, PackageSearch, AlertTriangle } from "lucide-react";

function DashboardContent() {
  const { session } = useAuth();

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Omzet Hari Ini" value="—" icon={Receipt} color="emerald" />
        <StatTile label="Distribusi Pending" value="—" icon={Truck} color="blue" />
        <StatTile label="Item Stok Menipis" value="—" icon={AlertTriangle} color="amber" />
        <StatTile label="Return Pending" value="—" icon={PackageSearch} color="purple" />
      </div>

      <Card className="p-6">
        <CardHeader className="p-0 mb-2">
          <CardTitle>Belum ada data</CardTitle>
        </CardHeader>
        <p className="text-sm text-slate-500 dark:text-fg-muted">
          Dashboard ini masih placeholder — KPI di atas akan terisi begitu Backend API
          menyediakan endpoint <code className="text-xs bg-slate-100 dark:bg-elevated px-1 py-0.5 rounded">get_admin_dashboard</code> dan
          modul Distribusi/Return selesai dibangun.
        </p>
      </Card>
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
