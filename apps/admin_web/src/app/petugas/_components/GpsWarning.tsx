"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPinOff } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { isGpsTracking, openGpsSettings, startGpsTracking } from "../_lib/native-bridge";
import { OBBEL } from "../_lib/theme";

/// Banner Beranda selama shift aktif kalau service lokasi APK tidak jalan: izin lokasi ditolak
/// saat Absen Berangkat, HP dinyalakan ulang, atau app ditutup paksa. Tanpa ini peta Booth Aktif
/// Admin kosong tanpa ada yang tahu. Di browser biasa tidak tampil (tidak ada service lokasi).
export function GpsWarning({ shiftId }: { shiftId: string }) {
  const [off, setOff] = useState(false);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => setOff((await isGpsTracking()) === false), []);

  useEffect(() => {
    check();
    // Kembali dari Pengaturan Android: cek ulang.
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [check]);

  async function activate() {
    setBusy(true);
    try {
      // Izin yang sudah ditolak permanen tidak memunculkan dialog lagi: arahkan ke Pengaturan.
      if (!(await startGpsTracking(shiftId))) await openGpsSettings();
      await check();
    } finally {
      setBusy(false);
    }
  }

  if (!off) return null;

  return (
    <div className="mt-4 rounded-2xl bg-orange-50 border border-orange-200 p-4 flex gap-3">
      <MapPinOff size={20} className="shrink-0 mt-0.5" style={{ color: OBBEL.accentOrange }} />
      <div className="flex-1 flex flex-col gap-3">
        <div className="text-sm text-orange-900">
          <p className="font-bold text-base">Lokasi tidak terkirim ke Admin</p>
          <p>Izinkan akses lokasi Sepanjang waktu agar posisi booth tampil di peta Admin.</p>
        </div>
        <button
          type="button"
          onClick={activate}
          disabled={busy}
          className="w-full flex items-center justify-center rounded-full border-2 bg-white py-3 font-extrabold disabled:opacity-50"
          style={{ borderColor: OBBEL.accentOrange, color: OBBEL.accentOrange }}
        >
          {busy ? <Spinner size="sm" /> : "Aktifkan Lokasi"}
        </button>
      </div>
    </div>
  );
}
