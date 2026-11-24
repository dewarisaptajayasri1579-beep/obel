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
- Gunakan Bahasa Indonesia pada UI.
- UX: banyak klik/tap, minim ketikan, angka penting besar, satu layar satu tujuan utama.

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
