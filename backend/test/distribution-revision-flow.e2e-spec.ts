import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { isiUlangGudang } from './support/warehouse';
import { bereskanShiftLama } from './support/shift';
import { dampakMutasi } from '../src/modules/stock-movements/arah.util';

// Sama seperti main.ts: kolom bigint (harga produk) ikut di respons beberapa endpoint
// (mis. terima return), dan app e2e ini tidak lewat main.ts.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

/// Alur "Serah Terima → revisi Admin → terima Petugas dengan selisih → koreksi
/// Admin berulang" dari ujung ke ujung, dengan angka yang HARUS benar di tiap
/// langkah: stok Gudang, stok Booth, buku besar (ledger), qty asli tidak diedit
/// (DC-008), dan rekap "Awal / Restock / Sisa" di laporan shift (layar Check-Out).
///
/// Booth & Petugas KHUSUS (kode / username tetap, dipakai ulang): tiap run shift
/// lama ditutup + return-nya diterima penuh, lalu Check-In baru, jadi kiriman
/// pertama di shift ini selalu "Stok Awal". TIDAK membuat produk baru (produk aktif
/// menggeser urutan katalog yang dipakai spec lain).
describe('Distribution revision flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let shiftSessionId: string;
  let boothId: string;
  let productId: string;
  let gudangAwal: number;

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const staff = () => ({ Authorization: `Bearer ${staffToken}` });
  const KODE_BOOTH = 'E2E-REV';
  const USERNAME = 'e2e_revision_staff';
  const CHECKIN = { latitude: -6.2088, longitude: 106.8456, photoUrl: 'https://example.com/selfie.jpg' };

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
    if (!booth) booth = (await request(server()).post('/booths').set(admin()).send({ code: KODE_BOOTH, name: 'E2E Revision Booth' }).expect(201)).body;
    boothId = booth.id;

    // Produk dengan stok Gudang terbanyak; pastikan cukup untuk skenario (35 cup).
    let gudang = (await request(server()).get('/warehouse-stock').set(admin()).expect(200)).body as { productId: string; qtyOnHand: number }[];
    productId = [...gudang].sort((a, b) => b.qtyOnHand - a.qtyOnHand)[0].productId;
    await isiUlangGudang(app, adminToken, [productId]);

    const buat = await request(server())
      .post('/users')
      .set(admin())
      .send({ username: USERNAME, password: 'obbel123', fullName: 'E2E Revision Staff', role: 'BOOTH_STAFF' });
    if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
    const login = await request(server()).post('/auth/login').send({ username: USERNAME, password: 'obbel123' }).expect(200);
    const staffId = JSON.parse(Buffer.from(login.body.accessToken.split('.')[1], 'base64url').toString('utf8')).sub as string;
    const templates = await request(server()).get('/shift-templates').set(admin()).expect(200);
    await request(server())
      .put('/booth-shift-assignments')
      .set(admin())
      .send({ boothId, shiftTemplateId: templates.body[0].id, staffId, force: true })
      .expect(200);

    // Tutup shift run sebelumnya (kalau ada) dan terima return otomatisnya penuh,
    // supaya stok booth 0 dan shift baru mulai bersih.
    staffToken = await bereskanShiftLama(app, adminToken, login.body.accessToken);
    const returns = await prisma.stockReturn.findMany({ where: { boothId, status: 'SUBMITTED' }, include: { items: true } });
    for (const r of returns) {
      await request(server())
        .post(`/returns/${r.id}/receive`)
        .set(admin())
        .send({ items: r.items.map((i) => ({ productId: i.productId, qtyReceived: i.qtySubmitted })) })
        .expect(201);
    }
    const checkIn = await request(server()).post('/shifts/check-in').set({ Authorization: `Bearer ${login.body.accessToken}` }).send(CHECKIN).expect(201);
    staffToken = checkIn.body.accessToken ?? login.body.accessToken;
    shiftSessionId = checkIn.body.shiftSessionId;

    gudang = (await request(server()).get('/warehouse-stock').set(admin()).expect(200)).body;
    gudangAwal = gudang.find((g) => g.productId === productId)!.qtyOnHand;
    expect(await stokBooth()).toBe(0);
  });

  afterAll(async () => {
    await app.close();
  });

  async function stokBooth(): Promise<number> {
    const res = await request(server()).get('/booth-stock/mine').set(staff()).expect(200);
    return res.body.find((r: { productId: string }) => r.productId === productId)?.qtyOnHand ?? 0;
  }
  async function stokGudang(): Promise<number> {
    const res = await request(server()).get('/warehouse-stock').set(admin()).expect(200);
    return res.body.find((r: { productId: string }) => r.productId === productId).qtyOnHand;
  }
  /// Saldo booth dari BUKU BESAR (jumlah dampak semua movement) — harus sama dengan BoothStock.
  async function saldoBukuBesar(): Promise<number> {
    const movs = await prisma.stockMovement.findMany({ where: { productId, OR: [{ toBoothId: boothId }, { fromBoothId: boothId }] } });
    return movs.reduce((sum, m) => sum + dampakMutasi(m, boothId).delta, 0);
  }
  async function rekap() {
    const res = await request(server()).get(`/shifts/${shiftSessionId}/report`).set(staff()).expect(200);
    return res.body.items.find((i: { productId: string }) => i.productId === productId) as {
      stokAwal: number; restock: number; terjual: number; retur: number; sisaSistem: number;
    };
  }
  const kirim = async (qty: number) =>
    (await request(server()).post('/distributions').set(admin()).send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty }] }).expect(201)).body as { id: string };
  const terima = (id: string, actualQty: number) =>
    request(server()).post(`/distributions/${id}/receive`).set(staff()).send({ items: [{ productId, actualQty }], note: 'e2e' }).expect(201);
  const koreksi = (id: string, qty: number, tindakLanjut: 'SALAH_HITUNG' | 'RUSAK') =>
    request(server())
      .post(`/distributions/${id}/correct-receipt`)
      .set(admin())
      .send({ idempotencyKey: randomUUID(), items: [{ productId, qty, tindakLanjut }], reasonCode: 'WRONG_QTY' })
      .expect(201);
  const rawReceived = async (id: string) =>
    (await prisma.stockDistributionItem.findFirstOrThrow({ where: { distributionId: id, productId } })).qtyReceived;

  let distId: string;

  it('admin sends then revises the SENT document: only the delta leaves the warehouse, booth untouched', async () => {
    const v1 = await kirim(22);
    expect(await stokGudang()).toBe(gudangAwal - 22);
    expect(await stokBooth()).toBe(0);

    const v2 = (
      await request(server())
        .post(`/distributions/${v1.id}/revise`)
        .set(admin())
        .send({ idempotencyKey: randomUUID(), items: [{ productId, qty: 25 }], reasonCode: 'WRONG_QTY' })
        .expect(201)
    ).body as { id: string };
    distId = v2.id;

    expect(await stokGudang()).toBe(gudangAwal - 25);
    expect(await stokBooth()).toBe(0);
    expect((await prisma.stockDistribution.findUniqueOrThrow({ where: { id: v1.id } })).status).toBe('CANCELLED');
    expect((await prisma.stockDistribution.findUniqueOrThrow({ where: { id: v2.id } })).status).toBe('SENT');
  });

  it('staff receives 23 of 25: booth gets 23, warehouse unchanged, first arrival is the opening stock', async () => {
    await terima(distId, 23);
    expect(await stokBooth()).toBe(23);
    expect(await stokGudang()).toBe(gudangAwal - 25);
    expect((await prisma.stockDistribution.findUniqueOrThrow({ where: { id: distId } })).status).toBe('DISCREPANCY');
    expect(await rawReceived(distId)).toBe(23);

    expect(await rekap()).toMatchObject({ stokAwal: 23, restock: 0, terjual: 0, sisaSistem: 23 });
    expect(await saldoBukuBesar()).toBe(23);
  });

  it('admin corrects the receipt repeatedly: each correction applies only its own delta, original qty is kept', async () => {
    await koreksi(distId, 24, 'SALAH_HITUNG'); // +1
    expect(await stokBooth()).toBe(24);
    await koreksi(distId, 25, 'SALAH_HITUNG'); // +1 lagi, BUKAN +2 (koreksi berulang)
    expect(await stokBooth()).toBe(25);
    expect(await rawReceived(distId)).toBe(23); // DC-008: qty asli tidak diedit

    await koreksi(distId, 22, 'RUSAK'); // -3
    expect(await stokBooth()).toBe(22);
    expect(await stokGudang()).toBe(gudangAwal - 25); // koreksi penerimaan tidak menyentuh Gudang
    expect((await prisma.stockDistributionItem.findFirstOrThrow({ where: { distributionId: distId, productId } })).discrepancyReasonCode).toBe('RUSAK');
    expect(await saldoBukuBesar()).toBe(22);

    // Kiriman PERTAMA = Stok Awal: koreksinya ikut ke Awal (Awal = qty yang benar-benar diterima booth).
    expect(await rekap()).toMatchObject({ stokAwal: 22, restock: 0, sisaSistem: 22 });
  });

  it('second delivery is a Restock: correcting it must move Restock, never the opening stock', async () => {
    const d2 = await kirim(10);
    await terima(d2.id, 9);
    expect(await stokBooth()).toBe(31);
    expect(await rekap()).toMatchObject({ stokAwal: 22, restock: 9, sisaSistem: 31 });

    await koreksi(d2.id, 10, 'SALAH_HITUNG'); // +1
    expect(await stokBooth()).toBe(32);
    expect(await rekap()).toMatchObject({ stokAwal: 22, restock: 10, sisaSistem: 32 });

    await koreksi(d2.id, 8, 'RUSAK'); // -2
    expect(await stokBooth()).toBe(30);
    expect(await rekap()).toMatchObject({ stokAwal: 22, restock: 8, sisaSistem: 30 });

    expect(await stokGudang()).toBe(gudangAwal - 35);
    expect(await saldoBukuBesar()).toBe(30);
  });
});
