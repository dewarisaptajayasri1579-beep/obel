"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Save, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useHotkey } from "@/hooks/useHotkey";
import { useFokusAwal } from "@/hooks/useFokusAwal";
import { api, ApiError } from "@/lib/api-client";
import { nilaiAwalProduk, type ProdukFormValues } from "./form-values";
import { FotoProdukInput } from "./FotoProdukInput";

type Option = { value: string; label: string };

// Field & label pemadat — bawaan Input/Select/CurrencyInput sizeVariant="lg"
// (56px) terlalu tinggi untuk form isian panjang.
const COMPACT_FIELD = "!text-xs !h-8.5 !min-h-[34px] !rounded-lg !bg-white dark:!bg-surface shadow-2xs";
const COMPACT_LABEL = "text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none";

/// Form Produk — satu komponen untuk Tambah & Edit, dipakai dua halaman
/// tersendiri (`/master/produk/baru`, `/master/produk/[id]/edit`), BUKAN modal.
///
/// Alasannya bukan selera tampilan: dengan halaman tersendiri, daftar produk di
/// belakangnya tetap punya URL sendiri (`?q=&kategori=&status=&page=4`), jadi
/// Back browser — dan tombol Batal/Simpan di sini lewat `kembali` —
/// mengembalikan pemakai ke halaman 4 yang tadi ditinggalkan, bukan melempar
/// balik ke halaman 1.
///
/// Keyboard-first: Enter = lompat ke isian berikutnya (bukan submit diam-diam),
/// Ctrl+S = simpan, Ctrl+Enter = simpan lalu lanjut mengisi produk berikutnya
/// (hanya mode tambah), Esc = batal.
export const ProdukForm: React.FC<{
  mode: "create" | "edit";
  initial: ProdukFormValues;
  categories: Option[];
  /** Querystring daftar yang ditinggalkan (mis. `q=abc&page=4`), tanpa tanda tanya. */
  back: string;
}> = ({ mode, initial, categories, back }) => {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState<ProdukFormValues>(initial);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Salinan lokal `categories` supaya kategori yang baru ditambahkan lewat
  // Select (lihat `onCreateOption` di bawah) langsung muncul di daftar
  // pilihan tanpa menunggu reload dari halaman induk.
  //
  // Digabung, BUKAN ditimpa: `categories` dari halaman induk adalah array baru
  // di setiap render-nya (`categories.map(...)` inline), jadi effect ini bisa
  // saja terpicu ulang oleh render tak terkait (mis. toast sukses tampil)
  // SESUDAH kategori baru ditambahkan — menimpa langsung akan membuang
  // kategori yang baru saja dipilih walau `form.categoryId` sudah terlanjur
  // mengarah ke situ.
  const [opsiKategori, setOpsiKategori] = useState<Option[]>(categories);
  useEffect(() => {
    setOpsiKategori((prev) => {
      const sudahAda = new Set(prev.map((o) => o.value));
      const tambahan = categories.filter((c) => !sudahAda.has(c.value));
      return tambahan.length ? [...prev, ...tambahan] : prev;
    });
  }, [categories]);

  const formRef = useRef<HTMLDivElement>(null);
  useFokusAwal(formRef);

  const kembali = `/master/produk${back ? `?${back}` : ""}`;

  const set = <K extends keyof ProdukFormValues>(key: K, value: ProdukFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /// Pindah fokus ke isian sesudah `dari`. Kalau sudah di isian terakhir,
  /// berarti pengisian memang sudah selesai — langsung disimpan.
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

  /// Dipanggil begitu satu opsi `Select` terpilih: fokusnya dilanjutkan ke isian
  /// berikutnya, jadi alurnya utuh — Enter membuka dropdown, panah atas/bawah
  /// memilih, Enter menutup pilihan DAN langsung pindah. Ditunda satu frame
  /// karena saat `onChange` dipanggil, panel dropdown-nya belum dilepas dari DOM.
  const lanjutSetelahPilih = (namaField: string) => {
    requestAnimationFrame(() => {
      const trigger = formRef.current?.querySelector<HTMLElement>(`[data-field="${namaField}"] [role="combobox"]`);
      if (trigger) majuDari(trigger);
    });
  };

  /// Enter = maju satu isian, bukan submit. Di form master, Enter yang langsung
  /// menyimpan berbahaya (kesenggol di tengah pengisian = tersimpan separuh).
  /// KECUALI di `Select`: Enter di situ dibiarkan lewat supaya dropdown-nya
  /// TERBUKA; pindah isian baru terjadi setelah ada opsi yang benar-benar dipilih.
  const enterMajuKeFieldBerikutnya = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const target = e.target as HTMLElement;

    // Panel dropdown `Select` di-portal ke `body`, TAPI event React tetap
    // merambat lewat pohon KOMPONEN — jadi Enter yang ditekan di dalam daftar
    // pilihan tetap sampai ke sini. Tanpa penjagaan ini, pilihannya batal dan
    // fokus dilempar balik ke isian pertama.
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
      setError("Nama barang wajib diisi");
      return false;
    }
    if (!form.sellPrice) {
      setError("Harga jual wajib diisi");
      return false;
    }
    return true;
  };

  const simpan = async (lanjutIsiLagi = false) => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (mode === "create") {
        // `sku` sengaja TIDAK dikirim: backend yang membuatkannya (`OBL-0001`).
        const dibuat = await api.createProduct({
          name: form.name.trim(),
          categoryId: form.categoryId || undefined,
          sellPrice: form.sellPrice,
          imageUrl: form.imageUrl || undefined,
        });
        toast.success(`Produk ${dibuat.sku} ditambahkan`);
      } else {
        // `sku` sengaja TIDAK ikut dikirim saat edit: kode yang sudah terlanjur
        // tercetak di nota dan tercatat di riwayat mutasi tidak boleh berubah.
        await api.updateProduct(form.id, {
          name: form.name.trim(),
          categoryId: form.categoryId || undefined,
          sellPrice: form.sellPrice,
          active: form.isActive,
          imageUrl: form.imageUrl || null,
        });
        toast.success(`Produk ${form.sku} diperbarui`);
      }

      if (lanjutIsiLagi) {
        // Kategori sengaja DIPERTAHANKAN: produk yang diinput berurutan hampir
        // selalu dari kategori yang sama.
        setForm((f) => nilaiAwalProduk(f.categoryId));
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>("input")?.focus());
        return;
      }

      router.push(kembali);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan produk");
    } finally {
      setSubmitting(false);
    }
  };

  useHotkey({ key: "s", ctrl: true, allowInEditable: true }, () => simpan(false));
  useHotkey({ key: "Enter", ctrl: true, allowInEditable: true }, () => simpan(mode === "create"));
  useHotkey({ key: "Escape", allowInEditable: true }, () => {
    // Esc saat dropdown pilihan terbuka artinya "batal memilih", bukan "batal
    // mengisi form" — biarkan `Select` yang menanganinya.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Saat edit, kode dipajang — bukan Input yang dinonaktifkan, karena
            isian abu-abu yang tidak bisa diketik selalu terbaca sebagai "rusak"
            atau "belum boleh diisi", padahal memang bukan urusan pemakai.
            Saat tambah, kode diketik sendiri: backend Obbel tidak membuatkannya. */}
        <div className="w-full flex flex-col gap-1.5">
          <span className={COMPACT_LABEL}>Kode Barang</span>
          <div className="h-8.5 min-h-[34px] px-3 rounded-lg border border-dashed border-slate-300/90 dark:border-line bg-slate-50/70 dark:bg-surface-hover/40 flex items-center">
            {mode === "edit" ? (
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-fg-secondary">{form.sku}</span>
            ) : (
              <span className="text-xs italic text-slate-400 dark:text-fg-muted">Otomatis saat disimpan</span>
            )}
          </div>
        </div>

        <Input
          label="Nama Barang"
          data-fokus-awal
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="mis. Kopsu Pandan"
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div data-field="kategori">
          <Select
            label="Kategori"
            options={opsiKategori}
            value={form.categoryId}
            onChange={(v) => {
              set("categoryId", v);
              lanjutSetelahPilih("kategori");
            }}
            placeholder="Pilih atau ketik kategori baru"
            creatable
            createOptionLabel={(q) => `Tambah kategori "${q}"`}
            onCreateOption={async (query) => {
              try {
                const kategoriBaru = await api.createProductCategory({ name: query });
                const opsi: Option = { value: kategoriBaru.id, label: kategoriBaru.name };
                setOpsiKategori((prev) => [...prev, opsi]);
                toast.success(`Kategori "${kategoriBaru.name}" ditambahkan`);
                return opsi;
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : "Gagal menambah kategori");
                return null;
              }
            }}
            sizeVariant="sm"
            className={COMPACT_FIELD}
            labelClassName={COMPACT_LABEL}
          />
        </div>

        <CurrencyInput
          label="Harga Jual"
          value={form.sellPrice}
          onChange={(v) => set("sellPrice", v)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
      </div>

      <FotoProdukInput
        value={form.imageUrl}
        onChange={(url) => set("imageUrl", url)}
        labelClassName={COMPACT_LABEL}
      />

      {mode === "edit" && (
        <Switch
          label="Produk aktif (bisa dipakai di transaksi)"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
        />
      )}

      {mode === "edit" && (
        <p className="text-[11px] text-slate-500 dark:text-fg-muted">
          Mengubah harga hanya berlaku untuk penjualan berikutnya — nota yang sudah terbit memakai
          harga saat transaksinya dibuat.
        </p>
      )}

      <div className="border-t border-slate-200/60 dark:border-line pt-4 space-y-2.5">
        <p className="text-[11px] text-slate-500 dark:text-fg-muted">
          Enter untuk lompat ke isian berikutnya — di isian pilihan, Enter membuka daftarnya (panah
          ↑↓ untuk memilih) · Esc untuk batal
        </p>

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
              className="px-3.5 py-1.5 rounded-lg border border-[var(--brand-700)] bg-white dark:bg-surface hover:bg-brand-50 dark:hover:bg-brand-950/30 text-[var(--brand-700)] dark:text-brand-400 font-semibold text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
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
            className="px-4 py-1.5 rounded-lg bg-[var(--brand-700)] hover:bg-[var(--brand-800)] text-white font-semibold text-xs shadow-sm flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
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
