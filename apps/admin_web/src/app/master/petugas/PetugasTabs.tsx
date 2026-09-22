"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";

export type PetugasTabKey = "main";

const TAB: { key: PetugasTabKey; label: string; icon: typeof UserRound }[] = [
  { key: "main", label: "Main", icon: UserRound },
];

/// Tab halaman Petugas — cuma satu tab ("Main") untuk sekarang, tapi tetap
/// dipola sebagai tab (bukan halaman polos) supaya menambah tab lain nanti
/// (mis. riwayat shift per petugas) tidak perlu merombak struktur halaman.
/// Sama persis dengan ProdukTabs/BoothTabs — lihat komentar di sana.
export function PetugasTabs({ isi }: { isi: Partial<Record<PetugasTabKey, React.ReactNode>> }) {
  const [tab, setTab] = useState<PetugasTabKey>("main");

  useEffect(() => {
    const dariUrl = new URLSearchParams(window.location.search).get("tab") as PetugasTabKey | null;
    if (dariUrl && TAB.some((t) => t.key === dariUrl)) setTab(dariUrl);
  }, []);

  function pilih(next: PetugasTabKey) {
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
