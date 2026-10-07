"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BellOff, CheckCheck, CheckCircle2, ChevronRight, Clock, Info, PackageX, Truck, XCircle, type LucideIcon } from "lucide-react";
import type { NotificationItem } from "@/lib/api-client";
import { formatWaktuRelatif } from "@/lib/datetime";
import { Spinner } from "@/components/ui/Spinner";
import { RequirePetugasAuth } from "@/components/layout/RequirePetugasAuth";
import { RequireActiveShift } from "../_components/RequireActiveShift";
import { TopBar } from "../_components/TopBar";
import { formatTanggalJakarta } from "../_lib/format";
import { gabungNotifikasiStok, useDibacaBarista, useNotifikasiBooth } from "../_lib/notifikasi";
import { OBBEL } from "../_lib/theme";

const GREEN = OBBEL.primaryDark;

/// Ikon, warna, dan tujuan ketuk per jenis (dikenali dari awalan `id`, lihat NotificationsService.getForBooth).
function gaya(n: NotificationItem): { ikon: LucideIcon; bg: string; fg: string; href: string | null } {
  if (n.id.startsWith("distribution:")) return { ikon: Truck, bg: "#E1EEFB", fg: "#1D63D8", href: "/petugas/terima-stok" };
  if (n.id.startsWith("restock-rejected:")) return { ikon: XCircle, bg: "#FEE2E2", fg: OBBEL.accentRed, href: "/petugas/stok?tab=restock" };
  if (n.id.startsWith("restock:")) return { ikon: CheckCircle2, bg: "#E8F5EC", fg: GREEN, href: "/petugas/terima-stok" };
  if (n.id.startsWith("lowstock")) {
    const habis = n.type === "error";
    return { ikon: habis ? PackageX : AlertTriangle, bg: habis ? "#FEE2E2" : "#FFF3E0", fg: habis ? OBBEL.accentRed : OBBEL.accentOrange, href: "/petugas/stok?tab=restock" };
  }
  return { ikon: Info, bg: "#E1EEFB", fg: "#1D63D8", href: null };
}

/// Kunci tanggal Asia/Jakarta (YYYY-MM-DD) untuk mengelompokkan per hari.
const tanggalJakarta = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);

function labelHari(iso: string, sekarang: Date): string {
  const hari = tanggalJakarta(new Date(iso));
  if (hari === tanggalJakarta(sekarang)) return "Hari ini";
  if (hari === tanggalJakarta(new Date(sekarang.getTime() - 86_400_000))) return "Kemarin";
  return formatTanggalJakarta(iso);
}

/// Layar Notifikasi Barista (pola layar Notifikasi aplikasi Android JS Berkah): filter Semua / Belum
/// dibaca, dikelompokkan per hari, ketuk = tandai dibaca lalu buka halaman terkait.
function NotifikasiContent() {
  const router = useRouter();
  const mentah = useNotifikasiBooth(true);
  const items = useMemo(() => gabungNotifikasiStok(mentah ?? []), [mentah]);
  const { sudahDibaca, tandai } = useDibacaBarista();
  const [filter, setFilter] = useState<"SEMUA" | "BELUM">("SEMUA");
  const [sekarang, setSekarang] = useState(() => new Date());

  // "N mnt lalu" ikut berjalan selama layar terbuka.
  useEffect(() => {
    const t = setInterval(() => setSekarang(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const belum = items.filter((n) => !sudahDibaca(n));
  const tampil = filter === "BELUM" ? belum : items;

  function buka(n: NotificationItem) {
    tandai([n], items);
    const { href } = gaya(n);
    if (href) router.push(href);
  }

  return (
    <div className="min-h-screen bg-[#F7F9F6]">
      <TopBar title="Notifikasi" back="/petugas" />

      <div className="px-4 pt-3 flex items-center gap-2">
        {(
          [
            ["SEMUA", `Semua (${items.length})`],
            ["BELUM", belum.length > 0 ? `Belum dibaca (${belum.length})` : "Belum dibaca"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className="rounded-full px-3.5 py-2 text-sm font-bold border transition"
            style={filter === key ? { backgroundColor: GREEN, borderColor: GREEN, color: "white" } : { backgroundColor: "white", borderColor: "#E2E8F0", color: "#475569" }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => tandai(items, items)}
          disabled={belum.length === 0}
          className="ml-auto flex items-center gap-1 text-sm font-bold disabled:opacity-40"
          style={{ color: GREEN }}
        >
          <CheckCheck size={16} /> Baca Semua
        </button>
      </div>

      <div className="p-4">
        {mentah === null ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : tampil.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-2">
            <span className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-2">
              <BellOff size={28} className="text-slate-400" />
            </span>
            <p className="font-bold text-base text-slate-900">{filter === "BELUM" ? "Semua sudah dibaca" : "Belum ada notifikasi"}</p>
            <p className="text-sm text-slate-500 max-w-64">
              {filter === "BELUM" ? "Notifikasi yang sudah dibaca ada di tab Semua." : "Kiriman stok, restock, dan stok yang menipis muncul di sini."}
            </p>
          </div>
        ) : (
          tampil.map((n, i) => {
            const hari = labelHari(n.createdAt, sekarang);
            const hariBaru = i === 0 || labelHari(tampil[i - 1].createdAt, sekarang) !== hari;
            const g = gaya(n);
            const Ikon = g.ikon;
            const baru = !sudahDibaca(n);
            return (
              <React.Fragment key={n.id}>
                {hariBaru && <p className={`text-sm font-bold text-slate-500 mb-2 ml-0.5 ${i === 0 ? "" : "mt-4"}`}>{hari}</p>}
                <button
                  type="button"
                  onClick={() => buka(n)}
                  className="w-full text-left rounded-2xl bg-white border border-slate-200 shadow-xs p-3.5 mb-2.5 flex items-start gap-3 active:bg-slate-50"
                >
                  <span className="relative shrink-0">
                    <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: g.bg, color: g.fg }}>
                      <Ikon size={20} />
                    </span>
                    {baru && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white" style={{ backgroundColor: GREEN }} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-base truncate ${baru ? "font-extrabold text-slate-900" : "font-bold text-slate-700"}`}>{n.title}</span>
                    <span className={`block text-sm mt-0.5 line-clamp-2 ${baru ? "text-slate-700" : "text-slate-500"}`}>{n.message}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-400 mt-1.5">
                      <Clock size={12} /> {formatWaktuRelatif(n.createdAt, sekarang)}
                    </span>
                  </span>
                  {g.href && <ChevronRight size={18} className="text-slate-300 shrink-0 self-center" />}
                </button>
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function NotifikasiPage() {
  return (
    <RequirePetugasAuth>
      <RequireActiveShift title="Notifikasi">
        <NotifikasiContent />
      </RequireActiveShift>
    </RequirePetugasAuth>
  );
}
