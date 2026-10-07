import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { isiUlangGudang } from './support/warehouse';
import { bereskanShiftLama } from './support/shift';

(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

/// Ringkasan penjualan shift (struk Check-Out): hanya penjualan yang sah — sale yang direvisi
/// (induknya ikut VOIDED) tidak boleh terhitung pembatalan, sale Split masuk ke dua metode, dan
/// rincian kategori/produk dijumlahkan dari baris item. Angka yang diharapkan dihitung dari harga
/// produk yang dijual, bukan dibaca balik dari endpoint-nya.
describe('Shift sales summary (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let staffLoginToken: string;
  let boothId: string;
  let produkA: { id: string; name: string; harga: number; kategori: string };
  let produkB: { id: string; name: string; harga: number; kategori: string };
  const fotoBukti: string[] = [];

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const staff = () => ({ Authorization: `Bearer ${staffToken}` });
  const KODE_BOOTH = 'E2E-SUM';
  const USERNAME = 'e2e_summary_staff';
  const CHECKIN = { latitude: -6.2088, longitude: 106.8456, photoUrl: 'https://example.com/selfie.jpg' };
  // JPEG 1x1 minimal — backend hanya cek mimetype & ukuran.
  const JPEG = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64',
  );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminToken = (await request(server()).post('/auth/login').send({ username: 'admin', password: 'obbel123' }).expect(200)).body.accessToken;

    const booths = await request(server()).get('/booths').set(admin()).expect(200);
    let booth = booths.body.find((b: { code: string }) => b.code === KODE_BOOTH);
    if (!booth) booth = (await request(server()).post('/booths').set(admin()).send({ code: KODE_BOOTH, name: 'E2E Summary Booth' }).expect(201)).body;
    boothId = booth.id;

    // Dua produk aktif dari Gudang yang stoknya terbanyak; kategori dibaca dari DB sebagai pembanding.
    const gudang = (await request(server()).get('/warehouse-stock').set(admin()).expect(200)).body as { productId: string; qtyOnHand: number }[];
    const terbanyak = [...gudang].sort((a, b) => b.qtyOnHand - a.qtyOnHand).slice(0, 2);
    await isiUlangGudang(app, adminToken, terbanyak.map((g) => g.productId));
    const baca = async (id: string) => {
      const p = await prisma.product.findUniqueOrThrow({ where: { id }, include: { category: true } });
      return { id, name: p.name, harga: Number(p.sellPrice), kategori: p.category?.name ?? 'Lainnya' };
    };
    [produkA, produkB] = [await baca(terbanyak[0].productId), await baca(terbanyak[1].productId)];

    const buat = await request(server())
      .post('/users')
      .set(admin())
      .send({ username: USERNAME, password: 'obbel123', fullName: 'E2E Summary Staff', role: 'BOOTH_STAFF' });
    if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
    const login = await request(server()).post('/auth/login').send({ username: USERNAME, password: 'obbel123' }).expect(200);
    staffLoginToken = login.body.accessToken;
    const staffId = JSON.parse(Buffer.from(staffLoginToken.split('.')[1], 'base64url').toString('utf8')).sub as string;
    const templates = await request(server()).get('/shift-templates').set(admin()).expect(200);
    await request(server())
      .put('/booth-shift-assignments')
      .set(admin())
      .send({ boothId, shiftTemplateId: templates.body[0].id, staffId, force: true })
      .expect(200);
  });

  afterAll(async () => {
    for (const url of fotoBukti) {
      const file = join(process.cwd(), 'uploads', 'payment-proofs', url.split('/').pop()!);
      if (existsSync(file)) unlinkSync(file);
    }
    await app.close();
  });

  /// Tutup shift lama (supaya Barista bisa Check-In lagi), lalu Check-In shift baru.
  async function shiftBaru(): Promise<string> {
    staffToken = await bereskanShiftLama(app, adminToken, staffLoginToken);
    const checkIn = await request(server()).post('/shifts/check-in').set({ Authorization: `Bearer ${staffLoginToken}` }).send(CHECKIN).expect(201);
    staffToken = checkIn.body.accessToken ?? staffLoginToken;
    return checkIn.body.shiftSessionId;
  }

  const kirim = async (productId: string, qty: number) => {
    const d = (await request(server()).post('/distributions').set(admin()).send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty }] }).expect(201)).body as { id: string };
    await request(server()).post(`/distributions/${d.id}/receive`).set(staff()).send({ items: [{ productId, actualQty: qty }] }).expect(201);
  };
  const bukti = async () => {
    const res = await request(server()).post('/sales/payment-proof/photo').set(staff()).attach('file', JPEG, { filename: 'bukti.jpg', contentType: 'image/jpeg' }).expect(201);
    fotoBukti.push(res.body.photoUrl);
    return res.body.photoUrl as string;
  };
  const jual = async (shiftSessionId: string, body: Record<string, unknown>) =>
    (await request(server()).post('/sales').set(staff()).send({ idempotencyKey: randomUUID(), shiftSessionId, ...body }).expect(201)).body as { id: string };
  const ringkasan = async (shiftSessionId: string, token = staff()) => (await request(server()).get(`/shifts/${shiftSessionId}/sales-summary`).set(token).expect(200)).body;

  it('sums only the valid sales of the shift: discount, Split on both methods, cancellation vs revision, category and product', async () => {
    const sid = await shiftBaru();
    await kirim(produkA.id, 20);
    await kirim(produkB.id, 20);
    const { harga: ha } = produkA;
    const { harga: hb } = produkB;

    await jual(sid, { paymentMethod: 'CASH', discount: 1000, items: [{ productId: produkA.id, qty: 2 }] });
    await jual(sid, { paymentMethod: 'QRIS', qrisProofPhotoUrl: await bukti(), items: [{ productId: produkB.id, qty: 1 }] });
    await jual(sid, {
      payments: [{ method: 'CASH', amount: 1 }, { method: 'QRIS', amount: ha - 1 }],
      qrisProofPhotoUrl: await bukti(),
      items: [{ productId: produkA.id, qty: 1 }],
    });
    // Dibatalkan sungguhan: masuk Pembatalan, tidak masuk penjualan.
    const batal = await jual(sid, { paymentMethod: 'CASH', items: [{ productId: produkB.id, qty: 1 }] });
    await request(server()).post(`/sales/${batal.id}/void`).set(admin()).send({ idempotencyKey: randomUUID(), reasonCode: 'TRANSACTION_NEVER_HAPPENED' }).expect(201);
    // Direvisi 1 -> 2 cup: versi lama tidak terhitung penjualan maupun pembatalan; hanya versi baru.
    const direvisi = await jual(sid, { paymentMethod: 'CASH', items: [{ productId: produkA.id, qty: 1 }] });
    await request(server())
      .post(`/sales/${direvisi.id}/revise`)
      .set(admin())
      .send({ idempotencyKey: randomUUID(), reasonCode: 'WRONG_QTY', items: [{ productId: produkA.id, qty: 2 }] })
      .expect(201);

    const cashFloat = Number((await prisma.shiftSession.findUniqueOrThrow({ where: { id: sid } })).cashFloat);
    const hasil = await ringkasan(sid);

    const subtotal = 2 * ha + hb + ha + 2 * ha;
    const tunai = 2 * ha - 1000 + 1 + 2 * ha;
    const qris = hb + (ha - 1);
    expect(hasil).toMatchObject({
      boothName: expect.any(String),
      transaksi: 4,
      cup: 6,
      subtotal,
      diskon: 1000,
      total: subtotal - 1000,
      pembatalan: { count: 1, cup: 1, amount: hb },
      tunai: { count: 3, amount: tunai },
      qris: { count: 2, amount: qris },
      uangJalan: cashFloat,
      setoranDiharapkan: tunai + cashFloat,
    });
    // Kedua metode menjumlah ke total penjualan (tidak ada rupiah yang hilang atau ganda).
    expect(hasil.tunai.amount + hasil.qris.amount).toBe(hasil.total);

    // Rincian: qty/nominal per produk (A 5 cup, B 1 cup) dikelompokkan per kategori.
    const qtyA = 5;
    const qtyB = 1;
    const kategoriIni = new Map<string, { qty: number; amount: number; produk: Map<string, { qty: number; amount: number }> }>();
    for (const [p, qty] of [[produkA, qtyA], [produkB, qtyB]] as const) {
      const k = kategoriIni.get(p.kategori) ?? { qty: 0, amount: 0, produk: new Map() };
      k.qty += qty;
      k.amount += qty * p.harga;
      k.produk.set(p.name, { qty, amount: qty * p.harga });
      kategoriIni.set(p.kategori, k);
    }
    expect(hasil.kategori).toHaveLength(kategoriIni.size);
    for (const k of hasil.kategori as { name: string; qty: number; amount: number; produk: { name: string; qty: number; amount: number }[] }[]) {
      const harapan = kategoriIni.get(k.name);
      expect(harapan).toBeDefined();
      expect(k).toMatchObject({ qty: harapan!.qty, amount: harapan!.amount });
      expect(k.produk).toHaveLength(harapan!.produk.size);
      for (const p of k.produk) expect(p).toMatchObject(harapan!.produk.get(p.name)!);
    }
    // Nominal kategori (sebelum diskon) menjumlah ke subtotal.
    expect((hasil.kategori as { amount: number }[]).reduce((n, k) => n + k.amount, 0)).toBe(subtotal);

    // Admin boleh membacanya juga (halaman Laporan Kembali).
    expect((await ringkasan(sid, admin())).total).toBe(subtotal - 1000);

    // Rekap Penjualan di laporan shift (layar Check-Out & Setor & Pengembalian Stok) memakai
    // aturan yang sama: versi lama sale yang direvisi tidak ikut terdaftar.
    const laporan = (await request(server()).get(`/shifts/${sid}/report`).set(staff()).expect(200)).body as {
      transaksi: { saleId: string; cupCount: number; total: number; tunai: number; qris: number }[];
      totalPenjualan: number;
    };
    expect(laporan.transaksi).toHaveLength(hasil.transaksi);
    expect(laporan.transaksi.map((t) => t.saleId)).not.toContain(direvisi.id);
    expect(laporan.transaksi.reduce((n, t) => n + t.cupCount, 0)).toBe(hasil.cup);
    expect(laporan.transaksi.reduce((n, t) => n + t.total, 0)).toBe(hasil.total);
    expect(laporan.transaksi.reduce((n, t) => n + t.tunai + t.qris, 0)).toBe(laporan.totalPenjualan);
  });

  it('is all zero for a shift without sales and rejects a shift of someone else or without token', async () => {
    const sid = await shiftBaru();
    const kosong = await ringkasan(sid);
    expect(kosong).toMatchObject({
      transaksi: 0,
      cup: 0,
      subtotal: 0,
      diskon: 0,
      total: 0,
      pembatalan: { count: 0, cup: 0, amount: 0 },
      tunai: { count: 0, amount: 0 },
      qris: { count: 0, amount: 0 },
      kategori: [],
    });
    await request(server()).get(`/shifts/${sid}/sales-summary`).expect(401);
    // Barista lain (seed booth01) tidak boleh membaca shift milik e2e_summary_staff.
    const lain = (await request(server()).post('/auth/login').send({ username: 'booth01', password: 'obbel123' }).expect(200)).body.accessToken as string;
    const ditolak = await request(server()).get(`/shifts/${sid}/sales-summary`).set({ Authorization: `Bearer ${lain}` }).expect(400);
    expect(ditolak.body.code).toBe('UNAUTHORIZED_BOOTH');
    const hilang = await request(server()).get(`/shifts/${randomUUID()}/sales-summary`).set(staff()).expect(400);
    expect(hilang.body.code).toBe('NOT_FOUND');
  });
});
