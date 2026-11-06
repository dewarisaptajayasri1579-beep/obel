import { LAYAR_ADMIN } from "./admin";
import { LAYAR_BARISTA } from "./barista";
import type { LangkahAlur, LayarPanduan } from "./types";

export { LAYAR_ADMIN, LAYAR_BARISTA };
export type { GambarPanduan, LangkahAlur, LayarPanduan, Peran } from "./types";

/// Urutan baca Sebelumnya/Berikutnya: Barista lalu Admin.
export const SEMUA_LAYAR: LayarPanduan[] = [...LAYAR_BARISTA, ...LAYAR_ADMIN];

/// Satu hari operasional lintas peran (halaman Alur Harian).
export const ALUR_HARIAN: LangkahAlur[] = [
  { peran: "barista", judul: "Absen Berangkat", isi: "Barista absen di Gudang dan menerima uang jalan. Shift dimulai.", layar: "barista-berangkat" },
  { peran: "admin", judul: "Kirim stok", isi: "Admin mengirim stok ke Barista yang sedang aktif. Stok Gudang berkurang.", layar: "admin-serah-terima-stok" },
  { peran: "barista", judul: "Absen Tiba di Booth", isi: "Barista absen begitu sampai di Booth.", layar: "barista-tiba" },
  { peran: "barista", judul: "Terima Stok", isi: "Barista mencocokkan kiriman lalu mengonfirmasi penerimaan. Stok Booth bertambah.", layar: "barista-terima-stok" },
  { peran: "barista", judul: "Berjualan", isi: "Barista mencatat setiap penjualan di Kasir.", layar: "barista-kasir" },
  { peran: "barista", judul: "Ajukan restock", isi: "Bila stok menipis, Barista mengajukan restock. Admin memprosesnya di Serah Terima Stok.", layar: "barista-stok" },
  { peran: "admin", judul: "Pantau Booth", isi: "Admin memantau penjualan, stok, dan lokasi Booth secara real-time.", layar: "admin-booth-aktif" },
  { peran: "barista", judul: "Check-Out", isi: "Di akhir shift, Barista menghitung stok fisik, memeriksa rekap, lalu absen Check-Out di Booth.", layar: "barista-checkout" },
  { peran: "barista", judul: "Absen Kembali di Gudang", isi: "Barista absen di Gudang, lalu menyerahkan stok dan uang kepada Admin.", layar: "barista-kembali" },
  { peran: "admin", judul: "Approve setoran", isi: "Admin approve Stok Kembali dan Setor Uang. Shift selesai.", layar: "admin-transaksi-laporan-kembali" },
  { peran: "owner", judul: "Peran Owner", isi: "Owner dapat membuka semua menu tanpa mengubah data, dan mengatur Peran & Hak Akses untuk Admin.", layar: "admin-peran" },
];

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
