"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

/// Sisi terpanjang maksimum (piksel) sebelum diunggah — logo dipakai kecil
/// (kop dokumen cetak, header layar), jadi berkas sumber dari HP/desain besar
/// diperkecil dulu di browser, bukan disimpan mentah.
const SISI_MAKS = 480;

/// Beda dari FotoProdukInput: TIDAK dipotong jadi 1:1 (logo biasanya
/// persegi panjang), dan outputnya PNG bukan WEBP — pdfkit & ExcelJS (dipakai
/// menaruh logo di kop dokumen cetak, lihat *-report.service.ts) cuma
/// mendukung JPEG/PNG.
async function perkecil(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const skala = Math.min(1, SISI_MAKS / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * skala);
  const h = Math.round(bitmap.height * skala);

  const kanvas = document.createElement("canvas");
  kanvas.width = w;
  kanvas.height = h;
  const ctx = kanvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pemotongan gambar");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => kanvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Gagal memproses gambar");
  return blob;
}

export function LogoPerusahaanInput({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [error, setError] = useState("");

  async function pilih(file: File | undefined) {
    if (!file) return;
    setError("");
    setMengunggah(true);
    try {
      const kecil = await perkecil(file);
      const hasil = await api.uploadCompanyLogo(new File([kecil], "logo.png", { type: "image/png" }));
      onChange(hasil.logoUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memproses gambar — coba berkas lain");
    } finally {
      setMengunggah(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="w-full flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-700 dark:text-fg-secondary select-none">Logo Perusahaan (opsional)</span>

      <div className="flex items-start gap-3">
        <div className="relative w-32 h-20 rounded-xl overflow-hidden border border-slate-200/90 dark:border-line bg-slate-50 dark:bg-surface-hover/40 flex items-center justify-center flex-shrink-0">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Pratinjau logo perusahaan" className="w-full h-full object-contain p-1.5" />
          ) : (
            <ImagePlus className="w-6 h-6 text-slate-300 dark:text-fg-muted" />
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
              {value ? "Ganti Logo" : "Pilih Logo"}
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
            JPG atau PNG. Dipakai di kop semua dokumen cetak (PDF/Excel) dan header layar.
          </p>
          {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png" tabIndex={-1} className="hidden" onChange={(e) => pilih(e.target.files?.[0])} />
    </div>
  );
}
