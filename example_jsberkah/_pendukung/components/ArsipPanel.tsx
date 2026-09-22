"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { Button, FilterableTable, type FilterableColumn, Modal, useToast } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

/** Bentuk minimum satu baris arsip — persis yang dikembalikan endpoint `/<modul>/arsip` backend. */
export interface BarisArsip {
  id: string;
  deletedAt: string | null;
  deletedReason: string | null;
  deletedBy: { id: string; name: string } | null;
}

export interface ArsipPanelProps<T extends BarisArsip> {
  rows: T[];
  /** Kolom khas modulnya (kode, nama, dst). Kolom jejak hapus ditambahkan otomatis di belakang. */
  columns: FilterableColumn<T>[];
  /** Basis endpoint restore, mis. "/api/produk" -> POST /api/produk/<id>/restore */
  endpoint: string;
  entitas: string;
  /** Label baris untuk dialog konfirmasi. */
  label: (row: T) => string;
}

/** Layar Arsip bersama (Tahap 20): daftar data yang di-soft-delete + tombol Pulihkan.
 *
 *  Tiga kolom jejak — siapa, kapan, kenapa — ditambahkan di sini, bukan diserahkan ke tiap
 *  pemanggil: itu satu-satunya alasan layar ini ada, dan tidak boleh bisa lupa ditampilkan. */
export function ArsipPanel<T extends BarisArsip>({ rows, columns, endpoint, entitas, label }: ArsipPanelProps<T>) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<T | null>(null);
  const [memulihkan, setMemulihkan] = useState(false);

  const pulihkan = async () => {
    if (!target) return;
    setMemulihkan(true);
    try {
      const res = await fetch(`${endpoint}/${target.id}/restore`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || `Gagal memulihkan ${entitas.toLowerCase()}`);
        return;
      }
      toast.success(`${entitas} dipulihkan`);
      setTarget(null);
      router.refresh();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setMemulihkan(false);
    }
  };

  const kolomJejak: FilterableColumn<T>[] = [
    {
      key: "deletedAt",
      header: "Dihapus",
      cell: (r) => (
        <span className="text-sm text-slate-600 dark:text-fg-muted">{r.deletedAt ? formatDateTime(r.deletedAt) : "-"}</span>
      ),
    },
    {
      key: "deletedBy",
      header: "Oleh",
      cell: (r) => <span className="text-sm text-slate-600 dark:text-fg-muted">{r.deletedBy?.name ?? "-"}</span>,
      filterValue: (r) => r.deletedBy?.name ?? "",
    },
    {
      key: "deletedReason",
      header: "Alasan",
      cell: (r) => (
        <span className="text-sm text-slate-600 dark:text-fg-muted">{r.deletedReason || "-"}</span>
      ),
      filterValue: (r) => r.deletedReason ?? "",
    },
    {
      key: "actions",
      header: "",
      headClassName: "w-10",
      cell: (r) => (
        <Button variant="ghost" size="sm" leftIcon={<RotateCcw className="w-4 h-4" />} onClick={() => setTarget(r)}>
          Pulihkan
        </Button>
      ),
    },
  ];

  return (
    <>
      <FilterableTable
        columns={[...columns, ...kolomJejak]}
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Cari di arsip..."
        emptyMessage={`Belum ada ${entitas.toLowerCase()} yang dihapus.`}
      />

      <Modal
        isOpen={target !== null}
        onClose={() => setTarget(null)}
        title={`Pulihkan ${entitas}?`}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3 w-full">
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={memulihkan}>
              Batal
            </Button>
            <Button variant="primary" isLoading={memulihkan} onClick={pulihkan}>
              Pulihkan
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-fg-muted">
          {target ? <span className="font-bold text-slate-900 dark:text-fg">{label(target)}</span> : null} akan kembali
          muncul di seluruh daftar seperti sebelum dihapus.
        </p>
      </Modal>
    </>
  );
}
