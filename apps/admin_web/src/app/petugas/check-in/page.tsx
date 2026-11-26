"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type Booth, type ShiftTemplate } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { AbsenScreen } from "../_components/AbsenScreen";
import { formatRupiah } from "../_lib/format";
import { startGpsTracking } from "../_lib/native-bridge";
import { OBBEL } from "../_lib/theme";

const GREEN = OBBEL.primaryDark;

type Option = { id: string; label: string };

/// Dropdown inline seperti pemilih booth di Absen Tiba. `defaultId` = pilihan dari jadwal (roster).
function ChoicePicker({
  options,
  value,
  defaultId,
  placeholder,
  onChange,
}: {
  options: Option[];
  value: string;
  defaultId?: string;
  placeholder: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold text-slate-800"
      >
        <span className={selected ? undefined : "text-slate-400 font-medium"}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={16} className="text-slate-400" />
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between text-left px-4 py-3 text-base hover:bg-slate-50"
              style={o.id === value ? { color: GREEN, fontWeight: 700 } : undefined}
            >
              {o.label}
              {o.id === defaultId && <span className="text-sm font-medium text-slate-400">Jadwal</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const formatTime = (hhmm: string) => hhmm.replace(":", ".");

/// Absen Berangkat di Gudang (titik 1 dari 4, BR-042) — membuka shift di booth & shift pilihan Barista,
/// bawaannya jadwal (roster); Barista tanpa jadwal memilih sendiri. Terima Stok langsung bisa dipakai
/// untuk booth itu, uang jalan booth dicatat di shift (BR-043). Booth masih bisa diganti saat Absen Tiba;
/// Kasir baru bisa dipakai setelah itu.
function CheckInContent() {
  const { session, loading: authLoading, updateToken } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loadingInit, setLoadingInit] = useState(true);
  const [booths, setBooths] = useState<Booth[]>([]);
  const [shifts, setShifts] = useState<ShiftTemplate[]>([]);
  const [defaultBoothId, setDefaultBoothId] = useState<string>();
  const [defaultShiftId, setDefaultShiftId] = useState<string>();
  const [boothId, setBoothId] = useState("");
  const [shiftTemplateId, setShiftTemplateId] = useState("");

  useEffect(() => {
    if (authLoading || !session) return;
    if (session.profile.role !== "BOOTH_STAFF") {
      router.replace("/dashboard");
      return;
    }

    (async () => {
      try {
        // Kalau sudah ada shift aktif, tidak perlu Berangkat lagi.
        try {
          await api.getActiveShift();
          router.replace("/petugas");
          return;
        } catch {
          // 404 (belum ada shift aktif) = kondisi normal, lanjut ke form.
        }
        // Shift sebelumnya belum absen Kembali → itu dulu (Berangkat akan ditolak).
        if (await api.getPendingReturn()) {
          router.replace("/petugas/kembali");
          return;
        }
        // Shift bawaan = shift berikutnya kalau hari ini sudah selesai satu shift, selain itu jadwal.
        const [roster, nextShift, allBooths, allShifts] = await Promise.all([
          api.getMyAssignment(),
          api.getNextShiftTemplate(),
          api.getBooths(),
          api.getShiftTemplates(),
        ]);
        setBooths(allBooths.filter((b) => b.status === "ACTIVE"));
        setShifts(allShifts.filter((t) => t.active).sort((a, b) => a.startTime.localeCompare(b.startTime)));
        setDefaultBoothId(roster?.boothId);
        setDefaultShiftId(nextShift?.id);
        setBoothId(roster?.boothId ?? "");
        setShiftTemplateId(nextShift?.id ?? "");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Gagal memuat data Absen Berangkat.");
      } finally {
        setLoadingInit(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session]);

  if (authLoading || loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9F6] max-w-md mx-auto">
        <Spinner />
      </div>
    );
  }

  const uangJalan = booths.find((b) => b.id === boothId)?.cashFloat ?? 0;

  return (
    <AbsenScreen
      title="Absen Berangkat"
      subtitle="Absen di Gudang sebelum berangkat ke booth."
      tempat="gudang"
      submitLabel="KONFIRMASI BERANGKAT"
      canSubmit={!!boothId && !!shiftTemplateId}
      onSubmit={async (absen) => {
        const result = await api.checkIn({ ...absen, boothId, shiftTemplateId });
        if (result.accessToken) updateToken(result.accessToken);
        startGpsTracking(result.shiftSessionId);
        toast.success("Absen Berangkat berhasil. Selamat bekerja!");
        router.replace("/petugas");
      }}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-base font-bold text-slate-800 mb-2">Konfirmasi Data Anda</p>
        <div className="text-base text-slate-600 flex flex-col gap-3">
          <div className="flex justify-between">
            <span className="text-slate-400">Nama</span>
            <span className="font-semibold text-slate-800">{session?.profile.fullName}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-slate-400">Booth</span>
            <ChoicePicker
              options={booths.map((b) => ({ id: b.id, label: b.name }))}
              value={boothId}
              defaultId={defaultBoothId}
              placeholder="Pilih booth"
              onChange={setBoothId}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-slate-400">Shift</span>
            <ChoicePicker
              options={shifts.map((t) => ({ id: t.id, label: `${t.name} ${formatTime(t.startTime)}-${formatTime(t.endTime)}` }))}
              value={shiftTemplateId}
              defaultId={defaultShiftId}
              placeholder="Pilih shift"
              onChange={setShiftTemplateId}
            />
          </div>
          {uangJalan > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">Uang jalan</span>
              <span className="font-semibold text-slate-800">{formatRupiah(uangJalan)}</span>
            </div>
          )}
        </div>
        {uangJalan > 0 && (
          <p className="text-sm text-slate-500 mt-2">Terima uang jalan dari Admin; dikembalikan utuh saat absen Kembali.</p>
        )}
      </div>
    </AbsenScreen>
  );
}

/// Dibungkus RequirePetugasAuth seperti halaman petugas lain: AbsenScreen menyembunyikan bottom nav lewat
/// konteks PetugasShell, dan tanpa shell-nya layar ini langsung error.
export default function CheckInPage() {
  return (
    <RequirePetugasAuth>
      <CheckInContent />
    </RequirePetugasAuth>
  );
}
