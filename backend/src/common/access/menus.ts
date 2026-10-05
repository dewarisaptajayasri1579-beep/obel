/// Katalog menu admin web yang bisa diatur hak aksesnya per peran (BR-044) — SATU-SATUNYA sumber
/// kunci & label menu. Admin web mengambilnya lewat `GET /access-roles/menus` (editor peran) dan
/// `apps/admin_web/src/lib/nav-config.ts` merujuk kuncinya per item menu. "Tampilan" & "Dokumentasi"
/// sengaja tidak ada: tidak mengubah data, selalu terbuka. Menambah menu baru = tambah di sini; peran
/// sistem (fullAccess) otomatis ikut, peran lain mulai dari "Tidak ada".
export const MENUS = [
  { key: 'BOOTH_AKTIF', label: 'Booth Aktif', group: 'Monitoring' },
  { key: 'DASHBOARD', label: 'Dashboard', group: 'Monitoring' },
  { key: 'TAMBAH_STOK_GUDANG', label: 'Tambah Stok Gudang', group: 'Transaksi' },
  { key: 'PEMUSNAHAN_STOK', label: 'Pemusnahan Stok', group: 'Transaksi' },
  { key: 'SERAH_TERIMA_STOK', label: 'Serah Terima Stok', group: 'Transaksi' },
  { key: 'CHECKIN_CHECKOUT', label: 'Check In-Check Out', group: 'Transaksi Booth' },
  { key: 'TERIMA_STOK', label: 'Terima Stok', group: 'Transaksi Booth' },
  { key: 'KASIR', label: 'Kasir', group: 'Transaksi Booth' },
  { key: 'SETOR_PENGEMBALIAN', label: 'Setor & Pengembalian Stok', group: 'Transaksi Booth' },
  { key: 'REKAP_STOK_SELISIH', label: 'Rekap Stok Selisih', group: 'Transaksi Booth' },
  { key: 'REKAP_PENGEMBALIAN', label: 'Rekap Pengembalian Stok', group: 'Transaksi Booth' },
  { key: 'PRODUK', label: 'Produk', group: 'Data Operasional' },
  { key: 'BOOTH', label: 'Booth', group: 'Data Operasional' },
  { key: 'BARISTA', label: 'Barista', group: 'Data Operasional' },
  { key: 'PROFIL_PERUSAHAAN', label: 'Profil Perusahaan', group: 'Pengaturan' },
  { key: 'ABSENSI', label: 'Absensi', group: 'Pengaturan' },
  { key: 'SHIFT', label: 'Shift', group: 'Master Data' },
  { key: 'USER', label: 'User', group: 'Master Data' },
] as const;

export type MenuKey = (typeof MENUS)[number]['key'];

export const MENU_KEYS: readonly MenuKey[] = MENUS.map((m) => m.key);

export function isMenuKey(value: string): value is MenuKey {
  return (MENU_KEYS as readonly string[]).includes(value);
}
