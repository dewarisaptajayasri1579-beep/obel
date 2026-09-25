"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api-client";

interface Dokumen {
  id: string;
  no: string;
}

/// Isi `details` error PRODUCT_STILL_IN_USE dari backend
/// (ProductsService.pastikanBisaDinonaktifkan).
export interface RincianNonaktifDiblokir {
  stok: { lokasi: string; qty: number }[];
  serahTerima: Dokumen[];
  restock: Dokumen[];
  pengembalian: Dokumen[];
}

export function rincianNonaktifDiblokir(err: unknown): RincianNonaktifDiblokir | null {
  if (!(err instanceof ApiError) || err.code !== "PRODUCT_STILL_IN_USE" || !err.details) return null;
  const d = err.details as Partial<RincianNonaktifDiblokir>;
  return { stok: d.stok ?? [], serahTerima: d.serahTerima ?? [], restock: d.restock ?? [], pengembalian: d.pengembalian ?? [] };
}

function DaftarDokumen({ judul, dokumen, href }: { judul: string; dokumen: Dokumen[]; href: (d: Dokumen) => string }) {
  if (dokumen.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold text-slate-700 dark:text-fg-secondary mb-1.5">{judul}</p>
      <div className="flex flex-wrap gap-1.5">
        {dokumen.map((d) => (
          <Link
            key={d.id}
            href={href(d)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-line bg-slate-50 dark:bg-surface-hover text-xs font-mono font-semibold text-(--brand-700) hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
          >
            {d.no}
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export function NonaktifDiblokirModal({
  productName,
  rincian,
  onClose,
}: {
  productName: string;
  rincian: RincianNonaktifDiblokir | null;
  onClose: () => void;
}) {
  const totalStok = rincian?.stok.reduce((s, x) => s + x.qty, 0) ?? 0;
  return (
    <Modal isOpen={!!rincian} onClose={onClose} title="Belum Bisa Dinonaktifkan" size="sm">
      {rincian && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-fg-muted">
            <strong className="text-slate-800 dark:text-fg">{productName}</strong> masih beredar. Habiskan atau
            Adjustment stoknya ke 0 dan selesaikan dokumen di bawah dulu.
          </p>

          {rincian.stok.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-fg-secondary mb-1.5">Sisa stok ({totalStok})</p>
              <ul className="rounded-xl border border-slate-200 dark:border-line divide-y divide-slate-100 dark:divide-line">
                {rincian.stok.map((s) => (
                  <li key={s.lokasi} className="flex justify-between px-3 py-2 text-sm">
                    <span className="text-slate-700 dark:text-fg-secondary">{s.lokasi}</span>
                    <span className="font-bold tabular-nums text-slate-900 dark:text-fg">{s.qty} cup</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DaftarDokumen judul="Serah Terima belum diterima" dokumen={rincian.serahTerima} href={(d) => `/serah-terima-stok/dist_${d.id}`} />
          <DaftarDokumen judul="Pengajuan restock belum diproses" dokumen={rincian.restock} href={(d) => `/serah-terima-stok/req_${d.id}`} />
          <DaftarDokumen judul="Pengembalian Stok belum di-approve" dokumen={rincian.pengembalian} href={() => "/transaksi-laporan-kembali"} />

          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
