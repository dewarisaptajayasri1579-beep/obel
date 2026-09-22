import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';

/// Verifikasi POST /shifts/check-in (self-service open shift). Sengaja TIDAK
/// memakai booth01 seed (sudah punya ShiftSession aktif) — bikin akun
/// BOOTH_STAFF baru tiap run lewat POST /users supaya nggak nyentuh state
/// seed/booth01 yang dipakai test/manual lain di DB yang sama.
describe('Shift check-in (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let boothId: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  async function createFreshBoothStaff(withDefaultBooth: boolean) {
    const username = `e2e_checkin_${randomUUID().slice(0, 8)}`;
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username,
        password: 'obbel123',
        fullName: 'E2E Check-In Staff',
        role: 'BOOTH_STAFF',
        ...(withDefaultBooth ? { defaultBoothId: boothId } : {}),
      })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password: 'obbel123' })
      .expect(200);
    return login.body.accessToken as string;
  }

  it('GET /shifts/active returns NO_ACTIVE_SHIFT before check-in', async () => {
    const token = await createFreshBoothStaff(true);
    const res = await request(app.getHttpServer())
      .get('/shifts/active')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(res.body.code).toBe('NO_ACTIVE_SHIFT');
  });

  it('creates a new OPEN ShiftSession and is readable via GET /shifts/active afterwards', async () => {
    const token = await createFreshBoothStaff(true);
    const idempotencyKey = randomUUID();

    const checkIn = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey })
      .expect(201);

    expect(checkIn.body.status).toBe('OPEN');
    expect(checkIn.body.booth.id).toBe(boothId);
    expect(checkIn.body.shiftSessionId).toBeTruthy();

    const active = await request(app.getHttpServer())
      .get('/shifts/active')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(active.body.shiftSessionId).toBe(checkIn.body.shiftSessionId);
  });

  it('replays the same response when the same idempotencyKey is sent twice', async () => {
    const token = await createFreshBoothStaff(true);
    const idempotencyKey = randomUUID();

    const first = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey })
      .expect(201);

    expect(second.body.shiftSessionId).toBe(first.body.shiftSessionId);
  });

  it('rejects a second check-in with a different idempotencyKey while one is already active', async () => {
    const token = await createFreshBoothStaff(true);

    await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: randomUUID() })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: randomUUID() })
      .expect(409);
    expect(second.body.code).toBe('SHIFT_ALREADY_ACTIVE');
  });

  it('rejects check-in for a staff with no BoothShiftAssignment and no defaultBoothId', async () => {
    const token = await createFreshBoothStaff(false);

    const res = await request(app.getHttpServer())
      .post('/shifts/check-in')
      .set('Authorization', `Bearer ${token}`)
      .send({ idempotencyKey: randomUUID() })
      .expect(409);
    expect(res.body.code).toBe('NO_BOOTH_ASSIGNED');
  });
});
