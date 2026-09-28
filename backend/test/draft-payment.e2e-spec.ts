import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';

/// Melunasi draft (POST /sales/:id/pay) harus aman terhadap request dobel
/// yang datang bersamaan (double-tap, retry setelah respons hilang): stok
/// dipotong sekali, satu set Payment, kedua request mendapat sale yang sama.
describe('Draft payment (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let boothToken: string;
  let shiftSessionId: string;
  let productId: string;
  const paidSaleIds: string[] = [];

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
    const target = catalog.body.find((p: { qtyOnHand: number }) => p.qtyOnHand >= 6);
    if (!target) throw new Error('Tidak ada produk dengan stok >= 6 di booth01 (obbel_test) — test tidak bisa jalan.');
    productId = target.id;
  });

  afterAll(async () => {
    for (const saleId of paidSaleIds) {
      await request(server())
        .post(`/sales/${saleId}/void`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), reasonCode: 'TRANSACTION_NEVER_HAPPENED' });
    }
    await app.close();
  });

  async function stockOnHand(): Promise<number> {
    const res = await request(server()).get('/catalog').set('Authorization', `Bearer ${boothToken}`).expect(200);
    return res.body.find((p: { id: string }) => p.id === productId).qtyOnHand;
  }

  it('concurrent pay requests on one draft deduct stock once and return the same sale', async () => {
    const before = await stockOnHand();
    const draft = (
      await request(server())
        .post('/sales/draft')
        .set('Authorization', `Bearer ${boothToken}`)
        .send({ idempotencyKey: randomUUID(), shiftSessionId, items: [{ productId, qty: 2 }] })
        .expect(201)
    ).body;

    const pay = () =>
      request(server()).post(`/sales/${draft.id}/pay`).set('Authorization', `Bearer ${boothToken}`).send({ paymentMethod: 'CASH' });
    const responses = await Promise.all([pay(), pay(), pay()]);
    paidSaleIds.push(draft.id);

    expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(new Set(responses.map((r) => r.body.saleId))).toEqual(new Set([draft.id]));
    expect(await stockOnHand()).toBe(before - 2);

    const detail = await request(server()).get(`/sales/${draft.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(detail.body.status).toBe('PAID');
    expect(detail.body.payments).toHaveLength(1);
  });

  it('paying an already-paid draft again is a no-op returning the same sale', async () => {
    const before = await stockOnHand();
    const draft = (
      await request(server())
        .post('/sales/draft')
        .set('Authorization', `Bearer ${boothToken}`)
        .send({ idempotencyKey: randomUUID(), shiftSessionId, items: [{ productId, qty: 1 }] })
        .expect(201)
    ).body;
    const first = await request(server()).post(`/sales/${draft.id}/pay`).set('Authorization', `Bearer ${boothToken}`).send({ paymentMethod: 'CASH' }).expect(201);
    paidSaleIds.push(draft.id);
    const again = await request(server()).post(`/sales/${draft.id}/pay`).set('Authorization', `Bearer ${boothToken}`).send({ paymentMethod: 'CASH' }).expect(201);
    expect(again.body.saleId).toBe(first.body.saleId);
    expect(await stockOnHand()).toBe(before - 1);
  });
});
