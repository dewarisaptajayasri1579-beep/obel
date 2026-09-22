import { formatRupiah } from "@/lib/format"

export interface BarisLaporanProduk {
  id: string
  code: string
  name: string
  variant: string
  size: string
  unit: string
  businessTypeName: string
  supplierName: string
  sellPrice: number
  costPrice: number
  isActive: boolean
}

/** Format cetak daftar Master Produk (A4 landscape — ukurannya ditentukan di route PDF-nya,
 *  bukan lewat `@page` yang global-nya A5 untuk nota). Pola & gaya disamakan dengan
 *  `LaporanPurchaseOrderPrintable` supaya semua rekap internal terbaca sebagai satu keluarga
 *  dokumen. */
export function LaporanProdukPrintable({
  rows,
  labelPenyaring,
  company,
  dicetakOleh,
}: {
  rows: BarisLaporanProduk[]
  labelPenyaring: string
  company: { name: string; legalName: string | null; address: string | null; phone: string | null } | null
  dicetakOleh: string
}) {
  const jumlahAktif = rows.filter((r) => r.isActive).length
  const dicetakPada = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date())

  return (
    <div className="print-only">
      {/* `print-report-a4`: tanpa ini, Ctrl+P manual dari halaman ini ikut `@page` global yang
          A5 landscape (ukuran nota). Route PDF-nya menentukan ukuran sendiri lewat Chromium, jadi
          kelas ini murni untuk cetak manual dari browser. Sama dengan rekap Purchase Order. */}
      <div className="print-report-a4 print-exact-color bg-white text-slate-900 p-6">
        <div className="flex items-start justify-between gap-6 pb-3 border-b-2 border-slate-800">
          <div>
            <p className="text-lg font-black">{company?.legalName || company?.name || "Perusahaan"}</p>
            {company?.address && <p className="text-[10px] text-slate-500 mt-0.5">{company.address}</p>}
            {company?.phone && <p className="text-[10px] text-slate-500">Telp. {company.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-base font-black">Daftar Master Produk</p>
            <p className="text-[10px] text-slate-500 italic">Harga jual toko, harga beli, dan supplier default</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-3 text-[10px]">
          <p>
            <span className="font-bold">Penyaring:</span> {labelPenyaring}
          </p>
          <p className="text-right">
            <span className="font-bold">Dicetak pada:</span> {dicetakPada}
          </p>
          <p>
            <span className="font-bold">Jumlah produk:</span> {rows.length} item ({jumlahAktif} aktif)
          </p>
          <p className="text-right">
            <span className="font-bold">Dicetak oleh:</span> {dicetakOleh}
          </p>
        </div>

        <table className="w-full mt-4 text-[10px] border-collapse">
          <thead>
            <tr className="bg-[#0544cc] text-white print-exact-color">
              <th className="border border-slate-300 px-2 py-1.5 text-center w-8">No.</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Kode</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Nama Produk</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Bisnis</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center">Satuan</th>
              <th className="border border-slate-300 px-2 py-1.5 text-right">Harga Jual Toko</th>
              <th className="border border-slate-300 px-2 py-1.5 text-right">Harga Beli</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left">Supplier</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r, i) => (
                <tr key={r.id} className="break-inside-avoid">
                  <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>
                  <td className="border border-slate-300 px-2 py-1 font-mono font-bold">{r.code}</td>
                  <td className="border border-slate-300 px-2 py-1">
                    {r.name}
                    {(r.variant || r.size) && <span className="text-slate-500"> — {[r.variant, r.size].filter(Boolean).join(" · ")}</span>}
                  </td>
                  <td className="border border-slate-300 px-2 py-1">{r.businessTypeName}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{r.unit}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-bold">{formatRupiah(r.sellPrice)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">{formatRupiah(r.costPrice)}</td>
                  <td className="border border-slate-300 px-2 py-1">{r.supplierName}</td>
                  <td
                    className={`border border-slate-300 px-2 py-1 text-center font-semibold print-exact-color ${
                      r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {r.isActive ? "Aktif" : "Nonaktif"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="border border-slate-300 px-2 py-6 text-center text-slate-500">
                  Tidak ada produk yang cocok dengan penyaring ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="text-[9px] text-slate-400 mt-4">
          Dokumen ini dihasilkan otomatis dari sistem. Angka mengikuti data pada saat dicetak.
        </p>
      </div>
    </div>
  )
}
