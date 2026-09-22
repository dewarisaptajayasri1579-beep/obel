"use client";

import { useEffect, type RefObject } from "react";

/** Fokus otomatis ke elemen bertanda `data-fokus-awal` di dalam `wadah` begitu form muncul —
 *  tanpa ini pemakai keyboard-first harus klik dulu sebelum bisa mulai mengetik. Ditunda satu
 *  animation frame (elemen sudah ada di DOM tapi browser belum tentu selesai menata layoutnya,
 *  fokus ke elemen yang belum tergambar kadang langsung lepas lagi). `preventScroll` dipasang
 *  karena form baru dibuka biasanya sudah di puncak halaman, jadi tidak perlu digulir. */
export function useFokusAwal(wadah: RefObject<HTMLElement | null>, siap = true) {
  useEffect(() => {
    if (!siap) return;
    const id = requestAnimationFrame(() => {
      const wadahnya = wadah.current;
      if (!wadahnya) return;
      const ditandai = wadahnya.querySelector<HTMLElement>("[data-fokus-awal]");
      const sasaran = ditandai
        ? ditandai.matches("input,select,textarea,button")
          ? ditandai
          : ditandai.querySelector<HTMLElement>("input,select,textarea,button")
        : wadahnya.querySelector<HTMLElement>("input:not([disabled]),select:not([disabled]),textarea:not([disabled])");
      sasaran?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [wadah, siap]);
}
