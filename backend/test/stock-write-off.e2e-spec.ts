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

/// BR-041 — Pemusnahan Stok Gudang: Admin mengeluarkan produk expired dari Gudang
/// dengan foto bukti wajib. Stok berkurang lewat ledger (ADJUSTMENT keluar Gudang),
/// dokumen koreksi beralasan EXPIRED menyimpan foto, retry tercatat sekali, dan salah
/// input dibatalkan lewat reverse (stok kembali). Petugas tidak boleh.
describe('Stock write-off (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let productId: string;
  const uploadedFiles: string[] = [];
  const JPEG = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64',
  );

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

    const gudang = (await request(server()).get('/warehouse-stock').set(admin()).expect(200)).body as { productId: string; qtyOnHand: number }[];
    productId = [...gudang].sort((a, b) => b.qtyOnHand - a.qtyOnHand)[0].productId;
    await isiUlangGudang(app, adminToken, [productId]);
  });

  afterAll(async () => {
    for (const url of uploadedFiles) {
      const file = join(process.cwd(), 'uploads', 'stock-write-offs', url.split('/').pop()!);
      if (existsSync(file)) unlinkSync(file);
    }
    await app.close();
  });

  const stokGudang = async () => (await prisma.warehouseStock.findUniqueOrThrow({ where: { productId } })).qtyOnHand;
  async function uploadFoto(): Promise<string> {
    const res = await request(server())
      .post('/stock-adjustments/write-off/photo')
      .set(admin())
      .attach('file', JPEG, { filename: 'expired.jpg', contentType: 'image/jpeg' })
      .expect(201);
    uploadedFiles.push(res.body.photoUrl);
    expect(res.body.photoUrl).toMatch(/\/uploads\/stock-write-offs\/[0-9a-f-]{36}\.jpg$/);
    return res.body.photoUrl;
  }
  const musnahkan = (body: Record<string, unknown>) =>
    request(server()).post('/stock-adjustments/write-off').set(admin()).send({ idempotencyKey: randomUUID(), productId, ...body });

  it('rejects a missing or foreign photo and a qty above the warehouse stock, without touching stock', async () => {
    const awal = await stokGudang();
    await musnahkan({ qty: 1 }).expect(400);
    const asing = await musnahkan({ qty: 1, photoUrl: 'https://example.com/foto.jpg' }).expect(400);
    expect(JSON.stringify(asing.body)).toContain('Foto bukti pemusnahan tidak valid');
    const lebih = await musnahkan({ qty: awal + 1, photoUrl: await uploadFoto() }).expect(400);
    expect(lebih.body.code).toBe('INSUFFICIENT_STOCK');
    expect(lebih.body.details.available).toBe(awal);
    expect(await stokGudang()).toBe(awal);
  });

  it('writes off through the ledger with an EXPIRED document holding the photo, once per key', async () => {
    const awal = await stokGudang();
    const foto = await uploadFoto();
    const key = randomUUID();
    const kirim = () =>
      request(server()).post('/stock-adjustments/write-off').set(admin()).send({ idempotencyKey: key, productId, qty: 3, photoUrl: foto, reasonNote: 'Expired e2e' });

    const res = await kirim().expect(201);
    await kirim().expect(201);
    expect(await stokGudang()).toBe(awal - 3);

    const doc = await prisma.transactionCorrection.findUniqueOrThrow({ where: { idempotencyKey: key } });
    expect(doc).toMatchObject({ reasonCode: 'EXPIRED', evidencePhotoUrl: foto, reasonNote: 'Expired e2e', correctionType: 'ADJUSTMENT' });
    expect(doc.impactSnapshot).toMatchObject({ locationType: 'WAREHOUSE', productId, before: awal, after: awal - 3, delta: -3 });
    expect(res.body.id).toBe(doc.id);

    const movs = await prisma.stockMovement.findMany({ where: { referenceId: doc.entityId } });
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ movementType: 'ADJUSTMENT', referenceType: 'stock_adjustment_out', qty: 3, productId });

    // Salah input → dibatalkan lewat reverse: stok kembali, tidak bisa dua kali.
    const batal = () =>
      request(server())
        .post(`/stock-adjustments/${doc.entityId}/reverse`)
        .set(admin())
        .send({ idempotencyKey: randomUUID(), reasonCode: 'DATA_ENTRY_ERROR', reasonNote: 'salah produk' });
    await batal().expect(201);
    expect(await stokGudang()).toBe(awal);
    expect((await batal().expect(400)).body.code).toBe('ADJUSTMENT_ALREADY_REVERSED');
  });

  it('is admin-only', async () => {
    const boothToken = (await request(server()).post('/auth/login').send({ username: 'booth01', password: 'obbel123' }).expect(200)).body.accessToken;
    await request(server())
      .post('/stock-adjustments/write-off')
      .set({ Authorization: `Bearer ${boothToken}` })
      .send({ idempotencyKey: randomUUID(), productId, qty: 1, photoUrl: '/uploads/stock-write-offs/00000000-0000-0000-0000-000000000000.jpg' })
      .expect(403);
  });
});
