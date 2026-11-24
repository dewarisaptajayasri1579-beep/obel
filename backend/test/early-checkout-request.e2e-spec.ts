import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { absenKembali, absenTiba, bereskanShiftLama, LOKASI_TEST } from './support/shift';

/// Barista mengajukan pulang cepat dari layar Check-Out (B4); Admin mendapat notifikasi lalu
/// menyetujui atau menolak; setelah disetujui Barista bisa Check-Out.
///
/// Booth & Petugas khusus spec ini. Izin Petugas ini dihapus di awal run supaya status
/// pengajuan hari ini tidak terbawa dari run sebelumnya.
describe('Early checkout requested by the Barista (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let staffId: string;
  let shiftSessionId: string;

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const staff = () => ({ Authorization: `Bearer ${staffToken}` });
  const FOTO = 'https://example.com/absen.jpg';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminToken = (await request(server()).post('/auth/login').send({ username: 'admin', password: 'obbel123' }).expect(200)).body
      .accessToken;
    const booths = await request(server()).get('/booths').set(admin()).expect(200);
    let booth = booths.body.find((b: { code: string }) => b.code === 'E2E-ECR');
    if (!booth) booth = (await request(server()).post('/booths').set(admin()).send({ code: 'E2E-ECR', name: 'E2E Early Checkout' }).expect(201)).body;

    const username = 'e2e_ecr_staff';
    const buat = await request(server()).post('/users').set(admin()).send({ username, password: 'obbel123', fullName: 'E2E Pulang Cepat', role: 'BOOTH_STAFF' });
    if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
    const login = await request(server()).post('/auth/login').send({ username, password: 'obbel123' }).expect(200);
    staffId = JSON.parse(Buffer.from(login.body.accessToken.split('.')[1], 'base64url').toString('utf8')).sub as string;
    const templates = (await request(server()).get('/shift-templates').set(admin()).expect(200)).body as { id: string }[];
    await request(server()).put('/booth-shift-assignments').set(admin()).send({ boothId: booth.id, shiftTemplateId: templates[0].id, staffId, force: true }).expect(200);

    const token = await bereskanShiftLama(app, adminToken, login.body.accessToken);
    await prisma.attendancePermit.deleteMany({ where: { staffId } });
    const checkIn = await request(server()).post('/shifts/check-in').set({ Authorization: `Bearer ${token}` }).send({ ...LOKASI_TEST, photoUrl: FOTO }).expect(201);
    staffToken = checkIn.body.accessToken ?? token;
    shiftSessionId = checkIn.body.shiftSessionId;
    await absenTiba(app, staffToken, shiftSessionId);
    // Two hours before the end of the shift: Check-Out needs a permit.
    await prisma.shiftSession.update({ where: { id: shiftSessionId }, data: { scheduledEndAt: new Date(Date.now() + 120 * 60_000) } });
  });

  afterAll(async () => {
    await app.close();
  });

  const mulaiCheckOut = () => request(server()).post(`/shifts/${shiftSessionId}/closing/start`).set(staff());
  const ajukan = (reason = 'Anak sakit, dijemput sekolah') =>
    request(server()).post('/attendance-permits/early-checkout-request').set(staff()).send({ reason });
  const milikSaya = async () => (await request(server()).get('/attendance-permits/early-checkout-request/mine').set(staff()).expect(200)).body;

  it('a request notifies Admin but does not unlock Check-Out until approved', async () => {
    expect((await mulaiCheckOut().expect(400)).body.code).toBe('EARLY_CHECKOUT');

    const pertama = (await ajukan().expect(201)).body;
    expect(pertama.status).toBe('REQUESTED');
    expect((await ajukan('tap ganda').expect(201)).body.id).toBe(pertama.id); // idempotent

    const notif = (await request(server()).get('/notifications').set(admin()).expect(200)).body as { id: string; message: string }[];
    expect(notif.find((n) => n.id === 'pending:early-checkout')?.message).toContain('E2E Pulang Cepat');

    expect((await mulaiCheckOut().expect(400)).body.code).toBe('EARLY_CHECKOUT');
  });

  it('a rejection is shown to the Barista with its reason, who can ask again', async () => {
    const { id } = await milikSaya();
    await request(server()).post(`/attendance-permits/${id}/reject`).set(admin()).send({ reason: 'Booth sedang ramai' }).expect(201);
    expect(await milikSaya()).toMatchObject({ id, status: 'REJECTED', rejectReason: 'Booth sedang ramai' });
    expect((await mulaiCheckOut().expect(400)).body.code).toBe('EARLY_CHECKOUT');

    const kedua = (await ajukan('Sudah ada pengganti').expect(201)).body;
    expect(kedua.id).not.toBe(id);
    expect(kedua.status).toBe('REQUESTED');
  });

  it('only Admin decides, only the Barista requests', async () => {
    const { id } = await milikSaya();
    await request(server()).post(`/attendance-permits/${id}/approve`).set(staff()).expect(403);
    await request(server()).post('/attendance-permits/early-checkout-request').set(admin()).send({ reason: 'bukan Barista' }).expect(403);
  });

  it('after approval the Barista checks out once and the permit is used', async () => {
    const { id } = await milikSaya();
    expect((await request(server()).post(`/attendance-permits/${id}/approve`).set(admin()).expect(201)).body.status).toBe('GRANTED');
    expect((await request(server()).post(`/attendance-permits/${id}/reject`).set(admin()).send({ reason: 'terlambat' }).expect(400)).body.code).toBe(
      'PERMIT_ALREADY_DECIDED',
    );
    const notif = (await request(server()).get('/notifications').set(admin()).expect(200)).body as { id: string }[];
    expect(notif.some((n) => n.id === 'pending:early-checkout')).toBe(false);

    const closing = (await mulaiCheckOut().expect(201)).body;
    await request(server())
      .post(`/shifts/${shiftSessionId}/closing/confirm`)
      .set(staff())
      .send({
        items: closing.items.map((i: { productId: string; expectedQty: number }) => ({ productId: i.productId, actualQty: i.expectedQty })),
        checkOutLatitude: LOKASI_TEST.latitude,
        checkOutLongitude: LOKASI_TEST.longitude,
        checkOutPhotoUrl: FOTO,
      })
      .expect(201);
    expect((await prisma.attendancePermit.findUniqueOrThrow({ where: { id } })).usedShiftSessionId).toBe(shiftSessionId);
    await absenKembali(app, staffToken, shiftSessionId);
  });
});
