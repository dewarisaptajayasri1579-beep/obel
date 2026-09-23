import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";

/// Font khas Web/App Petugas Booth — SAMA dengan apps/booth_flutter
/// (`GoogleFonts.outfitTextTheme()` di theme.dart), sengaja beda dari
/// Plus Jakarta Sans yang dipakai console Admin, supaya identitas visualnya
/// konsisten dengan Android, bukan ikut font Admin.
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Obbel Petugas Booth",
  description: "Check-In, Kasir, Terima Stok, dan aktivitas harian Petugas Booth.",
  manifest: "/petugas/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B5D34",
};

/// Layout ini SENGAJA tetap di dalam <html>/<body> root (app/layout.tsx) —
/// AuthProvider/ToastProvider dipakai ulang, hanya "chrome" (Sidebar/Header
/// admin) yang tidak diwarisi. Setiap halaman /petugas/* membungkus dirinya
/// sendiri dengan RequirePetugasAuth atau tidak (mis. /petugas/login) sesuai
/// kebutuhan, bukan di sini — supaya halaman login tidak ikut ter-redirect.
export default function PetugasLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${outfit.className} antialiased`}>{children}</div>;
}
