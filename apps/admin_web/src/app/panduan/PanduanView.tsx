"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AlurHarianView } from "./AlurHarianView";
import { DaftarLayar } from "./DaftarLayar";
import { LayarPanduanView } from "./LayarPanduanView";
import { SEMUA_LAYAR, cariLayar } from "./konten";

/// Panduan Pengguna. Layar yang dibuka disimpan di ?layar=<kode> supaya bisa dibagikan dan
/// tombol Back browser kembali ke layar sebelumnya; kode tak dikenal membuka Alur Harian.
export function PanduanView() {
  const router = useRouter();
  const layar = cariLayar(useSearchParams().get("layar"));
  const indeks = layar ? SEMUA_LAYAR.indexOf(layar) : -1;

  const pilih = (kode: string | null) => {
    router.push(kode ? `/panduan?layar=${kode}` : "/panduan", { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-fg">Panduan Pengguna</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted">Cara memakai setiap layar Obbel, untuk Admin, Owner, dan Barista.</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <DaftarLayar aktif={layar?.kode ?? null} onPilih={pilih} />
        <div className="min-w-0 flex-1">
          {layar ? (
            <LayarPanduanView layar={layar} sebelum={SEMUA_LAYAR[indeks - 1]} sesudah={SEMUA_LAYAR[indeks + 1]} onPilih={pilih} />
          ) : (
            <AlurHarianView onPilih={pilih} />
          )}
        </div>
      </div>
    </div>
  );
}
