// Service worker Web Petugas Booth (/petugas/*) — cache-first buat app shell
// (manifest, ikon, halaman /petugas itu sendiri) supaya PWA ini "installable"
// (Chrome mensyaratkan service worker terdaftar buat menampilkan prompt
// Install/tombol di address bar) dan tetap bisa dibuka meski jaringan sempat
// putus di lapangan. SENGAJA network-first untuk selain app shell (API call,
// halaman lain) — data stok/transaksi harus selalu yang terbaru, cache di
// sini cuma jaring pengaman kalau offline, bukan sumber utama.
const CACHE_NAME = "obbel-petugas-shell-v1";
const APP_SHELL = ["/petugas", "/petugas/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && APP_SHELL.some((path) => request.url.endsWith(path))) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/petugas"))),
  );
});
