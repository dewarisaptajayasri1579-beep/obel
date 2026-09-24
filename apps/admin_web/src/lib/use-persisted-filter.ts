"use client";

import { useEffect, useState } from "react";

/** State filter (string) yang disimpan di localStorage per storageKey — tanpa ini filter yang
 *  dipilih user hilang begitu pindah menu lalu balik lagi, karena Next.js App Router meng-unmount
 *  total komponen halaman saat ganti route (state React biasa ikut lenyap).
 *
 *  Pakai storageKey yang SAMA di beberapa halaman kalau filter itu memang mau otomatis
 *  tersinkron lintas menu (mis. Booth/Petugas di grup Transaksi Booth) — storageKey yang beda
 *  per halaman kalau filter itu cuma diingat untuk halaman itu sendiri. */
export function usePersistedFilter(storageKey: string, defaultValue: string): [string, (v: string) => void] {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const saved = window.localStorage.getItem(`filter:${storageKey}`);
    if (saved !== null) setValue(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const update = (v: string) => {
    setValue(v);
    if (v === defaultValue) window.localStorage.removeItem(`filter:${storageKey}`);
    else window.localStorage.setItem(`filter:${storageKey}`, v);
  };

  return [value, update];
}

/** storageKey BERSAMA untuk filter Booth & Petugas di semua menu grup "Transaksi Booth"
 *  (Kasir, Terima Stok, Check In-Check Out) — sengaja SATU kunci yang sama dipakai di
 *  beberapa halaman itu supaya pilihan Booth/Petugas otomatis ikut sama begitu pindah
 *  antar menu dalam grup ini, bukan filter independen per halaman. */
export const TRANSAKSI_BOOTH_FILTER_KEYS = {
  boothId: "transaksi-booth:boothId",
  staffId: "transaksi-booth:staffId",
} as const;
