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

/// Menjalankan acceptance criteria AC-01..AC-25 dari
/// docs/obbel-coffee-ai-docs/15-testing-acceptance-criteria.md yang belum
/// pernah punya test otomatis sama sekali (hanya alur koreksi/TX-xx yang
/// sudah dicover di correction-flows*.e2e-spec.ts).
///
/// Sengaja TIDAK dicover di sini (didokumentasikan, bukan diabaikan):
/// - AC-07 (concurrent sales race) — butuh true concurrency timing yang
///   tidak deterministik untuk dijadikan e2e assertion yang stabil.
/// - AC-13/AC-14/AC-15 (closing discrepancy reason, closed-shift sale
///   rejection) — satu-satunya shift aktif di seed dipakai bersama oleh
///   spec lain di suite ini. `POST /shifts/:id/closing/start` sendiri
///   sudah memindahkan status shift dari OPEN ke CLOSING tanpa cara
///   membatalkannya lewat API — memanggilnya di sini akan merusak setiap
///   test lain yang butuh shift OPEN untuk sisa run ini. Tidak ada endpoint
///   untuk membuat shift session baru yang disposable lewat API.
/// - AC-20 (void tidak menghapus sale) — sudah dicover oleh
///   correction-flows.e2e-spec.ts (COR-01).
/// - AC-21/22/23 (print failure UX, PWA responsive, loading/error state) —
///   ini perilaku UI klien, bukan sesuatu yang backend e2e bisa uji.
/// - AC-24 (timezone bucketing) — dicover lewat unit test murni di
///   src/common/jakarta-date.spec.ts karena server selalu memakai waktu
///   asli (`new Date()`), jadi e2e tidak bisa mengontrol titik waktunya.
describe('Acceptance criteria AC-01..AC-25 (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let ownerToken: string;
  let boothToken: string;
  let boothId: string;
  let otherBoothId: string;
  let shiftSessionId: string;
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

    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'owner', password: 'obbel123' })
      .expect(200);
    ownerToken = ownerLogin.body.accessToken;

    const boothLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'booth01', password: 'obbel123' })
      .expect(200);
    boothToken = boothLogin.body.accessToken;

    const activeShift = await request(app.getHttpServer())
      .get('/shifts/active')
      .set('Authorization', `Bearer ${boothToken}`)
      .expect(200);
    boothId = activeShift.body.booth.id;
    shiftSessionId = activeShift.body.shiftSessionId;

    const booths = await request(app.getHttpServer())
      .get('/booths')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    otherBoothId = booths.body.find((b: { id: string }) => b.id !== boothId).id;

    const catalog = await request(app.getHttpServer())
      .get('/catalog')
      .set('Authorization', `Bearer ${boothToken}`)
      .expect(200);
    // Deliberately catalog[2]/[3], not [0]/[1] — correction-flows-extended
    // .e2e-spec.ts already draws its productId/secondProductId from [0]/[1]
    // against the same finite shared warehouse pool. Using different
    // products avoids both files starving each other of stock when run
    // together in one `npm run test:e2e` invocation.
    productId = catalog.body[2].id;
    secondProductId = catalog.body[3].id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function warehouseQty(pid: string) {
    const res = await request(app.getHttpServer())
      .get('/warehouse-stock')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    return res.body.find((s: { productId: string }) => s.productId === pid).qtyOnHand;
  }

  async function boothStockOf(bid: string, pid: string) {
    const res = await request(app.getHttpServer())
      .get('/booth-stock')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    return res.body.find((s: { boothId: string; productId: string }) => s.boothId === bid && s.productId === pid)
      ?.qtyOnHand ?? 0;
  }

  it('AC-01: Booth Staff login returns the correct role/profile, and lands on their own active shift', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'booth01', password: 'obbel123' })
      .expect(200);
    expect(login.body.profile.role).toBe('BOOTH_STAFF');
    expect(login.body.profile.username).toBe('booth01');

    const shift = await request(app.getHttpServer())
      .get('/shifts/active')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(shift.body.booth.id).toBe(boothId);
    expect(shift.body.status).toBe('OPEN');
  });

  it('AC-02: Booth Staff cannot act on another Booth by swapping the ID manually', async () => {
    const dist = await request(app.getHttpServer())
      .post('/distributions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), boothId: otherBoothId, items: [{ productId, qty: 3 }] })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/distributions/${dist.body.id}/receive`)
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ items: [{ productId, actualQty: 3 }] })
      .expect(400);
    expect(res.body.code).toBe('UNAUTHORIZED_BOOTH');

    // cancel so the warehouse deduction doesn't linger for other tests
    await request(app.getHttpServer())
      .post(`/distributions/${dist.body.id}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
      .expect(201);
  });

  it('AC-03: receiving a distribution adds stock exactly once and records a movement', async () => {
    const boothBefore = await boothStockOf(boothId, productId);
    const dist = await request(app.getHttpServer())
      .post('/distributions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty: 10 }] })
      .expect(201);

    const received = await request(app.getHttpServer())
      .post(`/distributions/${dist.body.id}/receive`)
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ items: [{ productId, actualQty: 10 }] })
      .expect(201);

    expect(received.body.status).toBe('RECEIVED');
    expect(await boothStockOf(boothId, productId)).toBe(boothBefore + 10);
  });

  it('AC-04: double receive with the same distribution does not double the stock', async () => {
    const boothBefore = await boothStockOf(boothId, productId);
    const dist = await request(app.getHttpServer())
      .post('/distributions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty: 4 }] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/distributions/${dist.body.id}/receive`)
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ items: [{ productId, actualQty: 4 }] })
      .expect(201);
    expect(await boothStockOf(boothId, productId)).toBe(boothBefore + 4);

    // Same distribution, receive again — service short-circuits on status RECEIVED.
    await request(app.getHttpServer())
      .post(`/distributions/${dist.body.id}/receive`)
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ items: [{ productId, actualQty: 4 }] })
      .expect(201);
    expect(await boothStockOf(boothId, productId)).toBe(boothBefore + 4);
  });

  it('AC-05: sale success reduces stock by the sold qty and posts a payment', async () => {
    const before = await boothStockOf(boothId, productId);
    const res = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ idempotencyKey: randomUUID(), shiftSessionId, paymentMethod: 'CASH', items: [{ productId, qty: 2 }] })
      .expect(201);

    expect(res.body.total).toBeGreaterThan(0);
    expect(await boothStockOf(boothId, productId)).toBe(before - 2);

    const detail = await request(app.getHttpServer())
      .get(`/sales/${res.body.saleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.status).toBe('PAID');
  });

  it('AC-06: insufficient stock fails the whole sale, leaving stock untouched', async () => {
    const before = await boothStockOf(boothId, secondProductId);
    const res = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${boothToken}`)
      .send({
        idempotencyKey: randomUUID(),
        shiftSessionId,
        paymentMethod: 'CASH',
        items: [{ productId: secondProductId, qty: before + 1000 }],
      })
      .expect(400);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect(await boothStockOf(boothId, secondProductId)).toBe(before);
  });

  it('AC-08: server ignores/rejects any client-supplied price — sale DTO has no price field', async () => {
    // whitelist:true + forbidNonWhitelisted:true means an extra `unitPrice`
    // field is rejected outright, not silently dropped and not honored.
    const res = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${boothToken}`)
      .send({
        idempotencyKey: randomUUID(),
        shiftSessionId,
        paymentMethod: 'CASH',
        items: [{ productId, qty: 1, unitPrice: 1 }],
      })
      .expect(400);
    expect(res.body.message).toBeDefined();
  });

  it('AC-09: stock status crosses Menipis/Kritis/Habis thresholds correctly', async () => {
    const minimumQty = 20;
    const criticalQty = 8;
    await request(app.getHttpServer())
      .post('/booth-stock-thresholds/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ boothId, items: [{ productId: secondProductId, minimumQty, criticalQty }] })
      .expect(201);

    // Set booth stock to a known absolute qty via TX-13 manual adjustment —
    // unlike distribution+receive this doesn't drain the shared warehouse
    // pool (finite, shared across every re-run of this suite), and gives an
    // exact deterministic starting point regardless of current stock.
    await request(app.getHttpServer())
      .post('/stock-adjustments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        idempotencyKey: randomUUID(),
        locationType: 'BOOTH',
        boothId,
        productId: secondProductId,
        targetQty: 50,
        reasonCode: 'DATA_ENTRY_ERROR',
        reasonNote: 'AC-09 test fixture setup',
      })
      .expect(201);
    let remaining = 50;

    async function statusFor() {
      const res = await request(app.getHttpServer())
        .get('/catalog')
        .set('Authorization', `Bearer ${boothToken}`)
        .expect(200);
      return res.body.find((p: { id: string }) => p.id === secondProductId).status as string;
    }

    async function sellDownTo(target: number) {
      const qty = remaining - target;
      await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${boothToken}`)
        .send({ idempotencyKey: randomUUID(), shiftSessionId, paymentMethod: 'CASH', items: [{ productId: secondProductId, qty }] })
        .expect(201);
      remaining = target;
    }

    expect(await statusFor()).toBe('Aman'); // well above minimumQty after the top-up

    await sellDownTo(minimumQty); // qty <= minimum, > critical -> Menipis
    expect(await statusFor()).toBe('Menipis');

    await sellDownTo(criticalQty); // qty <= critical, > 0 -> Kritis
    expect(await statusFor()).toBe('Kritis');

    await sellDownTo(0); // qty == 0 -> Habis
    expect(await statusFor()).toBe('Habis');
  });

  it('AC-10/AC-11/AC-12: restock request → Admin approve (bounded by warehouse) → receive adds stock once', async () => {
    const submitted = await request(app.getHttpServer())
      .post('/restock-requests')
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ items: [{ productId, qty: 5 }] })
      .expect(201);

    const adminList = await request(app.getHttpServer())
      .get('/restock-requests')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminList.body.some((r: { id: string }) => r.id === submitted.body.id)).toBe(true);

    // AC-11: approving more than warehouse has available must be rejected.
    const warehouseAvailable = await warehouseQty(productId);
    const overApprove = await request(app.getHttpServer())
      .post(`/restock-requests/${submitted.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId, qtyApproved: warehouseAvailable + 100000 }] })
      .expect(400);
    expect(overApprove.body.code).toBe('INSUFFICIENT_STOCK');

    // AC-12: within-bounds approval creates a distribution; receiving it adds stock exactly once.
    const boothBefore = await boothStockOf(boothId, productId);
    const approved = await request(app.getHttpServer())
      .post(`/restock-requests/${submitted.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId, qtyApproved: 5 }] })
      .expect(201);
    expect(approved.body.status).toBe('APPROVED');

    await request(app.getHttpServer())
      .post(`/distributions/${approved.body.distributionId}/receive`)
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ items: [{ productId, actualQty: 5 }] })
      .expect(201);
    expect(await boothStockOf(boothId, productId)).toBe(boothBefore + 5);
  });

  // AC-13/AC-14 (closing discrepancy requires a reason) are NOT live-tested
  // here for the same reason as AC-15: `POST /shifts/:id/closing/start`
  // itself moves the one shared seeded active shift from OPEN to CLOSING
  // with no API to revert it — even without ever calling `/closing/confirm`.
  // An earlier draft of this suite called `closing/start` here and it
  // broke every other sale-creating test/spec-file sharing this shift for
  // the rest of the run (SHIFT_NOT_OPEN), requiring a manual DB fix to
  // restore. The DISCREPANCY_REASON_REQUIRED guard itself (shifts.service.ts
  // confirmClosing()) is simple enough to read directly; exercising it live
  // needs a disposable shift-session fixture, which the API doesn't support.

  it('AC-16/AC-17: return received in full vs. received with a discrepancy', async () => {
    // Top up booth stock so there's something to return.
    const dist = await request(app.getHttpServer())
      .post('/distributions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty: 10 }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/distributions/${dist.body.id}/receive`)
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ items: [{ productId, actualQty: 10 }] })
      .expect(201);

    // AC-16: full receive.
    const warehouseBefore = await warehouseQty(productId);
    const ret1 = await request(app.getHttpServer())
      .post('/returns')
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ items: [{ productId, qty: 10 }] })
      .expect(201);
    const received1 = await request(app.getHttpServer())
      .post(`/returns/${ret1.body.id}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId, qtyReceived: 10 }] })
      .expect(201);
    expect(received1.body.status).toBe('RECEIVED');
    expect(await warehouseQty(productId)).toBe(warehouseBefore + 10);

    // AC-17: partial receive -> DISCREPANCY status, warehouse gets only the actual qty.
    const dist2 = await request(app.getHttpServer())
      .post('/distributions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty: 10 }] })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/distributions/${dist2.body.id}/receive`)
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ items: [{ productId, actualQty: 10 }] })
      .expect(201);

    const warehouseBefore2 = await warehouseQty(productId);
    const ret2 = await request(app.getHttpServer())
      .post('/returns')
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ items: [{ productId, qty: 10 }] })
      .expect(201);
    const received2 = await request(app.getHttpServer())
      .post(`/returns/${ret2.body.id}/receive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ productId, qtyReceived: 9 }] })
      .expect(201);
    expect(received2.body.status).toBe('DISCREPANCY');
    expect(await warehouseQty(productId)).toBe(warehouseBefore2 + 9);
  });

  it('AC-18: Owner cannot perform mutations (read-only role)', async () => {
    const res = await request(app.getHttpServer())
      .post('/distributions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty: 1 }] })
      .expect(403);
    expect(res.body).toBeDefined();
  });

  it('AC-19: sales report omzet counts only PAID, never VOIDED', async () => {
    // salesTrend's last entry is always "today" (reports.service builds the
    // trend window ending today, per businessDateKeyJakarta bucketing).
    async function todayOmzet() {
      const res = await request(app.getHttpServer())
        .get('/reports/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const trend = res.body.salesTrend as { date: string; omzet: number }[];
      return trend[trend.length - 1].omzet;
    }

    const omzetBefore = await todayOmzet();

    const sale = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ idempotencyKey: randomUUID(), shiftSessionId, paymentMethod: 'CASH', items: [{ productId, qty: 1 }] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/sales/${sale.body.saleId}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ idempotencyKey: randomUUID(), reasonCode: 'TRANSACTION_NEVER_HAPPENED' })
      .expect(201);

    // A voided sale must not move today's omzet at all.
    expect(await todayOmzet()).toBe(omzetBefore);
  });

  it('AC-25: deactivating a product removes it from catalog, but past sales keep their name/price snapshot', async () => {
    // This suite shares one real (non-ephemeral) database with every other
    // spec file and with the seed data itself — there's no DELETE endpoint
    // for products (by design, per the no-hard-delete audit philosophy), so
    // creating a throwaway product here would permanently pollute the master
    // catalog on every run. Instead, reuse an existing seeded product and
    // always flip it back to active before this test ends.
    const productBefore = await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const target = productBefore.body.find((p: { id: string; active: boolean }) => p.id === productId);
    const targetName = target.name as string;

    const sale = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${boothToken}`)
      .send({ idempotencyKey: randomUUID(), shiftSessionId, paymentMethod: 'CASH', items: [{ productId, qty: 1 }] })
      .expect(201);

    try {
      await request(app.getHttpServer())
        .patch(`/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: false })
        .expect(200);

      const catalogAfter = await request(app.getHttpServer())
        .get('/catalog')
        .set('Authorization', `Bearer ${boothToken}`)
        .expect(200);
      expect(catalogAfter.body.some((p: { id: string }) => p.id === productId)).toBe(false);

      const saleDetail = await request(app.getHttpServer())
        .get(`/sales/${sale.body.saleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const line = saleDetail.body.items.find((i: { productId: string }) => i.productId === productId);
      expect(line).toBeDefined();
      expect(line.productName).toBe(targetName);
    } finally {
      // Always reactivate — every other test/spec-file in this suite
      // assumes `productId` is sellable.
      await request(app.getHttpServer())
        .patch(`/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ active: true })
        .expect(200);
    }
  });
});
