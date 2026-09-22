"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Receipt, Store, User } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, type Booth, type RiwayatPenjualanBoothResponse } from "@/lib/api-client";
import { BULAN, PeriodeFilter, periodeBerjalanJakarta } from "../produk/PeriodeFilter";

type SubTab = "riwayat" | "rekap-harian";

const KELAS_WRAPPER_TABEL = "overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line";
const KELAS_HEADER_TABEL =
  "bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line";

function angka(n: number) {
  return n.toLocaleString("id-ID");
}

function formatRupiah(n: number) {
  return `Rp${n.toLocaleString("id-ID")}`;
}

function waktuJakarta(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

function tanggalJakarta(key: string) {
  // key sudah "YYYY-MM-DD" hasil businessDateKeyJakarta — cukup diparse
  // sebagai UTC murni supaya tidak bergeser sehari oleh zona waktu perangkat.
  const d = new Date(`${key}T00:00:00Z`);
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`;
}

/// Tab Riwayat Penjualan di halaman Booth — daftar transaksi + Rekap Harian
/// per shift (Pagi vs Malam, dst). Penyaring Booth opsional: "Semua Booth"
/// menampilkan gabungan, karena datanya sudah cukup untuk dibandingkan
/// lintas-Booth tanpa perlu drill-down dulu (beda dari tab Mutasi Stok yang
/// memang harus pilih satu Booth untuk Rinci).
export function TabRiwayatPenjualan({ booths }: { booths: Booth[] }) {
  const toast = useToast();
  const [sub, setSub] = useState<SubTab>("riwayat");
  const [periode, setPeriode] = useState(periodeBerjalanJakarta());
  const [boothId, setBoothId] = useState("");

  const [data, setData] = useState<RiwayatPenjualanBoothResponse | null>(null);
  const [memuat, setMemuat] = useState(false);

  const opsiBooth = useMemo(
    () => [{ value: "", label: "Semua Booth" }, ...booths.map((b) => ({ value: b.id, label: `Booth ${b.name}` }))],
    [booths],
  );

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setData(await api.getRiwayatPenjualanBooth({ boothId: boothId || undefined, ...periode }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat riwayat penjualan.");
      setData(null);
    } finally {
      setMemuat(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boothId, periode]);

  useEffect(() => {
    muat();
  }, [muat]);

  const totalOmzet = data?.rekapHarian.reduce((s, r) => s + r.omzet, 0) ?? 0;
  const totalCup = data?.rekapHarian.reduce((s, r) => s + r.cup, 0) ?? 0;

  const SUB: { key: SubTab; label: string; icon: typeof Receipt }[] = [
    { key: "riwayat", label: "Riwayat", icon: Receipt },
    { key: "rekap-harian", label: "Rekap Harian", icon: CalendarDays },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-800 dark:text-fg">Riwayat Penjualan</h2>
        <p className="text-xs text-slate-500 dark:text-fg-muted mt-0.5">
          Transaksi jualan per Booth, lengkap dengan Petugas &amp; shift-nya.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {SUB.map(({ key, label, icon: Icon }) => {
          const aktif = sub === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSub(key)}
              className={`flex items-center gap-2 px-3.5 h-8 rounded-lg text-[11px] font-bold transition-colors cursor-pointer border ${
                aktif
                  ? "bg-slate-800 dark:bg-fg/10 text-white dark:text-fg border-slate-800 dark:border-line"
                  : "bg-white/90 dark:bg-surface text-slate-600 dark:text-fg-secondary border-slate-200/90 dark:border-line hover:bg-slate-50 dark:hover:bg-surface-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <PeriodeFilter bulan={periode.bulan} tahun={periode.tahun} onChange={setPeriode}>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-fg-muted ml-1">
            <Store className="w-3.5 h-3.5" />
            Booth
          </span>
          <div className="w-48">
            <Select options={opsiBooth} value={boothId} onChange={setBoothId} sizeVariant="sm" />
          </div>
        </PeriodeFilter>
      </div>

      {memuat ? (
        <div className="flex justify-center py-14">
          <Spinner />
        </div>
      ) : sub === "riwayat" ? (
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs overflow-hidden">
          <div className={KELAS_WRAPPER_TABEL}>
            <table className="w-full text-xs sm:text-sm">
              <thead className={KELAS_HEADER_TABEL}>
                <tr>
                  <th className="py-3.5 px-3 text-left">No. Sale</th>
                  <th className="py-3.5 px-3 text-left">Booth</th>
                  <th className="py-3.5 px-3 text-left">Petugas</th>
                  <th className="py-3.5 px-3 text-left w-20">Shift</th>
                  <th className="py-3.5 px-3 text-right w-16">Cup</th>
                  <th className="py-3.5 px-3 text-right">Total</th>
                  <th className="py-3.5 px-3 text-center w-24">Metode</th>
                  <th className="py-3.5 px-3 text-center w-24">Status</th>
                  <th className="py-3.5 px-3 text-left w-44">Waktu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {(data?.rows ?? []).map((s) => (
                  <tr key={s.id} className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                      {s.saleNo}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-fg-secondary">{s.boothName}</td>
                    <td className="py-3 px-3 text-slate-700 dark:text-fg-secondary">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        {s.staffName}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-secondary border border-slate-200 dark:border-line">
                        {s.shift}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-800 dark:text-fg">
                      {angka(s.cupCount)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-fg">
                      {formatRupiah(s.total)}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 dark:text-fg-muted">
                      {s.paymentMethod === "CASH" ? "Tunai" : "QRIS"}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <StatusBadge
                        type={s.status === "PAID" ? "safe" : "expired"}
                        label={s.status === "PAID" ? "Lunas" : "Dibatalkan"}
                      />
                    </td>
                    <td className="py-3 px-3 text-slate-500 dark:text-fg-muted whitespace-nowrap">
                      {waktuJakarta(s.paidAt)}
                    </td>
                  </tr>
                ))}

                {data && data.rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                      Tidak ada transaksi pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs">
              <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Cup · {BULAN[periode.bulan - 1]} {periode.tahun}</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5 tabular-nums">
                {angka(totalCup)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs">
              <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Omzet · {BULAN[periode.bulan - 1]} {periode.tahun}</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5 tabular-nums">
                {formatRupiah(totalOmzet)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs overflow-hidden">
            <div className={KELAS_WRAPPER_TABEL}>
              <table className="w-full text-xs sm:text-sm">
                <thead className={KELAS_HEADER_TABEL}>
                  <tr>
                    <th className="py-3.5 px-3 text-left w-32">Tanggal</th>
                    <th className="py-3.5 px-3 text-left">Per Shift</th>
                    <th className="py-3.5 px-3 text-right w-20">Total Cup</th>
                    <th className="py-3.5 px-3 text-right w-32">Total Omzet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                  {(data?.rekapHarian ?? []).map((h) => (
                    <tr key={h.tanggal} className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-fg whitespace-nowrap">
                        {tanggalJakarta(h.tanggal)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1.5">
                          {h.perShift.map((s) => (
                            <span
                              key={s.shift}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-secondary border border-slate-200 dark:border-line"
                            >
                              {s.shift}: {angka(s.cup)} cup · {formatRupiah(s.omzet)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-fg">
                        {angka(h.cup)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-bold text-slate-900 dark:text-fg">
                        {formatRupiah(h.omzet)}
                      </td>
                    </tr>
                  ))}

                  {data && data.rekapHarian.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-slate-500 dark:text-fg-muted py-10 text-xs">
                        Tidak ada penjualan pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
