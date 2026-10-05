import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { isiUlangGudang } from './support/warehouse';
import { bereskanShiftLama, tutupShiftLengkap } from './support/shift';

(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

/// Ganti metode bayar sale yang sudah PAID (TX-04) oleh Barista: hanya di shift aktif
/// miliknya, alasan wajib, metode baru memuat QRIS → foto wajib; Tunai / QRIS / Split.
/// Semua baris Payment lama di-supersede (Split punya dua) dan kas shift mengikuti.
/// Jalur Admin tetap tanpa foto. Stok tidak pernah berubah.
///
/// Booth & Barista KHUSUS; tanpa membuat produk baru. Shift ditutup di test terakhir
/// (return otomatisnya diterima di akhir test itu).
describe('Payment method change (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let shiftSessionId: string;
  let boothId: string;
  let productId: string;
  let price: number;
  const uploadedFiles: string[] = [];

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const staff = () => ({ Authorization: `Bearer ${staffToken}` });
  const KODE_BOOTH = 'E2E-PAY';
  const USERNAME = 'e2e_payment_staff';
  const CHECKIN = { latitude: -6.2088, longitude: 106.8456, photoUrl: 'https://example.com/selfie.jpg' };
  const JPEG = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64',
  );

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
    if (!booth) booth = (await request(server()).post('/booths').set(admin()).send({ code: KODE_BOOTH, name: 'E2E Payment Booth' }).expect(201)).body;
    boothId = booth.id;

    const gudang = (await request(server()).get('/warehouse-stock').set(admin()).expect(200)).body as { productId: string; qtyOnHand: number }[];
    productId = [...gudang].sort((a, b) => b.qtyOnHand - a.qtyOnHand)[0].productId;
    await isiUlangGudang(app, adminToken, [productId]);
    price = (await request(server()).get('/products').set(admin()).expect(200)).body.find((p: { id: string }) => p.id === productId).sellPrice;
    expect(price).toBeGreaterThan(2);

    const buat = await request(server())
      .post('/users')
      .set(admin())
      .send({ username: USERNAME, password: 'obbel123', fullName: 'E2E Payment Staff', role: 'BOOTH_STAFF' });
    if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
    const login = await request(server()).post('/auth/login').send({ username: USERNAME, password: 'obbel123' }).expect(200);
    const staffId = JSON.parse(Buffer.from(login.body.accessToken.split('.')[1], 'base64url').toString('utf8')).sub as string;
    const templates = await request(server()).get('/shift-templates').set(admin()).expect(200);
    await request(server())
      .put('/booth-shift-assignments')
      .set(admin())
      .send({ boothId, shiftTemplateId: templates.body[0].id, staffId, force: true })
      .expect(200);

    // Shift sisa run sebelumnya (kalau test terakhir gagal sebelum menutupnya) ditutup.
    staffToken = await bereskanShiftLama(app, adminToken, login.body.accessToken);
    await terimaReturnTertunda();
    const checkIn = await request(server()).post('/shifts/check-in').set({ Authorization: `Bearer ${login.body.accessToken}` }).send(CHECKIN).expect(201);
    staffToken = checkIn.body.accessToken ?? login.body.accessToken;
    shiftSessionId = checkIn.body.shiftSessionId;

    const dist = (await request(server()).post('/distributions').set(admin()).send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty: 10 }] }).expect(201)).body;
    await request(server()).post(`/distributions/${dist.id}/receive`).set(staff()).send({ items: [{ productId, actualQty: 10 }] }).expect(201);
  });

  afterAll(async () => {
    for (const url of uploadedFiles) {
      const file = join(process.cwd(), 'uploads', 'payment-proofs', url.split('/').pop()!);
      if (existsSync(file)) unlinkSync(file);
    }
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

  async function uploadProof(): Promise<string> {
    const res = await request(server())
      .post('/sales/payment-proof/photo')
      .set(staff())
      .attach('file', JPEG, { filename: 'bukti.jpg', contentType: 'image/jpeg' })
      .expect(201);
    uploadedFiles.push(res.body.photoUrl);
    return res.body.photoUrl;
  }

  const jualTunai = async () =>
    (await request(server()).post('/sales').set(staff()).send({ idempotencyKey: randomUUID(), shiftSessionId, paymentMethod: 'CASH', items: [{ productId, qty: 1 }] }).expect(201))
      .body as { saleId: string };
  const ganti = (saleId: string, body: Record<string, unknown>, auth = staff()) =>
    request(server())
      .post(`/sales/${saleId}/revise-payment`)
      .set(auth)
      .send({ idempotencyKey: randomUUID(), reasonCode: 'WRONG_PAYMENT_METHOD', reasonNote: 'Pelanggan ganti cara bayar', ...body });
  const aktif = async (saleId: string) =>
    (await prisma.payment.findMany({ where: { saleId, status: 'POSTED' }, orderBy: { method: 'asc' } })).map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      proofPhotoUrl: p.proofPhotoUrl,
    }));
  const stokBooth = async () => (await prisma.boothStock.findUnique({ where: { boothId_productId: { boothId, productId } } }))?.qtyOnHand ?? 0;
  const kas = async () => {
    const r = (await request(server()).get(`/shifts/${shiftSessionId}/report`).set(staff()).expect(200)).body;
    return { tunai: r.kasTunai as number, qris: r.kasQris as number };
  };

  it('Tunai → QRIS needs a reason and a proof photo, then replaces the payment without touching stock', async () => {
    const { saleId } = await jualTunai();
    const stok = await stokBooth();
    const kasAwal = await kas();

    expect((await ganti(saleId, { method: 'QRIS', reasonNote: '  ' }).expect(400)).body.code).toBe('REASON_NOTE_REQUIRED');
    expect((await ganti(saleId, { method: 'QRIS' }).expect(400)).body.code).toBe('QRIS_PROOF_REQUIRED');
    expect(await aktif(saleId)).toEqual([{ method: 'CASH', amount: price, proofPhotoUrl: null }]);

    const bukti = await uploadProof();
    await ganti(saleId, { method: 'QRIS', qrisProofPhotoUrl: bukti }).expect(201);
    expect(await aktif(saleId)).toEqual([{ method: 'QRIS', amount: price, proofPhotoUrl: bukti }]);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).paymentMethod).toBe('QRIS');
    expect(await stokBooth()).toBe(stok);
    expect(await kas()).toEqual({ tunai: kasAwal.tunai - price, qris: kasAwal.qris + price });
  });

  it('QRIS ↔ Split ↔ Tunai supersedes every old row (a Split sale has two)', async () => {
    const { saleId } = await jualTunai();
    const tunai = Math.floor(price / 2);
    const kasAwal = await kas();

    const bukti = await uploadProof();
    await ganti(saleId, { payments: [{ method: 'CASH', amount: tunai }, { method: 'QRIS', amount: price - tunai }], qrisProofPhotoUrl: bukti }).expect(201);
    expect(await aktif(saleId)).toEqual([
      { method: 'CASH', amount: tunai, proofPhotoUrl: null },
      { method: 'QRIS', amount: price - tunai, proofPhotoUrl: bukti },
    ]);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })).paymentMethod).toBe('SPLIT');

    // Dari Split ke Tunai: KEDUA baris lama harus SUPERSEDED, bukan cuma satu.
    await ganti(saleId, { method: 'CASH' }).expect(201);
    expect(await aktif(saleId)).toEqual([{ method: 'CASH', amount: price, proofPhotoUrl: null }]);
    expect(await kas()).toEqual(kasAwal);
  });

  it('rejects an unchanged method, a wrong Split sum, and applies a repeated request once', async () => {
    const { saleId } = await jualTunai();
    expect((await ganti(saleId, { method: 'CASH' }).expect(400)).body.code).toBe('PAYMENT_UNCHANGED');
    const bukti = await uploadProof();
    const salah = await ganti(saleId, { payments: [{ method: 'CASH', amount: 1 }, { method: 'QRIS', amount: 1 }], qrisProofPhotoUrl: bukti }).expect(400);
    expect(salah.body.code).toBe('PAYMENT_AMOUNT_MISMATCH');

    const key = randomUUID();
    const kirim = () =>
      request(server())
        .post(`/sales/${saleId}/revise-payment`)
        .set(staff())
        .send({ idempotencyKey: key, method: 'QRIS', qrisProofPhotoUrl: bukti, reasonCode: 'WRONG_PAYMENT_METHOD', reasonNote: 'retry' });
    await kirim().expect(201);
    await kirim().expect(201);
    expect(await prisma.payment.count({ where: { saleId } })).toBe(2); // CASH lama + satu QRIS, bukan dua
  });

  it('admin may change the method without a photo and keeps the old QRIS proof', async () => {
    const { saleId } = await jualTunai();
    const bukti = await uploadProof();
    await ganti(saleId, { method: 'QRIS', qrisProofPhotoUrl: bukti }).expect(201);
    const tunai = Math.floor(price / 2);
    await ganti(saleId, { payments: [{ method: 'CASH', amount: tunai }, { method: 'QRIS', amount: price - tunai }], reasonNote: undefined }, admin()).expect(201);
    expect(await aktif(saleId)).toEqual([
      { method: 'CASH', amount: tunai, proofPhotoUrl: null },
      { method: 'QRIS', amount: price - tunai, proofPhotoUrl: bukti },
    ]);
  });

  it('rejects sales outside the staff active shift, including after Check-Out', async () => {
    // Sale milik Barista lain (seed booth01) — ditolak sebelum apa pun berubah.
    const lain = await prisma.sale.findFirst({ where: { status: 'PAID', staff: { username: 'booth01' } }, orderBy: { createdAt: 'desc' } });
    expect(lain).not.toBeNull();
    expect((await ganti(lain!.id, { method: lain!.paymentMethod === 'CASH' ? 'QRIS' : 'CASH', qrisProofPhotoUrl: await uploadProof() }).expect(400)).body.code).toBe(
      'SALE_NOT_IN_ACTIVE_SHIFT',
    );

    const { saleId } = await jualTunai();
    await tutupShiftLengkap(app, adminToken, staffToken, shiftSessionId);
    expect((await ganti(saleId, { method: 'QRIS', qrisProofPhotoUrl: await uploadProof() }).expect(400)).body.code).toBe('SALE_NOT_IN_ACTIVE_SHIFT');
    expect(await aktif(saleId)).toEqual([{ method: 'CASH', amount: price, proofPhotoUrl: null }]);
    await terimaReturnTertunda();
  });
});
