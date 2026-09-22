"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, ClipboardList, Wallet, CheckCircle2, MoreVertical, Eye } from "lucide-react";
import { Badge, Button, PortalMenu } from "@/components/ui";
import { TabelGayaSales, type KolomGayaSales, type GrupFilterGayaSales, type OpsiPeriodeGayaSales } from "@/components/TabelGayaSales";
import { useColumnVisibility, type ColumnDef } from "@/lib/use-column-visibility";
import { useHotkey } from "@/hooks/useHotkey";
import { formatDate, formatRupiah } from "@/lib/format";
import { ShareButton } from "@/components/transaksi/ShareButton";
import { OpnameReportPreviewModal } from "./OpnameReportPreviewModal";

export interface OpnameItemRow {
  productId: string;
  productCode: string;
  productName: string;
  quotaQty: number;
  stockSistem: number;
  stockFisik: number;
  terjualQty: number;
  refillQty: number;
  selisihType: string;
  subtotalTagihan: number;
}

export interface OpnameRow {
  id: string;
  opnameNumber: string;
  date: string;
  storeName: string;
  petugasName: string;
  status: "DRAFT" | "SELESAI";
  totalTagihan: number;
  itemCount: number;
  items: OpnameItemRow[];
}

const STATUS_LABEL: Record<OpnameRow["status"], string> = { DRAFT: "Draft", SELESAI: "Selesai" };
const STATUS_BADGE: Record<OpnameRow["status"], "warning" | "success"> = { DRAFT: "warning", SELESAI: "success" };
const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

const KOLOM_TERSEDIA: ColumnDef[] = [
  { key: "no", label: "No." },
  { key: "opnameNumber", label: "No. Opname" },
  { key: "date", label: "Tanggal" },
  { key: "storeName", label: "Toko" },
  { key: "totalTagihan", label: "Total Tagihan" },
  { key: "status", label: "Status" },
  { key: "aksi", label: "Aksi" },
];

/** Panel Stock Opname (Parfum) — pola PERSIS `SetorPanel.tsx`/`PurchaseOrderPanel.tsx`
 *  (§7.0 aturan-tampilan.md). Beda dari Setor: TIDAK ada Koreksi sama sekali (backend cuma
 *  create/findAll/findOne, tidak ada endpoint pembalik untuk Opname — stock count bukan
 *  transaksi jual-beli yang wajar "dikoreksi" lewat dokumen baru) dan status `DRAFT` di sini
 *  murni nilai enum yang belum pernah benar-benar diproduksi backend (`create()` SELALU langsung
 *  set `SELESAI`) — tetap ditampilkan sebagai opsi filter (harmless, konsisten dengan skema),
 *  bukan alur yang aktif dipakai. Share cuma untuk yang `SELESAI` (sama seperti perilaku
 *  halaman detail lama). */
export const OpnamePanel: React.FC<{ rows: OpnameRow[]; canCreate: boolean }> = ({ rows, canCreate }) => {
  const router = useRouter();
  useHotkey({ key: "n", ctrl: true, allowInEditable: true }, () => canCreate && router.push("/operasional/opname/baru"));

  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<OpsiPeriodeGayaSales>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [actionMenuRowId, setActionMenuRowId] = useState<string | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<HTMLElement | null>(null);
  const { isVisible: tampil, toggle: toggleColumn } = useColumnVisibility("opname", KOLOM_TERSEDIA);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.("[data-action-menu]")) setActionMenuRowId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
    totalTagihan: rows.reduce((sum, r) => sum + r.totalTagihan, 0),
    selesai: rows.filter((r) => r.status === "SELESAI").length,
    draft: rows.filter((r) => r.status === "DRAFT").length,
  };

  const semuaKolom: KolomGayaSales<OpnameRow>[] = [
    { key: "no", header: "No.", align: "center", cell: (_r, i) => <span className="text-slate-500 dark:text-fg-muted">{i + 1}</span> },
    {
      key: "opnameNumber",
      header: "No. Opname",
      sortValue: (r) => r.opnameNumber,
      filterValue: (r) => r.opnameNumber,
      cell: (r) => (
        <Link href={`/operasional/opname/${r.id}`} className="font-mono text-xs font-bold text-[#0544cc] dark:text-blue-400 hover:underline">
          {r.opnameNumber}
        </Link>
      ),
    },
    { key: "date", header: "Tanggal", sortValue: (r) => r.date, cell: (r) => formatDate(r.date) },
    {
      key: "storeName",
      header: "Toko",
      sortValue: (r) => r.storeName,
      filterValue: (r) => `${r.storeName} ${r.petugasName}`,
      cell: (r) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-fg">{r.storeName}</p>
          <p className="text-xs text-slate-500 dark:text-fg-muted">{r.petugasName} · {r.itemCount} produk</p>
        </div>
      ),
    },
    {
      key: "totalTagihan",
      header: "Total Tagihan",
      align: "right",
      sortValue: (r) => r.totalTagihan,
      cell: (r) => <span className={r.totalTagihan !== 0 ? "font-bold text-slate-900 dark:text-fg" : "text-slate-400 dark:text-fg-muted"}>{formatRupiah(r.totalTagihan)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => STATUS_LABEL[r.status],
      cell: (r) => <Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
    {
      key: "aksi",
      header: "",
      align: "center",
      // Kebab persis pola `PurchaseOrderPanel.tsx` (§7.0 aturan-tampilan.md): Lihat Detail
      // selalu ada, Share cuma untuk yang SELESAI (DRAFT belum pernah benar-benar diproduksi
      // backend). Tanpa Batalkan — Opname tidak punya alur koreksi/pembalik sama sekali.
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
              href={`/operasional/opname/${r.id}`}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-fg hover:bg-slate-50 dark:hover:bg-surface-hover transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>Lihat Detail</span>
            </Link>
            {r.status === "SELESAI" && (
              <ShareButton docType="NOTA_OPNAME" docId={r.id} label="Share / Cetak Nota Opname" menuItem onDone={() => setActionMenuRowId(null)} />
            )}
          </PortalMenu>
        </div>
      ),
    },
  ];
  const kolom = semuaKolom.filter((k) => tampil(k.key));

  const filterGroups: GrupFilterGayaSales<OpnameRow>[] = [
    { key: "status", label: "Status", value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS, predicate: (r, v) => r.status === v },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-[#0544cc] dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-100 dark:border-blue-500/20 shadow-2xs">
            <ClipboardCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">Stock Opname (Parfum)</h1>
            <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
              Input stock fisik per kunjungan — sistem hitung terjual, refill, dan tagihan otomatis.
            </p>
          </div>
        </div>

        {canCreate && (
          <Link href="/operasional/opname/baru">
            <Button variant="primary" size="sm">
              Buat Opname <span className="ml-1 text-[10px] font-mono opacity-80">(Ctrl+N)</span>
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
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-100 dark:border-emerald-900/30">
            <Wallet className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Total Tagihan</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{formatRupiah(metrics.totalTagihan)}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">dari hasil terjual</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[#0544cc] dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-100 dark:border-blue-900/30">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Selesai</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.selesai}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">sudah dihitung tuntas</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white/80 dark:bg-surface p-3.5 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-100 dark:border-amber-900/30">
            <ClipboardList className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-fg-muted">Draft</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight mt-0.5">{metrics.draft}</p>
            <p className="text-[11px] text-slate-400 dark:text-fg-muted mt-0.5">belum pernah terjadi di alur saat ini</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        <TabelGayaSales
          kolom={kolom}
          rows={rows}
          rowKey={(r) => r.id}
          searchPlaceholder="Cari nomor opname atau toko..."
          emptyMessage='Belum ada Stock Opname. Klik "Buat Opname" untuk mulai.'
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
          pdfButton={{ title: "Pratinjau & cetak PDF daftar Stock Opname sesuai filter di layar", onClick: () => setShowPreview(true) }}
          excelHref={`/api/laporan/opname/excel${reportQuery}`}
          renderExpanded={(r) => (
            <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line bg-white dark:bg-surface">
              <table className="w-full text-xs">
                <thead className="bg-blue-50/70 dark:bg-surface-hover text-[11px] font-bold text-slate-500 dark:text-fg-muted uppercase">
                  <tr>
                    <th className="w-8 text-center px-3.5 py-2">No.</th>
                    <th className="text-left px-3.5 py-2">Produk</th>
                    <th className="text-right px-3.5 py-2">Kuota</th>
                    <th className="text-right px-3.5 py-2">Sistem</th>
                    <th className="text-right px-3.5 py-2">Fisik</th>
                    <th className="text-right px-3.5 py-2">Terjual</th>
                    <th className="text-right px-3.5 py-2">Refill</th>
                    <th className="text-right px-3.5 py-2">Tagihan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-line">
                  {r.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3.5 py-3 text-slate-500 dark:text-fg-muted">
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
                          {item.selisihType === "RETUR_LEBIH" && (
                            <Badge variant="warning" className="ml-2">
                              Retur
                            </Badge>
                          )}
                        </td>
                        <td className="px-3.5 py-2 text-right text-slate-600 dark:text-fg-muted">{item.quotaQty}</td>
                        <td className="px-3.5 py-2 text-right text-slate-600 dark:text-fg-muted">{item.stockSistem}</td>
                        <td className="px-3.5 py-2 text-right font-bold text-slate-900 dark:text-fg">{item.stockFisik}</td>
                        <td className="px-3.5 py-2 text-right text-slate-600 dark:text-fg-muted">{item.terjualQty}</td>
                        <td className="px-3.5 py-2 text-right text-slate-600 dark:text-fg-muted">{item.refillQty}</td>
                        <td className="px-3.5 py-2 text-right font-bold text-slate-900 dark:text-fg">{formatRupiah(item.subtotalTagihan)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {r.items.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-200 dark:border-line font-bold bg-blue-50/70 dark:bg-surface-hover">
                      <td className="px-3.5 py-2" colSpan={7}>
                        Total Tagihan
                      </td>
                      <td className="px-3.5 py-2 text-right font-black text-slate-900 dark:text-fg">{formatRupiah(r.totalTagihan)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        />
      </div>

      <OpnameReportPreviewModal isOpen={showPreview} onClose={() => setShowPreview(false)} query={reportQuery} />
    </div>
  );
};
