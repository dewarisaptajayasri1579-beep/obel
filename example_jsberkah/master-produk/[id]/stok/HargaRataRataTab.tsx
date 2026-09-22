import { Tab, TabPanel } from "@/components/ui";
import { History } from "lucide-react";
import { tanggalWaktu } from "./stok-labels";

export interface BarisHargaRataRata {
  id: string;
  date: string;
  refType: string;
  refNumber: string;
  qtyBefore: number;
  qtyChange: number;
  qtyAfter: number;
  avgCostBefore: number;
  hargaTransaksi: number | null;
  avgCostAfter: number;
}

const LABEL_SUMBER: Record<string, string> = {
  PENERIMAAN_BARANG: "Penerimaan Barang",
};

const rupiah = (n: number) => n.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const angka = (n: number) => n.toLocaleString("id-ID");

/** Tab keempat di halaman Stok Produk — riwayat tiap kali harga rata-rata (moving average)
 *  dihitung ulang. Ditulis terpisah dari tiga tab lokasi (RekapStokTabs) karena datanya beda
 *  jenis (kejadian harga, bukan saldo per lokasi) dan sumbernya baru satu (Penerimaan Barang) —
 *  retur pembelian & revisi harga manual akan menambah baris di sini begitu fiturnya ada, tanpa
 *  perlu mengubah tabel ini.
 *
 *  Dirender sebagai `<Tab>`/`<TabPanel>` biasa dari `@/components/ui` — dipasang sebagai anak
 *  tambahan di `<Tabs>` yang sama dengan RekapStokTabs, BUKAN `<Tabs>` bersarang. */
export function HargaRataRataTabButton() {
  return (
    <Tab value="rata-rata">
      <span className="inline-flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" />
        Harga Rata-rata
      </span>
    </Tab>
  );
}

export function HargaRataRataPanel({ rows, averageCostSaatIni, unit }: { rows: BarisHargaRataRata[]; averageCostSaatIni: number; unit: string }) {
  return (
    <TabPanel value="rata-rata">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="text-[11px] text-slate-500 dark:text-fg-muted">
          Riwayat perhitungan ulang harga rata-rata tertimbang — dipakai sebagai HPP saat produk ini terjual.
        </p>
        <span className="text-xs font-bold text-slate-700 dark:text-fg-secondary">
          Saat ini: {rupiah(averageCostSaatIni)} <span className="font-normal text-slate-400">/ {unit}</span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="bg-blue-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
              <th className="py-3 px-3 w-10 text-center">No.</th>
              <th className="py-3 px-3">Tanggal</th>
              <th className="py-3 px-3">Sumber</th>
              <th className="py-3 px-3 text-right">Qty Sebelum</th>
              <th className="py-3 px-3 text-right">Qty Masuk</th>
              <th className="py-3 px-3 text-right">Harga Transaksi</th>
              <th className="py-3 px-3 text-right">Rata-rata Sebelum</th>
              <th className="py-3 px-3 text-right">Rata-rata Sesudah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-line">
            {rows.length > 0 ? (
              rows.map((r, i) => (
                <tr key={r.id} className="hover:bg-blue-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                  <td className="py-2.5 px-3 text-center text-slate-500 dark:text-fg-muted">{i + 1}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 dark:text-fg-muted">{tanggalWaktu(r.date)}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-slate-700 dark:text-fg-secondary">{LABEL_SUMBER[r.refType] ?? r.refType}</span>
                    <span className="block text-[10px] text-slate-400 dark:text-fg-muted font-mono">{r.refNumber}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600 dark:text-fg-muted">{angka(r.qtyBefore)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                    {r.qtyChange >= 0 ? `+${angka(r.qtyChange)}` : angka(r.qtyChange)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-600 dark:text-fg-muted">{r.hargaTransaksi !== null ? rupiah(r.hargaTransaksi) : "—"}</td>
                  <td className="py-2.5 px-3 text-right text-slate-500 dark:text-fg-muted">{rupiah(r.avgCostBefore)}</td>
                  <td className="py-2.5 px-3 text-right font-extrabold text-slate-900 dark:text-fg">{rupiah(r.avgCostAfter)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-500 dark:text-fg-muted">
                  Belum ada Penerimaan Barang yang menghitung ulang harga rata-rata produk ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </TabPanel>
  );
}
