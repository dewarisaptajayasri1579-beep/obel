# 11 — Notification, Printing & Offline Behavior

## 1. Notification events
Prioritas event:
- distribusi baru untuk Booth;
- restock approved/sent;
- stock critical/out;
- restock request baru untuk Admin;
- return submitted;
- discrepancy ditemukan.

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
- printReceipt(receipt)
- getStatus()
```

Implementasi Bluetooth vendor/package dipisah dari business logic.

### Receipt minimum
- Logo/nama Obbel;
- Booth;
- nomor transaksi;
- waktu;
- item, qty, harga;
- total;
- metode pembayaran;
- petugas optional;
- footer terima kasih;
- IG/WA optional dari setting.

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
