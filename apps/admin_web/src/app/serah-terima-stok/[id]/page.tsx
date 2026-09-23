"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Check, Pencil, Printer, Truck, Wrench, X } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import {
  api,
  ApiError,
  REASON_CODE_OPTIONS,
  type ReasonCode,
  type StockHandover,
} from "@/lib/api-client";
import { QuantityStepperInline } from "@/components/warehouse/QuantityStepperInline";
import { SerahTerimaActivityLog } from "../SerahTerimaActivityLog";
import { SerahTerimaNotaPreviewModal } from "../SerahTerimaNotaPreviewModal";

const STATUS_LABEL: Record<StockHandover["status"], { label: string; kelas: string }> = {
  DIAJUKAN: { label: "Diajukan", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line" },
  DIPROSES: { label: "Diproses", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
  DITERIMA: { label: "Diterima", kelas: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  DITOLAK: { label: "Ditolak", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
  DIBATALKAN: { label: "Dibatalkan", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line" },
};

const JENIS_LABEL: Record<string, string> = { STOK_AWAL: "Stok Awal", RE_STOK: "Re-Stok" };
const SUMBER_LABEL: Record<string, string> = { PETUGAS: "Petugas", ADMIN: "Admin" };

function tanggalJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

type Mode = "approve" | "reject" | "cancel" | "revise" | "correct" | null;

function DetailSerahTerimaContent({ id }: { id: string }) {
  const toast = useToast();
  const [detail, setDetail] = useState<StockHandover | null>(null);
  const [tidakAda, setTidakAda] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [itemQty, setItemQty] = useState<Record<string, number>>({});
  const [reasonCode, setReasonCode] = useState<ReasonCode>("WRONG_QTY");
  const [reasonNote, setReasonNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showNota, setShowNota] = useState(false);

  async function load() {
    try {
      const d = await api.getStockHandover(id);
      setDetail(d);
      setItemQty(Object.fromEntries(d.items.map((i) => [i.productId, i.qtyReceived ?? i.qty])));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat dokumen.");
      setTidakAda(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function bukaMode(m: Mode) {
    if (!detail) return;
    setItemQty(Object.fromEntries(detail.items.map((i) => [i.productId, i.qtyReceived ?? i.qty])));
    setReasonCode("WRONG_QTY");
    setReasonNote("");
    setRejectReason("");
    setMode(m);
  }

  async function konfirmasi() {
    if (!detail) return;
    setSubmitting(true);
    try {
      const items = Object.entries(itemQty).map(([productId, qty]) => ({ productId, qty }));
      if (mode === "approve") {
        await api.approveStockHandover(
          detail.id,
          detail.items.map((i) => ({ productId: i.productId, qtyApproved: itemQty[i.productId] ?? i.qty })),
        );
        toast.success(`"${detail.docNo}" disetujui & dikirim.`);
      } else if (mode === "reject") {
        if (!rejectReason.trim()) {
          toast.warning("Alasan penolakan wajib diisi.");
          setSubmitting(false);
          return;
        }
        await api.rejectStockHandover(detail.id, rejectReason.trim());
        toast.success(`"${detail.docNo}" ditolak.`);
      } else if (mode === "cancel") {
        await api.cancelStockHandover(detail.id, { idempotencyKey: crypto.randomUUID(), reasonCode, reasonNote: reasonNote || undefined });
        toast.success(`"${detail.docNo}" dibatalkan.`);
      } else if (mode === "revise") {
        const revisi = await api.reviseStockHandover(detail.id, { idempotencyKey: crypto.randomUUID(), items, reasonCode, reasonNote: reasonNote || undefined });
        toast.success(`Direvisi menjadi dokumen baru.`);
        window.location.href = `/serah-terima-stok/dist_${revisi.id}`;
        return;
      } else if (mode === "correct") {
        await api.correctStockHandoverReceipt(detail.id, { idempotencyKey: crypto.randomUUID(), items, reasonCode, reasonNote: reasonNote || undefined });
        toast.success(`Penerimaan "${detail.docNo}" dikoreksi.`);
      }
      setMode(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memproses aksi.");
    } finally {
      setSubmitting(false);
    }
  }

  const status = detail ? STATUS_LABEL[detail.status] : null;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Transaksi" },
          { label: "Serah Terima Stok", href: "/serah-terima-stok" },
          { label: detail?.docNo ?? "Detail" },
        ]}
      />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link
            href="/serah-terima-stok"
            className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
            aria-label="Kembali ke daftar Serah Terima Stok"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Truck className="w-5 h-5 text-[var(--brand-700)] dark:text-brand-400 mt-1.5 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-fg tracking-tight">
                {detail?.docNo ?? "Memuat..."}
              </h1>
              {status && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${status.kelas}`}>
                  {status.label}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-fg-muted font-medium mt-1">
              {detail ? `${detail.staffName ?? "-"} · ${detail.boothName}` : ""}
            </p>
          </div>
        </div>
      </div>

      <Card variant="solid" padding="md" className="!rounded-xl !shadow-2xs">
        {tidakAda ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-fg-muted">
            Dokumen tidak ditemukan.{" "}
            <Link href="/serah-terima-stok" className="font-semibold text-[var(--brand-700)] hover:underline">
              Kembali ke daftar
            </Link>
          </div>
        ) : !detail ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 text-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Tanggal</p>
                <p className="font-semibold text-slate-800 dark:text-fg mt-0.5">{tanggalJakarta(detail.date)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Jenis</p>
                <p className="font-semibold text-slate-800 dark:text-fg mt-0.5">{detail.jenis ? JENIS_LABEL[detail.jenis] : "-"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Sumber</p>
                <p className="font-semibold text-slate-800 dark:text-fg mt-0.5">{SUMBER_LABEL[detail.sumber]}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Catatan</p>
                <p className="font-semibold text-slate-800 dark:text-fg mt-0.5">{detail.note || "-"}</p>
              </div>
            </div>

            {detail.status === "DITOLAK" && detail.rejectReason && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-900/20 p-3 text-xs text-rose-700 dark:text-rose-400">
                <strong className="font-bold">Alasan ditolak:</strong> {detail.rejectReason}
              </div>
            )}

            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-fg mb-2">
                {mode === "approve" || mode === "revise" || mode === "correct" ? "Sesuaikan Qty" : "Item"}
              </p>
              <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-line">
                <table className="w-full text-xs">
                  <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Nama Produk</th>
                      <th className="py-2.5 px-3 text-right w-32">Qty Dikirim/Diajukan</th>
                      <th className="py-2.5 px-3 text-right w-32">Qty Diterima</th>
                      {(mode === "approve" || mode === "revise" || mode === "correct") && (
                        <th className="py-2.5 px-3 text-right w-36">Koreksi</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-line">
                    {detail.items.map((item) => (
                      <tr key={item.productId}>
                        <td className="py-2 px-3 text-slate-800 dark:text-fg font-medium">{item.productName}</td>
                        <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-fg">{item.qty}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-600 dark:text-fg-secondary">{item.qtyReceived ?? "-"}</td>
                        {(mode === "approve" || mode === "revise" || mode === "correct") && (
                          <td className="py-2 px-3 text-right">
                            <QuantityStepperInline
                              value={itemQty[item.productId] ?? item.qty}
                              onChange={(v) => setItemQty((prev) => ({ ...prev, [item.productId]: v }))}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {mode === "reject" && (
              <Input
                label="Alasan Penolakan"
                placeholder="mis. Stok Gudang tidak cukup"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            )}

            {(mode === "cancel" || mode === "revise" || mode === "correct") && (
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

            <SerahTerimaActivityLog id={detail.id} />

            <div className="border-t border-slate-200/60 dark:border-line pt-4 flex flex-wrap items-center justify-end gap-2">
              {mode ? (
                <>
                  <Button variant="secondary" onClick={() => setMode(null)} disabled={submitting}>
                    Batal
                  </Button>
                  <Button
                    isLoading={submitting}
                    variant={mode === "cancel" || mode === "reject" ? "danger" : "primary"}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                    onClick={konfirmasi}
                  >
                    Konfirmasi{" "}
                    {mode === "approve"
                      ? "Setujui & Kirim"
                      : mode === "reject"
                        ? "Penolakan"
                        : mode === "cancel"
                          ? "Pembatalan"
                          : mode === "revise"
                            ? "Revisi"
                            : "Koreksi"}
                  </Button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowNota(true)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-line bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg font-semibold text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Nota</span>
                  </button>

                  {detail.status === "DIAJUKAN" && (
                    <>
                      <Button leftIcon={<Check className="w-3.5 h-3.5" />} onClick={() => bukaMode("approve")}>
                        Setujui & Kirim
                      </Button>
                      <Button variant="outline" leftIcon={<X className="w-3.5 h-3.5" />} onClick={() => bukaMode("reject")}>
                        Tolak
                      </Button>
                    </>
                  )}

                  {detail.status === "DIPROSES" && (
                    <>
                      <Button variant="danger" leftIcon={<Ban className="w-3.5 h-3.5" />} onClick={() => bukaMode("cancel")}>
                        Batalkan
                      </Button>
                      <Button variant="secondary" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => bukaMode("revise")}>
                        Revisi
                      </Button>
                    </>
                  )}

                  {detail.status === "DITERIMA" && (
                    <Button variant="secondary" leftIcon={<Wrench className="w-3.5 h-3.5" />} onClick={() => bukaMode("correct")}>
                      Koreksi Penerimaan
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Card>

      {detail && (
        <SerahTerimaNotaPreviewModal isOpen={showNota} onClose={() => setShowNota(false)} handoverId={detail.id} docNo={detail.docNo} />
      )}
    </div>
  );
}

export default function DetailSerahTerimaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireAuth>
      <DetailSerahTerimaContent id={id} />
    </RequireAuth>
  );
}
