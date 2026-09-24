import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { RegisterServiceWorker } from "./_components/RegisterServiceWorker";

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
  // iOS Safari TIDAK baca manifest.webmanifest sama sekali untuk "Tambah ke
  // Layar Utama" — tanpa dua field di bawah ini PWA-nya tetap "installable"
  // di Chrome/Android tapi kelihatan seperti bookmark biasa (bukan app) di
  // iPhone, padahal mayoritas Petugas Booth kemungkinan pakai iPhone pribadi.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Obbel Petugas",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B5D34",
  // Web/App Petugas Booth SELALU tampil terang (belum ada dark mode di sini).
  // Tanpa ini, WebView Android otomatis "force-dark" native form control
  // (input/textarea) saat HP di-set dark mode — teksnya jadi putih padahal
  // background input tetap putih (di-set manual lewat Tailwind), jadi teks
  // yang diketik nggak kelihatan sama sekali.
  colorScheme: "light",
};

/// Layout ini SENGAJA tetap di dalam <html>/<body> root (app/layout.tsx) —
/// AuthProvider/ToastProvider dipakai ulang, hanya "chrome" (Sidebar/Header
/// admin) yang tidak diwarisi. Setiap halaman /petugas/* membungkus dirinya
/// sendiri dengan RequirePetugasAuth atau tidak (mis. /petugas/login) sesuai
/// kebutuhan, bukan di sini — supaya halaman login tidak ikut ter-redirect.
export default function PetugasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${outfit.className} antialiased`}>
      <RegisterServiceWorker />
      {children}
    </div>
  );
}
