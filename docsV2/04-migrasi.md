# 04 — Dampak ke Kode yang Ada & Urutan Migrasi

---

## 1. Yang tersentuh

Tujuh service saat ini memanggil `prisma.stockMovement.create()` langsung. Semuanya
harus dialihkan ke `StockLedgerService.write()`.

| File | Sekarang | Jadi |
|---|---|---|
| `warehouse-stock.service.ts` | `ADJUSTMENT` target-qty | Tetap ada, tapi **hanya untuk koreksi**. Penambahan stok dari supplier pindah ke dok 01 |
| `distributions.service.ts` | `WAREHOUSE_TO_BOOTH`, `VOID_REVERSAL` | `PENYERAHAN` / `RESTOK` (dipilih dari `restockRequestId`) + `TERIMA_PENYERAHAN` / `TERIMA_RESTOK` / `REVERSAL` |
| `restock-requests.service.ts` | delegasi ke distributions | Tetap delegasi, tapi mengisi `restockRequestId` supaya mutasinya tercatat sebagai `RESTOK` |
| `sales.service.ts` | `SALE` | `PENJUALAN`, `qtyChange` negatif |
| `shifts.service.ts` | `ADJUSTMENT` saat closing | `KOREKSI` |
| `returns.service.ts` | `RETURN_TO_WAREHOUSE` | `PENGEMBALIAN` (booth) + `TERIMA_PENGEMBALIAN` (gudang) |
| `stock-opname.service.ts` | `ADJUSTMENT` | `OPNAME` |
| `stock-adjustments.service.ts` | `ADJUSTMENT`, `VOID_REVERSAL` | `KOREKSI` / `REVERSAL` |
| `shifts.service.ts` | membuka/menutup shift | Tambah invarian saldo-0 & status `MENUNGGU_PENGEMBALIAN` (dok 07 §4) |
| — | belum ada | **`stock-damages`** — jalur Stok Rusak (dok 05 §4) |
| — | belum ada | **`stock-alerts`** — early warning stok menipis (dok 06 §7) |
| — | belum ada | **`warehouses`** — master gudang (dok 06 §5) |

**Perubahan terbesar: `BoothStock` → `ShiftStock`.** Saldo lapangan tidak lagi melekat ke
booth tapi ke shift (dok 07 §2). Ini menyentuh semua yang membaca stok booth: `catalog`,
`dashboard`, `owner`, `notifications`, `booth-stock`, dan layar Jual di `booth_flutter`.
Dikerjakan di Tahap 1 karena seluruh backfill ledger bergantung padanya — menundanya
berarti membangun ulang backfill dua kali.

Guard `qtyOnHand: { gte: qty }` yang saat ini diulang di tiap service **dihapus dari
sana** dan digantikan oleh guard tunggal di `StockLedgerService.write()`. Jangan
dibiarkan ada di dua tempat — dua guard dengan pesan error berbeda untuk kondisi yang
sama hanya bikin bingung saat debugging.

### Enum yang mati

`StockMovementType.OPENING` dan `.RESTOCK` tidak pernah dipakai kode mana pun hari ini.
Keduanya tidak dibawa ke `StockMutationType`. Kalau ada laporan atau query yang
memfilter berdasarkan dua nilai itu, hasilnya memang selalu kosong sejak dulu.

---

## 2. Urutan migrasi

Dikerjakan bertahap, tiap tahap punya migrasi Prisma sendiri dan bisa di-deploy terpisah.

### Tahap 1 — Ledger baru, tulis ganda

0. Migrasi `ShiftStock`: buat tabel, pindahkan saldo `BoothStock` yang ada ke shift
   `OPEN` terakhir tiap booth (kalau tidak ada shift terbuka, buat satu shift sintetis
   bertanda `isMigrationHolder` supaya saldonya tidak menggantung tanpa pemilik).
   Ubah pembaca stok booth jadi agregasi atas shift `OPEN`.
1. Migrasi: buat `mutasi_stok`, `rekap_stok`, enum `StockLocationType` &
   `StockMutationType`. `stock_movements` **tidak** disentuh.
2. Buat `StockLedgerService` + `StockRecapService`.
3. Backfill `mutasi_stok` dari `stock_movements`:

```sql
INSERT INTO mutasi_stok (
  id, mutation_no, product_id, location_type, location_id, mutation_type,
  qty_change, qty_before, qty_after, ref_doc_type, ref_doc_id,
  mutation_date, shift_session_id, actor_id, note, created_at
)
SELECT
  m.id,
  m.movement_no,
  m.product_id,
  CASE WHEN COALESCE(m.from_booth_id, m.to_booth_id) IS NULL
       THEN 'WAREHOUSE' ELSE 'BOOTH' END,
  COALESCE(m.from_booth_id, m.to_booth_id, :warehouse_pusat_id),
  CASE m.movement_type
    WHEN 'WAREHOUSE_TO_BOOTH'   THEN 'DISTRIBUSI'
    WHEN 'SALE'                 THEN 'PENJUALAN'
    WHEN 'RETURN_TO_WAREHOUSE'  THEN 'TERIMA_RETUR'
    WHEN 'VOID_REVERSAL'        THEN 'REVERSAL'
    ELSE 'KOREKSI'
  END,
  -- arah disimpulkan sekali di sini, lalu tidak pernah perlu disimpulkan lagi
  CASE WHEN m.from_booth_id IS NOT NULL
         OR m.movement_type = 'WAREHOUSE_TO_BOOTH'
       THEN -m.qty ELSE m.qty END,
  0, 0,                                   -- diisi oleh langkah rebuild
  m.reference_type, m.reference_id,
  m.business_date, m.shift_session_id, m.created_by, m.note, m.occurred_at
FROM stock_movements m;
```

4. Jalankan `stock:rebuild-chain` untuk mengisi `qty_before`/`qty_after` berurutan
   per produk × lokasi berdasarkan `mutation_date`, lalu `stock:rebuild-recap`.
5. **Verifikasi wajib sebelum lanjut**: `npm run stock:reconcile` harus melaporkan 0
   selisih terhadap `WarehouseStock`/`BoothStock` yang ada sekarang. Kalau ada selisih,
   itu berarti ledger lama memang sudah tidak konsisten — selesaikan dulu, jangan
   dibawa ke skema baru.

> Catatan backfill: `qty_before`/`qty_after` hasil rebuild **tidak** merekonstruksi
> keadaan historis yang sebenarnya, karena data lama tidak menyimpannya. Yang dijamin
> hanyalah rantainya konsisten dan saldo akhirnya benar. Ini keterbatasan yang harus
> disampaikan ke pengguna kalau mereka membaca kartu stok periode sebelum migrasi.

### Tahap 2 — Alihkan penulisan

6. Ubah tujuh service di bagian 1 agar memanggil `StockLedgerService.write()`.
   Sementara ini `write()` **juga** masih menulis `stock_movements` (dual-write) supaya
   laporan lama tidak mati.
7. Jalankan seluruh e2e yang ada. `test/correction-flows.e2e-spec.ts` adalah yang paling
   penting — ia menguji jalur reversal yang paling mudah rusak.

### Tahap 3 — Master gudang

8. Migrasi `warehouses`, isi satu baris `GD-PUSAT` (`isDefault = true`), backfill
   seluruh `location_id` bertipe `WAREHOUSE` ke ID tersebut.
9. Tambah `warehouseId` di `StockReceipt` dan `sourceWarehouseId` di
   `StockDistribution`.
10. Layar `/gudang` (daftar + riwayat masuk/keluar).

### Tahap 4 — Penerimaan stok

11. Migrasi: `suppliers`, `stock_receipts`, `stock_receipt_items`.
12. Modul `stock-receipts` + master supplier.
13. Layar `/stok/penerimaan` (daftar, form, detail).
14. `POST /warehouse-stock/adjust` diberi label "khusus koreksi" di UI, dan wajib
    mengisi alasan.

### Tahap 5 — Stok rusak

15. Migrasi: `stock_damages`, `stock_damage_items`, enum `DamageReason` &
    `StockDamageStatus`.
16. Modul `stock-damages` + layar Admin (daftar, persetujuan) dan layar petugas booth
    (lapor kerusakan, dengan foto opsional).

### Tahap 6 — Baca & tampilkan

17. Modul `stock-mutations` (endpoint riwayat + kartu stok).
18. Tab Riwayat di `/stok/gudang`, `/stok/booth`, `/booth/[id]`, `/petugas/[id]`.
19. Halaman `/stok/riwayat` (lintas lokasi) dan `/laporan/rekap-stok`.
20. `ProductPriceHistory` + riwayat perubahan harga di `/master/produk`.

### Tahap 7 — Early warning

21. Gabungkan `BoothStockThreshold` menjadi `StockThreshold` ber-`location_type`,
    backfill baris booth yang ada, tambah baris untuk gudang.
22. Migrasi `stock_alerts`; pasang evaluasi ambang di `StockLedgerService.write()`.
23. Panel "Perlu Tindakan" di dashboard Admin + banner Minta Restok di layar Jual.
24. Escalation & push notification, intervalnya dari config.

### Tahap 8 — Bersih-bersih

25. Hentikan dual-write. `stock_movements` jadi read-only.
26. Setelah satu periode berjalan penuh tanpa selisih di rekonsiliasi harian, drop
    `stock_movements` dan `StockMovementType` di migrasi terpisah.

---

## 3. Pertanyaan yang perlu diputuskan sebelum mulai

1. ~~**ID gudang pusat.**~~ **Terjawab** — poin "Daftar Gudang" di dok 06 §5
   mengonfirmasi master `Warehouse` dibutuhkan. Masuk Tahap 3.
2. **Harga beli.** Apakah `purchasePrice` dipakai untuk menghitung nilai persediaan
   (HPP)? Kalau ya, perlu diputuskan metodenya (rata-rata bergerak / FIFO) dan itu
   dokumen tersendiri. Kalau belum, kolomnya tetap disimpan tapi hanya tampil di detail
   dokumen.
3. **Supplier.** Perlu master penuh (alamat, telepon, riwayat pembelian) atau cukup teks
   bebas di dokumen? Spec dok 01 menyiapkan keduanya.
4. **Retensi.** `mutasi_stok` tumbuh terus. Perlu partisi per tahun sejak awal, atau
   ditunda sampai volumenya terbukti jadi masalah? Untuk skala booth kopi, penundaan
   masuk akal — tapi index-nya sudah dirancang supaya partisi mudah ditambahkan.
5. **Persetujuan stok rusak.** Dok 05 §4 mengasumsikan laporan kerusakan dari petugas
   booth wajib disetujui Admin sebelum stok berkurang. Kalau di lapangan itu terlalu
   lambat (petugas menunggu persetujuan sementara saldo di layar masih salah),
   alternatifnya: stok langsung berkurang saat dilaporkan, dan Admin meninjau
   belakangan dengan hak membatalkan. Perlu diputuskan sebelum Tahap 5.
6. **Closing shift & opname.** Keduanya tidak ada di daftar pergerakan stok yang Anda
   berikan tapi ada di kode sekarang. Dok 05 §6 mempertahankan keduanya sebagai
   `KOREKSI` dan `OPNAME`. Konfirmasi kalau maksudnya memang dihapus — konsekuensinya
   selisih hitung fisik tidak punya tempat mendarat.
7. ~~**Pengembalian dari booth.**~~ **Terjawab** — dok 07 mencantumkannya sebagai
   transaksi Booth nomor 4.
8. **Serah terima langsung antar shift.** Dok 07 §6. Apakah Shift 1 boleh menyerahkan
   sisa stok langsung ke Shift 2 di booth tanpa lewat gudang? Rekomendasi: sediakan
   jalurnya, karena praktiknya akan terjadi juga dan lebih baik tercatat apa adanya
   daripada disamarkan sebagai pengembalian fiktif. **Perlu keputusan sebelum Tahap 1**,
   karena memengaruhi invarian penutupan shift.
