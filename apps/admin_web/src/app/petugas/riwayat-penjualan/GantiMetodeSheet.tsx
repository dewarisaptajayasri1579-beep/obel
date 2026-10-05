"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { api, ApiError, type SaleListItem } from "@/lib/api-client";
import { randomUUID } from "@/lib/uuid";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { useHidePetugasNav } from "@/components/layout/PetugasShell";
import { PhotoCapture } from "../_components/PhotoCapture";
import {
  KodeQrisBooth,
  PilihMetodeBayar,
  SplitBayarInput,
  labelMetodeBayar,
  rencanaBayar,
  splitValid,
  type MetodeBayar,
} from "../_components/PembayaranInput";
import { formatRupiah } from "../_lib/format";
import { OBBEL, OBBEL_SCALE } from "../_lib/theme";

const GREEN = OBBEL.primaryDark;

/// Barista mengganti metode bayar transaksi yang SUDAH dibayar (pelanggan berubah
/// pikiran) — hanya untuk transaksi di shift aktifnya; backend yang menegakkan
/// aturannya (SALE_NOT_IN_ACTIVE_SHIFT, alasan wajib, foto bukti QRIS wajib).
export function GantiMetodeSheet({
  sale,
  qrisImageUrl,
  onClose,
  onDone,
}: {
  sale: SaleListItem;
  qrisImageUrl: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  useHidePetugasNav();
  const toast = useToast();
  const tunaiSekarang = sale.payments.find((p) => p.method === "CASH")?.amount ?? 0;
  const [metode, setMetode] = useState<MetodeBayar>(sale.paymentMethod ?? "CASH");
  const [splitTunai, setSplitTunai] = useState(sale.paymentMethod === "SPLIT" ? tunaiSekarang : 0);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [alasan, setAlasan] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Satu key per sheet dibuka: kalau respons hilang lalu ditekan lagi, backend
  // mengenali key yang sama dan tidak mencatat penggantian dua kali.
  const [key] = useState(() => randomUUID());

  const rencana = rencanaBayar(metode, sale.total, splitTunai);
  const barisBaru = "payments" in rencana ? rencana.payments : [{ method: rencana.paymentMethod, amount: sale.total }];
  const ringkas = (rows: { method: string; amount: number }[]) =>
    rows.map((r) => `${r.method}:${r.amount}`).sort().join("|");
  const berubah = ringkas(barisBaru) !== ringkas(sale.payments);
  const butuhBukti = metode !== "CASH";
  const bisaSimpan =
    berubah && (metode !== "SPLIT" || splitValid(sale.total, splitTunai)) && (!butuhBukti || !!foto) && alasan.trim().length > 0;

  async function simpan() {
    if (!bisaSimpan) return;
    setSubmitting(true);
    try {
      let qrisProofPhotoUrl: string | undefined;
      if (butuhBukti && foto) {
        qrisProofPhotoUrl = fotoUrl ?? (await api.uploadPaymentProofPhoto(foto)).photoUrl;
        setFotoUrl(qrisProofPhotoUrl);
      }
      await api.revisePaymentMethod(sale.id, {
        idempotencyKey: key,
        ...("payments" in rencana ? { payments: rencana.payments } : { method: rencana.paymentMethod }),
        qrisProofPhotoUrl,
        reasonCode: "WRONG_PAYMENT_METHOD",
        reasonNote: alasan.trim(),
      });
      toast.success(`Metode bayar ${sale.saleNo} diganti ke ${labelMetodeBayar(metode)}.`);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengganti metode bayar. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end">
      <div className="w-full max-w-md mx-auto bg-white rounded-t-[28px] max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <p className="font-extrabold text-slate-900">Ganti Metode Bayar</p>
          <button type="button" onClick={onClose} aria-label="Tutup">
            <X size={20} className="text-slate-700" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="rounded-2xl p-5 text-center" style={{ backgroundColor: OBBEL_SCALE[50] }}>
            <p className="text-sm font-semibold text-slate-600">{sale.saleNo}</p>
            <p className="font-extrabold text-2xl mt-1" style={{ color: GREEN }}>
              {formatRupiah(sale.total)}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Sekarang: {labelMetodeBayar(sale.paymentMethod)}
              {sale.paymentMethod === "SPLIT" && ` (Tunai ${formatRupiah(tunaiSekarang)} + QRIS ${formatRupiah(sale.total - tunaiSekarang)})`}
            </p>
          </div>

          <PilihMetodeBayar value={metode} onChange={setMetode} />

          {metode === "SPLIT" && <SplitBayarInput total={sale.total} tunai={splitTunai} onTunai={setSplitTunai} />}

          {butuhBukti && <KodeQrisBooth imageUrl={qrisImageUrl} />}

          {butuhBukti && (
            <PhotoCapture
              variant="dokumen"
              title="Foto Bukti Bayar QRIS"
              hint="Foto layar pembayaran berhasil di HP pelanggan. Wajib sebelum Simpan."
              photoFile={foto}
              onPhoto={(file) => {
                setFoto(file);
                setFotoUrl(null);
              }}
            />
          )}

          <div>
            <p className="text-base font-bold text-slate-700 mb-2">Alasan</p>
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              rows={2}
              placeholder="Mis. pelanggan jadi bayar pakai QRIS"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-[#0B5D34]"
            />
          </div>

          {!berubah && (
            <p className="text-sm font-semibold text-slate-500">Pilih metode atau pecahan yang berbeda dari yang tercatat.</p>
          )}
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={simpan}
            disabled={submitting || !bisaSimpan}
            className="w-full rounded-2xl py-4 font-extrabold text-white disabled:opacity-50"
            style={{ backgroundColor: GREEN }}
          >
            {submitting ? <Spinner size="sm" color="white" /> : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
