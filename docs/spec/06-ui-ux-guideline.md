# 06 — UI/UX Guideline

## 1. Brand direction
- Primary: hijau Obbel.
- Background: putih / off-white.
- Neutral: abu muda.
- Success: hijau.
- Warning: amber/kuning.
- Critical/Error: merah.

Exact hex dapat diturunkan dari logo/design token saat asset final tersedia. Jangan mengambil warna berbeda-beda di setiap screen.

## 2. Design language
- clean;
- modern;
- sederhana;
- rounded card;
- border tipis atau shadow sangat ringan;
- whitespace cukup;
- hindari visual overload.

## 3. Typography hierarchy
Contoh mobile:
- KPI utama: 28–36sp, bold.
- Total bayar: 32–40sp, bold.
- Section title: 18–22sp, semibold.
- Card title: 15–17sp.
- Body: 14–16sp.
- Caption: 12–13sp.

Desktop dapat scale sesuai responsive design.

Rule: font besar harus dipakai karena informasi penting, bukan sekadar dekoratif.

## 4. Interaction principle — “banyak klik, minim ketik”
Prioritaskan:
- product card;
- segmented control;
- chip;
- +/- stepper;
- quick quantity 5/10/15/20;
- toggle;
- date preset;
- bottom navigation;
- clickable row/card;
- drawer detail.

Hindari:
- dropdown panjang bila data dapat tampil sebagai card;
- field qty bebas;
- form multi-field untuk aksi yang seharusnya sederhana;
- tabel padat pada Android.

## 5. Android Petugas
### Layout
- Portrait-first.
- Bottom nav selalu mudah dijangkau.
- Primary CTA berada di area bawah.
- Touch target minimal sekitar 44–48dp.

### POS
- Product grid 2 kolom pada phone kecil; 3 jika lebar cukup.
- Stock status terlihat tetapi tidak mengalahkan nama/harga.
- Cart sticky.

### Safety
Aksi irreversible/important seperti closing perlu confirmation; sale normal jangan terlalu banyak confirmation.

## 6. Admin Web
- Sidebar desktop.
- Sticky top bar untuk global actions/notifications.
- Dashboard tidak lebih dari 4–6 KPI utama di first viewport.
- Quick filter default; advanced filter dibuka saat dibutuhkan.
- Drawer detail lebih disukai daripada pindah halaman untuk inspeksi singkat.
- **Indikator filter aktif**: setiap search input/`Select` filter pada daftar transaksi WAJIB menandai secara visual saat nilainya bukan default (bukan "Semua"/kosong) — border berubah amber + titik indikator kecil (`Select` prop `active`), search input juga border amber + tombol clear (×). Tombol "Reset Filter" muncul otomatis begitu ada filter aktif untuk mengembalikan semuanya ke default sekali klik. Tujuannya supaya user yang melihat data sedikit/kosong langsung sadar itu akibat filter, bukan data memang kosong. Referensi implementasi: `apps/admin_web/src/components/ui/Select.tsx` (prop `active`) dan `apps/admin_web/src/app/stok/penerimaan/page.tsx`. Pola ini wajib dipakai di SEMUA halaman daftar transaksi baru, bukan cuma yang sudah ada.
- **Filter tidak boleh hilang saat pindah menu**: semua state filter (search, status, dropdown) pada daftar transaksi WAJIB disimpan lewat `usePersistedFilter` (`apps/admin_web/src/lib/use-persisted-filter.ts`, localStorage per storageKey) — bukan `useState` polos, karena Next.js App Router meng-unmount halaman total saat ganti route sehingga `useState` biasa balik ke default begitu user kembali ke menu itu.
- **Filter Booth & Petugas tersinkron lintas menu Transaksi Booth**: khusus filter Booth dan Petugas di grup menu "Transaksi Booth" (Kasir, Terima Stok, Check In-Check Out), WAJIB pakai storageKey BERSAMA lewat konstanta `TRANSAKSI_BOOTH_FILTER_KEYS` (di file yang sama) — supaya begitu user pilih Booth/Petugas di satu menu, menu lain di grup itu otomatis ikut menampilkan filter yang sama. Filter lain (status, periode, tab, search) tetap independen per halaman.

## 7. Owner Android
- Executive/read-only feel.
- First viewport harus memuat omzet, cup, active Booth, attention.
- Grafik sederhana, tidak lebih dominan dari angka.
- Alert merah hanya untuk hal yang benar-benar perlu perhatian.

## 8. Status color semantics
- Green: normal/safe/success.
- Yellow: approaching threshold/pending attention.
- Red: out of stock, discrepancy material, rejected/error.
- Blue/neutral: information/in transit/waiting.

Jangan gunakan merah untuk informasi biasa.

## 9. Loading
- Skeleton untuk dashboard/list.
- Button mutation berubah menjadi loading dan disable.
- Jangan menghapus data lama di layar hanya karena refresh berlangsung jika masih valid.

## 10. Empty states
Contoh:
- “Belum ada stok masuk.”
- “Belum ada transaksi pada shift ini.”
- “Tidak ada permintaan restock yang menunggu.”

Empty state harus memberi konteks, bukan sekadar “No data”.

## 11. Error copy
Gunakan bahasa operasional:
- “Stok Matcha tidak cukup. Tersedia 2 cup.”
- “Transaksi belum tersimpan. Periksa koneksi lalu coba lagi.”

Hindari menampilkan stack trace atau pesan DB.

## 12. Accessibility
- Jangan mengandalkan warna saja; gunakan label/icon.
- Contrast teks memadai.
- Angka qty/nominal dapat dibaca cepat.
- Support font scaling secara wajar.

## 13. References
Lihat `references/01-android-petugas-booth-mockup.png`, `02-web-admin-pusat-mockup.png`, dan `03-android-owner-mockup.png`.

## UX untuk Revisi dan Pembatalan

Pada posted transaction jangan tampilkan inline editable field. Tampilkan data read-only dan action eksplisit:
- **Revisi Transaksi**
- **Batalkan Transaksi**
- **Koreksi Penerimaan**
- **Hitung Ulang / Recount**

Sebelum confirm correction, tampilkan **Sebelum → Sesudah → Dampak Bersih** untuk stock, omzet, payment, dan related shift/return.

Gunakan banyak click/tap untuk reason dan quantity; note hanya wajib saat reason `OTHER` atau kondisi tertentu.
