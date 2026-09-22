import { LaporanPrintableShell } from "@/components/laporan/LaporanPrintableShell"
import { LaporanTable, type KolomLaporanTabel } from "@/components/laporan/LaporanTable"
import type { DataPerusahaanLaporan } from "@/lib/laporan/excel-builder"
import { formatDate } from "@/lib/format"

export interface BarisLaporanSerahTerimaBarang {
  id: string
  stbNumber: string
  date: string
  salesName: string
  warehouseName: string
  status: "MENUNGGU_KONFIRMASI" | "DIKONFIRMASI" | "DITOLAK"
  itemCount: number
}

export const STATUS_LABEL_STB: Record<BarisLaporanSerahTerimaBarang["status"], string> = {
  MENUNGGU_KONFIRMASI: "Menunggu Konfirmasi",
  DIKONFIRMASI: "Dikonfirmasi",
  DITOLAK: "Ditolak",
}

const kolom: KolomLaporanTabel<BarisLaporanSerahTerimaBarang>[] = [
  { key: "no", header: "No.", align: "center", width: "32px", render: (_r, i) => i + 1 },
  { key: "stb", header: "No. STB", render: (r) => r.stbNumber },
  { key: "tanggal", header: "Tanggal", render: (r) => formatDate(r.date) },
  { key: "sales", header: "Sales", render: (r) => r.salesName },
  { key: "gudang", header: "Gudang Asal", render: (r) => r.warehouseName },
  { key: "item", header: "Item", align: "right", render: (r) => r.itemCount },
  { key: "status", header: "Status", align: "center", render: (r) => STATUS_LABEL_STB[r.status] },
]

/** Format cetak daftar Serah Terima Barang — pakai `LaporanPrintableShell`+`LaporanTable` generik
 *  (§6 aturan-tampilan.md), sejajar `LaporanKasBankPrintable.tsx`. */
export function LaporanSerahTerimaBarangPrintable({
  rows,
  labelPenyaring,
  company,
  dicetakOleh,
}: {
  rows: BarisLaporanSerahTerimaBarang[]
  labelPenyaring: string
  company: DataPerusahaanLaporan | null
  dicetakOleh: string
}) {
  const dicetakPada = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date())

  return (
    <LaporanPrintableShell
      title="Daftar Serah Terima Barang"
      subtitle="Barang dari gudang diserahkan ke Sales"
      company={company}
      metaLeft={[
        ["Penyaring", labelPenyaring],
        ["Jumlah dokumen", `${rows.length} dokumen`],
      ]}
      metaRight={[
        ["Dicetak pada", dicetakPada],
        ["Dicetak oleh", dicetakOleh],
      ]}
    >
      <LaporanTable columns={kolom} rows={rows} rowKey={(r) => r.id} emptyMessage="Tidak ada dokumen yang cocok dengan penyaring ini." />
    </LaporanPrintableShell>
  )
}
