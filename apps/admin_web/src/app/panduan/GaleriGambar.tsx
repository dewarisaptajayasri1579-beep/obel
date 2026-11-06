"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import type { GambarPanduan, Peran } from "./konten";

/// Carousel screenshot satu layar. Gambar yang belum ada diganti kotak dengan rasio yang sama,
/// supaya tinggi kartu tidak melompat saat file screenshot belum diambil.
export function GaleriGambar({ gambar, peran }: { gambar: GambarPanduan[]; peran: Peran }) {
  const [indeks, setIndeks] = useState(0);
  const [gagal, setGagal] = useState<Set<string>>(new Set());
  const rasio = peran === "barista" ? "aspect-6/13" : "aspect-8/5";
  const bingkai = peran === "barista" ? "max-w-90 mx-auto" : "w-full";
  const aktif = gambar[indeks];
  const banyak = gambar.length > 1;

  const geser = (arah: number) => setIndeks((i) => (i + arah + gambar.length) % gambar.length);

  return (
    <div className={bingkai}>
      <div className={`relative ${rasio} rounded-2xl overflow-hidden border border-slate-200 dark:border-line bg-slate-50 dark:bg-surface-hover`}>
        {aktif && !gagal.has(aktif.file) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={aktif.file}
            src={`/panduan/${aktif.file}`}
            alt={aktif.keterangan}
            className="absolute inset-0 w-full h-full object-cover object-top"
            onError={() => setGagal((s) => new Set(s).add(aktif.file))}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-fg-muted">
            <ImageOff className="w-8 h-8" />
            <span className="text-sm font-semibold">Gambar belum tersedia</span>
          </div>
        )}

      </div>

      {aktif && <p className="mt-2 text-sm text-slate-600 dark:text-fg-secondary text-center">{aktif.keterangan}</p>}

      {banyak && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => geser(-1)}
            aria-label="Gambar sebelumnya"
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-1.5">
            {gambar.map((g, i) => (
              <button
                key={g.file}
                type="button"
                onClick={() => setIndeks(i)}
                aria-label={`Gambar ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === indeks ? "w-5 bg-brand-600" : "w-2 bg-slate-300 dark:bg-line-strong"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => geser(1)}
            aria-label="Gambar berikutnya"
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-secondary hover:bg-slate-100 dark:hover:bg-surface-hover"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
