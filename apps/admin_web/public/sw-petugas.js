// Service worker Web Petugas Booth (/petugas/*) — wajib ada supaya PWA ini
// "installable" (Chrome mensyaratkan service worker terdaftar buat prompt
// Install). Semua request network-first; data stok/transaksi harus selalu
// yang terbaru.
//
// Saat offline, navigasi halaman dijawab OFFLINE_HTML (mandiri, tanpa JS
// eksternal). JANGAN ganti dengan HTML /petugas dari cache: HTML itu butuh
// chunk /_next/static/* yang tidak ikut di-cache, hasilnya layar putih kosong
// — dan karena "berhasil dimuat", WebView shell juga tidak lapor error.
const CACHE_NAME = "obbel-petugas-shell-v2";
const APP_SHELL = ["/petugas/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

const OFFLINE_HTML = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Obbel Petugas — Offline</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #F7F9F6; color: #0F172A; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { text-align: center; padding: 32px; max-width: 320px; }
  h1 { font-size: 18px; margin: 16px 0 8px; }
  p { font-size: 14px; color: #64748B; margin: 0 0 24px; }
  button { background: #0B5D34; color: #fff; border: 0; border-radius: 999px; padding: 14px 32px;
    font-size: 15px; font-weight: 700; }
</style>
</head>
<body>
<main>
  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/><path d="M5 12.86a10 10 0 0 1 5.17-2.69"/>
    <path d="M19 12.86a10 10 0 0 0-2-1.42"/><path d="M2 8.82a15 15 0 0 1 4.18-2.65"/>
    <path d="M22 8.82a15 15 0 0 0-11.29-3.76"/><path d="m2 2 20 20"/>
  </svg>
  <h1>Tidak bisa terhubung ke server</h1>
  <p>Periksa koneksi internet HP, lalu coba lagi.</p>
  <button type="button" onclick="location.reload()">Coba Lagi</button>
</main>
</body>
</html>`;

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
      .catch(async () => {
        if (request.mode === "navigate") {
          return new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }
        return (await caches.match(request)) ?? Response.error();
      }),
  );
});
