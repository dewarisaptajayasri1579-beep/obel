"use client";

import { Fragment } from "react";

/// Pratinjau nota Tambah Stok Gudang SAAT MASIH DIISI — dari state form di
/// memori, bukan dari backend (dokumennya belum tersimpan/belum punya id).
/// Setelah dokumen Posted/Revised, pratinjau yang "resmi" dipakai adalah PDF
/// server-side lewat tombol "Cetak Nota" (lihat PenerimaanNotaPreviewModal.tsx).
export interface PenerimaanLivePreviewGroup {
  nama: string;
  rows: { sku: string; name: string; qty: number }[];
}

export function PenerimaanLivePreview({
  receiptNo,
  receiptDate,
  note,
  groups,
  totalBaris,
  totalQty,
}: {
  receiptNo: string | null;
  receiptDate: string;
  note: string;
  groups: PenerimaanLivePreviewGroup[];
  totalBaris: number;
  totalQty: number;
}) {
  const tanggal = receiptDate
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(receiptDate))
    : "-";

  return (
    <div className="bg-white dark:bg-surface text-slate-800 dark:text-fg rounded-xl border border-slate-200 dark:border-line p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-line pb-3">
        <div>
          <p className="text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Obbel Coffee &amp; Milk</p>
          <h2 className="text-base font-black text-[var(--brand-700)] dark:text-brand-400 tracking-tight leading-tight mt-0.5">
            BUKTI TAMBAH STOK GUDANG
          </h2>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-slate-800 dark:text-fg">
            {receiptNo ?? <span className="italic font-sans font-normal text-slate-400 dark:text-fg-muted">otomatis saat disimpan</span>}
          </p>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted border-slate-200 dark:border-line mt-1">
            Draft — belum tersimpan
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Tanggal</p>
          <p className="font-semibold text-slate-800 dark:text-fg mt-0.5">{tanggal}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 dark:text-fg-muted uppercase tracking-wider">Keterangan</p>
          <p className="font-semibold text-slate-800 dark:text-fg mt-0.5">{note || "-"}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-line">
        <table className="w-full text-xs">
          <thead className="bg-[var(--brand-700)] text-white">
            <tr>
              <th className="w-10 py-2 px-3 text-center font-bold">No.</th>
              <th className="py-2 px-3 text-left font-bold">Kode</th>
              <th className="py-2 px-3 text-left font-bold">Nama Barang</th>
              <th className="py-2 px-3 text-right font-bold w-28">Qty Terima</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-line">
            {groups.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-slate-500 dark:text-fg-muted py-6">
                  Belum ada Qty Terima yang diisi.
                </td>
              </tr>
            ) : (
              groups.map((g) => (
                <Fragment key={g.nama}>
                  <tr className="bg-slate-50 dark:bg-surface-hover/60">
                    <td colSpan={4} className="py-1.5 px-3 text-[10px] font-bold text-slate-500 dark:text-fg-muted uppercase tracking-wide">
                      {g.nama}
                    </td>
                  </tr>
                  {g.rows.map((r, i) => (
                    <tr key={r.sku}>
                      <td className="py-1.5 px-3 text-center text-slate-500 dark:text-fg-muted">{i + 1}</td>
                      <td className="py-1.5 px-3 font-mono font-semibold text-slate-600 dark:text-fg-secondary">{r.sku}</td>
                      <td className="py-1.5 px-3 text-slate-800 dark:text-fg">{r.name}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-slate-900 dark:text-fg tabular-nums">{r.qty}</td>
                    </tr>
                  ))}
                </Fragment>
              ))
            )}
          </tbody>
          {groups.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-surface-hover border-t-2 border-slate-200 dark:border-line">
              <tr className="text-[11px] font-bold text-slate-700 dark:text-fg-secondary">
                <td colSpan={3} className="py-2 px-3 uppercase tracking-wide">
                  Total · {totalBaris} produk
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-slate-900 dark:text-fg">{totalQty}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-fg-muted italic">
        Pratinjau sementara — nota resmi (bisa dicetak/PDF) baru tersedia setelah dokumen di-Posting.
      </p>
    </div>
  );
}
