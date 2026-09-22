import { LaporanPrintableShell } from "@/components/laporan/LaporanPrintableShell"
import { LaporanTable, type KolomLaporanTabel } from "@/components/laporan/LaporanTable"
import type { DataPerusahaanLaporan } from "@/lib/laporan/excel-builder"
import { formatDate, formatRupiah } from "@/lib/format"

export interface BarisLaporanOpname {
  id: string
  opnameNumber: string
  date: string
  storeName: string
  petugasName: string
  status: "DRAFT" | "SELESAI"
  totalTagihan: number
}

export const STATUS_LABEL_OPNAME: Record<BarisLaporanOpname["status"], string> = { DRAFT: "Draft", SELESAI: "Selesai" }

const kolom: KolomLaporanTabel<BarisLaporanOpname>[] = [
  { key: "no", header: "No.", align: "center", width: "32px", render: (_r, i) => i + 1 },
  { key: "opname", header: "No. Opname", render: (r) => r.opnameNumber },
  { key: "tanggal", header: "Tanggal", render: (r) => formatDate(r.date) },
  { key: "toko", header: "Toko", render: (r) => r.storeName },
  { key: "petugas", header: "Petugas", render: (r) => r.petugasName },
  { key: "tagihan", header: "Total Tagihan", align: "right", render: (r) => formatRupiah(r.totalTagihan) },
  { key: "status", header: "Status", align: "center", render: (r) => STATUS_LABEL_OPNAME[r.status] },
]

/** Format cetak daftar Stock Opname — `LaporanPrintableShell`+`LaporanTable` generik (§6). */
export function LaporanOpnamePrintable({
  rows,
  labelPenyaring,
  company,
  dicetakOleh,
}: {
  rows: BarisLaporanOpname[]
  labelPenyaring: string
  company: DataPerusahaanLaporan | null
  dicetakOleh: string
}) {
  const totalTagihan = rows.reduce((sum, r) => sum + r.totalTagihan, 0)
  const dicetakPada = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date())

  return (
    <LaporanPrintableShell
      title="Daftar Stock Opname (Parfum)"
      subtitle="Input stock fisik per kunjungan toko"
      company={company}
      metaLeft={[
        ["Penyaring", labelPenyaring],
        ["Jumlah dokumen", `${rows.length} dokumen · ${formatRupiah(totalTagihan)}`],
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
