# Dokumentasi Project — Obbel Coffee & Milk
## Stock, Sales & Booth Monitoring Platform

Versi dokumentasi: **1.1 — Data Consistency & Correction Architecture**  
Tujuan dokumen: dasar implementasi oleh **AI Coding Agent / developer** tanpa perlu mengetahui percakapan awal project.

---

## 1. Ringkasan

Project ini menggantikan pencatatan operasional booth keliling yang berpotensi tercecer dengan sistem terpusat. Sistem harus bisa menjawab secara real-time:

- stok Gudang Pusat sekarang berapa;
- stok masing-masing Booth sekarang berapa;
- stok apa yang sedang dikirim dan belum diterima;
- penjualan per Booth/shift/produk;
- Booth yang stoknya menipis;
- permintaan restock yang harus ditindaklanjuti;
- sisa stok saat closing;
- stok yang dikembalikan ke Gudang;
- selisih stok sistem vs fisik;
- performa bisnis yang perlu dilihat Owner.

Produk yang dilacak pada scope V1 adalah **produk siap jual dalam satuan cup**, bukan bahan baku resep seperti kopi bubuk, susu, gula, es, dan sebagainya.

---

## 2. Aplikasi dalam ekosistem

| App | Platform | Pengguna | Karakter |
|---|---|---|---|
| Petugas Booth | Flutter Android native | Petugas Booth | Operasional cepat, POS, stok, shift |
| Admin Pusat | Next.js Web PWA | Admin/Gudang | Control center seluruh Booth |
| Owner | Flutter Android native | Owner/Manager | Monitoring read-only |

Semua client memakai **satu database/backend**.

---

## 3. Dokumen

1. `01-project-overview.md` — tujuan, scope, terminology, asumsi.
2. `02-system-architecture.md` — arsitektur teknis dan pembagian komponen.
3. `03-users-roles-permissions.md` — role dan matriks akses.
4. `04-user-flow.md` — alur end-to-end per role.
5. `05-feature-specification.md` — spesifikasi halaman dan fitur.
6. `06-ui-ux-guideline.md` — pedoman desain dan interaksi.
7. `07-database-schema.md` — tabel, field, relasi, index, constraint.
8. `08-business-rules.md` — aturan bisnis dan rumus stok.
9. `09-api-rpc-contract.md` — kontrak service/RPC.
10. `10-state-machines.md` — status lifecycle transaksi.
11. `11-notification-printing-offline.md` — notifikasi, printer, network behavior.
12. `12-reporting-dashboard.md` — definisi KPI dan laporan.
13. `13-security-audit.md` — Auth, RLS, audit, keamanan.
14. `14-development-guideline.md` — struktur project dan coding convention.
15. `15-testing-acceptance-criteria.md` — test case dan kriteria penerimaan.
16. `16-seed-dummy-data.md` — data contoh dari materi Obbel.
17. `17-deployment-environment.md` — environment dan deployment.
18. `18-ai-agent-implementation-plan.md` — urutan eksekusi agent.
19. `19-requirement-traceability.md` — pemetaan kebutuhan ke fitur/data/test.
20. `20-starter-schema.sql` — starter SQL referensi.
21. `21-screen-route-map.md` — route/screen map.
22. `22-mermaid-diagrams.md` — diagram alur dan ERD.
23. `23-open-decisions.md` — keputusan yang harus dikonfirmasi sebelum production.
24. `24-data-consistency-correction-reversal.md` — aturan cancel/revisi, stock opname, correction, reversal, dan reconciliation seluruh transaksi.
25. `25-transaction-impact-matrix.md` — quick reference dampak cancel/revisi per jenis transaksi.

Folder `references/` berisi mockup dan referensi visual yang harus dipakai sebagai arah desain, bukan sebagai pixel-perfect requirement.

---

## 4. Keputusan yang sengaja dibuat configurable

Beberapa informasi dari brief tidak konsisten atau dapat berubah di operasional, sehingga **dilarang hardcode**:

- jam Shift 1 dan Shift 2;
- jumlah Booth;
- jumlah Petugas;
- minimum stok per produk per Booth;
- harga produk;
- lokasi Booth;
- printer thermal yang digunakan.

Semua harus berasal dari master/configuration data.

---

## 5. Prioritas MVP

### P0 — wajib sebelum dipakai
- Login dan role.
- Master Booth, Produk, Shift, User.
- Stok Gudang & Stok Booth.
- Distribusi stok Gudang → Booth.
- Penerimaan stok oleh Petugas.
- POS/penjualan dan pembayaran Tunai/QRIS.
- Stock deduction atomik.
- Warning stok menipis.
- Request & fulfillment restock.
- Closing shift + physical count.
- Return Booth → Gudang.
- Dashboard Admin.
- Dashboard Owner.
- Laporan dasar.
- Audit stock movement.
- Correction/reversal transaction engine.
- Stock opname Gudang & Booth.
- Recount dan reconciliation historis.
- Riwayat versi transaksi dan impact preview koreksi.

### P1 — sesudah P0 stabil
- Bluetooth thermal printer production integration.
- Push notification native Android.
- Export Excel/PDF yang lebih kaya.
- Offline sales queue bila dibutuhkan di lapangan.
- Foto bukti/attachment bila dibutuhkan.

### Out of scope V1
- Akuntansi lengkap.
- Payroll.
- Purchase order supplier.
- Raw material recipe/BOM.
- CRM/loyalty.
- Marketplace/order customer.
- Instagram integration.
