"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, Receipt, Settings, CreditCard, History, Package, Check } from "lucide-react";
import { OBBEL } from "@/app/petugas/_lib/theme";

const PETUGAS_GREEN = OBBEL.primaryDark;

type RiwayatItem = {
  href: string;
  label: string;
  desc: string;
  icon: typeof Home;
  /// Halaman ini sedang dibuka?
  aktif: (pathname: string) => boolean;
};

const RIWAYAT_MENU: RiwayatItem[] = [
  {
    href: "/petugas/riwayat-absen",
    label: "Riwayat Absen",
    desc: "Berangkat, tiba, selesai, kembali",
    icon: Clock,
    aktif: (p) => p.startsWith("/petugas/riwayat-absen"),
  },
  {
    href: "/petugas/riwayat-stok",
    label: "Riwayat Stok",
    desc: "Stok masuk dan keluar booth",
    icon: Package,
    aktif: (p) => p.startsWith("/petugas/riwayat-stok"),
  },
  {
    href: "/petugas/riwayat-penjualan",
    label: "Riwayat Penjualan",
    desc: "Transaksi dan cetak ulang struk",
    icon: Receipt,
    aktif: (p) => p.startsWith("/petugas/riwayat-penjualan"),
  },
];

type Tab =
  | { type: "link"; href: string; label: string; icon: typeof Home; exact: boolean }
  | { type: "menu"; label: string; icon: typeof Home };

const TABS: Tab[] = [
  { type: "link", href: "/petugas", label: "Beranda", icon: Home, exact: true },
  { type: "link", href: "/petugas/kasir", label: "Kasir", icon: CreditCard, exact: false },
  { type: "menu", label: "Riwayat", icon: History },
  { type: "link", href: "/petugas/setting", label: "Setting", icon: Settings, exact: false },
];

/// Layar yang punya tombol aksi sendiri nempel di bawah (mis. "Konfirmasi
/// Penerimaan", "Bayar Sekarang", "Lanjut Check Out") memanggil
/// `usePetugasNav().hide()` supaya tidak numpuk sama bottom nav mengambang
/// ini. Dihitung count, bukan boolean — kalau ada dua pemanggil hide()
/// bersamaan (jarang, tapi mis. saat transisi antar step), nav baru muncul
/// lagi setelah SEMUA pemanggil selesai.
const NavVisibilityContext = createContext<{ hide: () => () => void } | null>(null);

export function usePetugasNav() {
  const ctx = useContext(NavVisibilityContext);
  if (!ctx) throw new Error("usePetugasNav must be used within PetugasShell");
  return ctx;
}

/// Hook praktis: sembunyikan nav selama komponen ini ter-mount (atau selama
/// `active` true), otomatis muncul lagi saat unmount/`active` jadi false.
export function useHidePetugasNav(active: boolean = true) {
  const { hide } = usePetugasNav();
  useEffect(() => {
    if (!active) return;
    return hide();
  }, [active, hide]);
}

/// Bottom nav mengambang + menu Riwayat. Saat menu Riwayat terbuka hanya tab Riwayat yang menyala,
/// supaya tidak ada dua tab aktif sekaligus (mis. Kasir dan Riwayat).
function NavBawah() {
  const pathname = usePathname();
  const [menuBuka, setMenuBuka] = useState(false);
  /// Tujuan yang baru diketuk dan belum selesai dimuat ("riwayat" atau href tab). Tanpa ini, indikator
  /// kembali sebentar ke tab halaman lama (menu sudah menutup, URL belum berganti) lalu loncat ke tujuan.
  const [menuju, setMenuju] = useState<string | null>(null);

  // Menu ditutup dan tujuan dilepas begitu halaman benar-benar berganti.
  useEffect(() => {
    setMenuBuka(false);
    setMenuju(null);
  }, [pathname]);

  const riwayatAktif = menuju ? menuju === "riwayat" : RIWAYAT_MENU.some((m) => m.aktif(pathname));
  const gayaTab = (aktif: boolean) => ({
    color: aktif ? PETUGAS_GREEN : "#64748B",
    backgroundColor: aktif ? `${PETUGAS_GREEN}14` : "transparent",
  });

  return (
    <>
      {menuBuka && <div className="fixed inset-0 z-20 bg-slate-900/30" onClick={() => setMenuBuka(false)} />}

      {/* Latar warna halaman di belakang nav sampai tepi bawah (memudar ke atas): nav tetap terlihat
          mengambang seperti mockup, tapi konten yang di-scroll tidak tampak di celah sekelilingnya. */}
      <div className="fixed inset-x-0 bottom-0 z-30 pt-6 pb-4 px-4 bg-linear-to-t from-[#F7F9F6] from-70% to-transparent pointer-events-none">
        <nav className="relative max-w-md mx-auto pointer-events-auto">
          {menuBuka && (
            <div className="absolute bottom-full right-0 mb-3 w-72 max-w-full rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_12px_32px_-8px_rgba(11,93,52,0.3)]">
              {RIWAYAT_MENU.map((item) => {
                const Icon = item.icon;
                const sedangDibuka = item.aktif(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={sedangDibuka ? "page" : undefined}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 active:bg-slate-50"
                    style={sedangDibuka ? { backgroundColor: `${PETUGAS_GREEN}14` } : undefined}
                    onClick={() => {
                      setMenuBuka(false);
                      if (!sedangDibuka) setMenuju("riwayat");
                    }}
                  >
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${PETUGAS_GREEN}14`, color: PETUGAS_GREEN }}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800">{item.label}</span>
                      <span className="block text-xs text-slate-400">{item.desc}</span>
                    </span>
                    {sedangDibuka && <Check size={16} strokeWidth={3} style={{ color: PETUGAS_GREEN }} />}
                  </Link>
                );
              })}
              {/* Panah ke tab Riwayat (kolom ke-3 dari 4: pusatnya 37,5% dari tepi kanan). */}
              <span
                aria-hidden
                className="absolute -bottom-1.5 size-3 rotate-45 border-r border-b border-slate-100 bg-white"
                style={{ right: "calc(37.5% - 0.375rem)" }}
              />
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-[0_12px_32px_-8px_rgba(11,93,52,0.25)] border border-slate-100 grid grid-cols-4 gap-1 p-1.5">
            {TABS.map((item) => {
              const Icon = item.icon;
              if (item.type === "menu") {
                const aktif = menuBuka || riwayatAktif;
                return (
                  <button
                    key={item.label}
                    type="button"
                    aria-expanded={menuBuka}
                    onClick={() => setMenuBuka((v) => !v)}
                    className="flex flex-col items-center justify-center gap-1 py-2 text-xs font-bold rounded-2xl transition"
                    style={gayaTab(aktif)}
                  >
                    <Icon size={22} strokeWidth={aktif ? 2.4 : 2} />
                    <span className="truncate max-w-full">{item.label}</span>
                  </button>
                );
              }

              const aktif = !menuBuka && !riwayatAktif && (menuju ? menuju === item.href : item.exact ? pathname === item.href : pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (!(item.exact ? pathname === item.href : pathname.startsWith(item.href))) setMenuju(item.href);
                  }}
                  className="flex flex-col items-center justify-center gap-1 py-2 text-xs font-bold rounded-2xl transition"
                  style={gayaTab(aktif)}
                >
                  <Icon size={22} strokeWidth={aktif ? 2.4 : 2} />
                  <span className="truncate max-w-full">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}

/// Shell mobile-first Web Petugas Booth — SENGAJA tidak memakai
/// AppLayout/Sidebar/Header admin, biar tampilannya beda total sesuai
/// docsV2/mockupv2-android/"PWA Beranda.png". Bottom nav mengambang
/// (sudut membulat, punya jarak dari tepi layar) sesuai mockup PWA itu —
/// bukan bar penuh nempel ke tepi seperti gaya native Android biasa.
export function PetugasShell({ children }: { children: React.ReactNode }) {
  const [hideCount, setHideCount] = useState(0);

  function hide() {
    setHideCount((c) => c + 1);
    return () => setHideCount((c) => Math.max(0, c - 1));
  }

  const navVisible = hideCount === 0;

  return (
    <NavVisibilityContext.Provider value={{ hide }}>
      <div className="min-h-screen flex flex-col bg-[#F7F9F6]">
        <main className={`flex-1 max-w-md w-full mx-auto ${navVisible ? "pb-28" : ""}`}>{children}</main>
        {navVisible && <NavBawah />}
      </div>
    </NavVisibilityContext.Provider>
  );
}
