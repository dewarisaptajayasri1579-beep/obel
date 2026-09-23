/// Palet warna Web Petugas Booth — HARUS sama persis dengan
/// apps/booth_flutter/lib/theme.dart (`ObbelTheme`), bukan warna ad-hoc.
/// Android & Web Petugas Booth adalah client yang sama secara identitas
/// visual, jadi warnanya tidak boleh beda meski kodenya terpisah.
export const OBBEL = {
  primaryDark: "#0B5D34", // Hijau Obbel utama
  primaryMedium: "#138E4E", // Hijau terang
  accentOrange: "#E57C23", // Warning/Highlight (mis. tombol Check Out)
  accentRed: "#D21919", // Error
  backgroundLight: "#F7F9F6", // Background off-white
  textDark: "#1E2320", // Teks utama
  textLight: "#5A635E", // Teks sekunder/keterangan
} as const;
