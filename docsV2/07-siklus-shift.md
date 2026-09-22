# 07 — Siklus Shift & Kepemilikan Stok

Satu booth dijalankan dua petugas bergantian dalam sehari. Tiap petugas menjalani siklus
yang sama dan utuh: **Terima Stok → Jualan → Pengembalian Stok**.

Dokumen ini menetapkan konsekuensi model datanya, dan **mengubah keputusan lokasi stok**
yang ditulis di dok 02 & 05.

---

## 1. Daftar transaksi

### Kantor Pusat (Gudang)

| # | Transaksi | Jenis mutasi | Lokasi | Tanda |
|---|---|---|---|---|
| 1 | Terima Stok ke Gudang | `PENERIMAAN` | Gudang | `+` |
| 2 | Serah Stok ke Booth | `PENYERAHAN` | Gudang | `−` |
| 3 | Restok ke Booth | `RESTOK` | Gudang | `−` |
| 4 | Terima Stok dari Booth | `TERIMA_PENGEMBALIAN` | Gudang | `+` |

### Booth (Petugas)

| # | Transaksi | Jenis mutasi | Lokasi | Tanda |
|---|---|---|---|---|
| 1 | Terima Stok dari Gudang | `TERIMA_PENYERAHAN` | Shift | `+` |
| 2 | Penjualan | `PENJUALAN` | Shift | `−` |
| 3 | Restok (request) | `TERIMA_RESTOK` | Shift | `+` |
| 4 | Pengembalian Stok ke Gudang | `PENGEMBALIAN` | Shift | `−` |

### Pasangan

Setiap perpindahan menulis **dua** baris — satu di sisi yang melepas, satu di sisi yang
menerima. Tidak pernah satu baris saja.

| Perpindahan | Sisi gudang | Sisi shift | Jeda |
|---|---|---|---|
| Gudang → Booth (terjadwal) | Serah Stok ke Booth `−` | Terima Stok dari Gudang `+` | selama perjalanan |
| Gudang → Booth (restok) | Restok ke Booth `−` | Terima Restok `+` | selama perjalanan |
| Booth → Gudang | Terima Stok dari Booth `+` | Pengembalian Stok `−` | selama perjalanan |

Selisih waktu antara dua sisi itulah barang yang sedang dibawa di jalan. Bisa dihitung
kapan saja: `Σ PENYERAHAN` yang belum berpasangan `TERIMA_PENYERAHAN`.

---

## 2. Perubahan keputusan: stok dipegang shift, bukan booth

### Yang berubah

Dok 02 & 05 menulis `location_type ∈ {WAREHOUSE, BOOTH}` dengan `location_id = Booth.id`.
**Itu diganti:**

```prisma
enum StockLocationType {
  WAREHOUSE   // location_id = Warehouse.id
  SHIFT       // location_id = ShiftSession.id
}
```

### Alasan

Dengan aturan "tiap petugas menerima stok di awal dan mengembalikan semuanya di akhir",
stok tidak pernah menginap di booth. Yang ada adalah **stok yang sedang dipertanggung-
jawabkan seorang petugas selama shift-nya**.

Kalau saldo tetap dilekatkan ke booth, muncul tiga masalah yang tidak bisa diperbaiki
belakangan:

1. **Pertanggungjawaban kabur.** Saat Shift 1 belum selesai mengembalikan dan Shift 2
   sudah mulai menerima, kedua stok bercampur di satu angka. Kalau kemudian ada selisih,
   tidak ada cara menentukan itu tanggung jawab siapa.
2. **Serah terima tidak punya bentuk.** Momen paling rawan dalam sehari — pergantian
   petugas — tidak menghasilkan satu pun baris data.
3. **Saldo booth menyesatkan.** Angka "stok Booth Sudirman = 45" tidak punya arti di
   luar jam operasional, karena semestinya nol.

Dengan `SHIFT` sebagai lokasi, ketiganya hilang dengan sendirinya: saldo tiap shift
dibuka dari nol, ditutup ke nol, dan di antaranya seluruhnya milik satu orang.

### Stok Booth tetap bisa dilihat

"Stok di Booth" jadi **turunan**, bukan tabel:

```sql
-- stok yang ada di Booth Sudirman saat ini
SELECT s.product_id, SUM(s.qty_on_hand) AS qty
FROM shift_stocks s
JOIN shift_sessions ss ON ss.id = s.shift_session_id
WHERE ss.booth_id = :boothId
  AND ss.status  = 'OPEN'
GROUP BY s.product_id;
```

Kalau tidak ada shift yang terbuka, hasilnya kosong — dan itu memang benar: booth yang
tutup tidak memegang stok.

### Konsekuensi ke model

`BoothStock` diganti `ShiftStock`:

```prisma
/// Saldo stok yang dipegang satu shift. Proyeksi dari mutasi_stok, bukan sumber
/// kebenaran. Dibuka dari 0 saat shift mulai, wajib kembali 0 saat shift ditutup.
model ShiftStock {
  shiftSessionId String       @map("shift_session_id")
  shiftSession   ShiftSession @relation(fields: [shiftSessionId], references: [id])
  productId      String       @map("product_id")
  product        Product      @relation(fields: [productId], references: [id])
  qtyOnHand      Int          @default(0) @map("qty_on_hand")
  version        BigInt       @default(0)
  updatedAt      DateTime     @updatedAt @map("updated_at")

  @@id([shiftSessionId, productId])
  @@index([productId])
  @@map("shift_stocks")
}
```

`BoothStockThreshold` tetap **per booth × produk** — ambang stok adalah properti tempat
jualannya, bukan properti orang yang sedang bertugas. Saat mengevaluasi peringatan,
saldo shift yang sedang berjalan dibandingkan ke ambang booth tempat shift itu berjalan.

---

## 3. Siklus satu hari

```
06.30  ┌─ SHIFT 1 (Rina) ──────────────────────────────────────────────┐
       │                                                               │
       │  di GUDANG:  Serah Stok ke Booth        gudang −100           │
       │              Terima Stok dari Gudang    shift1 +100           │
       │                                                               │
07.00  │  BUKA ── jualan ── jualan ── jualan ──────────────────────    │
       │                                                               │
11.00  │  stok menipis → Restok               gudang −30, shift1 +30   │
       │                                                               │
       │  ── jualan ── jualan ──────────────────────────────────────   │
       │                                                               │
14.45  │  TUTUP SHIFT                                                  │
       │    1. hitung fisik      expected 38, aktual 36                │
       │    2. selisih 2 cup     alasan wajib → KOREKSI shift1 −2      │
       │    3. bawa sisa ke gudang                                     │
15.15  │    4. di GUDANG: Pengembalian Stok      shift1 −36            │
       │                  Terima Stok dari Booth gudang +36            │
       │                                                               │
       │  saldo shift1 = 0 ────────────────────────► SHIFT SELESAI     │
       └───────────────────────────────────────────────────────────────┘

15.00  ┌─ SHIFT 2 (Budi) ──────────────────────────────────────────────┐
       │  di GUDANG:  Serah Stok ke Booth        gudang −90            │
       │              Terima Stok dari Gudang    shift2 +90            │
       │  BUKA ── jualan ── ... ── TUTUP ── Pengembalian               │
       │  saldo shift2 = 0 ────────────────────────► SHIFT SELESAI     │
       └───────────────────────────────────────────────────────────────┘
```

Perhatikan jam 15.00–15.15: **Shift 2 sudah mulai sementara Shift 1 belum selesai
mengembalikan.** Itu normal dan tidak jadi masalah, karena saldo keduanya terpisah.
Dengan model per-booth, 15 menit itu adalah lubang di pertanggungjawaban.

---

## 4. Invarian shift

Aturan yang divalidasi backend, bukan sekadar konvensi:

| # | Invarian | Ditegakkan di |
|---|---|---|
| 1 | Shift baru dibuka dengan saldo **0** untuk semua produk | `shifts.service.ts` saat `openShift()` |
| 2 | Penjualan hanya boleh pada shift ber-status `OPEN` milik petugas itu sendiri | `sales.service.ts` |
| 3 | Shift tidak bisa berstatus `CLOSED` selama `Σ qtyOnHand > 0` | `shifts.service.ts` saat `closeShift()` |
| 4 | Semua mutasi bertipe `SHIFT` wajib punya `shift_session_id` = `location_id` | `StockLedgerService.write()` |
| 5 | Satu petugas tidak boleh punya dua shift `OPEN` bersamaan | `shifts.service.ts` |
| 6 | Setelah shift `CLOSED`, tidak ada mutasi baru yang boleh masuk ke shift itu | `StockLedgerService.write()` |

### Invarian 3 — urutan penutupan

Shift punya dua tahap penutupan, dan ini yang paling mudah salah dirancang:

```
OPEN ──[hitung fisik + alasan selisih]──► MENUNGGU_PENGEMBALIAN ──[gudang terima]──► CLOSED
```

| Status | Artinya | Boleh jual? | Saldo shift |
|---|---|---|---|
| `OPEN` | Sedang bertugas | ya | berjalan |
| `MENUNGGU_PENGEMBALIAN` | Sudah hitung fisik, stok dibawa ke gudang | **tidak** | masih ada, terkunci |
| `CLOSED` | Gudang sudah menerima | tidak | **0** |

Petugas tidak bisa menutup shift sepenuhnya sendirian — status `CLOSED` baru terjadi
saat Admin di gudang mengonfirmasi penerimaan fisiknya. Itu yang membuat stok di
perjalanan punya pemilik yang jelas: masih tercatat atas nama petugas sampai benar-benar
diserahkan.

Selisih antara yang diserahkan petugas dan yang diterima Admin ditangani seperti selisih
penerimaan lain: Admin memasukkan qty aktual, sisanya jadi discrepancy dan
`ReconciliationCase`.

---

## 5. Rekap per shift

Karena stok melekat ke shift, rekap per petugas jadi perhitungan langsung — bukan
pencocokan perkiraan.

```
┌── Shift 1 · 22 Sep 2026 · Rina · Booth Sudirman ─────────────────────────────┐
│                                                                              │
│  Produk          Terima  Restok  Terjual  Rusak  Selisih  Kembali   Sisa     │
│  ─────────────────────────────────────────────────────────────────────────   │
│  Es Kopi Susu       100      30       92      0       −2       36       0     │
│  Kopi Hitam          50       −       31      1        0       18       0     │
│  Susu UHT 1L         24       −       18      0       −1        5       0     │
│  ─────────────────────────────────────────────────────────────────────────   │
│  Total              174      30      141      1       −3       59       0     │
│                                                                              │
│  Omzet  Rp2.115.000  ·  141 cup  ·  87 transaksi  ·  rata-rata Rp24.310      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Tiap baris wajib memenuhi:

```
Terima + Restok − Terjual − Rusak + Selisih − Kembali = 0
```

Kalau ada baris yang tidak nol, berarti ada mutasi yang lolos dari ledger — dan itu bug
yang harus ditangani, bukan diselesaikan dengan pembulatan. Validasi ini dipasang di
service sebelum response dikirim, sama seperti validasi rekap bulanan di dok 03.

Kolom **Selisih** adalah hasil hitung fisik saat closing. Kalau seorang petugas
konsisten punya selisih negatif sementara yang lain tidak, itu sinyal yang perlu
ditindaklanjuti — dan sekarang angkanya bisa dibandingkan antar petugas secara adil,
karena tiap orang memulai dari nol.

---

## 6. Serah terima langsung antar shift

**Belum diputuskan.** Alur yang Anda jelaskan mengharuskan Shift 1 membawa sisa stok ke
gudang, lalu Shift 2 mengambil stok baru dari gudang. Di lapangan, godaan untuk memotong
jalur itu besar: Shift 1 menyerahkan langsung ke Shift 2 di booth.

Kalau itu dibolehkan, perlu transaksi baru:

| Transaksi | Sisi Shift 1 | Sisi Shift 2 |
|---|---|---|
| Serah Terima Antar Shift | `SERAH_ANTAR_SHIFT` `−` | `TERIMA_ANTAR_SHIFT` `+` |

Dengan aturan: kedua petugas harus sama-sama mengonfirmasi (petugas keluar menyerahkan,
petugas masuk menerima dengan hitungan sendiri), dan selisih di antaranya wajib diberi
alasan sebelum Shift 1 bisa `CLOSED`.

Rekomendasi: **sediakan jalurnya**. Kalau tidak, praktiknya akan tetap terjadi tapi
dicatat sebagai "pengembalian" fiktif yang tidak pernah sampai gudang — dan itu jauh
lebih buruk daripada mencatat apa adanya.

Perlu keputusan Anda sebelum implementasi.

---

## 7. Dampak ke dokumen lain

| Dokumen | Yang berubah |
|---|---|
| [02](02-mutasi-stok.md) | `StockLocationType.BOOTH` → `SHIFT`. `location_id` = `ShiftSession.id` |
| [03](03-rekap-stok.md) | Rekap bulanan per shift terlalu halus — untuk `SHIFT`, agregasi disimpan per **booth** (via `shift_sessions.booth_id`). Gudang tetap per `location_id` |
| [05](05-pergerakan-stok.md) | Kolom "locationType BOOTH" dibaca sebagai `SHIFT`. Stok rusak di booth melekat ke shift |
| [06](06-data-operasional.md) | "Stok di Booth" jadi query turunan atas shift yang `OPEN`. Riwayat per petugas jadi filter `location_id ∈ shift milik petugas` — lebih langsung dari sebelumnya |
| [04](04-migrasi.md) | `BoothStock` → `ShiftStock` masuk Tahap 1. Backfill: saldo booth yang ada dipetakan ke shift `OPEN` terakhir, atau ke shift sintetis kalau tidak ada |

---

## 8. Kriteria penerimaan

- [ ] Shift yang baru dibuka punya saldo 0 untuk seluruh produk.
- [ ] `closeShift()` ditolak selama masih ada `ShiftStock.qtyOnHand > 0`.
- [ ] Penjualan pada shift ber-status `MENUNGGU_PENGEMBALIAN` ditolak.
- [ ] Dua shift di booth yang sama bisa aktif bersamaan tanpa saldonya bercampur.
- [ ] Untuk tiap produk di tiap shift:
      `Terima + Restok − Terjual − Rusak + Selisih − Kembali = 0`.
- [ ] Stok yang sedang dibawa dari booth ke gudang tetap tercatat atas nama shift
      pengirim sampai Admin mengonfirmasi penerimaan.
- [ ] Query "stok di Booth X sekarang" mengembalikan kosong saat tidak ada shift `OPEN`.
- [ ] Petugas A tidak bisa menjual, melapor rusak, atau mengembalikan stok atas shift
      milik petugas B.
