"use client";

import React, { useEffect, useState } from "react";

import { Button, Modal, Textarea } from "@/components/ui";

export interface HapusDialogProps {
  /** Null = dialog tertutup. */
  isOpen: boolean;
  onClose: () => void;
  /** Dipanggil dengan alasan yang sudah di-trim. Lempar/throw kalau gagal — dialog tetap terbuka. */
  onConfirm: (alasan: string) => Promise<void> | void;
  /** Nama barang yang dihapus, ditebalkan di kalimat konfirmasi. */
  nama?: string;
  /** "Produk", "Toko", "Supplier", ... — dipakai di judul dan kalimat. */
  entitas: string;
  /** Kalimat tambahan di bawah kalimat baku, mis. syarat yang bisa membuat backend menolak. */
  catatan?: React.ReactNode;
  loading?: boolean;
}

const MIN_ALASAN = 3;

/** Dialog konfirmasi hapus dengan alasan wajib (Tahap 20).
 *
 *  Dipakai bersama oleh semua master data supaya kalimatnya seragam dan — lebih penting —
 *  supaya tidak ada layar yang lupa mengirim `alasan` dan baru ketahuan sebagai 400 dari backend.
 *
 *  Kalimatnya sengaja TIDAK lagi berbunyi "dihapus permanen dan tidak dapat dikembalikan":
 *  sejak Tahap 20 itu tidak benar, dan konfirmasi yang salah menakut-nakuti sama buruknya
 *  dengan konfirmasi yang meremehkan. */
export function HapusDialog({ isOpen, onClose, onConfirm, nama, entitas, catatan, loading = false }: HapusDialogProps) {
  const [alasan, setAlasan] = useState("");
  const [sentuh, setSentuh] = useState(false);

  // Alasan tidak boleh terbawa ke penghapusan berikutnya — itu cara tercepat menghasilkan
  // arsip berisi alasan yang menempel di data yang salah.
  useEffect(() => {
    if (!isOpen) {
      setAlasan("");
      setSentuh(false);
    }
  }, [isOpen]);

  const kurang = alasan.trim().length < MIN_ALASAN;

  const konfirmasi = async () => {
    setSentuh(true);
    if (kurang) return;
    await onConfirm(alasan.trim());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Hapus ${entitas}?`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-fg-muted">
          {entitas} {nama ? <span className="font-bold text-slate-900 dark:text-fg">{nama}</span> : null} akan
          dipindahkan ke Arsip dan hilang dari semua daftar. Dokumen lama yang menyebutnya tetap utuh, dan Owner bisa
          memulihkannya kembali dari Arsip.
        </p>
        {catatan ? <p className="text-sm text-slate-600 dark:text-fg-muted">{catatan}</p> : null}

        <Textarea
          label="Alasan hapus"
          sizeVariant="sm"
          rows={3}
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          onBlur={() => setSentuh(true)}
          maxLength={500}
          placeholder="Contoh: salah input, dobel dengan kode lain, sudah tidak dijual"
          disabled={loading}
          error={sentuh && kurang ? "Alasan hapus wajib diisi" : undefined}
          helperText="Tercatat di Arsip dan Log bersama nama Anda dan waktu penghapusan."
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button variant="danger" onClick={konfirmasi} isLoading={loading} disabled={kurang}>
            Ya, Hapus
          </Button>
        </div>
      </div>
    </Modal>
  );
}
