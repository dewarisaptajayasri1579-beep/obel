# 04 — User Flow

## A. Flow Petugas Booth — Hari Kerja

```text
Login
→ Sistem menentukan assignment Booth + Shift
→ Lihat Beranda
→ Bila ada distribusi pending: Lihat & Terima Stok
→ Shift aktif
→ Jual produk sepanjang shift
→ Jika stok rendah: Minta Restock
→ Jika restock dikirim: Terima Restock
→ Menjelang selesai: Tutup Shift
→ Hitung stok fisik
→ Sistem hitung selisih
→ Konfirmasi Closing
→ Ajukan Return Sisa Stok
→ Menunggu Admin menerima Return
→ Selesai
```

### A1. Login
1. User input username/password.
2. Auth sukses.
3. Sistem resolve role `BOOTH_STAFF`.
4. Sistem cari shift assignment hari ini.
5. Jika belum ada assignment, tampilkan empty state dan kontak Admin; jangan biarkan membuat sale tanpa Booth/shift.

### A2. Receive initial distribution
1. Beranda menampilkan card “Ada Stok Masuk”.
2. Petugas tap.
3. Lihat detail product + qty.
4. Petugas cek fisik.
5. Jika sesuai → `Terima`.
6. Jika tidak sesuai → `Laporkan Selisih` dan isi qty aktual dengan stepper.
7. Backend memindahkan qty dari in-transit menjadi Booth stock sesuai rule yang dipilih Admin pada discrepancy handling.

### A3. Sale
1. Tap menu Jual.
2. Tap product card.
3. Qty default +1 setiap tap; cart dapat diedit dengan +/-.
4. Tap cart.
5. Pilih Tunai atau QRIS.
6. Tap `Bayar & Print Nota`.
7. Backend validasi stock dan shift.
8. Jika sukses, sale `PAID`, stock berkurang, movement tercatat.
9. Print receipt bila printer tersedia.

### A4. Restock request
1. Petugas melihat warning.
2. Tap `Minta Restock`.
3. Pilih product.
4. Pilih quick qty 5/10/15/20 atau +/-.
5. Submit.
6. Status `REQUESTED`.
7. Admin menindaklanjuti.

### A5. Receive restock
1. Notifikasi restock telah dikirim.
2. Petugas buka detail.
3. Cek fisik.
4. Tap Terima.
5. Stock Booth bertambah atomik.

### A6. Closing
1. Tap `Tutup Shift`.
2. Sistem freeze/lock normal sale pada titik final confirmation; sebelum itu Petugas dapat kembali.
3. Sistem tampilkan expected stock per produk.
4. Petugas hitung actual dan input dengan +/-.
5. Sistem hitung discrepancy.
6. Untuk item selisih, alasan wajib dipilih.
7. Confirm closing.
8. Sistem membuat stock count/discrepancy records.
9. Sistem menyiapkan return qty = actual stock yang masih ada di Booth.

### A7. Return
1. Petugas review return.
2. Submit `Kembalikan Stok`.
3. Return status `SUBMITTED`/`IN_TRANSIT`.
4. Booth stock diperlakukan locked/in transit sesuai implementasi.
5. Admin menerima fisik.
6. Saat Admin confirm, warehouse stock bertambah.

---

## B. Flow Admin Pusat

```text
Login
→ Dashboard Pusat
→ Siapkan distribusi awal
→ Kirim stok ke Booth
→ Pantau receipt
→ Pantau sale & stock
→ Tindaklanjuti low-stock / restock request
→ Kirim restock
→ Pantau closing
→ Terima return
→ Investigasi discrepancy
→ Laporan
```

### B1. Distribusi
1. Klik Booth card.
2. Pilih produk.
3. Qty via quick buttons/stepper.
4. Review summary.
5. Kirim.
6. Warehouse available stock berkurang/di-reserve sesuai status model; lihat business rule.
7. Petugas menerima.

### B2. Restock
1. Dashboard menampilkan request.
2. Klik request.
3. Cek stock Gudang.
4. Setujui qty.
5. Status prepared/sent.
6. Petugas receive.

### B3. Return
1. Admin melihat return pending.
2. Cocokkan fisik dengan submitted return.
3. Jika sama → Receive.
4. Jika berbeda → masukkan actual received dan alasan/discrepancy.
5. Warehouse stock bertambah actual received.

---

## C. Flow Owner

```text
Login
→ Dashboard Executive
→ Lihat omzet/cup/booth aktif/alert
→ Tap alert atau ranking
→ Drill down Booth / produk / stock / discrepancy
→ Laporan
```

Tidak ada mutation operasional.

## Flow Admin — Koreksi Data

```text
Cari transaksi
→ buka Detail
→ Lihat Riwayat Versi
→ klik Revisi / Batalkan
→ pilih reason
→ ubah data menggunakan click/+/-
→ backend Impact Preview
→ tampilkan dampak stok/omzet/payment/shift/return
→ Admin Konfirmasi
→ backend reversal + replacement/correction atomik
→ reconciliation
→ success + nomor correction
```

## Flow Admin — Stock Opname

```text
Pilih Gudang/Booth
→ snapshot expected stock
→ input physical count
→ review selisih
→ pilih reason bila ada selisih
→ confirm
→ adjustment movement
→ update stock projection
→ discrepancy report
```

Confirmed opname tidak diedit. Bila salah hitung/input, gunakan Recount/Revision.
