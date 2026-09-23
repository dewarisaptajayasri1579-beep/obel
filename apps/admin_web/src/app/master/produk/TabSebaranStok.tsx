"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownWideNarrow, ArrowLeftRight, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type BarisSebaranStokBooth, type SebaranStokResponse } from "@/lib/api-client";

/// Kelas warna sel Booth — Aman/Menipis/Kritis ikuti status BR-007, TAPI
/// hanya berlaku kalau qty > 0 ATAU Booth ini pernah dikirimi produk ini
/// (qty 0 + pernah dikirim = benar-benar Kritis/Habis, ditandai merah tebal).
/// Qty 0 yang BELUM PERNAH diserahterimakan ke Booth itu bukan masalah stok,
/// jadi sengaja tetap abu-abu netral, bukan ikut skema Aman/Menipis/Kritis.
function kelasSelBooth(b: BarisSebaranStokBooth): string {
  if (b.qty === 0 && !b.pernahDikirim) return "text-slate-300 dark:text-fg-disabled";
  if (b.qty === 0 && b.pernahDikirim) return "text-rose-600 dark:text-rose-400 font-bold";
  if (b.status === "Kritis") return "text-rose-600 dark:text-rose-400 font-bold";
  if (b.status === "Menipis") return "text-amber-600 dark:text-amber-400 font-bold";
  return "text-emerald-600 dark:text-emerald-400 font-bold";
}

function angka(n: number) {
  return n.toLocaleString("id-ID");
}

function hariIniJakarta(): string {
  const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return jakarta.toISOString().slice(0, 10);
}

const LEBAR_NO = 44;
const LEBAR_PRODUK = 220;
const LEBAR_KOLOM = 96;
const GESER_PX = 280;

/// Tab "Sebaran Stok" — satu baris per produk, kolom Gudang + In Proses +
/// tiap Booth, dihitung utk SATU tanggal (bukan rentang bulan seperti tab
/// Mutasi Stok). Kolom No. & Nama Produk di-freeze (position: sticky) supaya
/// tetap kelihatan saat tabel digeser ke kanan — jumlah Booth bisa belasan,
/// jadi tabelnya pasti lebih lebar dari layar.
export function TabSebaranStok() {
  const toast = useToast();
  const [tanggal, setTanggal] = useState(hariIniJakarta());
  const [data, setData] = useState<SebaranStokResponse | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [cari, setCari] = useState("");
  // "TOTAL" (default) | "GUDANG" | "IN_PROSES" | boothId — klik header kolom
  // manapun buat urutkan produk terbanyak KHUSUS kolom itu; klik "Total" atau
  // kolom yang sama lagi buat kembali ke urutan Total semua lokasi.
  const [urutBerdasarkan, setUrutBerdasarkan] = useState<string>("TOTAL");
  // Urutkan KOLOM Booth dari total qty terbanyak (kiri) ke paling sedikit
  // (kanan) — beda dari urutBerdasarkan yang ngurutin BARIS produk.
  const [urutkanKolom, setUrutkanKolom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMemuat(true);
    api
      .getSebaranStok(tanggal)
      .then(setData)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat Sebaran Stok.");
        setData(null);
      })
      .finally(() => setMemuat(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal]);

  function geser(arah: -1 | 1) {
    scrollRef.current?.scrollBy({ left: arah * GESER_PX, behavior: "smooth" });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Fallback eksplisit — beberapa laptop/trackpad tidak bisa swipe
    // horizontal sama sekali, dan tidak semua browser otomatis meneruskan
    // panah kiri/kanan ke container yang lagi di-scroll.
    if (e.key === "ArrowRight") {
      e.preventDefault();
      geser(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      geser(-1);
    }
  }

  function qtyUrut(r: SebaranStokResponse["rows"][number]): number {
    if (urutBerdasarkan === "TOTAL") return r.total;
    if (urutBerdasarkan === "GUDANG") return r.gudang;
    if (urutBerdasarkan === "IN_PROSES") return r.inProses;
    return r.perBooth.find((b) => b.boothId === urutBerdasarkan)?.qty ?? 0;
  }

  const rows = data
    ? data.rows
        .filter((r) => `${r.name} ${r.sku} ${r.category ?? ""}`.toLowerCase().includes(cari.trim().toLowerCase()))
        .sort((a, b) => qtyUrut(b) - qtyUrut(a))
    : [];

  const namaUrutan =
    urutBerdasarkan === "TOTAL"
      ? "Total semua lokasi"
      : urutBerdasarkan === "GUDANG"
        ? "Gudang"
        : urutBerdasarkan === "IN_PROSES"
          ? "In Proses"
          : (data?.booths.find((b) => b.boothId === urutBerdasarkan)?.boothName ?? "");

  const KELAS_SEL = "py-2.5 px-3 text-center tabular-nums whitespace-nowrap";
  const KELAS_HEAD_SEL = "py-3 px-3 text-center whitespace-nowrap";

  function HeaderUrut({ kunci, label }: { kunci: string; label: string }) {
    const aktif = urutBerdasarkan === kunci;
    return (
      <button
        type="button"
        onClick={() => setUrutBerdasarkan((prev) => (prev === kunci ? "TOTAL" : kunci))}
        title={`Urutkan produk terbanyak berdasarkan ${label}`}
        className={`w-full flex items-center justify-center gap-1 py-1.5 px-3 cursor-pointer hover:text-[var(--brand-700)] dark:hover:text-brand-400 transition-colors ${
          aktif ? "text-[var(--brand-700)] dark:text-brand-400" : ""
        }`}
      >
        {aktif && <ArrowDownWideNarrow className="w-3 h-3 shrink-0" />}
        <span>{label}</span>
      </button>
    );
  }

  // Footer "Total" per kolom — dihitung dari SEMUA produk (data.rows, bukan
  // `rows` yang sudah disaring pencarian), supaya angkanya tetap benar walau
  // tabel lagi difilter.
  const totalGudang = data?.rows.reduce((s, r) => s + r.gudang, 0) ?? 0;
  const totalInProses = data?.rows.reduce((s, r) => s + r.inProses, 0) ?? 0;
  const totalPerBooth =
    data?.booths.map((b) => ({
      boothId: b.boothId,
      qty: data.rows.reduce((s, r) => s + (r.perBooth.find((x) => x.boothId === b.boothId)?.qty ?? 0), 0),
    })) ?? [];
  const grandTotal = data?.rows.reduce((s, r) => s + r.total, 0) ?? 0;

  const urutanBooth = data
    ? urutkanKolom
      ? [...data.booths].sort((a, b) => {
          const qtyA = totalPerBooth.find((x) => x.boothId === a.boothId)?.qty ?? 0;
          const qtyB = totalPerBooth.find((x) => x.boothId === b.boothId)?.qty ?? 0;
          return qtyB - qtyA;
        })
      : data.booths
    : [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4 flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-fg-muted">
          <MapPin className="w-3.5 h-3.5" />
          Tanggal
        </span>
        <input
          type="date"
          value={tanggal}
          max={hariIniJakarta()}
          onChange={(e) => setTanggal(e.target.value)}
          className="h-9 px-2.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs"
        />

        <input
          type="text"
          placeholder="Cari nama atau kode produk..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          className="h-9 px-3.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs w-full sm:w-64"
        />

        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand-700)] dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 rounded-full px-2.5 py-1">
          <ArrowDownWideNarrow className="w-3 h-3 shrink-0" />
          Terbanyak: {namaUrutan}
        </span>
        <span className="text-[11px] text-slate-400 dark:text-fg-muted hidden md:inline">
          Klik nama kolom di header untuk urutkan terbanyak per kolom
        </span>

        <button
          type="button"
          onClick={() => setUrutkanKolom((v) => !v)}
          title="Urutkan kolom Booth dari stok terbanyak (kiri) ke paling sedikit (kanan)"
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 border cursor-pointer transition-colors ${
            urutkanKolom
              ? "bg-[var(--brand-700)] text-white border-[var(--brand-700)]"
              : "bg-white/90 dark:bg-surface text-slate-600 dark:text-fg-secondary border-slate-200/90 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover"
          }`}
        >
          <ArrowLeftRight className="w-3 h-3 shrink-0" />
          Urutkan Kolom Booth
        </button>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px] text-slate-400 dark:text-fg-muted hidden sm:inline">
            Geser tabel dengan tombol atau panah kiri/kanan
          </span>
          <button
            type="button"
            onClick={() => geser(-1)}
            title="Geser ke kiri"
            className="w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:bg-slate-50 dark:hover:bg-surface-hover cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => geser(1)}
            title="Geser ke kanan"
            className="w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:bg-slate-50 dark:hover:bg-surface-hover cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs overflow-hidden">
        {memuat ? (
          <div className="flex justify-center py-14">
            <Spinner />
          </div>
        ) : !data ? (
          <div className="text-center text-slate-500 dark:text-fg-muted py-14 text-xs">Gagal memuat data.</div>
        ) : (
          <div
            ref={scrollRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--brand-700)]/30"
          >
            <table className="text-xs sm:text-sm border-separate border-spacing-0">
              <thead className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                <tr>
                  <th
                    className="sticky left-0 z-20 bg-brand-50/95 dark:bg-surface-hover py-3 px-2 text-center border-b border-r border-slate-200/80 dark:border-line"
                    style={{ width: LEBAR_NO, minWidth: LEBAR_NO }}
                  >
                    No.
                  </th>
                  <th
                    className="sticky z-20 bg-brand-50/95 dark:bg-surface-hover py-3 px-3 text-left border-b border-r border-slate-200/80 dark:border-line"
                    style={{ left: LEBAR_NO, width: LEBAR_PRODUK, minWidth: LEBAR_PRODUK }}
                  >
                    Nama Produk
                  </th>
                  <th
                    className={`border-b border-slate-200/80 dark:border-line ${urutBerdasarkan === "GUDANG" ? "bg-brand-100/60 dark:bg-brand-500/15" : ""}`}
                    style={{ minWidth: LEBAR_KOLOM }}
                  >
                    <HeaderUrut kunci="GUDANG" label="Gudang" />
                  </th>
                  <th
                    className={`border-b border-slate-200/80 dark:border-line ${urutBerdasarkan === "IN_PROSES" ? "bg-brand-100/60 dark:bg-brand-500/15" : ""}`}
                    style={{ minWidth: LEBAR_KOLOM }}
                  >
                    <HeaderUrut kunci="IN_PROSES" label="In Proses" />
                  </th>
                  {urutanBooth.map((b) => (
                    <th
                      key={b.boothId}
                      className={`border-b border-slate-200/80 dark:border-line ${urutBerdasarkan === b.boothId ? "bg-brand-100/60 dark:bg-brand-500/15" : ""}`}
                      style={{ minWidth: LEBAR_KOLOM }}
                    >
                      <HeaderUrut kunci={b.boothId} label={b.boothName} />
                    </th>
                  ))}
                  <th
                    className={`border-b border-l-2 border-slate-300 dark:border-line ${urutBerdasarkan === "TOTAL" ? "bg-brand-100/60 dark:bg-brand-500/15" : ""}`}
                    style={{ minWidth: LEBAR_KOLOM }}
                  >
                    <HeaderUrut kunci="TOTAL" label="Total" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {rows.map((r, i) => (
                  <tr key={r.productId} className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                    <td
                      className="sticky left-0 z-10 bg-white dark:bg-surface py-2.5 px-2 text-center text-slate-500 dark:text-fg-muted border-r border-slate-200/70 dark:border-line"
                      style={{ width: LEBAR_NO, minWidth: LEBAR_NO }}
                    >
                      {i + 1}
                    </td>
                    <td
                      className="sticky z-10 bg-white dark:bg-surface py-2.5 px-3 border-r border-slate-200/70 dark:border-line"
                      style={{ left: LEBAR_NO, width: LEBAR_PRODUK, minWidth: LEBAR_PRODUK }}
                    >
                      <span className="font-semibold text-slate-800 dark:text-fg">{r.name}</span>
                      <span className="ml-1.5 text-[10px] text-slate-400 dark:text-fg-muted">{r.category ?? "Tanpa Kategori"}</span>
                    </td>
                    <td className={`${KELAS_SEL} ${r.gudang > 0 ? "font-bold text-slate-700 dark:text-fg-secondary" : "text-slate-300 dark:text-fg-disabled"}`}>
                      {angka(r.gudang)}
                    </td>
                    <td className={`${KELAS_SEL} ${r.inProses > 0 ? "font-bold text-amber-600 dark:text-amber-400" : "text-slate-300 dark:text-fg-disabled"}`}>
                      {angka(r.inProses)}
                    </td>
                    {urutanBooth.map((booth) => {
                      const b = r.perBooth.find((x) => x.boothId === booth.boothId);
                      return (
                        <td key={booth.boothId} className={`${KELAS_SEL} ${b ? kelasSelBooth(b) : "text-slate-300 dark:text-fg-disabled"}`}>
                          {angka(b?.qty ?? 0)}
                        </td>
                      );
                    })}
                    <td
                      className={`${KELAS_SEL} border-l-2 border-slate-200 dark:border-line ${
                        r.total > 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-300 dark:text-fg-disabled"
                      }`}
                    >
                      {angka(r.total)}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4 + (data.booths.length ?? 0)} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      Tidak ada produk yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
              {data && data.rows.length > 0 && (
                <tfoot className="bg-slate-50/80 dark:bg-surface-hover border-t-2 border-slate-200 dark:border-line text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                  <tr>
                    <td
                      colSpan={2}
                      className="sticky left-0 z-10 bg-slate-50/95 dark:bg-surface-hover py-3 px-3 border-r border-slate-200/70 dark:border-line uppercase tracking-wide"
                    >
                      Total
                    </td>
                    <td className={`${KELAS_SEL} text-slate-700 dark:text-fg-secondary`}>{angka(totalGudang)}</td>
                    <td className={`${KELAS_SEL} text-amber-600 dark:text-amber-400`}>{angka(totalInProses)}</td>
                    {urutanBooth.map((booth) => {
                      const b = totalPerBooth.find((x) => x.boothId === booth.boothId);
                      return (
                        <td key={booth.boothId} className={`${KELAS_SEL} text-slate-700 dark:text-fg-secondary`}>
                          {angka(b?.qty ?? 0)}
                        </td>
                      );
                    })}
                    <td className={`${KELAS_SEL} border-l-2 border-slate-300 dark:border-line text-[var(--brand-700)] dark:text-brand-400`}>
                      {angka(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <p className="text-[11px] font-bold text-slate-500 dark:text-fg-muted uppercase tracking-wide mb-2.5">
          Keterangan warna stok Booth
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-bold text-emerald-600 dark:text-emerald-400">Hijau</span>
            <span className="text-slate-500 dark:text-fg-muted">— Aman</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-bold text-amber-600 dark:text-amber-400">Kuning</span>
            <span className="text-slate-500 dark:text-fg-muted">— Menipis</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span className="font-bold text-rose-600 dark:text-rose-400">Merah</span>
            <span className="text-slate-500 dark:text-fg-muted">— Kritis/Habis (pernah ada stok, sekarang habis)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-line shrink-0" />
            <span className="font-bold text-slate-500 dark:text-fg-muted">Abu-abu</span>
            <span className="text-slate-500 dark:text-fg-muted">— Belum pernah diserahterimakan ke Booth ini, bukan masalah stok</span>
          </span>
        </div>
      </div>
    </div>
  );
}
