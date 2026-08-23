# 13 — Security & Audit

## 1. Authentication
Backend API custom menerbitkan JWT (access token + refresh token) setelah verifikasi credential terhadap `profiles`/tabel user di PostgreSQL.
- Password disimpan ter-hash (mis. bcrypt/argon2) di database, tidak pernah plaintext.
- Session token disimpan mengikuti praktik aman platform (secure storage Flutter, httpOnly cookie/secure storage untuk web).
- Jangan simpan password lokal.
- Logout menghapus local session/cache sensitif dan invalidasi/rotasi refresh token bila diimplementasikan.

## 2. Authorization
Enforce di backend API (service/domain layer), bukan hanya di UI. Backend memvalidasi role dan scope (Booth) pada setiap request sebelum menjalankan query/mutation ke PostgreSQL.
UI role guard hanya lapisan UX.

## 3. Booth scoping
Booth Staff tidak boleh bisa mengganti booth_id di network request untuk membaca/menulis Booth lain.
Backend harus derive authorized Booth dari assignment/session (bukan dari parameter yang dikirim client), lalu menolak request di luar scope tersebut.

## 4. Owner read-only
Backend API menolak seluruh endpoint mutation untuk role OWNER (bukan hanya disembunyikan di UI).
Jangan memberi kredensial database (connection string) langsung ke client.

## 5. Database & secret credentials
Database connection string, JWT signing secret, dan API key pihak ketiga hanya hidup di environment backend/server (Coolify env vars). Tidak pernah masuk Flutter binary atau public Next.js env (`NEXT_PUBLIC_*`).

## 6. Audit events wajib
- login failure/suspicious optional;
- master update;
- stock adjustment;
- distribution sent/received;
- restock approve/reject/send/receive;
- closing discrepancy;
- return receive discrepancy;
- sale void;
- user/role change.

## 7. Immutable transaction history
Jangan hard delete:
- sale paid;
- stock movement;
- closing count;
- distribution received;
- return received.

Gunakan reversal/cancel status.

## 8. Input validation
Server validate:
- qty integer positive;
- price authority;
- allowed status transition;
- actor role;
- stock enough;
- shift belongs to Booth;
- referenced product active when transaction new.

## 9. Rate/double submit
Button disable + backend idempotency.

## 10. Privacy
Data app V1 tidak membutuhkan data customer personal. Receipt tidak perlu meminta nomor telepon/nama customer.

## 11. Logging
Jangan log:
- password;
- access token;
- refresh token;
- secret key.

## 12. Backup
Production database (PostgreSQL di Coolify) harus memiliki backup strategy terjadwal (mis. `pg_dump`/`pg_basebackup` + WAL archiving) dan prosedur restore yang diuji, karena tidak ada managed point-in-time recovery otomatis seperti BaaS pihak ketiga.

## 13. Environment separation
Development/staging/production menggunakan project/env terpisah bila memungkinkan. Jangan test dengan database production.

## Security untuk correction

- Hanya ADMIN dapat melakukan posted correction.
- OWNER selalu read-only.
- BOOTH_STAFF hanya dapat mengubah DRAFT/current pre-confirmation sesuai permission.
- Posted `stock_movements` harus dicegah UPDATE/DELETE dengan database privilege/trigger Postgres, ditambah guard di service layer backend.
- Correction reason dan actor tidak boleh null.
- `audit_logs.before_data` dan `after_data` wajib untuk correction material.
- Impact snapshot disimpan agar keputusan Admin dapat ditelusuri.
- Semua correction mutation menggunakan idempotency key.
