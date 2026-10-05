"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type PendingReturnShift } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { AbsenScreen } from "../_components/AbsenScreen";
import { formatRupiah } from "../_lib/format";

/// Absen Kembali di Gudang (titik 4 dari 4, BR-042) — setelah Check-Out di booth.
/// Baru setelah ini Admin bisa menerima Stok Kembali & Setor Uang, dan Barista
/// bisa Berangkat untuk shift berikutnya.
function KembaliContent() {
  const router = useRouter();
  const toast = useToast();
  const [shift, setShift] = useState<PendingReturnShift | null | undefined>(undefined);

  useEffect(() => {
    api
      .getPendingReturn()
      .then((s) => {
        if (!s) router.replace("/petugas");
        setShift(s);
      })
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat shift yang menunggu Kembali."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!shift) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9F6] max-w-md mx-auto">
        <Spinner />
      </div>
    );
  }

  return (
    <AbsenScreen
      title="Absen Kembali di Gudang"
      subtitle="Absen saat sampai di Gudang, lalu serahkan stok & uang ke Admin."
      tempat="gudang"
      submitLabel="KONFIRMASI KEMBALI"
      onSubmit={async (absen) => {
        await api.returnToWarehouse(shift.shiftSessionId, absen);
        toast.success("Absen Kembali berhasil. Terima kasih, sampai jumpa di shift berikutnya!");
        router.replace("/petugas");
      }}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-base font-bold text-slate-800 mb-2">Serahkan ke Admin</p>
        <div className="text-base text-slate-600 flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Booth</span>
            <span className="font-semibold text-slate-800">
              {shift.booth.name} · {shift.shiftName}
            </span>
          </div>
          {shift.expectedCash != null && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-400">Kas Tunai</span>
                <span className="font-semibold text-slate-800">{formatRupiah(shift.expectedCash - shift.cashFloat)}</span>
              </div>
              {shift.cashFloat > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Uang jalan</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(shift.cashFloat)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-1.5">
                <span className="font-bold text-slate-700">Total uang disetor</span>
                <span className="font-extrabold text-slate-900">{formatRupiah(shift.expectedCash)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </AbsenScreen>
  );
}

export default function KembaliPage() {
  return (
    <RequirePetugasAuth>
      <KembaliContent />
    </RequirePetugasAuth>
  );
}
