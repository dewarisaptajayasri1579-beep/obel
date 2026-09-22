# 02 — Tabel `mutasi_stok`

Buku besar pergerakan stok per produk. Satu-satunya sumber kebenaran stok; seluruh
saldo di aplikasi adalah turunan dari tabel ini.

Menggantikan `stock_movements` yang ada sekarang. Pola diambil dari jsBerkah
`backend/src/stock-ledger` + model `StockLedger`.

---

## 1. Apa yang kurang dari `stock_movements` sekarang

| Masalah | Akibat |
|---|---|
| `qty` selalu positif, arah disimpulkan dari `movement_type` + `from_booth_id`/`to_booth_id` | Tidak bisa `SUM(qty)` untuk dapat saldo. Setiap pembaca harus menulis ulang logika tandanya, dan pasti ada yang salah |
| Tidak ada `qty_before` / `qty_after` | Tidak bisa membuat kartu stok dengan saldo berjalan. Kalau saldo dan ledger berselisih, tidak ketahuan di baris mana mulai melenceng |
| Lokasi dikodekan sebagai dua kolom booth nullable | `null` berarti "gudang" — implisit dan tidak bisa diperluas ke gudang kedua |
| `business_date` ada tapi `occurred_at` yang dipakai di mana-mana | Dokumen bertanggal mundur berisiko masuk periode yang salah |
| Tidak ada pintu tulis tunggal | Tujuh service menulis `stockMovement.create()` masing-masing dengan gaya berbeda; tidak ada satu titik yang bisa menjamin invariannya |
| Tidak ada guard di level ledger | Setiap pemanggil harus ingat sendiri memasang `qtyOnHand: { gte: qty }` |

---

## 2. Model

```prisma
/// SHIFT, bukan BOOTH — stok di lapangan dipegang oleh shift yang sedang berjalan,
/// bukan oleh booth. Alasannya di dok 07; ringkasnya: tiap petugas menerima stok di
/// awal shift dan mengembalikan semuanya di akhir, jadi booth tidak pernah menginap
/// membawa stok. Saldo per booth tetap bisa dibaca sebagai turunan (Σ shift OPEN di
/// booth itu).
enum StockLocationType {
  WAREHOUSE   // location_id = Warehouse.id
  SHIFT       // location_id = ShiftSession.id

  @@map("stock_location_type")
}

/// Jenis mutasi mengikuti taksonomi operasional di dok 05 — dibedakan per
/// PERISTIWA BISNIS, bukan per arah teknis. "Penyerahan" dan "Restok" sengaja
/// dipisah walaupun efek stoknya identik, karena keduanya beda asal-usul
/// (terjadwal vs permintaan petugas) dan harus bisa dipisah di laporan.
enum StockMutationType {
  // ── Gudang: masuk ──
  PENERIMAAN           // Terima ke Gudang, dari supplier (dok 01)
  TERIMA_PENGEMBALIAN  // Pengembalian stok dari booth, diterima gudang

  // ── Gudang: keluar ──
  PENYERAHAN           // Penyerahan ke Booth (distribusi terjadwal)
  RESTOK               // Restok ke Booth (menindaklanjuti permintaan)

  // ── Booth: masuk ──
  TERIMA_PENYERAHAN    // Terima dari Gudang
  TERIMA_RESTOK        // Terima restok dari Gudang

  // ── Booth: keluar ──
  PENJUALAN            // Penjualan ke pelanggan
  PENGEMBALIAN         // Booth mengirim stok balik ke gudang

  // ── Keduanya ──
  KERUSAKAN            // Stok rusak / tumpah / kedaluwarsa (dok 05 §4)
  OPNAME               // Hasil stock opname
  KOREKSI              // Adjustment manual
  REVERSAL             // Pembalikan dokumen yang sudah diposting

  @@map("stock_mutation_type")
}

/// Buku besar stok — append-only, TIDAK PERNAH di-update atau dihapus.
/// Seluruh saldo (BoothStock, WarehouseStock, rekap_stok) adalah turunan tabel ini
/// dan harus bisa direkonstruksi ulang darinya kapan saja.
model StockMutation {
  id           String            @id @default(uuid())
  mutationNo   String            @unique @map("mutation_no")
  productId    String            @map("product_id")
  product      Product           @relation(fields: [productId], references: [id])

  locationType StockLocationType @map("location_type")
  /// Warehouse.id untuk WAREHOUSE, ShiftSession.id untuk SHIFT.
  locationId   String            @map("location_id")

  mutationType StockMutationType @map("mutation_type")
  /// BERTANDA: positif = masuk, negatif = keluar. Inilah bedanya dengan
  /// stock_movements lama — saldo cukup SUM(qty_change), tanpa menafsirkan tipe.
  qtyChange    Int               @map("qty_change")
  qtyBefore    Int               @map("qty_before")
  qtyAfter     Int               @map("qty_after")

  refDocType   String?           @map("ref_doc_type")    // "stock_receipt" | "sale" | ...
  refDocId     String?           @map("ref_doc_id")
  refDocNumber String?           @map("ref_doc_number")  // nomor manusiawi, untuk tampilan

  /// Tanggal BISNIS — kapan barangnya benar-benar berpindah menurut dokumennya,
  /// BUKAN kapan barisnya diketik (createdAt). Seluruh periode rekap dihitung dari
  /// kolom ini. Tanpa pemisahan ini, surat jalan tanggal 30 yang baru diinput
  /// tanggal 2 akan masuk bulan yang salah dan tidak ada cara membetulkannya.
  mutationDate DateTime          @map("mutation_date") @db.Date

  shiftSessionId String?         @map("shift_session_id")
  actorId        String          @map("actor_id")
  note           String?
  createdAt      DateTime        @default(now()) @map("created_at")

  @@index([productId, locationType, locationId, mutationDate])
  @@index([refDocType, refDocId])
  @@index([mutationDate, mutationType])
  @@index([shiftSessionId])
  @@map("mutasi_stok")
}
```

> Nama tabel di database `mutasi_stok` sesuai permintaan; nama model Prisma tetap
> `StockMutation` agar konsisten dengan aturan CLAUDE.md "identifier kode berbahasa
> Inggris, UI berbahasa Indonesia".

### Arah per tipe

| mutationType | locationType | Tanda `qty_change` | Dokumen sumber |
|---|---|---|---|
| `PENERIMAAN` | WAREHOUSE | `+` | `stock_receipt` |
| `TERIMA_PENGEMBALIAN` | WAREHOUSE | `+` | `stock_return` |
| `PENYERAHAN` | WAREHOUSE | `−` | `distribution` |
| `RESTOK` | WAREHOUSE | `−` | `distribution` (dari `restock_request`) |
| `TERIMA_PENYERAHAN` | SHIFT | `+` | `distribution` |
| `TERIMA_RESTOK` | SHIFT | `+` | `distribution` |
| `PENJUALAN` | SHIFT | `−` | `sale` |
| `PENGEMBALIAN` | SHIFT | `−` | `stock_return` |
| `KERUSAKAN` | keduanya | `−` | `stock_damage` |
| `OPNAME` | keduanya | `±` | `stock_opname` |
| `KOREKSI` | keduanya | `±` | `stock_adjustment` |
| `REVERSAL` | keduanya | `±` | dokumen yang dibalik |

Satu penyerahan menghasilkan **dua** baris per produk: `PENYERAHAN` di gudang saat
dikirim, dan `TERIMA_PENYERAHAN` di booth saat petugas menerima. Selisih waktu antara
keduanya persis merepresentasikan barang yang sedang di perjalanan — dan sekarang bisa
dihitung: `Σ PENYERAHAN yang belum berpasangan TERIMA_PENYERAHAN`. Berlaku sama untuk
pasangan `RESTOK` / `TERIMA_RESTOK` dan `PENGEMBALIAN` / `TERIMA_PENGEMBALIAN`.

Peta lengkap peristiwa bisnis → jenis mutasi ada di [05-pergerakan-stok.md](05-pergerakan-stok.md).

---

## 3. Pintu tulis tunggal

Semua mutasi stok, dari modul mana pun, wajib lewat satu fungsi. Tidak ada
`prisma.stockMutation.create()` yang tersebar di service lain.

```ts
// src/modules/stock-ledger/stock-ledger.service.ts

export interface WriteMutationInput {
  productId: string;
  locationType: 'WAREHOUSE' | 'BOOTH';
  locationId: string;
  mutationType: StockMutationType;
  qtyChange: number;            // bertanda
  refDocType?: string;
  refDocId?: string;
  refDocNumber?: string;
  shiftSessionId?: string | null;
  actorId: string;
  note?: string | null;
  /// Tanggal bisnis. Dokumen yang punya tanggal sendiri WAJIB mengirimnya.
  date: Date;
}

@Injectable()
export class StockLedgerService {
  /// WAJIB dipanggil di dalam prisma.$transaction — tiga tulisannya harus jadi
  /// atau batal bersama. Kalau tidak, kegagalan di tengah menyisakan saldo yang
  /// sudah naik tanpa baris mutasinya, dan selisihnya tidak akan pernah ketahuan
  /// sampai ada yang menghitung ulang.
  async write(tx: Prisma.TransactionClient, input: WriteMutationInput) {
    // (a) Serialisasi per sel (produk × lokasi). Tanpa ini, dua transaksi bisa
    //     membaca qtyBefore yang sama dan dua-duanya commit — salah satunya hilang
    //     diam-diam, dan tidak ada unique constraint yang bisa menangkapnya.
    const cell = `${input.productId}:${input.locationType}:${input.locationId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cell}))`;

    // (b) Naikkan saldo dengan increment ATOMIK di SQL, bukan baca-hitung-tulis di
    //     Node. Hasilnya yang dipakai jadi qtyAfter, jadi angka di mutasi dan di
    //     saldo mustahil berselisih.
    const saldo = await upsertSaldo(tx, input);       // WarehouseStock / BoothStock
    const qtyAfter = saldo.qtyOnHand;
    const qtyBefore = qtyAfter - input.qtyChange;

    // (c) Choke point tunggal untuk aturan "stok tidak boleh negatif". Pemanggil
    //     boleh saja sudah mengecek duluan, tapi cek itu biasanya membaca stok
    //     SEBELUM transaksi ini dan sebelum lock di (a) — di bawah konkurensi
    //     nyata, cek itu bisa sudah basi. Dilempar SETELAH saldo naik: aman,
    //     karena seluruh fungsi ini berjalan di dalam transaksi.
    if (qtyAfter < 0) {
      throw new DomainError('INSUFFICIENT_STOCK', 'Stok tidak cukup untuk transaksi ini.', {
        productId: input.productId, available: qtyBefore, requested: -input.qtyChange,
      });
    }

    // (d) Tulis baris buku besar
    const mutation = await tx.stockMutation.create({
      data: { mutationNo: generateDocNo('MUT'), qtyBefore, qtyAfter, ...input },
    });

    // (e) Update rekap bulanan (lihat dok 03) — transaksi yang sama
    await this.rekap.apply(tx, input.productId, input.locationType, input.locationId,
                           input.date, input.qtyChange);

    return mutation;
  }
}
```

Empat invarian yang dijaga fungsi ini, dan tidak bisa dijaga kalau penulisannya tersebar:

1. `qty_after = qty_before + qty_change` selalu benar.
2. Saldo proyeksi dan buku besar tidak pernah berselisih.
3. Saldo tidak pernah negatif — di lokasi mana pun, dari jalur mana pun.
4. `rekap_stok` selalu ikut ter-update, tidak pernah tertinggal.

---

## 4. Endpoint riwayat

Inilah yang sekarang sama sekali belum ada.

| Method | Path | Guna |
|---|---|---|
| `GET` | `/stock-mutations` | Daftar mutasi. Filter: `productId`, `locationType`, `locationId`, `mutationType`, `dateFrom`, `dateTo`, `refDocType`. Paginasi cursor |
| `GET` | `/stock-mutations/kartu-stok` | **Kartu stok** satu produk × lokasi: saldo awal periode + baris mutasi berurutan + saldo akhir |
| `GET` | `/stock-mutations/by-doc` | Semua mutasi dari satu dokumen (`refDocType` + `refDocId`) |

Response kartu stok:

```jsonc
{
  "product": { "id": "…", "sku": "KOPI-001", "name": "Es Kopi Susu" },
  "location": { "type": "WAREHOUSE", "id": "…", "name": "Gudang Pusat" },
  "period": { "from": "2026-09-01", "to": "2026-09-30" },
  "saldoAwal": 120,
  "rows": [
    { "date": "2026-09-02", "no": "MUT-…", "type": "PENERIMAAN",
      "ref": "TRM-M4K2-A81F", "masuk": 300, "keluar": 0, "saldo": 420,
      "note": null },
    { "date": "2026-09-03", "no": "MUT-…", "type": "DISTRIBUSI",
      "ref": "DIST-M4L1-B33A", "masuk": 0, "keluar": 50, "saldo": 370 }
  ],
  "totalMasuk": 300,
  "totalKeluar": 50,
  "saldoAkhir": 370
}
```

Kolom `masuk`/`keluar` di response adalah `qty_change` yang dipecah dua supaya tabel
UI enak dibaca — bukan kolom tersimpan.

---

## 5. Layar

**Tab Riwayat di `/stok/gudang`** dan **`/stok/booth`**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Saldo Stok   │  ▸ Riwayat Mutasi                                          │
├────────────────────────────────────────────────────────────────────────────┤
│ [Produk ▾] [Lokasi ▾] [Jenis ▾] [Periode: Sep 2026 ▾]        [Ekspor]      │
├──────────────────────────────────────────────────────────────── Saldo Awal │
│                                                                        120 │
├────────────┬───────────┬──────────────┬───────────────┬──────┬──────┬──────┤
│ Tanggal    │ No. Mutasi│ Jenis        │ Dokumen       │ Masuk│Keluar│ Saldo│
├────────────┼───────────┼──────────────┼───────────────┼──────┼──────┼──────┤
│ 02 Sep 26  │ MUT-…A81F │ Penerimaan   │ TRM-M4K2-A81F │  300 │    − │  420 │
│ 03 Sep 26  │ MUT-…B33A │ Distribusi   │ DIST-M4L1-B33A│    − │   50 │  370 │
│ 05 Sep 26  │ MUT-…C07D │ Terima Retur │ RET-M4N2-C07D │   12 │    − │  382 │
├────────────┴───────────┴──────────────┴───────────────┼──────┼──────┼──────┤
│                                                 Total │  312 │   50 │  382 │
└───────────────────────────────────────────────────────┴──────┴──────┴──────┘
```

- Kolom `Dokumen` adalah tautan ke detail dokumen sumbernya.
- Angka rata kanan dengan `tabular-nums`.
- Baris `REVERSAL` diberi penanda visual berbeda (miring / latar tipis).
- Ekspor CSV & cetak mengikuti pola laporan yang sudah ada.

---

## 6. Rekonsiliasi

Script + endpoint yang membuktikan proyeksi masih sama dengan buku besar. Ini yang
selama ini tidak ada, dan tanpanya aturan "saldo harus bisa direkonstruksi dari ledger"
hanya dijaga oleh disiplin kode.

```
npm run stock:reconcile              # laporan selisih saja
npm run stock:reconcile -- --fix     # tulis ulang saldo dari ledger (ADMIN, dicatat audit)
```

Yang diperiksa per produk × lokasi:

1. `SUM(qty_change)` seluruh mutasi == `qtyOnHand` di `WarehouseStock`/`BoothStock`.
2. Rantai `qty_before`/`qty_after` nyambung berurutan tanpa lompatan.
3. `rekap_stok` per bulan == agregasi mutasi bulan itu.

Jalankan sebagai cron harian dan kirim notifikasi kalau ada selisih.

---

## 7. Kriteria penerimaan

- [ ] `SUM(qty_change)` per produk × lokasi selalu sama dengan saldo proyeksinya.
- [ ] Tidak ada `stockMutation.create()` di luar `StockLedgerService`.
- [ ] Dua penjualan bersamaan atas produk terakhir: satu sukses, satu ditolak
      `INSUFFICIENT_STOCK`. Tidak pernah dua-duanya sukses.
- [ ] Transaksi yang di-rollback tidak menyisakan baris mutasi maupun saldo yang berubah.
- [ ] Kartu stok untuk produk dengan 10.000 mutasi terbuka di bawah 500 ms
      (dijamin index `[productId, locationType, locationId, mutationDate]`).
- [ ] `npm run stock:reconcile` melaporkan 0 selisih pada data hasil seed + e2e.
