import { Store, Calculator, Info } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { APP_CONFIG } from "@/lib/app-config";
import { NotaItemTable, type KolomNotaItem } from "@/components/transaksi/NotaItemTable";

export interface OpnamePrintableLine {
  productCode: string;
  productName: string;
  quotaQty: number;
  stockSistem: number;
  stockFisik: number;
  terjualQty: number;
  refillQty: number;
  isRetur: boolean;
  subtotal: number;
}

export interface OpnamePrintableData {
  opnameNumber: string | null;
  date: string;
  status: "DRAFT" | "SELESAI" | null;
  storeName: string;
  petugasName: string;
  lines: OpnamePrintableLine[];
  total: number;
  dibuatOleh: string | null;
  company: { name: string; legalName: string | null; address: string | null; phone: string | null; logoUrl: string | null } | null;
}

function formatDateLong(dateInput: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(dateInput));
  } catch {
    return dateInput;
  }
}

const STATUS_BADGE: Record<NonNullable<OpnamePrintableData["status"]>, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-700 border-slate-200" },
  SELESAI: { label: "Selesai", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

const kolomRincian: KolomNotaItem<OpnamePrintableLine>[] = [
  { key: "no", header: "No.", align: "center", widthClass: "w-8", render: (_l, idx) => <span className="text-slate-500 font-medium">{idx + 1}</span> },
  {
    key: "nama",
    header: "Produk",
    render: (l) => (
      <span className="font-semibold text-slate-800 truncate max-w-[160px] block">
        <span className="font-mono font-normal text-slate-500 mr-1">{l.productCode}</span>
        {l.productName}
        {l.isRetur && <span className="ml-1 text-[9px] font-bold text-amber-700">(Retur)</span>}
      </span>
    ),
  },
  { key: "kuota", header: "Kuota", align: "right", widthClass: "w-14", render: (l) => <span className="text-slate-600 tabular-nums">{l.quotaQty}</span> },
  { key: "sistem", header: "Sistem", align: "right", widthClass: "w-14", render: (l) => <span className="text-slate-600 tabular-nums">{l.stockSistem}</span> },
  { key: "fisik", header: "Fisik", align: "right", widthClass: "w-14", render: (l) => <span className="font-bold text-slate-900 tabular-nums">{l.stockFisik}</span> },
  { key: "terjual", header: "Terjual", align: "right", widthClass: "w-14", render: (l) => <span className="text-slate-600 tabular-nums">{l.terjualQty}</span> },
  { key: "refill", header: "Refill", align: "right", widthClass: "w-14", render: (l) => <span className="text-slate-600 tabular-nums">{l.refillQty}</span> },
  {
    key: "subtotal",
    header: "Subtotal",
    align: "right",
    widthClass: "w-24",
    render: (l) => <span className="font-bold text-slate-900 tabular-nums">{formatRupiah(l.subtotal)}</span>,
  },
];

/** Dokumen Stock Opname gaya nota — kembaran `SetorPrintable.tsx` (susunan, ukuran huruf,
 *  dekorasi disamakan persis), rincian barangnya lebih banyak kolom (Kuota/Sistem/Fisik/Terjual/
 *  Refill) karena memang itu isi perhitungannya — bukan cuma Qty/Harga seperti nota jual-beli.
 *  Tanda tangan kanan "Diketahui Toko" (bukan "Disetujui Supplier"). */
export const OpnamePrintable: React.FC<{ data: OpnamePrintableData; className?: string }> = ({ data, className = "" }) => {
  const companyName = data.company?.legalName || data.company?.name || APP_CONFIG.name;
  const companySubtitle = data.company?.address || (data.company?.phone ? `Telp: ${data.company.phone}` : null) || APP_CONFIG.subTagline || APP_CONFIG.tagline;
  const city = data.company?.address ? data.company.address.split(",").pop()?.trim() : "Jakarta";
  const formattedDate = data.date ? formatDateLong(data.date) : "—";
  const badge = data.status ? STATUS_BADGE[data.status] : null;

  return (
    <div
      style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
      className={`bg-white text-slate-800 font-sans p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden print-exact-color print-nota-a5 print:border-none print:shadow-none print:p-2.5 print:rounded-none print:m-0 ${className}`}
    >
      <div className="absolute top-0 right-0 w-64 h-24 bg-gradient-to-bl from-blue-100/40 via-blue-50/20 to-transparent pointer-events-none" />

      {/* KEPALA */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2.5">
          {data.company?.logoUrl ? (
            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-slate-200/80 bg-white p-0.5 overflow-hidden shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element -- dokumen cetak statis, tanpa Next Image optimizer */}
              <img src={data.company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-[#0544cc] text-white flex items-center justify-center font-black text-xs">JS</div>
          )}
          <div>
            <h2 className="text-base font-black tracking-tight text-slate-900 leading-none">{companyName}</h2>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5 max-w-sm truncate">{companySubtitle}</p>
          </div>
        </div>
      </div>

      {/* JUDUL & METADATA */}
      <div className="mt-2 flex flex-row items-center justify-between gap-3 relative z-10">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-none">STOCK OPNAME</h1>
          <p className="text-[8.5px] font-semibold text-slate-400 tracking-[0.2em] uppercase mt-0.5">H I T U N G   F I S I K   P A R F U M   T O K O</p>
          <p className="text-[9.5px] text-slate-500 mt-0.5 font-medium leading-tight">Terjual, refill, dan tagihan dihitung otomatis dari stock fisik.</p>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 py-1 px-2.5 min-w-[210px] text-[10.5px] shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">No. Dokumen</span>
            <span className={`font-extrabold font-mono tracking-wide ${data.opnameNumber ? "text-slate-900" : "italic text-slate-400 font-normal"}`}>
              {data.opnameNumber ?? "otomatis saat disimpan"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Tanggal</span>
            <span className="font-bold text-slate-800">{formattedDate}</span>
          </div>
          {badge && (
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-slate-500 font-medium">Status</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.className}`}>{badge.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* TOKO & PETUGAS */}
      <div className="mt-2 grid grid-cols-2 gap-2 relative z-10">
        <div className="rounded-lg border border-blue-100 bg-blue-50 py-1.5 px-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-100/80 flex items-center justify-center flex-shrink-0 text-[#0544cc]">
              <Store className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Toko</p>
              <p className="text-xs font-extrabold text-slate-900 truncate leading-tight">{data.storeName || "—"}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-slate-50 py-1.5 px-2.5">
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Petugas</p>
          <p className="text-xs font-extrabold text-slate-900 truncate leading-tight mt-0.5">{data.petugasName || "—"}</p>
        </div>
      </div>

      {/* RINCIAN BARANG */}
      <NotaItemTable
        columns={kolomRincian}
        rows={data.lines}
        rowKey={(_l, idx) => idx}
        footer={{ label: `Jumlah ${data.lines.length} produk`, valueColumnKey: "subtotal", value: formatRupiah(data.total) }}
      />

      {/* RINGKASAN NILAI */}
      <div className="mt-1.5 flex justify-end relative z-10">
        <div className="w-full sm:w-72 rounded-lg border border-blue-100 bg-white overflow-hidden text-[10.5px]">
          <div className="bg-blue-100 py-1.5 px-2.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-[#0544cc] text-white flex items-center justify-center flex-shrink-0">
                <Calculator className="w-3 h-3" />
              </div>
              <span className="text-xs font-extrabold text-slate-900">Total Tagihan</span>
            </div>
            <span className="text-base font-black text-[#0544cc] tracking-tight tabular-nums">{formatRupiah(data.total)}</span>
          </div>
        </div>
      </div>

      {/* TANDA TANGAN — 2 kolom: petugas yang menghitung dan toko yang mengetahui. */}
      <div className="mt-2 grid grid-cols-2 gap-6 text-xs relative z-10">
        <div className="flex flex-col justify-between h-14">
          <p className="font-bold text-slate-800 text-[10px]">Dihitung Oleh</p>
          <div className="space-y-0.5 text-slate-600">
            <div className="border-b border-slate-300 w-full mb-0.5" />
            <p className="text-[9px] flex">
              <span className="inline-block w-10 flex-shrink-0">Nama</span>
              <span>: {data.dibuatOleh ? <span className="font-bold text-slate-900">{data.dibuatOleh}</span> : "...................................."}</span>
            </p>
            <p className="text-[9px] flex">
              <span className="inline-block w-10 flex-shrink-0">Tanggal</span>
              <span>: {formattedDate}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between h-14 border-l border-slate-200/80 pl-4">
          <p className="font-bold text-slate-800 text-[10px]">Diketahui Toko</p>
          <div className="space-y-0.5 text-slate-600">
            <div className="border-b border-slate-300 w-full mb-0.5" />
            <p className="text-[9px] flex">
              <span className="inline-block w-10 flex-shrink-0">Nama</span>
              <span>: ....................................</span>
            </p>
            <p className="text-[9px] flex">
              <span className="inline-block w-10 flex-shrink-0">Tanggal</span>
              <span>: ....................................</span>
            </p>
          </div>
        </div>
      </div>

      {/* KAKI */}
      <div className="mt-2 pt-1.5 flex flex-row items-end justify-between gap-3 relative z-10 border-t border-slate-100">
        <div className="rounded-lg bg-blue-50/70 border border-blue-100 py-1 px-2 max-w-sm flex items-start gap-1.5 text-slate-600">
          <div className="w-3.5 h-3.5 rounded-full bg-[#0544cc] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info className="w-2 h-2" />
          </div>
          <div>
            <p className="font-bold text-[#0544cc] text-[9px] leading-none">Catatan:</p>
            <p className="text-[8.5px] leading-tight text-slate-600 mt-0.5">Dokumen ini dicetak otomatis dari sistem sebagai bukti stock opname.</p>
          </div>
        </div>

        <div className="text-right self-end">
          <p className="text-[9.5px] text-slate-600 font-medium leading-none">
            {city}, {formattedDate}
          </p>
          <div className="w-12 h-0.5 bg-[#0544cc] rounded-full mt-0.5 ml-auto" />
          <p className="text-[9.5px] font-black text-slate-800 mt-0.5 tracking-wider leading-none">{companyName}</p>
        </div>
      </div>
    </div>
  );
};
