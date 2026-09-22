# docsV2 — Perubahan Pencatatan Stok

Spesifikasi perubahan pencatatan stok Obbel Coffee & Milk. Dokumen ini **menggantikan**
cara stok gudang dicatat hari ini, bukan menambah fitur di sampingnya.

Referensi pola: `~/Documents/Projects/ONY/jsBerkah` — modul `goods-receipt`,
`stock-ledger`, `stock-produk`, dan halaman `pembelian/penerimaan-barang`.

## Daftar dokumen

| Dok | Isi |
|---|---|
| [01-penerimaan-stok-gudang.md](01-penerimaan-stok-gudang.md) | Dokumen penerimaan stok gudang — model, status, endpoint, layar |
| [02-mutasi-stok.md](02-mutasi-stok.md) | Tabel `mutasi_stok` — buku besar pergerakan stok per produk |
| [03-rekap-stok.md](03-rekap-stok.md) | Tabel `rekap_stok` — saldo bulanan per produk |
| [04-migrasi.md](04-migrasi.md) | Dampak ke kode yang sudah ada + urutan migrasi |
| [05-pergerakan-stok.md](05-pergerakan-stok.md) | Daftar tertutup peristiwa yang mengubah stok, termasuk Stok Rusak |
| [06-data-operasional.md](06-data-operasional.md) | Lima poin data operasional + early warning stok menipis |
| [07-siklus-shift.md](07-siklus-shift.md) | Daftar transaksi per peran + **stok dipegang shift, bukan booth** |
| [08-rencana-penyesuaian.md](08-rencana-penyesuaian.md) | **Urutan pengerjaan** — mengganti urutan tahap di dok 04 |
| [09-checkin-checkout-petugas.md](09-checkin-checkout-petugas.md) | Check-In/Check-Out Petugas Booth — topik **berbeda** dari 01–08 (bukan perubahan pencatatan stok), ditaruh di sini atas permintaan langsung, bukan bagian dari rencana rearsitektur stok |

Urutan baca yang disarankan: **07** (siapa memegang stok) → **05** (apa saja yang
menggerakkannya) → **02** (di mana dicatat) → **03** (bagaimana direkap) → **01**
(dokumen penerimaan) → **06** (bagaimana dibaca & diperingatkan) → **04** (cara
migrasinya).

> **Dok 07 mengubah keputusan di dok 02 & 05.** Di mana pun tertulis
> `location_type = BOOTH`, yang berlaku adalah `SHIFT` dengan
> `location_id = ShiftSession.id`. Dok 02 sudah disesuaikan; dok 05 dibaca dengan
> penggantian itu.

## Masalah yang diselesaikan

Kondisi sekarang di `backend/src/modules`:

1. **Stok masuk gudang tidak punya dokumen.** Satu-satunya cara menambah stok gudang
   adalah `POST /warehouse-stock/adjust` yang mengirim *target qty*. Tidak ada nomor
   dokumen, tidak ada supplier, tidak ada harga beli, tidak ada rincian item, tidak ada
   draft/posting. Semua penerimaan barang tercatat sebagai `ADJUSTMENT` — tidak bisa
   dibedakan dari koreksi susut.
2. **Mutasi tidak bisa dibaca.** Tabel `stock_movements` terisi lengkap tetapi tidak ada
   satu pun endpoint yang membacanya. Tidak ada kartu stok, tidak ada `qty_before`/
   `qty_after`, dan arah mutasi harus disimpulkan dari kombinasi `movement_type` +
   `from_booth_id`/`to_booth_id`.
3. **Tidak ada rekap periode.** Pertanyaan "bulan Agustus produk X masuk berapa, keluar
   berapa" hanya bisa dijawab dengan memindai seluruh tabel mutasi sejak awal
   pemakaian — biayanya naik terus seumur aplikasi.
4. **Stok rusak tidak punya jalur sendiri.** Cup tumpah dan barang kedaluwarsa hanya
   bisa dicatat sebagai `ADJUSTMENT` yang tidak bisa dibedakan dari koreksi salah
   hitung, sehingga kerugian karena kerusakan tidak pernah bisa dihitung.
5. **Stok menipis tidak memberitahu siapa pun.** Threshold sudah ada di master, tapi
   tidak ada yang mengevaluasinya saat stok turun — Admin baru tahu kalau kebetulan
   membuka halaman stok, atau setelah petugas mengeluh.

## Tiga perubahan

```
┌─────────────────────┐
│ Penerimaan Stok     │  dokumen baru: nomor, supplier, item, harga,
│ Gudang (GRN)        │  status DRAFT → DITERIMA
└──────────┬──────────┘
           │ posting
           ▼
┌─────────────────────┐
│ mutasi_stok         │  buku besar. append-only. qty_change bertanda,
│                     │  qty_before / qty_after, tanggal bisnis
└──────────┬──────────┘
           │ ditulis bersamaan, satu transaksi
           ▼
┌─────────────────────┐
│ rekap_stok          │  cache per produk × lokasi × bulan:
│                     │  stok_awal, masuk, keluar, stok_akhir
└─────────────────────┘
```

## Aturan yang tidak berubah

Seluruh aturan di `AGENTS.md` dan `CLAUDE.md` tetap berlaku:

- Stok hanya berubah lewat domain service backend di dalam satu transaksi DB.
- Dokumen yang sudah diposting tidak dihapus atau diedit — koreksi lewat reversal.
- Rupiah integer, qty integer, timestamp UTC, tampilan `Asia/Jakarta`.
- Otorisasi di service layer, bukan di database.
