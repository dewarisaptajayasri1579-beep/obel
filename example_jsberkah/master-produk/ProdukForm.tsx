"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save, Check, X } from "lucide-react";
import { Input, Select, Autocomplete, CurrencyInput, Switch, Alert, useToast } from "@/components/ui";
import { useHotkey } from "@/hooks/useHotkey";
import { useFokusAwal } from "@/hooks/useFokusAwal";
import { nilaiAwalProduk, TANPA_SUPPLIER as NONE, type ProdukFormValues } from "./form-values";
import { FotoProdukInput } from "./FotoProdukInput";

type Option = { value: string; label: string };

// Field & label pemadat, disamakan dengan form PO baru (`PurchaseOrderForm`) — bawaan
// Input/Select/CurrencyInput sizeVariant="lg" (56px) terlalu tinggi untuk form isian panjang.
const COMPACT_FIELD = "!text-xs !h-8.5 !min-h-[34px] !rounded-lg !bg-white dark:!bg-surface shadow-2xs";
const COMPACT_LABEL = "text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none";

/** Form Master Produk — satu komponen untuk Tambah & Edit, dipakai dua halaman tersendiri
 *  (`/master/produk/baru`, `/master/produk/[id]/edit`), BUKAN modal seperti sebelumnya.
 *
 *  Alasannya bukan selera tampilan: dengan halaman tersendiri, daftar produk di belakangnya
 *  tetap punya URL sendiri (`?q=&bisnis=&status=&page=4`), jadi Back browser — dan tombol
 *  Batal/Simpan di sini lewat `kembali` — mengembalikan pemakai ke halaman 4 yang tadi
 *  ditinggalkan, bukan melempar balik ke halaman 1.
 *
 *  Keyboard-first mengikuti pola form PO: Enter = lompat ke field berikutnya (bukan submit
 *  diam-diam), Ctrl+S = simpan, Ctrl+Enter = simpan lalu lanjut mengisi produk berikutnya
 *  (hanya mode tambah), Esc = batal. */
export const ProdukForm: React.FC<{
  mode: "create" | "edit";
  initial: ProdukFormValues;
  businessTypes: Option[];
  suppliers: Option[];
  /** Ukuran yang sudah pernah dipakai produk lain (mis. "60ml", "30 ml") — jadi saran dropdown
   *  supaya penulisan ukuran yang sama tidak berbeda-beda ketikannya, tapi tetap bisa mengetik
   *  ukuran baru yang belum pernah ada (lihat komentar di `Autocomplete` pemakaiannya di bawah). */
  sizeOptions: string[];
  /** Querystring daftar yang ditinggalkan (mis. `q=abc&page=4`), tanpa tanda tanya. */
  back: string;
}> = ({ mode, initial, businessTypes, suppliers, sizeOptions, back }) => {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState<ProdukFormValues>(initial);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  useFokusAwal(formRef);

  const supplierOptions: Option[] = [{ value: NONE, label: "- Tidak ada -" }, ...suppliers];

  /** Satuan dibatasi ke dua pilihan yang benar-benar dipakai (permintaan Owner) — sebagai isian
   *  bebas, "pcs"/"PCS"/"Pcs" pernah masuk sebagai tiga satuan berbeda dan ikut terbawa ke nota.
   *  Satuan produk lama yang di luar daftar tetap ditambahkan sebagai pilihan supaya membuka
   *  form edit tidak diam-diam mengubah satuannya. */
  const opsiSatuan: Option[] = [
    { value: "pcs", label: "PCS" },
    { value: "dus", label: "Dus" },
    ...(initial.unit && !["pcs", "dus"].includes(initial.unit) ? [{ value: initial.unit, label: initial.unit }] : []),
  ];
  const kembali = `/master/produk${back ? `?${back}` : ""}`;

  const set = <K extends keyof ProdukFormValues>(key: K, value: ProdukFormValues[K]) => setForm((f) => ({ ...f, [key]: value }));

  /** Pindah fokus ke isian sesudah `dari`. Kalau sudah di isian terakhir, berarti pengisian
   *  memang sudah selesai — langsung disimpan. */
  const majuDari = (dari: HTMLElement) => {
    const wadah = formRef.current;
    if (!wadah) return;
    const bisaFokus = Array.from(
      wadah.querySelectorAll<HTMLElement>('input:not([type="hidden"]), textarea, [role="combobox"]'),
    ).filter((el) => !(el as HTMLInputElement).disabled && el.tabIndex !== -1 && el.offsetParent !== null);

    const posisi = bisaFokus.indexOf(dari);
    const berikutnya = posisi === -1 ? bisaFokus[0] : bisaFokus[posisi + 1];
    if (!berikutnya) {
      simpan();
      return;
    }
    berikutnya.focus();
    if (berikutnya instanceof HTMLInputElement && berikutnya.type !== "checkbox") berikutnya.select();
  };

  /** Dipanggil begitu satu opsi `Select` terpilih: fokusnya dilanjutkan ke isian berikutnya,
   *  jadi alurnya utuh — Enter membuka dropdown, panah atas/bawah memilih, Enter menutup pilihan
   *  DAN langsung pindah. Tanpa ini fokus nyangkut di trigger (dropdown-nya di-portal ke body,
   *  jadi begitu tertutup tidak ada yang memegang fokus) dan pemakai harus Tab manual.
   *
   *  Ditunda satu frame karena saat `onChange` dipanggil, panel dropdown-nya belum dilepas dari
   *  DOM — memfokuskan isian berikutnya sekarang akan langsung terebut balik. */
  const lanjutSetelahPilih = (namaField: string) => {
    requestAnimationFrame(() => {
      const trigger = formRef.current?.querySelector<HTMLElement>(`[data-field="${namaField}"] [role="combobox"]`);
      if (trigger) majuDari(trigger);
    });
  };

  /** Enter = maju satu isian, bukan submit. Di form master yang panjang, Enter yang langsung
   *  menyimpan berbahaya (kesenggol di tengah pengisian = tersimpan separuh), sementara
   *  pemakainya mengetik cepat tanpa melepas tangan dari keyboard.
   *
   *  KECUALI di `Select`: Enter di situ dibiarkan lewat supaya dropdown-nya TERBUKA (perilaku
   *  bawaan `Select`), bukan melompati pilihannya. Pindah ke isian berikutnya baru terjadi
   *  setelah ada opsi yang benar-benar dipilih — lihat `lanjutSetelahPilih`. */
  const enterMajuKeFieldBerikutnya = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const target = e.target as HTMLElement;

    // Panel dropdown `Select` memang di-portal ke `body`, TAPI event React tetap merambat lewat
    // pohon KOMPONEN, bukan pohon DOM — jadi Enter yang ditekan di dalam daftar pilihan tetap
    // sampai ke handler ini. Tanpa penjagaan ini, Enter yang sedang memilih opsi ikut dicegat,
    // pilihannya batal, dan karena elemen asalnya tidak ada di dalam form, fokusnya dilempar
    // balik ke isian pertama (Nama Produk).
    if (!formRef.current?.contains(target)) return;

    if (target.tagName === "TEXTAREA") return;
    if (target.getAttribute("role") === "combobox") return;

    e.preventDefault();
    e.stopPropagation();
    majuDari(target);
  };

  const validate = () => {
    setError("");
    if (!form.name.trim()) {
      setError("Nama produk wajib diisi");
      return false;
    }
    if (!form.businessTypeId) {
      setError("Bisnis wajib dipilih");
      return false;
    }
    if (!form.sellPrice) {
      setError("Harga jual toko wajib diisi");
      return false;
    }
    return true;
  };

  const simpan = async (lanjutIsiLagi = false) => {
    if (!validate()) return;

    // `code` sengaja TIDAK ikut dikirim: backend yang membuatkannya saat tambah (`PAR-0001`),
    // dan saat edit kode yang sudah terlanjur tercetak di dokumen tidak boleh berubah.
    const payload = {
      name: form.name.trim(),
      businessTypeId: form.businessTypeId,
      variant: form.variant,
      size: form.size,
      unit: form.unit,
      sellPrice: form.sellPrice,
      costPrice: form.costPrice,
      supplierId: form.supplierId === NONE ? "" : form.supplierId,
      consignmentPrice: form.consignmentPrice || undefined,
      minStock: form.minStock || undefined,
      photoUrl: form.photoUrl,
      isActive: form.isActive,
    };

    setSubmitting(true);
    try {
      const res =
        mode === "create"
          ? await fetch("/api/produk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
          : await fetch(`/api/produk/${initial.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Gagal menyimpan produk");
        return;
      }

      // Foto lama dilepas SETELAH penyimpanan berhasil, bukan saat foto barunya dipilih:
      // kalau dihapus di muka lalu formnya dibatalkan, catatan yang masih tersimpan berubah
      // jadi menunjuk berkas yang sudah tidak ada. Kegagalannya sengaja diabaikan — berkas
      // yatim yang tertinggal cuma memakan tempat, tidak mengubah data apa pun, dan tidak
      // sepadan kalau sampai menggagalkan penyimpanan yang sudah berhasil.
      const fotoLama = initial.photoUrl;
      if (fotoLama && fotoLama !== form.photoUrl) {
        fetch("/api/uploads", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: fotoLama }),
        }).catch(() => null);
      }

      // Kodenya dibaca dari jawaban server, bukan dari form — saat tambah, di formnya memang
      // belum ada kode apa-apa sampai backend membuatkannya.
      const kode = data?.product?.code ?? form.code;
      toast.success(mode === "create" ? `Produk ${kode} ditambahkan` : `Produk ${kode} diperbarui`);

      if (lanjutIsiLagi) {
        // Bisnis & supplier sengaja DIPERTAHANKAN: produk yang diinput berurutan hampir selalu
        // dari bisnis dan supplier yang sama — mengosongkannya cuma bikin dipilih ulang tiap baris.
        setForm((f) => ({ ...nilaiAwalProduk(f.businessTypeId), supplierId: f.supplierId, unit: f.unit }));
        router.refresh();
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>("input")?.focus());
        return;
      }

      router.push(kembali);
      router.refresh();
    } catch {
      setError("Gagal menghubungi server");
    } finally {
      setSubmitting(false);
    }
  };

  useHotkey({ key: "s", ctrl: true, allowInEditable: true }, () => simpan(false));
  useHotkey({ key: "Enter", ctrl: true, allowInEditable: true }, () => simpan(mode === "create"));
  useHotkey({ key: "Escape", allowInEditable: true }, () => {
    // Esc saat dropdown pilihan terbuka artinya "batal memilih", bukan "batal mengisi form" —
    // biarkan `Select` yang menanganinya, jangan sampai satu Esc malah melempar keluar halaman.
    if (document.querySelector('[role="combobox"][aria-expanded="true"]')) return;
    router.push(kembali);
  });

  return (
    <div ref={formRef} data-isian-form onKeyDownCapture={enterMajuKeFieldBerikutnya} className="space-y-5">
      {error && (
        <Alert variant="error" onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Urutan isian mengikuti cara Owner mendiktekan produk: identitas dulu (kode, nama,
          bisnis), lalu ciri fisiknya (varian, ukuran, satuan), baru angka. Urutan DOM di sini
          sekaligus urutan Enter/Tab — jadi susunannya tidak boleh diubah cuma demi kerapian
          grid. "Kategori" dihapus (permintaan Owner): isinya selalu sama dengan Bisnis, dua
          isian yang selalu berisi hal yang sama cuma menambah satu tempat untuk salah ketik.
          Kolomnya dibiarkan ada di database dan TIDAK ikut dikirim saat menyimpan, jadi data
          lama yang sudah terisi tidak ikut terhapus. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Kode produk dibuat backend (`PAR-0001`), jadi di sini cuma dipajang — bukan Input
            yang dinonaktifkan, karena isian abu-abu yang tidak bisa diketik selalu terbaca
            sebagai "rusak" atau "belum boleh diisi", padahal memang bukan urusan pemakai. */}
        <div className="w-full flex flex-col gap-1.5">
          <span className={COMPACT_LABEL}>Kode Produk</span>
          <div className="h-8.5 min-h-[34px] px-3 rounded-lg border border-dashed border-slate-300/90 dark:border-line bg-slate-50/70 dark:bg-surface-hover/40 flex items-center">
            {mode === "edit" ? (
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-fg-secondary">{form.code}</span>
            ) : (
              <span className="text-xs italic text-slate-400 dark:text-fg-muted">Otomatis saat disimpan</span>
            )}
          </div>
        </div>
        <Input
          label="Nama Produk"
          data-fokus-awal
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="mis. Parfum Sensual 60ml"
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div data-field="bisnis">
          <Select
            label="Bisnis"
            options={businessTypes}
            value={form.businessTypeId}
            onChange={(v) => {
              set("businessTypeId", v);
              lanjutSetelahPilih("bisnis");
            }}
            placeholder="Pilih bisnis"
            sizeVariant="sm"
            className={COMPACT_FIELD}
            labelClassName={COMPACT_LABEL}
          />
        </div>
        <Input label="Varian" value={form.variant} onChange={(e) => set("variant", e.target.value)} sizeVariant="sm" className={COMPACT_FIELD} labelClassName={COMPACT_LABEL} />
        {/* Ukuran dulunya isian bebas murni — sekarang tetap bisa diketik bebas (ukuran baru
            selalu boleh ada), TAPI menyarankan ukuran yang sudah pernah dipakai produk lain
            (`sizeOptions`, dikumpulkan dari seluruh produk) supaya "60ml"/"60 ml"/"60ML" tidak
            ikut bercampur jadi tiga ukuran berbeda cuma karena beda cara ketik. */}
        <Autocomplete
          label="Ukuran"
          value={form.size}
          onChange={(v) => set("size", v)}
          suggestions={sizeOptions}
          placeholder="mis. 60ml"
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div data-field="satuan">
          <Select
            label="Satuan"
            options={opsiSatuan}
            value={form.unit}
            onChange={(v) => {
              set("unit", v);
              lanjutSetelahPilih("satuan");
            }}
            searchable={false}
            sizeVariant="sm"
            className={COMPACT_FIELD}
            labelClassName={COMPACT_LABEL}
          />
        </div>
        {/* "Harga Jual Toko" = kolom `sellPrice` yang memang sudah dipakai menagih toko saat
            stock opname (`tagihan = qty terjual x sellPrice`) — cuma namanya yang diperjelas,
            angkanya tidak dipindah ke mana-mana. */}
        <CurrencyInput label="Harga Jual Toko" value={form.sellPrice} onChange={(v) => set("sellPrice", v)} sizeVariant="sm" className={COMPACT_FIELD} labelClassName={COMPACT_LABEL} />
        {/* "Harga Jual Customer" memakai ulang kolom `consignmentPrice` (dulu "Harga Konsinyasi",
            ditambahkan Tahap 1 tapi tidak pernah dipakai perhitungan apa pun) — harga eceran yang
            dipajang toko ke pembeli akhir. Dipakai ulang, bukan bikin kolom baru: menambah kolom
            berarti migrasi DB untuk sesuatu yang sudah ada tempatnya dan kosong. */}
        <CurrencyInput
          label="Harga Jual Customer"
          value={form.consignmentPrice}
          onChange={(v) => set("consignmentPrice", v)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Input
          label="Stok Minimum (opsional)"
          type="number"
          value={String(form.minStock)}
          onChange={(e) => set("minStock", Number(e.target.value) || 0)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
        {/* Harga Beli tidak ada di urutan yang didiktekan Owner, tapi kolomnya
            dipakai harga acuan PO, hitungan margin di Analisa, dan nilai persediaan di Neraca —
            jadi ditaruh di baris pelengkap paling bawah, bukan dihapus. */}
        <CurrencyInput
          label="Harga Beli (opsional)"
          value={form.costPrice}
          onChange={(v) => set("costPrice", v)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
        <div data-field="supplier">
          <Select
            label="Supplier (opsional)"
            options={supplierOptions}
            value={form.supplierId}
            onChange={(v) => {
              set("supplierId", v);
              lanjutSetelahPilih("supplier");
            }}
            sizeVariant="sm"
            className={COMPACT_FIELD}
            labelClassName={COMPACT_LABEL}
          />
        </div>
      </div>

      <FotoProdukInput value={form.photoUrl} onChange={(url) => set("photoUrl", url)} urlTersimpan={initial.photoUrl} labelClassName={COMPACT_LABEL} />

      <Switch label="Produk aktif (bisa dipakai di transaksi)" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />

      <div className="border-t border-slate-200/60 dark:border-line pt-4 space-y-2.5">
        <p className="text-[11px] text-slate-500 dark:text-fg-muted">
          Enter untuk lompat ke isian berikutnya — di isian pilihan, Enter membuka daftarnya (panah ↑↓ untuk memilih) · Esc untuk batal
        </p>
        {/* Tombol dirapatkan ke kanan, sebaris dengan tombol aksi di halaman lain (form PO,
            daftar) — keterangan pintasan naik ke barisnya sendiri supaya tidak menahan tombolnya
            di tengah saat layarnya sempit. */}
        <div className="flex items-center justify-end gap-2">
          <Link
            href={kembali}
            className="px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-line bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg font-medium text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Batal</span>
            <span className="text-[9px] font-mono opacity-80 font-normal">(Esc)</span>
          </Link>

          {mode === "create" && (
            <button
              type="button"
              onClick={() => simpan(true)}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-lg border border-[#0544cc] bg-white dark:bg-surface hover:bg-blue-50 dark:hover:bg-blue-950/30 text-[#0544cc] dark:text-blue-400 font-semibold text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan &amp; Tambah Lagi</span>
              <span className="text-[9px] font-mono opacity-80 font-normal">(Ctrl+Enter)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => simpan(false)}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg bg-[#0544cc] hover:bg-[#043aa8] text-white font-semibold text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{submitting ? "Menyimpan..." : "Simpan"}</span>
            <span className="text-[9px] font-mono opacity-80 font-normal">(Ctrl+S)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
