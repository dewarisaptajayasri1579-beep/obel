"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Save, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useHotkey } from "@/hooks/useHotkey";
import { useFokusAwal } from "@/hooks/useFokusAwal";
import { api, ApiError } from "@/lib/api-client";
import { nilaiAwalBooth, type BoothFormValues } from "./form-values";
import { KodeQrisInput } from "./KodeQrisInput";

const COMPACT_FIELD = "!text-xs !h-8.5 !min-h-[34px] !rounded-lg !bg-white dark:!bg-surface shadow-2xs";
const COMPACT_LABEL = "text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none";

/// Lat/lng dikirim sebagai number kalau isian tidak kosong dan valid; kosong
/// berarti "tidak diisi", bukan 0 — 0,0 adalah koordinat sungguhan (Teluk
/// Guinea), jangan sampai dikira sengaja diisi.
function parseKoordinat(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/// Form Booth — satu komponen untuk Tambah & Edit, dipakai dua halaman
/// tersendiri (`/master/booth/baru`, `/master/booth/[id]/edit`), BUKAN modal —
/// pola & alasannya sama persis dengan `ProdukForm` (lihat komentarnya):
/// daftar Booth di belakangnya tetap punya URL sendiri (penyaring & halaman),
/// jadi Batal/Simpan lewat `kembali` mengembalikan ke situ, bukan ke awal.
///
/// Keyboard-first: Enter = lompat ke isian berikutnya, Ctrl+S = simpan,
/// Ctrl+Enter = simpan & tambah lagi (hanya mode tambah), Esc = batal.
export const BoothForm: React.FC<{
  mode: "create" | "edit";
  initial: BoothFormValues;
  /** Querystring daftar yang ditinggalkan (mis. `q=abc&status=active`), tanpa tanda tanya. */
  back: string;
}> = ({ mode, initial, back }) => {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState<BoothFormValues>(initial);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  useFokusAwal(formRef);

  const kembali = `/master/booth${back ? `?${back}` : ""}`;

  const set = <K extends keyof BoothFormValues>(key: K, value: BoothFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /// Pindah fokus ke isian sesudah `dari`. Kalau sudah di isian terakhir,
  /// berarti pengisian memang sudah selesai — langsung disimpan.
  const majuDari = (dari: HTMLElement) => {
    const wadah = formRef.current;
    if (!wadah) return;
    const bisaFokus = Array.from(
      wadah.querySelectorAll<HTMLElement>('input:not([type="hidden"]), textarea'),
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

  /// Enter = maju satu isian, bukan submit — kesenggol di tengah pengisian
  /// tidak boleh berarti tersimpan separuh.
  const enterMajuKeFieldBerikutnya = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (!formRef.current?.contains(target)) return;
    if (target.tagName === "TEXTAREA") return;

    e.preventDefault();
    e.stopPropagation();
    majuDari(target);
  };

  const validate = () => {
    setError("");
    if (mode === "create" && !form.code.trim()) {
      setError("Kode Booth wajib diisi");
      return false;
    }
    if (!form.name.trim()) {
      setError("Nama Booth wajib diisi");
      return false;
    }
    if (form.latitude.trim() && parseKoordinat(form.latitude) === undefined) {
      setError("Latitude harus berupa angka");
      return false;
    }
    if (form.longitude.trim() && parseKoordinat(form.longitude) === undefined) {
      setError("Longitude harus berupa angka");
      return false;
    }
    return true;
  };

  const simpan = async (lanjutIsiLagi = false) => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        locationName: form.locationName.trim() || undefined,
        address: form.address.trim() || undefined,
        latitude: parseKoordinat(form.latitude),
        longitude: parseKoordinat(form.longitude),
      };
      if (mode === "create") {
        const dibuat = await api.createBooth({ code: form.code.trim(), ...payload });
        toast.success(`Booth "${dibuat.name}" ditambahkan`);
      } else {
        // `code` sengaja TIDAK ikut dikirim saat edit — sama seperti SKU Produk,
        // kode ini bisa sudah terpakai di dokumen/laporan yang sudah terbit.
        await api.updateBooth(form.id, {
          ...payload,
          status: form.isActive ? "ACTIVE" : "INACTIVE",
          qrisImageUrl: form.qrisImageUrl || undefined,
        });
        toast.success(`Booth "${form.name}" diperbarui`);
      }

      if (lanjutIsiLagi) {
        setForm(nilaiAwalBooth());
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>("input")?.focus());
        return;
      }

      router.push(kembali);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan Booth");
    } finally {
      setSubmitting(false);
    }
  };

  useHotkey({ key: "s", ctrl: true, allowInEditable: true }, () => simpan(false));
  useHotkey({ key: "Enter", ctrl: true, allowInEditable: true }, () => simpan(mode === "create"));
  useHotkey({ key: "Escape", allowInEditable: true }, () => router.push(kembali));

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
            atau "belum boleh diisi", padahal memang bukan urusan pemakai. */}
        {mode === "edit" ? (
          <div className="w-full flex flex-col gap-1.5">
            <span className={COMPACT_LABEL}>Kode Booth</span>
            <div className="h-8.5 min-h-[34px] px-3 rounded-lg border border-dashed border-slate-300/90 dark:border-line bg-slate-50/70 dark:bg-surface-hover/40 flex items-center">
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-fg-secondary">{form.code}</span>
            </div>
          </div>
        ) : (
          <Input
            label="Kode Booth"
            data-fokus-awal
            placeholder="BOOTH-11"
            value={form.code}
            onChange={(e) => set("code", e.target.value)}
            sizeVariant="sm"
            className={COMPACT_FIELD}
            labelClassName={COMPACT_LABEL}
          />
        )}

        <Input
          label="Nama Booth"
          placeholder="Booth 11"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
      </div>

      <Input
        label="Lokasi (opsional)"
        placeholder="Depan ..."
        value={form.locationName}
        onChange={(e) => set("locationName", e.target.value)}
        sizeVariant="sm"
        className={COMPACT_FIELD}
        labelClassName={COMPACT_LABEL}
      />

      <Input
        label="Alamat (opsional)"
        placeholder="Jl. ..."
        value={form.address}
        onChange={(e) => set("address", e.target.value)}
        sizeVariant="sm"
        className={COMPACT_FIELD}
        labelClassName={COMPACT_LABEL}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Input
          label="Latitude (opsional)"
          placeholder="-6.914744"
          type="number"
          step="any"
          value={form.latitude}
          onChange={(e) => set("latitude", e.target.value)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
        <Input
          label="Longitude (opsional)"
          placeholder="107.609810"
          type="number"
          step="any"
          value={form.longitude}
          onChange={(e) => set("longitude", e.target.value)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
      </div>
      <p className="text-[11px] text-slate-500 dark:text-fg-muted -mt-2">
        Titik ini dipakai peta Monitoring saat belum ada transaksi hari ini dari Booth ini. Salin dari Google Maps
        (klik kanan titik lokasi → salin koordinat).
      </p>

      {/* Kode QRIS baru bisa diunggah setelah Booth punya id (mode edit) —
          sama polanya dengan Foto Produk yg butuh endpoint upload
          tersendiri, bedanya create Booth tidak langsung menampung field ini. */}
      {mode === "edit" && (
        <KodeQrisInput
          value={form.qrisImageUrl}
          onChange={(url) => set("qrisImageUrl", url)}
          labelClassName={COMPACT_LABEL}
        />
      )}

      {mode === "edit" && (
        <Switch
          label="Booth aktif (bisa dipakai shift & transaksi)"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
        />
      )}

      <div className="border-t border-slate-200/60 dark:border-line pt-4 space-y-2.5">
        <p className="text-[11px] text-slate-500 dark:text-fg-muted">
          Enter untuk lompat ke isian berikutnya · Esc untuk batal
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
