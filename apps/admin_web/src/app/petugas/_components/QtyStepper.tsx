"use client";

import { Minus, Plus } from "lucide-react";
import { OBBEL } from "../_lib/theme";

/// Pengganti `<input type="number">` di layar lapangan — sengaja TIDAK ada
/// jalur ketik sama sekali (bukan cuma "dikurangi", tapi dihilangkan):
/// qty biasanya cuma geser 1-2 dari nilai default (sisa sistem / qty
/// dikirim), jadi tap +/- lebih cepat & tidak butuh keyboard muncul-hilang
/// di lapangan yang tangannya sering basah/berdebu.
export function QtyStepper({
  value,
  onChange,
  min = 0,
  highlighted = false,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-xl border overflow-hidden ${
        highlighted ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Kurangi"
        className="w-10 h-10 flex items-center justify-center text-slate-600 active:bg-slate-100 disabled:opacity-30"
      >
        <Minus size={18} />
      </button>
      <span className="w-10 text-center text-base font-bold text-slate-900 tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Tambah"
        className="w-10 h-10 flex items-center justify-center active:bg-slate-100"
        style={{ color: OBBEL.primaryDark }}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
