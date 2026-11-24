import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { dampakMutasi } from '../src/modules/stock-movements/arah.util';
import { absenKembali, absenTiba, bereskanShiftLama, izinPulangAwal, LOKASI_TEST } from './support/shift';
import { isiUlangGudang } from './support/warehouse';

/// Dua Barista OPEN di booth yang sama (serah terima Shift 1 → Shift 2): stok masih disimpan per
/// booth, dan dulu Check-Out Shift 1 menghitung & mengembalikan SELURUH stok booth ke Gudang,
/// termasuk stok yang sudah diterima Barista Shift 2. Check-Out kini hanya mengambil stok milik
/// shift itu sendiri (shift-stock.ts), dihitung dari buku besar.
///
/// Booth dan dua Petugas khusus spec ini (dipakai ulang tiap run). Tiap run berakhir dengan kedua
/// shift ditutup & Kembali, sehingga stok booth kembali 0 (return otomatis mengeluarkannya).
describe('Two open shifts at one booth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let boothId: string;
  let productId: string;
  const shift = { a: { token: '', id: '' }, b: { token: '', id: '' } };

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
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
    let booth = booths.body.find((b: { code: string }) => b.code === 'E2E-SHARED');
    if (!booth) {
      booth = (await request(server()).post('/booths').set(admin()).send({ code: 'E2E-SHARED', name: 'E2E Shared Booth' }).expect(201))
        .body;
    }
    boothId = booth.id;

    const gudang = await request(server()).get('/warehouse-stock').set(admin()).expect(200);
    productId = [...gudang.body].sort((x: { qtyOnHand: number }, y: { qtyOnHand: number }) => y.qtyOnHand - x.qtyOnHand)[0].productId;
    await isiUlangGudang(app, adminToken, [productId]);

    const templates = (await request(server()).get('/shift-templates').set(admin()).expect(200)).body as { id: string }[];
    for (const [key, username, templateId] of [
      ['a', 'e2e_shared_a', templates[0].id],
      ['b', 'e2e_shared_b', templates[1].id],
    ] as const) {
      const buat = await request(server())
        .post('/users')
        .set(admin())
        .send({ username, password: 'obbel123', fullName: `E2E Shared ${key.toUpperCase()}`, role: 'BOOTH_STAFF' });
      if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
      const login = await request(server()).post('/auth/login').send({ username, password: 'obbel123' }).expect(200);
      const staffId = JSON.parse(Buffer.from(login.body.accessToken.split('.')[1], 'base64url').toString('utf8')).sub as string;
      await request(server()).put('/booth-shift-assignments').set(admin()).send({ boothId, shiftTemplateId: templateId, staffId, force: true }).expect(200);

      const token = await bereskanShiftLama(app, adminToken, login.body.accessToken);
      const checkIn = await request(server())
        .post('/shifts/check-in')
        .set({ Authorization: `Bearer ${token}` })
        .send({ ...LOKASI_TEST, photoUrl: FOTO })
        .expect(201);
      shift[key] = { token: checkIn.body.accessToken ?? token, id: checkIn.body.shiftSessionId };
      await absenTiba(app, shift[key].token, shift[key].id);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (key: 'a' | 'b') => ({ Authorization: `Bearer ${shift[key].token}` });

  async function kirimDanTerima(key: 'a' | 'b', qty: number) {
    const dist = await request(server())
      .post('/distributions')
      .set(admin())
      .send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty }] })
      .expect(201);
    await request(server()).post(`/distributions/${dist.body.id}/receive`).set(auth(key)).send({ items: [{ productId, actualQty: qty }] }).expect(201);
  }

  const jual = (key: 'a' | 'b', qty: number) =>
    request(server())
      .post('/sales')
      .set(auth(key))
      .send({ idempotencyKey: randomUUID(), shiftSessionId: shift[key].id, paymentMethod: 'CASH', items: [{ productId, qty }] })
      .expect(201);

  const mulaiClosing = async (key: 'a' | 'b') =>
    (await request(server()).post(`/shifts/${shift[key].id}/closing/start`).set(auth(key)).expect(201)).body as {
      items: { productId: string; expectedQty: number }[];
    };

  const konfirmasi = (key: 'a' | 'b', items: { productId: string; expectedQty: number }[]) =>
    request(server())
      .post(`/shifts/${shift[key].id}/closing/confirm`)
      .set(auth(key))
      .send({
        items: items.map((i) => ({ productId: i.productId, actualQty: i.expectedQty })),
        checkOutLatitude: LOKASI_TEST.latitude,
        checkOutLongitude: LOKASI_TEST.longitude,
        checkOutPhotoUrl: FOTO,
      });

  const stokBooth = async () =>
    (await prisma.boothStock.findUnique({ where: { boothId_productId: { boothId, productId } } }))?.qtyOnHand ?? 0;

  const qtyRetur = async (key: 'a' | 'b') => {
    const retur = await prisma.stockReturn.findFirst({ where: { shiftSessionId: shift[key].id }, include: { items: true } });
    return retur?.items.find((i) => i.productId === productId)?.qtySubmitted ?? 0;
  };

  it("Shift 1's Check-Out counts and returns only its own stock, not Shift 2's", async () => {
    await kirimDanTerima('a', 5);
    await jual('a', 1); // Shift 1 holds 4
    await kirimDanTerima('b', 7);
    await jual('b', 2); // Shift 2 holds 5
    expect(await stokBooth()).toBe(9);

    await izinPulangAwal(app, adminToken, shift.a.token);
    const closingA = await mulaiClosing('a');
    expect(closingA.items.find((i) => i.productId === productId)?.expectedQty).toBe(4);

    // Shift 2 keeps selling while Shift 1 is closing: not a change to Shift 1's stock.
    await jual('b', 1);
    await konfirmasi('a', closingA.items).expect(201);

    expect(await qtyRetur('a')).toBe(4);
    expect(await stokBooth()).toBe(4); // Shift 2's 7 - 2 - 1, untouched by Shift 1's return
    await absenKembali(app, shift.a.token, shift.a.id);

    await izinPulangAwal(app, adminToken, shift.b.token);
    const closingB = await mulaiClosing('b');
    expect(closingB.items.find((i) => i.productId === productId)?.expectedQty).toBe(4);
    await konfirmasi('b', closingB.items).expect(201);
    expect(await qtyRetur('b')).toBe(4);
    expect(await stokBooth()).toBe(0);
    await absenKembali(app, shift.b.token, shift.b.id);
  });

  it('booth stock still reconciles with the ledger', async () => {
    const movements = await prisma.stockMovement.findMany({ where: { OR: [{ fromBoothId: boothId }, { toBoothId: boothId }] } });
    const ledger = new Map<string, number>();
    for (const m of movements) ledger.set(m.productId, (ledger.get(m.productId) ?? 0) + dampakMutasi(m, boothId).delta);
    const saldo = await prisma.boothStock.findMany({ where: { boothId } });
    for (const s of saldo) expect({ productId: s.productId, qty: ledger.get(s.productId) ?? 0 }).toEqual({ productId: s.productId, qty: s.qtyOnHand });
  });
});
