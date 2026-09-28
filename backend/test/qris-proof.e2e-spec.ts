import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';

/// AC-41 / BR-038 — foto bukti bayar QRIS wajib untuk petugas booth, disimpan
/// di baris Payment QRIS saja; plus idempotency Bayar (BR-017). Jalan melawan
/// Backend API asli + DB obbel_test, kredensial seed (admin/booth01).
describe('QRIS payment proof (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let boothToken: string;
  let shiftSessionId: string;
  let productId: string;
  let price: number;
  const uploadedFiles: string[] = [];
  const paidSaleIds: string[] = [];

  // JPEG 1x1 minimal — backend hanya cek mimetype & ukuran.
  const JPEG = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64',
  );

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    adminToken = (await request(server()).post('/auth/login').send({ username: 'admin', password: 'obbel123' }).expect(200))
      .body.accessToken;
    boothToken = (await request(server()).post('/auth/login').send({ username: 'booth01', password: 'obbel123' }).expect(200))
      .body.accessToken;
    shiftSessionId = (await request(server()).get('/shifts/active').set('Authorization', `Bearer ${boothToken}`).expect(200))
      .body.shiftSessionId;

    const catalog = await request(server()).get('/catalog').set('Authorization', `Bearer ${boothToken}`).expect(200);
    const target = catalog.body.find((p: { qtyOnHand: number }) => p.qtyOnHand >= 12);
    if (!target) throw new Error('Tidak ada produk dengan stok >= 12 di booth01 (obbel_test) — test tidak bisa jalan.');
    productId = target.id;
    const products = await request(server()).get('/products').set('Authorization', `Bearer ${adminToken}`).expect(200);
    price = products.body.find((p: { id: string }) => p.id === productId).sellPrice;
    expect(price).toBeGreaterThan(1);
  });

  afterAll(async () => {
    // Kembalikan stok booth01 lewat void resmi, lalu hapus file foto test.
    for (const saleId of paidSaleIds) {
      await request(server())
        .post(`/sales/${saleId}/void`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), reasonCode: 'TRANSACTION_NEVER_HAPPENED' });
    }
    for (const url of uploadedFiles) {
      const file = join(process.cwd(), 'uploads', 'payment-proofs', url.split('/').pop()!);
      if (existsSync(file)) unlinkSync(file);
    }
    await app.close();
  });

  async function stockOnHand(): Promise<number> {
    const res = await request(server()).get('/catalog').set('Authorization', `Bearer ${boothToken}`).expect(200);
    return res.body.find((p: { id: string }) => p.id === productId).qtyOnHand;
  }

  async function uploadProof(): Promise<string> {
    const res = await request(server())
      .post('/sales/payment-proof/photo')
      .set('Authorization', `Bearer ${boothToken}`)
      .attach('file', JPEG, { filename: 'bukti.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const url: string = res.body.photoUrl;
    uploadedFiles.push(url);
    expect(url).toMatch(/\/uploads\/payment-proofs\/[0-9a-f-]{36}\.jpg$/);
    expect(existsSync(join(process.cwd(), 'uploads', 'payment-proofs', url.split('/').pop()!))).toBe(true);
    return url;
  }

  function sell(body: Record<string, unknown>, qty = 1) {
    return request(server())
      .post('/sales')
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ idempotencyKey: randomUUID(), shiftSessionId, items: [{ productId, qty }], ...body });
  }

  async function paymentsOf(saleId: string) {
    const res = await request(server()).get(`/sales/${saleId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    return res.body.payments as { method: string; amount: number; status: string; proofPhotoUrl: string | null }[];
  }

  it('rejects QRIS and Split without proof before touching stock', async () => {
    const before = await stockOnHand();
    const qris = await sell({ paymentMethod: 'QRIS' }).expect(400);
    expect(qris.body.code).toBe('QRIS_PROOF_REQUIRED');
    const split = await sell({ payments: [{ method: 'CASH', amount: 1 }, { method: 'QRIS', amount: price - 1 }] }).expect(400);
    expect(split.body.code).toBe('QRIS_PROOF_REQUIRED');
    expect(await stockOnHand()).toBe(before);
  });

  it('rejects a proof URL that was not uploaded to this server', async () => {
    const res = await sell({ paymentMethod: 'QRIS', qrisProofPhotoUrl: 'https://example.com/bukti.jpg' }).expect(400);
    expect(JSON.stringify(res.body)).toContain('Foto bukti bayar QRIS tidak valid');
  });

  it('rejects a non-image upload', async () => {
    await request(server())
      .post('/sales/payment-proof/photo')
      .set('Authorization', `Bearer ${boothToken}`)
      .attach('file', Buffer.from('bukan gambar'), { filename: 'bukti.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('stores the proof on the QRIS payment row', async () => {
    const before = await stockOnHand();
    const url = await uploadProof();
    const sale = (await sell({ paymentMethod: 'QRIS', qrisProofPhotoUrl: url }).expect(201)).body;
    paidSaleIds.push(sale.saleId);
    expect(await stockOnHand()).toBe(before - 1);
    const payments = await paymentsOf(sale.saleId);
    expect(payments).toEqual([expect.objectContaining({ method: 'QRIS', amount: price, proofPhotoUrl: url })]);
  });

  it('Split: proof only on the QRIS row', async () => {
    const url = await uploadProof();
    const sale = (
      await sell({ payments: [{ method: 'CASH', amount: 1 }, { method: 'QRIS', amount: price - 1 }], qrisProofPhotoUrl: url }).expect(201)
    ).body;
    paidSaleIds.push(sale.saleId);
    const payments = await paymentsOf(sale.saleId);
    expect(payments).toHaveLength(2);
    expect(payments.find((p) => p.method === 'CASH')!.proofPhotoUrl).toBeNull();
    expect(payments.find((p) => p.method === 'QRIS')!.proofPhotoUrl).toBe(url);
  });

  it('Cash still works without proof (regression)', async () => {
    const sale = (await sell({ paymentMethod: 'CASH' }).expect(201)).body;
    paidSaleIds.push(sale.saleId);
    expect((await paymentsOf(sale.saleId))[0].proofPhotoUrl).toBeNull();
  });

  it('retry with the same idempotency key returns the same sale and deducts stock once', async () => {
    const before = await stockOnHand();
    const url = await uploadProof();
    const body = { idempotencyKey: randomUUID(), shiftSessionId, items: [{ productId, qty: 2 }], paymentMethod: 'QRIS', qrisProofPhotoUrl: url };
    const first = (await request(server()).post('/sales').set('Authorization', `Bearer ${boothToken}`).send(body).expect(201)).body;
    const second = (await request(server()).post('/sales').set('Authorization', `Bearer ${boothToken}`).send(body).expect(201)).body;
    paidSaleIds.push(first.saleId);
    expect(second.saleId).toBe(first.saleId);
    expect(await stockOnHand()).toBe(before - 2);
  });

  it('paying a draft with QRIS requires proof and stores it', async () => {
    const draft = (
      await request(server())
        .post('/sales/draft')
        .set('Authorization', `Bearer ${boothToken}`)
        .send({ idempotencyKey: randomUUID(), shiftSessionId, items: [{ productId, qty: 1 }] })
        .expect(201)
    ).body;

    const tanpa = await request(server())
      .post(`/sales/${draft.id}/pay`)
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ paymentMethod: 'QRIS' })
      .expect(400);
    expect(tanpa.body.code).toBe('QRIS_PROOF_REQUIRED');

    const url = await uploadProof();
    const paid = (
      await request(server())
        .post(`/sales/${draft.id}/pay`)
        .set('Authorization', `Bearer ${boothToken}`)
        .send({ paymentMethod: 'QRIS', qrisProofPhotoUrl: url })
        .expect(201)
    ).body;
    paidSaleIds.push(paid.saleId);
    expect((await paymentsOf(paid.saleId))[0].proofPhotoUrl).toBe(url);
  });

  it('revising a QRIS sale keeps its proof on the new version', async () => {
    const url = await uploadProof();
    const sale = (await sell({ paymentMethod: 'QRIS', qrisProofPhotoUrl: url }, 2).expect(201)).body;
    const revised = (
      await request(server())
        .post(`/sales/${sale.saleId}/revise`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), items: [{ productId, qty: 1 }], reasonCode: 'WRONG_QTY' })
        .expect(201)
    ).body;
    paidSaleIds.push(revised.saleId);
    const posted = (await paymentsOf(revised.saleId)).filter((p) => p.status === 'POSTED');
    expect(posted).toEqual([expect.objectContaining({ method: 'QRIS', proofPhotoUrl: url })]);
  });

  it('attendance selfie upload still works through the shared image-upload helper (regression)', async () => {
    const res = await request(server())
      .post('/shifts/attendance/photo')
      .set('Authorization', `Bearer ${boothToken}`)
      .attach('file', JPEG, { filename: 'selfie.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(res.body.photoUrl).toMatch(/\/uploads\/attendance\/[0-9a-f-]{36}\.jpg$/);
    const file = join(process.cwd(), 'uploads', 'attendance', res.body.photoUrl.split('/').pop());
    expect(existsSync(file)).toBe(true);
    unlinkSync(file);

    const salah = await request(server())
      .post('/shifts/attendance/photo')
      .set('Authorization', `Bearer ${boothToken}`)
      .attach('file', Buffer.from('bukan gambar'), { filename: 'selfie.txt', contentType: 'text/plain' })
      .expect(400);
    expect(JSON.stringify(salah.body)).toContain('Foto selfie');
  });

  it('admin selling QRIS from Admin Web is not required to attach proof', async () => {
    const res = await request(server())
      .post('/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), shiftSessionId, items: [{ productId, qty: 1 }], paymentMethod: 'QRIS' })
      .expect(201);
    paidSaleIds.push(res.body.saleId);
  });
});
