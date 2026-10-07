"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
  MapPin,
  Warehouse,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type ActiveShift, type PendingReturnShift, type SaleListItem } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { formatJamJakarta, formatRupiah, startOfTodayJakarta } from "./_lib/format";
import { OBBEL, OBBEL_SCALE } from "./_lib/theme";
import { gabungNotifikasiStok, useDibacaBarista, useNotifikasiBooth } from "./_lib/notifikasi";

const GREEN = OBBEL.primaryDark;

const MENU = [
  {
    href: "/petugas/kasir",
    label: "Kasir",
    desc: "Mulai transaksi penjualan",
    icon: CreditCard,
    bg: OBBEL_SCALE[50],
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
  const toast = useToast();
  const [shift, setShift] = useState<ActiveShift | null>(null);
  const [noShift, setNoShift] = useState(false);
  // Shift yang sudah Check-Out tapi belum absen Kembali di Gudang (BR-042).
  const [menungguKembali, setMenungguKembali] = useState<PendingReturnShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [salesHariIni, setSalesHariIni] = useState<SaleListItem[]>([]);

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
          // Belum ada shift aktif — tetap tampilkan Beranda (bukan auto-
          // redirect ke Check-In), dengan CTA supaya Petugas yang pertama
          // kali buka jelas melihat dulu ada di Beranda.
          setNoShift(true);
          setMenungguKembali(await api.getPendingReturn().catch(() => null));
          return;
        }
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat status shift.");
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  // Bel notifikasi + badge "Baru" di kartu Terima Stok & kartu Stok — satu sumber data live
  // (WebSocket booth-scoped, lihat useNotifikasiBooth). Dibuka setelah `shift` terisi supaya
  // token yang dipakai sudah ber-boothId.
  const notifications = useNotifikasiBooth(!!shift) ?? [];
  const { sudahDibaca } = useDibacaBarista();
  const belumDibaca = gabungNotifikasiStok(notifications).filter((n) => !sudahDibaca(n)).length;

  // Ringkasan Kasir (cup + omzet) di kartu menu Beranda — booth-scoped
  // otomatis oleh backend (JWT BOOTH_STAFF, sama seperti /petugas/riwayat-
  // penjualan), disaring ke "hari ini" Asia/Jakarta di sisi klien.
  useEffect(() => {
    if (!shift) return;
    api
      .getSales({ status: "PAID", limit: 100 })
      .then((res) => {
        const cutoff = startOfTodayJakarta();
        setSalesHariIni(res.rows.filter((s) => new Date(s.paidAt ?? s.createdAt) >= cutoff));
      })
      .catch(() => {
        // Diam-diam gagal — cuma ringkasan di kartu, jangan halangi Beranda.
      });
  }, [shift]);

  const cupTerjualHariIni = salesHariIni.reduce((sum, s) => sum + s.cupCount, 0);
  const omzetHariIni = salesHariIni.reduce((sum, s) => sum + s.total, 0);

  const stokMasukBaru = notifications.filter((n) => n.id.startsWith("distribution:")).length;

  // Badge di kartu Stok — dihitung PER STATUS (berapa varian Habis, berapa
  // Kritis, berapa Menipis), bukan cuma label status terparah. Status
  // disisipkan backend di `id` (`lowstock:<status>:<boothId>:<productId>`,
  // lihat NotificationsService.getForBooth). Sama feed WebSocket dgn
  // lonceng notifikasi di atas, jadi otomatis realtime tanpa koneksi
  // socket tambahan.
  const jumlahStokBermasalah = (() => {
    const habis = notifications.filter((n) => n.id.startsWith("lowstock:Habis:")).length;
    const kritis = notifications.filter((n) => n.id.startsWith("lowstock:Kritis:")).length;
    const menipis = notifications.filter((n) => n.id.startsWith("lowstock:Menipis:")).length;
    return { habis, kritis, menipis };
  })();
  const adaStokBermasalah = jumlahStokBermasalah.habis + jumlahStokBermasalah.kritis + jumlahStokBermasalah.menipis > 0;
  const statusStokTerparah = jumlahStokBermasalah.habis > 0 ? "Habis" : jumlahStokBermasalah.kritis > 0 ? "Kritis" : "Menipis";
  const STOK_BADGE_COLOR: Record<string, string> = {
    Habis: OBBEL.accentRed,
    Kritis: OBBEL.accentOrange,
    Menipis: "#B45309",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (noShift || !shift) {
    return (
      <div className="pb-6">
        <div className="bg-white px-5 pt-5 pb-4 flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500 font-semibold">Selamat bekerja,</p>
            <p className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">{session?.profile.fullName} 👋</p>
            <p className="text-sm text-slate-400 font-medium mt-0.5">Semoga harimu menyenangkan!</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Keluar Akun"
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0"
          >
            <LogOut size={17} className="text-slate-500" />
          </button>
        </div>

        <div className="px-4 pt-2">
          <div
            className="rounded-[28px] p-6 relative overflow-hidden shadow-[0_18px_40px_-16px_rgba(11,93,52,0.55)] min-h-47.5 flex flex-col items-start justify-center"
            style={{ background: `linear-gradient(135deg, ${OBBEL.primaryMedium} 0%, ${GREEN} 65%, ${OBBEL_SCALE[800]} 100%)` }}
          >
            <Leaf size={90} className="absolute -right-3 -top-6 text-white/10 rotate-20" strokeWidth={1} />
            <Coffee size={64} className="absolute right-5 bottom-4 text-white/25" strokeWidth={1.2} />
            {menungguKembali ? (
              <>
                <Warehouse size={28} className="relative text-white/80 mb-2" />
                <p className="relative text-white font-extrabold text-xl tracking-tight leading-tight">Kembali ke Gudang</p>
                <p className="relative text-white/80 text-base mt-2 font-medium max-w-55">
                  Shift {menungguKembali.booth.name} sudah Check-Out. Absen Kembali di Gudang, lalu serahkan stok &amp; uang ke Admin.
                </p>
              </>
            ) : (
              <>
                <DoorOpen size={28} className="relative text-white/80 mb-2" />
                <p className="relative text-white font-extrabold text-xl tracking-tight leading-tight">Belum Ada Shift Aktif</p>
                <p className="relative text-white/80 text-base mt-2 font-medium max-w-55">
                  Absen Berangkat di Gudang dulu untuk mulai bekerja hari ini.
                </p>
              </>
            )}
          </div>

          <Link
            href={menungguKembali ? "/petugas/kembali" : "/petugas/check-in"}
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-full py-4 font-extrabold tracking-wide text-white active:scale-[0.99] transition relative"
            style={{ backgroundColor: GREEN }}
          >
            {menungguKembali ? <Warehouse size={18} /> : <DoorOpen size={18} />}
            {menungguKembali ? "ABSEN KEMBALI DI GUDANG" : "ABSEN BERANGKAT"}
            <ChevronRight size={16} className="absolute right-5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6">
      <div className="bg-white px-5 pt-5 pb-4 flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 font-semibold">Selamat bekerja,</p>
          <p className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">{session?.profile.fullName} 👋</p>
          <p className="text-sm text-slate-400 font-medium mt-0.5">Semoga harimu menyenangkan!</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Link
            href="/petugas/notifikasi"
            title="Notifikasi"
            className="relative w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"
          >
            <Bell size={18} className="text-slate-700" />
            {belumDibaca > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full text-white text-[11px] font-bold"
                style={{ backgroundColor: OBBEL.accentRed }}
              >
                {belumDibaca > 9 ? "9+" : belumDibaca}
              </span>
            )}
          </Link>
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
          className="rounded-[28px] p-5 relative overflow-hidden shadow-[0_18px_40px_-16px_rgba(11,93,52,0.55)] min-h-47.5"
          style={{ background: `linear-gradient(135deg, ${OBBEL.primaryMedium} 0%, ${GREEN} 65%, ${OBBEL_SCALE[800]} 100%)` }}
        >
          {/* Dekorasi daun & cangkir kopi — mengganti ilustrasi foto di mockup
              dengan ikon, supaya tidak butuh aset gambar baru. */}
          <Leaf size={90} className="absolute -right-3 -top-6 text-white/10 rotate-20" strokeWidth={1} />
          <Leaf size={56} className="absolute right-10 top-16 text-white/10 rotate-[-15deg]" strokeWidth={1} />
          <div className="absolute right-5 bottom-4 flex flex-col items-center">
            <Coffee size={64} className="text-white/25" strokeWidth={1.2} />
            <p className="text-white/30 text-xs italic font-medium mt-1 text-center leading-tight max-w-17.5">
              Satu Kopi Sejuta Cerita
            </p>
          </div>

          <span className="relative inline-flex items-center gap-1.5 text-sm font-bold text-white bg-white/20 backdrop-blur-sm rounded-full px-3 py-2 tracking-wide">
            <Store size={12} /> {shift.booth.name.toUpperCase()}
          </span>
          <p className="relative text-white font-extrabold text-[28px] mt-3 tracking-tight leading-none">
            {shift.shiftName.toUpperCase()} AKTIF
          </p>
          <p className="relative text-white/80 text-base mt-2 font-medium flex items-center gap-1.5">
            <Clock size={13} /> Sejak {formatJamJakarta(shift.scheduledStartAt)}
          </p>
          {shift.cashFloat > 0 && (
            <p className="relative text-white/80 text-sm mt-2 font-medium">Uang jalan {formatRupiah(shift.cashFloat)} · dikembalikan saat Kembali</p>
          )}
          <p className="relative text-white/70 text-sm mt-3 font-medium">— Kerja hebat hari ini 💚</p>
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
                    className="absolute top-3 left-3.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white tracking-wide z-10"
                    style={{ backgroundColor: OBBEL.accentRed }}
                  >
                    BARU · {stokMasukBaru}
                  </span>
                )}
                {item.href === "/petugas/stok" && adaStokBermasalah && (
                  <span
                    className="absolute top-3 left-3.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white tracking-wide z-10"
                    style={{ backgroundColor: STOK_BADGE_COLOR[statusStokTerparah] }}
                  >
                    {statusStokTerparah}
                    {(jumlahStokBermasalah.habis || jumlahStokBermasalah.kritis || jumlahStokBermasalah.menipis) > 0 &&
                      ` · ${{ Habis: jumlahStokBermasalah.habis, Kritis: jumlahStokBermasalah.kritis, Menipis: jumlahStokBermasalah.menipis }[statusStokTerparah]}`}
                  </span>
                )}
                <div className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center absolute top-3.5 right-3.5">
                  <ChevronRight size={14} className="text-slate-500" />
                </div>
                <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shadow-sm relative">
                  <Icon size={20} style={{ color: item.fg }} strokeWidth={2.4} />
                </div>
                <div className="relative">
                  <p className="font-bold text-base text-slate-900">{item.label}</p>
                  {item.href === "/petugas/stok" && adaStokBermasalah ? (
                    <p className="text-sm mt-0.5 font-semibold" style={{ color: OBBEL.accentRed }}>
                      {[
                        jumlahStokBermasalah.habis > 0 ? `${jumlahStokBermasalah.habis} habis` : null,
                        jumlahStokBermasalah.menipis > 0 ? `${jumlahStokBermasalah.menipis} menipis` : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : item.href === "/petugas/kasir" && cupTerjualHariIni > 0 ? (
                    <p className="text-sm mt-0.5 font-bold" style={{ color: GREEN }}>
                      {cupTerjualHariIni} cup · {formatRupiah(omzetHariIni)}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 mt-0.5 font-medium">{item.desc}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Check-Out baru bisa setelah absen Tiba di Booth (BR-042). */}
        {shift.arrivedAt ? (
          <Link
            href="/petugas/checkout"
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-full border-2 bg-white py-4 font-extrabold tracking-wide active:scale-[0.99] transition relative"
            style={{ borderColor: OBBEL.accentOrange, color: OBBEL.accentOrange }}
          >
            <DoorOpen size={18} />
            CHECK OUT
            <ChevronRight size={16} className="absolute right-5" />
          </Link>
        ) : (
          <Link
            href="/petugas/tiba"
            className="mt-5 w-full flex items-center justify-center gap-2 rounded-full py-4 font-extrabold tracking-wide text-white active:scale-[0.99] transition relative"
            style={{ backgroundColor: GREEN }}
          >
            <MapPin size={18} />
            ABSEN TIBA DI BOOTH
            <ChevronRight size={16} className="absolute right-5" />
          </Link>
        )}

        <div className="flex items-center gap-3 mt-5 px-6">
          <div className="flex-1 h-px bg-slate-200" />
          <p className="text-sm italic text-slate-400 font-medium text-center whitespace-nowrap">
            Team yang hebat, hasil yang luar biasa 🌱
          </p>
          <div className="flex-1 h-px bg-slate-200" />
        </div>
      </div>

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
