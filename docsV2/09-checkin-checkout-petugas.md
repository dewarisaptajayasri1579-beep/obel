# 09 — Check-In & Check-Out Petugas Booth ("Absen Berangkat"/"Absen Pulang")

## 0. Tentang dokumen ini

Sesi ini (yang menulis dokumen ini) tidak ikut membangun fitur Check-In — ini disusun
dengan menanyakan ke **dua sesi Claude Code lain** yang berjalan paralel di repo yang
sama, lalu memverifikasi klaim mereka langsung ke kode (`backend/src/modules/shifts/`,
`backend/src/modules/booth-shift-assignments/`, `apps/booth_flutter/lib/screens/
check_in_screen.dart`, `apps/booth_flutter/lib/app_state.dart`).

Kedua sesi **tidak sepakat siapa pembuat aslinya** — satu mengklaim itu diskusinya,
satu lagi cuma menemukan filenya sudah ada di working tree tanpa tahu asalnya. Bagian
§1–§2 di bawah **hanya memuat yang bisa diverifikasi langsung dari kode yang sudah
jalan** — bukan hasil rekonstruksi ingatan sesi mana pun. Bagian §3 (gerbang approval
Check-Out) dan §4 (scope besar lain yang diminta) dikutip dari laporan sesi yang
mengklaim ikut diskusi aslinya, **belum ada kodenya untuk diverifikasi** — ditandai
jelas statusnya di tiap bagian.

---

## 1. Yang sudah dibangun & terverifikasi di kode

### Model data

`BoothShiftAssignment` (lihat `26-monitoring-realtime.md` §5 dok lama untuk kolom
lat/lng Booth yang terkait) menyimpan **roster default**: satu Petugas → maksimal satu
pasangan Booth + ShiftTemplate. Ditegakkan `staffId String? @unique` di
`backend/prisma/schema.prisma` — baris "belum ditugaskan" (`staffId = null`) boleh
banyak, tapi begitu terisi, satu staffId cuma boleh muncul di **satu** baris. Diisi
lewat halaman Admin **Data Operasional → Booth → tab "Setting Petugas"**.

Ini jadi **sumber Booth+Shift default** yang dibaca otomatis saat Petugas check-in —
lihat alur di bawah.

### Endpoint backend

| Endpoint | Role | Fungsi |
|---|---|---|
| `GET /booth-shift-assignments/mine` | `BOOTH_STAFF` | Assignment milik diri sendiri — dipakai preview Booth/Shift sebelum submit Check-In |
| `GET /booths` | `ADMIN`, `OWNER`, **`BOOTH_STAFF`** (baru ditambah) | Daftar Booth, dipakai bottom sheet "Ganti Booth" manual di layar Check-In |
| `POST /shifts/check-in` | `BOOTH_STAFF` | Check-in — lihat alur di bawah |

### Alur `POST /shifts/check-in` (`shifts.service.ts` → `checkIn()`)

Body opsional: `{ boothId?: string }` (override manual, kosong = pakai default assignment).

1. Cek apakah staff **sudah** punya `ShiftSession` berstatus `OPEN`/`CLOSING`:
   - Kalau `boothId` yang dikirim **beda** dari booth shift aktifnya → ditolak,
     `DomainError('ALREADY_CHECKED_IN_ELSEWHERE', ...)` — pesannya: *"Anda masih aktif
     di Booth X. Checkout dulu sebelum check-in ke Booth lain."*
   - Kalau sama (atau `boothId` tidak dikirim) → **idempotent**, kembalikan shift yang
     sudah ada apa adanya (menjaga double-tap tombol Check In).
2. Kalau belum ada shift aktif: ambil `BoothShiftAssignment` milik staff
   (`findUnique({ where: { staffId } })`). Kalau tidak ada baris sama sekali →
   `DomainError('NO_BOOTH_ASSIGNMENT', ...)` — *"Anda belum ditugaskan ke Booth
   manapun. Hubungi Admin."*
3. `boothId` final = override dari body **atau** booth dari assignment. Booth wajib
   `status === 'ACTIVE'`, kalau tidak → `DomainError('BOOTH_INACTIVE', ...)`.
4. **`shiftTemplateId` SELALU ikut assignment** — tidak bisa dioverride manual dari
   body (cuma Booth yang bisa). Jam mulai/selesai dihitung dari `businessDate` Asia/Jakarta
   + `startTime`/`endTime` template.
5. `ShiftSession` dibuat **langsung berstatus `OPEN`** (bukan `SCHEDULED` dulu — status
   `SCHEDULED` di enum `ShiftStatus` memang tidak pernah dipakai jalur manapun di kode
   saat ini).

### Android (`booth_flutter`)

- `check_in_screen.dart` (baru, 261 baris) — wajib dilewati sebelum masuk `MainShell`.
  Menampilkan preview Booth+Shift dari `AppState.getMyAssignment()`
  (`GET /booth-shift-assignments/mine`), tombol **"Ganti Booth"** (bottom sheet dari
  `AppState.getBooths()`), tombol **"CHECK IN"** yang memanggil
  `AppState.checkIn(boothId: override)`.
- `AppState.login()` sekarang menangani `GET /shifts/active` yang gagal dengan
  `ApiException` kode `NOT_FOUND` sebagai kondisi normal `needsCheckIn = true` (bukan
  error) — routing ke `/check-in`, bukan langsung `/home`.

### Urutan alur yang disepakati (koreksi dari asumsi lama)

**Check-In dulu (Petugas mengaktifkan dirinya sendiri) → BARU Admin bisa memilih
Petugas itu di alur Serah Terima Stok.**

Ini **membalik** catatan lama di `apps/admin_web/src/app/dokumentasi/
DokumentasiView.tsx` yang mengasumsikan shift baru `OPEN` **setelah** Petugas
mengonfirmasi terima stok dari Admin. Asumsi lama itu **sudah tidak berlaku** — jangan
dipakai sebagai referensi lagi, dan `DokumentasiView.tsx` perlu diperbarui menyesuaikan
(belum dilakukan di dokumen ini, dicatat sebagai utang terpisah).

---

## 2. Status `ShiftSession` yang benar-benar dipakai

Enum di schema saat ini: `SCHEDULED | OPEN | CLOSING | CLOSED | CANCELLED`.

Check-in membuat `OPEN` langsung. `CLOSING` dipakai lewat dua endpoint yang **sudah ada
sejak sebelum fitur Check-In** (bukan bagian baru — lihat §3):

```
OPEN ──[POST /shifts/:id/closing/start]──► CLOSING ──[POST /shifts/:id/closing/confirm]──► CLOSED
```

`closing/start` men-snapshot `BoothStock` jadi "expected" per produk (dipanggil dari
`AppState.startShiftClosing()`). `closing/confirm` mengirim qty aktual + `reasonCode`
untuk baris yang selisih, server menyesuaikan `booth_stocks` dan menutup shift
(dipanggil dari `AppState.confirmShiftClosing()`).

**Penting:** `docsV2/07-siklus-shift.md` §4 menulis status shift **tiga tahap**
(`OPEN → MENUNGGU_PENGEMBALIAN → CLOSED`) sebagai bagian dari rencana arsitektur
`ShiftStock` (stok dipegang shift, bukan booth) — itu **belum diimplementasikan**.
Kode yang berjalan sekarang masih `OPEN → CLOSING → CLOSED` dengan `BoothStock`
seperti biasa. Jangan disamakan; dok 07 adalah rencana, bagian ini adalah kondisi
sungguhan di kode.

---

## 3. Check-Out — dikonfirmasi, TAPI ada gap penting yang belum diimplementasi

**Update:** salah satu sesi yang ditanya (yang mengklaim ikut diskusi awalnya)
mengonfirmasi langsung — bukan lagi dugaan §3 versi sebelumnya.

**Check-Out MEMANG memicu alur closing yang sudah ada** (`closing/start` →
`closing/confirm`, §2 di atas). "Laporan Kembali" di redesign Beranda (§4) adalah
representasi dari closing count itu sendiri: rekap Stok Awal/Restok/Terjual/Sisa Stok
+ breakdown Kas QRIS/Tunai. Bukan konsep terpisah dari proses tutup-stok shift.

### Gap yang belum diimplementasi: gerbang approval Admin

Di diskusi awal, user **secara eksplisit** minta ada **gerbang approval Admin**
sebelum Absen Pulang/Check-Out benar-benar aktif. Alur yang diminta:

```
Petugas submit laporan (stok + penjualan)
        │
        ▼
Admin cek kesesuaian
        │
        ▼
Admin approve
        │
        ▼
Tombol Absen Pulang / Check Out BARU aktif
```

**Ini belum ada di kode.** `confirmClosing()` yang berjalan sekarang (`shifts.service.ts`)
langsung menutup shift ke `CLOSED` begitu Petugas sendiri yang confirm — **self-service**,
role `BOOTH_STAFF`, tanpa langkah approval Admin terpisah di antaranya. Tidak ada
gerbang, tidak ada status "menunggu approval".

Kemungkinan desain untuk menutup gap ini (belum diputuskan, cuma opsi):

- Status baru di antara `CLOSING` dan `CLOSED`, mis. `PENDING_APPROVAL` — `confirmClosing`
  milik Petugas cuma memindahkan ke situ, endpoint baru khusus Admin yang memindahkan
  ke `CLOSED`.
- Atau: tetap satu transisi `CLOSING → CLOSED`, tapi tambah field `approvedById` /
  `approvedAt` yang wajib terisi (oleh endpoint Admin terpisah) sebelum
  `confirmClosing` boleh dieksekusi/dianggap final.

Ini setara pentingnya dengan gap Attendance/foto/GPS di §4 — **scope baru yang perlu
ditambahkan**, bukan sekadar detail kecil dari yang sudah ada.

---

## 4. Scope besar yang DIMINTA tapi BELUM diimplementasikan

Dikutip dari laporan salah satu sesi lain (belum diverifikasi ke kode — **karena
kodenya memang belum ada**). User dilaporkan meminta redesign yang jauh lebih detail
dari yang sudah dibangun di §1, dan masih menunggu mockup sebelum lanjut coding:

- **Redesign alur Check-In**: buka Map (pilih/konfirmasi lokasi) → ambil foto Selfie →
  baru pilih Booth → simpan ke **tabel Absensi terpisah** (kolom: user, jam, tanggal,
  foto, koordinat). Ini beda dari implementasi §1 yang cuma membuat `ShiftSession`
  `OPEN` tanpa foto/GPS/tabel tersendiri.
  - Kemungkinan perlu model Prisma baru (`Attendance`/`Absensi`) + relasi ke
    `ShiftSession`, plus mekanisme penyimpanan file foto (pola upload produk sudah ada
    di `products.controller.ts` — bisa jadi rujukan, belum dicek kesesuaiannya).
- **Redesign Halaman Beranda** (Android): section Notifikasi / Setting Profil /
  Check-In, grid menu Kasir / Terima Stok / Stok / Riwayat Penjualan, "Laporan Kembali"
  (rekap stok + kas QRIS/Tunai), tombol **Check Out**, bottom bar Home / Riwayat Absen /
  Riwayat Penjualan / Setting.
- Menu Transaksi (Kasir dkk.) harus **disabled** sebelum Petugas check-in.
- Layar Kasir harus mendukung **portrait dan landscape**.
- **Gerbang approval Admin sebelum Check-Out aktif** — lihat §3. Beda dari tiga poin
  di atas, ini terkait LANGSUNG dengan closing shift yang sudah jalan sekarang
  (`confirmClosing`), jadi risikonya lebih tinggi kalau ada yang mulai coding tanpa
  desain status/gerbangnya disepakati dulu.

**Status: belum ada satu baris kode pun untuk bagian ini** — laporan menyebut user
masih meminta mockup visual terlebih dulu sebelum implementasi dimulai.

---

## 5. Pertanyaan terbuka (perlu keputusan Anda)

1. **Desain gerbang approval Check-Out** (§3) — status baru `PENDING_APPROVAL` di
   antara `CLOSING`/`CLOSED`, atau field `approvedById`/`approvedAt` di alur yang ada?
   Endpoint approve-nya di modul `shifts` yang sama atau modul baru?
2. **Model data Absensi** (§4) — tabel `Attendance` terpisah dengan foto+GPS, atau
   field tambahan di `ShiftSession`? Kalau terpisah, satu `Attendance` per Check-In
   (dan satu lagi per Check-Out), atau satu baris yang di-update dua kali?
3. **`DokumentasiView.tsx`** masih menyimpan asumsi lama (shift `OPEN` setelah
   konfirmasi terima stok) yang sudah dibalik oleh keputusan di §1 — perlu diperbarui
   supaya tidak jadi rujukan yang salah bagi siapa pun yang baca dokumentasi sistem itu
   berikutnya.
4. Siapa pemilik asli diskusi awal fitur ini tidak bisa dipastikan dari kode — kalau
   ada detail keputusan (alasan desain, trade-off yang dibahas) di luar yang sudah
   dikonfirmasi di §3 dan dibutuhkan nanti, satu-satunya sumber adalah riwayat
   percakapan aslinya di luar sesi-sesi yang aktif saat dokumen ini ditulis.
