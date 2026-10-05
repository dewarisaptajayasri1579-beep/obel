import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';

/// Snapshot penutupan shift (Check-Out) tidak boleh basi: shift tetap OPEN
/// sampai konfirmasi, jadi Petugas bisa membuka layar Check-Out, kembali,
/// lanjut jualan / terima stok, lalu membukanya lagi. Snapshot harus mengikuti
/// stok Booth terbaru, dan konfirmasi ditolak kalau stok berubah sejak layar
/// dibuka (STOCK_CHANGED_DURING_CLOSING).
///
/// Memakai Booth dan Petugas KHUSUS test ini (dicari dengan kode / username
/// tetap dan dipakai ulang tiap run — booth tidak bisa dihapus, jadi membuat
/// baru tiap run menumpuk data), sehingga stok booth lain tidak tersentuh.
/// TIDAK membuat produk baru: produk aktif ikut muncul di katalog booth
/// mana pun, dan spec lain memilih produk berdasarkan urutan katalog.
/// Konfirmasi Check-Out sengaja tidak dipanggil sampai sukses, supaya tidak
/// menghasilkan Return otomatis yang menggantung.
describe('Closing snapshot freshness (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let staffToken: string;
  let shiftSessionId: string;
  let boothId: string;
  let productId: string;

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const staff = () => ({ Authorization: `Bearer ${staffToken}` });

  const CHECKIN = { latitude: -6.2088, longitude: 106.8456, photoUrl: 'https://example.com/selfie.jpg' };
  const KODE_BOOTH = 'E2E-CLOSE';
  const USERNAME = 'e2e_closing_staff';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    adminToken = (await request(server()).post('/auth/login').send({ username: 'admin', password: 'obbel123' }).expect(200))
      .body.accessToken;

    // Booth khusus
    const booths = await request(server()).get('/booths').set(admin()).expect(200);
    let booth = booths.body.find((b: { code: string }) => b.code === KODE_BOOTH);
    if (!booth) {
      booth = (await request(server()).post('/booths').set(admin()).send({ code: KODE_BOOTH, name: 'E2E Closing Booth' }).expect(201)).body;
    }
    boothId = booth.id;

    // Produk dengan stok Gudang terbanyak — kiriman ke booth khusus di bawah
    // selalu diimbangi Tambah Stok Gudang dengan qty sama, jadi Gudang tidak terkuras.
    const gudang = await request(server()).get('/warehouse-stock').set(admin()).expect(200);
    productId = [...gudang.body].sort((a: { qtyOnHand: number }, b: { qtyOnHand: number }) => b.qtyOnHand - a.qtyOnHand)[0].productId;

    // Petugas khusus (dibuat sekali, dipakai ulang)
    const buat = await request(server())
      .post('/users')
      .set(admin())
      .send({ username: USERNAME, password: 'obbel123', fullName: 'E2E Closing Staff', role: 'BOOTH_STAFF' });
    if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
    const login = await request(server()).post('/auth/login').send({ username: USERNAME, password: 'obbel123' }).expect(200);
    const staffId = JSON.parse(Buffer.from(login.body.accessToken.split('.')[1], 'base64url').toString('utf8')).sub as string;

    const templates = await request(server()).get('/shift-templates').set(admin()).expect(200);
    await request(server())
      .put('/booth-shift-assignments')
      .set(admin())
      .send({ boothId, shiftTemplateId: templates.body[0].id, staffId, force: true })
      .expect(200);

    const checkIn = await request(server())
      .post('/shifts/check-in')
      .set({ Authorization: `Bearer ${login.body.accessToken}` })
      .send(CHECKIN)
      .expect(201);
    staffToken = checkIn.body.accessToken ?? login.body.accessToken;
    shiftSessionId = checkIn.body.shiftSessionId;

    // Stok awal di booth: minimal 10 cup produk khusus.
    await kirimKeBooth(10);
  });

  afterAll(async () => {
    await app.close();
  });

  async function stokBooth(): Promise<number> {
    const res = await request(server()).get('/booth-stock/mine').set(staff()).expect(200);
    return res.body.find((r: { productId: string }) => r.productId === productId)?.qtyOnHand ?? 0;
  }

  /// Admin kirim `qty` cup ke booth dan petugas menerimanya → stok booth +qty.
  async function kirimKeBooth(qty: number) {
    await request(server())
      .post('/stock-receipts')
      .set(admin())
      .send({ idempotencyKey: randomUUID(), receiptDate: new Date().toISOString(), status: 'POSTED', items: [{ productId, qtyReceived: qty }] })
      .expect(201);
    const dist = await request(server())
      .post('/distributions')
      .set(admin())
      .send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty }] })
      .expect(201);
    await request(server())
      .post(`/distributions/${dist.body.id}/receive`)
      .set(staff())
      .send({ items: [{ productId, actualQty: qty }] })
      .expect(201);
  }

  async function jual(qty: number) {
    await request(server())
      .post('/sales')
      .set(staff())
      .send({ idempotencyKey: randomUUID(), shiftSessionId, paymentMethod: 'CASH', items: [{ productId, qty }] })
      .expect(201);
  }

  const mulaiClosing = async () =>
    (await request(server()).post(`/shifts/${shiftSessionId}/closing/start`).set(staff()).expect(201)).body as {
      items: { productId: string; expectedQty: number; actualQty: number }[];
    };

  const expectedProduk = (closing: { items: { productId: string; expectedQty: number }[] }) =>
    closing.items.find((i) => i.productId === productId)!.expectedQty;

  const konfirmasi = (actualQty: number) =>
    request(server())
      .post(`/shifts/${shiftSessionId}/closing/confirm`)
      .set(staff())
      .send({
        items: [{ productId, actualQty }],
        checkOutLatitude: -6.2088,
        checkOutLongitude: 106.8456,
        checkOutPhotoUrl: 'https://example.com/out.jpg',
      });

  it('reopening the checkout screen refreshes a stale snapshot', async () => {
    const pertama = await mulaiClosing();
    expect(expectedProduk(pertama)).toBe(await stokBooth());

    // Lanjut kerja setelah layar dibuka: jual 2 lalu terima kiriman 5.
    await jual(2);
    await kirimKeBooth(5);
    const live = await stokBooth();

    const kedua = await mulaiClosing();
    expect(expectedProduk(kedua)).toBe(live);
    expect(kedua.items.find((i) => i.productId === productId)!.actualQty).toBe(live);
  });

  /// Layar Check-Out memanggil laporan shift dan startClosing BERSAMAAN, jadi laporan
  /// selalu terbaca sebelum snapshot diperbarui. "Awal" tidak boleh ikut bergeser
  /// oleh penjualan yang terjadi setelah snapshot terakhir: stok awal shift itu tetap.
  const laporan = async (): Promise<{ stokAwal: number; restock: number; terjual: number; sisaSistem: number }> => {
    const res = await request(server()).get(`/shifts/${shiftSessionId}/report`).set(staff()).expect(200);
    return res.body.items.find((i: { productId: string }) => i.productId === productId);
  };

  it('report opening stock does not shift when sales happen after the last snapshot', async () => {
    await mulaiClosing(); // snapshot = stok sekarang
    const sebelum = await laporan();

    await jual(3); // snapshot kini basi, tapi layar berikutnya membaca laporan dulu
    const sesudah = await laporan();
    const live = await stokBooth();

    expect(sesudah.terjual).toBe(sebelum.terjual + 3);
    expect(sesudah.sisaSistem).toBe(live);
    expect(sesudah.stokAwal).toBe(sebelum.stokAwal);
  });

  /// Draft (PENDING) hanya bisa dibayar/dihapus selama shift-nya terbuka — Check-Out
  /// ditolak selama masih ada, baik saat layar dibuka maupun saat konfirmasi (draft
  /// bisa dibuat setelah layar dibuka). Draft dihapus lagi di akhir test.
  it('checkout is rejected while the shift still has unpaid drafts', async () => {
    const buatDraft = async () =>
      (
        await request(server())
          .post('/sales/draft')
          .set(staff())
          .send({ idempotencyKey: randomUUID(), shiftSessionId, items: [{ productId, qty: 1 }] })
          .expect(201)
      ).body as { id: string; saleNo: string };
    const hapusDraft = (id: string) => request(server()).delete(`/sales/${id}/draft`).set(staff()).expect(200);

    const dibuat: string[] = [];
    try {
      const draft = await buatDraft();
      dibuat.push(draft.id);
      const ditolak = await request(server()).post(`/shifts/${shiftSessionId}/closing/start`).set(staff()).expect(400);
      expect(ditolak.body.code).toBe('PENDING_DRAFTS_EXIST');
      expect(ditolak.body.details.saleNos).toEqual([draft.saleNo]);
      await hapusDraft(draft.id);
      dibuat.length = 0;

      // Layar dibuka tanpa draft, lalu draft dibuat sebelum konfirmasi.
      const closing = await mulaiClosing();
      const draftTelat = await buatDraft();
      dibuat.push(draftTelat.id);
      const res = await konfirmasi(expectedProduk(closing)).expect(400);
      expect(res.body.code).toBe('PENDING_DRAFTS_EXIST');
      const aktif = await request(server()).get('/shifts/active').set(staff()).expect(200);
      expect(aktif.body.shiftSessionId).toBe(shiftSessionId);
    } finally {
      // Draft yang tertinggal (test gagal di tengah) bikin run berikutnya ikut gagal.
      for (const id of dibuat) await request(server()).delete(`/sales/${id}/draft`).set(staff());
    }
  });

  it('confirming is rejected when stock changed after the screen was opened', async () => {
    const closing = await mulaiClosing();
    const dilihat = expectedProduk(closing);

    await kirimKeBooth(3); // stok berubah selagi layar terbuka

    const res = await konfirmasi(dilihat).expect(400);
    expect(res.body.code).toBe('STOCK_CHANGED_DURING_CLOSING');
    expect(res.body.details.productIds).toContain(productId);

    // Shift tidak tertutup & stok tidak disentuh oleh penolakan.
    const aktif = await request(server()).get('/shifts/active').set(staff()).expect(200);
    expect(aktif.body.shiftSessionId).toBe(shiftSessionId);
    expect(await stokBooth()).toBe(dilihat + 3);

    // Setelah dimuat ulang, snapshot sama dengan stok live lagi.
    expect(expectedProduk(await mulaiClosing())).toBe(dilihat + 3);
  });
});
