# 11 — Notification, Printing & Offline Behavior

## 1. Notification events
Prioritas event:
- distribusi baru untuk Booth;
- restock approved/sent;
- stock critical/out;
- restock request baru untuk Admin;
- return submitted;
- discrepancy ditemukan.

Notifikasi Barista (`GET /notifications` dan WebSocket `/notifications`, `NotificationsService.getForBooth`) diturunkan dari kondisi saat ini, bukan log event: stok Menipis/Kritis/Habis di Booth-nya, kiriman berstatus SENT, restock APPROVED, dan restock REJECTED hari ini. Tidak ada status "sudah dibaca": notifikasi hilang sendiri setelah urusannya selesai (kiriman diterima, stok diisi ulang). `createdAt` adalah waktu kejadian aslinya (stok terakhir berubah, kiriman dikirim, restock disetujui/ditolak) dan daftar diurutkan terbaru di atas.

## 2. PWA Admin notification
MVP:
- in-app notification center;
- badge realtime;
- toast untuk event baru.

Web Push dapat ditambahkan setelah permission flow dan HTTPS production siap.

## 3. Android native push
Rekomendasi: Firebase Cloud Messaging. Backend API mengirim trigger ke FCM melalui service/webhook internal saat event terjadi.

Push bukan sumber kebenaran. Saat user membuka app, selalu fetch server state.

## 4. Thermal printer
Buat abstraction:
```text
ReceiptPrinter
- connect()
- disconnect()
- printLines(lines)  // baris struk yang sudah disusun web
- getStatus()
```

Implementasi Bluetooth vendor/package dipisah dari business logic.

### Receipt minimum
- Nama perusahaan (dari Profil Perusahaan: alamat dan telepon bila diisi);
- nomor transaksi;
- waktu (Asia/Jakarta, format struk client `29/09/2026 12:00`);
- item, qty, harga, jumlah item;
- Subtotal dan Diskon bila ada diskon, lalu total;
- metode pembayaran;
- User (Barista yang menjual) dan No booth (nama Booth), keduanya di blok info di bawah Order Number;
- penanda `** REPRINT BILL **` pada salinan;
- footer `Terima kasih`;
- IG/WA optional dari setting.

### Susunan struk (aplikasi PWA Barista)
Struk disusun di **web** (`admin_web/src/lib/receipt.ts`) sebagai daftar baris yang sudah dibungkus dan dirata ke lebar kertas 58 mm (32 karakter, judul lebar ganda 16). Satu susunan itu dipakai untuk cetak Bluetooth, teks WhatsApp (blok monospace), cetak browser, dan Pratinjau Struk di detail transaksi Admin (Transaksi Booth > Kasir; ditandai `** REPRINT BILL **` karena struk aslinya sudah dicetak Barista). Aplikasi Android (`booth_pwa_flutter`) hanya menerjemahkan baris ke ESC/POS lewat aksi jembatan `printer.printLines`, sehingga format struk bisa diubah dengan deploy web tanpa membangun ulang APK. Label mengikuti struk client (Date, Order Number, Total Item, Discount, Total, Payment), isi data tetap bahasa Indonesia, dan nominal tanpa `Rp`. Judul perusahaan dipecah: kata pertama di baris atas, sisanya di bawah (`OBBEL` / `COFFEE & MILK`). APK lama yang belum mengenal `printer.printLines` dilayani lewat aksi lama `printer.print` (format lama) sampai semua HP diperbarui.

### Struk Ringkasan Shift
Barista mencetaknya dari langkah Laporan layar Check-Out (tombol **Cetak Ringkasan Penjualan**, hanya lewat printer Bluetooth di aplikasi Barista). Sumbernya `GET /shifts/:id/sales-summary`, dibaca ulang saat dicetak. Bentuknya mengikuti struk "Ringkasan Penjualan" client (label bahasa Indonesia) dengan garis, info dan nominal yang sama dengan struk penjualan. Tanpa kop perusahaan (laporan internal, seperti struk client). Isi: Tanggal (tanggal bisnis shift), Shift, User, No booth, Penjualan, Diskon, TOTAL, Invoices (jumlah dan rata-rata per invoice), Ringkasan Pembatalan (jumlah invoice, jumlah item, total; hanya bila ada), Ringkasan Pembayaran (Tunai, QRIS, TOTAL; sale Split masuk ke dua sisi), Ringkasan Berdasarkan Produk per kategori (`x2 Nama  nominal` dan `TOTAL (qty) nominal`). Biaya Layanan, Pajak, Pembulatan, Tipe Penjualan dan Tamu pada struk client tidak ada di sistem ini sehingga tidak dicetak. APK lama menampilkan pesan untuk memperbarui aplikasi.

## 5. Print rule
- Server sale harus sukses terlebih dahulu.
- Jika print gagal, sale tetap sukses.
- UI menampilkan `Print Ulang`.
- Reprint tidak membuat sale baru.

## 6. Offline strategy — MVP
Aplikasi dibuat **online-first** untuk mutation yang memengaruhi stok.

Saat offline:
- cache katalog dan data terakhir boleh tampil dengan label “Data terakhir”.
- distribusi receive, restock receive, closing, return memerlukan online.
- sale finalization pada MVP memerlukan koneksi server agar stok tidak oversell.

## 7. Offline sales phase berikutnya
Jika operasional membutuhkan transaksi walau tanpa sinyal, implementasikan queue lokal:
- client-generated sale UUID/idempotency key;
- local SQLite/Drift;
- provisional stock decrement;
- sync worker;
- conflict handling jika server stock berbeda;
- clear “Belum Sinkron” state.

Jangan implementasikan offline sale setengah-setengah tanpa idempotency/conflict strategy.

## 8. Network UX
- timeout message jelas;
- retry button;
- mutation button disable saat request;
- jangan auto-retry mutation tanpa idempotency key.
