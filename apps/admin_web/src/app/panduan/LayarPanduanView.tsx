"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Info, ShieldCheck } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { GaleriGambar } from "./GaleriGambar";
import { hakAkses, type LayarPanduan } from "./konten";

const BAGIAN = [
  { id: "tampilan", judul: "Tampilan Layar" },
  { id: "langkah", judul: "Langkah Penggunaan" },
  { id: "perhatian", judul: "Perlu Diperhatikan" },
  { id: "akses", judul: "Hak Akses" },
] as const;

function Bagian({ id, judul, children }: { id: string; judul: string; children: React.ReactNode }) {
  return (
    <section id={`bagian-${id}`} className="scroll-mt-28 py-5 border-b border-slate-100 dark:border-line last:border-b-0 first:pt-0 last:pb-0">
      <h3 className="text-base font-bold text-slate-900 dark:text-fg mb-3">{judul}</h3>
      {children}
    </section>
  );
}

function TombolPindah({ layar, arah, onPilih }: { layar?: LayarPanduan; arah: "sebelum" | "sesudah"; onPilih: (kode: string) => void }) {
  const sesudah = arah === "sesudah";
  return (
    <button
      type="button"
      disabled={!layar}
      onClick={() => layar && onPilih(layar.kode)}
      className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-slate-200 dark:border-line px-4 py-3 transition hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-surface-hover disabled:invisible ${
        sesudah ? "justify-end text-right" : "text-left"
      }`}
    >
      {!sesudah && <ChevronLeft className="w-4 h-4 shrink-0 text-slate-400" />}
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-400 dark:text-fg-muted">{sesudah ? "Berikutnya" : "Sebelumnya"}</span>
        <span className="block truncate text-sm font-semibold text-slate-800 dark:text-fg">{layar?.judul ?? ""}</span>
      </span>
      {sesudah && <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />}
    </button>
  );
}

export function LayarPanduanView({
  layar,
  sebelum,
  sesudah,
  onPilih,
}: {
  layar: LayarPanduan;
  sebelum?: LayarPanduan;
  sesudah?: LayarPanduan;
  onPilih: (kode: string) => void;
}) {
  const lompat = (id: string) => document.getElementById(`bagian-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Badge variant={layar.peran === "barista" ? "warning" : "info"} size="sm">
          {layar.peran === "barista" ? "Barista" : "Admin"}
        </Badge>
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-fg wrap-break-word">{layar.judul}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-fg-muted">{layar.ringkasan}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {BAGIAN.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => lompat(b.id)}
            className="rounded-full border border-slate-200 dark:border-line px-3 py-1 text-xs font-semibold text-slate-600 dark:text-fg-secondary transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-surface-hover"
          >
            {b.judul}
          </button>
        ))}
      </div>

      <Card variant="solid" padding="none" className="mt-4 p-5 sm:p-6">
        <Bagian id="tampilan" judul="Tampilan Layar">
          <GaleriGambar key={layar.kode} gambar={layar.gambar} peran={layar.peran} />
        </Bagian>

        <Bagian id="langkah" judul="Langkah Penggunaan">
          <ol className="flex flex-col gap-3">
            {layar.langkah.map((l, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex w-6 h-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-fg">{l.judul}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-fg-secondary">{l.isi}</p>
                </div>
              </li>
            ))}
          </ol>
        </Bagian>

        <Bagian id="perhatian" judul="Perlu Diperhatikan">
          {layar.perhatian.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-fg-muted">Tidak ada catatan khusus.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {layar.perhatian.map((p, i) => {
                const penting = p.tingkat === "penting";
                const Ikon = penting ? AlertTriangle : Info;
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm ${
                      penting
                        ? "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
                        : "bg-slate-50 text-slate-700 dark:bg-surface-hover dark:text-fg-secondary"
                    }`}
                  >
                    <Ikon className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="min-w-0">{p.teks}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Bagian>

        <Bagian id="akses" judul="Hak Akses">
          <ul className="flex flex-col gap-1.5">
            {hakAkses(layar).map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-fg-secondary">
                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" />
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
        </Bagian>
      </Card>

      <nav className="mt-6 flex items-stretch gap-3">
        <TombolPindah layar={sebelum} arah="sebelum" onPilih={onPilih} />
        <TombolPindah layar={sesudah} arah="sesudah" onPilih={onPilih} />
      </nav>
    </div>
  );
}
