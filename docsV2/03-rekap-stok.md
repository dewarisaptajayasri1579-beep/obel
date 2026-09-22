# 03 — Tabel `rekap_stok`

Saldo stok bulanan per produk. Menjawab "bulan Agustus produk X masuk berapa, keluar
berapa, sisa berapa" tanpa memindai seluruh buku besar sejak awal pemakaian.

Pola diambil dari jsBerkah `StockMonthlyBalance` + `stock-produk.service.ts`.

---

## 1. Kolom yang diminta

```
idbarang · bulan · tahun · stok_awal · masuk · keluar · stok_akhir
```

Ditambah satu dimensi yang tidak bisa dihindari: **lokasi**. Tanpa itu, stok gudang dan
stok tiap booth tercampur jadi satu angka dan rekapnya tidak bisa dipakai untuk apa pun.
Baris "semua lokasi" tetap bisa didapat dengan menjumlahkan barisnya saat dibaca.

---

## 2. Model

```prisma
/// Rekap stok bulanan per produk × lokasi — CACHE, bukan sumber kebenaran.
/// Sumber kebenarannya tetap mutasi_stok (dok 02); tabel ini boleh dibangun ulang
/// kapan saja dari sana dan hasilnya wajib identik.
model StockMonthlyRecap {
  id           String            @id @default(uuid())
  productId    String            @map("idbarang")
  product      Product           @relation(fields: [productId], references: [id])
  locationType StockLocationType @map("location_type")
  locationId   String            @map("location_id")

  /// 1–12. Disimpan sebagai dua kolom terpisah sesuai permintaan; kunci periode
  /// internal "YYYY-MM" diturunkan darinya saat query.
  bulan        Int
  tahun        Int

  /// Angka PERIODE MURNI — hanya pergerakan bulan itu sendiri, tidak kumulatif.
  /// Inilah dua kolom yang ditulis langsung setiap ada mutasi.
  masuk        Int               @default(0)
  keluar       Int               @default(0)   // disimpan POSITIF

  /// Kolom turunan: stok_awal = stok_akhir bulan sebelumnya,
  ///                stok_akhir = stok_awal + masuk − keluar.
  /// Dipelihara oleh cascade di bagian 4 — jangan pernah ditulis manual.
  stokAwal     Int               @default(0) @map("stok_awal")
  stokAkhir    Int               @default(0) @map("stok_akhir")

  updatedAt    DateTime          @updatedAt @map("updated_at")

  @@unique([productId, locationType, locationId, tahun, bulan])
  @@index([tahun, bulan])
  @@index([productId, tahun, bulan])
  @@map("rekap_stok")
}
```

---

## 3. Keputusan penting: mana yang otoritatif

Ini bagian yang paling menentukan benar-tidaknya rekap, jadi ditulis eksplisit.

| Kolom | Sifat | Cara pemeliharaan |
|---|---|---|
| `masuk`, `keluar` | **Otoritatif untuk periodenya** | `increment` langsung saat mutasi ditulis. Bulan lain tidak tersentuh |
| `stok_awal`, `stok_akhir` | **Turunan** | Dihitung ulang berantai maju, lihat bagian 4 |

Alasannya: mutasi **bertanggal mundur** itu normal, bukan kasus langka. Surat jalan
tanggal 30 September yang baru sempat diinput tanggal 2 Oktober harus masuk periode
September. Kalau `stok_awal`/`stok_akhir` ikut diperlakukan otoritatif dan ditulis
langsung, maka setiap input mundur mengharuskan perbaikan berantai ke semua bulan
sesudahnya — dan rantai perbaikan yang gagal di tengah adalah sumber hampir semua bug
rekap stok yang parah di sistem semacam ini.

Dengan `masuk`/`keluar` sebagai angka periode murni, input mundur cukup menambah dua
angka di bulannya sendiri. Rantai `stok_awal`/`stok_akhir` bisa dihitung ulang kapan
saja dari situ, dan kalau hitungannya gagal, yang rusak hanya kolom turunan yang
memang bisa dibangun ulang — bukan datanya.

> Alternatif yang **tidak** dipilih: menyimpan hanya `masuk`/`keluar` lalu menurunkan
> `stok_awal`/`stok_akhir` sepenuhnya saat query (`Σ(masuk−keluar)` semua bulan ≤ N).
> Itu yang dilakukan jsBerkah dan lebih sederhana, tapi tidak memberi kolom tersimpan
> yang diminta. Skema di atas adalah kompromi: kolomnya ada dan siap dibaca langsung,
> tapi statusnya tetap turunan yang bisa dibangun ulang.

---

## 4. Pemeliharaan

Dipanggil dari `StockLedgerService.write()` (dok 02 bagian 3) di **transaksi yang sama**.

```ts
// src/modules/stock-recap/stock-recap.service.ts

async apply(
  tx: Prisma.TransactionClient,
  productId: string, locationType: StockLocationType, locationId: string,
  date: Date, qtyChange: number,
) {
  // Bulan & tahun diturunkan dari tanggal BISNIS memakai kalender lokal (WIB) —
  // konsisten dengan batas periode yang dipakai laporan. Kalau di sini memakai UTC
  // sementara pembacanya memakai lokal, mutasi di jam-jam pertama sebuah bulan
  // jatuh ke periode berbeda antara penulisan dan pembacaan — selisih yang sangat
  // sulit dilacak karena hanya muncul di pinggir bulan.
  const { bulan, tahun } = periodeJakarta(date);

  // (a) Angka periode murni: increment, tidak menyentuh bulan lain.
  await tx.stockMonthlyRecap.upsert({
    where: { productId_locationType_locationId_tahun_bulan: { productId, locationType, locationId, tahun, bulan } },
    create: {
      productId, locationType, locationId, tahun, bulan,
      masuk:  qtyChange > 0 ?  qtyChange : 0,
      keluar: qtyChange < 0 ? -qtyChange : 0,
    },
    update: qtyChange > 0
      ? { masuk:  { increment:  qtyChange } }
      : { keluar: { increment: -qtyChange } },
  });

  // (b) Perbaiki rantai stok_awal/stok_akhir dari bulan itu ke depan.
  //     Cakupannya terbatas: hanya satu produk × satu lokasi, dan hanya bulan-bulan
  //     yang punya baris. Untuk mutasi bulan berjalan (kasus 99%), ini menyentuh
  //     tepat satu baris.
  await this.cascade(tx, productId, locationType, locationId, tahun, bulan);
}

private async cascade(tx, productId, locationType, locationId, tahun, bulan) {
  const kunci = tahun * 12 + bulan;

  // Saldo penutup bulan TERAKHIR sebelum periode ini = titik awal rantai.
  const sebelum = await tx.stockMonthlyRecap.findMany({
    where: { productId, locationType, locationId },
    select: { tahun: true, bulan: true, masuk: true, keluar: true },
  });

  let berjalan = sebelum
    .filter((r) => r.tahun * 12 + r.bulan < kunci)
    .reduce((acc, r) => acc + r.masuk - r.keluar, 0);

  const kedepan = sebelum
    .filter((r) => r.tahun * 12 + r.bulan >= kunci)
    .sort((a, b) => (a.tahun * 12 + a.bulan) - (b.tahun * 12 + b.bulan));

  for (const r of kedepan) {
    const stokAwal  = berjalan;
    const stokAkhir = stokAwal + r.masuk - r.keluar;
    await tx.stockMonthlyRecap.update({
      where: { productId_locationType_locationId_tahun_bulan: {
        productId, locationType, locationId, tahun: r.tahun, bulan: r.bulan } },
      data: { stokAwal, stokAkhir },
    });
    berjalan = stokAkhir;
  }
}
```

Karena `cascade` berjalan di transaksi yang sama dengan penulisan mutasi, tidak ada
kondisi setengah jadi: rantai yang gagal diperbaiki akan me-rollback mutasinya sekalian.

### Bangun ulang total

```
npm run stock:rebuild-recap                    # seluruh produk
npm run stock:rebuild-recap -- --product=<id>  # satu produk
```

Menghapus seluruh `rekap_stok` lalu membangunnya dari nol dengan satu query agregasi
per produk × lokasi × bulan atas `mutasi_stok`, dilanjutkan cascade. Dipakai saat
migrasi awal dan kapan pun rekonsiliasi (dok 02 bagian 6) melaporkan selisih.

```sql
-- inti query pembangunan ulang
SELECT product_id,
       location_type,
       location_id,
       EXTRACT(YEAR  FROM mutation_date)::int AS tahun,
       EXTRACT(MONTH FROM mutation_date)::int AS bulan,
       SUM(CASE WHEN qty_change > 0 THEN  qty_change ELSE 0 END)::int AS masuk,
       SUM(CASE WHEN qty_change < 0 THEN -qty_change ELSE 0 END)::int AS keluar
FROM mutasi_stok
GROUP BY 1, 2, 3, 4, 5;
```

---

## 5. Endpoint

| Method | Path | Guna |
|---|---|---|
| `GET` | `/stock-recap` | Rekap seluruh produk untuk satu periode. Filter `tahun`, `bulan`, `locationType`, `locationId`, `q` |
| `GET` | `/stock-recap/product/:productId` | Rekap satu produk dipecah per lokasi, dengan rentang beberapa bulan |
| `GET` | `/stock-recap/export` | CSV / XLSX |

Owner boleh membaca ketiganya. Response baris:

```jsonc
{
  "periode": { "bulan": 9, "tahun": 2026, "label": "September 2026" },
  "rows": [
    {
      "productId": "…", "sku": "KOPI-001", "name": "Es Kopi Susu",
      "lokasi": { "type": "WAREHOUSE", "id": "…", "name": "Gudang Pusat" },
      "stokAwal": 120, "masuk": 300, "keluar": 50, "stokAkhir": 370
    }
  ],
  "total": { "stokAwal": 1240, "masuk": 2100, "keluar": 1850, "stokAkhir": 1490 }
}
```

Validasi yang wajib dipasang di service: `stokAwal + masuk − keluar === stokAkhir` untuk
setiap baris sebelum dikirim. Kalau tidak sama, berarti cache-nya melenceng — log warning
dan sertakan flag di response supaya UI bisa menampilkan peringatan, bukan diam-diam
menyajikan angka yang salah.

---

## 6. Layar

Rute `/laporan/rekap-stok`.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Rekap Stok                                                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ [Bulan: September ▾] [Tahun: 2026 ▾] [Lokasi: Gudang Pusat ▾] [Cari…]      │
│                                                    [Ekspor CSV] [Cetak]    │
├────┬──────────┬───────────────────┬───────────┬────────┬────────┬──────────┤
│ No │ SKU      │ Produk            │ Stok Awal │  Masuk │ Keluar │Stok Akhir│
├────┼──────────┼───────────────────┼───────────┼────────┼────────┼──────────┤
│  1 │ KOPI-001 │ Es Kopi Susu      │       120 │    300 │     50 │      370 │
│  2 │ KOPI-002 │ Kopi Hitam        │        80 │    150 │    110 │      120 │
│  3 │ SUSU-001 │ Susu UHT 1L       │        24 │     48 │     60 │       12 │
├────┴──────────┴───────────────────┼───────────┼────────┼────────┼──────────┤
│                             Total │       224 │    498 │    220 │      502 │
└───────────────────────────────────┴───────────┴────────┴────────┴──────────┘
```

- Klik baris → membuka kartu stok produk tersebut (dok 02 bagian 4) dengan periode
  yang sama sudah terpasang di filternya.
- Selector Lokasi punya opsi "Semua Lokasi" (menjumlahkan) dan "Per Lokasi"
  (menampilkan baris terpisah per gudang/booth).
- Angka rata kanan, `tabular-nums`, pemisah ribuan titik.
- Baris dengan `stokAkhir = 0` diberi warna redup; `stokAkhir < 0` (seharusnya mustahil)
  diberi warna merah sebagai alarm bahwa ada yang salah di ledger.

---

## 7. Kriteria penerimaan

- [ ] Untuk setiap baris: `stok_awal + masuk − keluar === stok_akhir`.
- [ ] `stok_awal` bulan N === `stok_akhir` bulan N−1 pada produk × lokasi yang sama.
- [ ] `stok_akhir` bulan terakhir === saldo `WarehouseStock`/`BoothStock` saat ini.
- [ ] Mutasi bertanggal mundur ke bulan lalu: `masuk` bulan lalu bertambah, **dan**
      `stok_awal`/`stok_akhir` seluruh bulan sesudahnya ikut bergeser.
- [ ] `npm run stock:rebuild-recap` menghasilkan tabel yang identik byte-per-byte
      dengan hasil pemeliharaan inkremental (dibandingkan di e2e test).
- [ ] Membuka rekap 1 bulan × 50 produk tidak menyentuh tabel `mutasi_stok` sama sekali
      (dibuktikan lewat query log) — biayanya tidak boleh naik mengikuti jumlah mutasi.
