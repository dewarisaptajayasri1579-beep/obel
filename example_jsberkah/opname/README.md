# opname — pola yang COCOK dengan Terima Stok Gudang

Namanya berbeda, tapi **cara kerjanya persis** yang Anda deskripsikan untuk Terima Stok
Gudang. Lihat `baru/OpnameForm.tsx`:

| Yang Anda minta | Yang ada di OpnameForm.tsx |
|---|---|
| Tabel otomatis terisi semua produk | `quotaItems` — daftar FIXED, bukan grid dinamis. Tidak ada tambah/hapus baris, tidak ada pemilihan produk |
| Kolom Qty per produk | Satu `NumberCell` per baris |
| Enter di field atas → turun ke baris pertama | `focusCell(0)` dipanggil begitu Select (di sana: Toko) berubah |
| Enter di satu baris → baris berikutnya | `advance(rowIndex)` → `focusCell(rowIndex + 1)`, baris terakhir keluar tabel ke tombol Simpan |
| Simpan | Tombol tunggal + `RincianKonfirmasi` (ringkasan sebelum submit) |

## Yang TIDAK ada di sini, tapi Anda minta

- **Draft vs Posting**: Opname jsBerkah cuma satu status akhir ("Selesai", langsung
  final). Anda minta dua tahap — Simpan (Draft) dulu, baru Posting terpisah, plus
  Revisi sesudahnya. Ini harus ditambahkan, bukan disalin langsung.
- **Nomor Bukti otomatis** ditampilkan di form: Opname jsBerkah generate nomor di
  backend saat submit, tidak ditampilkan di layar form (beda dari GRN/PO yang biasa
  menampilkan "Otomatis saat disimpan").
- **Keterangan (opsional)**: tidak ada field catatan bebas di Opname — perlu ditambah.
- **Dikelompokkan per kategori + urut abjad**: `quotaItems` di sini tampil sebagai satu
  daftar datar, tidak dikelompokkan. Perlu ditambah persis seperti pola pengelompokan
  kategori yang sudah ada di `TabMain.tsx`/`TabMutasiStok.tsx` milik Obbel sendiri.

## Rencana

`renderKelompok`-style grouping dari `TabMain.tsx` Obbel digabung dengan pola grid fixed
+ keyboard-cascade dari `OpnameForm.tsx` ini, plus status Draft/Posting/Revisi menyusul
pola `StockDistribution`/`StockReceipt` yang sudah dirancang di
`docsV2/01-penerimaan-stok-gudang.md`.
