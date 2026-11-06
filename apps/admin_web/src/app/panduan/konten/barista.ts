import type { LayarPanduan } from "./types";

/// Layar aplikasi Barista (/petugas), urut sesuai jalannya satu shift.
export const LAYAR_BARISTA: LayarPanduan[] = [
  {
    kode: "barista-login",
    peran: "barista",
    judul: "Login",
    ringkasan: "Masuk ke aplikasi Barista Obbel dengan akun dari Admin.",
    tanpaShift: true,
    gambar: [{ file: "barista-login-1.webp", keterangan: "Halaman masuk Barista Obbel." }],
    langkah: [
      { judul: "Isi akun", isi: "Isi Username dan Password yang diberikan Admin. Ikon mata menampilkan atau menyembunyikan password." },
      { judul: "Masuk", isi: "Ketuk MASUK. Bila berhasil, Beranda akan terbuka." },
    ],
    perhatian: [{ teks: "Lupa password? Minta Admin mengatur ulang password Anda.", tingkat: "info" }],
  },
  {
    kode: "barista-beranda",
    peran: "barista",
    judul: "Beranda",
    ringkasan: "Pusat kerja harian: status shift, menu utama, dan tombol absen berikutnya.",
    tanpaShift: true,
    gambar: [
      { file: "barista-beranda-1.webp", keterangan: "Beranda saat shift aktif, dengan menu Kasir, Terima Stok, Stok, dan Riwayat Penjualan." },
      { file: "barista-beranda-2.webp", keterangan: "Menu Riwayat di menu bawah: Riwayat Absen, Riwayat Stok, dan Riwayat Penjualan." },
    ],
    langkah: [
      { judul: "Sebelum shift", isi: "Bila belum ada shift aktif, ketuk ABSEN BERANGKAT. Bila shift sebelumnya sudah Check-Out, ketuk ABSEN KEMBALI DI GUDANG." },
      { judul: "Selama shift", isi: "Kartu atas menampilkan Booth, nama shift, dan jam mulai. Ketuk Kasir, Terima Stok, Stok, atau Riwayat Penjualan untuk membuka menunya." },
      { judul: "Absen berikutnya", isi: "Tombol bawah berubah sesuai tahap: ABSEN TIBA DI BOOTH setelah berangkat, lalu CHECK OUT setelah tiba." },
      { judul: "Notifikasi", isi: "Ketuk ikon lonceng untuk membuka Notifikasi. Angka merah menunjukkan notifikasi yang belum dibaca." },
    ],
    perhatian: [
      { teks: "Tombol CHECK OUT baru muncul setelah Absen Tiba di Booth.", tingkat: "info" },
      { teks: "Ikon keluar di pojok kanan atas langsung mengeluarkan akun tanpa konfirmasi.", tingkat: "info" },
    ],
  },
  {
    kode: "barista-berangkat",
    peran: "barista",
    judul: "Absen Berangkat",
    ringkasan: "Absen di Gudang sebelum berangkat ke Booth. Absen ini membuka shift Anda.",
    tanpaShift: true,
    gambar: [
      { file: "barista-berangkat-1.webp", keterangan: "Konfirmasi Lokasi Anda dan Ambil Foto Selfie." },
      { file: "barista-berangkat-2.webp", keterangan: "Pilih Booth dan Konfirmasi Data Anda sebelum KONFIRMASI BERANGKAT." },
    ],
    langkah: [
      { judul: "Ambil lokasi", isi: "Ketuk Ambil Lokasi Saya. Pastikan Anda berada di Gudang." },
      { judul: "Ambil foto selfie", isi: "Ketuk Ambil Foto, lalu potret wajah Anda dengan jelas." },
      { judul: "Periksa Booth", isi: "Booth tugas Anda sudah terpilih. Ketuk pilihan Booth bila hari ini bekerja di Booth lain." },
      { judul: "Konfirmasi", isi: "Periksa Nama, Booth, Shift, dan Uang jalan, lalu ketuk KONFIRMASI BERANGKAT." },
    ],
    perhatian: [
      // BR-042: absen 4 titik, radius dari Gudang (ShiftsService.periksaLokasi).
      { teks: "Absen hanya bisa dilakukan dalam radius Gudang. Bila GPS meleset padahal Anda sudah di lokasi, minta Admin memberi izin absen.", tingkat: "penting" },
      { teks: "Terima uang jalan dari Admin. Uang jalan dikembalikan utuh saat Absen Kembali.", tingkat: "info" },
      { teks: "Akun yang belum ditugaskan ke Booth tidak bisa absen. Hubungi Admin untuk mengatur penugasan.", tingkat: "info" },
    ],
  },
  {
    kode: "barista-tiba",
    peran: "barista",
    judul: "Absen Tiba di Booth",
    ringkasan: "Absen begitu sampai di Booth. Absen ini membuka tombol CHECK OUT.",
    gambar: [{ file: "barista-tiba-1.webp", keterangan: "Konfirmasi lokasi di Booth dan foto selfie." }],
    langkah: [
      { judul: "Buka absen tiba", isi: "Di Beranda, ketuk ABSEN TIBA DI BOOTH." },
      { judul: "Lokasi dan foto", isi: "Ketuk Ambil Lokasi Saya di area Booth, lalu Ambil Foto." },
      { judul: "Konfirmasi", isi: "Ketuk KONFIRMASI TIBA." },
    ],
    perhatian: [
      { teks: "Absen hanya bisa dilakukan dalam radius Booth.", tingkat: "penting" },
      // ShiftsService.arrive: "Kasir tidak menunggu ini".
      { teks: "Kasir tetap bisa dipakai sebelum Absen Tiba, tetapi Check-Out tidak.", tingkat: "info" },
    ],
  },
  {
    kode: "barista-terima-stok",
    peran: "barista",
    judul: "Terima Stok",
    ringkasan: "Mencocokkan dan menerima kiriman stok dari Gudang Pusat.",
    gambar: [
      { file: "barista-terima-stok-1.webp", keterangan: "Daftar kiriman dengan tab Semua, Menunggu, dan Selesai." },
      { file: "barista-terima-stok-2.webp", keterangan: "Detail Penerimaan: jumlah terima per produk." },
    ],
    langkah: [
      { judul: "Pilih kiriman", isi: "Buka tab Menunggu, lalu ketuk kiriman berstatus Menunggu Diterima." },
      { judul: "Cek fisik", isi: "Hitung barang yang datang. Ubah jumlah dengan tombol minus atau plus bila berbeda dari Qty kirim." },
      { judul: "Centang produk", isi: "Centang setiap produk yang sudah dicek fisik." },
      { judul: "Isi alasan selisih", isi: "Bila jumlah berbeda, pilih alasan di Kenapa selisih?: Stok Kurang, Rusak, Stok Lebih, atau Lainnya." },
      { judul: "Konfirmasi", isi: "Ketuk Konfirmasi Penerimaan. Stok Booth bertambah sesuai jumlah yang diterima." },
    ],
    perhatian: [
      { teks: "Konfirmasi Penerimaan baru aktif setelah semua produk dicentang dan setiap selisih diberi alasan.", tingkat: "penting" },
      { teks: "Alasan Lainnya wajib diisi dengan keterangan.", tingkat: "info" },
      { teks: "Kiriman yang sudah Selesai tidak bisa diubah dari aplikasi Barista. Koreksi dilakukan oleh Admin.", tingkat: "info" },
    ],
  },
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
  {
    kode: "barista-stok",
    peran: "barista",
    judul: "Stok",
    ringkasan: "Melihat stok Booth dan mengajukan restock ke Gudang.",
    gambar: [
      { file: "barista-stok-1.webp", keterangan: "Tab Stok Booth: ringkasan status dan stok tiap produk." },
      { file: "barista-stok-2.webp", keterangan: "Tab Ajukan Restock: pilih produk dan jumlahnya." },
    ],
    langkah: [
      { judul: "Lihat stok", isi: "Tab Stok Booth menampilkan jumlah cup, batas minimum, dan status tiap produk. Gunakan Cari produk... atau Filter." },
      { judul: "Pilih produk restock", isi: "Buka tab Ajukan Restock. Centang Pilih Semua untuk memakai jumlah saran, atau atur jumlah tiap produk dengan tombol minus dan plus." },
      { judul: "Kirim pengajuan", isi: "Periksa jumlah produk dan Total di bagian bawah, lalu ketuk Kirim." },
      { judul: "Pantau status", isi: "Riwayat Pengajuan menampilkan status Diajukan, Disetujui & Dikirim, Ditolak, atau Dibatalkan beserta alasan penolakan." },
    ],
    perhatian: [
      // RestockRequestsService: RESTOCK_EXCEEDS_WAREHOUSE.
      { teks: "Jumlah restock tidak bisa melebihi stok Gudang yang tersedia.", tingkat: "info" },
      { teks: "Tombol Draft hanya menyimpan pengajuan di HP ini dan belum dikirim ke Admin.", tingkat: "penting" },
      { teks: "Restock yang disetujui dikirim sebagai kiriman baru dan diterima lewat Terima Stok.", tingkat: "info" },
    ],
  },
  {
    kode: "barista-notifikasi",
    peran: "barista",
    judul: "Notifikasi",
    ringkasan: "Kiriman stok, hasil pengajuan restock, dan stok yang menipis.",
    gambar: [{ file: "barista-notifikasi-1.webp", keterangan: "Notifikasi dikelompokkan per hari, yang belum dibaca bertanda titik." }],
    langkah: [
      { judul: "Buka notifikasi", isi: "Ketuk ikon lonceng di Beranda." },
      { judul: "Saring", isi: "Pilih Semua atau Belum dibaca." },
      { judul: "Tindak lanjuti", isi: "Ketuk notifikasi untuk membuka halaman terkait, misalnya Terima Stok untuk kiriman baru atau Ajukan Restock untuk stok menipis." },
      { judul: "Tandai dibaca", isi: "Ketuk Baca Semua untuk menandai semua notifikasi sudah dibaca." },
    ],
    perhatian: [
      { teks: "Notifikasi hilang sendiri setelah urusannya selesai, misalnya kiriman sudah diterima.", tingkat: "info" },
      { teks: "Status sudah dibaca tersimpan di HP ini saja.", tingkat: "info" },
    ],
  },
  {
    kode: "barista-riwayat-penjualan",
    peran: "barista",
    judul: "Riwayat Penjualan",
    ringkasan: "Daftar transaksi, total omzet, cetak ulang struk, dan ganti metode bayar.",
    tanpaShift: true,
    gambar: [{ file: "barista-riwayat-penjualan-1.webp", keterangan: "Riwayat Penjualan dengan filter Hari Ini, Minggu Ini, dan Semua." }],
    langkah: [
      { judul: "Pilih periode", isi: "Pilih Hari Ini, Minggu Ini, atau Semua. Total Transaksi dan Total Omzet ikut menyesuaikan." },
      { judul: "Cetak ulang", isi: "Ketuk Cetak Ulang pada transaksi untuk mencetak struknya lagi lewat printer Bluetooth." },
      { judul: "Ganti metode bayar", isi: "Ketuk Ganti Metode Bayar bila pelanggan ternyata membayar dengan metode lain, pilih metodenya, isi Alasan, lalu ketuk Simpan." },
    ],
    perhatian: [
      { teks: "Ganti Metode Bayar hanya tersedia untuk transaksi pada shift yang sedang aktif.", tingkat: "info" },
      { teks: "Ganti ke QRIS atau Split wajib disertai Foto Bukti Bayar QRIS.", tingkat: "penting" },
      { teks: "Cetak ulang hanya bisa dari aplikasi Barista yang terhubung ke printer Bluetooth.", tingkat: "info" },
    ],
  },
  {
    kode: "barista-riwayat-stok",
    peran: "barista",
    judul: "Riwayat Stok",
    ringkasan: "Catatan stok masuk dan keluar Booth per produk.",
    gambar: [{ file: "barista-riwayat-stok-1.webp", keterangan: "Ringkasan Stok Awal, Masuk, Keluar, dan Stok Akhir untuk produk terpilih." }],
    langkah: [
      { judul: "Buka riwayat", isi: "Ketuk Riwayat di menu bawah, lalu pilih Riwayat Stok." },
      { judul: "Pilih produk dan periode", isi: "Pilih produk di Pilih Stok dan rentang waktu di Periode." },
      { judul: "Baca mutasi", isi: "Setiap baris menampilkan jenis Masuk, Keluar, atau Penyesuaian, jumlahnya, dan Sisa setelah mutasi." },
      { judul: "Ekspor", isi: "Ketuk Excel untuk mengunduh riwayat dalam bentuk file Excel." },
    ],
    perhatian: [],
  },
  {
    kode: "barista-riwayat-absen",
    peran: "barista",
    judul: "Riwayat Absen",
    ringkasan: "Riwayat kehadiran dan jam kerja Anda bulan ini.",
    tanpaShift: true,
    gambar: [{ file: "barista-riwayat-absen-1.webp", keterangan: "Total Hadir Bulan Ini dan daftar shift." }],
    langkah: [
      { judul: "Buka riwayat", isi: "Ketuk Riwayat di menu bawah, lalu pilih Riwayat Absen." },
      { judul: "Baca riwayat", isi: "Setiap shift menampilkan status, tanggal, Booth, jam Check-In, dan jam Check-Out." },
    ],
    perhatian: [],
  },
  {
    kode: "barista-checkout",
    peran: "barista",
    judul: "Check-Out",
    ringkasan: "Menutup shift di Booth: hitung stok fisik, periksa rekap, lalu absen Check-Out. Judul layarnya Setor & Pengembalian Stok.",
    gambar: [
      { file: "barista-checkout-1.webp", keterangan: "Rekap Stok Produk dengan kolom Stok Fisik." },
      { file: "barista-checkout-2.webp", keterangan: "Konfirmasi Check Out: ringkasan shift, lokasi, dan foto." },
    ],
    langkah: [
      { judul: "Buka Check-Out", isi: "Di Beranda, ketuk CHECK OUT." },
      { judul: "Hitung stok fisik", isi: "Isi jumlah cup yang tersisa di kolom Stok Fisik untuk setiap produk." },
      { judul: "Periksa rekap", isi: "Periksa Rekap Penjualan dan Rekap Keuangan. Ketuk Cetak Ringkasan Penjualan bila perlu." },
      { judul: "Lanjut", isi: "Ketuk LANJUT CHECK OUT." },
      { judul: "Absen Check-Out", isi: "Ambil lokasi dan foto di Booth, lalu ketuk KONFIRMASI CHECK OUT." },
    ],
    perhatian: [
      { teks: "Bila Stok Fisik berbeda dari sistem, Alasan Selisih Stok wajib diisi.", tingkat: "penting" },
      { teks: "Draft transaksi di Kasir harus dibayar atau dihapus sebelum Check-Out.", tingkat: "penting" },
      // ShiftsService: EARLY_CHECKOUT kecuali ada izin EARLY_CHECKOUT dari Admin.
      { teks: "Check-Out sebelum jam shift berakhir hanya bisa dengan izin pulang awal dari Admin.", tingkat: "info" },
      { teks: "Setelah Check-Out, bawa stok dan uang ke Gudang lalu lakukan Absen Kembali.", tingkat: "info" },
    ],
  },
  {
    kode: "barista-kembali",
    peran: "barista",
    judul: "Absen Kembali di Gudang",
    ringkasan: "Absen saat sampai di Gudang, lalu serahkan stok dan uang ke Admin.",
    tanpaShift: true,
    gambar: [{ file: "barista-kembali-1.webp", keterangan: "Konfirmasi lokasi Gudang dan foto sebelum KONFIRMASI KEMBALI." }],
    langkah: [
      { judul: "Buka absen kembali", isi: "Di Beranda, ketuk ABSEN KEMBALI DI GUDANG." },
      { judul: "Lokasi dan foto", isi: "Ketuk Ambil Lokasi Saya di Gudang, lalu Ambil Foto." },
      { judul: "Periksa setoran", isi: "Bagian Serahkan ke Admin menampilkan Booth, Kas Tunai, Uang jalan, dan Total uang disetor." },
      { judul: "Konfirmasi", isi: "Ketuk KONFIRMASI KEMBALI, lalu serahkan stok dan uang kepada Admin." },
    ],
    perhatian: [
      { teks: "Layar ini hanya tersedia setelah Check-Out.", tingkat: "info" },
      // ShiftsService.checkIn: PREVIOUS_SHIFT_NOT_RETURNED.
      { teks: "Absen Berangkat berikutnya baru bisa setelah Absen Kembali dilakukan.", tingkat: "penting" },
    ],
  },
  {
    kode: "barista-setting",
    peran: "barista",
    judul: "Setting",
    ringkasan: "Profil akun, pilihan printer struk, dan keluar akun.",
    tanpaShift: true,
    gambar: [{ file: "barista-setting-1.webp", keterangan: "Profil & Pengaturan." }],
    langkah: [
      { judul: "Ubah nama", isi: "Ubah Nama Lengkap, lalu ketuk Simpan Perubahan." },
      { judul: "Pilih printer", isi: "Di bagian Printer Bluetooth, ketuk Muat ulang lalu pilih printer struk yang sudah di-pairing di HP." },
      { judul: "Keluar", isi: "Ketuk Keluar Akun untuk keluar dari aplikasi." },
    ],
    perhatian: [{ teks: "Pengaturan printer Bluetooth hanya tersedia di aplikasi Barista, bukan di browser.", tingkat: "info" }],
  },
];
