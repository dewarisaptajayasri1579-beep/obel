"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge, type StatusBadgeType } from "@/components/ui/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type SaleListItem } from "@/lib/api-client";

const STATUS_CONFIG: Record<SaleListItem["status"], { type: StatusBadgeType; label: string }> = {
  PENDING: { type: "expiring_next_month", label: "Pending" },
  PAID: { type: "safe", label: "Lunas" },
  VOIDED: { type: "expired", label: "Dibatalkan" },
};

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function PenjualanContent() {
  const toast = useToast();
  const [sales, setSales] = useState<SaleListItem[] | null>(null);

  useEffect(() => {
    api
      .getSales()
      .then(setSales)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Penjualan."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Penjualan</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">200 transaksi terbaru dari seluruh Booth.</p>
      </div>

      {!sales ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Sale</TableHead>
                <TableHead>Booth</TableHead>
                <TableHead>Petugas</TableHead>
                <TableHead>Cup</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.saleNo}</TableCell>
                  <TableCell className="font-semibold">{s.boothName}</TableCell>
                  <TableCell>{s.staffName}</TableCell>
                  <TableCell>{s.cupCount} cup</TableCell>
                  <TableCell>{formatRupiah(s.total)}</TableCell>
                  <TableCell>{s.paymentMethod === "CASH" ? "Tunai" : "QRIS"}</TableCell>
                  <TableCell>
                    <StatusBadge type={STATUS_CONFIG[s.status].type} label={STATUS_CONFIG[s.status].label} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-fg-muted">
                    {new Date(s.createdAt).toLocaleString("id-ID")}
                  </TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                    Belum ada transaksi.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}

export default function PenjualanPage() {
  return (
    <RequireAuth>
      <PenjualanContent />
    </RequireAuth>
  );
}
