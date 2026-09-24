# AGENTS.md — Obbel Coffee & Milk Stock & Sales Platform

Dokumen ini adalah instruksi utama untuk AI Coding Agent. Baca seluruh berkas dokumentasi sebelum mengubah kode.

## Tujuan
Bangun satu ekosistem aplikasi untuk operasional booth keliling Obbel Coffee & Milk dengan tiga client:

1. **Android Petugas Booth** — Flutter Android native, fokus transaksi, stok, penerimaan stok, restock, dan closing shift.
2. **Web PWA Admin Pusat** — Next.js + TypeScript + Tailwind CSS, fokus distribusi stok, restock, return, monitoring, dan laporan.
3. **Android Owner** — Flutter Android native, read-only monitoring eksekutif.

Ketiganya memakai **satu backend dan satu database**.

## Keputusan arsitektur baseline
Gunakan **backend API custom (Node.js/NestJS) + PostgreSQL self-hosted di Coolify** sebagai baseline:
- PostgreSQL (Coolify managed instance) sebagai database utama.
- Backend API sendiri (NestJS/Express) menerbitkan JWT dan menangani autentikasi/session.
- Otorisasi (role & booth scoping) ditegakkan di application/service layer backend, bukan Row Level Security Postgres.
- Realtime perubahan stok/status memakai WebSocket/Socket.io (atau SSE) yang di-serve backend sendiri.
- Storage foto produk/booth memakai object storage S3-compatible (mis. MinIO) yang di-deploy di Coolify, atau disk volume terkelola.
- Transaksi stok yang harus atomik diimplementasikan sebagai service/use-case backend yang membungkus DB transaction (Prisma/Knex/raw SQL), bukan PostgreSQL Function/RPC langsung.
- Secret server-side (DB credential, JWT secret, webhook secret) hanya hidup di environment backend, tidak pernah dikirim ke client.

Jika implementasi backend diganti, pertahankan kontrak domain dan business rule dalam dokumentasi.

## Prinsip wajib
- **DATA CONSISTENCY IS P0:** setiap posted transaction harus mempunyai aturan cancel/reversal dan revision; tidak boleh direct edit/hard delete.
- Baca dan patuhi `24-data-consistency-correction-reversal.md` sebelum membangun mutation transaksi. Gunakan `25-transaction-impact-matrix.md` sebagai quick reference per transaksi.
- Jangan hardcode booth, shift, produk, harga, threshold stok, atau user.
- Jangan mengubah stok hanya dengan `UPDATE qty` dari UI. Semua perubahan stok harus melewati service/domain-layer backend yang atomik dan membuat `stock_movements`.
- Gunakan UUID dan idempotency key untuk transaksi kritis.
- Semua nominal uang disimpan sebagai integer Rupiah, bukan float.
- Semua kuantitas unit cup disimpan sebagai integer.
- Semua timestamp disimpan UTC; UI menampilkan Asia/Jakarta.
- Owner read-only.
- Petugas Booth hanya boleh mengakses booth/shift yang ditugaskan kepadanya.
- Admin Pusat dapat menjalankan aksi operasional lintas booth.
- UX: banyak klik/tap, minim ketikan, angka penting besar, satu layar satu tujuan utama. Fokus layout harus bersih, dengan font size yang lebih besar dari ukuran umum di aplikasi seluler pada umumnya, namun tetap terjaga proporsionalitasnya.

## Urutan implementasi yang disarankan
1. Database, enum, constraint, index, authorization/role & booth-scoping layer di backend.
2. Seed master data.
3. Immutable stock ledger + transaction lineage/version foundation.
4. RPC/domain service transaksi normal **dan correction/reversal/revision**.
5. Stock opname, recount, adjustment, reconciliation engine, dan integrity tests.
6. Auth + role guard.
7. Flutter Petugas Booth.
8. Web PWA Admin Pusat termasuk Riwayat & Koreksi Data.
9. Flutter Owner.
10. Realtime, printer adapter, notification, export.
11. Testing end-to-end seluruh normal flow + correction flow.

## Aturan Soft Delete & Log Aktivitas

Ditetapkan 2026-09-22, berlaku untuk **seluruh** entitas di backend, bukan hanya Produk.

### 1. Gunakan Soft Delete

- **Tidak pernah** `DELETE FROM` baris yang bisa dirujuk dokumen lain. Entitas yang boleh
  "dihapus" dari sudut pandang pengguna ditandai lewat kolom `deletedAt DateTime?`
  (pola di `Product.deletedAt`, `prisma/schema.prisma`) — bukan dibuang dari tabel.
- Baris ber-`deletedAt` terisi disembunyikan dari daftar biasa (`WHERE deletedAt IS NULL`
  di setiap query `findMany` yang menghadap pengguna) tapi tetap ada di database untuk
  ditelusuri lewat log aktivitas atau query langsung bila perlu.
- Soft delete **hanya boleh dieksekusi kalau entitasnya belum pernah tersentuh transaksi
  apa pun** (lihat `ProductsService.remove()` sebagai contoh — mengecek `StockMovement`,
  `SaleItem`, `StockDistributionItem`, `RestockRequestItem`, `StockReturnItem`,
  `StockOpnameItem`, dan sisa stok sebelum mengizinkan). Kalau sudah punya histori, tolak
  dengan `DomainError` yang menjelaskan alasannya dan arahkan ke jalur
  **Nonaktifkan** (`active = false`) — bukan hapus.
- `active = false` (nonaktif) dan `deletedAt` terisi (dihapus) adalah **dua hal berbeda**:
  nonaktif = disembunyikan dari transaksi baru tapi masih bisa diaktifkan lagi kapan pun;
  dihapus = ditutup permanen oleh Admin karena tidak pernah dipakai transaksi apa pun.
- Perkecualian: dokumen transaksi (`Sale`, `StockDistribution`, dst) sudah punya jalur
  reversal/koreksinya sendiri per `24-data-consistency-correction-reversal.md` — aturan
  di atas berlaku untuk **master data** (Produk, Booth, User, Kategori, dst), bukan
  menggantikan mekanisme koreksi transaksi yang sudah ada.
- Kolom `Shift Delete` (native/hard delete) tidak pernah dipakai sebagai tombol atau
  endpoint yang menghadap pengguna di aplikasi mana pun. Kalau ada kebutuhan pembersihan
  data uji/pengembangan yang genuinely butuh hard delete, itu selalu berupa script
  operasional yang dijalankan manual oleh Admin/pengembang (lihat
  `backend/scripts/reset-transaksi.ts`), bukan fitur di UI.

### 2. Log Aktivitas per Transaksi

- Setiap aksi bermakna pada satu entitas — dibuat, diubah, dihapus (soft), diaktifkan,
  disetujui, dibatalkan, dst — **wajib** tercatat lewat `ActivityLogService.record()`
  (`backend/src/common/activity-log.service.ts`), yang menulis ke tabel `activity_logs`.
- Satu baris log menjawab tiga hal: **kapan** (`occurredAt`), **siapa**
  (`actorId` + `actorName` — nama di-snapshot saat penulisan, sama seperti
  `SaleItem.productNameSnapshot`, supaya baris lama tetap terbaca kalau nama akun
  pelakunya berubah belakangan), dan **ngapain** (`action` + `note` berbahasa manusia,
  bukan sekadar kode).
- `ActivityLog` **bukan pengganti** `StockMovement`/`TransactionCorrection` yang mencatat
  dampak stok/uang secara presisi — ini mencatat aksinya, termasuk aksi yang tidak
  mengubah stok sama sekali (mis. menonaktifkan user, mengubah threshold).
- Status implementasi (2026-09-22): sudah dipasang penuh di modul **Produk**
  (create/update/aktifkan/nonaktifkan/soft-delete). Modul lain (Distribusi, Restock,
  Return, Opname, Koreksi, Shift, dst) **belum** dipasangi — ini utang teknis yang harus
  ditutup bertahap. Setiap kali menyentuh modul transaksi untuk alasan lain, sekalian
  pasang `ActivityLogService.record()` di jalur tulisnya kalau belum ada.

### 3. Tampilan Panel "Riwayat Aktivitas" (ditetapkan 2026-09-23)

Berlaku untuk **semua** panel yang menampilkan `ActivityLogEntry[]` di `admin_web`
(contoh: `SerahTerimaActivityLog.tsx`, `PenerimaanActivityLog.tsx`, `SaleActivityLog.tsx`
— jadikan acuan pola untuk panel baru di menu Transaksi lain):

- **Urutan tampil dari yang paling awal ke paling baru** (ascending by `occurredAt`),
  meskipun endpoint backend mengembalikannya `desc` (terbaru dulu) — urutkan ulang di
  komponen (`[...log].reverse()`), jangan ubah `orderBy` di backend karena endpoint yang
  sama tidak dipakai di tempat lain yang butuh urutan terbalik.
- **Tanpa header kolom.** Baris tabel langsung berisi kolom kapan/siapa/ngapain tanpa
  `<thead>` "Tanggal / Siapa / Ngapain" — konteksnya sudah jelas dari judul panel
  "Riwayat Aktivitas" dan badge aksi berwarna di kolom terakhir.
- Struktur baris tetap: kolom waktu (format `waktuJakarta`, Asia/Jakarta), kolom nama
  aktor (`entri.actorName`), kolom badge aksi (`AKSI_LABEL`/`AKSI_WARNA` map per modul)
  + catatan (`entri.note`) kalau ada.

### 4. Penomoran Nomor Bukti (ditetapkan 2026-09-23)

Berlaku untuk **semua** jenis nomor bukti/dokumen di backend (Penjualan, Tambah Stok
Gudang, Serah Terima/Terima Stok, Retur, Restock Request, Stock Opname, Reconciliation
Case, Refund, Stock Movement, dst — lihat `08-business-rules.md` BR-037):

- **Format sekuensial sederhana**: `PREFIX-000001`, naik satu per dokumen, diambil dari
  nomor TERBESAR yang sudah ada per prefix (bukan dari jumlah baris). Contoh acuan:
  Tambah Stok Gudang (`TRM-000001`, `StockReceiptsService.nomorBerikutnya`).
- **Dilarang** format timestamp+random (mis. `DIST-LX2K3A-1F2B3C`) atau skema lain yang
  tidak berurutan — nomor bukti dipakai Admin/Petugas Booth di lapangan, harus enak
  dibaca dan diucapkan, bukan cuma unik secara teknis.
- Pakai helper bersama di `backend/src/common/doc-no.ts`
  (`nomorSekuensialBerikutnya`, `alokasikanNomorSekuensial` untuk batch,
  `nomorMovementBerikutnya`/`nomorMovementBerikutnyaBanyak` khusus `StockMovement`) —
  jangan tulis ulang regex parsing nomor tertinggi di tiap service.
- Query nomor tertinggi dalam `tx` yang sama dengan insert-nya, lalu bungkus transaksi
  dengan retry-on-unique-constraint-violation (kode Prisma `P2002`, pola
  `MAKS_PERCOBAAN_NOMOR` di `StockReceiptsService.create`) untuk menangani dua request
  bersamaan yang membaca nomor tertinggi yang sama.
- Dokumen versi baru hasil revisi (mis. `reviseDistribution`, `reviseSale`,
  `reviseReturn`) **wajib** ambil nomor baru lewat generator yang sama — bukan alasan
  untuk kembali ke skema lama.

## Definition of Done
Fitur dianggap selesai hanya jika:
- UI sesuai role dan flow.
- Business rule tervalidasi di backend, bukan hanya UI.
- Ada loading, empty, error, dan success state.
- Aksi tidak menyebabkan duplikasi ketika tombol ditekan dua kali.
- Perubahan stok menghasilkan ledger `stock_movements`.
- Revisi/cancel transaksi posted memakai reversal/replacement dan audit trail.
- Stock opname confirmed immutable; correction menggunakan recount.
- Report/dashboard membaca effective/net data setelah correction.
- Permission/authorization layer diuji.
- Acceptance criteria terkait lulus.
