import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { isiUlangGudang } from './support/warehouse';

(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

/// Laporan shift (layar Check-Out / Rekap Stok Produk) setelah Check-Out DIKONFIRMASI.
/// "Awal" adalah residual (Sisa − Restock + Terjual − penyesuaian), jadi Sisa dan
/// daftar movement yang dijumlahkan harus dari titik waktu yang sama. Return otomatis
/// saat konfirmasi, serta void / refund / revisi penjualan oleh Admin SETELAH shift
/// CLOSED, sama-sama menulis movement ber-shiftSessionId sesudah snapshot penutupan
/// dibuat — tidak boleh menggeser Awal / Restock / Sisa shift yang sudah tutup.
///
/// Booth & Petugas KHUSUS; tanpa membuat produk baru (lihat closing-snapshot spec).
describe('Shift report after closing (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let staffLoginToken: string;
  let boothId: string;
  let productId: string;

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const staff = () => ({ Authorization: `Bearer ${staffToken}` });
  const KODE_BOOTH = 'E2E-RPT';
  const USERNAME = 'e2e_report_staff';
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
    if (!booth) booth = (await request(server()).post('/booths').set(admin()).send({ code: KODE_BOOTH, name: 'E2E Report Booth' }).expect(201)).body;
    boothId = booth.id;

    const gudang = (await request(server()).get('/warehouse-stock').set(admin()).expect(200)).body as { productId: string; qtyOnHand: number }[];
    productId = [...gudang].sort((a, b) => b.qtyOnHand - a.qtyOnHand)[0].productId;
    await isiUlangGudang(app, adminToken, [productId]);

    const buat = await request(server())
      .post('/users')
      .set(admin())
      .send({ username: USERNAME, password: 'obbel123', fullName: 'E2E Report Staff', role: 'BOOTH_STAFF' });
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
    await app.close();
  });

  /// Satu skenario = satu shift baru: tutup shift lama (return otomatis diterima penuh)
  /// supaya booth mulai dari 0, lalu Check-In.
  async function shiftBaru(): Promise<string> {
    const lama = await request(server()).get('/shifts/active').set({ Authorization: `Bearer ${staffLoginToken}` });
    if (lama.status === 200) {
      staffToken = lama.body.accessToken ?? staffLoginToken;
      await tutupShift(lama.body.shiftSessionId);
    }
    // Void / refund oleh Admin setelah shift CLOSED mengembalikan stok ke Booth tanpa
    // shift pemilik (sisa itu terbawa ke shift berikutnya) — kosongkan dulu supaya
    // tiap skenario mulai dari 0.
    for (let i = 0; i < 2; i++) {
      const checkIn = await request(server()).post('/shifts/check-in').set({ Authorization: `Bearer ${staffLoginToken}` }).send(CHECKIN).expect(201);
      staffToken = checkIn.body.accessToken ?? staffLoginToken;
      const sisa = await prisma.boothStock.aggregate({ where: { boothId }, _sum: { qtyOnHand: true } });
      if ((sisa._sum.qtyOnHand ?? 0) === 0) return checkIn.body.shiftSessionId;
      await tutupShift(checkIn.body.shiftSessionId);
    }
    throw new Error('booth E2E-RPT tidak bisa dikosongkan');
  }

  async function tutupShift(shiftSessionId: string) {
    const closing = (await request(server()).post(`/shifts/${shiftSessionId}/closing/start`).set(staff()).expect(201)).body;
    await request(server())
      .post(`/shifts/${shiftSessionId}/closing/confirm`)
      .set(staff())
      .send({
        items: closing.items.map((i: { productId: string; expectedQty: number }) => ({ productId: i.productId, actualQty: i.expectedQty })),
        checkOutLatitude: -6.2088,
        checkOutLongitude: 106.8456,
        checkOutPhotoUrl: 'https://example.com/out.jpg',
      })
      .expect(201);
    const returns = await prisma.stockReturn.findMany({ where: { boothId, status: 'SUBMITTED' }, include: { items: true } });
    for (const r of returns) {
      await request(server())
        .post(`/returns/${r.id}/receive`)
        .set(admin())
        .send({ items: r.items.map((i) => ({ productId: i.productId, qtyReceived: i.qtySubmitted })) })
        .expect(201);
    }
  }

  const kirim = async (qty: number) => {
    const d = (await request(server()).post('/distributions').set(admin()).send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty }] }).expect(201)).body as { id: string };
    await request(server()).post(`/distributions/${d.id}/receive`).set(staff()).send({ items: [{ productId, actualQty: qty }] }).expect(201);
    return d.id;
  };
  const jual = async (shiftSessionId: string, qty: number) =>
    (await request(server()).post('/sales').set(staff()).send({ idempotencyKey: randomUUID(), shiftSessionId, paymentMethod: 'CASH', items: [{ productId, qty }] }).expect(201)).body as { id: string };
  const rekap = async (shiftSessionId: string) => {
    const res = await request(server()).get(`/shifts/${shiftSessionId}/report`).set(staff()).expect(200);
    const i = res.body.items.find((x: { productId: string }) => x.productId === productId);
    return { stokAwal: i.stokAwal, restock: i.restock, sisaSistem: i.sisaSistem, terjual: i.terjual };
  };
  /// Awal 10, jual 2, Restock 3 → Sisa 11. Lalu Check-Out dikonfirmasi.
  async function shiftTertutup() {
    const sid = await shiftBaru();
    await kirim(10);
    const sale = await jual(sid, 2);
    const restock = await kirim(3);
    const sebelumConfirm = await rekap(sid);
    expect(sebelumConfirm).toMatchObject({ stokAwal: 10, restock: 3, terjual: 2, sisaSistem: 11 });
    const closing = (await request(server()).post(`/shifts/${sid}/closing/start`).set(staff()).expect(201)).body;
    await request(server())
      .post(`/shifts/${sid}/closing/confirm`)
      .set(staff())
      .send({
        items: closing.items.map((i: { productId: string; expectedQty: number }) => ({ productId: i.productId, actualQty: i.expectedQty })),
        checkOutLatitude: -6.2088,
        checkOutLongitude: 106.8456,
        checkOutPhotoUrl: 'https://example.com/out.jpg',
      })
      .expect(201);
    return { sid, sale, restock };
  }

  it('closed shift report keeps Awal / Restock / Sisa after the automatic return', async () => {
    const { sid } = await shiftTertutup();
    expect(await rekap(sid)).toMatchObject({ stokAwal: 10, restock: 3, terjual: 2, sisaSistem: 11 });
  });

  it('admin voiding a sale of the closed shift does not move Awal / Restock / Sisa', async () => {
    const { sid, sale } = await shiftTertutup();
    await request(server()).post(`/sales/${sale.id}/void`).set(admin()).send({ idempotencyKey: randomUUID(), reasonCode: 'WRONG_QTY' }).expect(201);
    expect(await rekap(sid)).toMatchObject({ stokAwal: 10, restock: 3, sisaSistem: 11 });
  });

  it('admin refunding (with stock return) a sale of the closed shift does not move Awal / Restock / Sisa', async () => {
    const { sid, sale } = await shiftTertutup();
    await request(server())
      .post(`/sales/${sale.id}/refund`)
      .set(admin())
      .send({ idempotencyKey: randomUUID(), condition: 'REFUND_WITH_STOCK_RETURN', reasonCode: 'WRONG_QTY', items: [{ productId, qty: 1 }] })
      .expect(201);
    expect(await rekap(sid)).toMatchObject({ stokAwal: 10, restock: 3, sisaSistem: 11 });
  });

  it('admin revising a sale of the closed shift does not move Awal / Restock / Sisa', async () => {
    const { sid, sale } = await shiftTertutup();
    await request(server())
      .post(`/sales/${sale.id}/revise`)
      .set(admin())
      .send({ idempotencyKey: randomUUID(), reasonCode: 'WRONG_QTY', items: [{ productId, qty: 1 }] })
      .expect(201);
    expect(await rekap(sid)).toMatchObject({ stokAwal: 10, restock: 3, sisaSistem: 11 });
  });
});
