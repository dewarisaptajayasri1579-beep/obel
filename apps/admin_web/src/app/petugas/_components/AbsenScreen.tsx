"use client";

import React, { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { useHidePetugasNav } from "@/components/layout/PetugasShell";
import { AttendanceCapture, type LocationValue } from "./AttendanceCapture";
import { PanelLokasiDitolak, penolakanDariError, type PenolakanLokasi } from "./LokasiDitolak";
import { OBBEL } from "../_lib/theme";

const GREEN = OBBEL.primaryDark;

/// Layar absen GPS+foto yang dipakai titik Berangkat (Gudang), Tiba (Booth) dan
/// Kembali (Gudang) — BR-042. Backend menolak absen di luar radius
/// (OUTSIDE_ATTENDANCE_RADIUS); pesannya ditampilkan di layar (bukan cuma toast)
/// beserta petunjuk minta izin Admin, karena Barista perlu membacanya.
export function AbsenScreen({
  title,
  subtitle,
  tempat,
  submitLabel,
  onSubmit,
  children,
}: {
  title: string;
  subtitle: string;
  tempat: "booth" | "gudang";
  submitLabel: string;
  /// Dipanggil dengan lokasi + URL foto yang sudah diunggah; lempar ApiError kalau gagal.
  onSubmit: (input: { latitude: number; longitude: number; photoUrl: string }) => Promise<void>;
  children?: React.ReactNode;
}) {
  const toast = useToast();
  // Tombol konfirmasi menempel di bawah layar; tanpa ini bottom nav mengambang menutupinya.
  useHidePetugasNav();
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ditolak, setDitolak] = useState<PenolakanLokasi | null>(null);

  async function kirim() {
    if (!location || !photoFile) return;
    setSubmitting(true);
    setDitolak(null);
    try {
      // URL foto disimpan: kalau absen ditolak lalu diulang (mis. setelah izin Admin),
      // foto yang sama tidak diunggah lagi.
      const url = photoUrl ?? (await api.uploadAttendancePhoto(photoFile)).photoUrl;
      setPhotoUrl(url);
      await onSubmit({ latitude: location.latitude, longitude: location.longitude, photoUrl: url });
    } catch (err) {
      if (err instanceof ApiError && err.code === "OUTSIDE_ATTENDANCE_RADIUS") {
        setDitolak(penolakanDariError(err));
      } else {
        toast.error(err instanceof ApiError ? err.message : "Gagal absen. Coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6] max-w-md mx-auto pb-28">
      <div style={{ backgroundColor: GREEN }} className="px-5 pt-6 pb-5">
        <h1 className="text-white font-extrabold text-xl">{title}</h1>
        <p className="text-white/80 text-base mt-1">{subtitle}</p>
      </div>

      <div className="px-4 -mt-2 flex flex-col gap-4">
        {ditolak && <PanelLokasiDitolak penolakan={ditolak} tempat={tempat} />}

        <AttendanceCapture
          tempat={tempat}
          location={location}
          onLocation={(loc) => {
            setLocation(loc);
            setDitolak(null);
          }}
          photoFile={photoFile}
          onPhoto={(file) => {
            setPhotoFile(file);
            setPhotoUrl(null);
          }}
        />

        {children}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={kirim}
          disabled={!location || !photoFile || submitting}
          className="w-full flex items-center justify-center rounded-xl py-3.5 font-extrabold text-white disabled:opacity-50"
          style={{ backgroundColor: GREEN }}
        >
          {submitting ? <Spinner size="sm" color="white" /> : submitLabel}
        </button>
      </div>
    </div>
  );
}
