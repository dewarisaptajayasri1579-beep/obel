"use client";

import { ChevronRight } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { ALUR_HARIAN, cariLayar } from "./konten";

const LABEL_PERAN = { barista: "Barista", admin: "Admin", owner: "Owner" } as const;
const WARNA_PERAN = { barista: "warning", admin: "info", owner: "secondary" } as const;

/// Gambaran satu hari operasional lintas peran; tiap langkah menautkan ke layarnya.
export function AlurHarianView({ onPilih }: { onPilih: (kode: string) => void }) {
  return (
    <div className="min-w-0">
      <h2 className="text-xl font-bold text-slate-900 dark:text-fg">Alur Harian</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-fg-muted">Urutan kerja satu hari, dari stok dikirim sampai setoran diterima.</p>

      <Card variant="solid" padding="none" className="mt-4 p-5 sm:p-6">
        <ol className="flex flex-col gap-4">
          {ALUR_HARIAN.map((s, i) => {
            const layar = cariLayar(s.layar ?? null);
            return (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex w-6 h-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={WARNA_PERAN[s.peran]} size="sm">{LABEL_PERAN[s.peran]}</Badge>
                    <p className="text-sm font-semibold text-slate-800 dark:text-fg">{s.judul}</p>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-fg-secondary">{s.isi}</p>
                  {layar && (
                    <button
                      type="button"
                      onClick={() => onPilih(layar.kode)}
                      className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-300 hover:underline"
                    >
                      Buka panduan {layar.judul} <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
