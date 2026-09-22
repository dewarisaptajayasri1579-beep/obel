import Link from "next/link";
import { Archive } from "lucide-react";

/** Tautan ke layar Arsip sebuah master data (Tahap 20).
 *
 *  Render `null` untuk non-owner, jadi pemanggilnya cukup menyisipkan komponen ini tanpa
 *  menulis pengecekan role berulang-ulang. Ini murni soal tampilan — pengamannya tetap
 *  @Roles("owner") di backend dan requirePageRole di halaman arsipnya. */
export function TautanArsip({ href, role }: { href: string; role: string }) {
  if (role !== "owner") return null;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 dark:text-fg-muted hover:text-slate-900 dark:hover:text-fg transition-colors"
    >
      <Archive className="w-4 h-4" />
      Lihat Arsip
    </Link>
  );
}
