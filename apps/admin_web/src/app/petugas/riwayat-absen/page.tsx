"use client";

import React, { useEffect, useState } from "react";
import { api, ApiError, type ShiftHistoryResponse } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { formatTanggalJakarta, formatJamJakarta } from "../_lib/format";

import { OBBEL } from "../_lib/theme";
const GREEN = OBBEL.primaryDark;

const STATUS_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  OPEN: { label: "Sedang Aktif", bg: "#E8F5E9", fg: GREEN },
  CLOSING: { label: "Proses Tutup", bg: "#FFF8E1", fg: "#B45309" },
  CLOSED: { label: "Selesai Shift", bg: "#F1F5F9", fg: "#475569" },
  CANCELLED: { label: "Dibatalkan", bg: "#FEE2E2", fg: "#D21919" },
  SCHEDULED: { label: "Terjadwal", bg: "#F1F5F9", fg: "#475569" },
};

function RiwayatAbsenContent() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ShiftHistoryResponse | null>(null);

  useEffect(() => {
    api
      .getShiftHistory()
      .then(setHistory)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "Gagal memuat riwayat absen."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !history) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const persen = history.totalHariKerja > 0 ? Math.round((history.totalHadir / history.totalHariKerja) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F7F9F6]">
      <div className="bg-white px-5 pt-5 pb-4">
        <h1 className="text-lg font-extrabold text-slate-900">Riwayat Absen</h1>
        <p className="text-xs text-slate-500 mt-1">Lihat riwayat kehadiran dan aktivitas kerja Anda.</p>
      </div>

      <div className="p-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500">Total Hadir Bulan Ini</p>
            <p className="font-extrabold text-2xl mt-1" style={{ color: GREEN }}>
              {history.totalHadir} hari
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Dari {history.totalHariKerja} hari berjalan</p>
          </div>
          <div className="text-2xl font-extrabold" style={{ color: GREEN }}>
            {persen}%
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {history.items.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-10">Belum ada riwayat absen bulan ini.</p>
          )}
          {history.items.map((item) => {
            const status = STATUS_LABEL[item.status] ?? STATUS_LABEL.CLOSED;
            return (
              <div key={item.id} className="rounded-xl bg-white border border-slate-200 p-3.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold rounded-full px-2.5 py-0.5" style={{ backgroundColor: status.bg, color: status.fg }}>
                    {status.label}
                  </span>
                  <span className="text-xs text-slate-400">{formatTanggalJakarta(item.businessDate)}</span>
                </div>
                <p className="font-semibold text-sm text-slate-900">{item.boothName}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                  <span>Check-In {item.openedAt ? formatJamJakarta(item.openedAt) : "-"}</span>
                  <span>Check-Out {item.closedAt ? formatJamJakarta(item.closedAt) : "-"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function RiwayatAbsenPage() {
  return (
    <RequirePetugasAuth>
      <RiwayatAbsenContent />
    </RequirePetugasAuth>
  );
}
