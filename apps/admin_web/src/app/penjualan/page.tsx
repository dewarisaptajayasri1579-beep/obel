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
} from "@/lib/api-client";
import { Ban, Pencil } from "lucide-react";

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
  const [mode, setMode] = useState<"void" | "revise" | null>(null);
  const [reviseQty, setReviseQty] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState<ReasonCode>("WRONG_QTY");
  const [reasonNote, setReasonNote] = useState("");
  const [impact, setImpact] = useState<SaleCorrectionImpact | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      const d = await api.getSaleDetail(id);
      setDetail(d);
      setReviseQty(Object.fromEntries(d.items.map((i) => [i.productId, i.qty])));
      setReasonCode("WRONG_QTY");
      setReasonNote("");
      setImpact(null);
      setMode(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat detail Sale.");
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

            {mode === "revise" ? (
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
                    onClick={mode === "void" ? handleVoidConfirm : handleReviseConfirm}
                    variant={mode === "void" ? "danger" : "primary"}
                  >
                    Konfirmasi {mode === "void" ? "Pembatalan" : "Revisi"}
                  </Button>
                  <Button variant="secondary" onClick={() => { setMode(null); setImpact(null); }}>
                    Batal
                  </Button>
                </div>
              </div>
            )}

            {!mode && detail.status === "PAID" && (
              <div className="flex gap-3 pt-2 border-t border-slate-200 dark:border-line">
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
