# example_jsberkah

Salinan kode dari project **jsBerkah** — menu `Data Operasional → Produk` (`/master/produk`).

**Referensi tampilan saja.** Jangan di-import, jangan di-build. Folder ini tidak
terhubung ke aplikasi mana pun di repo ini; isinya dibaca untuk melihat pola halaman,
lalu ditulis ulang menyesuaikan arsitektur Obel.

Sumber: `~/Documents/Projects/ONY/jsBerkah/website` dan `.../jsBerkah/backend`.
Disalin apa adanya, tanpa modifikasi.

---

## Struktur

```
master-produk/          27 file · ±5.100 baris — halaman /master/produk
_pendukung/             yang dipanggil halaman itu
├── lib/                helper presentasi
├── components/         komponen bersama
├── api/produk/         route handler Next.js (jsBerkah akses DB langsung)
└── stock-produk/       service NestJS penghasil rekap stok
```

---

## master-produk — peta file

### Halaman utama

| File | Baris | Isi |
|---|---|---|
| `page.tsx` | 233 | Server component. Ambil data awal, resolve periode, render `ProdukPanel` |
| `ProdukPanel.tsx` | **1.060** | Inti tampilannya. Tabel + filter + toggle kolom + baris expand + menu aksi |
| `ProdukTabs.tsx` | 92 | Navigasi tab di level daftar |
| `types.ts` | 88 | Bentuk data yang dipakai seluruh halaman |
| `PilihProduk.tsx` | 44 | Selector produk, dipakai ulang di tempat lain |
| `PilihLokasiMutasi.tsx` | 84 | Selector lokasi (gudang/sales/toko) |

### Tab di halaman daftar

| File | Baris | Isi |
|---|---|---|
| `TabMutasiStok.tsx` | **498** | **Riwayat mutasi stok** — paling relevan untuk docsV2 dok 02 |
| `TabSebaran.tsx` | 362 | Sebaran stok per lokasi |
| `TabAnalisa.tsx` | 332 | Analisa pergerakan |
| `TabRankingPenjualan.tsx` | 144 | Ranking produk terjual |

### Form & master

| File | Baris | Isi |
|---|---|---|
| `ProdukForm.tsx` | 416 | Form tambah/ubah produk |
| `form-values.ts` | 67 | Nilai awal & normalisasi form |
| `FotoProdukInput.tsx` | 162 | Upload foto produk |
| `baru/page.tsx` · `[id]/edit/page.tsx` | 74 · 95 | Rute tambah & ubah |
| `arsip/page.tsx` | 48 | Produk yang dinonaktifkan |

### Rekap stok per produk — `[id]/stok/`

Bagian yang paling dekat dengan docsV2 dok 03.

| File | Baris | Isi |
|---|---|---|
| `[id]/stok/page.tsx` | 182 | Halaman rekap stok satu produk |
| `[id]/stok/RekapStokTabs.tsx` | 183 | **Tabel saldo awal / debet / kredit / saldo akhir per lokasi** |
| `[id]/stok/mutasi/page.tsx` | 179 | Kartu stok — daftar mutasi dengan saldo berjalan |
| `[id]/stok/PeriodeStokFilter.tsx` | 74 | Filter periode |
| `[id]/stok/HargaRataRataTab.tsx` | 101 | Harga rata-rata pembelian |
| `[id]/stok/stok-labels.ts` | 57 | Label jenis mutasi → teks Indonesia |

### Cetak & ekspor

| File | Baris | Isi |
|---|---|---|
| `ProdukReportPreviewModal.tsx` | 142 | Pratinjau sebelum cetak |
| `print/page.tsx` · `print/LaporanProdukPrintable.tsx` | 74 · 122 | Cetak daftar produk |
| `[id]/stok/print/page.tsx` · `LaporanRekapStokPrintable.tsx` | 56 · 151 | Cetak rekap stok |

---

## _pendukung

### lib/ — helper presentasi

| File | Guna | Layak diadopsi? |
|---|---|---|
| `format.ts` | Format Rupiah & angka | Ya |
| `report-period.ts` | Resolusi filter periode | Ya — **tapi kunci ke `Asia/Jakarta`** |
| `pagination.ts` | Kontrak paginasi | Ya |
| `use-column-visibility.ts` | Toggle kolom, disimpan per pengguna | Sudah ada di Obel |
| `produk-filter.ts` | Filter khusus produk jsBerkah | Tidak — spesifik domain sana |

### components/

| File | Guna |
|---|---|
| `TabelGayaSales.tsx` | Tabel dengan baris expand |
| `HapusDialog.tsx` | Konfirmasi hapus/nonaktif |
| `ArsipPanel.tsx` · `TautanArsip.tsx` | Pola arsip: master dinonaktifkan, tidak dihapus |
| `ReportFilterBar.tsx` | Bar filter periode seragam |

### api/produk/ — **jangan ditiru**

Route handler Next.js yang mengakses Prisma **langsung**. jsBerkah memang full-stack
Next.js. Obel tidak: `admin_web` adalah klien tipis di atas NestJS, karena dua aplikasi
Flutter harus memakai aturan bisnis yang sama. Disertakan hanya supaya terlihat data apa
yang dikirim ke komponen.

### stock-produk/ — service rekap stok

`stock-produk.service.ts` adalah penghasil angka Saldo Awal / Debet / Kredit / Saldo
Akhir yang dirujuk docsV2 dok 03. Komentar di dalamnya menjelaskan kenapa rekap dibaca
dari dua tabel cache dan tidak pernah menyentuh ledger.

---

## Yang layak ditiru

| Pola | Di file | Kenapa |
|---|---|---|
| Baris tabel bisa di-expand | `ProdukPanel.tsx` | Lihat rincian tanpa pindah halaman |
| Toggle kolom per pengguna | `ProdukPanel.tsx` + `use-column-visibility.ts` | Tabel lebar tetap terbaca |
| Filter periode seragam | `ReportFilterBar.tsx` + `report-period.ts` | Satu bahasa periode di semua laporan |
| Pratinjau sebelum cetak | `ProdukReportPreviewModal.tsx` | Tidak mencetak hasil yang salah |
| `Printable` terpisah dari layar | `print/*Printable.tsx` | Cetak punya tata letaknya sendiri |
| Arsip, bukan hapus | `ArsipPanel.tsx` | Transaksi lama tetap bisa menunjuk ke master |
| Rekap = saldo awal + masuk − keluar | `RekapStokTabs.tsx` | Dibaca seperti buku besar |
| Kartu stok dengan saldo berjalan | `[id]/stok/mutasi/page.tsx` | Riwayat yang bisa ditelusuri |

## Yang tidak berlaku di Obel

| Hal | Alasan |
|---|---|
| `app/api/*` + Prisma langsung | Obel lewat NestJS |
| Lokasi `WAREHOUSE`/`SALES`/`STORE` | Obel: `WAREHOUSE`/`SHIFT` (docsV2 dok 07) |
| Supplier, hutang, jurnal, PO | Obbel belum punya modul akuntansi |
| Istilah Debet/Kredit | Obbel memakai Masuk/Keluar |
