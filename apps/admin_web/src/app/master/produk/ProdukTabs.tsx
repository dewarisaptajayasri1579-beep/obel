"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Package } from "lucide-react";

export type ProdukTabKey = "main" | "mutasi";

const TAB: { key: ProdukTabKey; label: string; icon: typeof Package }[] = [
  { key: "main", label: "Main", icon: Package },
  { key: "mutasi", label: "Mutasi Stok", icon: ArrowLeftRight },
];

/// Tab halaman Produk. Semua tab tetap ter-mount dan yang tidak aktif
/// disembunyikan — supaya penyaring periode dan posisi gulir di dalam tab tidak
/// ter-reset tiap kali berpindah.
///
/// Tab aktif ditulis ke URL lewat replaceState supaya bisa di-bookmark, BUKAN
/// navigasi: isinya sudah ada di halaman ini.
export function ProdukTabs({ isi }: { isi: Partial<Record<ProdukTabKey, React.ReactNode>> }) {
  const [tab, setTab] = useState<ProdukTabKey>("main");

  // Dibaca setelah mount, bukan saat inisialisasi state — nilai awal harus sama
  // dengan render pertama ("main"), kalau tidak React protes hydration mismatch
  // ketika URL sudah membawa ?tab=.
  useEffect(() => {
    const dariUrl = new URLSearchParams(window.location.search).get("tab") as ProdukTabKey | null;
    if (dariUrl && TAB.some((t) => t.key === dariUrl)) setTab(dariUrl);
  }, []);

  function pilih(next: ProdukTabKey) {
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
