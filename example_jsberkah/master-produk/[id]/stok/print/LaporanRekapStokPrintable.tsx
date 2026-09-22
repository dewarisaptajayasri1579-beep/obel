import { JUDUL_LOKASI, URUTAN_LOKASI, tanggalPanjang, type JenisLokasi } from "../stok-labels"

export interface BarisCetak {
  locationType: JenisLokasi
  locationId: string
  locationName: string
  saldoAwal: number
  debet: number
  kredit: number
  saldoAkhir: number
}

export interface RingkasanCetak {
  saldoAwal: number
  debet: number
  kredit: number
  saldoAkhir: number
}

const angka = (n: number) => n.toLocaleString("id-ID")

/** Format cetak Rekap Stok Produk (A4 tegak — 6 kolom, muat tanpa dimiringkan).
 *
 *  Ketiga lokasi dicetak BERURUTAN ke bawah, bukan sebagai tab seperti di layar: kertas tidak
 *  punya tab, dan yang memegang hasil cetak justru ingin melihat ketiganya sekaligus. */
export function LaporanRekapStokPrintable({
  product,
  period,
  sections,
  grandTotal,
  company,
  dicetakOleh,
}: {
  product: { code: string; name: string; unit: string }
  period: { from: string; to: string }
  sections: { locationType: JenisLokasi; rows: BarisCetak[]; total: RingkasanCetak }[]
  grandTotal: RingkasanCetak
  company: { name: string; legalName: string | null; address: string | null; phone: string | null } | null
  dicetakOleh: string
}) {
  const dicetakPada = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date())

  return (
    <div className="print-only">
      {/* Padanan TEGAK dari `print-report-a4` di rekap PO — laporan ini 6 kolom dan memanjang
          ke bawah. Sama seperti di sana, kelas ini cuma berlaku untuk Ctrl+P manual; route
          PDF-nya sudah menentukan A4 tegak lewat Chromium. */}
      <div className="print-report-a4-portrait print-exact-color bg-white text-slate-900 p-6">
        <div className="flex items-start justify-between gap-6 pb-3 border-b-2 border-slate-800">
          <div>
            <p className="text-lg font-black">{company?.legalName || company?.name || "Perusahaan"}</p>
            {company?.address && <p className="text-[10px] text-slate-500 mt-0.5">{company.address}</p>}
            {company?.phone && <p className="text-[10px] text-slate-500">Telp. {company.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-base font-black">Rekap Stok Produk</p>
            <p className="text-[10px] text-slate-500 italic">Saldo awal, mutasi, dan saldo akhir per lokasi</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 text-[10px]">
          <p>
            <span className="font-bold">Produk:</span> {product.code} — {product.name}
          </p>
          <p className="text-right">
            <span className="font-bold">Dicetak pada:</span> {dicetakPada}
          </p>
          <p>
            <span className="font-bold">Periode:</span> {tanggalPanjang(period.from)} s.d. {tanggalPanjang(period.to)}
          </p>
          <p className="text-right">
            <span className="font-bold">Dicetak oleh:</span> {dicetakOleh}
          </p>
        </div>

        {URUTAN_LOKASI.map((tipe) => {
          const bagian = sections.find((s) => s.locationType === tipe)
          const rows = bagian?.rows ?? []
          const total = bagian?.total ?? { saldoAwal: 0, debet: 0, kredit: 0, saldoAkhir: 0 }

          return (
            <div key={tipe} className="mt-4 break-inside-avoid">
              <p className="text-[11px] font-black mb-1">{JUDUL_LOKASI[tipe]}</p>
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-[#0544cc] text-white print-exact-color">
                    <th className="border border-slate-300 px-2 py-1 text-center w-8">No.</th>
                    <th className="border border-slate-300 px-2 py-1 text-left">Lokasi</th>
                    <th className="border border-slate-300 px-2 py-1 text-right">Saldo Awal</th>
                    <th className="border border-slate-300 px-2 py-1 text-right">Debet</th>
                    <th className="border border-slate-300 px-2 py-1 text-right">Kredit</th>
                    <th className="border border-slate-300 px-2 py-1 text-right">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0 ? (
                    rows.map((r, i) => (
                      <tr key={r.locationId}>
                        <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>
                        <td className="border border-slate-300 px-2 py-1">{r.locationName}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right">{angka(r.saldoAwal)}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right">{r.debet ? angka(r.debet) : "—"}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right">{r.kredit ? angka(r.kredit) : "—"}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-bold">{angka(r.saldoAkhir)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="border border-slate-300 px-2 py-3 text-center text-slate-500">
                        Tidak ada mutasi maupun saldo pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 print-exact-color font-bold">
                    <td className="border border-slate-300 px-2 py-1 text-right" colSpan={2}>
                      Total {JUDUL_LOKASI[tipe]}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{angka(total.saldoAwal)}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{angka(total.debet)}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{angka(total.kredit)}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{angka(total.saldoAkhir)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })}

        <table className="w-full text-[10px] border-collapse mt-4 break-inside-avoid">
          <tbody>
            <tr className="bg-[#0544cc] text-white print-exact-color font-black">
              <td className="border border-slate-300 px-2 py-1.5">Grand Total (Gudang + Sales + Toko)</td>
              <td className="border border-slate-300 px-2 py-1.5 text-right">{angka(grandTotal.saldoAwal)}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-right">{angka(grandTotal.debet)}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-right">{angka(grandTotal.kredit)}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-right">
                {angka(grandTotal.saldoAkhir)} {product.unit}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-[9px] text-slate-400 mt-4">
          Saldo Awal = seluruh mutasi sebelum tanggal mulai. Angka mengikuti data pada saat dicetak.
        </p>
      </div>
    </div>
  )
}
