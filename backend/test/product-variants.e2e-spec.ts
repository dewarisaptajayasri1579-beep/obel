import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { businessDateKeyJakarta } from '../src/common/jakarta-date';
import { absenTiba, bereskanShiftLama, LOKASI_TEST, tutupShiftLengkap } from './support/shift';
import { isiUlangGudang } from './support/warehouse';

// main.ts serializes BigInt globally; the e2e app does not run main.ts.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

/// Varian rasa (C9, kunjungan client 2026-11-23): Kopsu Rasa dijual per rasa dengan harga dan stok
/// produknya. Satu baris sale = produk + rasa, jadi dua rasa satu produk adalah dua baris; refund
/// dihitung per baris, revisi menghitung stok per produk (semua rasa dijumlah).
///
/// Produk, booth, dan Petugas khusus spec ini dipakai ulang tiap run; shift ditutup di akhir sehingga
/// stok booth kembali ke Gudang.
describe('Product flavour variants (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let shiftId: string;
  let boothId: string;
  let productId: string;
  let plainProductId: string;
  const rasa: Record<string, string> = {};

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const staff = () => ({ Authorization: `Bearer ${staffToken}` });
  const NAMA_PRODUK = 'E2E Kopsu Rasa';

  type Varian = { id: string; name: string; active: boolean };
  const produk = async () =>
    ((await request(server()).get('/products').set(admin()).expect(200)).body as { id: string; name: string; variants: Varian[] }[]).find(
      (p) => p.id === productId,
    )!;

  /// Daftar varian = `nama` (urut), memakai id varian lama dengan nama sama; varian lain dilepas.
  async function aturVarian(nama: string[]) {
    const lama = (await produk()).variants;
    const variants = nama.map((n) => {
      const ada = lama.find((v) => v.name.toLowerCase() === n.toLowerCase());
      return ada ? { id: ada.id, name: n, active: true } : { name: n };
    });
    return request(server()).patch(`/products/${productId}`).set(admin()).send({ variants }).expect(200);
  }

  const jual = (items: { productId: string; variantId?: string; qty: number }[]) =>
    request(server()).post('/sales').set(staff()).send({ idempotencyKey: randomUUID(), shiftSessionId: shiftId, paymentMethod: 'CASH', items });

  const stokBooth = async () =>
    (await prisma.boothStock.findUnique({ where: { boothId_productId: { boothId, productId } } }))?.qtyOnHand ?? 0;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    adminToken = (await request(server()).post('/auth/login').send({ username: 'admin', password: 'obbel123' }).expect(200)).body
      .accessToken;

    const semua = (await request(server()).get('/products').set(admin()).expect(200)).body as {
      id: string;
      name: string;
      active: boolean;
      variants: Varian[];
    }[];
    const ada = semua.find((p) => p.name === NAMA_PRODUK);
    if (ada) {
      productId = ada.id;
    } else {
      // Jalur create ikut diuji: produk baru langsung dengan dua varian.
      const dibuat = await request(server())
        .post('/products')
        .set(admin())
        .send({ name: NAMA_PRODUK, sellPrice: 13000, variants: [{ name: 'Butterscotch' }, { name: 'Brown Sugar' }] })
        .expect(201);
      expect(dibuat.body.variants.map((v: Varian) => v.name)).toEqual(['Butterscotch', 'Brown Sugar']);
      productId = dibuat.body.id;
    }
    await aturVarian(['Butterscotch', 'Brown Sugar']);
    for (const v of (await produk()).variants) rasa[v.name] = v.id;
    plainProductId = semua.find((p) => p.active && p.variants.length === 0 && p.id !== productId)!.id;

    const booths = await request(server()).get('/booths').set(admin()).expect(200);
    boothId = (
      booths.body.find((b: { code: string }) => b.code === 'E2E-VARIANT') ??
      (await request(server()).post('/booths').set(admin()).send({ code: 'E2E-VARIANT', name: 'E2E Variant Booth' }).expect(201)).body
    ).id;

    const username = 'e2e_variant_staff';
    const buat = await request(server()).post('/users').set(admin()).send({ username, password: 'obbel123', fullName: 'E2E Varian', role: 'BOOTH_STAFF' });
    if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
    const login = await request(server()).post('/auth/login').send({ username, password: 'obbel123' }).expect(200);
    const staffId = JSON.parse(Buffer.from(login.body.accessToken.split('.')[1], 'base64url').toString('utf8')).sub as string;
    const templates = (await request(server()).get('/shift-templates').set(admin()).expect(200)).body as { id: string }[];
    await request(server()).put('/booth-shift-assignments').set(admin()).send({ boothId, shiftTemplateId: templates[0].id, staffId, reassign: true }).expect(200);

    const token = await bereskanShiftLama(app, adminToken, login.body.accessToken);
    const checkIn = await request(server())
      .post('/shifts/check-in')
      .set({ Authorization: `Bearer ${token}` })
      .send({ ...LOKASI_TEST, photoUrl: 'https://example.com/absen.jpg' })
      .expect(201);
    staffToken = checkIn.body.accessToken ?? token;
    shiftId = checkIn.body.shiftSessionId;

    await isiUlangGudang(app, adminToken, [productId, plainProductId]);
    const dist = await request(server())
      .post('/distributions')
      .set(admin())
      .send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty: 20 }, { productId: plainProductId, qty: 5 }] })
      .expect(201);
    await request(server())
      .post(`/distributions/${dist.body.id}/receive`)
      .set(staff())
      .send({ items: [{ productId, actualQty: 20 }, { productId: plainProductId, actualQty: 5 }] })
      .expect(201);
    await absenTiba(app, staffToken, shiftId);
  });

  afterAll(async () => {
    if (shiftId) await tutupShiftLengkap(app, adminToken, staffToken, shiftId);
    // Spec lain memilih produk dari katalog/Gudang tanpa rasa; varian aktif membuat penjualan mereka
    // ditolak VARIANT_REQUIRED. Lepas semua varian (yang terjual jadi nonaktif, run berikutnya
    // mengaktifkannya lagi lewat aturVarian).
    if (productId) await aturVarian([]);
    await app.close();
  });

  it('asks for a flavour when the product has variants, and only accepts its own', async () => {
    expect((await jual([{ productId, qty: 1 }]).expect(400)).body.code).toBe('VARIANT_REQUIRED');
    expect((await jual([{ productId, variantId: randomUUID(), qty: 1 }]).expect(400)).body.code).toBe('VARIANT_INVALID');
    expect((await jual([{ productId: plainProductId, variantId: rasa['Butterscotch'], qty: 1 }]).expect(400)).body.code).toBe(
      'VARIANT_INVALID',
    );
  });

  it('sells two flavours of one product as two lines at the product price and stock', async () => {
    const sebelum = await stokBooth();
    const res = await jual([
      { productId, variantId: rasa['Butterscotch'], qty: 2 },
      { productId, variantId: rasa['Brown Sugar'], qty: 1 },
      { productId: plainProductId, qty: 1 },
    ]).expect(201);
    expect(res.body.items).toEqual([
      expect.objectContaining({ productId, variantName: 'Butterscotch', qty: 2, unitPrice: 13000, lineTotal: 26000 }),
      expect.objectContaining({ productId, variantName: 'Brown Sugar', qty: 1, unitPrice: 13000 }),
      expect.objectContaining({ productId: plainProductId, variantId: null, variantName: null }),
    ]);
    expect(await stokBooth()).toBe(sebelum - 3);

    // Refund dihitung per rasa: Brown Sugar cuma 1 walau produknya terjual 3.
    const refund = (items: { productId: string; variantId?: string; qty: number }[]) =>
      request(server())
        .post(`/sales/${res.body.id}/refund`)
        .set(admin())
        .send({ idempotencyKey: randomUUID(), items, condition: 'REFUND_NO_STOCK_RETURN', reasonCode: 'WRONG_QTY' });
    expect((await refund([{ productId, variantId: rasa['Brown Sugar'], qty: 2 }]).expect(400)).body.code).toBe('REFUND_EXCEEDS_SALE_QTY');
    const ok = await refund([{ productId, variantId: rasa['Butterscotch'], qty: 2 }]).expect(201);
    expect(ok.body.items).toEqual([expect.objectContaining({ variantName: 'Butterscotch', qty: 2 })]);
    expect((await refund([{ productId, variantId: rasa['Butterscotch'], qty: 1 }]).expect(400)).body.code).toBe('REFUND_EXCEEDS_SALE_QTY');
  });

  it('revises one flavour and moves stock by the product total', async () => {
    const sale = await jual([
      { productId, variantId: rasa['Butterscotch'], qty: 1 },
      { productId, variantId: rasa['Brown Sugar'], qty: 1 },
    ]).expect(201);
    const sebelum = await stokBooth();
    const revisi = await request(server())
      .post(`/sales/${sale.body.id}/revise`)
      .set(admin())
      .send({
        idempotencyKey: randomUUID(),
        items: [
          { productId, variantId: rasa['Butterscotch'], qty: 3 },
          { productId, variantId: rasa['Brown Sugar'], qty: 1 },
        ],
        reasonCode: 'WRONG_QTY',
      })
      .expect(201);
    expect(await stokBooth()).toBe(sebelum - 2);
    const baru = await prisma.saleItem.findMany({ where: { saleId: revisi.body.newSaleId ?? revisi.body.id }, orderBy: { qty: 'desc' } });
    expect(baru.map((i) => [i.variantNameSnapshot, i.qty])).toEqual([
      ['Butterscotch', 3],
      ['Brown Sugar', 1],
    ]);
  });

  it('keeps the flavour on a draft', async () => {
    const draft = await request(server())
      .post('/sales/draft')
      .set(staff())
      .send({ idempotencyKey: randomUUID(), shiftSessionId: shiftId, items: [{ productId, variantId: rasa['Brown Sugar'], qty: 1 }] })
      .expect(201);
    const drafts = (await request(server()).get('/sales/drafts').set(staff()).expect(200)).body as { id: string; items: { variantName: string }[] }[];
    expect(drafts.find((d) => d.id === draft.body.id)?.items).toEqual([expect.objectContaining({ variantName: 'Brown Sugar' })]);
    await request(server()).delete(`/sales/${draft.body.id}/draft`).set(staff()).expect(200);
  });

  it('breaks the product down per flavour in Ringkasan Shift and the dashboard', async () => {
    const ringkasan = (await request(server()).get(`/shifts/${shiftId}/sales-summary`).set(staff()).expect(200)).body as {
      kategori: { produk: { name: string; qty: number; varian: { name: string; qty: number }[] }[] }[];
    };
    const baris = ringkasan.kategori.flatMap((k) => k.produk).find((p) => p.name === NAMA_PRODUK)!;
    // Sale 1: Butterscotch 2 + Brown Sugar 1; sale 2 setelah revisi: Butterscotch 3 + Brown Sugar 1.
    expect(baris).toMatchObject({ qty: 7, varian: [{ name: 'Brown Sugar', qty: 2 }, { name: 'Butterscotch', qty: 5 }] });

    const hari = businessDateKeyJakarta(new Date());
    const laporan = (await request(server()).get(`/dashboard/sales-report?start=${hari}&end=${hari}`).set(admin()).expect(200)).body as {
      byProduct: { productId: string; cupSold: number; variants: { name: string; cupSold: number }[] }[];
    };
    // Hari yang sama memuat run lain & spec lain yang menjual produk ini tanpa rasa: cukup pastikan
    // rasa run ini terhitung dan rinciannya tidak melebihi total produk.
    const p = laporan.byProduct.find((x) => x.productId === productId)!;
    const cup = (nama: string) => p.variants.find((v) => v.name === nama)?.cupSold ?? 0;
    expect(cup('Butterscotch')).toBeGreaterThanOrEqual(5);
    expect(cup('Brown Sugar')).toBeGreaterThanOrEqual(2);
    expect(p.variants.reduce((n, v) => n + v.cupSold, 0)).toBeLessThanOrEqual(p.cupSold);
  });

  it('deletes an unused variant, deactivates a sold one, and refuses duplicate names', async () => {
    await aturVarian(['Butterscotch', 'Brown Sugar', 'E2E Hapus']);
    const hapusId = (await produk()).variants.find((v) => v.name === 'E2E Hapus')!.id;

    // Brown Sugar sudah terjual → nonaktif (tetap tercantum); E2E Hapus belum → terhapus.
    await aturVarian(['Butterscotch']);
    const sesudah = (await produk()).variants;
    expect(sesudah.map((v) => [v.name, v.active])).toEqual([
      ['Butterscotch', true],
      ['Brown Sugar', false],
    ]);
    expect((await prisma.productVariant.findUnique({ where: { id: hapusId } }))?.deletedAt).not.toBeNull();
    expect((await jual([{ productId, variantId: rasa['Brown Sugar'], qty: 1 }]).expect(400)).body.code).toBe('VARIANT_INVALID');

    const dobel = await request(server())
      .patch(`/products/${productId}`)
      .set(admin())
      .send({ variants: [{ id: rasa['Butterscotch'], name: 'Butterscotch' }, { name: 'butterscotch' }] })
      .expect(409);
    expect(dobel.body.code).toBe('VARIANT_NAME_TAKEN');

    await aturVarian(['Butterscotch', 'Brown Sugar']);
    expect((await produk()).variants.every((v) => v.active)).toBe(true);
  });
});
