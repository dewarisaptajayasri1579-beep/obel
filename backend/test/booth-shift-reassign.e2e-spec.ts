import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

// main.ts serializes BigInt (Booth.cashFloat) globally; the e2e app does not run main.ts.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

/// Setting Barista (B8): Barista yang sudah ditugaskan di slot lain tetap bisa dipilih. Tanpa
/// konfirmasi ditolak dengan rincian slot lamanya (untuk modal konfirmasi); dengan konfirmasi
/// (`reassign`) slot lama dilepas dan slot baru diisi dalam satu transaksi.
describe('Reassign a Barista to another booth/shift slot (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let staffId: string;
  let boothA: string;
  let boothB: string;
  let templates: { id: string; name: string }[];

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });

  async function boothKhusus(code: string, name: string) {
    const booths = await request(server()).get('/booths').set(admin()).expect(200);
    const ada = booths.body.find((b: { code: string }) => b.code === code);
    return (ada ?? (await request(server()).post('/booths').set(admin()).send({ code, name }).expect(201)).body).id as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminToken = (await request(server()).post('/auth/login').send({ username: 'admin', password: 'obbel123' }).expect(200)).body
      .accessToken;
    boothA = await boothKhusus('E2E-RSG-A', 'E2E Reassign A');
    boothB = await boothKhusus('E2E-RSG-B', 'E2E Reassign B');
    templates = (await request(server()).get('/shift-templates').set(admin()).expect(200)).body;

    const username = 'e2e_reassign_staff';
    const buat = await request(server()).post('/users').set(admin()).send({ username, password: 'obbel123', fullName: 'E2E Pindah Slot', role: 'BOOTH_STAFF' });
    if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
    staffToken = (await request(server()).post('/auth/login').send({ username, password: 'obbel123' }).expect(200)).body.accessToken;
    staffId = JSON.parse(Buffer.from(staffToken.split('.')[1], 'base64url').toString('utf8')).sub as string;

    // Start from slot A · Shift 1 whatever the previous run left.
    await request(server()).put('/booth-shift-assignments').set(admin()).send({ boothId: boothA, shiftTemplateId: templates[0].id, staffId, reassign: true }).expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  const slot = (boothId: string, shiftTemplateId: string) =>
    prisma.boothShiftAssignment.findUnique({ where: { boothId_shiftTemplateId: { boothId, shiftTemplateId } } });

  it('refuses without confirmation and tells where the Barista is assigned now', async () => {
    const res = await request(server())
      .put('/booth-shift-assignments')
      .set(admin())
      .send({ boothId: boothB, shiftTemplateId: templates[1].id, staffId })
      .expect(400);
    expect(res.body.code).toBe('STAFF_ALREADY_ASSIGNED');
    expect(res.body.details).toMatchObject({ staffName: 'E2E Pindah Slot', boothName: 'E2E Reassign A', shiftName: templates[0].name });
    expect((await slot(boothA, templates[0].id))?.staffId).toBe(staffId);
  });

  it('moves the Barista on confirmation and releases the old slot', async () => {
    await request(server())
      .put('/booth-shift-assignments')
      .set(admin())
      .send({ boothId: boothB, shiftTemplateId: templates[1].id, staffId, reassign: true })
      .expect(200);
    expect((await slot(boothA, templates[0].id))?.staffId ?? null).toBeNull();
    expect((await slot(boothB, templates[1].id))?.staffId).toBe(staffId);

    const mine = (await request(server()).get('/booth-shift-assignments/mine').set({ Authorization: `Bearer ${staffToken}` }).expect(200)).body;
    expect(mine).toMatchObject({ boothId: boothB, shiftTemplateId: templates[1].id });
  });
});
