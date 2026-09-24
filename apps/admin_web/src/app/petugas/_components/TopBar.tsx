"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/// Header sederhana dipakai layar-layar di dalam grid Home (Kasir, Terima
/// Stok, Stok, Check-Out, dst) — beda dari Home sendiri yang pakai header
/// sapaan + notifikasi.
///
/// `onBack` vs `back`: beberapa layar (mis. Detail Penerimaan di
/// terima-stok/page.tsx, Konfirmasi Check Out di checkout/page.tsx) toggle
/// "sub-layar" lewat STATE LOKAL (bukan route terpisah) sementara URL-nya
/// tetap sama persis dengan layar sebelumnya — `router.push(back)` ke URL
/// yang sama persis itu no-op di Next.js (tidak ada navigasi berarti apapun
/// yang berubah), jadi tombol panah kelihatan "tidak berfungsi". Untuk
/// kasus begitu, pakai `onBack` (clear state lokalnya) bukan `back`. `back`
/// (string URL) tetap dipakai buat layar yang beneran route terpisah.
export function TopBar({
  title,
  subtitle,
  back,
  onBack,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3.5 flex items-center gap-3">
      <button
        type="button"
        onClick={() => (onBack ? onBack() : back ? router.push(back) : router.back())}
        className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-slate-100 shrink-0"
      >
        <ArrowLeft size={22} className="text-slate-700" />
      </button>
      <div className="min-w-0">
        <h1 className="font-extrabold text-slate-900 text-lg leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}
