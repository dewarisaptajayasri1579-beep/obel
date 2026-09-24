"use client";

import React, { useEffect, useRef, useState } from "react";
import { MapPin, Camera, CheckCircle2, RotateCcw, Aperture, X } from "lucide-react";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

export interface LocationValue {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/// Dua langkah Absen GPS+Selfie dipakai dua kali (Check-In & Check-Out) —
/// komponen ini dishare persis, bukan dua salinan hampir sama. Location &
/// foto diangkat ke parent (bukan disimpan di sini) supaya parent bisa
/// menahan tombol submit sampai keduanya terisi.
export function AttendanceCapture({
  location,
  onLocation,
  photoFile,
  onPhoto,
}: {
  location: LocationValue | null;
  onLocation: (loc: LocationValue) => void;
  photoFile: File | null;
  onPhoto: (file: File, previewUrl: string) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setLocationError(err.message || "Gagal mengambil lokasi. Pastikan izin GPS diaktifkan.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  useEffect(() => stopCamera, []);

  async function openCamera() {
    setCameraError(null);
    // Live preview kamera (bukan buka file picker/app kamera terpisah) —
    // konsisten di desktop (webcam) maupun Android (kamera depan), sesuai
    // permintaan supaya alurnya sama dengan mockup ("Ambil Foto" -> kamera
    // langsung nyala, bukan lewat dialog pilih file).
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser ini tidak mendukung akses kamera langsung.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // videoRef baru ter-mount setelah cameraOpen true — pasang stream di
      // microtask berikutnya.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCameraError("Tidak bisa mengakses kamera. Izinkan akses kamera di browser, atau pilih foto dari galeri.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
        const previewUrl = URL.createObjectURL(blob);
        setPhotoPreview(previewUrl);
        onPhoto(file, previewUrl);
        stopCamera();
      },
      "image/jpeg",
      0.9,
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    onPhoto(file, previewUrl);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={16} style={{ color: GREEN }} />
          <span className="text-base font-bold text-slate-800">Konfirmasi Lokasi Anda</span>
        </div>
        <p className="text-sm text-slate-500 mb-3">Pastikan Anda berada di area booth yang benar.</p>

        {location ? (
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5.5">
            <div className="text-sm text-slate-700">
              <div className="font-semibold">
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </div>
              <div className="text-slate-500">Akurat • {Math.round(location.accuracy)}m</div>
            </div>
            <CheckCircle2 size={20} className="text-emerald-600" />
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <Camera size={16} style={{ color: GREEN }} />
          <span className="text-base font-bold text-slate-800">Ambil Foto Selfie</span>
        </div>
        <p className="text-sm text-slate-500 mb-3">Pastikan wajah Anda terlihat jelas.</p>

        {cameraOpen ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
              <button
                type="button"
                onClick={stopCamera}
                className="absolute top-2 right-2 w-11 h-11 rounded-full bg-black/50 flex items-center justify-center"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
            <button
              type="button"
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-white shadow-lg"
              style={{ backgroundColor: GREEN }}
            >
              <Aperture size={26} className="text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Selfie" className="w-full h-full object-cover" />
              ) : (
                <Camera size={22} className="text-slate-400" />
              )}
            </div>
            <button
              type="button"
              onClick={openCamera}
              className="flex-1 rounded-xl py-3 text-base font-bold text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: GREEN }}
            >
              {photoFile ? <RotateCcw size={16} /> : <Camera size={16} />}
              {photoFile ? "Ambil Ulang" : "Ambil Foto"}
            </button>
          </div>
        )}

        {cameraError && (
          <div className="mt-2">
            <p className="text-sm text-rose-600 mb-2">{cameraError}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm font-semibold underline"
              style={{ color: GREEN }}
            >
              Pilih foto dari galeri
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileChange}
          className="hidden"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
