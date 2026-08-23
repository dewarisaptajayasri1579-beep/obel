# 23 — Open Decisions / Confirmation Before Production

Dokumen utama sudah cukup untuk mulai coding MVP. Item berikut tidak boleh menghambat pembuatan fondasi, tetapi harus dikonfirmasi sebelum go-live production.

## 1. Jam Shift final
Brief awal dan mockup memiliki contoh jam yang berbeda. Karena itu implementasi wajib configurable. Admin perlu memberikan:
- nama Shift 1;
- jam mulai/selesai;
- nama Shift 2;
- jam mulai/selesai;
- apakah setiap lokasi memiliki jam yang sama.

## 2. Jumlah Booth final
Referensi lokasi menampilkan 10 titik, sementara brief menyebut 14 penjaga. Jangan menyimpulkan ada 14 Booth. Import master Booth final setelah daftar dikonfirmasi.

## 3. Apakah stok yang dimaksud benar-benar “cup siap jual”
Dokumen V1 menganggap stok per menu dalam cup. Jika sebenarnya yang dibawa Petugas adalah bahan/pre-mix atau paket komponen, data model perlu inventory unit yang lebih general.

## 4. Proses fisik distribusi
Perlu konfirmasi apakah Admin yang mengantar langsung, atau ada Runner/Kurir. V1 tidak memiliki role Runner; status SENT merepresentasikan barang keluar dari Gudang dan menuju Booth.

## 5. Printer thermal
Perlu tentukan:
- brand/model;
- Bluetooth Classic/BLE/USB;
- lebar 58mm atau 80mm;
- format logo.

Code wajib memakai adapter agar model printer bisa diganti.

## 6. QRIS
V1 hanya mencatat payment method QRIS, belum memverifikasi payment otomatis. Jika ingin payment verification, tentukan provider/gateway.

## 7. Kebijakan selisih stok
Dokumen merekomendasikan adjustment otomatis ke actual saat closing dengan audit. Konfirmasi apakah:
- langsung adjustment;
- atau discrepancy harus menunggu approval Admin sebelum balance disesuaikan.

## 8. Harga estimasi kerugian
V1 memakai current sell price untuk estimasi. Jika Owner ingin nilai HPP/cost, tambahkan `cost_price` dan definisi valuation.

## 9. Sale offline
MVP online-first. Jika area Booth sering tidak ada koneksi, offline sale queue menjadi P1 prioritas tinggi.

## 10. User identity & login
Tentukan apakah login menggunakan:
- email/password;
- username/password via mapping;
- PIN cepat setelah device registered.

Mockup menampilkan username. Karena Auth dibangun sendiri di backend, login berbasis username/password dapat diimplementasikan langsung; pastikan tetap ada uniqueness constraint dan hashing password yang aman.

## 11. Stock awal Gudang
Tentukan apakah stok Gudang diinput sebagai opening balance setiap hari atau carry forward terus menerus. Rekomendasi: carry forward ledger; stock opname berkala untuk koreksi.

## 12. Return antar shift
Brief menyebut stok shift pertama pulang ke Gudang, lalu shift kedua mengambil stok lagi. V1 mendukung pola ini. Konfirmasi apakah ada lokasi yang handover langsung antar Petugas tanpa kembali Gudang; jika iya perlu flow transfer Booth/shift.

## Correction architecture baseline — sudah diputuskan

Berikut bukan lagi open decision:
- posted transaction tidak hard-delete;
- posted transaction tidak direct-edit;
- correction menggunakan reversal/replacement;
- physical count confirmed menggunakan recount bila salah;
- correction historis diperbolehkan Admin dan merestate laporan;
- no-negative-stock tetap wajib;
- conflict downstream menghasilkan reconciliation case.

Detail: `24-data-consistency-correction-reversal.md`.
