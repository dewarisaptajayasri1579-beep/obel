"use client";

import React, { useState } from "react";
import { MapPin, CheckCircle2 } from "lucide-react";
import { PhotoCapture } from "./PhotoCapture";
import { pesanGpsError } from "@/lib/gps-error";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

export interface LocationValue {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/// Dua langkah Absen GPS+Selfie dipakai di keempat titik absen (Berangkat, Tiba,
/// Check-Out, Kembali) — komponen ini dishare persis, bukan salinan hampir sama.
/// Location & foto diangkat ke parent (bukan disimpan di sini) supaya parent bisa
/// menahan tombol submit sampai keduanya terisi.
export function AttendanceCapture({
  location,
  onLocation,
  photoFile,
  onPhoto,
  tempat = "booth",
}: {
  location: LocationValue | null;
  onLocation: (loc: LocationValue) => void;
  photoFile: File | null;
  onPhoto: (file: File) => void;
  /// Lokasi acuan absen ini, untuk petunjuk di kartu lokasi.
  tempat?: "booth" | "gudang";
}) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationError("Perangkat ini tidak mendukung GPS.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocating(false);
      },
      (err) => {
        setLocationError(pesanGpsError(err));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={16} style={{ color: GREEN }} />
          <span className="text-base font-bold text-slate-800">Konfirmasi Lokasi Anda</span>
        </div>
        <p className="text-sm text-slate-500 mb-3">
          {tempat === "gudang" ? "Pastikan Anda berada di Gudang." : "Pastikan Anda berada di area booth yang benar."}
        </p>

        {location ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-3">
              <div className="text-sm text-slate-700">
                <div className="font-semibold">
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </div>
                <div className="text-slate-500">Akurat • {Math.round(location.accuracy)}m</div>
              </div>
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <button
              type="button"
              onClick={requestLocation}
              disabled={locating}
              className="self-start text-sm font-semibold underline underline-offset-2 disabled:opacity-60"
              style={{ color: GREEN }}
            >
              {locating ? "Mengambil lokasi..." : "Perbarui lokasi"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={requestLocation}
            disabled={locating}
            className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-base font-semibold text-slate-600 disabled:opacity-60"
          >
            {locating ? "Mengambil lokasi..." : "Ambil Lokasi Saya"}
          </button>
        )}
        {locationError && <p className="text-sm text-rose-600 mt-2">{locationError}</p>}
      </div>

      <PhotoCapture
        variant="selfie"
        title="Ambil Foto Selfie"
        hint="Pastikan wajah Anda terlihat jelas."
        photoFile={photoFile}
        onPhoto={onPhoto}
      />
    </div>
  );
}
