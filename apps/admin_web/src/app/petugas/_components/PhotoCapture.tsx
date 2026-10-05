"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, RotateCcw, Aperture, X } from "lucide-react";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

/// Sisi terpanjang foto setelah dikompres. Cukup untuk membaca wajah maupun
/// layar bukti bayar, dan membuat file ~100–200KB alih-alih beberapa MB.
const SISI_MAKS = 1280;
const KUALITAS_JPEG = 0.8;

/// `selfie`: kamera depan, preview dicerminkan, thumbnail bulat (absen).
/// `dokumen`: kamera belakang, tidak dicerminkan, thumbnail lebar (bukti bayar).
export type PhotoCaptureVariant = "selfie" | "dokumen";

function kecilkan(source: CanvasImageSource, width: number, height: number, namaFile: string): Promise<File> {
  const skala = Math.min(1, SISI_MAKS / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * skala);
  canvas.height = Math.round(height * skala);
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], namaFile, { type: "image/jpeg" })) : reject(new Error("Gagal memproses foto."))),
      "image/jpeg",
      KUALITAS_JPEG,
    ),
  );
}

async function kecilkanFile(file: File, namaFile: string): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    try {
      return await kecilkan(bitmap, bitmap.width, bitmap.height, namaFile);
    } finally {
      bitmap.close();
    }
  } catch {
    return file; // format tak terbaca browser → kirim apa adanya, backend yang memvalidasi
  }
}

/// Ambil satu foto lewat live preview kamera (fallback pilih dari galeri kalau
/// kamera tidak bisa diakses). File diangkat ke parent; preview diturunkan
/// dari `photoFile`, jadi parent cukup set null untuk mengosongkan.
export function PhotoCapture({
  variant,
  title,
  hint,
  photoFile,
  onPhoto,
}: {
  variant: PhotoCaptureVariant;
  title: string;
  hint: string;
  photoFile: File | null;
  onPhoto: (file: File) => void;
}) {
  const selfie = variant === "selfie";
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photoFile) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  useEffect(() => stopCamera, []);

  // Halaman di belakang kamera layar penuh jangan ikut ter-scroll.
  useEffect(() => {
    if (!cameraOpen) return;
    const sebelumnya = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = sebelumnya;
    };
  }, [cameraOpen]);

  async function openCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser ini tidak mendukung akses kamera langsung.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Tanpa ideal resolusi, WebView Android memberi stream 640x480 —
        // terlalu kecil untuk membaca nominal di layar bukti bayar.
        video: { facingMode: selfie ? "user" : "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // videoRef baru ter-mount setelah cameraOpen true.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setCameraError(
        name === "NotAllowedError"
          ? "Izin kamera ditolak. Aktifkan di Pengaturan HP > Aplikasi > Barista Obbel > Izin > Kamera, atau pilih foto dari galeri."
          : name === "NotReadableError"
            ? "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi, atau pilih foto dari galeri."
            : `Tidak bisa mengakses kamera${name ? ` (${name})` : ""}. Coba lagi, atau pilih foto dari galeri.`,
      );
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      onPhoto(await kecilkan(video, video.videoWidth, video.videoHeight, `${variant}-${Date.now()}.jpg`));
      stopCamera();
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : "Gagal memproses foto.");
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onPhoto(await kecilkanFile(file, `${variant}-${Date.now()}.jpg`));
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <Camera size={16} style={{ color: GREEN }} />
        <span className="text-base font-bold text-slate-800">{title}</span>
      </div>
      <p className="text-sm text-slate-500 mb-3">{hint}</p>

      {/* Kamera dibuka layar penuh (di atas sheet/halaman apa pun), jadi
          preview & tombol jepret selalu kelihatan tanpa scroll. */}
      {cameraOpen &&
        createPortal(
          <div className="fixed inset-0 z-100 bg-black flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <span className="text-white font-bold text-base">{title}</span>
              <button
                type="button"
                onClick={stopCamera}
                aria-label="Tutup kamera"
                className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`flex-1 min-h-0 w-full object-cover ${selfie ? "-scale-x-100" : ""}`}
            />
            <div className="flex justify-center py-6">
              <button
                type="button"
                onClick={capturePhoto}
                aria-label="Ambil foto"
                className="w-18 h-18 rounded-full flex items-center justify-center border-4 border-white shadow-lg"
                style={{ backgroundColor: GREEN }}
              >
                <Aperture size={30} className="text-white" />
              </button>
            </div>
          </div>,
          document.body,
        )}

      <div className="flex items-center gap-4">
        <div
          className={`bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200 shrink-0 ${
            selfie ? "w-16 h-16 rounded-full" : "w-16 h-20 rounded-xl"
          }`}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={title} className="w-full h-full object-cover" />
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
        capture={selfie ? "user" : "environment"}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
