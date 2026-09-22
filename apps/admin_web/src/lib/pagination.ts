/** Jendela nomor halaman untuk footer pagination bergaya SalesPanel — maksimal `maxTombol` tombol
 *  nomor sekaligus (default 4, jadi total 6 tombol termasuk Prev/Next), geser mengikuti halaman
 *  aktif supaya tabel berpuluh-puluh halaman tidak membanjiri footer dengan tombol nomor. */
export function getPageWindow(halamanAktif: number, totalPages: number, maxTombol = 4): number[] {
  if (totalPages <= maxTombol) return Array.from({ length: totalPages }, (_, i) => i + 1);
  let start = Math.max(1, halamanAktif - Math.floor((maxTombol - 1) / 2));
  const end = Math.min(totalPages, start + maxTombol - 1);
  start = Math.max(1, end - maxTombol + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
