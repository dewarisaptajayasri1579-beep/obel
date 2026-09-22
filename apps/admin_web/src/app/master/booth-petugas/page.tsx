"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import {
  api,
  ApiError,
  type Booth,
  type BoothShiftAssignment,
  type ShiftTemplate,
  type UserAccount,
} from "@/lib/api-client";

function kunci(boothId: string, shiftTemplateId: string) {
  return `${boothId}:${shiftTemplateId}`;
}

/// Setting Booth-Petugas (Data Operasional) — matriks Booth × template shift,
/// tiap sel Select Petugas yang auto-save begitu dipilih (tidak ada tombol
/// Simpan terpisah). Ini pasangan DEFAULT yang jadi acuan Admin, bukan jadwal
/// shift harian sungguhan (`ShiftSession`, dibuat per business date lewat
/// jalur lain).
///
/// Kolom shift TIDAK di-hardcode "Shift 1"/"Shift 2" — dibangun dari
/// `ShiftTemplate` aktif yang sudah ada (diurutkan jam mulai), mengikuti
/// aturan "nothing hardcoded" di AGENTS.md. Kalau Admin menambah template
/// shift baru, kolomnya otomatis bertambah di sini.
function BoothPetugasContent() {
  const toast = useToast();
  const [booths, setBooths] = useState<Booth[] | null>(null);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [petugas, setPetugas] = useState<UserAccount[]>([]);
  const [assignments, setAssignments] = useState<BoothShiftAssignment[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [boothList, templateList, userList, assignmentList] = await Promise.all([
        api.getBooths(),
        api.getShiftTemplates(),
        api.getUsers(),
        api.getBoothShiftAssignments(),
      ]);
      setBooths(boothList.filter((b) => b.status === "ACTIVE"));
      setShiftTemplates(templateList.filter((t) => t.active));
      setPetugas(userList.filter((u) => u.role === "BOOTH_STAFF"));
      setAssignments(assignmentList);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Setting Booth-Petugas.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assignmentByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assignments) {
      if (a.staffId) map.set(kunci(a.boothId, a.shiftTemplateId), a.staffId);
    }
    return map;
  }, [assignments]);

  const opsiPetugas = useMemo(() => petugas.map((p) => ({ value: p.id, label: p.fullName })), [petugas]);

  async function pilihPetugas(boothId: string, shiftTemplateId: string, staffId: string) {
    const key = kunci(boothId, shiftTemplateId);
    setSavingKey(key);
    // Optimistic — biar Select langsung menampilkan pilihan tanpa menunggu round-trip.
    setAssignments((prev) => {
      const tanpaBaris = prev.filter((a) => !(a.boothId === boothId && a.shiftTemplateId === shiftTemplateId));
      return [
        ...tanpaBaris,
        {
          id: `optimistic-${key}`,
          boothId,
          shiftTemplateId,
          staffId: staffId || null,
          staff: petugas.find((p) => p.id === staffId) ?? null,
          updatedAt: new Date().toISOString(),
        },
      ];
    });

    try {
      const saved = await api.upsertBoothShiftAssignment({ boothId, shiftTemplateId, staffId: staffId || null });
      setAssignments((prev) => [
        ...prev.filter((a) => !(a.boothId === boothId && a.shiftTemplateId === shiftTemplateId)),
        saved,
      ]);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Gagal menyimpan penugasan.");
      await load(); // gagal — tarik ulang state sungguhan, batalkan optimistic update.
    } finally {
      setSavingKey(null);
    }
  }

  if (!booths) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Data Operasional" },
          { label: "Setting Booth-Petugas" },
        ]}
      />

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-[var(--brand-700)] dark:text-brand-400 flex items-center justify-center flex-shrink-0 border border-brand-100 dark:border-brand-500/20 shadow-2xs">
          <CalendarClock className="w-4.5 h-4.5" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-fg tracking-tight leading-tight">
            Setting Booth-Petugas
          </h1>
          <p className="text-xs text-slate-500 dark:text-fg-muted font-normal mt-0.5">
            Petugas default per Booth &amp; shift — pilih langsung tersimpan, tanpa tombol Simpan.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-4">
        {shiftTemplates.length === 0 ? (
          <p className="text-center text-sm text-slate-500 dark:text-fg-muted py-10">
            Belum ada template Shift aktif. Buat dulu di Master Data → Shift.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-line">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-brand-50/70 dark:bg-surface-hover/80 text-[11px] font-bold text-slate-700 dark:text-fg-secondary border-b border-slate-200/80 dark:border-line">
                  <th className="py-3.5 px-3 text-center w-12">No.</th>
                  <th className="py-3.5 px-3">Booth</th>
                  {shiftTemplates.map((t) => (
                    <th key={t.id} className="py-3.5 px-3 min-w-[220px]">
                      {t.name}
                      <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400 dark:text-fg-muted">
                        {t.startTime}–{t.endTime}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-line bg-white dark:bg-surface">
                {booths.length === 0 ? (
                  <tr>
                    <td colSpan={2 + shiftTemplates.length} className="text-center py-10 text-slate-500 dark:text-fg-muted">
                      Belum ada Booth aktif.
                    </td>
                  </tr>
                ) : (
                  booths.map((b, i) => (
                    <tr key={b.id} className="hover:bg-brand-50/20 dark:hover:bg-surface-hover/40 transition-colors">
                      <td className="py-3 px-3 text-center text-slate-500 dark:text-fg-muted">{i + 1}</td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800 dark:text-fg">{b.name}</span>
                        <span className="ml-2 font-mono text-[10px] text-slate-400 dark:text-fg-muted">{b.code}</span>
                      </td>
                      {shiftTemplates.map((t) => {
                        const key = kunci(b.id, t.id);
                        const sedangMenyimpan = savingKey === key;
                        return (
                          <td key={t.id} className="py-2.5 px-3">
                            <div className="relative">
                              <Select
                                options={opsiPetugas}
                                value={assignmentByKey.get(key) ?? ""}
                                onChange={(v) => pilihPetugas(b.id, t.id, v)}
                                placeholder="Belum ditugaskan"
                                sizeVariant="sm"
                                className="!text-xs !h-8.5 !min-h-[34px] !rounded-lg !bg-white dark:!bg-surface shadow-2xs"
                              />
                              {sedangMenyimpan && (
                                <Loader2 className="w-3.5 h-3.5 absolute right-9 top-1/2 -translate-y-1/2 animate-spin text-[var(--brand-700)] pointer-events-none" />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BoothPetugasPage() {
  return (
    <RequireAuth>
      <BoothPetugasContent />
    </RequireAuth>
  );
}
