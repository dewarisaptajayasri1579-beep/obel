# 05 — Pergerakan Stok

Daftar tertutup peristiwa yang boleh mengubah stok. Di luar daftar ini, tidak ada cara
lain stok berpindah.

---

## 1. Peta

```
                    ┌──────────────────────────────────────┐
   Supplier ───────►│                                      │
   (Terima ke       │            G U D A N G               │
    Gudang)         │                                      │
                    └──┬────────────────┬──────────────▲───┘
                       │                │              │
            Penyerahan │        Restok  │              │ Pengembalian
              ke Booth │        ke Booth│              │ Stok
                       ▼                ▼              │
                    ┌──────────────────────────────────┴───┐
                    │                                      │
                    │             B O O T H                │
                    │                                      │
                    └──┬───────────────────────────────────┘
                       │
             Penjualan │
                       ▼
                   Pelanggan

   Stok Rusak: keluar dari GUDANG maupun BOOTH (tidak berpindah ke mana-mana)
```

---

## 2. Gudang

### Stok Masuk

| Peristiwa | Jenis mutasi | Dokumen | Pemicu |
|---|---|---|---|
| **Terima ke Gudang** | `PENERIMAAN` | `stock_receipt` (dok 01) | Admin memposting dokumen penerimaan dari supplier |
| **Pengembalian Stok** | `TERIMA_PENGEMBALIAN` | `stock_return` | Admin menerima fisik stok yang dikirim balik dari booth |

### Stok Keluar

| Peristiwa | Jenis mutasi | Dokumen | Pemicu |
|---|---|---|---|
| **Penyerahan ke Booth** | `PENYERAHAN` | `distribution` | Admin mengirim stok terjadwal ke booth |
| **Restok ke Booth** | `RESTOK` | `distribution` ber-`restockRequestId` | Admin menyetujui & mengirim permintaan restok |
| **Stok Rusak** | `KERUSAKAN` | `stock_damage` | Admin mencatat barang rusak/kedaluwarsa di gudang |

---

## 3. Booth

### Stok Masuk

| Peristiwa | Jenis mutasi | Dokumen | Pemicu |
|---|---|---|---|
| **Terima dari Gudang** | `TERIMA_PENYERAHAN` | `distribution` | Petugas menekan Terima atas penyerahan |
| **Restok dari Gudang** | `TERIMA_RESTOK` | `distribution` | Petugas menekan Terima atas restok |

### Stok Keluar

| Peristiwa | Jenis mutasi | Dokumen | Pemicu |
|---|---|---|---|
| **Penjualan** | `PENJUALAN` | `sale` | Petugas menyelesaikan transaksi |
| **Stok Rusak** | `KERUSAKAN` | `stock_damage` | Petugas mencatat cup tumpah / bahan rusak |
| Pengembalian ke gudang | `PENGEMBALIAN` | `stock_return` | Petugas mengajukan pengembalian sisa stok |

> Baris terakhir tidak Anda sebut di daftar keluar booth, tapi tanpa itu stok yang
> dikembalikan tidak pernah keluar dari saldo booth — sementara di sisi gudang
> "Pengembalian Stok" sudah Anda daftarkan sebagai stok masuk. Keduanya adalah dua sisi
> dari satu perpindahan, jadi keduanya wajib ada. Kalau maksud Anda pengembalian tidak
> boleh dimulai dari booth, beri tahu — mekanismenya berubah jadi Admin yang menarik
> stok, dan pasangannya tetap dua baris.

---

## 4. Stok Rusak

Jalur baru yang belum ada sama sekali di sistem sekarang. Hari ini barang rusak hanya
bisa dicatat sebagai `ADJUSTMENT` yang tidak bisa dibedakan dari koreksi salah hitung —
akibatnya kerugian karena kerusakan tidak pernah bisa dihitung.

### Model

```prisma
enum DamageReason {
  TUMPAH          // cup tumpah saat penyajian
  KEDALUWARSA     // lewat tanggal expired
  RUSAK_KEMASAN   // kemasan bocor/penyok
  RUSAK_KUALITAS  // basi, berubah rasa/warna
  HILANG          // tidak ditemukan saat dicari
  LAINNYA         // wajib isi catatan

  @@map("damage_reason")
}

enum StockDamageStatus {
  DIAJUKAN     // dibuat petugas booth, menunggu persetujuan Admin
  DISETUJUI    // diposting — stok berkurang
  DITOLAK      // tidak jadi, stok tidak berubah

  @@map("stock_damage_status")
}

/// Pencatatan stok rusak/hilang. Stok BARU berkurang saat status DISETUJUI.
/// Dokumen dari Admin di gudang langsung DISETUJUI (Admin adalah penyetujunya);
/// dokumen dari petugas booth wajib lewat persetujuan Admin.
model StockDamage {
  id            String            @id @default(uuid())
  damageNo      String            @unique @map("damage_no")
  status        StockDamageStatus @default(DIAJUKAN)
  locationType  StockLocationType @map("location_type")
  locationId    String            @map("location_id")
  damageDate    DateTime          @map("damage_date") @db.Date
  shiftSessionId String?          @map("shift_session_id")
  reportedById  String            @map("reported_by_id")
  approvedById  String?           @map("approved_by_id")
  approvedAt    DateTime?         @map("approved_at")
  rejectReason  String?           @map("reject_reason")
  photoUrl      String?           @map("photo_url")
  note          String?
  idempotencyKey String           @unique @map("idempotency_key")
  createdAt     DateTime          @default(now()) @map("created_at")

  items StockDamageItem[]

  @@index([locationType, locationId])
  @@index([status])
  @@index([damageDate])
  @@map("stock_damages")
}

model StockDamageItem {
  id        String       @id @default(uuid())
  damageId  String       @map("damage_id")
  damage    StockDamage  @relation(fields: [damageId], references: [id], onDelete: Cascade)
  productId String       @map("product_id")
  product   Product      @relation(fields: [productId], references: [id])
  qty       Int
  reason    DamageReason
  note      String?

  @@index([damageId])
  @@index([productId])
  @@map("stock_damage_items")
}
```

### Aturan

- Petugas booth hanya boleh membuat dokumen untuk **booth-nya sendiri** dan **shift yang
  sedang aktif**. `shiftSessionId` diisi otomatis dari server, tidak dari klien.
- Admin boleh membuat untuk gudang mana pun, dan dokumennya langsung `DISETUJUI`.
- Qty rusak tidak boleh melebihi saldo di lokasi itu — dijaga guard tunggal di
  `StockLedgerService.write()`, jadi tidak perlu dicek ulang di service ini.
- Alasan `LAINNYA` mewajibkan `note` terisi.
- Foto opsional tapi disarankan; dipakai Admin saat menilai pengajuan dari booth.
- Dokumen `DISETUJUI` tidak bisa diedit atau dihapus — koreksi lewat reversal.

### Endpoint

| Method | Path | Role |
|---|---|---|
| `GET` | `/stock-damages` | ADMIN, OWNER (semua) · BOOTH_STAFF (booth sendiri) |
| `GET` | `/stock-damages/:id` | sda |
| `POST` | `/stock-damages` | ADMIN, BOOTH_STAFF |
| `PATCH` | `/stock-damages/:id/approve` | ADMIN |
| `PATCH` | `/stock-damages/:id/reject` | ADMIN |

---

## 5. Penyerahan vs Restok

Efek stoknya identik: gudang berkurang, booth bertambah. Yang beda adalah asal-usulnya,
dan itu yang perlu dipisah di pencatatan.

| | Penyerahan ke Booth | Restok ke Booth |
|---|---|---|
| Inisiatif | Admin, terjadwal | Permintaan petugas / peringatan stok menipis |
| Dokumen asal | — | `restock_request` |
| Biasanya terjadi | Awal shift, sebelum booth buka | Tengah shift |
| Pertanyaan yang dijawab | "Berapa yang kita siapkan?" | "Berapa kali kita salah memperkirakan?" |

Secara teknis keduanya tetap memakai dokumen `StockDistribution` yang sama. Pembedanya
satu kolom:

```prisma
model StockDistribution {
  // ...
  /// null = Penyerahan terjadwal. Terisi = Restok atas permintaan.
  /// Kolom inilah yang menentukan mutasi ditulis sebagai PENYERAHAN atau RESTOK.
  restockRequestId String? @unique @map("restock_request_id")
}
```

Rasio restok terhadap penyerahan adalah indikator langsung seberapa tepat perencanaan
stok awal — kalau tinggi, `BoothStockThreshold` atau qty penyerahan awalnya perlu
disesuaikan.

---

## 6. Yang tidak ada di daftar Anda, tapi ada di sistem

Tiga jalur ini sudah berjalan di kode sekarang dan tidak Anda sebut. Saya pertahankan
karena membuangnya akan merusak alur yang sudah ada — tapi perlu Anda konfirmasi.

| Jalur | Status | Kenapa dipertahankan |
|---|---|---|
| **Closing shift** | Tetap, jenis `KOREKSI` | Selisih hitung fisik vs expected di akhir shift. Tanpa ini, selisih tidak punya tempat mendarat dan saldo booth jadi salah permanen |
| **Stock opname** | Tetap, jenis `OPNAME` | Hitung fisik berkala di gudang maupun booth. Sudah ada modulnya (`stock-opname`) |
| **Koreksi/reversal** | Tetap, jenis `REVERSAL` | Wajib menurut aturan P0 — dokumen yang sudah diposting tidak boleh dihapus, hanya dibalik |

Sebagian besar selisih closing shift sebenarnya **adalah** stok rusak yang tidak tercatat
saat kejadian. Dengan adanya jalur Stok Rusak, angka `KOREKSI` dari closing seharusnya
mengecil — dan itu sendiri jadi ukuran seberapa disiplin pencatatannya.

---

## 7. Kriteria penerimaan

- [ ] Setiap baris `mutasi_stok` bisa ditelusuri ke satu dokumen lewat
      `ref_doc_type` + `ref_doc_id`. Tidak ada mutasi tanpa dokumen.
- [ ] Penyerahan dan Restok menghasilkan `mutation_type` yang berbeda walaupun
      dokumennya sama-sama `StockDistribution`.
- [ ] Setiap `PENYERAHAN` akhirnya berpasangan dengan `TERIMA_PENYERAHAN` ber-qty sama,
      kecuali yang dibatalkan (punya `REVERSAL` pasangannya).
- [ ] Dokumen stok rusak berstatus `DIAJUKAN` tidak mengubah saldo sama sekali.
- [ ] Petugas booth A tidak bisa membuat dokumen stok rusak untuk booth B.
- [ ] Laporan kerugian kerusakan per periode bisa dihitung:
      `Σ qty KERUSAKAN × harga`, dipecah per alasan dan per lokasi.
