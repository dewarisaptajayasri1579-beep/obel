"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

/** `YYYY-MM` -> tanggal pertama & terakhir bulan itu (`YYYY-MM-DD`), yang tetap jadi bentuk
 *  `from`/`to` yang dikirim ke backend. Hari terakhir dihitung lewat `new Date(th, bl, 0)` —
 *  tanggal 0 bulan berikutnya = hari terakhir bulan ini, sekaligus benar untuk Februari kabisat. */
function rentangBulan(bulan: string) {
  const [th, bl] = bulan.split("-").map(Number);
  const akhir = new Date(th, bl, 0).getDate();
  return { from: `${bulan}-01`, to: `${bulan}-${String(akhir).padStart(2, "0")}` };
}

const geserBulan = (bulan: string, langkah: number) => {
  const [th, bl] = bulan.split("-").map(Number);
  const d = new Date(th, bl - 1 + langkah, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Pemilih periode rekap stok — SATU BULAN penuh, bukan rentang tanggal bebas (permintaan Owner).
 *
 *  Alasannya bukan cuma lebih ringkas: stok dibaca per bulan karena tutup bukunya per bulan, dan
 *  rentang bebas membuka pertanyaan yang tidak bisa dijawab rapi ("saldo awal tanggal 17 itu
 *  saldo apa?"). Dengan dikunci per bulan, Saldo Awal di layar selalu berarti hal yang sama:
 *  posisi di akhir bulan sebelumnya.
 *
 *  Navigasi beneran (`router.push`), BUKAN penyaringan di browser seperti panel Master Produk:
 *  Saldo Awal adalah seluruh mutasi SEBELUM awal bulan, angka yang cuma bisa dihitung backend. */
export function PeriodeStokFilter({ from, basePath, extraParams }: { from: string; basePath: string; extraParams?: Record<string, string> }) {
  const router = useRouter();
  const [bulan, setBulan] = useState(from.slice(0, 7));

  const buka = (bulanBaru: string) => {
    if (!bulanBaru) return;
    setBulan(bulanBaru);
    const rentang = rentangBulan(bulanBaru);
    const params = new URLSearchParams(extraParams);
    params.set("from", rentang.from);
    params.set("to", rentang.to);
    router.push(`${basePath}?${params}`);
  };

  const gayaTombol =
    "w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover flex items-center justify-center text-slate-600 dark:text-fg-muted cursor-pointer transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-fg-muted uppercase tracking-wide">
        <Calendar className="w-3.5 h-3.5" />
        Periode
      </span>

      {/* Tombol mundur/maju satu bulan — cara paling sering dipakai saat mencocokkan stok
          (bandingkan bulan ini dengan bulan lalu), jauh lebih cepat daripada membuka pemilih. */}
      <button type="button" onClick={() => buka(geserBulan(bulan, -1))} className={gayaTombol} title="Bulan sebelumnya" aria-label="Bulan sebelumnya">
        <ChevronLeft className="w-4 h-4" />
      </button>

      <input
        type="month"
        value={bulan}
        onChange={(e) => buka(e.target.value)}
        aria-label="Pilih bulan"
        className="h-8 px-2 text-xs rounded-lg bg-white dark:bg-surface border border-slate-200/90 dark:border-line text-slate-700 dark:text-fg-secondary focus:outline-none focus:border-[#0544cc]"
      />

      <button type="button" onClick={() => buka(geserBulan(bulan, 1))} className={gayaTombol} title="Bulan berikutnya" aria-label="Bulan berikutnya">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
