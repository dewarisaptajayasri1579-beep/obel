"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DateRangePicker, Select, Button } from "@/components/ui";

type Option = { value: string; label: string };

const ALL = "__all__";

/** Filter periode + toko/bisnis untuk halaman /laporan/* & Laba Rugi — server-driven lewat
 *  query params (?from=&to=&storeId=&businessTypeId=), bukan client-fetch, konsisten dengan
 *  pola server component + prisma langsung yang dipakai semua halaman list lain.
 *
 *  `areaId`/`salesId` ditambah untuk Map Kunjungan (Tahap 25) — pola yang sama persis, tinggal
 *  dua pasang prop baru, bukan komponen filter terpisah. */
export const ReportFilterBar: React.FC<{
  from?: string;
  to?: string;
  storeId?: string;
  businessTypeId?: string;
  supplierId?: string;
  status?: string;
  areaId?: string;
  salesId?: string;
  storeOptions?: Option[];
  businessTypeOptions?: Option[];
  supplierOptions?: Option[];
  statusOptions?: Option[];
  areaOptions?: Option[];
  salesOptions?: Option[];
  /** Ukuran padat — menyamakan tinggi isian & tombol dengan form Purchase Order (34px, teks 12px,
   *  label 11px). Dipakai saat bilah ini duduk DI DALAM halaman kerja yang isiannya sudah padat
   *  (mis. tab Ranking di halaman Produk), bukan di halaman laporan yang berdiri sendiri —
   *  di sana ukuran besar memang disengaja karena filter itulah isi utama layarnya. */
  compact?: boolean;
}> = ({
  from,
  to,
  storeId,
  businessTypeId,
  supplierId,
  status,
  areaId,
  salesId,
  storeOptions,
  businessTypeOptions,
  supplierOptions,
  statusOptions,
  areaOptions,
  salesOptions,
  compact = false,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [fromVal, setFromVal] = useState(from ?? "");
  const [toVal, setToVal] = useState(to ?? "");
  const [storeVal, setStoreVal] = useState(storeId ?? ALL);
  const [businessVal, setBusinessVal] = useState(businessTypeId ?? ALL);
  const [supplierVal, setSupplierVal] = useState(supplierId ?? ALL);
  const [statusVal, setStatusVal] = useState(status ?? ALL);
  const [areaVal, setAreaVal] = useState(areaId ?? ALL);
  const [salesVal, setSalesVal] = useState(salesId ?? ALL);

  const apply = () => {
    // Dimulai dari query yang SEDANG berlaku, bukan dari nol — supaya parameter yang bukan
    // urusan bilah ini ikut terbawa. Contoh nyatanya `?tab=` di halaman Produk (Tahap 23):
    // kalau dibuang, mengganti periode di dalam sebuah tab melempar pemakainya balik ke tab
    // pertama. Yang dikelola bilah ini tetap ditimpa/dihapus tegas di bawah.
    const params = new URLSearchParams(searchParams.toString());
    const aturParam = (kunci: string, nilai: string, aktif: boolean) => (aktif ? params.set(kunci, nilai) : params.delete(kunci));

    if (from !== undefined) params.set("from", fromVal);
    if (to !== undefined) params.set("to", toVal);
    aturParam("storeId", storeVal, storeVal !== ALL);
    aturParam("businessTypeId", businessVal, businessVal !== ALL);
    aturParam("supplierId", supplierVal, supplierVal !== ALL);
    aturParam("status", statusVal, statusVal !== ALL);
    aturParam("areaId", areaVal, areaVal !== ALL);
    aturParam("salesId", salesVal, salesVal !== ALL);

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  // Nilainya disamakan PERSIS dengan COMPACT_FIELD/COMPACT_LABEL di PurchaseOrderForm — kalau
  // salah satunya diubah, ubah dua-duanya, kalau tidak dua halaman ini kembali beda tinggi baris.
  const fieldPadat = compact ? "!text-xs !h-8.5 !min-h-[34px] !rounded-lg" : "";
  const labelPadat = compact ? "text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none" : undefined;
  const lebarSelect = compact ? "w-44" : "w-48";

  return (
    <div className={`flex flex-wrap items-end ${compact ? "gap-2.5" : "gap-4"}`}>
      {from !== undefined && to !== undefined && (
        // Saat padat, pembungkus ini MENYUSUT MENGIKUTI ISI (`w-auto`), bukan dikunci lebar
        // tetap. Bawaan DateRangePicker `w-full` akan memakan seluruh lebar kartu kalau
        // dibiarkan, tapi mengunci lebarnya juga salah: dua kotak tanggal punya lebar minimum
        // bawaan (input `type=date` + ikon + padding), jadi kalau wadahnya lebih sempit dari itu
        // isinya MELUBER keluar dan menabrak isian di sebelahnya — bukan sekadar terlihat sempit.
        <div className={compact ? "w-auto max-w-full shrink-0" : "contents"}>
          {/* `className` DateRangePicker menempel ke PEMBUNGKUSNYA (label + dua kotak tanggal),
              bukan ke input-nya — memasang `!h-8.5` di sini memaksa wadah setinggi 34px padahal
              isinya dua baris, dan hasilnya barisnya melorot tidak sejajar dengan isian lain.
              Ukuran kotaknya cukup lewat `sizeVariant`. */}
          <DateRangePicker
            label="Periode"
            sizeVariant={compact ? "sm" : "lg"}
            labelClassName={labelPadat}
            inputClassName={compact ? "!h-8.5 !min-h-[34px] !text-xs !rounded-lg !pl-8" : ""}
            startDateProps={{ value: fromVal, onChange: (e) => setFromVal(e.target.value) }}
            endDateProps={{ value: toVal, onChange: (e) => setToVal(e.target.value) }}
          />
        </div>
      )}
      {storeOptions && (
        <div className={lebarSelect}>
          <Select
            label="Toko"
            options={[{ value: ALL, label: "Semua Toko" }, ...storeOptions]}
            value={storeVal}
            onChange={setStoreVal}
            sizeVariant={compact ? "sm" : "lg"}
            className={fieldPadat}
            labelClassName={labelPadat}
          />
        </div>
      )}
      {businessTypeOptions && (
        <div className={lebarSelect}>
          <Select
            label="Bisnis"
            options={[{ value: ALL, label: "Semua Bisnis" }, ...businessTypeOptions]}
            value={businessVal}
            onChange={setBusinessVal}
            sizeVariant={compact ? "sm" : "lg"}
            className={fieldPadat}
            labelClassName={labelPadat}
          />
        </div>
      )}
      {supplierOptions && (
        <div className={lebarSelect}>
          <Select
            label="Supplier"
            options={[{ value: ALL, label: "Semua Supplier" }, ...supplierOptions]}
            value={supplierVal}
            onChange={setSupplierVal}
            sizeVariant={compact ? "sm" : "lg"}
            className={fieldPadat}
            labelClassName={labelPadat}
          />
        </div>
      )}
      {statusOptions && (
        <div className={lebarSelect}>
          <Select
            label="Status"
            options={[{ value: ALL, label: "Semua Status" }, ...statusOptions]}
            value={statusVal}
            onChange={setStatusVal}
            sizeVariant={compact ? "sm" : "lg"}
            className={fieldPadat}
            labelClassName={labelPadat}
          />
        </div>
      )}
      {areaOptions && (
        <div className={lebarSelect}>
          <Select
            label="Area"
            options={[{ value: ALL, label: "Semua Area" }, ...areaOptions]}
            value={areaVal}
            onChange={setAreaVal}
            sizeVariant={compact ? "sm" : "lg"}
            className={fieldPadat}
            labelClassName={labelPadat}
          />
        </div>
      )}
      {salesOptions && (
        <div className={lebarSelect}>
          <Select
            label="Sales"
            options={[{ value: ALL, label: "Semua Sales" }, ...salesOptions]}
            value={salesVal}
            onChange={setSalesVal}
            sizeVariant={compact ? "sm" : "lg"}
            className={fieldPadat}
            labelClassName={labelPadat}
          />
        </div>
      )}
      {/* `!h-8.5` — ukuran "sm" bawaan Button 38px, dua piksel lebih tinggi dari isian di
          sebelahnya; tanpa ini tombolnya menonjol sendiri di baris yang seharusnya rata. */}
      <Button variant="primary" size={compact ? "sm" : "md"} className={compact ? "!h-8.5 !min-h-[34px]" : ""} onClick={apply}>
        Terapkan
      </Button>
    </div>
  );
};
