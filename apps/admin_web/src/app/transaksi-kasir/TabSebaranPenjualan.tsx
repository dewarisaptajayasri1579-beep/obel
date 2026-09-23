"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownWideNarrow, ArrowLeftRight, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type SebaranPenjualanResponse } from "@/lib/api-client";

function angka(n: number) {
  return n.toLocaleString("id-ID");
}

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function hariIniJakarta(): string {
  const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return jakarta.toISOString().slice(0, 10);
}

type PeriodeBadge = "HARI_INI" | "MINGGU_INI" | "BULAN_INI" | "CUSTOM";

const PERIODE_OPTIONS: { value: PeriodeBadge; label: string }[] = [
  { value: "HARI_INI", label: "Hari Ini" },
  { value: "MINGGU_INI", label: "Minggu Ini" },
  { value: "BULAN_INI", label: "Bulan Ini" },
  { value: "CUSTOM", label: "Custom" },
];

/// Rentang tanggal Asia/Jakarta per badge — "Minggu Ini" mulai Senin (ISO
/// week, sama konvensinya dgn batasAwalPeriode di page.tsx), "sampai" selalu
/// hari ini (belum ada penjualan masa depan buat dilaporkan).
function hitungRentang(badge: PeriodeBadge, customDari: string, customSampai: string): { dari: string; sampai: string } {
  const hariIni = hariIniJakarta();
  if (badge === "CUSTOM") return { dari: customDari, sampai: customSampai };

  const jakarta = new Date(Date.now() + 7 * 60 * 60 * 1000);
  if (badge === "HARI_INI") return { dari: hariIni, sampai: hariIni };
  if (badge === "MINGGU_INI") {
    const dow = jakarta.getUTCDay();
    const geserSenin = dow === 0 ? -6 : 1 - dow;
    const senin = new Date(Date.UTC(jakarta.getUTCFullYear(), jakarta.getUTCMonth(), jakarta.getUTCDate() + geserSenin));
    return { dari: senin.toISOString().slice(0, 10), sampai: hariIni };
  }
  const awalBulan = new Date(Date.UTC(jakarta.getUTCFullYear(), jakarta.getUTCMonth(), 1));
  return { dari: awalBulan.toISOString().slice(0, 10), sampai: hariIni };
}

const LEBAR_NO = 44;
const LEBAR_PRODUK = 220;
const LEBAR_KOLOM = 96;
const GESER_PX = 280;

/// Tab "Sebaran Penjualan" — satu baris per produk, kolom tiap Booth + Total,
/// dijumlah atas rentang tanggal (badge Hari Ini/Minggu Ini/Bulan Ini/Custom).
/// Pola sama persis dengan TabSebaranStok.tsx (halaman Produk) — kolom No. &
/// Nama Produk di-freeze, bisa digeser dengan tombol/panah keyboard — tapi
/// angkanya qty cup TERJUAL (bukan saldo stok), tanpa kolom Gudang/In Proses,
/// dan ada baris footer "Total Nominal Jual" (Rp) per kolom + Grand Total.
export function TabSebaranPenjualan() {
  const toast = useToast();
  const [badge, setBadge] = useState<PeriodeBadge>("HARI_INI");
  const [customDari, setCustomDari] = useState(hariIniJakarta());
  const [customSampai, setCustomSampai] = useState(hariIniJakarta());
  const { dari, sampai } = hitungRentang(badge, customDari, customSampai);

  const [data, setData] = useState<SebaranPenjualanResponse | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [cari, setCari] = useState("");
  // "TOTAL" = urut berdasar total semua Booth (default). Diisi boothId kalau
  // Admin klik header salah satu Booth — urut produk terlaris KHUSUS Booth
  // itu saja. Klik "Total" lagi (atau Booth yang sama) mengembalikan ke default.
  const [urutBerdasarkan, setUrutBerdasarkan] = useState<string>("TOTAL");
  // Urutkan KOLOM Booth dari total qty terjual terbanyak (kiri) ke paling
  // sedikit (kanan) — beda dari urutBerdasarkan yang ngurutin BARIS produk.
  const [urutkanKolom, setUrutkanKolom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMemuat(true);
    api
      .getSebaranPenjualan(dari, sampai)
      .then(setData)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat Sebaran Penjualan.");
        setData(null);
      })
      .finally(() => setMemuat(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dari, sampai]);

  function geser(arah: -1 | 1) {
    scrollRef.current?.scrollBy({ left: arah * GESER_PX, behavior: "smooth" });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      geser(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      geser(-1);
    }
  }

  function qtyUrut(r: SebaranPenjualanResponse["rows"][number]): number {
    if (urutBerdasarkan === "TOTAL") return r.totalQty;
    return r.perBooth.find((b) => b.boothId === urutBerdasarkan)?.qty ?? 0;
  }

  const rows = data
    ? data.rows
        .filter((r) => `${r.name} ${r.sku} ${r.category ?? ""}`.toLowerCase().includes(cari.trim().toLowerCase()))
        .sort((a, b) => qtyUrut(b) - qtyUrut(a))
    : [];

  const namaUrutan =
    urutBerdasarkan === "TOTAL" ? "Total semua Booth" : data?.booths.find((b) => b.boothId === urutBerdasarkan)?.boothName ?? "";

  const urutanBooth = data
    ? urutkanKolom
      ? [...data.booths].sort((a, b) => {
          const qtyA = data.totalPerBooth.find((x) => x.boothId === a.boothId)?.qty ?? 0;
          const qtyB = data.totalPerBooth.find((x) => x.boothId === b.boothId)?.qty ?? 0;
          return qtyB - qtyA;
        })
      : data.booths
    : [];

  const KELAS_SEL = "py-2.5 px-3 text-center tabular-nums whitespace-nowrap";
  const KELAS_HEAD_SEL = "py-3 px-3 text-center whitespace-nowrap";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-fg-muted">
            <MapPin className="w-3.5 h-3.5" />
            Periode
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PERIODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBadge(opt.value)}
                className={`px-3 h-8 rounded-full text-[11px] font-bold transition-colors cursor-pointer border ${
                  badge === opt.value
                    ? "bg-[var(--brand-700)] text-white border-[var(--brand-700)]"
                    : "bg-white/90 dark:bg-surface text-slate-600 dark:text-fg-secondary border-slate-200/90 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {badge === "CUSTOM" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customDari}
                max={customSampai || hariIniJakarta()}
                onChange={(e) => setCustomDari(e.target.value)}
                className="h-9 px-2.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs"
              />
              <span className="text-xs text-slate-400 dark:text-fg-muted">s/d</span>
              <input
                type="date"
                value={customSampai}
                min={customDari}
                max={hariIniJakarta()}
                onChange={(e) => setCustomSampai(e.target.value)}
                className="h-9 px-2.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Cari nama atau kode produk..."
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            className="h-9 px-3.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-surface border border-slate-200/90 dark:border-line text-slate-800 dark:text-fg placeholder:text-slate-400 dark:placeholder:text-fg-muted focus:outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-700)]/10 transition-colors shadow-2xs w-full sm:w-64"
          />

          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand-700)] dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 rounded-full px-2.5 py-1">
            <ArrowDownWideNarrow className="w-3 h-3 shrink-0" />
            Terlaris: {namaUrutan}
          </span>

          <button
            type="button"
            onClick={() => setUrutkanKolom((v) => !v)}
            title="Urutkan kolom Booth dari total penjualan terbanyak (kiri) ke paling sedikit (kanan)"
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
            <span className="text-[11px] text-slate-400 dark:text-fg-muted hidden md:inline">
              Klik nama Booth di header untuk urutkan terlaris per Booth
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
                    rowSpan={2}
                    className="sticky left-0 z-20 bg-brand-50/95 dark:bg-surface-hover py-3 px-2 text-center border-b border-r border-slate-200/80 dark:border-line align-middle"
                    style={{ width: LEBAR_NO, minWidth: LEBAR_NO }}
                  >
                    No.
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky z-20 bg-brand-50/95 dark:bg-surface-hover py-3 px-3 text-left border-b border-r border-slate-200/80 dark:border-line align-middle"
                    style={{ left: LEBAR_NO, width: LEBAR_PRODUK, minWidth: LEBAR_PRODUK }}
                  >
                    Nama Produk
                  </th>
                  {urutanBooth.map((b) => {
                    const aktif = urutBerdasarkan === b.boothId;
                    return (
                      <th
                        key={b.boothId}
                        className={`border-b border-slate-200/80 dark:border-line pb-1 ${aktif ? "bg-brand-100/60 dark:bg-brand-500/15" : ""}`}
                        style={{ minWidth: LEBAR_KOLOM }}
                      >
                        <button
                          type="button"
                          onClick={() => setUrutBerdasarkan((prev) => (prev === b.boothId ? "TOTAL" : b.boothId))}
                          title={`Urutkan produk terlaris berdasarkan ${b.boothName}`}
                          className={`w-full flex items-center justify-center gap-1 py-1.5 px-3 cursor-pointer hover:text-[var(--brand-700)] dark:hover:text-brand-400 transition-colors ${
                            aktif ? "text-[var(--brand-700)] dark:text-brand-400" : ""
                          }`}
                        >
                          {aktif && <ArrowDownWideNarrow className="w-3 h-3 shrink-0" />}
                          <span>{b.boothName}</span>
                        </button>
                      </th>
                    );
                  })}
                  <th
                    rowSpan={2}
                    className={`border-b border-l-2 border-slate-300 dark:border-line align-middle ${
                      urutBerdasarkan === "TOTAL" ? "bg-brand-100/60 dark:bg-brand-500/15" : ""
                    }`}
                    style={{ minWidth: LEBAR_KOLOM }}
                  >
                    <button
                      type="button"
                      onClick={() => setUrutBerdasarkan("TOTAL")}
                      title="Urutkan produk terlaris berdasarkan Total semua Booth"
                      className={`w-full flex items-center justify-center gap-1 py-1.5 px-3 cursor-pointer hover:text-[var(--brand-700)] dark:hover:text-brand-400 transition-colors ${
                        urutBerdasarkan === "TOTAL" ? "text-[var(--brand-700)] dark:text-brand-400" : ""
                      }`}
                    >
                      {urutBerdasarkan === "TOTAL" && <ArrowDownWideNarrow className="w-3 h-3 shrink-0" />}
                      <span>Total</span>
                    </button>
                  </th>
                </tr>
                <tr>
                  {urutanBooth.map((b) => (
                    <th
                      key={b.boothId}
                      className="py-1.5 px-3 text-center border-b border-slate-200/80 dark:border-line font-normal italic text-slate-400 dark:text-fg-muted text-[10px] normal-case"
                      style={{ minWidth: LEBAR_KOLOM }}
                    >
                      {b.locationName ?? "-"}
                    </th>
                  ))}
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
                    {urutanBooth.map((booth) => {
                      const b = r.perBooth.find((x) => x.boothId === booth.boothId);
                      return (
                        <td key={booth.boothId} className={KELAS_SEL}>
                          <div className={(b?.qty ?? 0) > 0 ? "font-bold text-slate-700 dark:text-fg-secondary" : "text-slate-300 dark:text-fg-disabled"}>
                            {angka(b?.qty ?? 0)}
                          </div>
                          {(b?.qty ?? 0) > 0 && (
                            <div className="text-[10px] font-normal text-slate-400 dark:text-fg-muted">{formatRupiah(b?.omzet ?? 0)}</div>
                          )}
                        </td>
                      );
                    })}
                    <td className={`${KELAS_SEL} border-l-2 border-slate-200 dark:border-line`}>
                      <div className={r.totalQty > 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-300 dark:text-fg-disabled"}>
                        {angka(r.totalQty)}
                      </div>
                      {r.totalQty > 0 && (
                        <div className="text-[10px] font-normal text-slate-400 dark:text-fg-muted">{formatRupiah(r.totalOmzet)}</div>
                      )}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={2 + (data.booths.length ?? 0)} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      Tidak ada produk yang cocok.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50/80 dark:bg-surface-hover border-t-2 border-slate-200 dark:border-line text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                <tr>
                  <td
                    colSpan={2}
                    className="sticky left-0 z-10 bg-slate-50/95 dark:bg-surface-hover py-2.5 px-3 border-r border-slate-200/70 dark:border-line uppercase tracking-wide"
                  >
                    Total Qty
                  </td>
                  {urutanBooth.map((booth) => {
                    const b = data.totalPerBooth.find((x) => x.boothId === booth.boothId);
                    return (
                      <td key={booth.boothId} className={`${KELAS_SEL} text-slate-700 dark:text-fg-secondary`}>
                        {angka(b?.qty ?? 0)}
                      </td>
                    );
                  })}
                  <td className={`${KELAS_SEL} border-l-2 border-slate-300 dark:border-line`}>{angka(data.grandTotalQty)}</td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    className="sticky left-0 z-10 bg-slate-50/95 dark:bg-surface-hover py-2.5 px-3 border-r border-slate-200/70 dark:border-line uppercase tracking-wide"
                  >
                    Total Jual
                  </td>
                  {urutanBooth.map((booth) => {
                    const b = data.totalPerBooth.find((x) => x.boothId === booth.boothId);
                    return (
                      <td key={booth.boothId} className={`${KELAS_SEL} text-slate-700 dark:text-fg-secondary`}>
                        {formatRupiah(b?.omzet ?? 0)}
                      </td>
                    );
                  })}
                  <td className={`${KELAS_SEL} border-l-2 border-slate-300 dark:border-line text-[var(--brand-700)] dark:text-brand-400`}>
                    {formatRupiah(data.grandTotalOmzet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
