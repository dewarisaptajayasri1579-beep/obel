"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, BarChart3 } from "lucide-react";

export type DashboardTabKey = "ringkasan" | "laporan";

const TAB: { key: DashboardTabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: "ringkasan", label: "Dashboard", icon: LayoutGrid },
  { key: "laporan", label: "Laporan", icon: BarChart3 },
];

/// Tab halaman Dashboard — menggabungkan menu "Dashboard" (ringkasan
/// operasional hari ini) dan "Laporan" (tren & ranking 7 hari) yang sebelumnya
/// dua entri menu terpisah, jadi satu titik masuk. Pola sama seperti
/// ProdukTabs (lihat app/master/produk/ProdukTabs.tsx): kedua tab tetap
/// ter-mount dan yang tidak aktif disembunyikan, tab aktif ditulis ke URL
/// lewat replaceState supaya bisa di-bookmark.
export function DashboardTabs({ isi }: { isi: Record<DashboardTabKey, React.ReactNode> }) {
  const [tab, setTab] = useState<DashboardTabKey>("ringkasan");

  // Dibaca setelah mount, bukan saat inisialisasi state — nilai awal harus sama
  // dengan render pertama ("ringkasan"), kalau tidak React protes hydration
  // mismatch ketika URL sudah membawa ?tab=.
  useEffect(() => {
    const dariUrl = new URLSearchParams(window.location.search).get("tab") as DashboardTabKey | null;
    if (dariUrl && TAB.some((t) => t.key === dariUrl)) setTab(dariUrl);
  }, []);

  function pilih(next: DashboardTabKey) {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    if (next === "ringkasan") params.delete("tab");
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

      {TAB.map(({ key }) => (
        <div key={key} className={tab === key ? "" : "hidden"}>
          {isi[key]}
        </div>
      ))}
    </div>
  );
}
