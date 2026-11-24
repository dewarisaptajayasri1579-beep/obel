# 02 — System Architecture

## 1. High-level architecture

```text
Flutter Android — Petugas Booth ─┐
                                 │
Next.js PWA — Admin Pusat ───────┼── Backend API (Node.js/NestJS)
                                 │   ├─ Auth (JWT custom)
Flutter Android — Owner ─────────┘   ├─ PostgreSQL (Coolify, self-hosted)
                                     ├─ Domain Services / Use-case layer
                                     ├─ Realtime (WebSocket/Socket.io)
                                     └─ Storage (S3-compatible/MinIO, opsional)
```

## 2. Alasan baseline Backend API custom + PostgreSQL di Coolify
- PostgreSQL cocok untuk transaksi stok dan relasi kuat, dan dapat di-hosting sendiri di Coolify tanpa vendor lock-in.
- Otorisasi (Booth Staff hanya ke Booth-nya) ditegakkan secara eksplisit di service/application layer backend.
- Realtime (WebSocket/Socket.io) yang di-serve backend sendiri memudahkan Admin melihat perubahan stok/status.
- Flutter dan Next.js memiliki HTTP client/SDK yang matang untuk mengonsumsi REST/GraphQL API backend.
- Domain service backend memungkinkan operasi stok atomik (DB transaction) tanpa bergantung pada platform BaaS pihak ketiga.

## 3. Client architecture

### 3.1 Flutter Petugas Booth
Layer:
```text
Presentation / Screens
  ↓
State Management
  ↓
Use Cases / Application Services
  ↓
Repository Interfaces
  ↓
Backend API Repository (HTTP/REST)
  ↓
Local Cache / Printer Adapter
```

Rekomendasi state management: Riverpod atau Bloc. Pilih satu dan konsisten. Jangan campur beberapa framework state tanpa alasan.

### 3.2 Admin PWA
Next.js App Router + TypeScript + Tailwind.

Layer:
```text
app/routes
components
features
services/repositories
lib/api-client
schemas
```

Data mutation wajib server-side/RPC untuk aksi stok kritis. UI tidak boleh mengatur stok dengan update langsung.

### 3.3 Flutter Owner
Arsitektur serupa Petugas tetapi repository hanya expose query/read operation dan export/download bila diperlukan.

## 4. Backend responsibility
Backend harus menjadi sumber kebenaran untuk:
- permission;
- current stock;
- validation status;
- price snapshot saat penjualan;
- movement ledger;
- shift status;
- discrepancy;
- idempotency.

Jangan percaya nilai total, role, booth_id, atau stock balance yang dikirim client tanpa validasi server.

## 5. Transaction boundaries
Operasi berikut harus terjadi dalam satu DB transaction:
- menerima distribusi;
- membuat sale dan mengurangi stok;
- menerima restock;
- menerima return dan memindahkan stok;
- stock adjustment;
- finalisasi closing bila menghasilkan discrepancy record.

Jika salah satu langkah gagal, seluruh operasi rollback.

## 6. Realtime channel
Subscribe hanya pada data yang diperlukan:

### Petugas
- distribusi untuk Booth aktif;
- restock untuk Booth aktif;
- perubahan shift sendiri bila diubah admin.

### Admin
- restock request;
- stock return pending;
- booth stock threshold alert;
- status distribusi.

### Owner
Realtime boleh digunakan untuk KPI ringkas, tetapi polling/pull-to-refresh juga diterima. Hindari subscribe seluruh tabel transaksi mentah bila tidak perlu.

## 7. Time & timezone
- DB: `timestamptz` UTC.
- UI: `Asia/Jakarta`.
- Laporan harian dikelompokkan berdasarkan tanggal lokal Asia/Jakarta.

## 8. Money
Simpan Rupiah sebagai integer/bigint.

Benar:
```text
10000
```

Jangan:
```text
10000.00 float
```

## 9. Quantity
Stok V1 integer cup. Tidak ada fractional cup.

## 10. Future-proofing
Arsitektur harus memungkinkan nanti:
- raw material inventory;
- multi warehouse;
- multiple payment methods;
- promo/discount;
- customer order;
- multi-company.

Tetapi jangan mengimplementasikan fitur itu di V1 kecuali diperlukan oleh struktur data generik yang sederhana.

## Correction & Reconciliation Domain

Tambahkan domain service khusus **Correction & Reconciliation** di backend. Client tidak mengimplementasikan logika reversal sendiri.

Alur mutation correction:

```text
Client
  → Correction API/RPC
  → authorization + current state validation
  → impact preview / dependency check
  → reversal original effect
  → replacement/correction posting
  → stock & payment projection update
  → aggregate/reconciliation recalculation
  → audit log
  → commit atomik
```

`stock_movements` tetap append-only. `warehouse_stocks` dan `booth_stocks` adalah projection yang harus bisa diverifikasi/rebuild dari ledger.
