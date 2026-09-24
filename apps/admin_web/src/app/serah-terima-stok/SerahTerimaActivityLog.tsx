"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { api, type ActivityLogEntry } from "@/lib/api-client";

const AKSI_LABEL: Record<string, string> = {
  REQUESTED: "Diajukan",
  APPROVED: "Disetujui & dikirim",
  REJECTED: "Ditolak",
  SENT: "Dikirim",
  RECEIVED: "Diterima",
  RECEIVED_WITH_DISCREPANCY: "Diterima dengan selisih",
  CANCELLED: "Dibatalkan",
  REVISED: "Direvisi",
  RECEIPT_CORRECTED: "Penerimaan dikoreksi",
  UPDATE: "Diperbarui",
};

const AKSI_WARNA: Record<string, string> = {
  REQUESTED: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted",
  APPROVED: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400",
  REJECTED: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400",
  SENT: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400",
  RECEIVED: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  RECEIVED_WITH_DISCREPANCY: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  CANCELLED: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400",
  REVISED: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  RECEIPT_CORRECTED: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  UPDATE: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted",
};

function waktuJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

/// Panel "Riwayat Aktivitas" Serah Terima Stok — pola sama persis dengan
/// PenerimaanActivityLog.tsx (Tambah Stok Gudang), sumbernya gabungan
/// aktivitas restock_request + stock_distribution (lihat
/// StockHandoversService.findActivityLog di backend).
export function SerahTerimaActivityLog({ id }: { id: string }) {
  const [log, setLog] = useState<ActivityLogEntry[] | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    let batal = false;
    setLog(null);
    setGagal(false);
    api
      .getStockHandoverActivityLog(id)
      .then((data) => !batal && setLog(data))
      .catch(() => !batal && setGagal(true));
    return () => {
      batal = true;
    };
  }, [id]);

  return (
    <div className="border-t border-slate-200/60 dark:border-line pt-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <History className="w-3.5 h-3.5 text-slate-400 dark:text-fg-muted" />
        <p className="text-sm font-bold text-slate-700 dark:text-fg">Riwayat Aktivitas</p>
      </div>

      {gagal ? (
        <p className="text-xs text-slate-500 dark:text-fg-muted py-4">Gagal memuat riwayat aktivitas.</p>
      ) : !log ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : log.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-fg-muted py-4">Belum ada riwayat aktivitas.</p>
      ) : (
        <div className="rounded-xl border border-slate-200/80 dark:border-line overflow-hidden">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
              {[...log].reverse().map((entri) => (
                <tr key={entri.id}>
                  <td className="py-2.5 px-3 text-slate-500 dark:text-fg-muted whitespace-nowrap">{waktuJakarta(entri.occurredAt)}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-fg">{entri.actorName}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold mr-1.5 ${AKSI_WARNA[entri.action] ?? "bg-slate-100 text-slate-600"}`}>
                      {AKSI_LABEL[entri.action] ?? entri.action}
                    </span>
                    {entri.note && <span className="text-slate-600 dark:text-fg-muted">{entri.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
