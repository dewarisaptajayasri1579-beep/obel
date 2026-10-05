"use client";

import React from "react";
import Link from "next/link";
import { ShieldOff } from "lucide-react";

/// Ditampilkan di dalam layout (menu tetap terlihat) saat user tidak punya hak
/// Lihat di menu halaman ini, atau Admin belum diberi peran (BR-044).
export function NoAccess({ title, description, next }: { title: string; description: string; next?: { label: string; href: string } }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 dark:border-line bg-white dark:bg-surface shadow-2xs p-8 text-center flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 flex items-center justify-center mb-4">
          <ShieldOff className="w-7 h-7" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-fg">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-fg-muted mt-1.5 leading-relaxed">{description}</p>
        {next && (
          <Link
            href={next.href}
            className="mt-5 inline-flex items-center justify-center h-10 px-4 rounded-xl bg-(--brand-700) text-white text-sm font-semibold"
          >
            Buka {next.label}
          </Link>
        )}
      </div>
    </div>
  );
}
