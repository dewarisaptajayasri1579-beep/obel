/// Rekonsiliasi stok — membuktikan saldo proyeksi masih bisa dijelaskan oleh
/// buku besar `stock_movements`.
///
///   npm run stock:reconcile           laporan selisih saja, tidak menulis apa pun
///   npm run stock:reconcile -- --fix  tulis movement penyeimbang saldo awal
///
/// Ini gerbang G0 di docsV2/08-rencana-penyesuaian.md. Dijalankan SEBELUM
/// perubahan skema apa pun, dan tetap dipakai sesudahnya sebagai pemeriksaan
/// berkala — "konsisten dan valid" harus sesuatu yang bisa dijalankan, bukan
/// diharapkan.
///
/// Mode --fix TIDAK mengubah satu pun angka saldo. Ia hanya MENAMBAH baris
/// movement bertipe OPENING sebesar selisihnya, supaya buku besar bisa
/// menjelaskan saldo yang memang sudah ada. Saldo proyeksi diperlakukan sebagai
/// yang benar karena itulah angka yang selama ini dilihat dan dipakai bekerja;
/// yang hilang adalah asal-usulnya, bukan angkanya.
import { PrismaClient, StockMovementType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { WAREHOUSE, dampakMutasi, type LokasiStok } from '../src/modules/stock-movements/arah.util';

const prisma = new PrismaClient();
const FIX = process.argv.includes('--fix');

interface Selisih {
  lokasi: LokasiStok;
  namaLokasi: string;
  productId: string;
  namaProduk: string;
  ledger: number;
  saldo: number;
  beda: number;
}

function docNo(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

async function main() {
  const [movements, warehouseStocks, boothStocks, booths, products] = await Promise.all([
    prisma.stockMovement.findMany(),
    prisma.warehouseStock.findMany(),
    prisma.boothStock.findMany(),
    prisma.booth.findMany({ select: { id: true, name: true } }),
    prisma.product.findMany({ select: { id: true, name: true } }),
  ]);

  const namaProduk = new Map(products.map((p) => [p.id, p.name]));
  const namaBooth = new Map(booths.map((b) => [b.id, b.name]));

  /// Satu lintasan per lokasi. Movement yang tidak menyentuh lokasi itu
  /// mengembalikan delta 0, jadi penyaringannya ada di `dampakMutasi`, bukan
  /// di query — arah mutasi hanya boleh disimpulkan di satu tempat.
  function ledgerPerProduk(lokasi: LokasiStok) {
    const acc = new Map<string, number>();
    let ragu = 0;
    for (const m of movements) {
      const d = dampakMutasi(m, lokasi);
      if (d.delta === 0) continue;
      if (d.perluVerifikasi) ragu++;
      acc.set(m.productId, (acc.get(m.productId) ?? 0) + d.delta);
    }
    return { acc, ragu };
  }

  const selisih: Selisih[] = [];
  let totalRagu = 0;
  let totalDiperiksa = 0;

  const gudang = ledgerPerProduk(WAREHOUSE);
  totalRagu += gudang.ragu;
  for (const s of warehouseStocks) {
    totalDiperiksa++;
    const l = gudang.acc.get(s.productId) ?? 0;
    if (l !== s.qtyOnHand) {
      selisih.push({
        lokasi: WAREHOUSE,
        namaLokasi: 'Gudang Pusat',
        productId: s.productId,
        namaProduk: namaProduk.get(s.productId) ?? s.productId,
        ledger: l,
        saldo: s.qtyOnHand,
        beda: s.qtyOnHand - l,
      });
    }
  }

  for (const booth of booths) {
    const hasil = ledgerPerProduk(booth.id);
    totalRagu += hasil.ragu;
    for (const s of boothStocks.filter((b) => b.boothId === booth.id)) {
      totalDiperiksa++;
      const l = hasil.acc.get(s.productId) ?? 0;
      if (l !== s.qtyOnHand) {
        selisih.push({
          lokasi: booth.id,
          namaLokasi: `Booth ${namaBooth.get(booth.id) ?? booth.id}`,
          productId: s.productId,
          namaProduk: namaProduk.get(s.productId) ?? s.productId,
          ledger: l,
          saldo: s.qtyOnHand,
          beda: s.qtyOnHand - l,
        });
      }
    }
  }

  console.log('═'.repeat(78));
  console.log('REKONSILIASI STOK — buku besar vs saldo proyeksi');
  console.log('═'.repeat(78));
  console.log(`Movement diperiksa   : ${movements.length}`);
  console.log(`Sel (lokasi × produk): ${totalDiperiksa}`);
  console.log(`Cocok                : ${totalDiperiksa - selisih.length}`);
  console.log(`Selisih              : ${selisih.length}`);
  console.log(`Baris arah tak pasti : ${totalRagu}`);
  console.log('');

  if (selisih.length === 0) {
    console.log('✓ Seluruh saldo bisa dijelaskan oleh buku besar.');
    return;
  }

  const perLokasi = new Map<string, Selisih[]>();
  for (const s of selisih) {
    const list = perLokasi.get(s.namaLokasi) ?? [];
    list.push(s);
    perLokasi.set(s.namaLokasi, list);
  }

  for (const [lokasi, list] of perLokasi) {
    console.log(`── ${lokasi} ${'─'.repeat(Math.max(0, 60 - lokasi.length))}`);
    for (const s of list) {
      const tanda = s.beda > 0 ? '+' : '';
      console.log(
        `   ${s.namaProduk.padEnd(34)} ledger ${String(s.ledger).padStart(6)}  saldo ${String(s.saldo).padStart(6)}  beda ${tanda}${s.beda}`,
      );
    }
    console.log('');
  }

  if (!FIX) {
    console.log('Jalankan ulang dengan --fix untuk menulis movement penyeimbang saldo awal.');
    console.log('Saldo TIDAK akan diubah; hanya ditambahkan baris OPENING sebesar selisihnya.');
    return;
  }

  // Tanggal bisnis backfill = sehari sebelum movement paling awal, supaya baris
  // saldo awal selalu berada di depan seluruh riwayat dan tidak mengacaukan
  // rekap bulan mana pun yang sudah berjalan.
  const paling = await prisma.stockMovement.aggregate({ _min: { businessDate: true } });
  const dasar = paling._min.businessDate ?? new Date();
  const businessDate = new Date(Date.UTC(dasar.getUTCFullYear(), dasar.getUTCMonth(), dasar.getUTCDate() - 1));

  const sistem = await prisma.profile.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (!sistem) throw new Error('Tidak ada profil ADMIN untuk dicatat sebagai pembuat movement.');

  await prisma.$transaction(
    selisih.map((s) =>
      prisma.stockMovement.create({
        data: {
          id: randomUUID(),
          movementNo: docNo('OPN'),
          movementType: StockMovementType.OPENING,
          productId: s.productId,
          qty: Math.abs(s.beda),
          // Arah dikodekan lewat booth untuk lokasi booth, lewat sufiks
          // referenceType untuk Gudang (yang tidak punya kolom penanda arah).
          fromBoothId: s.lokasi !== WAREHOUSE && s.beda < 0 ? s.lokasi : null,
          toBoothId: s.lokasi !== WAREHOUSE && s.beda > 0 ? s.lokasi : null,
          referenceType: s.beda > 0 ? 'opening_balance_backfill_in' : 'opening_balance_backfill_out',
          referenceId: s.productId,
          businessDate,
          occurredAt: new Date(),
          createdBy: sistem.id,
          note: `Penyeimbang saldo awal: buku besar ${s.ledger}, saldo tercatat ${s.saldo}.`,
        },
      }),
    ),
  );

  console.log(`✓ ${selisih.length} baris penyeimbang ditulis, bertanggal ${businessDate.toISOString().slice(0, 10)}.`);
  console.log('  Saldo tidak diubah. Jalankan ulang tanpa --fix untuk memverifikasi.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
