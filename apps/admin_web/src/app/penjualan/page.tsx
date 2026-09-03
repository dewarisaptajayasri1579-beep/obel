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
import {
  api,
  ApiError,
  REASON_CODE_OPTIONS,
  type ReasonCode,
  type SaleCorrectionImpact,
  type SaleDetail,
  type SaleListItem,
  type SaleRefund,
} from "@/lib/api-client";
import { Ban, Pencil, Undo2 } from "lucide-react";

const REFUND_CONDITION_OPTIONS = [
  { value: "REFUND_NO_STOCK_RETURN", label: "Uang kembali saja (produk sudah dikonsumsi/rusak)" },
  { value: "REFUND_WITH_STOCK_RETURN", label: "Uang kembali + produk kembali ke stok" },
];

const STATUS_CONFIG: Record<SaleListItem["status"], { type: StatusBadgeType; label: string }> = {
  PENDING: { type: "expiring_next_month", label: "Pending" },
  PAID: { type: "safe", label: "Lunas" },
  VOIDED: { type: "expired", label: "Dibatalkan" },
};

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function ImpactPreview({ impact }: { impact: SaleCorrectionImpact }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-line p-3 space-y-1 text-sm">
      <p>
        Omzet:{" "}
        <span className={impact.omzetDelta < 0 ? "text-red-500 font-semibold" : "text-emerald-500 font-semibold"}>
          {impact.omzetDelta > 0 ? "+" : ""}
          {formatRupiah(impact.omzetDelta)}
        </span>
      </p>
      <p>
        Cup Terjual:{" "}
        <span className={impact.cupSoldDelta < 0 ? "text-red-500 font-semibold" : "text-emerald-500 font-semibold"}>
          {impact.cupSoldDelta > 0 ? "+" : ""}
          {impact.cupSoldDelta}
        </span>
      </p>
      {impact.stockDeltas.map((d) => (
        <p key={d.productId} className="text-slate-500 dark:text-fg-muted">
          Stok Booth {d.productName}: {d.qtyDelta > 0 ? "+" : ""}
          {d.qtyDelta}
        </p>
      ))}
    </div>
  );
}

function PenjualanContent() {
  const toast = useToast();
  const [sales, setSales] = useState<SaleListItem[] | null>(null);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [mode, setMode] = useState<"void" | "revise" | "refund" | null>(null);
  const [reviseQty, setReviseQty] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState<ReasonCode>("WRONG_QTY");
  const [reasonNote, setReasonNote] = useState("");
  const [impact, setImpact] = useState<SaleCorrectionImpact | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refunds, setRefunds] = useState<SaleRefund[]>([]);
  const [refundQty, setRefundQty] = useState<Record<string, number>>({});
  const [refundCondition, setRefundCondition] = useState<"REFUND_NO_STOCK_RETURN" | "REFUND_WITH_STOCK_RETURN">(
    "REFUND_NO_STOCK_RETURN",
  );

  async function load() {
    try {
      setSales(await api.getSales());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Penjualan.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(id: string) {
    try {
      const [d, r] = await Promise.all([api.getSaleDetail(id), api.getSaleRefunds(id)]);
      setDetail(d);
      setRefunds(r);
      setReviseQty(Object.fromEntries(d.items.map((i) => [i.productId, i.qty])));
      setRefundQty(Object.fromEntries(d.items.map((i) => [i.productId, 0])));
      setReasonCode("WRONG_QTY");
      setReasonNote("");
      setImpact(null);
      setMode(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat detail Sale.");
    }
  }

  function alreadyRefundedQty(productId: string): number {
    return refunds.reduce((sum, r) => sum + r.items.filter((i) => i.productId === productId).reduce((s, i) => s + i.qty, 0), 0);
  }

  async function handleRefundConfirm() {
    if (!detail) return;
    const items = Object.entries(refundQty)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({ productId, qty }));
    if (items.length === 0) {
      toast.error("Pilih minimal 1 produk untuk di-refund.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createSaleRefund(detail.id, {
        idempotencyKey: crypto.randomUUID(),
        items,
        condition: refundCondition,
        reasonCode,
        reasonNote: reasonNote || undefined,
      });
      toast.success(`Refund untuk Sale ${detail.saleNo} berhasil dicatat.`);
      setDetail(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memproses refund.");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadVoidPreview() {
    if (!detail) return;
    setMode("void");
    try {
      setImpact(await api.previewVoidSale(detail.id));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat preview void.");
    }
  }

  async function loadRevisePreview() {
    if (!detail) return;
    try {
      setImpact(
        await api.previewReviseSale(detail.id, {
          items: Object.entries(reviseQty).map(([productId, qty]) => ({ productId, qty })),
        }),
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat preview revisi.");
    }
  }

  async function handleVoidConfirm() {
    if (!detail) return;
    setSubmitting(true);
    try {
      await api.voidSale(detail.id, { idempotencyKey: crypto.randomUUID(), reasonCode, reasonNote: reasonNote || undefined });
      toast.success(`Sale ${detail.saleNo} berhasil dibatalkan.`);
      setDetail(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal membatalkan Sale.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReviseConfirm() {
    if (!detail) return;
    setSubmitting(true);
    try {
      await api.reviseSale(detail.id, {
        idempotencyKey: crypto.randomUUID(),
        items: Object.entries(reviseQty).map(([productId, qty]) => ({ productId, qty })),
        reasonCode,
        reasonNote: reasonNote || undefined,
      });
      toast.success(`Sale ${detail.saleNo} berhasil direvisi.`);
      setDetail(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal merevisi Sale.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Penjualan</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">200 transaksi terbaru dari seluruh Booth. Klik baris untuk detail/koreksi.</p>
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
                <TableRow key={s.id} className="cursor-pointer" onClick={() => openDetail(s.id)}>
                  <TableCell className="font-mono text-xs">
                    {s.saleNo}
                    {s.isRevised && <span className="ml-2 text-[10px] text-amber-500 font-semibold">DIREVISI</span>}
                  </TableCell>
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

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Sale ${detail.saleNo}` : ""} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500 dark:text-fg-muted">
                {detail.boothName} — {detail.staffName}
              </div>
              <StatusBadge type={STATUS_CONFIG[detail.status].type} label={STATUS_CONFIG[detail.status].label} />
            </div>

            {mode === "refund" ? (
              <div className="space-y-2">
                {detail.items.map((item) => {
                  const refunded = alreadyRefundedQty(item.productId);
                  const max = item.qty - refunded;
                  return (
                    <div key={item.productId} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-line px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-fg">{item.productName}</p>
                        <p className="text-xs text-slate-500 dark:text-fg-muted">
                          {formatRupiah(item.unitPrice)} · sudah di-refund {refunded}/{item.qty}
                        </p>
                      </div>
                      <QuantityStepperInline
                        value={refundQty[item.productId] ?? 0}
                        onChange={(v) => setRefundQty((prev) => ({ ...prev, [item.productId]: Math.min(Math.max(v, 0), max) }))}
                      />
                    </div>
                  );
                })}
                <Select
                  label="Kondisi Refund"
                  options={REFUND_CONDITION_OPTIONS}
                  value={refundCondition}
                  onChange={(v) => setRefundCondition(v as typeof refundCondition)}
                />
              </div>
            ) : mode === "revise" ? (
              <div className="space-y-2">
                {detail.items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-line px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-fg">{item.productName}</p>
                      <p className="text-xs text-slate-500 dark:text-fg-muted">{formatRupiah(item.unitPrice)}</p>
                    </div>
                    <QuantityStepperInline
                      value={reviseQty[item.productId] ?? item.qty}
                      onChange={(v) => setReviseQty((prev) => ({ ...prev, [item.productId]: v }))}
                    />
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={loadRevisePreview}>
                  Lihat Dampak
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {detail.items.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between text-sm">
                    <span>{item.productName}</span>
                    <span>
                      {item.qty} x {formatRupiah(item.unitPrice)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between font-bold pt-2 border-t border-slate-200 dark:border-line">
                  <span>Total</span>
                  <span>{formatRupiah(detail.total)}</span>
                </div>
                {refunds.length > 0 && (
                  <div className="pt-3 mt-2 border-t border-slate-200 dark:border-line space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Riwayat Refund</p>
                    {refunds.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-fg-muted">
                          {r.refundNo} · {r.condition === "REFUND_WITH_STOCK_RETURN" ? "stok kembali" : "uang saja"}
                        </span>
                        <span className="font-semibold text-red-500">-{formatRupiah(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {impact && <ImpactPreview impact={impact} />}

            {mode && (
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
                <div className="flex gap-3">
                  <Button
                    isLoading={submitting}
                    onClick={mode === "void" ? handleVoidConfirm : mode === "refund" ? handleRefundConfirm : handleReviseConfirm}
                    variant={mode === "void" ? "danger" : "primary"}
                  >
                    Konfirmasi {mode === "void" ? "Pembatalan" : mode === "refund" ? "Refund" : "Revisi"}
                  </Button>
                  <Button variant="secondary" onClick={() => { setMode(null); setImpact(null); }}>
                    Batal
                  </Button>
                </div>
              </div>
            )}

            {!mode && detail.status === "PAID" && (
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200 dark:border-line">
                <Button variant="danger" leftIcon={<Ban className="w-4 h-4" />} onClick={loadVoidPreview}>
                  Batalkan Transaksi
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<Pencil className="w-4 h-4" />}
                  onClick={() => {
                    setMode("revise");
                    setImpact(null);
                  }}
                >
                  Revisi Transaksi
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<Undo2 className="w-4 h-4" />}
                  onClick={() => {
                    setMode("refund");
                    setImpact(null);
                  }}
                >
                  Refund Customer
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
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
