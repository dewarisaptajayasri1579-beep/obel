"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type MyBoothShiftAssignment } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { AbsenScreen } from "../_components/AbsenScreen";
import { formatRupiah } from "../_lib/format";
import { startGpsTracking } from "../_lib/native-bridge";

/// Absen Berangkat di Gudang (titik 1 dari 4, BR-042) — membuka shift di booth jadwal (roster):
/// Terima Stok langsung bisa dipakai, uang jalan booth dicatat di shift (BR-043). Booth tempat
/// bertugas dipilih saat Absen Tiba; Kasir baru bisa dipakai setelah itu.
function CheckInContent() {
  const { session, loading: authLoading, updateToken } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loadingInit, setLoadingInit] = useState(true);
  const [assignment, setAssignment] = useState<MyBoothShiftAssignment | null>(null);

  useEffect(() => {
    if (authLoading || !session) return;
    if (session.profile.role !== "BOOTH_STAFF") {
      router.replace("/dashboard");
      return;
    }

    (async () => {
      try {
        // Kalau sudah ada shift aktif, tidak perlu Berangkat lagi.
        try {
          await api.getActiveShift();
          router.replace("/petugas");
          return;
        } catch {
          // 404 (belum ada shift aktif) = kondisi normal, lanjut ke form.
        }
        // Shift sebelumnya belum absen Kembali → itu dulu (Berangkat akan ditolak).
        if (await api.getPendingReturn()) {
          router.replace("/petugas/kembali");
          return;
        }
        setAssignment(await api.getMyAssignment());
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Absen Berangkat.");
      } finally {
        setLoadingInit(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  if (authLoading || loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9F6] max-w-md mx-auto">
        <Spinner />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F9F6] max-w-md mx-auto px-6 text-center gap-3">
        <p className="font-bold text-slate-800">Anda belum ditugaskan ke Booth manapun.</p>
        <p className="text-base text-slate-500">Hubungi Admin untuk mengatur penugasan Booth/Shift Anda.</p>
      </div>
    );
  }

  const uangJalan = assignment.booth.cashFloat ?? 0;

  return (
    <AbsenScreen
      title="Absen Berangkat"
      subtitle="Absen di Gudang sebelum berangkat ke booth."
      tempat="gudang"
      submitLabel="KONFIRMASI BERANGKAT"
      onSubmit={async (absen) => {
        const result = await api.checkIn(absen);
        if (result.accessToken) updateToken(result.accessToken);
        startGpsTracking(result.shiftSessionId);
        toast.success("Absen Berangkat berhasil. Selamat bekerja!");
        router.replace("/petugas");
      }}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-base font-bold text-slate-800 mb-2">Konfirmasi Data Anda</p>
        <div className="text-base text-slate-600 flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Nama</span>
            <span className="font-semibold text-slate-800">{session?.profile.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Booth jadwal</span>
            <span className="font-semibold text-slate-800">{assignment.booth.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Shift</span>
            <span className="font-semibold text-slate-800">{assignment.shiftTemplate.name}</span>
          </div>
          {uangJalan > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Uang jalan</span>
              <span className="font-semibold text-slate-800">{formatRupiah(uangJalan)}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-500 mt-2">
          Booth tempat bertugas dipilih saat Absen Tiba.
          {uangJalan > 0 && " Terima uang jalan dari Admin; dikembalikan utuh saat absen Kembali."}
        </p>
      </div>
    </AbsenScreen>
  );
}

/// Dibungkus RequirePetugasAuth seperti halaman petugas lain: AbsenScreen menyembunyikan bottom nav lewat
/// konteks PetugasShell, dan tanpa shell-nya layar ini langsung error.
export default function CheckInPage() {
  return (
    <RequirePetugasAuth>
      <CheckInContent />
    </RequirePetugasAuth>
  );
}
