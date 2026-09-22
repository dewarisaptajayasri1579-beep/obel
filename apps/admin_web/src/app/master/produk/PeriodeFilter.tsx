"use client";

import { Calendar } from "lucide-react";

export const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

/// Periode berjalan menurut Asia/Jakarta, bukan zona waktu perangkat. Batas bulan
/// di sini harus sama persis dengan yang dipakai backend saat menghitung rekap —
/// kalau berbeda, mutasi di jam-jam pinggir bulan jatuh ke periode yang berbeda
/// antara yang ditampilkan dan yang dihitung.
export function periodeBerjalanJakarta(): { bulan: number; tahun: number } {
  const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return { bulan: jakarta.getUTCMonth() + 1, tahun: jakarta.getUTCFullYear() };
}

const kelasSelect =
  "h-9 pl-3 pr-8 rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-xs font-semibold text-slate-700 dark:text-fg-secondary cursor-pointer focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 appearance-none shadow-2xs transition-colors";

export function PeriodeFilter({
  bulan,
  tahun,
  onChange,
  children,
}: {
  bulan: number;
  tahun: number;
  onChange: (p: { bulan: number; tahun: number }) => void;
  children?: React.ReactNode;
}) {
  const kini = periodeBerjalanJakarta();
  // Lima tahun ke belakang cukup: aplikasi ini belum berumur lebih dari itu, dan
  // daftar yang lebih panjang cuma menambah gulir tanpa ada datanya.
  const tahunOpsi = Array.from({ length: 5 }, (_, i) => kini.tahun - i);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-fg-muted">
        <Calendar className="w-3.5 h-3.5" />
        Periode
      </span>

      <div className="relative">
        <select
          className={kelasSelect}
          value={bulan}
          onChange={(e) => onChange({ bulan: Number(e.target.value), tahun })}
          aria-label="Bulan"
        >
          {BULAN.map((nama, i) => (
            <option key={nama} value={i + 1}>
              {nama}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        <select
          className={kelasSelect}
          value={tahun}
          onChange={(e) => onChange({ bulan, tahun: Number(e.target.value) })}
          aria-label="Tahun"
        >
          {tahunOpsi.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {children}
    </div>
  );
}
