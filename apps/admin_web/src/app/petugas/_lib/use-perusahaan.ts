"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { APP_CONFIG } from "@/lib/app-config";
import type { Perusahaan } from "./receipt";

/// Identitas untuk header struk, dari Profil Perusahaan. Selama belum termuat (atau kalau gagal dimuat)
/// dipakai nama aplikasi, jadi struk tetap bisa dicetak dan tidak pernah tanpa judul.
export function usePerusahaan(): Perusahaan {
  const [perusahaan, setPerusahaan] = useState<Perusahaan>({ nama: `${APP_CONFIG.name} ${APP_CONFIG.tagline}` });

  useEffect(() => {
    api
      .getCompanyProfile()
      .then((p) => setPerusahaan({ nama: p.name, alamat: p.address, telepon: p.phone }))
      .catch(() => {});
  }, []);

  return perusahaan;
}
