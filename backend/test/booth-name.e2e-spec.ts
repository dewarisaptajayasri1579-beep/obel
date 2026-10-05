import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

/// Nama Booth tidak boleh kembar (beda kode tapi nama sama tidak bisa dibedakan di
/// laporan), tanpa beda huruf besar/kecil & spasi berlebih. Memakai dua booth tetap
/// (kode E2E-NAME-A / E2E-NAME-B, dibuat sekali lalu dipakai ulang) — percobaan yang
/// ditolak tidak membuat booth baru.
describe('Booth name uniqueness (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let boothA: { id: string; name: string };
  let boothB: { id: string; name: string };

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    adminToken = (await request(server()).post('/auth/login').send({ username: 'admin', password: 'obbel123' }).expect(200)).body.accessToken;

    const booths = (await request(server()).get('/booths').set(admin()).expect(200)).body as { id: string; code: string; name: string }[];
    const ambil = async (code: string, name: string) =>
      booths.find((b) => b.code === code) ?? (await request(server()).post('/booths').set(admin()).send({ code, name }).expect(201)).body;
    boothA = await ambil('E2E-NAME-A', 'E2E Name Booth A');
    boothB = await ambil('E2E-NAME-B', 'E2E Name Booth B');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects creating a booth whose name is already used, ignoring case and extra spaces', async () => {
    const sebelum = await prisma.booth.count();
    const res = await request(server()).post('/booths').set(admin()).send({ code: 'E2E-NAME-DUP', name: '  e2e   NAME booth a ' }).expect(400);
    expect(res.body.code).toBe('BOOTH_NAME_TAKEN');
    expect(await prisma.booth.count()).toBe(sebelum);
  });

  it('rejects renaming a booth to another booth name', async () => {
    const res = await request(server()).patch(`/booths/${boothB.id}`).set(admin()).send({ name: 'E2E NAME BOOTH A' }).expect(400);
    expect(res.body.code).toBe('BOOTH_NAME_TAKEN');
    expect((await prisma.booth.findUniqueOrThrow({ where: { id: boothB.id } })).name).toBe(boothB.name);
  });

  it('still allows saving a booth with its own name and other changes', async () => {
    await request(server()).patch(`/booths/${boothA.id}`).set(admin()).send({ name: boothA.name, locationName: 'Lokasi E2E' }).expect(200);
    expect((await prisma.booth.findUniqueOrThrow({ where: { id: boothA.id } })).locationName).toBe('Lokasi E2E');
  });
});
