"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Check, History, Printer, Truck, Wrench, X } from "lucide-react";
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
  type TindakLanjutSelisih,
  type StockHandover,
} from "@/lib/api-client";
import { randomUUID } from "@/lib/uuid";
import { QuantityStepperInline } from "@/components/warehouse/QuantityStepperInline";
import { SerahTerimaActivityLog } from "../SerahTerimaActivityLog";
import { SerahTerimaNotaPreviewModal } from "../SerahTerimaNotaPreviewModal";

const ALASAN_SELISIH_LABEL: Record<string, string> = {
  LEBIH: "Stok Lebih",
  KURANG: "Stok Kurang",
  RUSAK: "Rusak",
  LAINNYA: "Lainnya",
};

/// Tindak lanjut Admin per baris produk yang selisih saat Koreksi Penerimaan
/// (lihat TindakLanjutSelisih di api-client.ts & correctReceipt() backend):
/// Rusak = qty tetap dipotong & masuk Laporan Stok Rusak, Salah Hitung =
/// qty dikembalikan/dikoreksi biasa, Ganti Rugi Petugas = dicatat sebagai
/// beban ke Petugas yang menerima (belum ada alur pelunasan).
const TINDAK_LANJUT_LABEL: Record<TindakLanjutSelisih, string> = {
  RUSAK: "Rusak",
  SALAH_HITUNG: "Salah Hitung",
  GANTI_RUGI_PETUGAS: "Ganti Rugi Petugas",
  LAINNYA: "Lainnya",
};

const STATUS_LABEL: Record<StockHandover["status"], { label: string; kelas: string }> = {
  DIAJUKAN: { label: "Diajukan", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line" },
  DIPROSES: { label: "Diproses", kelas: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40" },
  DITERIMA: { label: "Diterima", kelas: "bg-brand-50 dark:bg-brand-500/10 text-(--brand-700) dark:text-brand-400 border-brand-200 dark:border-brand-500/20" },
  DITOLAK: { label: "Ditolak", kelas: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40" },
  DIBATALKAN: { label: "Dibatalkan", kelas: "bg-slate-100 dark:bg-surface-hover text-slate-500 dark:text-fg-muted border-slate-200 dark:border-line" },
};

/// Gabungan jenis+sumber jadi satu label yang langsung menjelaskan asal
/// dokumen (lihat penjelasan sama di ../page.tsx `keteranganDokumen`).
function keteranganDokumen(r: StockHandover): { label: string; kelas: string } {
  if (r.jenis === "STOK_AWAL") {
    return { label: "Kirim Stok (Awal)", kelas: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20" };
  }
  if (r.kind === "request") {
    return { label: "Pengajuan dari Petugas", kelas: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20" };
  }
  if (r.sumber === "ADMIN") {
    return { label: "Kirim Stok (Re-Stok)", kelas: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" };
  }
  return { label: "Re-Stok dari Petugas", kelas: "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20" };
}

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
  const [tampilkanSemuaProduk, setTampilkanSemuaProduk] = useState(false);
  const [tindakLanjut, setTindakLanjut] = useState<Record<string, TindakLanjutSelisih>>({});
  const [tindakLanjutNote, setTindakLanjutNote] = useState<Record<string, string>>({});

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
    setTampilkanSemuaProduk(false);
    setTindakLanjut({});
    setTindakLanjutNote({});
    setMode(m);
  }

  const itemSelisihDetail = detail
    ? detail.items.filter((i) => (i.qtyReceived ?? i.qty) !== i.qty)
    : [];
  const semuaTindakLanjutTerisi =
    mode !== "correct" ||
    itemSelisihDetail.every((i) => {
      const t = tindakLanjut[i.productId];
      if (!t) return false;
      return t !== "LAINNYA" || (tindakLanjutNote[i.productId] ?? "").trim().length > 0;
    });

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
        await api.cancelStockHandover(detail.id, { idempotencyKey: randomUUID(), reasonCode, reasonNote: reasonNote || undefined });
        toast.success(`"${detail.docNo}" dibatalkan.`);
      } else if (mode === "revise") {
        const revisi = await api.reviseStockHandover(detail.id, { idempotencyKey: randomUUID(), items, reasonCode, reasonNote: reasonNote || undefined });
        toast.success(`Direvisi menjadi dokumen baru.`);
        window.location.href = `/serah-terima-stok/dist_${revisi.id}`;
        return;
      } else if (mode === "correct") {
        if (!semuaTindakLanjutTerisi) {
          toast.warning("Pilih tindak lanjut untuk setiap produk yang selisih.");
          setSubmitting(false);
          return;
        }
        const itemsDenganTindakLanjut = items.map((i) => ({
          ...i,
          tindakLanjut: tindakLanjut[i.productId],
          tindakLanjutNote: tindakLanjut[i.productId] === "LAINNYA" ? tindakLanjutNote[i.productId]?.trim() : undefined,
        }));
        await api.correctStockHandoverReceipt(detail.id, {
          idempotencyKey: randomUUID(),
          items: itemsDenganTindakLanjut,
          reasonCode,
          reasonNote: reasonNote || undefined,
        });
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
            className="w-9 h-9 rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-2xs flex items-center justify-center shrink-0 text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
            aria-label="Kembali ke daftar Serah Terima Stok"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <Truck className="w-5 h-5 text-(--brand-700) dark:text-brand-400 mt-1.5 shrink-0" />
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

      <Card variant="solid" padding="md" className="rounded-xl! shadow-2xs!">
        {tidakAda ? (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-fg-muted">
            Dokumen tidak ditemukan.{" "}
            <Link href="/serah-terima-stok" className="font-semibold text-(--brand-700) hover:underline">
              Kembali ke daftar
            </Link>
          </div>
        ) : !detail ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Tanggal</p>
                <p className="font-semibold text-slate-800 dark:text-fg mt-0.5">{tanggalJakarta(detail.date)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Keterangan</p>
                <p className="mt-0.5">
                  {(() => {
                    const keterangan = keteranganDokumen(detail);
                    return (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${keterangan.kelas}`}>
                        {keterangan.label}
                      </span>
                    );
                  })()}
                </p>
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

            {(() => {
              const adaSelisih = (item: (typeof detail.items)[number]) => (item.qtyReceived ?? item.qty) !== item.qty;
              const itemSelisih = detail.items.filter(adaSelisih);
              const persempitKeSelisih = mode === "correct" && !tampilkanSemuaProduk && itemSelisih.length > 0;
              const itemDitampilkan = persempitKeSelisih ? itemSelisih : detail.items;
              return (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-bold text-slate-700 dark:text-fg">
                      {mode === "approve" || mode === "revise" || mode === "correct" ? "Sesuaikan Qty" : "Item"}
                    </p>
                    {mode === "correct" && itemSelisih.length > 0 && itemSelisih.length < detail.items.length && (
                      <button
                        type="button"
                        onClick={() => setTampilkanSemuaProduk((v) => !v)}
                        className="text-[11px] font-semibold text-(--brand-700) dark:text-brand-400 hover:underline cursor-pointer"
                      >
                        {persempitKeSelisih ? `Tampilkan semua ${detail.items.length} produk` : "Tampilkan yang selisih saja"}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-line">
                    <table className="w-full text-xs">
                      <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                        <tr>
                          <th className={`py-2.5 px-3 text-left ${mode === "correct" ? "w-40" : ""}`}>Nama Produk</th>
                          <th className="py-2.5 px-3 text-right w-28">Qty Dikirim/Diajukan</th>
                          <th className="py-2.5 px-3 text-right w-24">Qty Diterima</th>
                          {mode === "correct" && <th className="py-2.5 px-3 text-left">Tindak Lanjut</th>}
                          {(mode === "approve" || mode === "revise" || mode === "correct") && (
                            <th className="py-2.5 px-3 text-right w-32">Koreksi</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-line">
                        {itemDitampilkan.map((item) => {
                          const selisih = adaSelisih(item) ? (item.qtyReceived ?? item.qty) - item.qty : 0;
                          const qtyRugi = item.qty - (itemQty[item.productId] ?? item.qty);
                          return (
                            <tr key={item.productId} className={selisih !== 0 ? "bg-rose-50/60 dark:bg-rose-900/10" : undefined}>
                              <td className={`py-2 px-3 text-slate-800 dark:text-fg font-medium ${mode === "correct" ? "max-w-40" : ""}`}>
                                <span className="wrap-break-word">{item.productName}</span>
                                {selisih !== 0 && item.discrepancyReasonCode && (
                                  <p className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 mt-0.5">
                                    Alasan Petugas: {ALASAN_SELISIH_LABEL[item.discrepancyReasonCode] ?? item.discrepancyReasonCode}
                                    {item.discrepancyNote ? ` — ${item.discrepancyNote}` : ""}
                                  </p>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-fg">{item.qty}</td>
                              <td
                                className={`py-2 px-3 text-right tabular-nums font-semibold ${
                                  selisih !== 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-fg-secondary"
                                }`}
                              >
                                {item.qtyReceived ?? "-"}
                                {selisih !== 0 && (
                                  <span className="ml-1.5 text-[10px] font-bold">({selisih > 0 ? `+${selisih}` : selisih})</span>
                                )}
                              </td>
                              {mode === "correct" && (
                                <td className="py-2 px-3 align-top">
                                  {selisih !== 0 ? (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex flex-wrap gap-1">
                                        {(["RUSAK", "SALAH_HITUNG", "GANTI_RUGI_PETUGAS", "LAINNYA"] as TindakLanjutSelisih[]).map((opt) => {
                                          const aktif = tindakLanjut[item.productId] === opt;
                                          return (
                                            <button
                                              key={opt}
                                              type="button"
                                              onClick={() => {
                                                setTindakLanjut((prev) => ({ ...prev, [item.productId]: opt }));
                                                if (opt !== "SALAH_HITUNG") {
                                                  setItemQty((prev) => ({ ...prev, [item.productId]: item.qtyReceived ?? item.qty }));
                                                }
                                              }}
                                              className={`text-[10px] font-bold rounded-full px-2 py-1 border cursor-pointer transition-colors ${
                                                aktif
                                                  ? "bg-(--brand-700) text-white border-(--brand-700)"
                                                  : "bg-white dark:bg-surface text-slate-600 dark:text-fg-secondary border-slate-200 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover"
                                              }`}
                                            >
                                              {TINDAK_LANJUT_LABEL[opt]}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {tindakLanjut[item.productId] === "GANTI_RUGI_PETUGAS" && qtyRugi > 0 && (
                                        <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                                          Beban: {qtyRugi} x Rp{(item.sellPrice ?? 0).toLocaleString("id-ID")} = Rp
                                          {(qtyRugi * (item.sellPrice ?? 0)).toLocaleString("id-ID")}
                                        </span>
                                      )}
                                      {tindakLanjut[item.productId] === "LAINNYA" && (
                                        <input
                                          type="text"
                                          value={tindakLanjutNote[item.productId] ?? ""}
                                          onChange={(e) =>
                                            setTindakLanjutNote((prev) => ({ ...prev, [item.productId]: e.target.value }))
                                          }
                                          placeholder="Catatan tindak lanjut (wajib)..."
                                          className="w-full rounded-lg border border-slate-200 dark:border-line px-2 py-1 text-[11px]"
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 dark:text-fg-disabled">-</span>
                                  )}
                                </td>
                              )}
                              {(mode === "approve" || mode === "revise" || mode === "correct") && (
                                <td className="py-2 px-3 text-right">
                                  {mode === "correct" && selisih !== 0 && tindakLanjut[item.productId] !== "SALAH_HITUNG" ? (
                                    <span className="text-xs font-bold text-slate-400 dark:text-fg-disabled" title="Qty terkunci — hanya bisa diubah kalau Tindak Lanjut-nya Salah Hitung">
                                      {itemQty[item.productId] ?? item.qty} (terkunci)
                                    </span>
                                  ) : (
                                    <QuantityStepperInline
                                      value={itemQty[item.productId] ?? item.qty}
                                      onChange={(v) => setItemQty((prev) => ({ ...prev, [item.productId]: v }))}
                                    />
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {mode === "reject" && (
              <Input
                label="Alasan Penolakan"
                placeholder="mis. Stok Gudang tidak cukup"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            )}

            {(mode === "cancel" || mode === "revise") && (
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

            {mode === "correct" && !semuaTindakLanjutTerisi && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 text-right">
                Pilih Tindak Lanjut untuk setiap produk yang selisih sebelum konfirmasi.
              </p>
            )}

            <div className="border-t border-slate-200/60 dark:border-line pt-4 flex flex-wrap items-center justify-end gap-2">
              {mode ? (
                <>
                  <Button variant="secondary" onClick={() => setMode(null)} disabled={submitting}>
                    Batal
                  </Button>
                  <Button
                    isLoading={submitting}
                    disabled={mode === "correct" && !semuaTindakLanjutTerisi}
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
                      <button
                        type="button"
                        onClick={() => bukaMode("revise")}
                        className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Revisi</span>
                      </button>
                    </>
                  )}

                  {detail.status === "DITERIMA" && (
                    <button
                      type="button"
                      onClick={() => bukaMode("correct")}
                      className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Koreksi Penerimaan</span>
                    </button>
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
