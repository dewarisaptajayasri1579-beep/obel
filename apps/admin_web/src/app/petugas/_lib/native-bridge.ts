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
