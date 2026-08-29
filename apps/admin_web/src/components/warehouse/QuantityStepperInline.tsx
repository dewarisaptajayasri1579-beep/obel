"use client";

import { Minus, Plus } from "lucide-react";

/// Stepper +/- sederhana untuk input qty cup — dipakai di Stok Gudang &
/// Distribusi. Sesuai prinsip "banyak klik, minim ketik"
/// (06-ui-ux-guideline.md).
export function QuantityStepperInline({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 dark:border-line px-2 py-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-elevated hover:bg-slate-200 dark:hover:bg-line transition-colors"
      >
        <Minus className="w-4 h-4" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="w-16 text-center bg-transparent font-bold text-slate-900 dark:text-fg outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-elevated hover:bg-slate-200 dark:hover:bg-line transition-colors"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
