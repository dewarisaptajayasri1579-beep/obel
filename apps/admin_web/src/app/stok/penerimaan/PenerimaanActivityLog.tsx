"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { api, ApiError, type ActivityLogEntry } from "@/lib/api-client";

const AKSI_LABEL: Record<string, string> = {
  CREATE: "Draft dibuat",
  UPDATE: "Draft diperbarui",
  POST: "Diposting",
  POST_REVISION: "Revisi diposting",
  CREATE_REVISION: "Revisi dimulai",
  DELETE: "Draft dihapus",
};

const AKSI_WARNA: Record<string, string> = {
  CREATE: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted",
  UPDATE: "bg-slate-100 dark:bg-surface-hover text-slate-600 dark:text-fg-muted",
  POST: "bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400",
  POST_REVISION: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  CREATE_REVISION: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
  DELETE: "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400",
};

function waktuJakarta(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

/// Panel "Riwayat Aktivitas" — Tanggal/Siapa/Ngapain per aksi bermakna pada
/// dokumen ini. Sumbernya `ActivityLogService` backend (lihat AGENTS.md
/// "Aturan Soft Delete & Log Aktivitas"); sebelum panel ini datanya sudah
/// tersimpan tapi tidak ada satu pun layar yang menampilkannya.
export function PenerimaanActivityLog({ receiptId }: { receiptId: string }) {
  const [log, setLog] = useState<ActivityLogEntry[] | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    let batal = false;
    setLog(null);
    setGagal(false);
    api
      .getStockReceiptActivityLog(receiptId)
      .then((data) => !batal && setLog(data))
      .catch(() => !batal && setGagal(true));
    return () => {
      batal = true;
    };
  }, [receiptId]);

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
            <thead className="bg-slate-50/80 dark:bg-surface-hover text-[11px] font-bold text-slate-500 dark:text-fg-muted">
              <tr>
                <th className="py-2.5 px-3 text-left w-40">Tanggal</th>
                <th className="py-2.5 px-3 text-left w-36">Siapa</th>
                <th className="py-2.5 px-3 text-left">Ngapain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
              {log.map((entri) => (
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
