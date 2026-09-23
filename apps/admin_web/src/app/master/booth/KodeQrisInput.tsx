"use client";

import { useRef, useState } from "react";
import { QrCode, Loader2, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

/// Isian kode QRIS Booth — beda dari FotoProdukInput (foto produk): TIDAK
/// dipotong 1:1/dikonversi di browser, karena kode QR sensitif terhadap
/// kompresi/pemotongan (modul QR yang terpotong bikin kodenya tidak bisa
/// dipindai). Berkas asli diunggah apa adanya.
export function KodeQrisInput({
  value,
  onChange,
  labelClassName,
}: {
  value: string;
  onChange: (url: string) => void;
  labelClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [error, setError] = useState("");

  async function pilih(file: File | undefined) {
    if (!file) return;
    setError("");
    setMengunggah(true);
    try {
      const hasil = await api.uploadBoothQris(file);
      onChange(hasil.qrisImageUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengunggah kode QRIS — coba gambar lain");
    } finally {
      setMengunggah(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="w-full flex flex-col gap-1.5">
      <span className={labelClassName}>Kode QRIS Booth (opsional)</span>

      <div className="flex items-start gap-3">
        <div className="relative w-24 aspect-square rounded-xl overflow-hidden border border-slate-200/90 dark:border-line bg-slate-50 dark:bg-surface-hover/40 flex items-center justify-center flex-shrink-0">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Pratinjau kode QRIS" className="w-full h-full object-contain" />
          ) : (
            <QrCode className="w-6 h-6 text-slate-300 dark:text-fg-muted" />
          )}
          {mengunggah && (
            <div className="absolute inset-0 bg-white/70 dark:bg-black/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[var(--brand-700)] animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 pt-0.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={mengunggah}
              className="h-8 px-3 rounded-lg border border-slate-200/80 dark:border-line bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surface-hover text-slate-700 dark:text-fg text-xs font-semibold shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
            >
              {value ? "Ganti Kode QRIS" : "Unggah Kode QRIS"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setError("");
                }}
                disabled={mengunggah}
                className="h-8 px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-fg-muted max-w-xs">
            Ditampilkan ke Petugas Booth di layar Kasir saat pelanggan bayar pakai QRIS/Split.
          </p>
          {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        tabIndex={-1}
        className="hidden"
        onChange={(e) => pilih(e.target.files?.[0])}
      />
    </div>
  );
}
