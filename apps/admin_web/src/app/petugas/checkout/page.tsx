"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ActiveShift, type ShiftReport, type ClosingItem } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { useHidePetugasNav } from "@/components/layout/PetugasShell";
import { TopBar } from "../_components/TopBar";
import { AttendanceCapture, type LocationValue } from "../_components/AttendanceCapture";
import { formatRupiah } from "../_lib/format";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

type Step = "LAPORAN" | "HITUNG" | "ABSEN";

function CheckoutContent() {
  const router = useRouter();
  const toast = useToast();
  useHidePetugasNav();

  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<ActiveShift | null>(null);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [step, setStep] = useState<Step>("LAPORAN");
  const [closingItems, setClosingItems] = useState<ClosingItem[]>([]);
  const [actualQty, setActualQty] = useState<Record<string, number>>({});
  const [reasonNote, setReasonNote] = useState<Record<string, string>>({});
  const [catatan, setCatatan] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const active = await api.getActiveShift();
        setShift(active);
        const rpt = await api.getShiftReport(active.shiftSessionId);
        setReport(rpt);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat laporan shift.");
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  async function handleLanjutHitung() {
    if (!shift) return;
    setSubmitting(true);
    try {
      const closing = await api.startClosing(shift.shiftSessionId);
      setClosingItems(closing.items);
      setActualQty(Object.fromEntries(closing.items.map((i) => [i.productId, i.actualQty])));
      setStep("HITUNG");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memulai proses closing.");
    } finally {
      setSubmitting(false);
    }
  }

  function hasMismatch() {
    return closingItems.some((i) => (actualQty[i.productId] ?? i.expectedQty) !== i.expectedQty && !reasonNote[i.productId]?.trim());
  }

  async function handleConfirmCheckout() {
    if (!shift || !location || !photoFile) return;
    setSubmitting(true);
    try {
      const { photoUrl } = await api.uploadAttendancePhoto(photoFile);
      const result = await api.confirmClosing(shift.shiftSessionId, {
        items: closingItems.map((i) => ({
          productId: i.productId,
          actualQty: actualQty[i.productId] ?? i.expectedQty,
          ...(actualQty[i.productId] !== i.expectedQty
            ? { reasonCode: "WRONG_PHYSICAL_COUNT", reasonNote: reasonNote[i.productId] || catatan || undefined }
            : {}),
        })),
        checkOutLatitude: location.latitude,
        checkOutLongitude: location.longitude,
        checkOutPhotoUrl: photoUrl,
      });
      if (result.locationWarning) toast.warning(result.locationWarning);
      toast.success("Check-Out berhasil. Sampai jumpa di shift berikutnya!");
      router.replace("/petugas/check-in");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal Check-Out. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !shift || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (step === "LAPORAN") {
    return (
      <div className="min-h-screen bg-[#F7F9F6] pb-28">
        <TopBar title="Laporan Kembali" back="/petugas" />
        <div className="p-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
            <p className="font-extrabold text-slate-900">{report.boothName}</p>
            <p className="text-xs text-slate-500">
              Shift {report.shiftTemplateName} • {new Date(report.businessDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>

          <p className="text-sm font-bold text-slate-800 mb-2">Rekap Stok Produk</p>
          <div className="rounded-2xl bg-white border border-slate-200 overflow-x-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="p-3 font-semibold">Produk</th>
                  <th className="p-3 font-semibold text-right">Awal</th>
                  <th className="p-3 font-semibold text-right">Restock</th>
                  <th className="p-3 font-semibold text-right">Terjual</th>
                  <th className="p-3 font-semibold text-right">Sisa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.items.map((it) => (
                  <tr key={it.productId}>
                    <td className="p-3 font-semibold text-slate-800">{it.productName}</td>
                    <td className="p-3 text-right">{it.stokAwal}</td>
                    <td className="p-3 text-right">{it.restock}</td>
                    <td className="p-3 text-right">{it.terjual}</td>
                    <td className="p-3 text-right font-bold">{it.sisaSistem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm font-bold text-slate-800 mb-2">Rekap Keuangan</p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-[10px] text-slate-500">Total Penjualan</p>
              <p className="font-extrabold text-sm mt-1">{formatRupiah(report.totalPenjualan)}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-[10px] text-slate-500">Kas Tunai</p>
              <p className="font-extrabold text-sm mt-1">{formatRupiah(report.kasTunai)}</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-3">
              <p className="text-[10px] text-slate-500">Kas QRIS</p>
              <p className="font-extrabold text-sm mt-1">{formatRupiah(report.kasQris)}</p>
            </div>
          </div>

          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Tulis catatan laporan (opsional)..."
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={handleLanjutHitung}
            disabled={submitting}
            className="w-full max-w-md mx-auto flex items-center justify-center rounded-xl py-3.5 font-extrabold text-white disabled:opacity-60"
            style={{ backgroundColor: GREEN }}
          >
            {submitting ? <Spinner size="sm" color="white" /> : "Lanjut Check Out"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "HITUNG") {
    return (
      <div className="min-h-screen bg-[#F7F9F6] pb-28">
        <TopBar title="Hitung Stok Fisik" back="/petugas/checkout" />
        <div className="p-4">
          <p className="text-xs text-slate-500 mb-3">
            Masukkan jumlah fisik cup yang tersisa di booth. Isi alasan kalau ada selisih dari sistem.
          </p>
          <div className="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
            {closingItems.map((it) => {
              const qty = actualQty[it.productId] ?? it.expectedQty;
              const mismatch = qty !== it.expectedQty;
              return (
                <div key={it.productId} className="p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{it.productName}</p>
                      <p className="text-xs text-slate-500">Stok sistem: {it.expectedQty}</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) =>
                        setActualQty((prev) => ({ ...prev, [it.productId]: Math.max(0, Number(e.target.value)) }))
                      }
                      className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm text-center"
                    />
                  </div>
                  {mismatch && (
                    <input
                      type="text"
                      value={reasonNote[it.productId] ?? ""}
                      onChange={(e) => setReasonNote((prev) => ({ ...prev, [it.productId]: e.target.value }))}
                      placeholder="Alasan selisih (wajib diisi)..."
                      className="w-full mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={() => setStep("ABSEN")}
            disabled={hasMismatch()}
            className="w-full max-w-md mx-auto flex items-center justify-center rounded-xl py-3.5 font-extrabold text-white disabled:opacity-50"
            style={{ backgroundColor: GREEN }}
          >
            Lanjut Absen Pulang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6] pb-28">
      <TopBar title="Konfirmasi Check Out" back="/petugas/checkout" />
      <div className="p-4">
        <AttendanceCapture location={location} onLocation={setLocation} photoFile={photoFile} onPhoto={(f) => setPhotoFile(f)} />
      </div>
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={handleConfirmCheckout}
          disabled={!location || !photoFile || submitting}
          className="w-full max-w-md mx-auto flex items-center justify-center rounded-xl py-3.5 font-extrabold text-white disabled:opacity-50"
          style={{ backgroundColor: "#E57C23" }}
        >
          {submitting ? <Spinner size="sm" color="white" /> : "KONFIRMASI CHECK OUT"}
        </button>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequirePetugasAuth>
      <CheckoutContent />
    </RequirePetugasAuth>
  );
}
