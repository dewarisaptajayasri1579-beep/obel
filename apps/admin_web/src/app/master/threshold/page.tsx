"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
import { QuantityStepperInline } from "@/components/warehouse/QuantityStepperInline";
import { api, ApiError, type Booth, type BoothStockThreshold } from "@/lib/api-client";
import { Save } from "lucide-react";

function ThresholdContent() {
  const toast = useToast();
  const [booths, setBooths] = useState<Booth[]>([]);
  const [boothId, setBoothId] = useState("");
  const [rows, setRows] = useState<BoothStockThreshold[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getBooths()
      .then((data) => {
        setBooths(data);
        if (data.length > 0) setBoothId(data[0].id);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Booth."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!boothId) return;
    setRows(null);
    api
      .getBoothStockThresholds(boothId)
      .then(setRows)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat Threshold."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boothId]);

  function updateRow(productId: string, field: "minimumQty" | "criticalQty", value: number) {
    setRows((prev) => prev?.map((r) => (r.productId === productId ? { ...r, [field]: value } : r)) ?? null);
  }

  async function handleSave() {
    if (!rows) return;
    setSaving(true);
    try {
      const updated = await api.bulkUpsertBoothStockThresholds(
        boothId,
        rows.map((r) => ({ productId: r.productId, minimumQty: r.minimumQty, criticalQty: r.criticalQty })),
      );
      setRows(updated);
      toast.success("Threshold stok Booth berhasil disimpan.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan Threshold.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Threshold Stok Booth</h1>
          <p className="text-sm text-slate-500 dark:text-fg-muted">
            Atur batas minimum &amp; kritis stok per produk untuk tiap Booth. Produk yang belum diatur memakai nilai
            default (Minimum 25, Kritis 10).
          </p>
        </div>
        <Button leftIcon={<Save className="w-4 h-4" />} onClick={handleSave} isLoading={saving} disabled={!rows}>
          Simpan Perubahan
        </Button>
      </div>

      <div className="max-w-xs">
        <Select
          label="Booth"
          options={booths.map((b) => ({ value: b.id, label: b.name }))}
          value={boothId}
          onChange={setBoothId}
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
                <TableHead>Produk</TableHead>
                <TableHead>Minimum Qty</TableHead>
                <TableHead>Kritis Qty</TableHead>
                <TableHead>Sumber</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.productId}>
                  <TableCell className="font-semibold">{r.productName}</TableCell>
                  <TableCell>
                    <QuantityStepperInline
                      value={r.minimumQty}
                      onChange={(v) => updateRow(r.productId, "minimumQty", v)}
                    />
                  </TableCell>
                  <TableCell>
                    <QuantityStepperInline
                      value={r.criticalQty}
                      onChange={(v) => updateRow(r.productId, "criticalQty", v)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      type={r.isCustomized ? "safe" : "inactive"}
                      label={r.isCustomized ? "Kustom" : "Default"}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                    Belum ada produk aktif.
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

export default function ThresholdPage() {
  return (
    <RequireAuth>
      <ThresholdContent />
    </RequireAuth>
  );
}
