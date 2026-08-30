import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ObbelTheme {
  static const Color primaryDark = Color(0xFF0B5D34); // Hijau Obbel utama
  static const Color primaryMedium = Color(0xFF138E4E); // Hijau terang
  static const Color accentOrange = Color(0xFFE57C23); // Warning/Highlight
  static const Color accentRed = Color(0xFFD21919); // Error
  static const Color backgroundLight = Color(0xFFF7F9F6); // Background off-white
  static const Color textDark = Color(0xFF1E2320); // Teks utama
  static const Color textLight = Color(0xFF5A635E); // Teks sekunder/keterangan
  static const Color white = Colors.white;

  static ThemeData get lightTheme {
    return ThemeData(
      primaryColor: primaryDark,
      scaffoldBackgroundColor: backgroundLight,
      colorScheme: const ColorScheme.light(
        primary: primaryDark,
        secondary: primaryMedium,
        error: accentRed,
        surface: white,
      ),
      textTheme: GoogleFonts.outfitTextTheme().copyWith(
        titleLarge: GoogleFonts.outfit(
          color: textDark,
          fontWeight: FontWeight.w900,
          fontSize: 20,
        ),
        titleMedium: GoogleFonts.outfit(
          color: textDark,
          fontWeight: FontWeight.w800,
          fontSize: 16,
        ),
        bodyLarge: GoogleFonts.outfit(
          color: textDark,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        bodyMedium: GoogleFonts.outfit(
          color: textLight,
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: primaryDark,
        foregroundColor: white,
        elevation: 0,
        titleTextStyle: GoogleFonts.inter(
          color: white,
          fontWeight: FontWeight.bold,
          fontSize: 18,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryDark,
          foregroundColor: white,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primaryDark,
          textStyle: GoogleFonts.outfit(
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}
