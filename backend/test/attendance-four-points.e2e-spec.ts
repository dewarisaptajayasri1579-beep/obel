import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { isiUlangGudang } from './support/warehouse';
import { bereskanShiftLama } from './support/shift';

(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

/// BR-042 / BR-043 — absen 4 titik (Berangkat di Gudang → Tiba di Booth → Check-Out
/// di Booth → Kembali di Gudang) dengan radius yang ditolak, izin Admin (lokasi &
/// pulang awal), dan uang jalan per booth yang ikut ke setoran kas.
///
/// Booth & Barista KHUSUS. Koordinat Gudang (AppSettings) dan Booth diatur di test
/// lalu dikembalikan; jam selesai shift diatur langsung di DB test (jam dinding tidak
/// bisa dikendalikan). Setiap shift ditutup sampai Kembali, jadi tidak ada sisa.
describe('Attendance four points (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let loginToken: string;
  let staffToken: string;
  let staffId: string;
  let boothId: string;
  let productId: string;
  let price: number;
  let settingsAwal: { warehouseLatitude: unknown; warehouseLongitude: unknown; attendanceRadiusMeters: number; earlyCheckoutToleranceMinutes: number };

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const staff = () => ({ Authorization: `Bearer ${staffToken}` });
  const KODE_BOOTH = 'E2E-ABSEN';
  const USERNAME = 'e2e_absen_staff';
  const UANG_JALAN = 50_000;
  // ±1,1 km antar titik — jauh di luar radius 100 m.
  const GUDANG = { latitude: -7.5, longitude: 110.6 };
  const BOOTH = { latitude: -7.51, longitude: 110.6 };
  const JAUH = { latitude: -7.52, longitude: 110.6 };
  const FOTO = { photoUrl: 'https://example.com/absen.jpg' };

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
    if (!booth) booth = (await request(server()).post('/booths').set(admin()).send({ code: KODE_BOOTH, name: 'E2E Absen Booth' }).expect(201)).body;
    boothId = booth.id;

    const gudang = (await request(server()).get('/warehouse-stock').set(admin()).expect(200)).body as { productId: string; qtyOnHand: number }[];
    productId = [...gudang].sort((a, b) => b.qtyOnHand - a.qtyOnHand)[0].productId;
    await isiUlangGudang(app, adminToken, [productId]);
    price = (await request(server()).get('/products').set(admin()).expect(200)).body.find((p: { id: string }) => p.id === productId).sellPrice;

    const buat = await request(server())
      .post('/users')
      .set(admin())
      .send({ username: USERNAME, password: 'obbel123', fullName: 'E2E Absen Staff', role: 'BOOTH_STAFF' });
    if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
    loginToken = (await request(server()).post('/auth/login').send({ username: USERNAME, password: 'obbel123' }).expect(200)).body.accessToken;
    staffId = JSON.parse(Buffer.from(loginToken.split('.')[1], 'base64url').toString('utf8')).sub as string;
    const templates = await request(server()).get('/shift-templates').set(admin()).expect(200);
    await request(server())
      .put('/booth-shift-assignments')
      .set(admin())
      .send({ boothId, shiftTemplateId: templates.body[0].id, staffId, force: true })
      .expect(200);

    // Sisa run gagal sebelumnya dibereskan SEBELUM koordinat diatur (helper absen di titik test umum).
    await prisma.booth.update({ where: { id: boothId }, data: { latitude: null, longitude: null } });
    staffToken = await bereskanShiftLama(app, adminToken, loginToken);
    await terimaReturnTertunda();
    // Izin hari ini yang tidak terpakai (run sebelumnya gagal di tengah) akan meloloskan
    // skenario penolakan di bawah — hapus, hanya milik Barista test ini.
    await prisma.attendancePermit.deleteMany({ where: { staffId, usedAt: null } });

    settingsAwal = (await request(server()).get('/app-settings').set(admin()).expect(200)).body;
    await request(server())
      .patch('/app-settings')
      .set(admin())
      .send({ warehouseLatitude: GUDANG.latitude, warehouseLongitude: GUDANG.longitude, attendanceRadiusMeters: 100, earlyCheckoutToleranceMinutes: 15 })
      .expect(200);
    await request(server()).patch(`/booths/${boothId}`).set(admin()).send({ ...BOOTH, cashFloat: UANG_JALAN }).expect(200);
  });

  afterAll(async () => {
    await request(server())
      .patch('/app-settings')
      .set(admin())
      .send({
        warehouseLatitude: settingsAwal.warehouseLatitude,
        warehouseLongitude: settingsAwal.warehouseLongitude,
        attendanceRadiusMeters: settingsAwal.attendanceRadiusMeters,
        earlyCheckoutToleranceMinutes: settingsAwal.earlyCheckoutToleranceMinutes,
      });
    await app.close();
  });

  async function terimaReturnTertunda() {
    const returns = await prisma.stockReturn.findMany({ where: { boothId, status: 'SUBMITTED' }, include: { items: true } });
    for (const r of returns) {
      await request(server())
        .post(`/returns/${r.id}/receive`)
        .set(admin())
        .send({ items: r.items.map((i) => ({ productId: i.productId, qtyReceived: i.qtySubmitted })) })
        .expect(201);
    }
  }
  const izin = (type: 'LOCATION' | 'EARLY_CHECKOUT', point?: string) =>
    request(server()).post('/attendance-permits').set(admin()).send({ staffId, type, point, reason: 'e2e izin' }).expect(201);
  const berangkat = (pos: { latitude: number; longitude: number }) =>
    request(server()).post('/shifts/check-in').set({ Authorization: `Bearer ${loginToken}` }).send({ ...pos, ...FOTO });
  const tiba = (sid: string, pos: { latitude: number; longitude: number }) =>
    request(server()).post(`/shifts/${sid}/arrive`).set(staff()).send({ ...pos, ...FOTO });
  const kembali = (sid: string, pos: { latitude: number; longitude: number }) =>
    request(server()).post(`/shifts/${sid}/return`).set(staff()).send({ ...pos, ...FOTO });
  const mulaiCheckOut = (sid: string) => request(server()).post(`/shifts/${sid}/closing/start`).set(staff());
  const konfirmasiCheckOut = async (sid: string, pos: { latitude: number; longitude: number }) => {
    const closing = (await mulaiCheckOut(sid).expect(201)).body;
    return request(server())
      .post(`/shifts/${sid}/closing/confirm`)
      .set(staff())
      .send({
        items: closing.items.map((i: { productId: string; expectedQty: number }) => ({ productId: i.productId, actualQty: i.expectedQty })),
        checkOutLatitude: pos.latitude,
        checkOutLongitude: pos.longitude,
        checkOutPhotoUrl: FOTO.photoUrl,
      });
  };
  const aturJamSelesai = (sid: string, menitDariSekarang: number) =>
    prisma.shiftSession.update({ where: { id: sid }, data: { scheduledEndAt: new Date(Date.now() + menitDariSekarang * 60_000) } });

  let sid1: string;

  it('Berangkat outside the warehouse radius is rejected, an admin LOCATION permit lets it through once, and the cash float is copied', async () => {
    const ditolak = await berangkat(JAUH).expect(400);
    expect(ditolak.body.code).toBe('OUTSIDE_ATTENDANCE_RADIUS');
    expect(ditolak.body.details.radius).toBe(100);
    expect(await prisma.shiftSession.count({ where: { staffId, status: 'OPEN' } })).toBe(0);

    await izin('LOCATION', 'DEPART');
    const ok = await berangkat(JAUH).expect(201);
    sid1 = ok.body.shiftSessionId;
    staffToken = ok.body.accessToken ?? loginToken;
    expect(ok.body).toMatchObject({ arrivedAt: null, cashFloat: UANG_JALAN });
    const permit = await prisma.attendancePermit.findFirstOrThrow({ where: { staffId, point: 'DEPART' }, orderBy: { grantedAt: 'desc' } });
    expect(permit.usedShiftSessionId).toBe(sid1);
  });

  it('Check-Out needs Tiba first; Tiba is checked against the booth', async () => {
    expect((await mulaiCheckOut(sid1).expect(400)).body.code).toBe('ARRIVAL_REQUIRED');
    expect((await tiba(sid1, JAUH).expect(400)).body.code).toBe('OUTSIDE_ATTENDANCE_RADIUS');
    await tiba(sid1, BOOTH).expect(201);
    expect((await tiba(sid1, BOOTH).expect(201)).body.arrivedAt).toBeTruthy(); // idempotent
  });

  it('Check-Out before the end time is rejected, outside the booth too; the deposit expects cash sales + cash float', async () => {
    const dist = (await request(server()).post('/distributions').set(admin()).send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty: 2 }] }).expect(201)).body;
    await request(server()).post(`/distributions/${dist.id}/receive`).set(staff()).send({ items: [{ productId, actualQty: 2 }] }).expect(201);
    await request(server()).post('/sales').set(staff()).send({ idempotencyKey: randomUUID(), shiftSessionId: sid1, paymentMethod: 'CASH', items: [{ productId, qty: 1 }] }).expect(201);

    await aturJamSelesai(sid1, 120);
    const awal = await mulaiCheckOut(sid1).expect(400);
    expect(awal.body.code).toBe('EARLY_CHECKOUT');
    expect(awal.body.details.allowedFrom).toBeTruthy();

    await aturJamSelesai(sid1, 10); // dalam toleransi 15 menit
    expect((await konfirmasiCheckOut(sid1, JAUH)).body.code).toBe('OUTSIDE_ATTENDANCE_RADIUS');
    expect((await konfirmasiCheckOut(sid1, BOOTH)).status).toBe(201);
    const shift = await prisma.shiftSession.findUniqueOrThrow({ where: { id: sid1 }, include: { cashDeposit: true } });
    expect(shift.status).toBe('CLOSED');
    expect(Number(shift.cashDeposit!.expectedAmount)).toBe(price + UANG_JALAN);
  });

  it('approvals and the next Berangkat wait for Kembali at the warehouse', async () => {
    const pending = await request(server()).get('/shifts/pending-return').set(staff()).expect(200);
    expect(pending.body).toMatchObject({ shiftSessionId: sid1, cashFloat: UANG_JALAN, expectedCash: price + UANG_JALAN });

    const retur = await prisma.stockReturn.findFirstOrThrow({ where: { shiftSessionId: sid1, status: 'SUBMITTED' }, include: { items: true } });
    const terima = () =>
      request(server())
        .post(`/returns/${retur.id}/receive`)
        .set(admin())
        .send({ items: retur.items.map((i) => ({ productId: i.productId, qtyReceived: i.qtySubmitted })) });
    const setor = () => request(server()).post(`/shifts/${sid1}/cash-deposit/confirm`).set(admin()).send({ depositedAmount: price + UANG_JALAN });
    expect((await terima().expect(400)).body.code).toBe('BARISTA_NOT_RETURNED');
    expect((await setor().expect(400)).body.code).toBe('BARISTA_NOT_RETURNED');
    expect((await berangkat(GUDANG).expect(400)).body.code).toBe('PREVIOUS_SHIFT_NOT_RETURNED');

    expect((await kembali(sid1, JAUH).expect(400)).body.code).toBe('OUTSIDE_ATTENDANCE_RADIUS');
    await kembali(sid1, GUDANG).expect(201);
    expect((await request(server()).get('/shifts/pending-return').set(staff()).expect(200)).body).toEqual({});
    await terima().expect(201);
    expect((await setor().expect(201)).body.status).toBe('CONFIRMED');
  });

  it('an admin EARLY_CHECKOUT permit allows leaving early once; admin history shows the four points', async () => {
    const ok = await berangkat(GUDANG).expect(201);
    const sid2 = ok.body.shiftSessionId as string;
    staffToken = ok.body.accessToken ?? loginToken;
    await tiba(sid2, BOOTH).expect(201);
    await aturJamSelesai(sid2, 120);
    expect((await mulaiCheckOut(sid2).expect(400)).body.code).toBe('EARLY_CHECKOUT');

    await izin('EARLY_CHECKOUT');
    expect((await konfirmasiCheckOut(sid2, BOOTH)).status).toBe(201);
    expect((await prisma.shiftSession.findUniqueOrThrow({ where: { id: sid2 } })).status).toBe('CLOSED');
    const permit = await prisma.attendancePermit.findFirstOrThrow({ where: { staffId, type: 'EARLY_CHECKOUT' }, orderBy: { grantedAt: 'desc' } });
    expect(permit.usedShiftSessionId).toBe(sid2);
    await kembali(sid2, GUDANG).expect(201);
    await terimaReturnTertunda();

    const riwayat = (await request(server()).get('/shifts/admin-history').set(admin()).expect(200)).body as {
      id: string;
      cashFloat: number;
      absen: Record<'berangkat' | 'tiba' | 'selesai' | 'kembali', { distanceMeters: number | null; acuanKosong: boolean; izin: { reason: string } | null }>;
      izinPulangAwal: { reason: string } | null;
    }[];
    const s1 = riwayat.find((r) => r.id === sid1)!;
    expect(s1.cashFloat).toBe(UANG_JALAN);
    expect(s1.absen.berangkat.distanceMeters).toBeGreaterThan(1000);
    expect(s1.absen.berangkat.izin?.reason).toBe('e2e izin');
    expect(s1.absen.tiba).toMatchObject({ distanceMeters: 0, izin: null, acuanKosong: false });
    expect(riwayat.find((r) => r.id === sid2)!.izinPulangAwal?.reason).toBe('e2e izin');
  });

  it('a missing reference coordinate does not block attendance', async () => {
    await request(server()).patch('/app-settings').set(admin()).send({ warehouseLatitude: null, warehouseLongitude: null }).expect(200);
    const ok = await berangkat(JAUH).expect(201);
    const sid3 = ok.body.shiftSessionId as string;
    staffToken = ok.body.accessToken ?? loginToken;
    await tiba(sid3, BOOTH).expect(201);
    await izin('EARLY_CHECKOUT');
    await aturJamSelesai(sid3, 120);
    expect((await konfirmasiCheckOut(sid3, BOOTH)).status).toBe(201);
    await kembali(sid3, JAUH).expect(201);
    await terimaReturnTertunda();
    const riwayat = (await request(server()).get('/shifts/admin-history').set(admin()).expect(200)).body as { id: string; absen: { berangkat: { acuanKosong: boolean; distanceMeters: number | null } } }[];
    expect(riwayat.find((r) => r.id === sid3)!.absen.berangkat).toMatchObject({ acuanKosong: true, distanceMeters: null });
  });
});
