# 01 — Penerimaan Stok Gudang

Dokumen resmi masuknya barang ke Gudang Pusat. Menggantikan `POST /warehouse-stock/adjust`
sebagai pintu masuk stok baru; adjustment tetap ada tapi khusus untuk koreksi susut/rusak.

Pola diambil dari jsBerkah `backend/src/goods-receipt` + `website/src/app/(app)/pembelian/penerimaan-barang`.

---

## 1. Keputusan desain

| Hal | Keputusan | Alasan |
|---|---|---|
| Nama entitas | `StockReceipt` (kode) / `stock_receipts` (tabel) | Identifier kode tetap Inggris sesuai CLAUDE.md; UI berbahasa Indonesia: "Penerimaan Stok" |
| Nomor dokumen | `receiptNo`, format `TRM-<base36 time>-<6 hex>` | Pakai `generateDocNo('TRM')` yang sudah ada di `src/common/doc-no.ts` |
| Status | `DRAFT` → `DITERIMA`, atau `DRAFT` → `DIBATALKAN` | Persis jsBerkah. DRAFT tidak menyentuh stok sama sekali |
| Akuntansi | **Tidak ada** hutang supplier / jurnal | Obbel belum punya modul akuntansi. `purchasePrice` disimpan untuk nilai persediaan & laporan, tanpa posting jurnal |
| Supplier | Master baru `Supplier`, tapi **opsional** di dokumen | Obbel sering beli langsung tanpa supplier tetap; `supplierId` nullable + `supplierName` teks bebas sebagai fallback |
| Purchase Order | **Tidak diadopsi** | Obbel belum punya alur PO. `qtyOrdered` tetap disediakan nullable supaya tidak perlu migrasi kedua kalau PO menyusul |

> Asumsi yang perlu dikonfirmasi: Obbel hanya punya **satu** gudang pusat, jadi dokumen ini
> tidak punya `warehouseId`. Kalau nanti ada gudang kedua, kolomnya ditambah dan `mutasi_stok`
> sudah siap karena memakai `location_type` + `location_id` (lihat dok 02).

---

## 2. Model data

```prisma
enum StockReceiptStatus {
  DRAFT
  DITERIMA
  DIBATALKAN

  @@map("stock_receipt_status")
}

/// Dokumen penerimaan barang dari supplier ke Gudang Pusat.
/// DRAFT tidak menyentuh stok sama sekali — stok baru bergerak saat posting ke DITERIMA
/// (lihat stock-receipts.service.ts). DIBATALKAN hanya boleh dari DRAFT; dokumen yang
/// sudah DITERIMA dikoreksi lewat reversal, bukan lewat ubah status.
model StockReceipt {
  id             String             @id @default(uuid())
  receiptNo      String             @unique @map("receipt_no")
  status         StockReceiptStatus @default(DRAFT)
  /// Tanggal BISNIS — kapan barang benar-benar diterima menurut surat jalan,
  /// bukan kapan barisnya diketik. Seluruh periode rekap dihitung dari kolom ini.
  receiptDate    DateTime           @map("receipt_date") @db.Date
  supplierId     String?            @map("supplier_id")
  supplier       Supplier?          @relation(fields: [supplierId], references: [id])
  /// Dipakai kalau pembelian tidak lewat supplier terdaftar.
  supplierName   String?            @map("supplier_name")
  deliveryNote   String?            @map("delivery_note")   // nomor surat jalan supplier
  totalAmount    BigInt             @default(0) @map("total_amount") // Rupiah integer
  note           String?
  idempotencyKey String             @unique @map("idempotency_key")
  postedAt       DateTime?          @map("posted_at")
  postedById     String?            @map("posted_by_id")
  cancelledAt    DateTime?          @map("cancelled_at")
  cancelReason   String?            @map("cancel_reason")
  createdById    String             @map("created_by_id")
  createdAt      DateTime           @default(now()) @map("created_at")
  updatedAt      DateTime           @updatedAt @map("updated_at")

  items StockReceiptItem[]

  @@index([status])
  @@index([receiptDate])
  @@index([supplierId])
  @@map("stock_receipts")
}

model StockReceiptItem {
  id            String       @id @default(uuid())
  receiptId     String       @map("receipt_id")
  receipt       StockReceipt @relation(fields: [receiptId], references: [id], onDelete: Cascade)
  productId     String       @map("product_id")
  product       Product      @relation(fields: [productId], references: [id])
  qtyOrdered    Int?         @map("qty_ordered")            // null kalau tanpa PO
  qtyReceived   Int          @map("qty_received")
  purchasePrice BigInt       @map("purchase_price")         // harga beli per cup, Rupiah integer
  subtotal      BigInt                                       // qtyReceived * purchasePrice
  condition     String?                                      // "Baik" / "2 cup rusak"
  expiredAt     DateTime?    @map("expired_at") @db.Date     // opsional, untuk bahan berumur pendek

  @@index([receiptId])
  @@index([productId])
  @@map("stock_receipt_items")
}

model Supplier {
  id        String   @id @default(uuid())
  code      String   @unique
  name      String
  phone     String?
  address   String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  receipts StockReceipt[]

  @@map("suppliers")
}
```

Relasi tambahan di model yang sudah ada:

```prisma
model Product {
  // ...
  receiptItems StockReceiptItem[]
}
```

---

## 3. State machine

```
        simpan draft              posting
  [ - ] ─────────────► DRAFT ──────────────► DITERIMA
                         │                      │
                         │ batalkan             │ koreksi
                         ▼                      ▼
                    DIBATALKAN         reversal + dokumen pengganti
                                       (status asal tetap DITERIMA)
```

| Dari | Ke | Boleh? | Efek stok |
|---|---|---|---|
| — | `DRAFT` | ya | tidak ada |
| `DRAFT` | `DRAFT` | ya (edit bebas) | tidak ada |
| `DRAFT` | `DITERIMA` | ya | **stok gudang naik** + tulis `mutasi_stok` |
| `DRAFT` | `DIBATALKAN` | ya | tidak ada |
| `DITERIMA` | `DRAFT` | **tidak** | — |
| `DITERIMA` | `DIBATALKAN` | **tidak** | pakai reversal |
| `DIBATALKAN` | apa pun | **tidak** | — |

### Koreksi dokumen yang sudah DITERIMA

Sesuai `docs/obbel-coffee-ai-docs/24-data-consistency-correction-reversal.md`:

1. Backend menghitung **impact preview**: produk mana, delta berapa, apakah menghasilkan
   stok gudang negatif (misal barangnya sudah terlanjur didistribusikan ke booth).
2. Kalau ada baris yang membuat saldo negatif → tolak, buat `ReconciliationCase`.
3. Kalau aman → tulis mutasi `REVERSAL` sebesar qty asal (negatif), lalu posting dokumen
   pengganti dengan `revisionOfId` menunjuk dokumen asal.
4. Dokumen asal **tetap** berstatus `DITERIMA` dan tetap terbaca di riwayat. Yang berubah
   hanyalah penandanya sebagai "sudah direvisi oleh TRM-xxx".

---

## 4. Endpoint

Semua di bawah `@Roles(UserRole.ADMIN)` kecuali yang ditandai. Owner boleh membaca.

| Method | Path | Guna |
|---|---|---|
| `GET` | `/stock-receipts` | Daftar + filter `status`, `supplierId`, `dateFrom`, `dateTo`, `q`; paginasi |
| `GET` | `/stock-receipts/:id` | Detail + item |
| `GET` | `/stock-receipts/:id/movements` | Baris `mutasi_stok` yang lahir dari dokumen ini |
| `POST` | `/stock-receipts` | Buat. Body punya `status: "DRAFT" \| "DITERIMA"` — tombol Simpan vs Posting |
| `PATCH` | `/stock-receipts/:id` | Ubah. **Hanya kalau status `DRAFT`** |
| `PATCH` | `/stock-receipts/:id/status` | `DRAFT → DITERIMA` (posting) atau `DRAFT → DIBATALKAN` |
| `POST` | `/stock-receipts/:id/revise` | Reversal + dokumen pengganti untuk yang sudah `DITERIMA` |
| `GET` | `/suppliers` · `POST` · `PATCH /:id` | Master supplier |

### DTO

```ts
export class CreateStockReceiptItemDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsInt() @Min(0) qtyOrdered?: number;
  @IsInt() @IsPositive() qtyReceived!: number;
  @IsInt() @Min(0) purchasePrice!: number;   // Rupiah integer
  @IsOptional() @IsString() @MaxLength(120) condition?: string;
  @IsOptional() @IsDateString() expiredAt?: string;
}

export class CreateStockReceiptDto {
  @IsString() idempotencyKey!: string;          // wajib — cegah double-tap
  @IsDateString() receiptDate!: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsString() @MaxLength(120) supplierName?: string;
  @IsOptional() @IsString() @MaxLength(60) deliveryNote?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsIn(['DRAFT', 'DITERIMA']) status?: 'DRAFT' | 'DITERIMA';
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => CreateStockReceiptItemDto) items!: CreateStockReceiptItemDto[];
}
```

### Validasi

| Kode error | Kondisi |
|---|---|
| `PRODUCT_INACTIVE` | Ada `productId` yang tidak ada atau `active = false` |
| `DUPLICATE_PRODUCT` | Satu produk muncul dua kali dalam satu dokumen |
| `RECEIPT_NOT_EDITABLE` | `PATCH` pada dokumen yang bukan `DRAFT` |
| `INVALID_STATUS_TRANSITION` | Perpindahan status di luar tabel bagian 3 |
| `RECEIPT_DATE_FUTURE` | `receiptDate` melewati hari ini (Asia/Jakarta) |
| `SUPPLIER_REQUIRED` | `supplierId` dan `supplierName` dua-duanya kosong |

---

## 5. Alur posting (yang wajib atomik)

```ts
// stock-receipts.service.ts — posting DRAFT → DITERIMA
await this.prisma.$transaction(async (tx) => {
  // 1. kunci & validasi ulang status di dalam transaksi
  const receipt = await tx.stockReceipt.findUnique({ where: { id }, include: { items: true } });
  if (receipt.status !== 'DRAFT') throw new DomainError('INVALID_STATUS_TRANSITION', ...);

  // 2. per item: tulis mutasi + naikkan saldo + update rekap bulanan
  for (const item of receipt.items) {
    await this.stockLedger.write(tx, {
      productId:    item.productId,
      locationType: 'WAREHOUSE',
      locationId:   WAREHOUSE_PUSAT_ID,
      movementType: 'PENERIMAAN',
      qtyChange:    +item.qtyReceived,        // bertanda positif
      refDocType:   'stock_receipt',
      refDocId:     receipt.id,
      refDocNumber: receipt.receiptNo,
      date:         receipt.receiptDate,      // tanggal BISNIS, bukan now()
      actorId:      user.sub,
    });
  }

  // 3. tandai terposting
  await tx.stockReceipt.update({
    where: { id },
    data: { status: 'DITERIMA', postedAt: new Date(), postedById: user.sub },
  });

  // 4. audit log
});
```

`stockLedger.write()` adalah satu-satunya pintu tulis mutasi stok — detailnya di
[02-mutasi-stok.md](02-mutasi-stok.md). Ia yang menulis `mutasi_stok`, menaikkan
`WarehouseStock`, dan meng-update `rekap_stok` dalam transaksi yang sama.

---

## 6. Layar (admin_web)

Rute: `/stok/penerimaan`. Meniru struktur jsBerkah `pembelian/penerimaan-barang`.

### 6.1 Daftar — `/stok/penerimaan`

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Penerimaan Stok Gudang                          [ + Penerimaan Baru ]      │
├────────────────────────────────────────────────────────────────────────────┤
│ [Cari no/supplier]  [Status ▾]  [Periode ▾]         [Kolom ▾]  [Cetak]     │
├────┬─────────────────┬────────────┬──────────────┬───────────┬──────┬──────┤
│ ›  │ No. Penerimaan  │ Tanggal    │ Supplier     │     Total │ Stat │ Aksi │
├────┼─────────────────┼────────────┼──────────────┼───────────┼──────┼──────┤
│ ›  │ TRM-M4K2-A81F   │ 22 Sep 26  │ CV Kopi Jaya │ 4.500.000 │ ✓    │  ⋮   │
│ ›  │ TRM-M4J8-77C2   │ 21 Sep 26  │ Toko Susu Mk │ 1.200.000 │ ⋯    │  ⋮   │
└────┴─────────────────┴────────────┴──────────────┴───────────┴──────┴──────┘
```

- Baris bisa **di-expand** (ikon `›`) menampilkan tabel item inline:
  `Produk | Qty Order | Qty Terima | Selisih | Harga | Subtotal | Kondisi`.
- Badge status: `Draft` (abu), `Diterima` (hijau), `Dibatalkan` (merah).
- Filter periode: Semua Tanggal / Hari Ini / Bulan Ini / Tahun Ini / Periode Custom.
- Menu Aksi per baris: Lihat Detail · Ubah (hanya DRAFT) · Posting (hanya DRAFT) ·
  Batalkan (hanya DRAFT) · Revisi (hanya DITERIMA) · Cetak.
- Kolom bisa disembunyikan lewat menu `Kolom` dan pilihannya disimpan di localStorage.

### 6.2 Form — `/stok/penerimaan/baru`

```
┌── Informasi Dokumen ───────────────────────────────────────────────────────┐
│ Tanggal Terima *  [ 22/09/2026 ]     Supplier *   [ CV Kopi Jaya      ▾ ]  │
│ No. Surat Jalan   [ SJ-0912      ]   Catatan      [ ................... ]  │
└────────────────────────────────────────────────────────────────────────────┘

┌── Item Barang ─────────────────────────────────────────── [ + Tambah Baris ]┐
│ Produk            │ Qty Terima │ Harga Beli │   Subtotal │ Kondisi  │  ✕   │
│ [Es Kopi Susu ▾]  │ [− 50 +]   │ [  12.000] │   600.000  │ [Baik  ] │  ✕   │
│ [Susu UHT 1L  ▾]  │ [− 24 +]   │ [  18.500] │   444.000  │ [Baik  ] │  ✕   │
├───────────────────┴────────────┴────────────┴────────────┴──────────┴──────┤
│                                              Total  Rp1.044.000            │
└────────────────────────────────────────────────────────────────────────────┘

                                   [ Batal ]  [ Simpan Draft ]  [ Posting ]
```

Aturan form:

- Qty memakai stepper `−/+` sesuai pedoman UI Obbel, bukan input bebas.
- Harga beli menampilkan format Rupiah saat blur (`Rp12.000`) tapi mengirim integer.
- Produk yang sudah dipilih hilang dari dropdown baris lain (cegah duplikat).
- Tombol **Posting** memunculkan modal konfirmasi berisi ringkasan: jumlah item,
  total qty, total rupiah, dan peringatan *"Setelah diposting, dokumen tidak bisa
  diubah. Koreksi hanya lewat revisi."*
- `idempotencyKey` dibuat sekali saat form dibuka (UUID) dan ikut terkirim di submit.

### 6.3 Detail — `/stok/penerimaan/[id]`

Header dokumen + tabel item + panel **Dampak Stok** yang menampilkan baris `mutasi_stok`
hasil posting (`qty_before → qty_after` per produk), plus tombol Cetak dan Revisi.

---

## 7. Kriteria penerimaan

- [ ] Menyimpan DRAFT tidak mengubah `WarehouseStock` maupun menulis `mutasi_stok`.
- [ ] Posting satu dokumen 2 item menghasilkan tepat 2 baris `mutasi_stok` bertipe
      `PENERIMAAN` dengan `qty_change` positif, dan saldo gudang naik sebesar totalnya.
- [ ] Posting dua kali dengan `idempotencyKey` sama hanya menghasilkan satu set mutasi.
- [ ] `PATCH` dokumen berstatus `DITERIMA` ditolak dengan `RECEIPT_NOT_EDITABLE`.
- [ ] Dokumen bertanggal mundur (misal input tanggal 2 Okt untuk barang datang 30 Sep)
      masuk ke `rekap_stok` periode **September**, bukan Oktober.
- [ ] Posting yang gagal di item ke-3 tidak menyisakan mutasi item ke-1 dan ke-2.
- [ ] Revisi dokumen yang barangnya sudah habis didistribusikan ditolak dan membuat
      `ReconciliationCase`, bukan membuat saldo gudang negatif.
