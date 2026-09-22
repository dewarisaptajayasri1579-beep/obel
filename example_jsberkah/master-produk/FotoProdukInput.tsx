"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

/** Sisi gambar yang disimpan (piksel). Foto produk cuma dipakai sebagai penanda visual di daftar
 *  dan form — 800px sudah lebih dari cukup, sementara foto mentah dari HP bisa 4000px/5MB dan
 *  itu ditanggung oleh setiap orang yang membuka halaman daftar. */
const SISI = 800;

/** Potong tengah jadi 1:1 lalu perkecil — DI BROWSER, sebelum diunggah.
 *
 *  Dilakukan di sini, bukan di server, karena servernya tidak punya pemroses gambar (route
 *  `/api/uploads` cuma menulis berkas apa adanya) dan menambah `sharp` cuma untuk ini berarti
 *  dependency native baru di deployment. Dengan dipotong di muka, SEMUA foto yang tersimpan
 *  dijamin 1:1 — tampilan daftar tidak pernah belang gara-gara ada foto potret nyelip. */
async function keKotak(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const sisiSumber = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - sisiSumber) / 2;
  const sy = (bitmap.height - sisiSumber) / 2;
  const sisi = Math.min(SISI, sisiSumber);

  const kanvas = document.createElement("canvas");
  kanvas.width = sisi;
  kanvas.height = sisi;
  const ctx = kanvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pemotongan gambar");
  ctx.drawImage(bitmap, sx, sy, sisiSumber, sisiSumber, 0, 0, sisi, sisi);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => kanvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("Gagal memproses gambar");
  return blob;
}

/** Isian foto produk — kotak 1:1 yang langsung jadi pratinjaunya sendiri. Yang disimpan di
 *  `photoUrl` cuma ALAMAT hasil `POST /api/uploads`, bukan berkasnya. */
export function FotoProdukInput({
  value,
  onChange,
  urlTersimpan,
  labelClassName,
}: {
  value: string;
  onChange: (url: string) => void;
  /** Foto yang benar-benar sudah tersimpan di produk ini. Dipakai membedakan mana berkas yang
   *  boleh langsung dibuang saat diganti (unggahan barusan yang belum pernah disimpan) dan mana
   *  yang harus menunggu penyimpanan berhasil (lihat `ProdukForm`). */
  urlTersimpan?: string;
  labelClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [error, setError] = useState("");

  /** Buang berkas yang tidak akan pernah dirujuk siapa pun. Cuma untuk unggahan yang BELUM
   *  tersimpan — foto yang sudah tersimpan baru dilepas setelah penyimpanan berhasil
   *  (lihat `ProdukForm`), karena sampai saat itu catatannya masih menunjuk ke situ. */
  const buangKalauBelumTersimpan = (url: string) => {
    if (!url || url === urlTersimpan) return;
    fetch("/api/uploads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => null);
  };

  const pilih = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setMengunggah(true);
    try {
      const kotak = await keKotak(file);
      const form = new FormData();
      // Nama berkas menentukan ekstensi yang dipakai route unggah — harus ikut hasil konversi
      // (webp), bukan nama asli dari HP yang bisa saja .jpg/.heic.
      form.append("file", kotak, "produk.webp");

      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setError(data?.error || "Gagal mengunggah foto");
        return;
      }
      buangKalauBelumTersimpan(value);
      onChange(data.url);
    } catch {
      setError("Gagal memproses gambar — coba foto lain");
    } finally {
      setMengunggah(false);
      // Dikosongkan supaya memilih berkas yang SAMA lagi tetap memicu onChange (mis. setelah
      // fotonya dihapus lalu mau dipasang ulang).
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="w-full flex flex-col gap-1.5">
      <span className={labelClassName}>Foto Produk (opsional)</span>

      <div className="flex items-start gap-3">
        <div className="relative w-24 aspect-square rounded-xl overflow-hidden border border-slate-200/90 dark:border-line bg-slate-50 dark:bg-surface-hover/40 flex items-center justify-center flex-shrink-0">
          {value ? (
            <Image src={value} alt="Pratinjau foto produk" fill sizes="96px" className="object-cover" unoptimized />
          ) : (
            <ImagePlus className="w-6 h-6 text-slate-300 dark:text-fg-muted" />
          )}
          {mengunggah && (
            <div className="absolute inset-0 bg-white/70 dark:bg-black/50 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[#0544cc] animate-spin" />
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
              {value ? "Ganti Foto" : "Pilih Foto"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  buangKalauBelumTersimpan(value);
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
            Dipotong otomatis jadi 1:1 (tengah) dan diperkecil sebelum diunggah, jadi foto dari HP boleh langsung dipakai.
          </p>
          {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
        </div>
      </div>

      {/* `tabIndex={-1}`: alur Enter di form ini melompati isian yang tidak bisa diketik —
          tombol "Pilih Foto" di atas yang jadi pintu masuknya. */}
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
