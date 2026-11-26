"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Store } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, type Booth } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { AbsenScreen } from "../_components/AbsenScreen";
import { RequireActiveShift, useActiveShift } from "../_components/RequireActiveShift";
import { OBBEL } from "../_lib/theme";

const GREEN = OBBEL.primaryDark;

/// Absen Tiba di Booth (titik 2 dari 4, BR-042) — wajib sebelum Kasir dan Check-Out. Barista
/// memilih booth tempat bertugas; booth pilihan saat Berangkat terpilih otomatis. Memilih booth lain minta
/// konfirmasi, karena stok yang dibawa ikut dipindahkan ke booth itu.
function TibaContent() {
  const shift = useActiveShift();
  const { updateToken } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [booths, setBooths] = useState<Booth[]>([]);
  const [boothId, setBoothId] = useState(shift.booth.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calon, setCalon] = useState<Booth | null>(null);

  useEffect(() => {
    if (shift.arrivedAt) router.replace("/petugas");
  }, [shift.arrivedAt, router]);

  useEffect(() => {
    api
      .getBooths()
      .then((all) => setBooths(all.filter((b) => b.status === "ACTIVE")))
      .catch(() => {});
  }, []);

  const jadwal = shift.booth;
  const dipilih = booths.find((b) => b.id === boothId) ?? jadwal;

  function pilih(booth: Booth) {
    setPickerOpen(false);
    if (booth.id === jadwal.id) setBoothId(booth.id);
    else setCalon(booth);
  }

  return (
    <>
      <AbsenScreen
        title="Absen Tiba di Booth"
        subtitle="Pilih booth tempat Anda bertugas, lalu absen di sana."
        tempat="booth"
        submitLabel="KONFIRMASI TIBA"
        before={
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <Store size={16} style={{ color: GREEN }} />
              <span className="text-base font-bold text-slate-800">Booth</span>
            </div>
            <p className="text-sm text-slate-500 mb-3">Booth saat Berangkat: {jadwal.name}.</p>

            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="w-full flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-base font-semibold text-slate-800"
            >
              {dipilih.name}
              <ChevronDown size={16} className="text-slate-400" />
            </button>

            {pickerOpen && (
              <div className="mt-2 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {booths.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => pilih(b)}
                    className="w-full flex items-center justify-between text-left px-4 py-3 text-base hover:bg-slate-50"
                    style={b.id === boothId ? { color: GREEN, fontWeight: 700 } : undefined}
                  >
                    {b.name}
                    {b.id === jadwal.id && <span className="text-sm font-medium text-slate-400">Berangkat</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
        onSubmit={async (absen) => {
          const result = await api.arriveAtBooth(shift.shiftSessionId, { ...absen, ...(boothId !== jadwal.id ? { boothId } : {}) });
          if (result.accessToken) updateToken(result.accessToken);
          toast.success("Absen Tiba berhasil.");
          router.replace("/petugas");
        }}
      />

      {calon && (
        <div className="fixed inset-0 bg-black/40 z-30 flex items-end">
          <div className="w-full max-w-md mx-auto bg-white rounded-t-[28px] p-5 flex flex-col gap-4">
            <p className="font-extrabold text-lg text-slate-900">Absen di booth lain?</p>
            <p className="text-base text-slate-600">
              Anda berangkat untuk {jadwal.name}. Yakin absen di {calon.name}? Stok yang Anda bawa ikut dipindahkan ke {calon.name}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setCalon(null)} className="rounded-xl border border-slate-200 py-3.5 font-bold text-slate-700">
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setBoothId(calon.id);
                  setCalon(null);
                }}
                className="rounded-xl py-3.5 font-extrabold text-white"
                style={{ backgroundColor: GREEN }}
              >
                Ya, Pindah
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function TibaPage() {
  return (
    <RequirePetugasAuth>
      <RequireActiveShift title="Absen Tiba">
        <TibaContent />
      </RequireActiveShift>
    </RequirePetugasAuth>
  );
}
