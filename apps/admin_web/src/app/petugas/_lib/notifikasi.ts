"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { BASE_URL, getToken, type NotificationItem } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useStatusDibaca } from "@/lib/notifikasi";

/// Notifikasi Booth Barista, live lewat WebSocket (backend notifications.gateway.ts, booth-scoped):
/// snapshot dikirim begitu konek lalu diperbarui tiap ~5 detik. Dipakai Beranda (badge bel, kartu
/// Terima Stok & Stok) dan layar Notifikasi. `aktif` = token sudah ber-boothId (shift aktif) — gateway
/// menolak token tanpa boothId, jadi socket baru dibuka setelah itu. `null` sampai snapshot pertama tiba.
export function useNotifikasiBooth(aktif: boolean): NotificationItem[] | null {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  useEffect(() => {
    if (!aktif) return;
    const socket: Socket = io(`${BASE_URL}/notifications`, { auth: { token: getToken() } });
    socket.on("notifications:snapshot", (data: NotificationItem[]) => setItems(data));
    return () => {
      socket.disconnect();
    };
  }, [aktif]);
  return items;
}

const URUTAN_STOK = ["Habis", "Kritis", "Menipis"] as const;

/// Backend mengirim satu item per produk (`lowstock:<status>:<boothId>:<productId>`, dipakai badge
/// kartu Stok). Untuk dibaca, item stok digabung jadi satu per status — "14 produk: Almond, Americano,
/// Brown Sugar +11 lainnya" — bukan 14 kartu yang sama. Urut terbaru di atas.
export function gabungNotifikasiStok(items: NotificationItem[]): NotificationItem[] {
  const lain = items.filter((n) => !n.id.startsWith("lowstock:"));
  const grup = URUTAN_STOK.flatMap((status) => {
    const anggota = items.filter((n) => n.id.startsWith(`lowstock:${status}:`));
    if (anggota.length === 0) return [];
    // Pesan backend: "<produk> tersisa <n>. ..." — nama produk diambil dari situ.
    const nama = anggota.map((n) => n.message.split(" tersisa ")[0]).sort((a, b) => a.localeCompare(b));
    const daftar = nama.length > 3 ? `${nama.slice(0, 3).join(", ")} +${nama.length - 3} lainnya` : nama.join(", ");
    const terbaru = anggota.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
    return [
      {
        id: `lowstock-grup:${status}`,
        title: `Stok ${status}`,
        message: `${anggota.length} produk: ${daftar}.`,
        type: terbaru.type,
        readAt: null,
        createdAt: terbaru.createdAt,
      },
    ];
  });
  return [...lain, ...grup].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/// Status dibaca notifikasi Barista (per akun, di HP ini).
export function useDibacaBarista() {
  const { session } = useAuth();
  return useStatusDibaca(`obbel-petugas-notif-dibaca:${session?.profile.id ?? "-"}`);
}
