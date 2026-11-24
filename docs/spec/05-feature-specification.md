# 05 — Feature Specification

# A. Flutter Android — Petugas Booth

## A1. Login
Komponen:
- logo;
- username;
- password;
- show/hide password;
- remember session;
- login button;
- error state.

Acceptance UX: tombol login penuh, field minimum, tidak ada konfigurasi teknis.

## A2. Bottom Navigation
Empat tab tetap:
1. Beranda
2. Jual
3. Stok
4. Shift

Badge dapat muncul di Beranda/Stok ketika ada inbound/restock.

## A3. Beranda
Wajib menampilkan:
- nama Petugas;
- nama Booth;
- status shift;
- jam shift;
- omzet shift/hari sesuai label;
- cup sold;
- transaksi;
- jumlah item low stock;
- pending stock inbound card;
- alert penting.

Prioritas card inbound > KPI biasa jika ada stok belum diterima.

## A4. Terima Stok
- source Gudang;
- target Booth;
- shift;
- timestamp sent;
- item list;
- total cup;
- button receive;
- discrepancy action.

Harus ada confirmation state dan protection double-tap.

## A5. POS
- search product;
- category chips;
- product grid;
- image optional;
- name, price, current stock;
- disabled/sold-out state;
- sticky cart.

Product card stok kritis boleh menunjukkan badge, tetapi tetap bisa dijual jika qty > 0.

## A6. Cart & Payment
- item list;
- +/-;
- subtotal;
- total;
- method Tunai/QRIS;
- Pay & Print;
- success state;
- reprint.

V1 tidak membutuhkan split payment.

## A7. Stok
- current stock per product;
- minimum threshold;
- status Aman/Menipis/Habis;
- request restock;
- inbound restock card;
- stock movement ringkas optional.

## A8. Restock Request
- select multiple products;
- requested qty;
- optional note dengan preset reason terlebih dahulu;
- submit;
- status timeline.

## A9. Shift
- current shift summary;
- omzet;
- sold qty;
- transaction count;
- stock remaining;
- product summary;
- close shift.

## A10. Closing Count
- expected quantity;
- actual quantity;
- discrepancy live;
- reason chips;
- optional note if Other;
- confirm.

## A11. Return
- return item summary;
- total;
- submit;
- pending received status.

---

# B. Web PWA — Admin Pusat

## B1. Dashboard
KPI:
- omzet hari ini;
- cup terjual;
- Booth aktif;
- item menipis;
- pending restock;
- pending return;
- discrepancy alert.

Grid Booth:
- status;
- shift;
- omzet;
- remaining stock;
- quick action.

Notification panel harus actionable.

## B2. Distribusi Stok
Wizard:
- Booth → Products → Qty → Confirm.

Harus menunjukkan warehouse available qty dan mencegah over-allocation.

## B3. Restock Booth
- status tabs;
- booth filter;
- priority;
- current Booth stock;
- warehouse available;
- requested vs approved qty;
- approve/reject/send.

## B4. Return Stok
- pending return list;
- detail submitted vs actual received;
- discrepancy;
- receive;
- bulk receive hanya untuk item yang cocok dan eligible.

## B5. Monitor Stok Booth
Matrix table desktop:
- rows products;
- columns Booth atau sebaliknya;
- filter;
- threshold badge;
- quick restock.

Untuk layar kecil PWA, ubah menjadi stacked cards, jangan paksa tabel horizontal besar.

## B6. Warehouse Stock
- on hand;
- reserved/in transit bila digunakan;
- available;
- status;
- movement history;
- adjustment dengan alasan.

## B7. Sales
- transaction list;
- detail receipt;
- filter period, Booth, product, payment method;
- summary.

## B8. Reports
- sales summary;
- Booth ranking;
- product ranking;
- shift report;
- movement ledger;
- return;
- discrepancy;
- export.

## B9. Master Data
Product:
- name, category, price, image, active.

Booth:
- code, name, location, active.

Stock threshold:
- Booth/product min and critical.

Shift template:
- name, start, end.

User:
- profile, role, assignment/default Booth, active.

---

# C. Flutter Android — Owner

## C1. Login
Simple owner access.

## C2. Executive Home
- omzet today;
- delta vs previous comparable period;
- cup sold;
- active Booth;
- attention count;
- alert cards;
- best Booth.

## C3. Booth Ranking
Period chips:
- Hari Ini
- 7 Hari
- Bulan Ini

List ranking with omzet and cup.

## C4. Booth Detail
- status;
- omzet;
- cup sold;
- transactions;
- stock remaining;
- top products;
- shift summaries;
- read-only stock detail.

## C5. Sales Analytics
- total omzet;
- simple chart;
- top product;
- top Booth.

## C6. Stock Condition
- %/count safe;
- low count;
- out count;
- list only problem items first.

## C7. Discrepancy
- qty discrepancy;
- estimated value;
- Booth list;
- detail reason.

## C8. Reports
Card-based navigation and period chips. Export optional but recommended.

## B10. Riwayat & Koreksi Data
- global search nomor transaksi;
- filter jenis transaksi, Booth, tanggal, Petugas, status;
- transaction detail;
- version/revision timeline;
- audit trail;
- impact preview;
- action `Revisi Transaksi` dan `Batalkan Transaksi` berdasarkan eligibility;
- reason wajib;
- warning post-close correction;
- status reconciliation.

Jangan gunakan tombol `Edit` biasa untuk posted transaction.

## B11. Stock Opname
- pilih location Gudang/Booth menggunakan card;
- snapshot expected stock;
- physical count menggunakan +/-;
- live discrepancy;
- reason chip;
- confirm opname;
- recount/revision bila confirmed count salah;
- movement/adjustment audit.

## B12. Adjustment / Koreksi Stok
Admin memilih location + product + target actual quantity. Server menghitung delta. Reason wajib. Posted adjustment hanya dapat diperbaiki melalui reversal adjustment.
