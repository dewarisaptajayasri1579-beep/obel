"use client";

import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Select } from "@/components/ui/Select";
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
import { api, ApiError, type BoothStockRow } from "@/lib/api-client";

const STATUS_CONFIG: Record<BoothStockRow["status"], StatusBadgeType> = {
  Aman: "safe",
  Menipis: "expiring_this_month",
  Kritis: "expiring_next_month",
  Habis: "expired",
};

function MonitorStokBoothContent() {
  const toast = useToast();
  const [rows, setRows] = useState<BoothStockRow[] | null>(null);
  const [boothFilter, setBoothFilter] = useState("");

  useEffect(() => {
    api
      .getBoothStock()
      .then(setRows)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat Monitor Stok Booth."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boothOptions = useMemo(() => {
    if (!rows) return [];
    const unique = new Map(rows.map((r) => [r.boothId, r.boothName]));
    return Array.from(unique, ([value, label]) => ({ value, label }));
  }, [rows]);

  const filteredRows = rows?.filter((r) => !boothFilter || r.boothId === boothFilter) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Monitor Stok Booth</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">Stok tiap Booth lintas seluruh lokasi, real-time.</p>
      </div>

      <div className="max-w-xs">
        <Select
          placeholder="Semua Booth"
          options={boothOptions}
          value={boothFilter}
          onChange={setBoothFilter}
        />
      </div>

      {!rows ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booth</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Stok (cup)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => (
                <TableRow key={`${r.boothId}-${r.productId}`}>
                  <TableCell className="font-semibold">{r.boothName}</TableCell>
                  <TableCell>{r.productName}</TableCell>
                  <TableCell>{r.qtyOnHand} cup</TableCell>
                  <TableCell>
                    <StatusBadge type={STATUS_CONFIG[r.status]} label={r.status} />
                  </TableCell>
                </TableRow>
              ))}
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                    Belum ada stok Booth (belum ada distribusi yang diterima).
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

export default function MonitorStokBoothPage() {
  return (
    <RequireAuth>
      <MonitorStokBoothContent />
    </RequireAuth>
  );
}
