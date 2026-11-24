# 06 — Data Operasional & Early Warning

Lima poin data yang harus bisa dibuka, dan peringatan dini stok menipis.

---

## 1. Prinsip

Kelima poin di bawah adalah **lima cara memotong satu kumpulan data yang sama**, bukan
lima kumpulan data terpisah. Riwayat stok di halaman Booth, di halaman Petugas, dan di
halaman Gudang semuanya membaca `mutasi_stok` dengan filter berbeda.

Konsekuensinya: angka di kelima halaman itu **mustahil berselisih**, karena sumbernya
satu. Kalau di kemudian hari ada yang berselisih, itu berarti ada halaman yang
diam-diam mengambil jalan pintas — dan itu bug, bukan perbedaan sudut pandang.

| Poin data | Sumber utama | Filter |
|---|---|---|
| Stok | `mutasi_stok` + `rekap_stok` | per produk |
| Booth | `mutasi_stok` + `sales` | `location_id = booth` |
| Petugas | `mutasi_stok` + `sales` | `shift_session_id` milik petugas |
| Gudang | `mutasi_stok` | `location_type = WAREHOUSE` |
| Penjualan | `sales` | per booth / periode |

---

## 2. Stok

Rute `/stok`.

| Sub | Rute | Isi | Status |
|---|---|---|---|
| **Daftar Stok** | `/stok/produk` | Semua produk × saldo gudang × saldo tiap booth × total. Badge status Aman/Menipis/Kritis/Habis | Sebagian ada |
| **Riwayat Stok Masuk/Keluar** | `/stok/riwayat` | Seluruh mutasi lintas lokasi. Filter produk, lokasi, jenis, periode | **Belum ada** |
| **Stok di Gudang** | `/stok/gudang` | Saldo per produk + tab Riwayat | Saldo ada, riwayat belum |
| **Stok di Booth** | `/stok/booth` | Saldo per booth × produk + tab Riwayat | Saldo ada, riwayat belum |
| **Setting Harga Jual** | `/master/produk` | Ubah `sellPrice` per produk | **Sudah ada** |

### Daftar Stok

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Daftar Stok                                           [Ekspor] [Rekap Bulan] │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Cari produk…]  [Kategori ▾]  [Status ▾]                                     │
├──────────┬───────────────┬─────────┬─────────┬─────────┬───────┬─────────────┤
│ SKU      │ Produk        │  Gudang │ Sudirman│ Gejayan │ Total │ Status      │
├──────────┼───────────────┼─────────┼─────────┼─────────┼───────┼─────────────┤
│ KOPI-001 │ Es Kopi Susu  │     370 │      42 │      18 │   430 │ ● Aman      │
│ KOPI-002 │ Kopi Hitam    │     120 │       8 │      24 │   152 │ ▲ Menipis   │
│ SUSU-001 │ Susu UHT 1L   │      12 │       3 │       0 │    15 │ ✕ Kritis    │
└──────────┴───────────────┴─────────┴─────────┴─────────┴───────┴─────────────┘
```

Status dihitung dengan `resolveStockStatus()` yang sudah ada di
`src/common/stock-status.ts`, dibandingkan ke `BoothStockThreshold` per booth×produk.
Kolom Gudang memakai threshold gudang tersendiri (lihat bagian 7).

Klik sel angka → kartu stok produk × lokasi itu.

### Setting Harga Jual

Sudah berjalan lewat `PATCH /products/:id`. Yang perlu ditambah hanyalah **riwayat
perubahan harga** — saat ini harga lama hilang begitu di-update.

```prisma
model ProductPriceHistory {
  id         String   @id @default(uuid())
  productId  String   @map("product_id")
  product    Product  @relation(fields: [productId], references: [id])
  oldPrice   BigInt   @map("old_price")
  newPrice   BigInt   @map("new_price")
  effectiveAt DateTime @map("effective_at")
  changedById String  @map("changed_by_id")
  reason     String?
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([productId, effectiveAt])
  @@map("product_price_history")
}
```

Ini tidak mengubah omzet histori — `SaleItem.unitPrice` sudah menyimpan snapshot harga
saat transaksi, jadi penjualan lama tetap memakai harga lamanya.

---

## 3. Booth

Rute `/booth`.

| Sub | Isi |
|---|---|
| **Daftar Booth** | Nama, lokasi, status aktif, petugas yang sedang bertugas, shift berjalan, total stok, omzet hari ini |
| **Riwayat Penjualan** | Semua `sale` di booth itu. Filter periode, shift, petugas, metode bayar. Klik → detail item |
| **Riwayat Stok** | `mutasi_stok` dengan `location_type = BOOTH` dan `location_id` = booth itu |

```
┌── Booth Sudirman ────────────────────────────────────────────────────────────┐
│ Status: Aktif · Shift Pagi (07.00–15.00) · Petugas: Rina                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  Stok Saat Ini │ Riwayat Penjualan │ ▸ Riwayat Stok │ Shift & Closing        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Periode ▾] [Produk ▾] [Jenis ▾]                                   [Ekspor]  │
├───────────┬────────────────────┬───────────────┬──────┬────────┬─────────────┤
│ Tanggal   │ Jenis              │ Dokumen       │ Masuk│ Keluar │ Saldo       │
├───────────┼────────────────────┼───────────────┼──────┼────────┼─────────────┤
│ 22 Sep 26 │ Terima Penyerahan  │ DIST-…B33A    │   50 │      − │          50 │
│ 22 Sep 26 │ Penjualan          │ OBL-…C12D     │    − │      3 │          47 │
│ 22 Sep 26 │ Stok Rusak         │ RSK-…E09F     │    − │      2 │          45 │
│ 22 Sep 26 │ Terima Restok      │ DIST-…F41B    │   20 │      − │          65 │
└───────────┴────────────────────┴───────────────┴──────┴────────┴─────────────┘
```

---

## 4. Petugas

Rute `/master/user` (daftar) + `/petugas/[id]` (detail).

| Sub | Isi |
|---|---|
| **Daftar Petugas** | Nama, role, booth yang ditugaskan, status aktif, shift terakhir |
| **Riwayat Penjualan** | Semua `sale` dengan `staffId` = petugas itu. Total omzet, jumlah transaksi, rata-rata per transaksi |
| **Riwayat Stok saat bertugas** | `mutasi_stok` dengan `shift_session_id` ∈ shift milik petugas itu |

Kolom `shift_session_id` di `mutasi_stok` yang membuat poin ketiga mungkin — tanpa itu,
tidak ada cara menghubungkan pergerakan stok ke orang yang sedang bertanggung jawab.
**Semua** mutasi yang terjadi di booth wajib mengisinya, termasuk stok rusak dan
penerimaan penyerahan, bukan hanya penjualan.

### Rekap per shift

Ditampilkan di detail petugas dan di detail closing shift:

| Metrik | Perhitungan |
|---|---|
| Stok diterima | Σ `TERIMA_PENYERAHAN` + `TERIMA_RESTOK` di shift itu |
| Terjual | Σ `PENJUALAN` |
| Rusak | Σ `KERUSAKAN` |
| Dikembalikan | Σ `PENGEMBALIAN` |
| Selisih closing | Σ `KOREKSI` dari closing |
| Omzet | Σ `sale.total` berstatus `PAID` |

Baris "Selisih closing" adalah yang paling perlu diperhatikan: kalau satu petugas
konsisten punya selisih, itu sinyal untuk ditindaklanjuti — entah masalah pencatatan,
pelatihan, atau hal lain.

---

## 5. Gudang

Rute `/gudang`.

| Sub | Isi |
|---|---|
| **Daftar Gudang** | Nama, alamat, penanggung jawab, status aktif, total stok |
| **Riwayat Stok Masuk/Keluar** | `mutasi_stok` dengan `location_type = WAREHOUSE`, dipecah kolom Masuk/Keluar |

Poin "Daftar Gudang" mengonfirmasi bahwa **master `Warehouse` memang dibutuhkan** — ini
menjawab pertanyaan terbuka nomor 1 di [04-migrasi.md](04-migrasi.md).

```prisma
model Warehouse {
  id        String   @id @default(uuid())
  code      String   @unique
  name      String
  address   String?
  picUserId String?  @map("pic_user_id")
  pic       Profile? @relation(fields: [picUserId], references: [id])
  active    Boolean  @default(true)
  isDefault Boolean  @default(false) @map("is_default")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  receipts StockReceipt[]

  @@map("warehouses")
}
```

Migrasi awal membuat satu baris `GD-PUSAT` dengan `isDefault = true`, dan seluruh
mutasi gudang yang sudah ada di-backfill ke ID tersebut. Karena `mutasi_stok` sejak awal
memakai `location_type` + `location_id`, gudang kedua bisa ditambahkan nanti tanpa
migrasi skema lagi.

Konsekuensi yang ikut berubah: `StockReceipt` (dok 01) mendapat kolom `warehouseId`
wajib, dan `StockDistribution` mendapat `sourceWarehouseId` — supaya jelas stok
diserahkan ke booth dari gudang mana.

---

## 6. Penjualan

Rute `/penjualan`. Sebagian sudah ada.

| Sub | Isi |
|---|---|
| **Riwayat Penjualan per Booth** | Daftar `sale` dikelompokkan per booth. Filter periode, shift, petugas, metode bayar, status |
| Ringkasan per booth | Jumlah transaksi, cup terjual, omzet, rata-rata per transaksi, produk terlaris |
| Detail transaksi | Item, harga satuan saat transaksi, total, pembayaran, riwayat revisi kalau ada |

Yang perlu ditambahkan: kolom **Petugas** dan **Shift** di tabel daftar, serta
kemampuan grouping per booth (saat ini daftarnya datar).

---

## 7. Early Warning — Stok Menipis

Dua jalur menuju satu tujuan yang sama. Keduanya harus ada, karena masing-masing menutup
kelemahan yang lain: jalur otomatis tidak tahu bahwa hari ini ada rombongan besar,
sedangkan jalur manual bergantung petugas sempat membuka aplikasi.

```
        ┌──────────────────────────────────────────────┐
        │  Setiap penjualan menulis mutasi_stok        │
        │  → saldo booth turun                         │
        └───────────────────┬──────────────────────────┘
                            │
                  saldo ≤ threshold?
                            │
              ┌─────────────┴──────────────┐
              │                            │
              ▼                            ▼
   ┌────────────────────┐      ┌───────────────────────┐
   │ JALUR A — Otomatis │      │ JALUR B — Manual      │
   │ Sistem membuat     │      │ Petugas menekan       │
   │ StockAlert         │      │ "Minta Restok"        │
   │ → Admin melihat    │      │ → RestockRequest      │
   └─────────┬──────────┘      └───────────┬───────────┘
             │                             │
             └──────────────┬──────────────┘
                            ▼
              ┌──────────────────────────────┐
              │ Admin: Kirim Restok          │
              │ → StockDistribution          │
              │   ber-restockRequestId       │
              │ → mutasi RESTOK              │
              └──────────────────────────────┘
```

### Jalur A — sistem memberitahu Admin

Dievaluasi **di dalam transaksi yang sama** dengan mutasi yang menurunkan stok. Bukan
lewat cron: peringatan yang datang 5 menit setelah stok habis sudah terlambat untuk
booth yang sedang ramai.

```prisma
enum StockAlertLevel {
  MENIPIS    // qty ≤ minimumQty
  KRITIS     // qty ≤ criticalQty
  HABIS      // qty = 0

  @@map("stock_alert_level")
}

enum StockAlertStatus {
  AKTIF          // masih menipis, belum ditindaklanjuti
  DITINDAKLANJUTI // restok sudah dikirim
  SELESAI        // stok sudah kembali di atas ambang
  DIABAIKAN      // Admin menutup manual, wajib isi alasan

  @@map("stock_alert_status")
}

/// Peringatan stok menipis. SATU baris aktif per (lokasi × produk) — kalau levelnya
/// berubah (MENIPIS → KRITIS), baris yang sama di-update, bukan dibuat baru.
/// Tanpa aturan itu, satu booth yang ramai bisa menghasilkan puluhan notifikasi
/// untuk produk yang sama dalam sejam dan Admin akan berhenti membacanya.
model StockAlert {
  id           String            @id @default(uuid())
  locationType StockLocationType @map("location_type")
  locationId   String            @map("location_id")
  productId    String            @map("product_id")
  product      Product           @relation(fields: [productId], references: [id])
  level        StockAlertLevel
  status       StockAlertStatus  @default(AKTIF)
  qtyAtTrigger Int               @map("qty_at_trigger")
  thresholdQty Int               @map("threshold_qty")
  triggeredAt  DateTime          @default(now()) @map("triggered_at")
  escalatedAt  DateTime?         @map("escalated_at")
  resolvedAt   DateTime?         @map("resolved_at")
  restockRequestId String?       @map("restock_request_id")
  distributionId   String?       @map("distribution_id")
  closedById   String?           @map("closed_by_id")
  closeReason  String?           @map("close_reason")

  @@unique([locationType, locationId, productId, status])
  @@index([status, level])
  @@map("stock_alerts")
}
```

Logika di `StockLedgerService.write()`, setelah saldo diketahui:

```ts
if (input.qtyChange < 0) {
  const ambang = await this.threshold.resolve(tx, locationType, locationId, productId);
  const level = resolveStockStatus(qtyAfter, ambang.minimumQty, ambang.criticalQty);

  if (level !== 'Aman') {
    // upsert — bukan create. Satu baris aktif per sel, level-nya di-update
    // kalau memburuk. Notifikasi hanya dikirim saat level BERUBAH.
    await this.alerts.upsertAktif(tx, { locationType, locationId, productId,
                                        level, qtyAtTrigger: qtyAfter, ambang });
  } else {
    // stok sudah kembali di atas ambang → tutup alert yang masih aktif
    await this.alerts.selesaikan(tx, { locationType, locationId, productId });
  }
}
```

**Threshold gudang.** `BoothStockThreshold` yang ada sekarang hanya mencakup booth.
Gudang butuh ambangnya sendiri — tabel `WarehouseStockThreshold` dengan bentuk sama
(`warehouseId` + `productId` + `minimumQty` + `criticalQty`), atau satu tabel gabungan
`StockThreshold` ber-`location_type`. Rekomendasi: **gabungkan**, supaya
`threshold.resolve()` punya satu jalur, bukan dua cabang.

### Jalur B — petugas mengajukan

Sudah ada (`restock-requests`). Yang ditambahkan:

- Layar Jual menampilkan banner kalau ada produk berstatus Menipis/Kritis, dengan tombol
  **Minta Restok** yang langsung terisi produk dan qty saran.
- Qty saran = `minimumQty × 2 − qtyOnHand`, dibulatkan ke kelipatan 5, dan tetap bisa
  diubah petugas.
- Kalau sudah ada `RestockRequest` berstatus `REQUESTED` untuk produk yang sama di shift
  itu, tombolnya berubah jadi "Restok sedang diproses" — cegah pengajuan ganda.
- Saat request dibuat, `StockAlert` aktif untuk produk itu di-link ke request-nya dan
  statusnya jadi `DITINDAKLANJUTI`, supaya Admin tidak mengerjakan hal yang sama dua kali.

### Tampilan Admin

Panel di dashboard, urut paling mendesak di atas:

```
┌── Perlu Tindakan ───────────────────────────────────── 5 peringatan ─────────┐
│ ✕ HABIS    Susu UHT 1L    · Booth Gejayan   · 0 cup   · 12 mnt  [Kirim Restok]│
│ ✕ KRITIS   Es Kopi Susu   · Booth Sudirman  · 8 cup   · 5 mnt   [Kirim Restok]│
│ ▲ MENIPIS  Kopi Hitam     · Booth Gejayan   · 22 cup  · 31 mnt  [Kirim Restok]│
│ ▲ MENIPIS  Es Kopi Susu   · Gudang Pusat    · 45 cup  · 2 jam   [Buat PO]     │
│ ⏱ DIAJUKAN Susu UHT 1L    · Booth Sudirman  · minta 20 cup      [Proses]      │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Kirim Restok** membuka form distribusi yang sudah terisi booth, produk, dan qty
  saran — sekali klik dari peringatan ke pengiriman.
- Baris berstatus `DIAJUKAN` berasal dari jalur B, ditampilkan di panel yang sama supaya
  Admin tidak perlu memantau dua tempat.
- Escalation: peringatan `KRITIS`/`HABIS` yang belum ditindaklanjuti lewat X menit
  (nilainya dari config, bukan hardcode) mengisi `escalatedAt` dan mengirim push ke
  Admin, serta muncul di dashboard Owner.

### Endpoint

| Method | Path | Guna |
|---|---|---|
| `GET` | `/stock-alerts` | Daftar. Filter `status`, `level`, `locationType`, `locationId` |
| `GET` | `/stock-alerts/summary` | Hitungan per level, untuk badge di navigasi |
| `PATCH` | `/stock-alerts/:id/abaikan` | Tutup manual, `closeReason` wajib |

---

## 8. Kriteria penerimaan

- [ ] Riwayat stok di halaman Booth, Petugas, dan Gudang untuk rentang yang sama
      menghasilkan angka yang identik — ketiganya membaca `mutasi_stok`.
- [ ] Setiap mutasi yang terjadi di booth punya `shift_session_id` terisi, termasuk
      stok rusak dan penerimaan penyerahan.
- [ ] Penjualan yang menurunkan stok ke bawah ambang langsung membuat `StockAlert`
      dalam transaksi yang sama — tidak menunggu cron.
- [ ] Penjualan berikutnya atas produk yang sama **tidak** membuat alert baru; baris
      yang ada di-update dan notifikasi hanya terkirim saat level berubah.
- [ ] Restok diterima → stok kembali di atas ambang → alert otomatis berstatus `SELESAI`
      tanpa campur tangan Admin.
- [ ] Petugas tidak bisa mengajukan restok kedua untuk produk yang requestnya masih
      `REQUESTED` di shift yang sama.
- [ ] Ambang stok gudang dan booth dua-duanya berasal dari master, tidak ada angka
      yang ditulis di kode selain fallback yang sudah didokumentasikan.
