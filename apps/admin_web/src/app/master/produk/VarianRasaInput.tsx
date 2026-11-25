"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { randomUUID } from "@/lib/uuid";
import type { VarianForm } from "./form-values";

/// Varian Rasa produk (mis. Kopsu Rasa: Butterscotch, Brown Sugar). Harga & stok tetap milik produk;
/// Barista memilih rasa saat menjual. Baris yang dihapus di sini dihapus di server bila rasanya belum
/// pernah terjual, atau dinonaktifkan bila sudah (ProductsService.sinkronkanVarian).
export function VarianRasaInput({
  value,
  onChange,
  disabled,
  fieldClassName,
  labelClassName,
}: {
  value: VarianForm[];
  onChange: (v: VarianForm[]) => void;
  disabled?: boolean;
  fieldClassName: string;
  labelClassName: string;
}) {
  const ubah = (key: string, data: Partial<VarianForm>) => onChange(value.map((v) => (v.key === key ? { ...v, ...data } : v)));

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClassName}>Varian Rasa</span>
      <p className="text-[11px] text-slate-500 dark:text-fg-muted">Kosongkan bila produk tanpa varian.</p>
      {value.map((v) => (
        <div key={v.key} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <Input
              aria-label="Nama rasa"
              value={v.name}
              onChange={(e) => ubah(v.key, { name: e.target.value })}
              placeholder="mis. Butterscotch"
              disabled={disabled}
              sizeVariant="sm"
              className={fieldClassName}
            />
          </div>
          <div className="shrink-0">
            <Switch
              id={`varian-aktif-${v.key}`}
              label="Aktif"
              checked={v.active}
              disabled={disabled}
              onChange={(e) => ubah(v.key, { active: e.target.checked })}
            />
          </div>
          <button
            type="button"
            aria-label={`Hapus rasa ${v.name}`}
            disabled={disabled}
            onClick={() => onChange(value.filter((x) => x.key !== v.key))}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...value, { key: randomUUID(), name: "", active: true }])}
          className="self-start mt-0.5 px-2.5 py-1 rounded-lg border border-dashed border-slate-300 dark:border-line text-xs font-semibold text-slate-600 dark:text-fg-secondary hover:bg-slate-50 dark:hover:bg-surface-hover flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Rasa
        </button>
      )}
    </div>
  );
}
