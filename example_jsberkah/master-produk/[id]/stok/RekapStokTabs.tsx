"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Store, Truck, Warehouse } from "lucide-react";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@/components/ui";
import { ANCHOR_LOKASI, JUDUL_LOKASI, KETERANGAN_LOKASI, URUTAN_LOKASI, type JenisLokasi } from "./stok-labels";
import { HargaRataRataTabButton, HargaRataRataPanel, type BarisHargaRataRata } from "./HargaRataRataTab";

export interface BarisRekap {
  locationType: JenisLokasi;
  locationId: string;
  locationName: string;
  saldoAwal: number;
  debet: number;
  kredit: number;
  saldoAkhir: number;
}

export interface Ringkasan {
  saldoAwal: number;
  debet: number;
  kredit: number;
  saldoAkhir: number;
}

export interface BagianRekap {
  locationType: JenisLokasi;
  rows: BarisRekap[];
  total: Ringkasan;
}

const IKON: Record<JenisLokasi, typeof Warehouse> = { WAREHOUSE: Warehouse, SALES: Truck, STORE: Store };
const JUDUL_KOLOM: Record<JenisLokasi, string> = { WAREHOUSE: "Gudang", SALES: "Sales", STORE: "Toko" };

const angka = (n: number) => n.toLocaleString("id-ID");

/** Tiga bagian rekap stok sebagai TAB, bukan tiga kartu bertumpuk (permintaan Owner) — bertumpuk
 *  memaksa menggulir jauh cuma untuk melihat bagian ketiga, padahal ketiganya dibaca bergantian,
 *  bukan bersamaan.
 *
 *  Tab yang terbuka ikut ditulis ke URL (`?tab=sales`) lewat `replaceState`, BUKAN navigasi:
 *  datanya sudah ada semua di halaman ini, jadi pindah tab tidak perlu menembak server. Yang
 *  dibutuhkan cuma URL-nya bisa dituju langsung — tautan dari kolom Stok di Master Produk
 *  memang membuka tab tertentu — dan tetap benar saat kembali dari halaman mutasi. */
export function RekapStokTabs({
  sections,
  unit,
  tabAwal,
  basePathMutasi,
  queryDasar,
  hargaRataRata,
}: {
  sections: BagianRekap[];
  unit: string;
  tabAwal: string;
  /** `/master/produk/{id}/stok/mutasi` */
  basePathMutasi: string;
  /** Query yang harus ikut ke halaman mutasi (periode + `back`), tanpa tanda tanya. */
  queryDasar: string;
  /** Tab keempat, opsional — null kalau riwayatnya gagal/tidak ada dimuat (produk tidak
   *  ditemukan). Ditulis terpisah dari `sections` karena sumber datanya beda endpoint. */
  hargaRataRata: { rows: BarisHargaRataRata[]; averageCostSaatIni: number } | null;
}) {
  const cocok = URUTAN_LOKASI.find((t) => ANCHOR_LOKASI[t] === tabAwal);
  const [tab, setTab] = useState(ANCHOR_LOKASI[cocok ?? "WAREHOUSE"]);

  const gantiTab = (next: string) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    window.history.replaceState(null, "", `?${params}`);
  };

  const linkMutasi = (baris: BarisRekap) => {
    const p = new URLSearchParams(queryDasar);
    p.set("tipe", baris.locationType);
    p.set("lokasi", baris.locationId);
    return `${basePathMutasi}?${p}`;
  };

  return (
    <Tabs value={tab} onChange={gantiTab} className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
      <TabList>
        {URUTAN_LOKASI.map((tipe) => {
          const bagian = sections.find((s) => s.locationType === tipe);
          const Ikon = IKON[tipe];
          return (
            <Tab key={tipe} value={ANCHOR_LOKASI[tipe]}>
              <span className="inline-flex items-center gap-1.5">
                <Ikon className="w-3.5 h-3.5" />
                {JUDUL_LOKASI[tipe]}
                {/* Saldo akhir ditempel di judul tabnya: tanpa itu, membandingkan gudang vs sales
                    vs toko berarti mengeklik tiga kali dan mengingat angkanya sendiri. */}
                <span className="text-[11px] font-bold text-slate-400 dark:text-fg-muted">{angka(bagian?.total.saldoAkhir ?? 0)}</span>
              </span>
            </Tab>
          );
        })}
        {hargaRataRata && <HargaRataRataTabButton />}
      </TabList>

      <TabPanels>
        {URUTAN_LOKASI.map((tipe) => {
          const bagian = sections.find((s) => s.locationType === tipe);
          const rows = bagian?.rows ?? [];
          const total = bagian?.total ?? { saldoAwal: 0, debet: 0, kredit: 0, saldoAkhir: 0 };

          return (
            <TabPanel key={tipe} value={ANCHOR_LOKASI[tipe]}>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <p className="text-[11px] text-slate-500 dark:text-fg-muted">{KETERANGAN_LOKASI[tipe]}</p>
                <span className="text-xs font-bold text-slate-700 dark:text-fg-secondary">
                  {angka(total.saldoAkhir)} <span className="font-normal text-slate-400">{unit}</span>
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-blue-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                      <th className="py-3 px-3 w-10 text-center">No.</th>
                      <th className="py-3 px-3">{JUDUL_KOLOM[tipe]}</th>
                      <th className="py-3 px-3 text-right">Saldo Awal</th>
                      <th className="py-3 px-3 text-right">Debet (Masuk)</th>
                      <th className="py-3 px-3 text-right">Kredit (Keluar)</th>
                      <th className="py-3 px-3 text-right">Saldo Akhir</th>
                      <th className="py-3 px-3 w-10" aria-label="Rincian" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-line">
                    {rows.length > 0 ? (
                      rows.map((r, i) => (
                        <tr key={r.locationId} className="hover:bg-blue-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-500 dark:text-fg-muted">{i + 1}</td>
                          <td className="py-2.5 px-3">
                            <Link href={linkMutasi(r)} className="font-bold text-[#0544cc] dark:text-blue-400 hover:underline" title="Lihat rincian mutasi keluar-masuk">
                              {r.locationName}
                            </Link>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600 dark:text-fg-muted">{angka(r.saldoAwal)}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{r.debet ? `+${angka(r.debet)}` : "—"}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-rose-600 dark:text-rose-400">{r.kredit ? `−${angka(r.kredit)}` : "—"}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 dark:text-fg">{angka(r.saldoAkhir)}</td>
                          <td className="py-2.5 px-3 text-right">
                            <Link href={linkMutasi(r)} className="inline-flex text-slate-400 hover:text-[#0544cc]" aria-label={`Rincian mutasi ${r.locationName}`}>
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-500 dark:text-fg-muted">
                          Tidak ada mutasi maupun saldo di {JUDUL_LOKASI[tipe].toLowerCase()} pada periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot>
                      <tr className="bg-blue-50/70 dark:bg-surface-hover font-bold border-t border-slate-200 dark:border-line">
                        <td className="py-2.5 px-3" colSpan={2}>
                          Total {JUDUL_LOKASI[tipe]}
                        </td>
                        <td className="py-2.5 px-3 text-right">{angka(total.saldoAwal)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 dark:text-emerald-400">{total.debet ? `+${angka(total.debet)}` : "—"}</td>
                        <td className="py-2.5 px-3 text-right text-rose-700 dark:text-rose-400">{total.kredit ? `−${angka(total.kredit)}` : "—"}</td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-fg">{angka(total.saldoAkhir)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </TabPanel>
          );
        })}
        {hargaRataRata && <HargaRataRataPanel rows={hargaRataRata.rows} averageCostSaatIni={hargaRataRata.averageCostSaatIni} unit={unit} />}
      </TabPanels>
    </Tabs>
  );
}
