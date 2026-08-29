import { MetadataRoute } from "next";
import { APP_CONFIG } from "@/lib/app-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_CONFIG.name} — ${APP_CONFIG.tagline}`,
    short_name: APP_CONFIG.name,
    description: APP_CONFIG.subTagline,
    start_url: "/",
    display: "standalone",
    background_color: "#eef4fc",
    theme_color: "#1e40af",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
