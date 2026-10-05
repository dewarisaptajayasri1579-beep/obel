"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { AbsenScreen } from "../_components/AbsenScreen";
import { RequireActiveShift, useActiveShift } from "../_components/RequireActiveShift";

/// Absen Tiba di Booth (titik 2 dari 4, BR-042) — wajib sebelum Check-Out.
function TibaContent() {
  const shift = useActiveShift();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (shift.arrivedAt) router.replace("/petugas");
  }, [shift.arrivedAt, router]);

  return (
    <AbsenScreen
      title="Absen Tiba di Booth"
      subtitle={`Absen begitu sampai di ${shift.booth.name}.`}
      tempat="booth"
      submitLabel="KONFIRMASI TIBA"
      onSubmit={async (absen) => {
        await api.arriveAtBooth(shift.shiftSessionId, absen);
        toast.success("Absen Tiba berhasil.");
        router.replace("/petugas");
      }}
    />
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
