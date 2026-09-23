import type { Prisma } from '@prisma/client';
import { DomainError } from './domain-error';

/// Nomor bukti sederhana: `PREFIX-000001` naik satu per dokumen, diambil
/// dari nomor TERBESAR yang sudah ada (bukan dari jumlah baris) supaya
/// nomor tidak pernah terulang walau ada dokumen yang lebih dulu dibuat lalu
/// dihapus dari rentang pencarian. Satu pola untuk semua jenis nobukti
/// (lihat docs/obbel-coffee-ai-docs/08-business-rules.md §"Penomoran Nomor
/// Bukti") — kode SKU Produk (`OBL-0001`) di products.service.ts memakai
/// pola yang sama.
function nomorTertinggi(nomorYangSudahAda: string[], prefix: string, digit: number): number {
  const pola = new RegExp(`^${prefix}-(\\d{${digit}})$`);
  return nomorYangSudahAda.reduce((maks, no) => {
    const cocok = pola.exec(no);
    return cocok ? Math.max(maks, Number(cocok[1])) : maks;
  }, 0);
}

function formatNomor(prefix: string, digit: number, n: number): string {
  const batas = 10 ** digit - 1;
  if (n > batas) {
    throw new DomainError('DOC_NO_EXHAUSTED', `Nomor bukti dengan prefix ${prefix} sudah mencapai batas ${batas}.`);
  }
  return `${prefix}-${String(n).padStart(digit, '0')}`;
}

/// Pemanggil query `findMany` sendiri (modelnya beda-beda per tabel) lalu
/// oper daftar nomor yang sudah ada ke sini untuk dihitung & diformat satu
/// nomor berikutnya.
export function nomorSekuensialBerikutnya(nomorYangSudahAda: string[], prefix: string, digit = 6): string {
  return formatNomor(prefix, digit, nomorTertinggi(nomorYangSudahAda, prefix, digit) + 1);
}

/// Sama seperti nomorSekuensialBerikutnya, tapi mengalokasikan `jumlah` nomor
/// berurutan sekaligus — dipakai saat beberapa baris (mis. StockMovement per
/// item) dibuat lewat satu `createMany` dalam transaksi yang sama, jadi tidak
/// bisa query ulang "nomor tertinggi" antar baris (baris sebelumnya belum
/// ke-insert ke DB).
export function alokasikanNomorSekuensial(nomorYangSudahAda: string[], prefix: string, jumlah: number, digit = 6): string[] {
  const awal = nomorTertinggi(nomorYangSudahAda, prefix, digit) + 1;
  return Array.from({ length: jumlah }, (_, i) => formatNomor(prefix, digit, awal + i));
}

/// `StockMovement.movementNo` dipakai lintas modul (sales, distributions,
/// returns, stock-adjustments, stock-opname, shifts) dengan prefix beda-beda
/// tergantung konteks (`MOV` gerakan biasa, `ADJ` adjustment/koreksi). Query
/// dalam tx yang sama supaya baris yang baru dibuat di iterasi sebelumnya
/// (loop banyak movement dalam satu transaksi, dibuat satu-satu bukan lewat
/// createMany) ikut terhitung.
export async function nomorMovementBerikutnya(tx: Prisma.TransactionClient, prefix: 'MOV' | 'ADJ'): Promise<string> {
  const semua = await tx.stockMovement.findMany({
    where: { movementNo: { startsWith: `${prefix}-` } },
    select: { movementNo: true },
  });
  return nomorSekuensialBerikutnya(
    semua.map((m) => m.movementNo),
    prefix,
  );
}

/// Varian batch dari nomorMovementBerikutnya — satu query, alokasikan
/// `jumlah` nomor sekaligus untuk dipakai sebelum `createMany`.
export async function nomorMovementBerikutnyaBanyak(
  tx: Prisma.TransactionClient,
  prefix: 'MOV' | 'ADJ',
  jumlah: number,
): Promise<string[]> {
  const semua = await tx.stockMovement.findMany({
    where: { movementNo: { startsWith: `${prefix}-` } },
    select: { movementNo: true },
  });
  return alokasikanNomorSekuensial(
    semua.map((m) => m.movementNo),
    prefix,
    jumlah,
  );
}
