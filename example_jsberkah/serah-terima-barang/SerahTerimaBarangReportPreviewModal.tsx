"use client"

import { ReportPreviewModal } from "@/components/laporan/ReportPreviewModal"
import { LaporanSerahTerimaBarangPrintable, type BarisLaporanSerahTerimaBarang } from "./print/LaporanSerahTerimaBarangPrintable"
import type { DataPerusahaanLaporan } from "@/lib/laporan/excel-builder"

interface DataLaporanSerahTerimaBarang {
  rows: BarisLaporanSerahTerimaBarang[]
  labelPenyaring: string
  company: DataPerusahaanLaporan | null
  dicetakOleh: string
}

/** Pratinjau daftar Serah Terima Barang sebelum PDF-nya dibuka — bungkus tipis `ReportPreviewModal`
 *  generik, sejajar `KasBankReportPreviewModal.tsx` (lihat `aturan-tampilan.md` §6). */
export function SerahTerimaBarangReportPreviewModal({ isOpen, onClose, query }: { isOpen: boolean; onClose: () => void; query: string }) {
  return (
    <ReportPreviewModal<DataLaporanSerahTerimaBarang>
      isOpen={isOpen}
      onClose={onClose}
      title="Preview Daftar Serah Terima Barang"
      previewUrl={`/api/laporan/serah-terima-barang${query}`}
      pdfHref={`/api/laporan/serah-terima-barang/pdf${query}`}
      renderPrintable={(data) => (
        <LaporanSerahTerimaBarangPrintable rows={data.rows} labelPenyaring={data.labelPenyaring} company={data.company} dicetakOleh={data.dicetakOleh} />
      )}
    />
  )
}
