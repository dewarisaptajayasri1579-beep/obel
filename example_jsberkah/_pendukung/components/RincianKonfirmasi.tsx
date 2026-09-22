"use client";

import React from "react";
import { terbilangRupiah } from "@/lib/terbilang";

const rupiah = (nilai: number) => `Rp ${Math.round(nilai).toLocaleString("id-ID")}`;

/** Satu baris akibat. `nilai` boleh berupa teks — sebagian akibat memang tidak
 *  berupa angka ("lunas seketika", "tidak ada"). */
export interface AkibatKonfirmasi {
  label: string;
  nilai: string;
  /** Diredupkan untuk akibat yang sifatnya keterangan, bukan nominal. */
  redup?: boolean;
}

/** Rincian akibat di dalam dialog konfirmasi posting — pola dari app-internal
 *  (RincianKonfirmasi), dipakai bersama oleh transaksi yang punya konfirmasi posting
 *  (Purchase Order, dst) supaya dialognya tidak pelan-pelan berbeda bentuk satu sama lain.
 *
 *  Yang disebutkan adalah apa yang AKAN TERJADI beserta angkanya, bukan imbauan agar
 *  pemakainya berhati-hati. Yang menekan Posting selalu merasa sudah berhati-hati; yang
 *  menyelamatkan adalah melihat angkanya sekali lagi di tempat yang berbeda dari tempat
 *  mengetiknya. */
export function RincianKonfirmasi({
  judul = "Yang akan terjadi sekaligus",
  akibat,
  terbilangDari,
  catatan,
}: {
  judul?: string;
  akibat: AkibatKonfirmasi[];
  /** Nominal utama yang diulang dalam huruf. Salah ketik nol sebiji nyaris mustahil
   *  terlihat pada deretan angka, tetapi langsung terbaca janggal begitu dieja. Kosongkan
   *  bila dialognya memang bukan soal satu nominal. */
  terbilangDari?: number;
  /** Kalimat pembuka, mis. peringatan bahwa dokumennya tidak bisa disunting lagi. */
  catatan?: React.ReactNode;
}) {
  return (
    <div className="space-y-3 text-xs">
      {catatan && <p className="leading-relaxed text-slate-600 dark:text-fg-secondary">{catatan}</p>}

      <div className="rounded-xl border border-slate-200/80 dark:border-line overflow-hidden">
        <p className="px-3 py-1.5 bg-slate-50/80 dark:bg-surface-hover text-[11px] font-bold text-slate-600 dark:text-fg-muted uppercase tracking-wider">
          {judul}
        </p>
        <div className="px-3 py-2 space-y-1.5">
          {akibat.map((satu) => (
            <div
              key={satu.label}
              className={`flex items-center justify-between gap-3 ${satu.redup ? "text-slate-500 dark:text-fg-muted" : "text-slate-700 dark:text-fg-secondary"}`}
            >
              <span className="min-w-0">{satu.label}</span>
              <span className="tabular-nums font-semibold shrink-0">{satu.nilai}</span>
            </div>
          ))}
        </div>
      </div>

      {terbilangDari !== undefined && terbilangDari > 0 && (
        <div className="rounded-xl bg-blue-50 dark:bg-surface-hover/40 border border-blue-100 dark:border-line px-3 py-2">
          <p className="text-[10px] font-bold text-slate-500 dark:text-fg-muted uppercase tracking-wider">Terbilang</p>
          <p className="mt-0.5 font-semibold italic text-slate-700 dark:text-fg-secondary leading-snug">{terbilangRupiah(Math.round(terbilangDari))}</p>
        </div>
      )}
    </div>
  );
}

export { rupiah as rupiahKonfirmasi };
