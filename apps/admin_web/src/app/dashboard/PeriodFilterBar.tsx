"use client";

import { DatePicker } from "@/components/ui/DatePicker";
import { PERIOD_OPTIONS, type PeriodKey } from "./usePeriodFilter";

export function PeriodFilterBar({
  period,
  setPeriod,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  start,
  end,
}: {
  period: PeriodKey;
  setPeriod: (p: PeriodKey) => void;
  customStart: string;
  setCustomStart: (v: string) => void;
  customEnd: string;
  setCustomEnd: (v: string) => void;
  start: string;
  end: string;
}) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => setPeriod(opt.key)}
          className={`px-3.5 h-9 rounded-xl text-xs font-bold border transition-colors ${
            period === opt.key
              ? "bg-[var(--brand-700)] text-white border-[var(--brand-700)]"
              : "bg-white dark:bg-surface text-slate-600 dark:text-fg-secondary border-slate-200/90 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover"
          }`}
        >
          {opt.label}
        </button>
      ))}

      {period === "CUSTOM" && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-40 shrink-0">
            <DatePicker sizeVariant="sm" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          </div>
          <span className="text-xs text-slate-400 dark:text-fg-muted">s/d</span>
          <div className="w-40 shrink-0">
            <DatePicker sizeVariant="sm" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}

      {start > end && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 w-full">Tanggal mulai tidak boleh setelah tanggal akhir.</p>
      )}
    </div>
  );
}
