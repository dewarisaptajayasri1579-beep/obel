import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { AuthProvider } from "@/lib/auth-context";

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = JSON.parse(localStorage.getItem("os-template-preferences") || "null");
    var theme = stored && stored.theme === "dark" ? "dark"
      : stored && stored.theme === "light" ? "light"
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Obbel Admin Pusat",
  description: "Web Admin Pusat Obbel Coffee & Milk — kontrol stok, distribusi, dan laporan.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${plusJakartaSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <PreferencesProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
