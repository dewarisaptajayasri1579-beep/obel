"use client";

import React, { useEffect, useState } from "react";
import { api, ApiError, type AttendancePermit } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { OBBEL } from "../_lib/theme";

type Pengajuan = Omit<AttendancePermit, "staff" | "grantedBy">;

const CEK_ULANG_MS = 15_000;

/// Di layar "Belum Waktunya Check-Out": Barista mengajukan pulang cepat dengan alasan, lalu
/// menunggu Admin (B4). Status diperiksa ulang selama menunggu; begitu disetujui, alur
/// Check-Out dimuat ulang lewat `onDisetujui`.
export function PengajuanPulangCepat({ onDisetujui }: { onDisetujui: () => void }) {
  const toast = useToast();
  const [pengajuan, setPengajuan] = useState<Pengajuan | null | undefined>(undefined);
  const [alasan, setAlasan] = useState("");
  const [mengirim, setMengirim] = useState(false);

  useEffect(() => {
    let aktif = true;
    const muat = () =>
      api
        .getMyEarlyCheckoutRequest()
        .then((p) => {
          if (!aktif) return;
          setPengajuan(p);
          if (p?.status === "GRANTED") onDisetujui();
        })
        .catch(() => {});
    muat();
    const id = setInterval(muat, CEK_ULANG_MS);
    return () => {
      aktif = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ajukan() {
    if (alasan.trim().length < 3) return;
    setMengirim(true);
    try {
      setPengajuan(await api.requestEarlyCheckout(alasan.trim()));
      setAlasan("");
      toast.success("Pengajuan pulang cepat terkirim ke Admin.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal mengajukan pulang cepat.");
    } finally {
      setMengirim(false);
    }
  }

  if (pengajuan === undefined) return <Spinner size="sm" />;

  if (pengajuan?.status === "REQUESTED") {
    return (
      <div className="w-full max-w-72 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left">
        <div className="flex items-center gap-2">
          <Spinner size="sm" />
          <p className="font-bold text-amber-800">Menunggu persetujuan Admin</p>
        </div>
        <p className="text-sm text-amber-700 mt-1.5">Alasan: {pengajuan.reason}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-72 flex flex-col gap-2 text-left">
      {pengajuan?.status === "REJECTED" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5">
          <p className="font-bold text-rose-700">Pengajuan ditolak</p>
          {pengajuan.rejectReason && <p className="text-sm text-rose-600 mt-1">{pengajuan.rejectReason}</p>}
        </div>
      )}
      <p className="text-base font-bold text-slate-700">Alasan pulang cepat</p>
      <textarea
        value={alasan}
        onChange={(e) => setAlasan(e.target.value)}
        rows={2}
        placeholder="Mis. ada keperluan keluarga mendadak"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-[#0B5D34]"
      />
      <button
        type="button"
        onClick={ajukan}
        disabled={alasan.trim().length < 3 || mengirim}
        className="w-full flex items-center justify-center rounded-full border-2 bg-white py-3 font-extrabold disabled:opacity-50"
        style={{ borderColor: OBBEL.accentOrange, color: OBBEL.accentOrange }}
      >
        {mengirim ? <Spinner size="sm" /> : "Ajukan Pulang Cepat"}
      </button>
    </div>
  );
}
