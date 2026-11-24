import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { dampakMutasi, keteranganMutasi } from '../src/modules/stock-movements/arah.util';
import { absenKembali, bereskanShiftLama, izinPulangAwal, LOKASI_TEST } from './support/shift';
import { isiUlangGudang } from './support/warehouse';

/// Barista memilih booth saat Absen Tiba (B5). Stok diterima di Gudang setelah Berangkat dan
/// tercatat di booth roster; kalau Barista tiba di booth lain, stok yang dibawa ikut pindah
/// lewat ledger, laporan shift tetap menghitungnya sebagai Stok Awal, dan saldo kedua booth
/// tetap cocok dengan buku besar.
///
/// Dua booth & satu Petugas khusus spec ini (dipakai ulang tiap run). Tiap run berakhir dengan
/// Check-Out + Kembali, jadi stok shift ini keluar lagi lewat return otomatis.
describe('Choose the booth at Absen Tiba (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let shiftSessionId: string;
  let boothRoster: string;
  let boothLain: string;
  let productId: string;

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const staff = () => ({ Authorization: `Bearer ${staffToken}` });
  const FOTO = 'https://example.com/absen.jpg';

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
    boothRoster = await boothKhusus('E2E-MOVE-A', 'E2E Move Roster');
    boothLain = await boothKhusus('E2E-MOVE-B', 'E2E Move Lain');

    const gudang = await request(server()).get('/warehouse-stock').set(admin()).expect(200);
    productId = [...gudang.body].sort((x: { qtyOnHand: number }, y: { qtyOnHand: number }) => y.qtyOnHand - x.qtyOnHand)[0].productId;
    await isiUlangGudang(app, adminToken, [productId]);

    const username = 'e2e_move_staff';
    const buat = await request(server()).post('/users').set(admin()).send({ username, password: 'obbel123', fullName: 'E2E Move Staff', role: 'BOOTH_STAFF' });
    if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
    const login = await request(server()).post('/auth/login').send({ username, password: 'obbel123' }).expect(200);
    const staffId = JSON.parse(Buffer.from(login.body.accessToken.split('.')[1], 'base64url').toString('utf8')).sub as string;
    const templates = (await request(server()).get('/shift-templates').set(admin()).expect(200)).body as { id: string }[];
    await request(server()).put('/booth-shift-assignments').set(admin()).send({ boothId: boothRoster, shiftTemplateId: templates[0].id, staffId, force: true }).expect(200);

    const token = await bereskanShiftLama(app, adminToken, login.body.accessToken);
    const checkIn = await request(server()).post('/shifts/check-in').set({ Authorization: `Bearer ${token}` }).send({ ...LOKASI_TEST, photoUrl: FOTO }).expect(201);
    staffToken = checkIn.body.accessToken ?? token;
    shiftSessionId = checkIn.body.shiftSessionId;
    expect(checkIn.body.booth.id).toBe(boothRoster);
  });

  afterAll(async () => {
    await app.close();
  });

  const stok = async (boothId: string) =>
    (await prisma.boothStock.findUnique({ where: { boothId_productId: { boothId, productId } } }))?.qtyOnHand ?? 0;

  const tiba = (boothId: string) =>
    request(server()).post(`/shifts/${shiftSessionId}/arrive`).set(staff()).send({ ...LOKASI_TEST, photoUrl: FOTO, boothId });

  let awalRoster = 0;
  let awalLain = 0;

  it('blocks the move while stock sent to the roster booth is not received yet', async () => {
    const dist = await request(server())
      .post('/distributions')
      .set(admin())
      .send({ idempotencyKey: randomUUID(), boothId: boothRoster, items: [{ productId, qty: 5 }] })
      .expect(201);
    expect((await tiba(boothLain).expect(400)).body.code).toBe('PENDING_STOCK_HANDOVER');

    await request(server()).post(`/distributions/${dist.body.id}/receive`).set(staff()).send({ items: [{ productId, actualQty: 5 }] }).expect(201);
  });

  it('moves the carried stock to the chosen booth and reissues the token', async () => {
    awalRoster = await stok(boothRoster);
    awalLain = await stok(boothLain);

    const res = await tiba(boothLain).expect(201);
    expect(res.body.booth.id).toBe(boothLain);
    expect(typeof res.body.accessToken).toBe('string');
    staffToken = res.body.accessToken;

    expect(await stok(boothRoster)).toBe(awalRoster - 5);
    expect(await stok(boothLain)).toBe(awalLain + 5);

    const pindah = await prisma.stockMovement.findMany({ where: { shiftSessionId, referenceType: { startsWith: 'shift_booth_move' } } });
    expect(pindah.map((m) => `${m.referenceType}:${m.qty}`).sort()).toEqual(['shift_booth_move_in:5', 'shift_booth_move_out:5']);
    expect(keteranganMutasi(pindah[0])).toBe('Pindah booth saat Tiba');

    // Absen Tiba again is idempotent: nothing moves twice.
    expect((await tiba(boothRoster).expect(201)).body.booth.id).toBe(boothLain);
    expect(await prisma.stockMovement.count({ where: { shiftSessionId, referenceType: { startsWith: 'shift_booth_move' } } })).toBe(2);
  });

  it('restocks and sells at the new booth, reports the moved stock as Stok Awal and returns it from there', async () => {
    // A restock received at the new booth is Restock, not Stok Awal (the Awal receipt was at the roster booth).
    const restock = await request(server())
      .post('/distributions')
      .set(admin())
      .send({ idempotencyKey: randomUUID(), boothId: boothLain, items: [{ productId, qty: 4 }] })
      .expect(201);
    await request(server()).post(`/distributions/${restock.body.id}/receive`).set(staff()).send({ items: [{ productId, actualQty: 4 }] }).expect(201);
    await request(server())
      .post('/sales')
      .set(staff())
      .send({ idempotencyKey: randomUUID(), shiftSessionId, paymentMethod: 'CASH', items: [{ productId, qty: 2 }] })
      .expect(201);
    expect(await stok(boothLain)).toBe(awalLain + 7);

    const laporan = (await request(server()).get(`/shifts/${shiftSessionId}/report`).set(staff()).expect(200)).body;
    expect(laporan.items.find((i: { productId: string }) => i.productId === productId)).toMatchObject({
      stokAwal: 5,
      restock: 4,
      terjual: 2,
      sisaSistem: 7,
    });

    await izinPulangAwal(app, adminToken, staffToken);
    const closing = (await request(server()).post(`/shifts/${shiftSessionId}/closing/start`).set(staff()).expect(201)).body;
    expect(closing.items.find((i: { productId: string }) => i.productId === productId).expectedQty).toBe(7);
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
    expect(await stok(boothLain)).toBe(awalLain);
    expect(await stok(boothRoster)).toBe(awalRoster - 5);
    await absenKembali(app, staffToken, shiftSessionId);
  });

  it('both booths still reconcile with the ledger', async () => {
    for (const boothId of [boothRoster, boothLain]) {
      const movements = await prisma.stockMovement.findMany({ where: { OR: [{ fromBoothId: boothId }, { toBoothId: boothId }] } });
      const ledger = new Map<string, number>();
      for (const m of movements) ledger.set(m.productId, (ledger.get(m.productId) ?? 0) + dampakMutasi(m, boothId).delta);
      for (const s of await prisma.boothStock.findMany({ where: { boothId } })) {
        expect({ boothId, productId: s.productId, qty: ledger.get(s.productId) ?? 0 }).toEqual({ boothId, productId: s.productId, qty: s.qtyOnHand });
      }
    }
  });
});
