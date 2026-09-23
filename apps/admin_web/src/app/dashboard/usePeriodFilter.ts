"use client";

import { useMemo, useState } from "react";
import { jakartaIsoWeekday, jakartaTodayDateIso, shiftJakartaDateIso } from "@/lib/datetime";

export type PeriodKey = "HARI_INI" | "MINGGU_INI" | "BULAN_INI" | "CUSTOM";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "HARI_INI", label: "Hari Ini" },
  { key: "MINGGU_INI", label: "Minggu Ini" },
  { key: "BULAN_INI", label: "Bulan Ini" },
  { key: "CUSTOM", label: "Custom" },
];

function firstDayOfMonthIso(todayIso: string): string {
  return `${todayIso.slice(0, 7)}-01`;
}

function mondayOfWeekIso(todayIso: string): string {
  const weekday = jakartaIsoWeekday(todayIso); // 1=Senin..7=Minggu
  return shiftJakartaDateIso(todayIso, -(weekday - 1));
}

/// Satu sumber state filter periode (Hari Ini/Minggu Ini/Bulan Ini/Custom)
/// Dashboard — dipakai bareng oleh bar filter (di atas card Omzet) dan
/// SalesReportPanel (tabel-tabel di bawahnya), supaya keduanya selalu sinkron.
export function usePeriodFilter() {
  const todayIso = useMemo(() => jakartaTodayDateIso(), []);
  const [period, setPeriod] = useState<PeriodKey>("HARI_INI");
  const [customStart, setCustomStart] = useState(todayIso);
  const [customEnd, setCustomEnd] = useState(todayIso);

  const { start, end } = useMemo(() => {
    if (period === "HARI_INI") return { start: todayIso, end: todayIso };
    if (period === "MINGGU_INI") return { start: mondayOfWeekIso(todayIso), end: todayIso };
    if (period === "BULAN_INI") return { start: firstDayOfMonthIso(todayIso), end: todayIso };
    return { start: customStart, end: customEnd };
  }, [period, todayIso, customStart, customEnd]);

  return { period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd, start, end };
}
