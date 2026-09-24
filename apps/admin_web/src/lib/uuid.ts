/// `crypto.randomUUID()` cuma tersedia di "secure context" (HTTPS, atau
/// `http://localhost`/`127.0.0.1`) — produksi selalu HTTPS jadi aman, tapi
/// begitu diakses lewat `http://<IP LAN>` (dev/testing lintas device di
/// jaringan lokal, mis. WebView booth_pwa_flutter nunjuk ke admin_web dev
/// server), fungsi itu HILANG dari browser dan pemanggilan langsungnya
/// jadi TypeError mentah (bukan ApiError, jatuh ke toast generik yang
/// nggak jelas). `crypto.getRandomValues()` TETAP tersedia di insecure
/// context, jadi dipakai sebagai fallback manual UUID v4 di sini.
export function randomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
