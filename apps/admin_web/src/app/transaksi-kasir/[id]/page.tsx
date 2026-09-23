"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingCart, MapPin, Printer, Ban, Pencil, Undo2, CreditCard } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { QuantityStepperInline } from "@/components/warehouse/QuantityStepperInline";
import {
  api,
  ApiError,
  REASON_CODE_OPTIONS,
  type ReasonCode,
  type SaleCorrectionImpact,
  type SaleDetail,
  type SaleRefund,
} from "@/lib/api-client";
import { SaleActivityLog } from "../SaleActivityLog";
import { SaleNotaPreviewModal } from "../SaleNotaPreviewModal";

const STATUS_LABEL: Record<SaleDetail["status"], { label: string; kelas: string }> = {
  PENDING: { label: "Pending", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line" },
  PAID: { label: "Lunas", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  VOIDED: { label: "Dibatalkan", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
};

const METODE_LABEL: Record<string, string> = { CASH: "Tunai", QRIS: "QRIS", SPLIT: "Split" };
const REFUND_CONDITION_OPTIONS = [
  { value: "REFUND_NO_STOCK_RETURN", label: "Uang kembali saja (produk sudah dikonsumsi/rusak)" },
  { value: "REFUND_WITH_STOCK_RETURN", label: "Uang kembali + produk kembali ke stok" },
];

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function waktuJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function ImpactPreview({ impact }: { impact: SaleCorrectionImpact }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-line p-3 space-y-1 text-sm">
      <p>
        Omzet:{" "}
        <span className={impact.omzetDelta < 0 ? "text-red-500 font-semibold" : "text-brand-500 font-semibold"}>
          {impact.omzetDelta > 0 ? "+" : ""}
          {formatRupiah(impact.omzetDelta)}
        </span>
      </p>
      <p>
        Cup Terjual:{" "}
        <span className={impact.cupSoldDelta < 0 ? "text-red-500 font-semibold" : "text-brand-500 font-semibold"}>
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

function DetailTransaksiKasirContent({ id }: { id: string }) {
  const toast = useToast();
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [tidakAda, setTidakAda] = useState(false);
  const [refunds, setRefunds] = useState<SaleRefund[]>([]);
  const [mode, setMode] = useState<"void" | "revise" | "refund" | "payment" | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "QRIS">("CASH");
  const [reviseQty, setReviseQty] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState<ReasonCode>("WRONG_QTY");
  const [reasonNote, setReasonNote] = useState("");
  const [impact, setImpact] = useState<SaleCorrectionImpact | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refundQty, setRefundQty] = useState<Record<string, number>>({});
  const [refundCondition, setRefundCondition] = useState<"REFUND_NO_STOCK_RETURN" | "REFUND_WITH_STOCK_RETURN">(
    "REFUND_NO_STOCK_RETURN",
  );
  const [showNota, setShowNota] = useState(false);

  async function load() {
    try {
      const [d, r] = await Promise.all([api.getSaleDetail(id), api.getSaleRefunds(id)]);
      setDetail(d);
      setRefunds(r);
      setReviseQty(Object.fromEntries(d.items.map((i) => [i.productId, i.qty])));
      setRefundQty(Object.fromEntries(d.items.map((i) => [i.productId, 0])));
      setPaymentMethod(d.paymentMethod === "QRIS" ? "CASH" : "QRIS");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat detail transaksi.");
      setTidakAda(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function resetMode() {
    setMode(null);
    setImpact(null);
    setReasonCode("WRONG_QTY");
    setReasonNote("");
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
      resetMode();
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memproses refund.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePaymentConfirm() {
    if (!detail) return;
    setSubmitting(true);
    try {
      await api.revisePaymentMethod(detail.id, {
        idempotencyKey: crypto.randomUUID(),
        method: paymentMethod,
        reasonCode,
        reasonNote: reasonNote || undefined,
      });
      toast.success(`Metode pembayaran Sale ${detail.saleNo} diubah ke ${paymentMethod}.`);
      resetMode();
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal merevisi metode pembayaran.");
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
      resetMode();
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
      const result = await api.reviseSale(detail.id, {
        idempotencyKey: crypto.randomUUID(),
        items: Object.entries(reviseQty).map(([productId, qty]) => ({ productId, qty })),
        reasonCode,
        reasonNote: reasonNote || undefined,
      });
      toast.success(`Sale ${detail.saleNo} berhasil direvisi.`);
      resetMode();
      // Revisi bikin Sale baru (id beda) — arahkan ke halaman detail versi
      // barunya, bukan reload di id lama yang sudah jadi versi usang.
      window.location.href = `/transaksi-kasir/${(result as { id: string }).id}`;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal merevisi Sale.");
      setSubmitting(false);
    }
  }

  const status = detail ? STATUS_LABEL[detail.status] : null;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Transaksi Booth" },
          { label: "Kasir", href: "/transaksi-kasir" },
          { label: detail?.saleNo ?? "Detail" },
        ]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href="/transaksi-kasir"
            className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
            aria-label="Kembali ke daftar Transaksi Booth - Kasir"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <ShoppingCart className="w-5 h-5 text-[var(--brand-700)] dark:text-brand-400 mt-1.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">
                {detail?.saleNo ?? "Memuat..."}
              </h1>
              {status && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${status.kelas}`}>
                  {status.label}
                </span>
              )}
              {detail && detail.versionNo > 1 && (
                <span className="text-xs font-semibold text-slate-400 dark:text-fg-muted">
                  versi {detail.versionNo}
                  {detail.revisionOfSaleNo && ` — revisi dari ${detail.revisionOfSaleNo}`}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              {detail ? `${detail.boothName} — ${detail.staffName} — Shift ${detail.shiftLabel}` : "Memuat data transaksi..."}
            </p>
          </div>
        </div>

        {detail && (
          <Button variant="secondary" size="sm" leftIcon={<Printer className="w-3.5 h-3.5" />} onClick={() => setShowNota(true)}>
            Cetak Struk
          </Button>
        )}
      </div>

      <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs space-y-5">
        {tidakAda ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-fg-muted">
            Transaksi tidak ditemukan.{" "}
            <Link href="/transaksi-kasir" className="font-semibold text-[var(--brand-700)] hover:underline">
              Kembali ke daftar
            </Link>
          </div>
        ) : !detail ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200/80 dark:border-line p-3">
                <p className="text-[11px] text-slate-400 dark:text-fg-muted">Dibayar</p>
                <p className="text-sm font-bold text-slate-800 dark:text-fg mt-0.5">
                  {detail.paidAt ? waktuJakarta(detail.paidAt) : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-line p-3">
                <p className="text-[11px] text-slate-400 dark:text-fg-muted">Metode Bayar</p>
                <p className="text-sm font-bold text-slate-800 dark:text-fg mt-0.5">{METODE_LABEL[detail.paymentMethod]}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-line p-3">
                <p className="text-[11px] text-slate-400 dark:text-fg-muted">Subtotal</p>
                <p className="text-sm font-bold text-slate-800 dark:text-fg mt-0.5">{formatRupiah(detail.subtotal)}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-line p-3">
                <p className="text-[11px] text-slate-400 dark:text-fg-muted">Diskon</p>
                <p className="text-sm font-bold text-slate-800 dark:text-fg mt-0.5">{formatRupiah(detail.discount)}</p>
              </div>
            </div>

            {detail.status === "VOIDED" && detail.voidReason && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/10 p-3 text-xs text-rose-700 dark:text-rose-400">
                Dibatalkan {detail.voidedAt && waktuJakarta(detail.voidedAt)} — {detail.voidReason}
              </div>
            )}

            {detail.latitude !== null && detail.longitude !== null && (
              <a
                href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-700)] dark:text-brand-400 hover:underline"
              >
                <MapPin className="w-3.5 h-3.5" />
                Lihat lokasi transaksi di peta
                {detail.locationCapturedAt && ` (${waktuJakarta(detail.locationCapturedAt)})`}
              </a>
            )}

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
            ) : mode === "payment" ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 dark:text-fg-muted">
                  Metode saat ini: <span className="font-semibold text-slate-800 dark:text-fg">{METODE_LABEL[detail.paymentMethod]}</span>
                </p>
                <Select
                  label="Metode Baru"
                  options={[
                    { value: "CASH", label: "Tunai" },
                    { value: "QRIS", label: "QRIS" },
                  ]}
                  value={paymentMethod}
                  onChange={(v) => setPaymentMethod(v as "CASH" | "QRIS")}
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
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-fg-secondary mb-2">Item Transaksi</p>
                <div className="space-y-1">
                  {detail.items.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between text-sm">
                      <span>{item.productName}</span>
                      <span>
                        {item.qty} x {formatRupiah(item.unitPrice)} = {formatRupiah(item.lineTotal)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between font-bold pt-2 border-t border-slate-200 dark:border-line">
                    <span>Total</span>
                    <span>{formatRupiah(detail.total)}</span>
                  </div>
                </div>

                {detail.payments.length > 0 && (
                  <div className="pt-3 mt-2 border-t border-slate-200 dark:border-line space-y-1.5">
                    <p className="text-xs font-bold text-slate-700 dark:text-fg-secondary">Rincian Pembayaran</p>
                    {detail.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-fg-muted">
                          {METODE_LABEL[p.method]} · {waktuJakarta(p.paidAt)}
                          {p.status !== "POSTED" && ` (${p.status})`}
                        </span>
                        <span className={`font-semibold ${p.status === "POSTED" ? "text-slate-800 dark:text-fg" : "text-slate-400 line-through"}`}>
                          {formatRupiah(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {refunds.length > 0 && (
                  <div className="pt-3 mt-2 border-t border-slate-200 dark:border-line space-y-1.5">
                    <p className="text-xs font-bold text-slate-700 dark:text-fg-secondary">Riwayat Refund</p>
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
                    onClick={
                      mode === "void"
                        ? handleVoidConfirm
                        : mode === "refund"
                          ? handleRefundConfirm
                          : mode === "payment"
                            ? handlePaymentConfirm
                            : handleReviseConfirm
                    }
                    variant={mode === "void" ? "danger" : "primary"}
                  >
                    Konfirmasi {mode === "void" ? "Pembatalan" : mode === "refund" ? "Refund" : mode === "payment" ? "Perubahan Metode" : "Revisi"}
                  </Button>
                  <Button variant="secondary" onClick={resetMode}>
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
                <Button variant="secondary" leftIcon={<Pencil className="w-4 h-4" />} onClick={() => setMode("revise")}>
                  Revisi Transaksi
                </Button>
                <Button variant="secondary" leftIcon={<Undo2 className="w-4 h-4" />} onClick={() => setMode("refund")}>
                  Refund Customer
                </Button>
                <Button variant="secondary" leftIcon={<CreditCard className="w-4 h-4" />} onClick={() => setMode("payment")}>
                  Revisi Metode Pembayaran
                </Button>
              </div>
            )}

            <SaleActivityLog saleId={detail.id} />
          </>
        )}
      </Card>

      <SaleNotaPreviewModal isOpen={showNota} onClose={() => setShowNota(false)} sale={detail} />
    </div>
  );
}

export default function DetailTransaksiKasirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <DetailTransaksiKasirContent id={id} />
    </RequireAuth>
  );
}
