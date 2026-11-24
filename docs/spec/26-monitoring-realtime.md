# 26 — Monitoring Real-Time (Admin)

Spesifikasi halaman baru **Monitoring** untuk Admin Pusat: satu layar dua kolom yang
menjawab dua pertanyaan yang sekarang butuh beberapa klik terpisah — "Booth mana yang
stoknya mau habis?" dan "Booth mana yang sedang ramai, di mana posisinya, siapa
petugasnya?" — dan menjawabnya **tanpa perlu refresh manual**.

Status: draf hasil diskusi, siap diimplementasikan. Keputusan produk di bawah sudah
dikonfirmasi; yang tersisa adalah keputusan teknis kecil yang wajar diputuskan saat
membangun (lihat §9).

---

## 1. Kenapa fitur ini

`00-README.md` §1 sudah menyebut sistem ini harus bisa menjawab secara real-time "Booth
yang stoknya menipis" dan "performa bisnis yang perlu dilihat Owner" — dan nama produknya
sendiri adalah *"Stock, Sales & Booth **Monitoring** Platform"*. `07-database-schema.md`
bahkan sudah merencanakan kolom `latitude`/`longitude`/`address` di tabel `booths` sejak
awal. Fitur ini merealisasikan bagian itu, yang sejauh ini belum dibangun.

Obbel menjual lewat **booth keliling** (`01-project-overview.md` §2) — bukan booth
statis — jadi titik lokasi tetap per Booth saja tidak selalu mencerminkan posisi
sebenarnya saat ini. Itu sebabnya lokasi diambil dari dua sumber sekaligus (lihat §4).

## 2. Pengguna & akses

Admin Pusat saja untuk V1 (sesuai permintaan — "Monitoring Real Time di Admin"). Role
`ADMIN` dan `OWNER` diberi akses baca di level API (sama seperti `GET /dashboard/admin`
sekarang), tapi entri menu baru hanya dipasang di `admin_web`. Versi `owner_flutter`
dicatat sebagai kandidat lanjutan di §10, bukan scope sekarang.

`Petugas Booth` tidak pernah membaca endpoint ini — mereka hanya jadi **sumber data**
(lokasi GPS saat transaksi, lihat §4.2).

## 3. Layout halaman

Route baru: `/monitoring`. Dua kolom, breakpoint mobile jadi tumpuk vertikal (kiri di
atas — stok kritis lebih mendesak daripada peta).

```
┌───────────────────────────────┬────────────────────────────────────────┐
│ KIRI — Stok Kritis & Mau Habis │ KANAN — Peta & Penjualan Booth Hari Ini │
│                                │                                        │
│ [Habis]   Booth A · Matcha     │        ┌──────────────────────┐        │
│ [Kritis]  Booth C · Original   │        │        (peta)         │        │
│ [Menipis] Booth A · Taro       │        │   ●Booth A  ●Booth C   │        │
│ [Menipis] Booth B · Almond     │        └──────────────────────┘        │
│ ...                            │  Booth A · Rina · 142 cup · Rp1.240rb  │
│                                │  Booth B · Dedi · 98 cup  · Rp810rb    │
│                                │  Booth C · —    · 0 cup   · Rp0        │
└───────────────────────────────┴────────────────────────────────────────┘
```

Kartu KPI ringkas boleh ditambah di atas dua kolom (mis. "3 booth kritis", "Rp2,05jt
omzet hari ini") tapi bukan bagian wajib — itu duplikasi dashboard yang sudah ada
(`12-reporting-dashboard.md` §10), jangan sampai dua tempat menghitung angka yang sama
dengan cara berbeda. Sumbernya harus service yang sama (§6).

## 4. Sumber data per panel

### 4.1 Panel kiri — Stok Kritis & Mau Habis

Sumber: `BoothStock` × `BoothStockThreshold` → `resolveStockStatus()`
(`backend/src/common/stock-status.ts`, sudah ada, dipakai juga oleh
`DashboardService.getAdminDashboard()` dan `NotificationsService.getAll()`).

**Status yang tampil: `Kritis`, `Menipis`, `Habis`** — semua yang bukan `Aman`. Ini
keputusan yang sudah dikonfirmasi: panel ini memang untuk memberi Admin waktu bereaksi
*sebelum* jadi Kritis/Habis, bukan cuma daftar darurat.

Kolom per baris: Booth, Produk, Kategori (opsional — pola sama seperti tabel Rekap Stok
yang baru dibuat di halaman Produk), Qty saat ini, Status (badge warna), threshold
(`minimumQty`/`criticalQty` yang berlaku — Admin punya atau default `stock-status.ts`).

Urutan: **Habis** dulu, lalu **Kritis**, lalu **Menipis** — di dalam tiap kelompok status,
urut Booth lalu Produk (abjad). **Klik baris → sorot titik Booth itu di peta kanan
(masuk rilis pertama, bukan susulan)** — panel kiri dan kanan harus terasa satu layar
yang saling terhubung sejak awal, bukan dua widget berdampingan yang kebetulan.

### 4.2 Panel kanan — Peta & Penjualan Booth

**Titik lokasi per Booth, sesuai keputusan yang sudah dikonfirmasi (prioritas berurutan):**

1. **Koordinat transaksi terakhir HARI INI** (`Sale.latitude`/`longitude` dari sale PAID
   business-date hari ini, yang paling baru) — ini posisi paling akurat karena booth
   bergerak sepanjang hari.
2. **Titik tetap Booth** (`Booth.latitude`/`longitude`, diisi manual oleh Admin) — dipakai
   kalau belum ada transaksi hari ini, atau petugas menolak izin lokasi.
3. Kalau keduanya kosong: Booth tetap muncul di daftar penjualan (bagian bawah kanan),
   tapi **tidak** dapat pin di peta — jangan taruh di `(0,0)` atau titik kota default,
   itu menyesatkan.

Popup/kartu per Booth menampilkan:
- Nama Booth, sumber titik (label kecil "posisi terakhir 10:42" vs "lokasi tetap");
- Petugas yang sedang shift `OPEN` sekarang (`ShiftSession.staffId` → `Profile.fullName`)
  — kosong kalau tidak ada shift OPEN;
- **Cup terjual hari ini** — `SUM(sale_items.qty)` sale PAID business-date hari ini
  (keputusan yang sudah dikonfirmasi: satuan cup, bukan jumlah transaksi — konsisten
  dengan `12-reporting-dashboard.md` §2 "Cup Terjual" dan seluruh sistem yang sudah
  memakai cup sebagai satuan);
- **Omzet hari ini** — `SUM(sales.total)` sale PAID, dikurangi refund efektif (sama
  persis dengan formula `omzetToday` di `DashboardService.getAdminDashboard()` — pakai
  ulang, jangan hitung ulang dengan rumus berbeda);
- Waktu transaksi terakhir.

Daftar penjualan per Booth (bagian bawah panel kanan, companion ke peta — bukan tabel
terpisah yang perlu di-scroll jauh) menampilkan baris yang sama untuk SEMUA Booth aktif,
termasuk yang tidak dapat pin di peta.

## 5. Perubahan skema

```prisma
model Booth {
  // ...kolom yang sudah ada...
  address   String?  // sudah direncanakan di 07-database-schema.md, belum pernah dibuat
  latitude  Decimal? @db.Decimal(9, 6)
  longitude Decimal? @db.Decimal(9, 6)
}

model Sale {
  // ...kolom yang sudah ada...
  latitude           Decimal?  @db.Decimal(9, 6)
  longitude          Decimal?  @db.Decimal(9, 6)
  locationCapturedAt DateTime? @map("location_captured_at")
}
```

Kenapa koordinat ditaruh di `Sale`, bukan tabel tracking terpisah: satu Sale = satu titik
waktu + tempat yang jelas, dan Sale sudah append-only (tidak pernah di-hard-delete/edit —
`24-data-consistency-correction-reversal.md`), jadi historinya otomatis konsisten dengan
aturan yang sudah ada. Tidak perlu tabel baru untuk V1.

`latitude`/`longitude` di `Sale` SELALU nullable dan opsional di `CreateSaleDto` — sale
tanpa koordinat (izin lokasi ditolak, GPS timeout) tetap harus bisa diposting. Menolak
transaksi karena GPS gagal didapat melanggar prinsip "operasional cepat" (`00-README.md`
§2) dan bukan tujuan fitur ini.

## 6. Backend

### 6.1 Endpoint snapshot

`GET /monitoring/overview` (module baru `monitoring`, guard sama seperti
`DashboardController`: `JwtAuthGuard` + `RolesGuard`, `@Roles(ADMIN, OWNER)`):

```jsonc
{
  "stockAlerts": [
    { "boothId", "boothName", "productId", "productName", "categoryName",
      "qty", "minimumQty", "criticalQty", "status" } // status: Kritis|Menipis|Habis
  ],
  "booths": [
    { "boothId", "boothName",
      "location": { "lat", "lng", "source": "last_sale" | "booth_fixed" | null,
                    "capturedAt": "iso-string | null" },
      "staffOnDuty": { "id", "fullName" } | null,
      "cupSoldToday", "omzetToday", "lastSaleAt" }
  ]
}
```

Satu service (`MonitoringService`) memakai ulang query pattern yang sama dengan
`DashboardService`/`NotificationsService` — TIDAK menduplikasi rumus `omzetToday` atau
`resolveStockStatus`.

### 6.2 Real-time — WebSocket

Keputusan yang sudah dikonfirmasi: push langsung, bukan polling. **Ini infrastruktur
baru** — belum ada dependency WebSocket sama sekali di backend ini sekarang (pola
"real-time" yang ada sejauh ini, `NotificationBell.tsx`, cuma polling 30 detik). Catatan
ini disebut eksplisit supaya effort-nya tidak diremehkan saat estimasi.

- Tambah `@nestjs/websockets` + `@nestjs/platform-socket.io` + `socket.io` (server),
  `socket.io-client` (admin_web).
- `MonitoringGateway` di module `monitoring`, satu namespace `/monitoring`.
- Auth koneksi: client kirim JWT lewat `socket.handshake.auth.token` saat connect;
  `handleConnection` memvalidasinya dengan cara yang sama seperti `JwtAuthGuard`
  (verify + cek role ADMIN/OWNER), tolak koneksi kalau gagal — jangan biarkan endpoint
  real-time jadi celah auth yang terlewat dari guard REST biasa.
- **Pola event: invalidate-and-refetch, bukan stream delta.** Server cukup broadcast
  event kosong `monitoring:changed` kapan pun salah satu dari ini terjadi:
  - sale PAID baru dibuat (`SalesService.createPaidSale`);
  - `BoothStock.qtyOnHand` berubah (restock diterima, distribusi diterima, return,
    adjustment, opname — semua service yang sudah menulis `StockMovement`);
  - shift dibuka/ditutup (`ShiftsService`).

  Client yang menerima event tinggal panggil ulang `GET /monitoring/overview` — SAMA
  PERSIS dengan fetch awal saat halaman dibuka. Ini sengaja dipilih dibanding mengirim
  payload delta: menghindari dua jalur agregasi (REST vs WebSocket) yang bisa
  ketinggalan sinkron satu sama lain, dan `MonitoringService` cukup dites sekali.
  Debounce di client (≈500ms) supaya rentetan event (mis. banyak sale hampir bersamaan)
  tidak memicu banyak refetch beruntun.
- Reconnect: `socket.io-client` sudah menangani reconnect otomatis dengan backoff — tidak
  perlu logic tambahan, cukup dipastikan begitu koneksi pulih, client langsung refetch
  sekali (jaga-jaga event yang lewat saat putus).

## 7. `booth_flutter` — capture koordinat saat transaksi

Keputusan yang sudah dikonfirmasi: dibangun bersamaan dengan titik tetap Booth, bukan
fase terpisah.

- Tambah package `geolocator` (+ `permission_handler` bila diperlukan eksplisit di luar
  yang sudah dibungkus `geolocator`).
- **Izin lokasi WAJIB, bukan opsional** (keputusan yang sudah dikonfirmasi) — diminta saat
  buka shift (`shift_screen.dart`), **bukan** di tengah alur checkout. Kalau petugas
  menolak, tampilkan layar penjelasan singkat + tombol "Buka Pengaturan" dan ulangi
  permintaan setiap mereka mencoba membuka shift berikutnya — shift tidak bisa dibuka
  sampai izin diberikan. Ini soal *kebijakan izin*, bukan alur checkout; jangan campur
  dengan poin berikutnya.
- **Tapi satu transaksi TIDAK PERNAH gagal/tertunda gara-gara GPS** — ini soal keandalan
  teknis, terpisah dari kebijakan izin di atas. Saat `createPaidSale` dipanggil dari
  `checkout_screen.dart`/`pos_screen.dart`: ambil posisi terakhir yang sudah di-cache
  `geolocator` (bukan minta fix GPS baru saat itu juga — bisa makan beberapa detik dan
  memblokir pembayaran). Kalau momen itu kebetulan tidak ada cache posisi (mis. baru
  nyala HP, GPS belum sempat fix walau izin sudah diberikan), sale tetap dikirim **tanpa**
  koordinat — konsisten dengan §5 (kolom lokasi di `Sale` selalu nullable).
- **Bukan continuous tracking.** Koordinat hanya dikirim bersamaan dengan transaksi, tidak
  ada polling lokasi di background. Ini keputusan sadar untuk baterai perangkat petugas
  dan privasi (device petugas tidak dilacak di luar saat mereka benar-benar bertransaksi)
  — dicatat di sini supaya tidak "ditingkatkan" diam-diam jadi tracking berkelanjutan
  tanpa didiskusikan ulang.

## 8. Admin Web

- Route baru `/monitoring`, entri menu baru di `nav-config.ts` (ikon `Radar` atau
  `MapPin` dari `lucide-react`), ditempatkan di grup atas dekat "Dashboard".
- Peta: **Leaflet + OpenStreetMap** via `react-leaflet` — tidak butuh API key/billing
  (beda dengan Google Maps/Mapbox), cocok untuk tool internal skala kecil ini. Kalau
  nanti perlu tile yang lebih bagus, gampang diganti provider tile-nya tanpa ubah kode
  peta.
- Panel kiri & kanan dua komponen terpisah (`StockAlertPanel`, `BoothMapPanel`) yang
  sama-sama menerima data dari satu hook `useMonitoringOverview()` — hook ini yang
  memegang koneksi socket + fetch awal + refetch-on-event, supaya kedua panel selalu
  konsisten (bukan dua fetch independen yang bisa beda waktu).

## 9. Keputusan yang sudah dikonfirmasi (ringkasan)

| Keputusan | Pilihan |
|---|---|
| Satuan "berapa pack" | Cup terjual (`SUM(sale_items.qty)`), bukan jumlah transaksi |
| Cakupan status stok | Kritis + Menipis + Habis (semua bukan Aman) |
| Mekanisme update | Push WebSocket (bukan polling) |
| Sumber titik lokasi | Titik tetap Booth **dan** GPS transaksi terakhir, dibangun bersamaan |
| Input lokasi Booth di form Admin | Angka manual (lat/lng) dulu — klik-di-peta menyusul |
| Izin lokasi di app Petugas | **Wajib** — shift tidak bisa dibuka sampai izin diberikan |
| Highlight klik-baris (kiri ↔ peta) | Masuk rilis pertama, bukan susulan |
| Cara pengerjaan | **Bertahap** — tiap langkah §11 diverifikasi sebelum lanjut |

## 10. Di luar scope V1

- Riwayat pergerakan Booth di peta (trail/histori titik sepanjang hari) — V1 cuma titik
  TERAKHIR, bukan jejak. Kandidat lanjutan kalau ternyata dibutuhkan.
- Versi `owner_flutter` dari layar ini — Owner untuk sekarang tetap pakai layar
  monitoring miliknya sendiri (`21-screen-route-map.md` §C).
- Geofencing / validasi bahwa transaksi terjadi "dekat" titik Booth — tidak ada
  penolakan/flag otomatis kalau koordinat sale jauh dari titik Booth. Bisa jadi aturan
  anti-fraud di fase lanjutan, bukan sekarang.
- Notifikasi push terpisah untuk stok kritis dari panel ini — sudah ada `NotificationBell`
  yang membaca `resolveStockStatus` yang sama; tidak perlu jalur notifikasi kedua.

## 11. Urutan pengerjaan yang disarankan

1. Migrasi schema (§5) + generate Prisma client.
2. Form Booth (Admin Web, `/master/booth`) — tambah input `address`/`latitude`/`longitude`
   manual (klik-di-peta boleh menyusul, input angka dulu cukup untuk mulai).
3. Backend: `MonitoringService` + `GET /monitoring/overview` (tanpa WebSocket dulu — bisa
   diverifikasi datanya benar dengan polling manual/Postman sebelum menambah lapisan
   real-time).
4. `booth_flutter`: integrasi `geolocator`, kirim koordinat di `createPaidSale` request.
5. Backend: `MonitoringGateway` + hook broadcast di service yang relevan (§6.2).
6. Admin Web: halaman `/monitoring` (dua panel, peta, koneksi socket), entri menu baru.
7. QA: lokasi kosong (Booth baru, belum ada sale hari ini), izin lokasi ditolak di HP
   petugas, koneksi socket putus-sambung, banyak sale beruntun (debounce refetch).
