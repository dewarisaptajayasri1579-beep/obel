/// Migrasi satu kali: rapikan nomor bukti lama yang masih memakai skema
/// timestamp+random (mis. `DIST-MUCQYSTV-5C49FE`) — sisa dari
/// `generateDocNo()` sebelum BR-037 (`08-business-rules.md`) mewajibkan
/// semua nobukti memakai format sekuensial sederhana `PREFIX-000001`
/// (lihat AGENTS.md §"Penomoran Nomor Bukti" dan
/// `backend/src/common/doc-no.ts`).
///
/// Merenumber SEMUA baris tiap model (bukan cuma yang formatnya salah) secara
/// kronologis per prefix, supaya hasil akhirnya benar-benar 1..N berurutan
/// tanpa lubang — baris yang kebetulan sudah `PREFIX-000001` ikut dihitung
/// ulang di urutan kronologisnya.
///
/// Efek samping yang disengaja & diterima: teks lama yang menyebut nomor
/// bukti (catatan `activity_logs`, `RestockRequest.note` "Restock untuk
/// DIST-xxx", `impactSnapshot` di TransactionCorrection) TIDAK ikut
/// diperbarui — itu snapshot historis apa adanya saat dokumen dibuat, bukan
/// referensi live. Field yang dipakai untuk relasi antar tabel selalu UUID
/// (`id`), bukan nomor bukti, jadi tidak ada integritas referensial yang
/// rusak — cuma teks bebas di riwayat yang tetap menunjuk nomor lama.
///
/// Dijalankan manual sekali (`npx ts-node scripts/renumber-doc-no.ts`),
/// bukan npm script permanen — sama seperti reset-transaksi.ts.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DIGIT = 6;

function redactedDbTarget(): string {
  const raw = process.env.DATABASE_URL ?? '';
  try {
    const url = new URL(raw);
    return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  } catch {
    return '(tidak bisa membaca DATABASE_URL)';
  }
}

async function confirmOrAbort() {
  console.log(`Target database: ${redactedDbTarget()}`);
  console.log('Script ini MENULIS ULANG nomor bukti (saleNo, distributionNo, returnNo,');
  console.log('requestNo, opnameNo, caseNo, refundNo, movementNo) di seluruh tabel transaksi.');

  if (process.env.CONFIRM_RENUMBER !== 'YES_I_UNDERSTAND') {
    console.error(
      '\nAborted. Set env var CONFIRM_RENUMBER=YES_I_UNDERSTAND untuk melanjutkan, ' +
        'dan pastikan DATABASE_URL di atas benar-benar target yang kamu maksud.',
    );
    process.exit(1);
  }

  console.log('\nKonfirmasi diterima. Menjalankan dalam 5 detik — Ctrl+C untuk batal...');
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}

/// Renumber satu model dengan satu prefix tetap (saleNo/OBL, distributionNo/DIST, dst).
/// Two-pass: pindah dulu ke placeholder unik supaya tidak pernah bentrok
/// unique constraint dengan nomor tujuan di baris lain.
async function renumberModel<T extends { id: string }>(
  label: string,
  prefix: string,
  findAllOrdered: () => Promise<(T & Record<string, unknown>)[]>,
  field: string,
  updateOne: (id: string, value: string) => Promise<unknown>,
) {
  const rows = await findAllOrdered();
  if (rows.length === 0) {
    console.log(`${label}: tidak ada baris, dilewati.`);
    return;
  }

  for (const row of rows) {
    await updateOne(row.id, `TMP-${row.id}`);
  }
  for (let i = 0; i < rows.length; i++) {
    const nomorBaru = `${prefix}-${String(i + 1).padStart(DIGIT, '0')}`;
    const nomorLama = rows[i][field] as string;
    await updateOne(rows[i].id, nomorBaru);
    if (nomorLama !== nomorBaru) {
      console.log(`${label}: ${nomorLama} -> ${nomorBaru}`);
    }
  }
  console.log(`${label}: ${rows.length} baris diberi nomor ulang.`);
}

/// StockMovement dipakai lintas prefix (`MOV`, `ADJ`) tergantung konteks saat
/// dibuat — group per prefix (diambil dari potongan sebelum '-' pertama pada
/// nomor lama) lalu renumber tiap group kronologis sendiri-sendiri.
async function renumberStockMovement() {
  const rows = await prisma.stockMovement.findMany({
    select: { id: true, movementNo: true, occurredAt: true },
    orderBy: { occurredAt: 'asc' },
  });
  if (rows.length === 0) {
    console.log('StockMovement: tidak ada baris, dilewati.');
    return;
  }

  const byPrefix = new Map<string, typeof rows>();
  for (const row of rows) {
    const prefix = row.movementNo.split('-')[0] || 'MOV';
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix)!.push(row);
  }

  for (const row of rows) {
    await prisma.stockMovement.update({ where: { id: row.id }, data: { movementNo: `TMP-${row.id}` } });
  }
  let total = 0;
  for (const [prefix, group] of byPrefix) {
    for (let i = 0; i < group.length; i++) {
      const nomorBaru = `${prefix}-${String(i + 1).padStart(DIGIT, '0')}`;
      await prisma.stockMovement.update({ where: { id: group[i].id }, data: { movementNo: nomorBaru } });
      if (group[i].movementNo !== nomorBaru) {
        console.log(`StockMovement: ${group[i].movementNo} -> ${nomorBaru}`);
      }
    }
    total += group.length;
  }
  console.log(`StockMovement: ${total} baris diberi nomor ulang (${[...byPrefix.keys()].join(', ')}).`);
}

async function main() {
  await confirmOrAbort();

  await renumberModel(
    'Sale',
    'OBL',
    () => prisma.sale.findMany({ select: { id: true, saleNo: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
    'saleNo',
    (id, value) => prisma.sale.update({ where: { id }, data: { saleNo: value } }),
  );

  await renumberModel(
    'StockDistribution',
    'DIST',
    () =>
      prisma.stockDistribution.findMany({
        select: { id: true, distributionNo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    'distributionNo',
    (id, value) => prisma.stockDistribution.update({ where: { id }, data: { distributionNo: value } }),
  );

  await renumberModel(
    'StockReturn',
    'RTN',
    () =>
      prisma.stockReturn.findMany({
        select: { id: true, returnNo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    'returnNo',
    (id, value) => prisma.stockReturn.update({ where: { id }, data: { returnNo: value } }),
  );

  await renumberModel(
    'RestockRequest',
    'RSTK',
    () =>
      prisma.restockRequest.findMany({
        select: { id: true, requestNo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    'requestNo',
    (id, value) => prisma.restockRequest.update({ where: { id }, data: { requestNo: value } }),
  );

  await renumberModel(
    'StockOpname',
    'OPN',
    () =>
      prisma.stockOpname.findMany({
        select: { id: true, opnameNo: true, snapshotAt: true },
        orderBy: { snapshotAt: 'asc' },
      }),
    'opnameNo',
    (id, value) => prisma.stockOpname.update({ where: { id }, data: { opnameNo: value } }),
  );

  await renumberModel(
    'ReconciliationCase',
    'RECON',
    () =>
      prisma.reconciliationCase.findMany({
        select: { id: true, caseNo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    'caseNo',
    (id, value) => prisma.reconciliationCase.update({ where: { id }, data: { caseNo: value } }),
  );

  await renumberModel(
    'SaleRefund',
    'RFD',
    () =>
      prisma.saleRefund.findMany({
        select: { id: true, refundNo: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    'refundNo',
    (id, value) => prisma.saleRefund.update({ where: { id }, data: { refundNo: value } }),
  );

  await renumberStockMovement();

  console.log('\nSelesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
