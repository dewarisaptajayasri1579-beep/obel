"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Store } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type Booth, type MyBoothShiftAssignment } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { AttendanceCapture, type LocationValue } from "../_components/AttendanceCapture";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

export default function CheckInPage() {
  const { session, loading: authLoading, updateToken } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loadingInit, setLoadingInit] = useState(true);
  const [assignment, setAssignment] = useState<MyBoothShiftAssignment | null>(null);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null);
  const [showBoothPicker, setShowBoothPicker] = useState(false);

  const [location, setLocation] = useState<LocationValue | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || !session) return;
    if (session.profile.role !== "BOOTH_STAFF") {
      router.replace("/dashboard");
      return;
    }

    (async () => {
      try {
        // Kalau sudah ada shift aktif, tidak perlu check-in lagi.
        try {
          await api.getActiveShift();
          router.replace("/petugas");
          return;
        } catch {
          // 404 (belum ada shift aktif) = kondisi normal, lanjut ke form.
        }

        const [myAssignment, allBooths] = await Promise.all([api.getMyAssignment(), api.getBooths()]);
        setAssignment(myAssignment);
        setBooths(allBooths.filter((b) => b.status === "ACTIVE"));
        setSelectedBoothId(myAssignment?.boothId ?? null);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Check-In.");
      } finally {
        setLoadingInit(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [authLoading, session]);

  const selectedBooth = booths.find((b) => b.id === selectedBoothId) ?? assignment?.booth ?? null;
  const canSubmit = !!location && !!photoFile && !!selectedBoothId;

  async function handleCheckIn() {
    if (!location || !photoFile || !selectedBoothId) return;
    setSubmitting(true);
    try {
      const { photoUrl } = await api.uploadAttendancePhoto(photoFile);
      const result = await api.checkIn({
        boothId: selectedBoothId,
        latitude: location.latitude,
        longitude: location.longitude,
        photoUrl,
      });
      if (result.accessToken) updateToken(result.accessToken);
      if (result.locationWarning) toast.warning(result.locationWarning);
      toast.success("Check-In berhasil. Selamat bekerja!");
      router.replace("/petugas");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal Check-In. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

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
        <p className="text-sm text-slate-500">Hubungi Admin untuk mengatur penugasan Booth/Shift Anda.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6] max-w-md mx-auto pb-28">
      <div style={{ backgroundColor: GREEN }} className="px-5 pt-6 pb-5">
        <h1 className="text-white font-extrabold text-xl">Proses Check-In</h1>
        <p className="text-white/80 text-sm mt-1">Lengkapi absen sebelum mulai bekerja.</p>
      </div>

      <div className="px-4 -mt-2 flex flex-col gap-4">
        <AttendanceCapture
          location={location}
          onLocation={setLocation}
          photoFile={photoFile}
          onPhoto={(file) => setPhotoFile(file)}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <Store size={16} style={{ color: GREEN }} />
            <span className="text-sm font-bold text-slate-800">Pilih Booth</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">Pilih booth tempat Anda bekerja hari ini.</p>

          <button
            type="button"
            onClick={() => setShowBoothPicker((v) => !v)}
            className="w-full flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800"
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
                  className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50"
                  style={b.id === selectedBoothId ? { color: GREEN, fontWeight: 700 } : undefined}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold text-slate-800 mb-2">Konfirmasi Data Anda</p>
          <div className="text-sm text-slate-600 flex flex-col gap-1.5">
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
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={handleCheckIn}
          disabled={!canSubmit || submitting}
          className="w-full flex items-center justify-center rounded-xl py-3.5 font-extrabold text-white disabled:opacity-50"
          style={{ backgroundColor: GREEN }}
        >
          {submitting ? <Spinner size="sm" color="white" /> : "KONFIRMASI CHECK IN"}
        </button>
      </div>
    </div>
  );
}
