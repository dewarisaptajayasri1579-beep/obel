"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { DoorOpen, RotateCcw } from "lucide-react";
import { api, ApiError, type ActiveShift } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/Spinner";
import { TopBar } from "./TopBar";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

const ActiveShiftContext = createContext<ActiveShift | null>(null);

/// Shift aktif Petugas — hanya boleh dipanggil di dalam <RequireActiveShift>.
export function useActiveShift(): ActiveShift {
  const shift = useContext(ActiveShiftContext);
  if (!shift) throw new Error("useActiveShift() dipanggil di luar <RequireActiveShift>.");
  return shift;
}

type Status = { jenis: "memuat" } | { jenis: "belumCheckIn" } | { jenis: "gagal"; pesan: string } | { jenis: "siap"; shift: ActiveShift };

/// Gerbang untuk layar yang butuh shift aktif (Kasir, Stok, Terima Stok).
/// Shift dicek SEKALI di sini; kalau Petugas belum Check-In, layar isinya
/// tidak dirender sama sekali, jadi tidak ada request lain yang gagal
/// bersamaan dan memunculkan toast error berulang — cukup satu layar yang
/// mengarahkan ke Check-In.
export function RequireActiveShift({ title, children }: { title: string; children: React.ReactNode }) {
  const { updateToken } = useAuth();
  const [status, setStatus] = useState<Status>({ jenis: "memuat" });
  const [percobaan, setPercobaan] = useState(0);

  useEffect(() => {
    let batal = false;
    api
      .getActiveShift()
      .then((shift) => {
        // Token lama bisa belum membawa boothId (login sebelum Check-In) —
        // backend mengirim token baru; simpan sebelum layar isi memanggil
        // endpoint yang dibatasi per Booth.
        if (shift.accessToken) updateToken(shift.accessToken);
        if (!batal) setStatus({ jenis: "siap", shift });
      })
      .catch((err) => {
        if (batal) return;
        if (err instanceof ApiError && err.code === "NOT_FOUND") setStatus({ jenis: "belumCheckIn" });
        else setStatus({ jenis: "gagal", pesan: err instanceof ApiError ? err.message : "Gagal memuat status shift." });
      });
    return () => {
      batal = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percobaan]);

  if (status.jenis === "siap") {
    return <ActiveShiftContext.Provider value={status.shift}>{children}</ActiveShiftContext.Provider>;
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6]">
      <TopBar title={title} back="/petugas" />
      {status.jenis === "memuat" ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <div className="px-6 py-16 flex flex-col items-center text-center gap-3">
          <DoorOpen size={40} style={{ color: GREEN }} />
          <p className="font-extrabold text-lg text-slate-900">
            {status.jenis === "belumCheckIn" ? "Belum Ada Shift Aktif" : "Status Shift Tidak Bisa Dimuat"}
          </p>
          <p className="text-base text-slate-500 max-w-72">
            {status.jenis === "belumCheckIn" ? `Lakukan Absen Berangkat dulu untuk membuka ${title}.` : status.pesan}
          </p>
          {status.jenis === "belumCheckIn" ? (
            <Link
              href="/petugas/check-in"
              className="mt-2 w-full max-w-72 flex items-center justify-center gap-2 rounded-full py-3.5 font-extrabold text-white"
              style={{ backgroundColor: GREEN }}
            >
              <DoorOpen size={18} />
              Absen Berangkat
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setStatus({ jenis: "memuat" });
                setPercobaan((n) => n + 1);
              }}
              className="mt-2 w-full max-w-72 flex items-center justify-center gap-2 rounded-full py-3.5 font-extrabold text-white"
              style={{ backgroundColor: GREEN }}
            >
              <RotateCcw size={18} />
              Coba Lagi
            </button>
          )}
        </div>
      )}
    </div>
  );
}
