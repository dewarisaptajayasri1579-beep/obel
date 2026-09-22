"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Receipt, Store, TrendingDown } from "lucide-react";

export type BoothTabKey = "main" | "mutasi-stok" | "mutasi-penjualan" | "riwayat-penjualan";

const TAB: { key: BoothTabKey; label: string; icon: typeof Store }[] = [
  { key: "main", label: "Main", icon: Store },
  { key: "mutasi-stok", label: "Mutasi Stok", icon: ArrowLeftRight },
  { key: "mutasi-penjualan", label: "Mutasi Penjualan", icon: TrendingDown },
  { key: "riwayat-penjualan", label: "Riwayat Penjualan", icon: Receipt },
];

/// Tab halaman Booth — pola sama persis dengan ProdukTabs.tsx (lihat komentar
/// di sana): semua tab tetap ter-mount (disembunyikan lewat class, bukan
/// unmount) supaya penyaring & posisi gulir tiap tab tidak reset saat
/// berpindah, dan tab aktif ditulis ke URL lewat replaceState supaya bisa
/// di-bookmark tanpa navigasi Next.
export function BoothTabs({ isi }: { isi: Partial<Record<BoothTabKey, React.ReactNode>> }) {
  const [tab, setTab] = useState<BoothTabKey>("main");

  useEffect(() => {
    const dariUrl = new URLSearchParams(window.location.search).get("tab") as BoothTabKey | null;
    if (dariUrl && TAB.some((t) => t.key === dariUrl)) setTab(dariUrl);
  }, []);

  function pilih(next: BoothTabKey) {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "main") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        {TAB.map(({ key, label, icon: Icon }) => {
          const aktif = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => pilih(key)}
              className={`flex items-center gap-2 px-4 h-9 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                aktif
                  ? "bg-[var(--brand-700)] text-white border-[var(--brand-700)] shadow-xs"
                  : "bg-white/90 dark:bg-surface text-slate-700 dark:text-fg-secondary border-slate-200/90 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {TAB.map(({ key }) =>
        isi[key] ? (
          <div key={key} className={tab === key ? "" : "hidden"}>
            {isi[key]}
          </div>
        ) : null,
      )}
    </div>
  );
}
