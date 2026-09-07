import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';

// main.ts patches this globally for the real server; the e2e app is built
// directly via TestingModule and bypasses main.ts, so responses touching
// raw bigint columns (sellPrice, version) would otherwise fail to serialize.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

/// Melengkapi correction-flows.e2e-spec.ts (yang hanya cover Sale) dengan
/// acceptance case COR-04/05/07/08/09 untuk Distribution, Return, Stock
/// Opname, Manual Adjustment, dan Shift correction — dijalankan langsung
/// terhadap Backend API asli, memakai kredensial seed yang sama.
describe('Distribution/Return/Opname/Adjustment/Shift correction flows (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let boothId: string;
  let productId: string;
  let secondProductId: string;

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
    const activeShift = await request(app.getHttpServer())
      .get('/shifts/active')
      .set('Authorization', `Bearer ${boothLogin.body.accessToken}`)
      .expect(200);
    boothId = activeShift.body.booth.id;

    const catalog = await request(app.getHttpServer())
      .get('/catalog')
      .set('Authorization', `Bearer ${boothLogin.body.accessToken}`)
      .expect(200);
    productId = catalog.body[0].id;
    secondProductId = catalog.body[1].id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function warehouseQty(productId: string) {
    const res = await request(app.getHttpServer())
      .get('/warehouse-stock')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    return res.body.find((s: { productId: string }) => s.productId === productId).qtyOnHand;
  }

  async function boothQty(productId: string) {
    const res = await request(app.getHttpServer())
      .get('/booth-stock')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    return res.body.find((s: { boothId: string; productId: string }) => s.boothId === boothId && s.productId === productId)
      ?.qtyOnHand ?? 0;
  }

  async function createDistribution(qty: number) {
    const res = await request(app.getHttpServer())
      .post('/distributions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty }] })
      .expect(201);
    return res.body;
  }

  describe('Distribution corrections (TX-01/TX-02)', () => {
    it('COR-04: cancel SENT distribution restores warehouse stock and is idempotent', async () => {
      const before = await warehouseQty(productId);
      await createDistribution(5);
      expect(await warehouseQty(productId)).toBe(before - 5);

      const dist = await createDistribution(3);
      expect(await warehouseQty(productId)).toBe(before - 8);

      const idempotencyKey = randomUUID();
      await request(app.getHttpServer())
        .post(`/distributions/${dist.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey, reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
        .expect(201);
      expect(await warehouseQty(productId)).toBe(before - 5);

      await request(app.getHttpServer())
        .post(`/distributions/${dist.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey, reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
        .expect(201);
      expect(await warehouseQty(productId)).toBe(before - 5);
    });

    it('revise SENT distribution nets only the qty delta against warehouse', async () => {
      const before = await warehouseQty(productId);
      const dist = await createDistribution(4);
      expect(await warehouseQty(productId)).toBe(before - 4);

      const revised = await request(app.getHttpServer())
        .post(`/distributions/${dist.id}/revise`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), items: [{ productId, qty: 2 }], reasonCode: 'WRONG_QTY' })
        .expect(201);

      expect(await warehouseQty(productId)).toBe(before - 2);
      expect(revised.body.status).toBe('SENT');

      await request(app.getHttpServer())
        .post(`/distributions/${revised.body.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
        .expect(201);
      expect(await warehouseQty(productId)).toBe(before);
    });

    it('COR-05: correct-receipt on a RECEIVED distribution applies delta straight to booth stock', async () => {
      const dist = await createDistribution(6);
      await request(app.getHttpServer())
        .post(`/distributions/${dist.id}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ productId, actualQty: 6 }] })
        .expect(201);

      const boothBefore = await boothQty(productId);

      await request(app.getHttpServer())
        .post(`/distributions/${dist.id}/correct-receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), items: [{ productId, qty: 4 }], reasonCode: 'WRONG_PHYSICAL_COUNT' })
        .expect(201);

      expect(await boothQty(productId)).toBe(boothBefore - 2);
    });
  });

  async function createReturn(qty: number) {
    const boothLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'booth01', password: 'obbel123' })
      .expect(200);
    const res = await request(app.getHttpServer())
      .post('/returns')
      .set('Authorization', `Bearer ${boothLogin.body.accessToken}`)
      .send({ items: [{ productId: secondProductId, qty }] })
      .expect(201);
    return res.body;
  }

  describe('Return corrections (TX-09/TX-10)', () => {
    it('COR-06: cancel + revise SUBMITTED return nets the qty delta against booth stock, and is idempotent', async () => {
      const dist = await createDistribution(8);
      await request(app.getHttpServer())
        .post(`/distributions/${dist.id}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ productId, actualQty: 8 }] })
        .expect(201);

      const boothLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'booth01', password: 'obbel123' })
        .expect(200);

      const before = await boothQty(productId);
      const ret = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${boothLogin.body.accessToken}`)
        .send({ items: [{ productId, qty: 5 }] })
        .expect(201);
      expect(await boothQty(productId)).toBe(before - 5);

      const revised = await request(app.getHttpServer())
        .post(`/returns/${ret.body.id}/revise`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), items: [{ productId, qty: 3 }], reasonCode: 'WRONG_QTY' })
        .expect(201);

      expect(await boothQty(productId)).toBe(before - 3);

      const idempotencyKey = randomUUID();
      await request(app.getHttpServer())
        .post(`/returns/${revised.body.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey, reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
        .expect(201);
      expect(await boothQty(productId)).toBe(before);

      // idempotent replay must not double-restore
      await request(app.getHttpServer())
        .post(`/returns/${revised.body.id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey, reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
        .expect(201);
      expect(await boothQty(productId)).toBe(before);
    });

    it('correct-receipt on a RECEIVED return applies delta to warehouse stock', async () => {
      const dist = await createDistribution(6);
      await request(app.getHttpServer())
        .post(`/distributions/${dist.id}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ productId, actualQty: 6 }] })
        .expect(201);

      const boothLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'booth01', password: 'obbel123' })
        .expect(200);
      const ret = await request(app.getHttpServer())
        .post('/returns')
        .set('Authorization', `Bearer ${boothLogin.body.accessToken}`)
        .send({ items: [{ productId, qty: 6 }] })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/returns/${ret.body.id}/receive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: [{ productId, qtyReceived: 6 }] })
        .expect(201);

      const warehouseBefore = await warehouseQty(productId);

      await request(app.getHttpServer())
        .post(`/returns/${ret.body.id}/correct-receipt`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), items: [{ productId, qty: 4 }], reasonCode: 'WRONG_PHYSICAL_COUNT' })
        .expect(201);

      expect(await warehouseQty(productId)).toBe(warehouseBefore - 2);
    });
  });

  describe('Stock Opname (TX-11/TX-12)', () => {
    it('COR-07: confirm applies discrepancy then recount applies a compensating delta', async () => {
      const before = await warehouseQty(productId);

      const started = await request(app.getHttpServer())
        .post('/stock-opname')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ locationType: 'WAREHOUSE' })
        .expect(201);
      expect(started.body.status).toBe('DRAFT');

      const items = started.body.items.map((i: { productId: string; expectedQty: number }) =>
        i.productId === productId ? { productId, actualQty: i.expectedQty - 3 } : { productId: i.productId, actualQty: i.expectedQty },
      );

      const confirmed = await request(app.getHttpServer())
        .post(`/stock-opname/${started.body.id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), items, reasonCode: 'WRONG_PHYSICAL_COUNT' })
        .expect(201);
      expect(confirmed.body.status).toBe('CONFIRMED');
      expect(await warehouseQty(productId)).toBe(before - 3);

      // Recount: actual should have been (before - 3), correct it to (before - 1) — a +2 compensating delta.
      const recountItems = confirmed.body.items.map((i: { productId: string; actualQty: number }) =>
        i.productId === productId ? { productId, actualQty: i.actualQty + 2 } : { productId: i.productId, actualQty: i.actualQty },
      );
      const recounted = await request(app.getHttpServer())
        .post(`/stock-opname/${started.body.id}/recount`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), items: recountItems, reasonCode: 'WRONG_PHYSICAL_COUNT' })
        .expect(201);
      expect(recounted.body.status).toBe('CONFIRMED');
      expect(recounted.body.versionNo).toBe(2);
      expect(await warehouseQty(productId)).toBe(before - 1);

      // The original opname must be superseded, not deleted (DC-008 immutability).
      const original = await request(app.getHttpServer())
        .get(`/stock-opname/${started.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(original.body.status).toBe('SUPERSEDED');
    });
  });

  describe('Manual Stock Adjustment (TX-13)', () => {
    it('COR-09: create adjusts to target qty, reverse restores prior qty and cannot double-reverse', async () => {
      const before = await warehouseQty(productId);
      const targetQty = before + 15;

      const created = await request(app.getHttpServer())
        .post('/stock-adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          idempotencyKey: randomUUID(),
          locationType: 'WAREHOUSE',
          productId,
          targetQty,
          reasonCode: 'FOUND',
        })
        .expect(201);
      expect(await warehouseQty(productId)).toBe(targetQty);

      await request(app.getHttpServer())
        .post(`/stock-adjustments/${created.body.entityId}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), reasonCode: 'DATA_ENTRY_ERROR' })
        .expect(201);
      expect(await warehouseQty(productId)).toBe(before);

      const res = await request(app.getHttpServer())
        .post(`/stock-adjustments/${created.body.entityId}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), reasonCode: 'DATA_ENTRY_ERROR' })
        .expect(400);
      expect(res.body.code).toBe('ADJUSTMENT_ALREADY_REVERSED');
    });
  });

  describe('Shift correction (TX-07)', () => {
    it('COR-08: correcting shift template has no stock effect and is idempotent', async () => {
      const boothLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'booth01', password: 'obbel123' })
        .expect(200);
      const activeShift = await request(app.getHttpServer())
        .get('/shifts/active')
        .set('Authorization', `Bearer ${boothLogin.body.accessToken}`)
        .expect(200);
      const shiftSessionId = activeShift.body.shiftSessionId;
      // Seed always starts booth01's shift on the "Shift 1" template.
      const originalTemplateId = 'a0000000-0000-4000-8000-000000000001';
      const otherTemplateId = 'a0000000-0000-4000-8000-000000000003';

      const idempotencyKey = randomUUID();
      const corrected = await request(app.getHttpServer())
        .post(`/shifts/${shiftSessionId}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey, shiftTemplateId: otherTemplateId, reasonCode: 'WRONG_SHIFT' })
        .expect(201);
      expect(corrected.body.shiftTemplateId).toBe(otherTemplateId);

      // idempotent replay must not error and must not double-apply
      const replay = await request(app.getHttpServer())
        .post(`/shifts/${shiftSessionId}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey, shiftTemplateId: otherTemplateId, reasonCode: 'WRONG_SHIFT' })
        .expect(201);
      expect(replay.body.shiftTemplateId).toBe(otherTemplateId);

      // restore original template so other tests/re-runs are unaffected
      await request(app.getHttpServer())
        .post(`/shifts/${shiftSessionId}/correct`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ idempotencyKey: randomUUID(), shiftTemplateId: originalTemplateId, reasonCode: 'WRONG_SHIFT' })
        .expect(201);
    });

    it('rejects Booth reassignment once the shift already has dependent sales', async () => {
      const boothLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'booth01', password: 'obbel123' })
        .expect(200);
      const activeShift = await request(app.getHttpServer())
        .get('/shifts/active')
        .set('Authorization', `Bearer ${boothLogin.body.accessToken}`)
        .expect(200);

      const preview = await request(app.getHttpServer())
        .get(`/shifts/${activeShift.body.shiftSessionId}/preview-correction`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (preview.body.hasDependentTransactions) {
        const res = await request(app.getHttpServer())
          .post(`/shifts/${activeShift.body.shiftSessionId}/correct`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ idempotencyKey: randomUUID(), boothId: randomUUID(), reasonCode: 'WRONG_BOOTH' })
          .expect(400);
        expect(res.body.code).toBe('SHIFT_BOOTH_LOCKED');
      } else {
        expect(preview.body.salesCount).toBe(0);
        expect(preview.body.movementsCount).toBe(0);
      }
    });
  });
});
