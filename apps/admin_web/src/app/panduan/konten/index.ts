import { LAYAR_ADMIN } from "./admin";
import { LAYAR_BARISTA } from "./barista";
import type { LangkahAlur, LayarPanduan } from "./types";

export { LAYAR_ADMIN, LAYAR_BARISTA };
export type { GambarPanduan, LangkahAlur, LayarPanduan, Peran } from "./types";

/// Urutan baca Sebelumnya/Berikutnya: Barista lalu Admin.
export const SEMUA_LAYAR: LayarPanduan[] = [...LAYAR_BARISTA, ...LAYAR_ADMIN];

/// Satu hari operasional lintas peran (halaman Alur Harian).
export const ALUR_HARIAN: LangkahAlur[] = [];

export function cariLayar(kode: string | null): LayarPanduan | null {
  return SEMUA_LAYAR.find((l) => l.kode === kode) ?? null;
}

/// Teks Hak Akses diturunkan dari peran/menu, supaya aturan RBAC tidak ditulis dua kali.
export function hakAkses(l: LayarPanduan): string[] {
  if (l.peran === "barista") return [l.tanpaShift ? "Semua Barista." : "Barista dengan shift aktif."];
  if (l.ownerOnly) return ["Hanya Owner."];
  if (!l.menu) return ["Semua pengguna admin web."];
  return [
    "Admin: sesuai Peran & Hak Akses. Lihat untuk membuka layar, Kelola untuk mengubah data.",
    "Owner: dapat melihat, tidak dapat mengubah.",
    "Barista: tidak memiliki akses.",
  ];
}
