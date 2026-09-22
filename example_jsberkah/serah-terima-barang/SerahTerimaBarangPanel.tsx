"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, PackageCheck, ClipboardList, Clock, CheckCircle2, XCircle, MoreVertical, Eye } from "lucide-react";
import { Badge, Button, PortalMenu } from "@/components/ui";
import { TabelGayaSales, type KolomGayaSales, type GrupFilterGayaSales, type OpsiPeriodeGayaSales } from "@/components/TabelGayaSales";
import { useColumnVisibility, type ColumnDef } from "@/lib/use-column-visibility";
import { useHotkey } from "@/hooks/useHotkey";
import { formatDate } from "@/lib/format";
import { ShareButton } from "@/components/transaksi/ShareButton";
import { SerahTerimaBarangReportPreviewModal } from "./SerahTerimaBarangReportPreviewModal";

export interface SerahTerimaBarangItemRow {
  productId: string;
  productCode: string;
  productName: string;
  qty: number;
  qtyFisik: number | null;
}

export interface SerahTerimaBarangRow {
  id: string;
  stbNumber: string;
  date: string;
  salesName: string;
  warehouseName: string;
  status: "MENUNGGU_KONFIRMASI" | "DIKONFIRMASI" | "DITOLAK";
  itemCount: number;
  notes: string | null;
  daysPending: number | null;
  items: SerahTerimaBarangItemRow[];
}

const STATUS_LABEL: Record<SerahTerimaBarangRow["status"], string> = {
  MENUNGGU_KONFIRMASI: "Menunggu Konfirmasi",
  DIKONFIRMASI: "Dikonfirmasi",
  DITOLAK: "Ditolak",
};
const STATUS_BADGE: Record<SerahTerimaBarangRow["status"], "warning" | "success" | "danger"> = {
  MENUNGGU_KONFIRMASI: "warning",
  DIKONFIRMASI: "success",
  DITOLAK: "danger",
};
const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

const PENDING_WARNING_DAYS = 3;

const KOLOM_TERSEDIA: ColumnDef[] = [
  { key: "no", label: "No." },
  { key: "stbNumber", label: "No. STB" },
  { key: "date", label: "Tanggal" },
  { key: "salesName", label: "Sales" },
  { key: "warehouseName", label: "Gudang Asal" },
  { key: "itemCount", label: "Item" },
  { key: "status", label: "Status" },
  { key: "aksi", label: "Aksi" },
];

/** Panel Serah Terima Barang — pola PERSIS `PurchaseOrderPanel.tsx` (ini menu Transaksi, bukan
 *  Master CRUD): header ikon+judul di dalam komponen ini sendiri, StatTile ringkasan, toolbar
 *  Core + tabel, TANPA `<Card>` pembungkus sama sekali (lihat aturan-tampilan.md §7.1a). */
export const SerahTerimaBarangPanel: React.FC<{ rows: SerahTerimaBarangRow[]; canCreate: boolean }> = ({ rows, canCreate }) => {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<OpsiPeriodeGayaSales>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [actionMenuRowId, setActionMenuRowId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const { isVisible: tampil, toggle: toggleColumn } = useColumnVisibility("serah-terima-barang", KOLOM_TERSEDIA);

  useHotkey({ key: "n", ctrl: true, allowInEditable: true }, () => canCreate && router.push("/pembelian/serah-terima-barang/baru"));

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.("[data-action-menu]")) setActionMenuRowId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sejajar `PurchaseOrderPanel.reportQuery` — PDF/Excel ikut filter status+periode yang sedang
  // tampil di layar, bukan selalu semua data.
  const reportQuery = (() => {
    const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const now = new Date();
    let from: string | undefined;
    let to: string | undefined;
    if (dateFilter === "today") {
      from = to = toIsoDate(now);
    } else if (dateFilter === "this_month") {
      from = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
      to = toIsoDate(now);
    } else if (dateFilter === "this_year") {
      from = toIsoDate(new Date(now.getFullYear(), 0, 1));
      to = toIsoDate(now);
    } else if (dateFilter === "custom" && (customFrom || customTo)) {
      from = customFrom || undefined;
      to = customTo || undefined;
    }
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  })();

  const metrics = {
    total: rows.length,
    menunggu: rows.filter((r) => r.status === "MENUNGGU_KONFIRMASI").length,
    dikonfirmasi: rows.filter((r) => r.status === "DIKONFIRMASI").length,
    ditolak: rows.filter((r) => r.status === "DITOLAK").length,
  };

  const semuaKolom: KolomGayaSales<SerahTerimaBarangRow>[] = [
    { key: "no", header: "No.", align: "center", cell: (_r, i) => <span className="text-slate-500 dark:text-fg-muted">{i + 1}</span> },
    {
      key: "stbNumber",
      header: "No. STB",
      sortValue: (r) => r.stbNumber,
      filterValue: (r) => r.stbNumber,
      cell: (r) => (
        <Link href={`/pembelian/serah-terima-barang/${r.id}`} className="font-mono text-xs font-bold text-[#0544cc] dark:text-blue-400 hover:underline">
          {r.stbNumber}
        </Link>
      ),
    },
    { key: "date", header: "Tanggal", sortValue: (r) => r.date, cell: (r) => formatDate(r.date) },
    {
      key: "salesName",
      header: "Sales",
      sortValue: (r) => r.salesName,
      filterValue: (r) => r.salesName,
      cell: (r) => <span className="font-bold text-slate-800 dark:text-fg">{r.salesName}</span>,
    },
    {
      key: "warehouseName",
      header: "Gudang Asal",
      sortValue: (r) => r.warehouseName,
      filterValue: (r) => r.warehouseName,
      cell: (r) => r.warehouseName,
    },
    {
      key: "itemCount",
      header: "Item",
      align: "right",
      sortValue: (r) => r.itemCount,
      cell: (r) => <span className={r.itemCount !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}>{r.itemCount}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => STATUS_LABEL[r.status],
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
          {r.daysPending !== null && r.daysPending > PENDING_WARNING_DAYS && (
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{r.daysPending} hari</span>
          )}
        </div>
      ),
    },
    {
      key: "aksi",
      header: "",
      align: "center",
      // Kebab persis pola `PurchaseOrderPanel.tsx` (§7.0 aturan-tampilan.md): Lihat Detail +
      // Share sebagai menuItem. Tanpa Batalkan — STB tidak pernah dibangun kemampuan batal di
      // backend (dokumen dua-pihak, pembatalannya lewat Sales menolak konfirmasi, bukan admin).
      cell: (r) => (
        <div className="relative inline-block" data-action-menu>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const buka = actionMenuRowId !== r.id;
              setActionMenuAnchor(buka ? e.currentTarget : null);
              setActionMenuRowId(buka ? r.id : null);
            }}
            className={`w-8 h-8 rounded-lg border border-slate-200/90 dark:border-line flex items-center justify-center text-slate-600 dark:text-fg-muted hover:text-[#0544cc] dark:hover:text-blue-400 shadow-2xs cursor-pointer transition-colors ${
              actionMenuRowId === r.id ? "bg-blue-50 text-[#0544cc] border-blue-300" : "bg-white/80 dark:bg-surface hover:bg-slate-50"
            }`}
            title="Aksi Lainnya"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          <PortalMenu
            open={actionMenuRowId === r.id}
            anchor={actionMenuAnchor}
            width={208}
            onClose={() => setActionMenuRowId(null)}
            className="rounded-xl bg-white dark:bg-surface border border-slate-200/90 dark:border-line shadow-xl py-1.5 text-left"
          >
            <Link
              onClick={() => setActionMenuRowId(null)}
              href={`/pembelian/serah-terima-barang/${r.id}`}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-fg hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Lihat Detail</span>
            </Link>
            <ShareButton docType="SERAH_TERIMA_BARANG" docId={r.id} label="Share / Cetak Nota STB" menuItem onDone={() => setActionMenuRowId(null)} />
          </PortalMenu>
        </div>
      ),
    },
  ];
  const kolom = semuaKolom.filter((k) => tampil(k.key));

  const filterGroups: GrupFilterGayaSales<SerahTerimaBarangRow>[] = [
    { key: "status", label: "Status", value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS, predicate: (r, v) => r.status === v },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-[#0544cc] dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-100 dark:border-blue-500/20 shadow-2xs">
            <PackageCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Serah Terima Barang</h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Barang dari gudang diserahkan ke Sales — stock baru pindah setelah Sales konfirmasi.
            </p>
          </div>
        </div>

        {canCreate && (
          <Link href="/pembelian/serah-terima-barang/baru">
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Serah Terima Baru <span className="ml-1 text-[10px] font-mono opacity-80">(Ctrl+N)</span>
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[#0544cc] dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-100 dark:border-blue-900/30">
            <ClipboardList className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Transaksi</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.total}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">dokumen</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
            <Clock className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Menunggu Konfirmasi</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.menunggu}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">belum diproses Sales</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Dikonfirmasi</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.dikonfirmasi}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">stok sudah pindah</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-100 dark:border-rose-900/30">
            <XCircle className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Ditolak</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.ditolak}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">stok tetap di gudang</p>
          </div>
        </div>
      </div>

      {/* Bungkus toolbar+tabel dalam kotak putih berbingkai — pola PERSIS `PurchaseOrderPanel.tsx`
          (`rounded-xl border ... bg-white ... shadow-2xs p-4`). Ini BUKAN komponen `<Card>` (lihat
          §7.0), cuma div bergaya kartu — beda hal dari larangan `<Card>` di list Transaksi. */}
      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
      <TabelGayaSales
        kolom={kolom}
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Cari nomor STB atau nama Sales..."
        emptyMessage='Belum ada Serah Terima Barang. Klik "Serah Terima Baru" untuk mulai.'
        periodFilter={{
          value: dateFilter,
          onChange: setDateFilter,
          customFrom,
          customTo,
          onCustomFromChange: setCustomFrom,
          onCustomToChange: setCustomTo,
          dateValue: (r) => r.date,
        }}
        filterGroups={filterGroups}
        columnMenu={{ columns: KOLOM_TERSEDIA, isVisible: tampil, toggle: toggleColumn }}
        pdfButton={{ title: "Pratinjau & cetak PDF daftar Serah Terima Barang sesuai filter di layar", onClick: () => setShowPreview(true) }}
        excelHref={`/api/laporan/serah-terima-barang/excel${reportQuery}`}
        renderExpanded={(r) => {
          const tampilkanQtyFisik = r.status === "DIKONFIRMASI";
          const totalQtyRencana = r.items.reduce((sum, item) => sum + item.qty, 0);
          const totalQtyFisik = r.items.reduce((sum, item) => sum + (item.qtyFisik ?? 0), 0);
          const jumlahKolom = tampilkanQtyFisik ? 4 : 3;
          return (
            <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line bg-white dark:bg-surface">
              <table className="w-full text-xs">
                <thead className="bg-blue-50/70 dark:bg-surface-hover text-[11px] font-bold text-slate-500 dark:text-fg-muted uppercase">
                  <tr>
                    <th className="w-8 text-center px-3.5 py-2">No.</th>
                    <th className="text-left px-3.5 py-2">Produk</th>
                    <th className="text-right px-3.5 py-2">{tampilkanQtyFisik ? "Qty Rencana" : "Qty"}</th>
                    {tampilkanQtyFisik && <th className="text-right px-3.5 py-2">Qty Fisik</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-line">
                  {r.items.length === 0 ? (
                    <tr>
                      <td colSpan={jumlahKolom} className="px-3.5 py-3 text-slate-500 dark:text-fg-muted">
                        Dokumen ini belum punya rincian barang.
                      </td>
                    </tr>
                  ) : (
                    r.items.map((item, index) => (
                      <tr key={item.productId}>
                        <td className="px-3.5 py-2 text-center text-slate-500 dark:text-fg-muted">{index + 1}</td>
                        <td className="px-3.5 py-2 text-slate-800 dark:text-fg">
                          <span className="font-mono text-[10px] font-bold mr-1.5 text-slate-500">{item.productCode}</span>
                          {item.productName}
                        </td>
                        <td className={`px-3.5 py-2 text-right ${item.qty !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}`}>
                          {item.qty}
                        </td>
                        {tampilkanQtyFisik && (
                          <td
                            className={`px-3.5 py-2 text-right font-semibold ${
                              item.qtyFisik == null
                                ? "text-slate-400 dark:text-fg-muted"
                                : item.qtyFisik === item.qty
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {item.qtyFisik ?? "—"}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
                {r.items.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-200 dark:border-line font-bold bg-blue-50/70 dark:bg-surface-hover">
                      <td className="px-3.5 py-2" colSpan={2}>
                        Total
                      </td>
                      <td className="px-3.5 py-2 text-right font-black text-slate-900 dark:text-fg">{totalQtyRencana}</td>
                      {tampilkanQtyFisik && <td className="px-3.5 py-2 text-right font-black text-slate-900 dark:text-fg">{totalQtyFisik}</td>}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          );
        }}
      />
      </div>

      <SerahTerimaBarangReportPreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} query={reportQuery} />
    </div>
  );
};
