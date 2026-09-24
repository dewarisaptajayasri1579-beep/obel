"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, Receipt, Settings, CreditCard, History, Package } from "lucide-react";
import { OBBEL } from "@/app/petugas/_lib/theme";

const PETUGAS_GREEN = OBBEL.primaryDark;

const RIWAYAT_MENU = [
  { href: "/petugas/riwayat-absen", label: "Riwayat Absen", icon: Clock },
  { href: "/petugas/stok?tab=RIWAYAT", label: "Riwayat Stok", icon: Package },
  { href: "/petugas/riwayat-penjualan", label: "Riwayat Penjualan", icon: Receipt },
];

const RIWAYAT_PREFIXES = ["/petugas/riwayat-absen", "/petugas/riwayat-penjualan"];

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

/// Shell mobile-first Web Petugas Booth — SENGAJA tidak memakai
/// AppLayout/Sidebar/Header admin, biar tampilannya beda total sesuai
/// docsV2/mockupv2-android/"PWA Beranda.png". Bottom nav mengambang
/// (rounded-full, punya jarak dari tepi layar) sesuai mockup PWA itu —
/// bukan bar penuh nempel ke tepi seperti gaya native Android biasa.
export function PetugasShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [hideCount, setHideCount] = useState(0);
  const [riwayatMenuOpen, setRiwayatMenuOpen] = useState(false);

  function hide() {
    setHideCount((c) => c + 1);
    return () => setHideCount((c) => Math.max(0, c - 1));
  }

  // Menu Riwayat ditutup otomatis begitu pindah halaman (mis. setelah pilih
  // salah satu sub-menunya), supaya tidak nyangkut kebuka pas balik lagi.
  useEffect(() => {
    setRiwayatMenuOpen(false);
  }, [pathname]);

  const navVisible = hideCount === 0;
  const riwayatActive = RIWAYAT_PREFIXES.some((p) => pathname.startsWith(p));

  return (
    <NavVisibilityContext.Provider value={{ hide }}>
      <div className="min-h-screen flex flex-col bg-[#F7F9F6]">
        <main className={`flex-1 max-w-md w-full mx-auto ${navVisible ? "pb-28" : ""}`}>{children}</main>

        {navVisible && riwayatMenuOpen && (
          <div className="fixed inset-0 z-20" onClick={() => setRiwayatMenuOpen(false)}>
            <div
              className="absolute bottom-24 left-4 right-4 max-w-md mx-auto bg-white rounded-2xl shadow-[0_12px_32px_-8px_rgba(11,93,52,0.3)] border border-slate-100 p-2"
              onClick={(e) => e.stopPropagation()}
            >
              {RIWAYAT_MENU.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-50"
                    onClick={() => setRiwayatMenuOpen(false)}
                  >
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${PETUGAS_GREEN}14`, color: PETUGAS_GREEN }}
                    >
                      <Icon size={16} />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {navVisible && (
          <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-20">
            <div className="max-w-md mx-auto bg-white rounded-full shadow-[0_12px_32px_-8px_rgba(11,93,52,0.25)] border border-slate-100 grid grid-cols-4 p-1.5">
              {TABS.map((tab) => {
                if (tab.type === "menu") {
                  const active = riwayatActive || riwayatMenuOpen;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => setRiwayatMenuOpen((v) => !v)}
                      className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold rounded-full transition"
                      style={{
                        color: active ? PETUGAS_GREEN : "#A3ABA6",
                        backgroundColor: active ? `${PETUGAS_GREEN}14` : "transparent",
                      }}
                    >
                      <Icon size={19} strokeWidth={active ? 2.6 : 2} />
                      <span className="truncate max-w-[64px]">{tab.label}</span>
                    </button>
                  );
                }

                const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold rounded-full transition"
                    style={{
                      color: active ? PETUGAS_GREEN : "#A3ABA6",
                      backgroundColor: active ? `${PETUGAS_GREEN}14` : "transparent",
                    }}
                  >
                    <Icon size={19} strokeWidth={active ? 2.6 : 2} />
                    <span className="truncate max-w-[64px]">{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </NavVisibilityContext.Provider>
  );
}
