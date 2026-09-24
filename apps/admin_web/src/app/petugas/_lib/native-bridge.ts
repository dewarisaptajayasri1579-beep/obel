"use client";

import { api, BASE_URL, getToken } from "@/lib/api-client";

/// Jembatan ke shell native booth_pwa_flutter (lihat
/// booth_pwa_flutter/lib/bridge/bridge_protocol.dart untuk kontrak
/// lengkapnya) — window.ObelBridge cuma ada kalau PWA ini dibuka DI DALAM
/// WebView shell itu. Dibuka di browser biasa (dev/testing) semua fungsi di
/// sini otomatis no-op, tidak pernah melempar error ke pemanggil.
type BridgeResponse = { ok: boolean; data?: unknown; error?: string };

declare global {
  interface Window {
    ObelBridge?: { postMessage: (msg: string) => void };
    ObelBridgeResult?: (id: string, response: BridgeResponse) => void;
  }
}

const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function ensureResultHandler() {
  if (typeof window === "undefined" || window.ObelBridgeResult) return;
  window.ObelBridgeResult = (id, response) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (response.ok) p.resolve(response.data);
    else p.reject(new Error(response.error ?? "Bridge error"));
  };
}

function callBridge(action: string, payload: Record<string, unknown>): Promise<unknown> {
  if (typeof window === "undefined" || !window.ObelBridge) return Promise.resolve(null);
  ensureResultHandler();
  const id = `${action}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    window.ObelBridge!.postMessage(JSON.stringify({ id, action, payload }));
  });
}

/// Mulai kirim lokasi GPS latar belakang (foreground service Android, jalan
/// walau layar terkunci) — dipanggil SEKALI setelah Check-In berhasil.
export async function startGpsTracking(shiftId: string): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    // Interval diatur Admin dari peta Booth Aktif > Realtime (AppSettings) —
    // fallback 60 detik kalau endpoint gagal diakses, supaya GPS tetap jalan
    // walau settingnya sendiri gagal diambil.
    const intervalSeconds = await api.getAppSettings().then((s) => s.gpsPingIntervalSeconds).catch(() => 60);
    await callBridge("gps.start", {
      apiBaseUrl: BASE_URL,
      authToken: token,
      shiftId,
      locationPath: "shifts/{shiftId}/location-ping",
      intervalSeconds,
    });
  } catch {
    // Izin lokasi ditolak dsb — diam-diam gagal, TIDAK boleh menghalangi
    // Petugas lanjut kerja. Cuma peta Booth Aktif Admin yang tidak dapat
    // update lokasi real-time, bukan hal yang mem-block Check-In.
  }
}

/// Hentikan kirim lokasi — dipanggil setelah Check-Out berhasil, supaya
/// baterai tidak terkuras di luar jam shift dan booth langsung hilang dari
/// peta "aktif" Admin.
export async function stopGpsTracking(): Promise<void> {
  try {
    await callBridge("gps.stop", {});
  } catch {
    // Diam-diam gagal — shift sudah tertutup di backend apa pun hasilnya.
  }
}

/// true kalau PWA ini lagi dibuka DI DALAM shell booth_pwa_flutter (bukan
/// browser biasa) — dipakai buat nyembunyiin/nonaktifin UI printer Bluetooth
/// kalau memang lagi diakses dari browser biasa, bukan buat nge-block fungsi
/// lain (GPS/kamera tetap no-op aman di browser, lihat komentar callBridge).
export function isNativeBridgeAvailable(): boolean {
  return typeof window !== "undefined" && !!window.ObelBridge;
}

export interface PairedPrinter {
  name: string;
  macAddress: string;
}

export interface PairedPrintersResult {
  printers: PairedPrinter[];
  /// true kalau izin Bluetooth ditolak PERMANEN di Android ("jangan tanya
  /// lagi") — di kondisi ini `printers` akan SELALU kosong walau printernya
  /// beneran sudah di-pairing OS, dan minta izin ulang tidak akan pernah
  /// nampilin dialog lagi. Satu-satunya jalan keluar: openPrinterSettings().
  /// Dibedakan dari "list kosong" biasa supaya UI bisa kasih pesan yang
  /// benar, bukan "belum ada printer paired" yang menyesatkan.
  permissionPermanentlyDenied: boolean;
}

/// Printer Bluetooth thermal yang SUDAH di-pairing lewat pengaturan OS
/// (pairing sendiri di luar app ini, lihat printer_bridge_service.dart) —
/// bukan discovery/scan baru.
export async function listPairedPrinters(): Promise<PairedPrintersResult> {
  if (!isNativeBridgeAvailable()) return { printers: [], permissionPermanentlyDenied: false };
  const data = (await callBridge("printer.list", {})) as PairedPrintersResult | null;
  return { printers: data?.printers ?? [], permissionPermanentlyDenied: data?.permissionPermanentlyDenied ?? false };
}

/// Simpan printer terpilih sebagai "preferred" di native (SharedPreferences)
/// — WAJIB dipanggil minimal sekali sebelum printReceipt() bisa berhasil,
/// print tidak auto-connect ke printer manapun tanpa ini.
export async function selectPrinter(printer: PairedPrinter): Promise<void> {
  if (!isNativeBridgeAvailable()) return;
  await callBridge("printer.select", { name: printer.name, macAddress: printer.macAddress });
}

/// Buka layar Settings app Android — satu-satunya cara pulih kalau izin
/// Bluetooth sudah kepalang ditolak permanen (lihat PairedPrintersResult).
export async function openPrinterSettings(): Promise<void> {
  if (!isNativeBridgeAvailable()) return;
  await callBridge("printer.openSettings", {});
}

export interface ReceiptPayload {
  boothName: string;
  saleNo: string;
  /// ISO string.
  time: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  paymentMethod: string;
  staffName?: string;
}

/// Kirim struk ke printer Bluetooth yang sudah dipilih lewat selectPrinter().
/// Return false (bukan reject) kalau bridge tidak tersedia sama sekali
/// (dibuka di browser biasa) — pemanggil fallback ke window.print() di
/// kasus itu. Kalau bridge ADA tapi cetaknya gagal (printer mati/belum
/// dipilih dsb), promise-nya REJECT dengan pesan dari native supaya
/// pemanggil bisa nampilin toast error yang jelas, bukan diam-diam gagal.
export async function printReceipt(receipt: ReceiptPayload): Promise<boolean> {
  if (!isNativeBridgeAvailable()) return false;
  await callBridge("printer.print", receipt as unknown as Record<string, unknown>);
  return true;
}
