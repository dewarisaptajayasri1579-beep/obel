# 21 — Screen & Route Map

## A. Flutter Android — Petugas Booth

Recommended named routes:

| Route | Screen | Access |
|---|---|---|
| `/splash` | Splash/session resolver | Public/session |
| `/login` | Login | Public |
| `/home` | Beranda Petugas | BOOTH_STAFF |
| `/inbound/:id` | Detail Terima Stok | BOOTH_STAFF own Booth |
| `/pos` | Product catalog/POS | BOOTH_STAFF open shift |
| `/cart` | Cart & Payment | BOOTH_STAFF open shift |
| `/sale-success/:id` | Sale success/Print | BOOTH_STAFF |
| `/stock` | Stok Booth | BOOTH_STAFF |
| `/restock/new` | Buat Request Restock | BOOTH_STAFF |
| `/restock/:id` | Status/receive Restock | BOOTH_STAFF own Booth |
| `/shift` | Ringkasan Shift | BOOTH_STAFF |
| `/shift/closing` | Physical Count | BOOTH_STAFF open shift |
| `/shift/return` | Submit Return | BOOTH_STAFF closing/closed |
| `/transactions` | Riwayat transaksi shift | BOOTH_STAFF own scope |
| `/transaction/:id` | Detail/Reprint | BOOTH_STAFF own scope |

Bottom nav tetap: Home, POS, Stock, Shift. Screen lain dibuka sebagai drill-down.

## B. Next.js PWA — Admin Pusat

| Route | Page |
|---|---|
| `/login` | Login |
| `/dashboard` | Dashboard Pusat |
| `/distribution` | List/History Distribusi |
| `/distribution/new` | Wizard Kirim Stok |
| `/distribution/[id]` | Detail Distribusi |
| `/restock` | Queue Permintaan Restock |
| `/restock/[id]` | Detail/Approve/Send |
| `/returns` | Queue Return |
| `/returns/[id]` | Receive Return |
| `/stocks/booths` | Monitor Stok Booth |
| `/stocks/warehouse` | Stok Gudang |
| `/stocks/movements` | Ledger Pergerakan |
| `/sales` | List Penjualan |
| `/sales/[id]` | Detail Transaksi |
| `/reports` | Report hub |
| `/reports/sales` | Sales report |
| `/reports/booths` | Booth report |
| `/reports/products` | Product report |
| `/reports/shifts` | Shift report |
| `/reports/discrepancies` | Selisih report |
| `/master/products` | Produk |
| `/master/booths` | Booth |
| `/master/shifts` | Shift template/sessions |
| `/master/users` | Users |

## C. Flutter Android — Owner

| Route | Screen |
|---|---|
| `/splash` | Session resolver |
| `/login` | Login |
| `/home` | Executive Dashboard |
| `/booths` | Ranking Booth |
| `/booth/:id` | Detail Booth |
| `/sales` | Sales Analytics |
| `/stocks` | Kondisi Stok |
| `/discrepancies` | Ringkasan Selisih |
| `/discrepancy/:id` | Detail Selisih |
| `/reports` | Report Hub |

Bottom nav: Home, Booth, Penjualan, Laporan.

## Navigation rules
- Deep link ke data yang tidak authorized harus menghasilkan access denied/not found yang aman.
- Android back harus mempertahankan filter/scroll bila masuk ke detail lalu kembali.
- Setelah mutation sukses, invalidate/refresh query terkait, jangan bergantung pada stale cache.

## Admin routes — consistency

Tambahkan route konseptual:
- `/stock/opname`
- `/stock/opname/[id]`
- `/stock/adjustments`
- `/transactions/corrections`
- `/transactions/[type]/[id]/history`
- `/reconciliation`
- `/reconciliation/[id]`

Posted transaction detail harus mempunyai tab `Riwayat Versi` dan `Audit Trail`.
