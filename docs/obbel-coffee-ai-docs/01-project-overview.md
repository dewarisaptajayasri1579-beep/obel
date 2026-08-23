# 01 — Project Overview

## 1. Nama Project
**Obbel Coffee & Milk — Stock, Sales & Booth Monitoring Platform**

## 2. Problem Statement
Obbel menjalankan penjualan melalui Booth keliling. Setiap Booth membawa stok produk siap jual, melakukan transaksi sepanjang shift, dapat menerima restock, lalu mengembalikan sisa stok ketika shift selesai.

Tanpa sistem terpusat, risiko yang muncul:
- stok Gudang dan Booth tidak sinkron;
- pusat terlambat tahu produk hampir habis;
- restock tidak memiliki jejak yang jelas;
- penjualan dan stok fisik sulit dicocokkan;
- selisih stok diketahui terlambat;
- Owner tidak punya satu dashboard ringkas untuk melihat kondisi bisnis.

## 3. Objective
Sistem harus membuat proses berikut dapat dilacak end-to-end:

**Gudang → Distribusi → Booth → Penjualan → Restock → Closing → Return → Gudang**

Dengan target:
- transaksi Petugas sangat cepat;
- stok dapat dipantau secara real-time;
- setiap perpindahan stok memiliki audit trail;
- pusat memperoleh early warning;
- Owner dapat melihat performa tanpa ikut mengubah data operasional.

## 4. Pengguna

### 4.1 Petugas Booth
Menggunakan Android Flutter. Fokus pada aksi cepat saat melayani pembeli.

### 4.2 Admin Pusat / Gudang
Menggunakan Web PWA. Fokus pada kontrol stok dan operasional seluruh Booth.

### 4.3 Owner / Manager
Menggunakan Android Flutter. Fokus pada monitoring dan analisa read-only.

## 5. Konsep satuan stok
Untuk V1, stok produk dinyatakan dalam **cup**.

Contoh:
- Matcha: 10 cup
- Brown Sugar: 8 cup

Tidak ada perhitungan bahan baku/resep dalam V1.

## 6. Terminologi resmi

| Istilah | Definisi |
|---|---|
| Gudang Pusat | Lokasi stok utama sebelum dialokasikan ke Booth |
| Booth | Titik/gerobak penjualan |
| Petugas Booth | User yang bertugas pada Booth dalam suatu shift |
| Shift | Periode kerja yang configurable |
| Distribusi | Pengiriman stok awal dari Gudang ke Booth |
| Restock | Tambahan stok ke Booth di tengah operasional |
| Return | Pengembalian sisa stok dari Booth ke Gudang |
| Expected Stock | Stok menurut sistem |
| Actual Stock | Hasil hitung fisik saat closing |
| Discrepancy/Selisih | Actual Stock - Expected Stock |
| Stock Movement | Ledger immutable setiap perpindahan/perubahan stok |

## 7. Non-functional requirements
- UI Bahasa Indonesia.
- Responsive untuk Admin Web.
- Android minimum target ditentukan saat setup Flutter; hindari API eksperimental tanpa kebutuhan.
- Semua aksi kritis harus idempotent.
- Perubahan stok harus atomik.
- Waktu transaksi presisi dan dapat diaudit.
- Data Owner read-only.
- Aplikasi tetap mudah dipakai user non-teknis.

## 8. UX north star
Petugas seharusnya dapat menyelesaikan transaksi penjualan normal dengan pola:

**Tap Produk → Pilih Pembayaran → Bayar & Print**

Target aksi normal: **2–4 tap**, di luar pemilihan banyak item.

Admin seharusnya dapat restock dengan:

**Klik Request → Setujui Jumlah → Kirim**

Owner seharusnya dapat memahami kondisi harian dari layar pertama tanpa membuka laporan kompleks.

## 9. Referensi visual
Gunakan folder `references/`:
- mockup Android Petugas Booth;
- mockup Web Admin Pusat;
- mockup Android Owner;
- referensi Instagram, menu, dan lokasi Obbel.

Brand utama: hijau Obbel + putih, dengan kuning/merah hanya untuk warning/error.

## Data consistency sebagai requirement P0

Konsistensi data adalah kebutuhan inti, bukan fitur tambahan. Sistem harus menerima kenyataan bahwa manusia dapat salah input dan transaksi dapat perlu dibatalkan atau direvisi.

Aturan project:
- transaksi posted tidak hard-delete;
- transaksi posted tidak diedit langsung;
- cancel menggunakan reversal;
- revision menggunakan reverse + replacement;
- stok opname menggunakan physical count + adjustment ledger;
- correction historis otomatis merestate stok, omzet, penjualan, payment, shift, discrepancy, return, dan laporan yang terdampak;
- seluruh correction dapat diaudit.

Spesifikasi normatif ada pada `24-data-consistency-correction-reversal.md`.
