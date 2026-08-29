"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
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
import { QuantityStepperInline } from "@/components/warehouse/QuantityStepperInline";
import { api, ApiError, type StockReturn } from "@/lib/api-client";
import { PackageCheck } from "lucide-react";

const STATUS_CONFIG: Record<StockReturn["status"], { type: StatusBadgeType; label: string }> = {
  SUBMITTED: { type: "expiring_next_month", label: "Menunggu Diterima" },
  RECEIVED: { type: "safe", label: "Diterima" },
  DISCREPANCY: { type: "expiring_this_month", label: "Ada Selisih" },
  CANCELLED: { type: "expired", label: "Dibatalkan" },
};

function ReturnContent() {
  const toast = useToast();
  const [returns, setReturns] = useState<StockReturn[] | null>(null);
  const [receiving, setReceiving] = useState<StockReturn | null>(null);
  const [qtyReceived, setQtyReceived] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setReturns(await api.getReturns());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Return.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openReceive(r: StockReturn) {
    setReceiving(r);
    setQtyReceived(Object.fromEntries(r.items.map((i) => [i.productId, i.qtySubmitted])));
  }

  async function handleReceive() {
    if (!receiving) return;
    setSaving(true);
    try {
      await api.receiveReturn(
        receiving.id,
        receiving.items.map((i) => ({ productId: i.productId, qtyReceived: qtyReceived[i.productId] ?? i.qtySubmitted })),
      );
      toast.success(`Return "${receiving.returnNo}" diterima.`);
      setReceiving(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menerima return.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Return Stok</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">
          Sisa stok yang dikembalikan Booth ke Gudang Pusat setelah closing shift.
        </p>
      </div>

      {!returns ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Return</TableHead>
                <TableHead>Booth</TableHead>
                <TableHead>Item Diajukan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.returnNo}</TableCell>
                  <TableCell className="font-semibold">{r.booth.name}</TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-fg-muted">
                    {r.items.map((i) => `${i.product.name} x${i.qtySubmitted}`).join(", ")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge type={STATUS_CONFIG[r.status].type} label={STATUS_CONFIG[r.status].label} />
                  </TableCell>
                  <TableCell>
                    {r.status === "SUBMITTED" && (
                      <Button size="sm" leftIcon={<PackageCheck className="w-3.5 h-3.5" />} onClick={() => openReceive(r)}>
                        Terima
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {returns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    Belum ada return.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={!!receiving} onClose={() => setReceiving(null)} title={`Terima Return — ${receiving?.returnNo}`} size="md">
        {receiving && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500 dark:text-fg-muted">
              Booth: <span className="font-semibold text-slate-800 dark:text-fg">{receiving.booth.name}</span> — cocokkan
              jumlah fisik yang benar-benar diterima.
            </p>
            <div className="space-y-2">
              {receiving.items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-line px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-fg">{item.product.name}</p>
                    <p className="text-xs text-slate-500 dark:text-fg-muted">Diajukan: {item.qtySubmitted} cup</p>
                  </div>
                  <QuantityStepperInline
                    value={qtyReceived[item.productId] ?? item.qtySubmitted}
                    onChange={(v) => setQtyReceived((prev) => ({ ...prev, [item.productId]: v }))}
                  />
                </div>
              ))}
            </div>
            <Button fullWidth isLoading={saving} onClick={handleReceive}>
              Terima Return
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function ReturnPage() {
  return (
    <RequireAuth>
      <ReturnContent />
    </RequireAuth>
  );
}
