"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Store } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type Booth, type MyBoothShiftAssignment } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { AbsenScreen } from "../_components/AbsenScreen";
import { formatRupiah } from "../_lib/format";
import { startGpsTracking } from "../_lib/native-bridge";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

/// Absen Berangkat di Gudang (titik 1 dari 4, BR-042) — membuka shift: Kasir &
/// Terima Stok langsung bisa dipakai, uang jalan booth dicatat di shift (BR-043).
function CheckInContent() {
  const { session, loading: authLoading, updateToken } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loadingInit, setLoadingInit] = useState(true);
  const [assignment, setAssignment] = useState<MyBoothShiftAssignment | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null);
  const [showBoothPicker, setShowBoothPicker] = useState(false);

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

        const [myAssignment, allBooths] = await Promise.all([api.getMyAssignment(), api.getBooths()]);
        setAssignment(myAssignment);
        setBooths(allBooths.filter((b) => b.status === "ACTIVE"));
        setSelectedBoothId(myAssignment?.boothId ?? null);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Absen Berangkat.");
      } finally {
        setLoadingInit(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [authLoading, session]);

  const selectedBooth = booths.find((b) => b.id === selectedBoothId) ?? assignment?.booth ?? null;

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

  return (
    <AbsenScreen
      title="Absen Berangkat"
      subtitle="Absen di Gudang sebelum berangkat ke booth."
      tempat="gudang"
      submitLabel="KONFIRMASI BERANGKAT"
      onSubmit={async (absen) => {
        if (!selectedBoothId) throw new ApiError("BOOTH_REQUIRED", "Pilih booth dulu.");
        const result = await api.checkIn({ boothId: selectedBoothId, ...absen });
        if (result.accessToken) updateToken(result.accessToken);
        startGpsTracking(result.shiftSessionId);
        toast.success("Absen Berangkat berhasil. Selamat bekerja!");
        router.replace("/petugas");
      }}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <Store size={16} style={{ color: GREEN }} />
          <span className="text-base font-bold text-slate-800">Pilih Booth</span>
        </div>
        <p className="text-sm text-slate-500 mb-3">Pilih booth tempat Anda bekerja hari ini.</p>

        <button
          type="button"
          onClick={() => setShowBoothPicker((v) => !v)}
          className="w-full flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold text-slate-800"
        >
          {selectedBooth?.name ?? "Pilih Booth"}
          <ChevronDown size={16} className="text-slate-400" />
        </button>

        {showBoothPicker && (
          <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {booths.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setSelectedBoothId(b.id);
                  setShowBoothPicker(false);
                }}
                className="w-full text-left px-4 py-3 text-base hover:bg-slate-50"
                style={b.id === selectedBoothId ? { color: GREEN, fontWeight: 700 } : undefined}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-base font-bold text-slate-800 mb-2">Konfirmasi Data Anda</p>
        <div className="text-base text-slate-600 flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className="text-slate-400">Nama</span>
            <span className="font-semibold text-slate-800">{session?.profile.fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Booth</span>
            <span className="font-semibold text-slate-800">{selectedBooth?.name ?? "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Shift</span>
            <span className="font-semibold text-slate-800">{assignment.shiftTemplate.name}</span>
          </div>
          {(selectedBooth?.cashFloat ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Uang jalan</span>
              <span className="font-semibold text-slate-800">{formatRupiah(selectedBooth!.cashFloat)}</span>
            </div>
          )}
        </div>
        {(selectedBooth?.cashFloat ?? 0) > 0 && (
          <p className="text-sm text-slate-500 mt-2">Terima uang jalan dari Admin; dikembalikan utuh saat absen Kembali.</p>
        )}
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
