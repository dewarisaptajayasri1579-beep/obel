import { NextResponse } from "next/server";

/// `app/manifest.ts` (metadata file convention Next.js) cuma jalan di root
/// `app/` — di path bersarang seperti `app/petugas/` diam-diam tidak
/// ter-generate (dicoba, hasilnya 404), jadi manifest Petugas Booth ditulis
/// manual sebagai Route Handler di sini.
export function GET() {
  return NextResponse.json(
    {
      name: "Obbel Petugas Booth",
      short_name: "Obbel Petugas",
      description: "Check-In, Kasir, Terima Stok, dan aktivitas harian Petugas Booth Obbel Coffee & Milk.",
      start_url: "/petugas",
      display: "standalone",
      background_color: "#F7F9F6",
      theme_color: "#0B5D34",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
