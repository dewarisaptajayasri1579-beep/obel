"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { List, Route, X } from "lucide-react";
import { LAYAR_ADMIN, LAYAR_BARISTA, type LayarPanduan } from "./konten";

const GRUP: { judul: string; layar: LayarPanduan[] }[] = [
  { judul: "Barista", layar: LAYAR_BARISTA },
  { judul: "Admin", layar: LAYAR_ADMIN },
];

function itemClass(aktif: boolean) {
  return `flex w-full items-center gap-2 rounded-lg py-2 pl-3 pr-2.5 text-left text-sm transition ${
    aktif ? "bg-brand-600 font-semibold text-white" : "text-slate-700 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover"
  }`;
}

/// Daftar isi panduan: kolom kiri di desktop, drawer "Daftar Layar" di bawah lg.
/// `aktif` null = Alur Harian.
export function DaftarLayar({ aktif, onPilih }: { aktif: string | null; onPilih: (kode: string | null) => void }) {
  const [buka, setBuka] = useState(false);
  // Portal baru dipasang setelah mount, supaya render server dan klien pertama sama.
  const [terpasang, setTerpasang] = useState(false);
  useEffect(() => setTerpasang(true), []);

  useEffect(() => {
    if (!buka) return;
    const sebelumnya = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBuka(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = sebelumnya;
      window.removeEventListener("keydown", onKey);
    };
  }, [buka]);

  const pilih = (kode: string | null) => {
    setBuka(false);
    onPilih(kode);
  };

  const isi = (
    <nav className="flex flex-col gap-1 p-3">
      <button type="button" onClick={() => pilih(null)} aria-current={aktif === null ? "page" : undefined} className={itemClass(aktif === null)}>
        <Route className="w-4 h-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Alur Harian</span>
      </button>
      {GRUP.map((g) => (
        <div key={g.judul} className="mt-3">
          <p className="px-2.5 pb-1 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-fg-muted">{g.judul}</p>
          <ul className="flex flex-col gap-0.5">
            {g.layar.map((l, i) => (
              <li key={l.kode}>
                <button type="button" onClick={() => pilih(l.kode)} aria-current={aktif === l.kode ? "page" : undefined} className={itemClass(aktif === l.kode)}>
                  <span className={`w-5 shrink-0 text-right font-mono text-xs ${aktif === l.kode ? "text-white/80" : "text-slate-400"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{l.judul}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-slate-200/90 dark:border-line bg-white dark:bg-surface">
          {isi}
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setBuka(true)}
        className="lg:hidden inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 dark:border-line bg-white dark:bg-surface px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-fg"
      >
        <List className="w-4 h-4" /> Daftar Layar
      </button>

      {/* Portal ke body: <main> membuat stacking context z-10, jadi drawer di dalamnya kalah dari header & bottom bar. */}
      {terpasang &&
        createPortal(
          <div className={`fixed inset-0 z-50 lg:hidden ${buka ? "" : "pointer-events-none"}`} aria-hidden={!buka} inert={!buka}>
            <div className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${buka ? "opacity-100" : "opacity-0"}`} onClick={() => setBuka(false)} />
            <aside
              className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white dark:bg-surface shadow-2xl transition-transform duration-200 ${
                buka ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-line px-4 py-3">
                <span className="text-sm font-bold text-slate-900 dark:text-fg">Daftar Layar</span>
                <button type="button" onClick={() => setBuka(false)} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-hover">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">{isi}</div>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
