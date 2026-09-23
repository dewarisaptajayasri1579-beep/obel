import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';

/// Verifikasi POST /shifts/check-in (Absen Berangkat — self-service open
/// shift, lihat docsV2/09-checkin-checkout-petugas.md). Sengaja TIDAK
/// memakai booth01 seed (sudah punya ShiftSession aktif) — bikin akun
/// BOOTH_STAFF baru tiap run lewat POST /users supaya nggak nyentuh state
/// seed/booth01 yang dipakai test/manual lain di DB yang sama.
describe('Shift check-in (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let boothId: string;
  let otherBoothId: string;
  let shiftTemplateId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'obbel123' })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    const booths = await request(app.getHttpServer())
      .get('/booths')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    boothId = booths.body[0].id;
    otherBoothId = booths.body[1].id;

    const templates = await request(app.getHttpServer())
      .get('/shift-templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    shiftTemplateId = templates.body[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createFreshBoothStaff() {
    const username = `e2e_checkin_${randomUUID().slice(0, 8)}`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username,
        password: 'obbel123',
        fullName: 'E2E Check-In Staff',
        role: 'BOOTH_STAFF',
      })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password: 'obbel123' })
      .expect(200);
    return login.body.accessToken as string;
  }

  /// /users has no "whoami" endpoint; decode the JWT's `sub` claim directly
  /// (an unsigned inspection, not a security check — fine for test setup).
  function staffIdFromToken(token: string): string {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.sub as string;
  }

  /// CheckInDto sekarang wajib GPS+foto selfie (soft-check saja terhadap
  /// lokasi Booth, tidak memblokir — lihat ShiftsService.computeLocationWarning).
  const SAMPLE_CHECKIN_LOCATION = { latitude: -6.2088, longitude: 106.8456, photoUrl: 'https://example.com/selfie.jpg' };

  async function assignBooth(token: string, boothIdToAssign: string) {
    await request(app.getHttpServer())
      .put('/booth-shift-assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ boothId: boothIdToAssign, shiftTemplateId, staffId: staffIdFromToken(token) })
      .expect(200);
  }

  it('GET /shifts/active returns NOT_FOUND before check-in', async () => {
    const token = await createFreshBoothStaff();
    const res = await request(app.getHttpServer())
      .get('/shifts/active')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('rejects check-in for a staff with no BoothShiftAssignment', async () => {
    const token = await createFreshBoothStaff();
    const res = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send(SAMPLE_CHECKIN_LOCATION)
      .expect(400);
    expect(res.body.code).toBe('NO_BOOTH_ASSIGNMENT');
  });

  it('creates a new OPEN ShiftSession from the staff BoothShiftAssignment and is readable afterwards', async () => {
    const token = await createFreshBoothStaff();
    await assignBooth(token, boothId);

    const checkIn = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send(SAMPLE_CHECKIN_LOCATION)
      .expect(201);

    expect(checkIn.body.status).toBe('OPEN');
    expect(checkIn.body.booth.id).toBe(boothId);
    expect(checkIn.body.shiftSessionId).toBeTruthy();
    // First check-in reissues the token (old one had boothId=null).
    expect(typeof checkIn.body.accessToken).toBe('string');

    const active = await request(app.getHttpServer())
      .get('/shifts/active')
      .set('Authorization', `Bearer ${checkIn.body.accessToken}`)
      .expect(200);
    expect(active.body.shiftSessionId).toBe(checkIn.body.shiftSessionId);
  });

  it('is idempotent when checking in again while already active at the same booth', async () => {
    const token = await createFreshBoothStaff();
    await assignBooth(token, boothId);

    const first = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send(SAMPLE_CHECKIN_LOCATION)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .send(SAMPLE_CHECKIN_LOCATION)
      .expect(201);

    expect(second.body.shiftSessionId).toBe(first.body.shiftSessionId);
  });

  it('rejects checking in to a different booth while already active elsewhere', async () => {
    const token = await createFreshBoothStaff();
    await assignBooth(token, boothId);

    const first = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send(SAMPLE_CHECKIN_LOCATION)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .send({ ...SAMPLE_CHECKIN_LOCATION, boothId: otherBoothId })
      .expect(400);
    expect(second.body.code).toBe('ALREADY_CHECKED_IN_ELSEWHERE');
  });
});
