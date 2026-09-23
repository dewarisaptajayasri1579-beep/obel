"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import {
  CreditCard,
  Truck,
  Package,
  Receipt as ReceiptIcon,
  LogOut,
  Bell,
  ChevronRight,
  DoorOpen,
  Clock,
  Store,
  Coffee,
  Leaf,
  BarChart3,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, BASE_URL, getToken, type ActiveShift, type NotificationItem } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { formatJamJakarta } from "./_lib/format";
import { OBBEL } from "./_lib/theme";

const GREEN = OBBEL.primaryDark;

const MENU = [
  {
    href: "/petugas/kasir",
    label: "Kasir",
    desc: "Mulai transaksi penjualan",
    icon: CreditCard,
    bg: "#E4F3E9",
    fg: GREEN,
    watermark: CreditCard,
  },
  {
    href: "/petugas/terima-stok",
    label: "Terima Stok",
    desc: "Catat barang masuk",
    icon: Truck,
    bg: "#E1EEFB",
    fg: "#1D63D8",
    watermark: Package,
  },
  {
    href: "/petugas/stok",
    label: "Stok",
    desc: "Lihat dan kelola stok",
    icon: Package,
    bg: "#FBEEDA",
    fg: OBBEL.accentOrange,
    watermark: Package,
  },
  {
    href: "/petugas/riwayat-penjualan",
    label: "Riwayat Penjualan",
    desc: "Lihat transaksi penjualan",
    icon: ReceiptIcon,
    bg: "#EEE7FB",
    fg: "#7C3AED",
    watermark: BarChart3,
  },
];

function HomeContent() {
  const { session, logout, updateToken } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [shift, setShift] = useState<ActiveShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const active = await api.getActiveShift();
        // Token yang tersimpan bisa saja masih dari SEBELUM boothId-nya
        // sesuai (mis. login baru tanpa Check-In ulang di sesi ini) —
        // backend reissue token pas kondisi itu (lihat ShiftsService.
        // getMyActiveShift). Simpan token barunya DULU sebelum setShift,
        // supaya efek socket notifikasi di bawah (yang menunggu `shift`
        // terisi) sudah baca token yang benar dari localStorage.
        if (active.accessToken) updateToken(active.accessToken);
        setShift(active);
      } catch (err) {
        if (err instanceof ApiError && err.code === "NOT_FOUND") {
          router.replace("/petugas/check-in");
          return;
        }
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat status shift.");
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  // Lonceng notifikasi + badge "Baru" di kartu Terima Stok — SATU sumber
  // data live (WebSocket, backend/src/modules/notifications/notifications.gateway.ts,
  // booth-scoped: cuma notifikasi Booth Petugas ini sendiri). Snapshot
  // langsung dikirim server begitu konek, lalu di-refresh tiap ~5 detik —
  // tidak perlu refresh halaman untuk lihat notifikasi baru (mis. stok baru
  // dikirim Admin, sambil Beranda masih terbuka).
  //
  // Baru dibuka setelah `shift` terisi (bukan `[]` kosong) — gateway
  // menolak koneksi kalau JWT belum punya boothId (lihat komentar di atas),
  // jadi menunggu token yang benar tersimpan dulu mencegah socket konek
  // pakai token basi lalu langsung di-disconnect diam-diam.
  useEffect(() => {
    if (!shift) return;
    const socket: Socket = io(`${BASE_URL}/notifications`, { auth: { token: getToken() } });
    socket.on("notifications:snapshot", (data: NotificationItem[]) => setNotifications(data));
    return () => {
      socket.disconnect();
    };
  }, [shift]);

  const stokMasukBaru = notifications.filter((n) => n.id.startsWith("distribution:")).length;

  // Badge "Kritis"/"Menipis" di kartu Stok — status disisipkan backend di
  // `id` (`lowstock:<status>:...`, lihat NotificationsService.getForBooth),
  // ambil yang PALING parah kalau ada beberapa produk sekaligus. Sama feed
  // WebSocket dgn lonceng notifikasi di atas, jadi otomatis realtime juga
  // tanpa koneksi socket tambahan.
  const statusStokTerparah = (() => {
    const statusList = notifications
      .filter((n) => n.id.startsWith("lowstock:"))
      .map((n) => n.id.split(":")[1]);
    if (statusList.includes("Habis")) return "Habis";
    if (statusList.includes("Kritis")) return "Kritis";
    if (statusList.includes("Menipis")) return "Menipis";
    return null;
  })();
  const STOK_BADGE_COLOR: Record<string, string> = {
    Habis: OBBEL.accentRed,
    Kritis: OBBEL.accentOrange,
    Menipis: "#B45309",
  };

  const NOTIF_ICON: Record<NotificationItem["type"], typeof Info> = {
    info: Info,
    success: Info,
    warning: AlertTriangle,
    error: AlertTriangle,
  };
  const NOTIF_COLOR: Record<NotificationItem["type"], string> = {
    info: "#1D63D8",
    success: OBBEL.primaryDark,
    warning: OBBEL.accentOrange,
    error: OBBEL.accentRed,
  };

  if (loading || !shift) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="bg-white px-5 pt-5 pb-4 flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 font-semibold">Selamat bekerja,</p>
          <p className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">{session?.profile.fullName} 👋</p>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Semoga harimu menyenangkan!</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowNotifPanel(true)}
            title="Notifikasi"
            className="relative w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <Bell size={18} className="text-slate-700" />
            {notifications.length > 0 && (
              <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full" style={{ backgroundColor: OBBEL.accentRed }} />
            )}
          </button>
          <button
            type="button"
            onClick={logout}
            title="Keluar Akun"
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <LogOut size={17} className="text-slate-500" />
          </button>
        </div>
      </div>

      <div className="px-4 pt-2">
        <div
          className="rounded-[28px] p-5 relative overflow-hidden shadow-[0_18px_40px_-16px_rgba(11,93,52,0.55)] min-h-[190px]"
          style={{ background: `linear-gradient(135deg, ${OBBEL.primaryMedium} 0%, ${GREEN} 65%, #073E26 100%)` }}
        >
          {/* Dekorasi daun & cangkir kopi — mengganti ilustrasi foto di mockup
              dengan ikon, supaya tidak butuh aset gambar baru. */}
          <Leaf size={90} className="absolute -right-3 -top-6 text-white/10 rotate-[20deg]" strokeWidth={1} />
          <Leaf size={56} className="absolute right-10 top-16 text-white/10 -rotate-[15deg]" strokeWidth={1} />
          <div className="absolute right-5 bottom-4 flex flex-col items-center">
            <Coffee size={64} className="text-white/25" strokeWidth={1.2} />
            <p className="text-white/30 text-[10px] italic font-medium mt-1 text-center leading-tight max-w-[70px]">
              Satu Kopi Sejuta Cerita
            </p>
          </div>

          <span className="relative inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 tracking-wide">
            <Store size={12} /> {shift.booth.name.toUpperCase()}
          </span>
          <p className="relative text-white font-extrabold text-[28px] mt-3 tracking-tight leading-none">
            {shift.shiftName.toUpperCase()} AKTIF
          </p>
          <p className="relative text-white/80 text-sm mt-2 font-medium flex items-center gap-1.5">
            <Clock size={13} /> Sejak {formatJamJakarta(shift.scheduledStartAt)}
          </p>
          <p className="relative text-white/70 text-xs mt-3 font-medium">— Kerja hebat hari ini 💚</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          {MENU.map((item) => {
            const Icon = item.icon;
            const Watermark = item.watermark;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[22px] p-4 flex flex-col gap-3 relative overflow-hidden shadow-[0_8px_20px_-10px_rgba(0,0,0,0.15)] active:scale-[0.98] transition"
                style={{ backgroundColor: item.bg }}
              >
                <Watermark size={72} className="absolute -right-3 -bottom-3 opacity-[0.09]" style={{ color: item.fg }} strokeWidth={1.5} />
                {item.href === "/petugas/terima-stok" && stokMasukBaru > 0 && (
                  <span
                    className="absolute top-3 left-3.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold text-white tracking-wide z-10"
                    style={{ backgroundColor: OBBEL.accentRed }}
                  >
                    BARU · {stokMasukBaru}
                  </span>
                )}
                {item.href === "/petugas/stok" && statusStokTerparah && (
                  <span
                    className="absolute top-3 left-3.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold text-white tracking-wide z-10"
                    style={{ backgroundColor: STOK_BADGE_COLOR[statusStokTerparah] }}
                  >
                    {statusStokTerparah}
                  </span>
                )}
                <div className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center absolute top-3.5 right-3.5">
                  <ChevronRight size={14} className="text-slate-500" />
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-sm relative">
                  <Icon size={20} style={{ color: item.fg }} strokeWidth={2.4} />
                </div>
                <div className="relative">
                  <p className="font-bold text-sm text-slate-900">{item.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{item.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <Link
          href="/petugas/checkout"
          className="mt-5 w-full flex items-center justify-center gap-2 rounded-full border-2 bg-white py-4 font-extrabold tracking-wide active:scale-[0.99] transition relative"
          style={{ borderColor: OBBEL.accentOrange, color: OBBEL.accentOrange }}
        >
          <DoorOpen size={18} />
          CHECK OUT
          <ChevronRight size={16} className="absolute right-5" />
        </Link>

        <div className="flex items-center gap-3 mt-5 px-6">
          <div className="flex-1 h-px bg-slate-200" />
          <p className="text-[11px] italic text-slate-400 font-medium text-center whitespace-nowrap">
            Team yang hebat, hasil yang luar biasa 🌱
          </p>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
      </div>

      {showNotifPanel && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end" onClick={() => setShowNotifPanel(false)}>
          <div
            className="w-full max-w-md mx-auto bg-white rounded-t-2xl max-h-[75vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-extrabold text-slate-900">Notifikasi</p>
              <button type="button" onClick={() => setShowNotifPanel(false)} className="text-slate-400">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">Belum ada notifikasi.</p>
              ) : (
                notifications.map((n) => {
                  const Icon = NOTIF_ICON[n.type];
                  const warna = NOTIF_COLOR[n.type];
                  const bisaDiklik = n.id.startsWith("distribution:");
                  const isi = (
                    <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50">
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${warna}1A`, color: warna }}
                      >
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                      </div>
                    </div>
                  );
                  return bisaDiklik ? (
                    <Link key={n.id} href="/petugas/terima-stok" onClick={() => setShowNotifPanel(false)}>
                      {isi}
                    </Link>
                  ) : (
                    <div key={n.id}>{isi}</div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PetugasHomePage() {
  return (
    <RequirePetugasAuth>
      <HomeContent />
    </RequirePetugasAuth>
  );
}
