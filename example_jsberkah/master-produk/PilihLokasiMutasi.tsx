"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";
import { JUDUL_LOKASI, type JenisLokasi } from "./[id]/stok/stok-labels";

// Label ringkas ("Sales", bukan "Dibawa Sales") — `JUDUL_LOKASI` dipakai persis sebagai judul
// tabel/opsi Jenis Lokasi (kalimat lengkap wajar di situ), tapi kepanjangan kalau dipakai sebagai
// label/placeholder pemilih entitasnya sendiri ("Pilih dibawa sales" janggal).
const LABEL_ENTITAS: Record<JenisLokasi, string> = { WAREHOUSE: "Gudang", SALES: "Sales", STORE: "Toko" };

const JENIS_OPTIONS = (Object.keys(JUDUL_LOKASI) as JenisLokasi[]).map((tipe) => ({ value: tipe, label: JUDUL_LOKASI[tipe] }));

/** Dua pemilih berantai untuk sub-tab Rinci → Riwayat Keluar-Masuk: Jenis Lokasi (Gudang/Sales/
 *  Toko) dulu, baru lokasi spesifiknya (opsi berubah sesuai jenis yang dipilih). Ganti Jenis
 *  Lokasi otomatis mengosongkan `lokasiId` lama — entitas gudang tidak valid lagi begitu jenisnya
 *  pindah ke Sales, jadi jangan dibiarkan nyangkut.
 *
 *  Navigasi beneran (`router.push`), sama seperti `PilihProduk.tsx`: riwayatnya ditarik server per
 *  lokasi, jadi ganti pilihan memang harus menarik ulang data. */
export function PilihLokasiMutasi({
  lokasiTipe,
  lokasiId,
  gudangOptions,
  salesOptions,
  tokoOptions,
}: {
  lokasiTipe: string;
  lokasiId: string;
  gudangOptions: { value: string; label: string }[];
  salesOptions: { value: string; label: string }[];
  tokoOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const entitasOptions = lokasiTipe === "WAREHOUSE" ? gudangOptions : lokasiTipe === "SALES" ? salesOptions : lokasiTipe === "STORE" ? tokoOptions : [];
  const labelEntitas = lokasiTipe ? LABEL_ENTITAS[lokasiTipe as JenisLokasi] : "Lokasi";

  const gantiJenis = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lokasiTipe", next);
    params.delete("lokasiId");
    router.push(`${pathname}?${params.toString()}`);
  };

  const gantiEntitas = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("lokasiId", next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <>
      <div className="w-[200px] max-w-full">
        <Select
          label="Jenis Lokasi"
          options={JENIS_OPTIONS}
          value={lokasiTipe}
          onChange={gantiJenis}
          placeholder="Pilih jenis lokasi"
          sizeVariant="sm"
          className="!text-xs !h-8.5 !min-h-[34px] !rounded-lg"
          labelClassName="text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none"
        />
      </div>
      {lokasiTipe && (
        <div className="w-[260px] max-w-full">
          <Select
            label={labelEntitas}
            options={entitasOptions}
            value={lokasiId}
            onChange={gantiEntitas}
            placeholder={`Pilih ${labelEntitas.toLowerCase()}`}
            sizeVariant="sm"
            className="!text-xs !h-8.5 !min-h-[34px] !rounded-lg"
            labelClassName="text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none"
          />
        </div>
      )}
    </>
  );
}
