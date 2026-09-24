"use client";

import { useEffect } from "react";

/// Daftarkan service worker /petugas sekali saat layout ini mount — tanpa
/// service worker terdaftar, Chrome tidak menganggap halaman ini
/// "installable" (tidak ada tombol Install di address bar / prompt Tambah
/// ke Layar Utama), meski manifest.webmanifest sudah lengkap. Scope
/// dibatasi ke /petugas/ supaya tidak ikut menguasai request console Admin.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw-petugas.js", { scope: "/petugas/" }).catch(() => {
      // Diam-diam gagal (mis. http non-secure di jaringan lokal) — PWA
      // tetap bisa dipakai biasa lewat browser, cuma tidak installable.
    });
  }, []);

  return null;
}
