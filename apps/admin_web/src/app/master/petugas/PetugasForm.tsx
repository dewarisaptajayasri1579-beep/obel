"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Save, X } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useHotkey } from "@/hooks/useHotkey";
import { useFokusAwal } from "@/hooks/useFokusAwal";
import { api, ApiError } from "@/lib/api-client";
import { nilaiAwalPetugas, type PetugasFormValues } from "./form-values";

type Option = { value: string; label: string };

const COMPACT_FIELD = "!text-xs !h-8.5 !min-h-[34px] !rounded-lg !bg-white dark:!bg-surface shadow-2xs";
const COMPACT_LABEL = "text-[11px] font-semibold text-slate-700 dark:text-fg-secondary select-none";

/// Form Petugas — satu komponen untuk Tambah & Edit, dipakai dua halaman
/// tersendiri (`/master/petugas/baru`, `/master/petugas/[id]/edit`), BUKAN
/// modal — pola & alasannya sama persis dengan `ProdukForm`/`BoothForm`.
///
/// Password SENGAJA tidak ada di sini saat mode edit — reset password
/// tetap lewat aksi terpisah di TabMain (mengubah kredensial login yang
/// sedang dipakai petugas adalah aksi berbeda dari mengubah data profilnya,
/// tidak boleh tercampur diam-diam di form yang sama).
export const PetugasForm: React.FC<{
  mode: "create" | "edit";
  initial: PetugasFormValues;
  booths: Option[];
  back: string;
}> = ({ mode, initial, booths, back }) => {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState<PetugasFormValues>(initial);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);
  useFokusAwal(formRef);

  const kembali = `/master/petugas${back ? `?${back}` : ""}`;

  const set = <K extends keyof PetugasFormValues>(key: K, value: PetugasFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

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

  const lanjutSetelahPilih = (namaField: string) => {
    requestAnimationFrame(() => {
      const trigger = formRef.current?.querySelector<HTMLElement>(`[data-field="${namaField}"] [role="combobox"]`);
      if (trigger) majuDari(trigger);
    });
  };

  const enterMajuKeFieldBerikutnya = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (!formRef.current?.contains(target)) return;
    if (target.tagName === "TEXTAREA") return;
    if (target.getAttribute("role") === "combobox") return;

    e.preventDefault();
    e.stopPropagation();
    majuDari(target);
  };

  const validate = () => {
    setError("");
    if (mode === "create" && form.username.trim().length < 3) {
      setError("Username minimal 3 karakter");
      return false;
    }
    if (mode === "create" && form.password.length < 6) {
      setError("Password minimal 6 karakter");
      return false;
    }
    if (!form.fullName.trim()) {
      setError("Nama lengkap wajib diisi");
      return false;
    }
    return true;
  };

  const simpan = async (lanjutIsiLagi = false) => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (mode === "create") {
        const dibuat = await api.createUser({
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          role: "BOOTH_STAFF",
          defaultBoothId: form.defaultBoothId || undefined,
        });
        toast.success(`Petugas "${dibuat.fullName}" ditambahkan`);
      } else {
        await api.updateUser(form.id, {
          fullName: form.fullName.trim(),
          defaultBoothId: form.defaultBoothId || undefined,
          active: form.isActive,
        });
        toast.success(`Petugas "${form.fullName}" diperbarui`);
      }

      if (lanjutIsiLagi) {
        setForm((f) => ({ ...nilaiAwalPetugas(), defaultBoothId: f.defaultBoothId }));
        requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>("input")?.focus());
        return;
      }

      router.push(kembali);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan Petugas");
    } finally {
      setSubmitting(false);
    }
  };

  useHotkey({ key: "s", ctrl: true, allowInEditable: true }, () => simpan(false));
  useHotkey({ key: "Enter", ctrl: true, allowInEditable: true }, () => simpan(mode === "create"));
  useHotkey({ key: "Escape", allowInEditable: true }, () => {
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
        {/* Saat edit, username dipajang — bukan Input yang dinonaktifkan, sama
            alasannya dengan Kode Booth/SKU Produk: ini identitas login yang
            sudah dipakai petugas, tidak boleh berubah diam-diam. */}
        {mode === "edit" ? (
          <div className="w-full flex flex-col gap-1.5">
            <span className={COMPACT_LABEL}>Username</span>
            <div className="h-8.5 min-h-[34px] px-3 rounded-lg border border-dashed border-slate-300/90 dark:border-line bg-slate-50/70 dark:bg-surface-hover/40 flex items-center">
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-fg-secondary">{form.username}</span>
            </div>
          </div>
        ) : (
          <Input
            label="Username"
            data-fokus-awal
            placeholder="petugas01"
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            sizeVariant="sm"
            className={COMPACT_FIELD}
            labelClassName={COMPACT_LABEL}
          />
        )}

        <Input
          label="Nama Lengkap"
          placeholder="mis. Rina Wulandari"
          value={form.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
      </div>

      {mode === "create" && (
        <Input
          label="Password"
          isPassword
          helperText="Minimal 6 karakter — dipakai petugas login di aplikasi Android"
          placeholder="••••••"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
      )}

      <div data-field="booth">
        <Select
          label="Booth Default Login (opsional, bukan Setting Petugas)"
          options={booths}
          value={form.defaultBoothId}
          onChange={(v) => {
            set("defaultBoothId", v);
            lanjutSetelahPilih("booth");
          }}
          placeholder="Booth awal sebelum Check-In pertama (bukan roster Booth+Shift)"
          sizeVariant="sm"
          className={COMPACT_FIELD}
          labelClassName={COMPACT_LABEL}
        />
      </div>

      {mode === "edit" && (
        <Switch
          label="Petugas aktif (bisa login & bertransaksi di Android)"
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
