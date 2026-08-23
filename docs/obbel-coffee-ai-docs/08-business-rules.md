# 08 — Business Rules

## BR-001 — Source of truth stok
`warehouse_stocks` dan `booth_stocks` adalah balance snapshot untuk query cepat. `stock_movements` adalah audit ledger.

Setiap perubahan balance wajib menghasilkan movement pada transaction yang sama.

## BR-002 — Tidak boleh stock negatif
Sale/distribution/restock/return tidak boleh menyebabkan source stock < 0.

Backend harus lock/atomic check sebelum commit.

## BR-003 — Distribusi awal
Saat Admin menekan Kirim:
- status menjadi `SENT`;
- qty harus tersedia di Gudang;
- rekomendasi: pindahkan qty dari warehouse on-hand ke inventory in-transit secara atomik, atau reserve dengan mekanisme eksplisit.

Saat Petugas Receive:
- transit berkurang;
- Booth on-hand bertambah qty_received;
- movement `WAREHOUSE_TO_BOOTH` posted.

Implementasi harus memilih satu model inventory-in-transit dan konsisten. Untuk MVP direkomendasikan **deduct Gudang saat SENT**, lalu add Booth saat RECEIVED**, dengan record in-transit sebagai derived outstanding distribution. Jika shipment dibatalkan, buat reversal transaction.

## BR-004 — Sale
Sale hanya bisa dibuat jika:
- shift `OPEN`;
- Petugas authorized untuk Booth/shift;
- setiap product aktif;
- qty stock Booth cukup;
- total server-side valid.

Saat sale paid:
- stock Booth dikurangi;
- movement `SALE` dibuat per product;
- sale dan payment posted.

## BR-005 — Harga
Harga yang dipakai adalah price master saat server menerima transaksi, lalu disimpan ke `sale_items.unit_price`.

Client tidak boleh menentukan harga final.

## BR-006 — Payment V1
Metode: `CASH` atau `QRIS`.

V1 menganggap payment langsung lunas saat Petugas confirm. Integrasi payment gateway QRIS belum termasuk; QRIS adalah metode pencatatan kecuali requirement baru ditambahkan.

## BR-007 — Low-stock status
Per product per Booth:
- `HABIS` jika qty <= 0.
- `KRITIS` jika 0 < qty <= critical_qty.
- `MENIPIS` jika critical_qty < qty <= minimum_qty.
- `AMAN` jika qty > minimum_qty.

Jika critical_qty tidak diisi, dapat default sama dengan floor(minimum_qty/2), tetapi lebih baik seed explicit.

## BR-008 — Restock request
Petugas dapat request produk walau belum menyentuh threshold, tetapi UI memprioritaskan low stock.

Satu request aktif per Booth/product disarankan untuk mencegah spam. Bila sudah ada request status REQUESTED/APPROVED/PREPARED/SENT, UI memperlihatkan status dan tidak membuat duplicate kecuali Admin cancel.

## BR-009 — Restock fulfillment
Admin approved qty tidak boleh melebihi warehouse available.

Saat SENT, stok Gudang keluar/menjadi in-transit.
Saat RECEIVED, stok Booth masuk.

## BR-010 — Closing expected stock
Expected stock per produk pada closing adalah current system Booth stock saat closing dimulai, karena semua distribution/restock/sale sudah tercermin pada balance.

Untuk audit, laporan dapat juga menghitung:

```text
Opening/Received
+ Restock Received
- Sale Paid
+/- Adjustment
= Expected Stock
```

## BR-011 — Actual count
Petugas memasukkan jumlah fisik per produk.

```text
Discrepancy = Actual - Expected
```

- negatif = kehilangan/kurang;
- positif = kelebihan/unrecorded stock.

Jika discrepancy != 0, reason wajib.

## BR-012 — Discrepancy tidak boleh diam-diam mengubah ledger
Saat closing confirm, jika actual berbeda dari expected, sistem harus membuat adjustment yang jelas atau memisahkan discrepancy pending Admin review.

Rekomendasi MVP:
- record count dan discrepancy;
- sesuaikan Booth balance ke actual dengan movement `ADJUSTMENT` yang reference ke closing count;
- reason/audit wajib;
- Owner/Admin dapat melihat nilai selisih.

Dengan demikian return memakai actual physical stock.

## BR-013 — Return
Return qty default = actual stock setelah closing.

Saat Petugas submit, stok tersebut tidak boleh dijual lagi.
Saat Admin menerima, warehouse bertambah actual received.
Jika actual received berbeda dari submitted, discrepancy return dibuat dan reason wajib.

## BR-014 — Shift close lock
Setelah shift status `CLOSED`, tidak boleh ada sale baru pada shift itu.

Admin override hanya melalui audited correction flow, bukan mengubah status manual tanpa log.

## BR-015 — Shift time configurable
Jangan hardcode jam 08.00/16.30 atau 15.00/22.00. Gunakan master shift/session.

## BR-016 — Active Booth/Product
Inactive master tidak boleh dipakai transaksi baru, tetapi histori tetap tampil.

## BR-017 — Idempotency
Mutation kritis menerima `idempotency_key` client-generated UUID.

Jika request diulang dengan key sama, backend mengembalikan hasil awal, bukan memproses dua kali.

## BR-018 — Receipt
Nomor sale unik. Reprint tidak membuat sale baru.

## BR-019 — Void/Reversal
Jika penjualan sudah paid perlu dibatalkan:
- hanya Admin atau permission khusus;
- status `VOIDED`;
- buat stock reversal movement;
- simpan reason;
- jangan delete row.

## BR-020 — KPI omzet
Omzet = SUM(total) sale status PAID pada period lokal, exclude VOIDED.

## BR-021 — Cup sold
Cup sold = SUM(sale_items.qty) hanya sale PAID, exclude VOIDED.

## BR-022 — Estimated discrepancy value
Gunakan harga jual snapshot/master sesuai keputusan bisnis. Untuk V1 gunakan **current sell price master** untuk estimasi dashboard, diberi label “estimasi”; audit qty tetap sumber utama.

## BR-023 — Alert materiality
Owner dashboard tidak perlu menampilkan semua low-stock. Prioritaskan:
1. stock HABIS/KRITIS;
2. discrepancy;
3. Booth inactive/unexpected;
4. omzet jauh di bawah baseline bila fitur analytics aktif.

## BR-024 — Universal correction rule
Transaksi posted tidak boleh hard-delete atau field material-nya diubah langsung. Cancel = reversal. Revision = reversal + replacement dalam satu transaction atomik.

## BR-025 — Revision lineage
Setiap revisi harus dapat ditelusuri original → revision versions → effective version. Original history tidak hilang.

## BR-026 — Impact preview
Admin correction harus divalidasi server dan memiliki impact preview: stock, omzet, cup sold, payment, shift, closing discrepancy, return, dan reconciliation status.

## BR-027 — Post-close correction
Correction setelah shift CLOSED diperbolehkan Admin dengan reason. Shift aggregate dan expected closing direcalculate; actual physical count lama tidak diubah.

## BR-028 — Recount
Confirmed physical count tidak diedit. Salah count/input diperbaiki dengan recount version dan compensating adjustment.

## BR-029 — Stock opname
Opname membandingkan expected vs actual dan memposting adjustment delta. Opname tidak mengubah histori sale.

## BR-030 — Adjustment reversal
Posted stock adjustment immutable. Jika salah, reverse movement lama lalu post adjustment benar.

## BR-031 — Payment correction
Perubahan CASH↔QRIS tidak mempengaruhi stock/omzet, hanya payment channel aggregate. Sale amount correction harus melalui sale revision.

## BR-032 — Historical reconciliation
Correction historis wajib recalculation dependent aggregates dan stock projection. Jika chain menjadi impossible/negative, buat `RECONCILIATION_REQUIRED`; jangan menciptakan stock fiktif.

## BR-033 — Effective reporting
Dashboard/report harus membaca effective/net transaction versions, bukan menjumlah row original + replacement + reversal tanpa filter.

## BR-034 — Projection integrity
Setelah mutation/correction, balance snapshot harus sama dengan ledger projection. Sediakan reconciliation check/rebuild process.

## BR-035 — Correction reason
Semua correction posted reason wajib; `OTHER` mewajibkan note.

Detail normatif per jenis transaksi ada di `24-data-consistency-correction-reversal.md`.

## BR-036 — Void != Sales Return
Void berarti transaksi awal tidak seharusnya ada. Sales Return/Refund berarti transaksi awal valid lalu terjadi event refund/return. Jangan menggunakan VOID untuk event refund nyata. Refund hanya menambah stock jika barang fisik benar-benar kembali dan business rule menyatakan stock reusable.
