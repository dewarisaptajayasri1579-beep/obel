"use client";

import { useEffect, useState } from "react";
import { Package, Trophy, ArrowLeftRight, Store, LineChart } from "lucide-react";

export type ProdukTabKey = "main" | "mutasi" | "ranking" | "sebaran" | "analisa";

const TAB: { key: ProdukTabKey; label: string; icon: typeof Package }[] = [
  { key: "main", label: "Main", icon: Package },
  { key: "mutasi", label: "Mutasi Stok", icon: ArrowLeftRight },
  { key: "ranking", label: "Ranking Penjualan", icon: Trophy },
  { key: "sebaran", label: "Sebaran", icon: Store },
  { key: "analisa", label: "Analisa", icon: LineChart },
];

/** Lima tab halaman Produk (Tahap 23). Isi tiap tab dirender di SERVER dan dititipkan lewat
 *  prop — komponen ini murni menyembunyikan yang tidak aktif, jadi berpindah tab tidak menembak
 *  server sama sekali.
 *
 *  Tab yang isinya belum dibangun cukup TIDAK diberi node (undefined): tombolnya digambar
 *  abu-abu bertanda "Segera", bukan tab yang dibuka lalu kosong. Pola yang sama dengan item
 *  menu `disabled` di sidebar.
 *
 *  Tab aktif ditulis ke URL lewat `replaceState` supaya bisa di-bookmark, BUKAN navigasi —
 *  isinya sudah ada di halaman ini. Beda dengan penyaring periode di dalam tab, yang memang
 *  navigasi beneran karena angkanya cuma bisa dihitung server. */
export function ProdukTabs({ isi }: { isi: Partial<Record<ProdukTabKey, React.ReactNode>> }) {
  const [tab, setTab] = useState<ProdukTabKey>("main");

  // Dibaca setelah mount, bukan saat inisialisasi state — nilai awal harus sama dengan yang
  // dirender server ("main"), kalau tidak React protes hydration mismatch saat URL sudah ber-?tab.
  useEffect(() => {
    const dariUrl = new URLSearchParams(window.location.search).get("tab") as ProdukTabKey | null;
    if (dariUrl && TAB.some((t) => t.key === dariUrl)) setTab(dariUrl);
  }, []);

  const pilih = (next: ProdukTabKey) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "main") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        {TAB.map(({ key, label, icon: Icon }) => {
          const belumAda = !isi[key];
          const aktif = tab === key;
          if (belumAda) {
            return (
              <span
                key={key}
                title="Segera hadir"
                className="flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-bold border border-dashed border-slate-200 dark:border-line text-slate-400 dark:text-fg-muted/60 cursor-not-allowed"
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">Segera</span>
              </span>
            );
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => pilih(key)}
              className={`flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                aktif
                  ? "bg-[#0544cc] text-white border-[#0544cc] shadow-xs"
                  : "bg-white/90 dark:bg-surface text-slate-700 dark:text-fg-secondary border-slate-200/90 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Semua tab tetap ter-mount, yang tidak aktif disembunyikan — supaya penyaring & posisi
          gulir di dalam tab tidak ter-reset tiap kali berpindah. */}
      {TAB.map(({ key }) => isi[key] && (
        <div key={key} className={tab === key ? "" : "hidden"}>
          {isi[key]}
        </div>
      ))}
    </div>
  );
}
