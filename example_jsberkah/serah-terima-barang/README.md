# serah-terima-barang — bukan pola yang cocok untuk "Terima Stok Gudang"

Disalin karena namanya paling dekat dengan "Terima Barang", tapi **UX-nya berbeda**
dari yang Anda minta:

- Baris item **ditambah satu per satu** (`ProductCodeInput` — ketik kode, pilih dari
  saran, baris baru muncul sendiri). Tabelnya **tidak** terisi otomatis semua produk.
- Arahnya keluar dari gudang ke Sales (Gudang → Sales), bukan barang masuk ke gudang.
- Satu tombol simpan saja, langsung berstatus "Menunggu Konfirmasi" — tidak ada
  Draft/Posting/Revisi terpisah.

Cocok sebagai rujukan pola **kolom dinamis + product picker** (`GridCells.tsx`,
lihat `_pendukung/components/transaksi/`) kalau nanti dibutuhkan transaksi lain yang
memang harus pilih produk satu-satu. **Bukan** dasar untuk Terima Stok Gudang.
