"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge, type StatusBadgeType } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/Textarea";
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
import { api, ApiError, REASON_CODE_OPTIONS, type ReasonCode, type StockReturn } from "@/lib/api-client";
import { Ban, Pencil, PackageCheck, Wrench } from "lucide-react";

const STATUS_CONFIG: Record<StockReturn["status"], { type: StatusBadgeType; label: string }> = {
  SUBMITTED: { type: "expiring_next_month", label: "Menunggu Diterima" },
  RECEIVED: { type: "safe", label: "Diterima" },
  DISCREPANCY: { type: "expiring_this_month", label: "Ada Selisih" },
  CANCELLED: { type: "expired", label: "Dibatalkan" },
};

function ReturnContent() {
  const toast = useToast();
  const [returns, setReturns] = useState<StockReturn[] | null>(null);

  const [detail, setDetail] = useState<StockReturn | null>(null);
  const [mode, setMode] = useState<"receive" | "cancel" | "revise" | "correct" | null>(null);
  const [itemQty, setItemQty] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState<ReasonCode>("WRONG_QTY");
  const [reasonNote, setReasonNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  function openDetail(r: StockReturn) {
    setDetail(r);
    setItemQty(Object.fromEntries(r.items.map((i) => [i.productId, i.qtyReceived ?? i.qtySubmitted])));
    setReasonCode("WRONG_QTY");
    setReasonNote("");
    setMode(null);
  }

  async function handleConfirm() {
    if (!detail) return;
    setSubmitting(true);
    try {
      const items = Object.entries(itemQty).map(([productId, qty]) => ({ productId, qty }));
      if (mode === "receive") {
        await api.receiveReturn(detail.id, items.map((i) => ({ productId: i.productId, qtyReceived: i.qty })));
        toast.success(`Return ${detail.returnNo} diterima.`);
      } else if (mode === "cancel") {
        await api.cancelReturn(detail.id, { idempotencyKey: crypto.randomUUID(), reasonCode, reasonNote: reasonNote || undefined });
        toast.success(`Return ${detail.returnNo} dibatalkan.`);
      } else if (mode === "revise") {
        await api.reviseReturn(detail.id, { idempotencyKey: crypto.randomUUID(), items, reasonCode, reasonNote: reasonNote || undefined });
        toast.success(`Return ${detail.returnNo} direvisi.`);
      } else if (mode === "correct") {
        await api.correctReturnReceipt(detail.id, { idempotencyKey: crypto.randomUUID(), items, reasonCode, reasonNote: reasonNote || undefined });
        toast.success(`Penerimaan Return ${detail.returnNo} dikoreksi.`);
      }
      setDetail(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memproses.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Return Stok</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">
          Sisa stok yang dikembalikan Booth ke Gudang Pusat setelah closing shift. Klik baris untuk detail/koreksi.
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => openDetail(r)}>
                  <TableCell className="font-mono text-xs">{r.returnNo}</TableCell>
                  <TableCell className="font-semibold">{r.booth.name}</TableCell>
                  <TableCell className="text-sm text-slate-500 dark:text-fg-muted">
                    {r.items.map((i) => `${i.product.name} x${i.qtySubmitted}`).join(", ")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge type={STATUS_CONFIG[r.status].type} label={STATUS_CONFIG[r.status].label} />
                  </TableCell>
                </TableRow>
              ))}
              {returns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                    Belum ada return.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Return ${detail.returnNo}` : ""} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-fg-muted">{detail.booth.name}</div>
              <StatusBadge type={STATUS_CONFIG[detail.status].type} label={STATUS_CONFIG[detail.status].label} />
            </div>

            {mode ? (
              <div className="space-y-2">
                {detail.items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-line px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-fg">{item.product.name}</p>
                      <p className="text-xs text-slate-500 dark:text-fg-muted">
                        Diajukan {item.qtySubmitted} · Diterima {item.qtyReceived ?? "-"}
                      </p>
                    </div>
                    {mode !== "cancel" && (
                      <QuantityStepperInline
                        value={itemQty[item.productId] ?? item.qtySubmitted}
                        onChange={(v) => setItemQty((prev) => ({ ...prev, [item.productId]: v }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {detail.items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between text-sm">
                    <span>{item.product.name}</span>
                    <span>
                      Diajukan {item.qtySubmitted} · Diterima {item.qtyReceived ?? "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {mode && mode !== "receive" && (
              <div className="space-y-3">
                <Select
                  label="Alasan Koreksi"
                  options={REASON_CODE_OPTIONS}
                  value={reasonCode}
                  onChange={(v) => setReasonCode(v as ReasonCode)}
                />
                <Textarea
                  label="Catatan (wajib jika alasan Lainnya)"
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  placeholder="Catatan tambahan..."
                />
              </div>
            )}

            {mode && (
              <div className="flex gap-3">
                <Button isLoading={submitting} variant={mode === "cancel" ? "danger" : "primary"} onClick={handleConfirm}>
                  Konfirmasi {mode === "receive" ? "Penerimaan" : mode === "cancel" ? "Pembatalan" : mode === "revise" ? "Revisi" : "Koreksi"}
                </Button>
                <Button variant="secondary" onClick={() => setMode(null)}>
                  Batal
                </Button>
              </div>
            )}

            {!mode && detail.status === "SUBMITTED" && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200 dark:border-line">
                <Button leftIcon={<PackageCheck className="w-4 h-4" />} onClick={() => setMode("receive")}>
                  Terima Return
                </Button>
                <Button variant="danger" leftIcon={<Ban className="w-4 h-4" />} onClick={() => setMode("cancel")}>
                  Batalkan
                </Button>
                <Button variant="secondary" leftIcon={<Pencil className="w-4 h-4" />} onClick={() => setMode("revise")}>
                  Revisi
                </Button>
              </div>
            )}

            {!mode && (detail.status === "RECEIVED" || detail.status === "DISCREPANCY") && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200 dark:border-line">
                <Button variant="secondary" leftIcon={<Wrench className="w-4 h-4" />} onClick={() => setMode("correct")}>
                  Koreksi Penerimaan
                </Button>
              </div>
            )}
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
