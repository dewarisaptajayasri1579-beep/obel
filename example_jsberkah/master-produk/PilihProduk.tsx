"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

/** Pemilih produk untuk tab yang isinya menyoroti SATU produk (Sebaran, nanti Mutasi Stok).
 *
 *  Navigasi beneran (`router.push`), bukan `replaceState` seperti pemindah tab: angkanya
 *  dihitung server per produk, jadi mengganti pilihan memang harus menarik ulang data. Parameter
 *  lain di URL (`tab`, `from`, `to`) sengaja dipertahankan — kalau dibuang, mengganti produk
 *  melempar pemakainya balik ke tab pertama dan periode kembali ke bawaan. */
export function PilihProduk({
  produkId,
  options,
  label = "Produk",
}: {
  produkId: string;
  options: { value: string; label: string }[];
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pilih = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("produkId", next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="w-[420px] max-w-full">
      <Select
        label={label}
        options={options}
        value={produkId}
        onChange={pilih}
        sizeVariant="sm"
        className="!text-xs !h-8.5 !min-h-[34px] !rounded-lg"
        labelClassName="text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none"
      />
    </div>
  );
}
