"use client"

import { ReportPreviewModal } from "@/components/laporan/ReportPreviewModal"
import { LaporanOpnamePrintable, type BarisLaporanOpname } from "./print/LaporanOpnamePrintable"
import type { DataPerusahaanLaporan } from "@/lib/laporan/excel-builder"

interface DataLaporanOpname {
  rows: BarisLaporanOpname[]
  labelPenyaring: string
  company: DataPerusahaanLaporan | null
  dicetakOleh: string
}

/** Pratinjau daftar Stock Opname sebelum PDF-nya dibuka — sejajar `SetorReportPreviewModal.tsx`. */
export function OpnameReportPreviewModal({ isOpen, onClose, query }: { isOpen: boolean; onClose: () => void; query: string }) {
  return (
    <ReportPreviewModal<DataLaporanOpname>
      isOpen={isOpen}
      onClose={onClose}
      title="Preview Daftar Stock Opname"
      previewUrl={`/api/laporan/opname${query}`}
      pdfHref={`/api/laporan/opname/pdf${query}`}
      renderPrintable={(data) => (
        <LaporanOpnamePrintable rows={data.rows} labelPenyaring={data.labelPenyaring} company={data.company} dicetakOleh={data.dicetakOleh} />
      )}
    />
  )
}
