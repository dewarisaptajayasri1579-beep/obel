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

/// Skala hijau 10-langkah — HARUS sama persis dengan --brand-50..900 (palet
/// bawaan "Hijau Obbel") di apps/admin_web/src/app/globals.css, supaya kartu,
/// badge, dan latar bernuansa hijau di Web Petugas Booth tidak punya ronanya
/// sendiri yang ad-hoc dan meleset dari identitas admin. 700/800 mengunci ke
/// OBBEL.primaryDark/booth_flutter di atas; langkah lain ikut skala admin.
export const OBBEL_SCALE = {
  50: "#EAF6EF",
  100: "#D2ECDC",
  200: "#A6D9BB",
  300: "#78C39B",
  400: "#4FA97D",
  500: "#2E8C63",
  600: "#1F7350",
  700: "#0B5D34",
  800: "#074526",
  900: "#043018",
} as const;
