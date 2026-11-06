import type { MenuKey } from "@/lib/api-client";

/// Panduan Pengguna: satu objek per layar, dirender oleh LayarPanduanView.
/// Semua label dikutip dari kode halamannya, bukan ditulis dari ingatan.

export type Peran = "barista" | "admin";

export interface GambarPanduan {
  /// Nama file di public/panduan/, dibuat oleh scripts/screenshot-panduan.mjs.
  file: string;
  keterangan: string;
}

export interface LangkahPanduan {
  judul: string;
  isi: string;
}

export interface PerhatianPanduan {
  teks: string;
  tingkat: "info" | "penting";
}

export interface LayarPanduan {
  /// Unik, dipakai di URL /panduan?layar=<kode>.
  kode: string;
  peran: Peran;
  /// Sama persis dengan label menu atau judul halamannya.
  judul: string;
  ringkasan: string;
  /// Kunci menu RBAC (khusus layar Admin); menentukan teks Hak Akses.
  menu?: MenuKey;
  ownerOnly?: boolean;
  /// Layar Barista yang bisa dibuka tanpa shift aktif (Login, Absen Berangkat).
  tanpaShift?: boolean;
  gambar: GambarPanduan[];
  langkah: LangkahPanduan[];
  perhatian: PerhatianPanduan[];
}

export interface LangkahAlur {
  peran: Peran | "owner";
  judul: string;
  isi: string;
  /// Kode layar yang membahas langkah ini.
  layar?: string;
}
