/// Pesan Indonesia untuk kegagalan `navigator.geolocation`. `err.message` dari browser berbahasa Inggris
/// dan berbeda-beda ("User denied Geolocation", "Timeout expired"), tidak memberi tahu apa yang harus dilakukan.
/// Pola yang sama dengan pesan kamera di PhotoCapture.
export function pesanGpsError(err: Pick<GeolocationPositionError, "code">): string {
  switch (err.code) {
    case 1: // PERMISSION_DENIED
      return "Izin lokasi ditolak. Aktifkan di Pengaturan HP > Aplikasi > Barista Obbel > Izin > Lokasi (atau izinkan lokasi di browser), lalu coba lagi.";
    case 2: // POSITION_UNAVAILABLE
      return "Lokasi tidak bisa ditentukan. Pastikan GPS HP menyala, atau coba di tempat yang lebih terbuka.";
    case 3: // TIMEOUT
      return "Mengambil lokasi terlalu lama. Coba lagi, sebaiknya di tempat yang lebih terbuka.";
    default:
      return "Gagal mengambil lokasi. Pastikan izin GPS aktif lalu coba lagi.";
  }
}
