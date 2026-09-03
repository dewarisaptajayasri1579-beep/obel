import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';

/// Menjalankan acceptance case COR-01/02/03/12 dari
/// docs/obbel-coffee-ai-docs/24-data-consistency-correction-reversal.md
/// §17 langsung terhadap Backend API asli (bukan mock), memakai kredensial
/// seed (admin/booth01, password obbel123) dan Booth/produk seed.
describe('Sale correction flows (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let boothToken: string;
  let shiftSessionId: string;
  let productId: string;

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

    const boothLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'booth01', password: 'obbel123' })
      .expect(200);
    boothToken = boothLogin.body.accessToken;

    const activeShift = await request(app.getHttpServer())
      .get('/shifts/active')
      .set('Authorization', `Bearer ${boothToken}`)
      .expect(200);
    shiftSessionId = activeShift.body.shiftSessionId;

    const catalog = await request(app.getHttpServer())
      .get('/catalog')
      .set('Authorization', `Bearer ${boothToken}`)
      .expect(200);
    productId = catalog.body[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createSale(qty: number) {
    const res = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${boothToken}`)
      .send({
        idempotencyKey: randomUUID(),
        shiftSessionId,
        paymentMethod: 'CASH',
        items: [{ productId, qty }],
      })
      .expect(201);
    return res.body;
  }

  async function stockOnHand() {
    const res = await request(app.getHttpServer())
      .get('/catalog')
      .set('Authorization', `Bearer ${boothToken}`)
      .expect(200);
    return res.body.find((p: { id: string }) => p.id === productId).qtyOnHand;
  }

  it('COR-01: void sale reverses stock and is idempotent (COR-12)', async () => {
    const before = await stockOnHand();
    const sale = await createSale(2);
    expect(await stockOnHand()).toBe(before - 2);

    const preview = await request(app.getHttpServer())
      .post(`/sales/${sale.saleId}/preview-void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(preview.body.omzetDelta).toBe(-sale.total);
    expect(preview.body.stockDeltas[0]).toMatchObject({ productId, qtyDelta: 2 });

    const idempotencyKey = randomUUID();
    await request(app.getHttpServer())
      .post(`/sales/${sale.saleId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey, reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
      .expect(201);
    expect(await stockOnHand()).toBe(before);

    // COR-12: double submit dengan idempotency key yang sama tidak boleh
    // menerapkan efek dua kali.
    await request(app.getHttpServer())
      .post(`/sales/${sale.saleId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey, reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
      .expect(201);
    expect(await stockOnHand()).toBe(before);
  });

  it('COR-02: revise sale qty nets only the delta and reports effective version', async () => {
    const before = await stockOnHand();
    const sale = await createSale(2);

    const revised = await request(app.getHttpServer())
      .post(`/sales/${sale.saleId}/revise`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        idempotencyKey: randomUUID(),
        items: [{ productId, qty: 1 }],
        reasonCode: 'WRONG_QTY',
      })
      .expect(201);

    // Net stock effect vs pre-sale baseline should be -1, not -2 or -3.
    expect(await stockOnHand()).toBe(before - 1);

    const listing = await request(app.getHttpServer())
      .get('/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const effective = listing.body.find((s: { id: string }) => s.id === revised.body.saleId);
    expect(effective).toBeDefined();
    expect(effective.versionNo).toBe(2);
    // V1 (superseded) must not appear in the effective list.
    expect(listing.body.find((s: { id: string }) => s.id === sale.saleId)).toBeUndefined();
  });

  it('COR-03: revise payment method has no stock/omzet effect', async () => {
    const sale = await createSale(1);
    const before = await stockOnHand();

    const detailBefore = await request(app.getHttpServer())
      .get(`/sales/${sale.saleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detailBefore.body.paymentMethod).toBe('CASH');

    await request(app.getHttpServer())
      .post(`/sales/${sale.saleId}/revise-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), method: 'QRIS', reasonCode: 'WRONG_PAYMENT_METHOD' })
      .expect(201);

    expect(await stockOnHand()).toBe(before);

    const detailAfter = await request(app.getHttpServer())
      .get(`/sales/${sale.saleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detailAfter.body.paymentMethod).toBe('QRIS');
    expect(detailAfter.body.total).toBe(detailBefore.body.total);
  });

  it('rejects void on a non-PAID sale with SALE_NOT_CORRECTABLE', async () => {
    const sale = await createSale(1);
    await request(app.getHttpServer())
      .post(`/sales/${sale.saleId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/sales/${sale.saleId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
      .expect(400);
    expect(res.body.code).toBe('SALE_NOT_CORRECTABLE');
  });
});
