import type { LayarPanduan } from "./types";

/// Layar aplikasi Barista (/petugas), urut sesuai jalannya satu shift.
export const LAYAR_BARISTA: LayarPanduan[] = [
  {
    kode: "barista-kasir",
    peran: "barista",
    judul: "Kasir",
    ringkasan: "Mencatat penjualan, menerima pembayaran, dan mencetak nota.",
    gambar: [
      { file: "barista-kasir-1.webp", keterangan: "Daftar produk dengan sisa stok tiap produk." },
      { file: "barista-kasir-2.webp", keterangan: "Keranjang Transaksi berisi produk yang dipilih." },
      { file: "barista-kasir-3.webp", keterangan: "Pembayaran dengan pilihan Metode Pembayaran." },
    ],
    langkah: [
      { judul: "Pilih produk", isi: "Ketuk tombol + pada produk yang dibeli. Gunakan Cari menu... atau kategori untuk mempercepat pencarian." },
      { judul: "Periksa keranjang", isi: "Ketuk Lihat Keranjang untuk mengubah jumlah atau mengisi diskon, lalu ketuk Lanjut Pembayaran." },
      { judul: "Pilih metode pembayaran", isi: "Pilih Tunai, QRIS, atau Split. Untuk QRIS, tunjukkan Kode QRIS Booth kepada pelanggan." },
      { judul: "Bayar", isi: "Ketuk Bayar Sekarang. Layar Transaksi Berhasil akan tampil." },
      { judul: "Cetak nota", isi: "Ketuk Cetak Nota bila pelanggan meminta nota, lalu Transaksi Baru untuk pelanggan berikutnya." },
    ],
    perhatian: [
      // PembayaranInput: QRIS & Split wajib foto bukti bayar sebelum Bayar Sekarang aktif.
      { teks: "Pembayaran QRIS dan Split wajib disertai Foto Bukti Bayar QRIS.", tingkat: "penting" },
      // Stok dipotong di server dalam satu transaksi; produk tidak bisa melebihi sisa stok.
      { teks: "Jumlah produk tidak dapat melebihi sisa stok Booth yang tertera.", tingkat: "info" },
      { teks: "Transaksi yang belum dibayar dapat disimpan dengan Simpan Draft dan dibuka lagi dari Draft Tersimpan.", tingkat: "info" },
    ],
  },
];
