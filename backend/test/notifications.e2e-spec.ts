import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { isiUlangGudang } from './support/warehouse';
import { bereskanShiftLama, tutupShiftLengkap } from './support/shift';

(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

/// Notifikasi diturunkan dari kondisi saat ini, tapi waktunya harus waktu kejadian aslinya (stok
/// berubah, kiriman dikirim, restock ditolak, Barista Kembali) dan daftarnya terbaru di atas. Bel Admin
/// hanya berisi yang masih perlu ditindak: stok per Booth yang sedang buka shift, dan shift yang
/// menunggu Approve Stok Kembali & Setor Uang.
describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let staffToken: string;
  let staffLoginToken: string;
  let boothId: string;
  let produkA: string;
  let produkB: string;
  const kirimanTerbuka: string[] = [];

  const server = () => app.getHttpServer();
  const admin = () => ({ Authorization: `Bearer ${adminToken}` });
  const staff = () => ({ Authorization: `Bearer ${staffToken}` });
  const KODE_BOOTH = 'E2E-NOTIF';
  const USERNAME = 'e2e_notif_staff';
  const CHECKIN = { latitude: -6.2088, longitude: 106.8456, photoUrl: 'https://example.com/selfie.jpg' };
  // Jeda antar kejadian supaya waktunya pasti berbeda (presisi timestamp milidetik).
  const jeda = () => new Promise((r) => setTimeout(r, 30));

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
    if (!booth) booth = (await request(server()).post('/booths').set(admin()).send({ code: KODE_BOOTH, name: 'E2E Notif Booth' }).expect(201)).body;
    boothId = booth.id;

    const gudang = (await request(server()).get('/warehouse-stock').set(admin()).expect(200)).body as { productId: string; qtyOnHand: number }[];
    [produkA, produkB] = [...gudang].sort((a, b) => b.qtyOnHand - a.qtyOnHand).slice(0, 2).map((g) => g.productId);
    await isiUlangGudang(app, adminToken, [produkA, produkB]);

    const buat = await request(server())
      .post('/users')
      .set(admin())
      .send({ username: USERNAME, password: 'obbel123', fullName: 'E2E Notif Staff', role: 'BOOTH_STAFF' });
    if (![201, 400, 409].includes(buat.status)) throw new Error(`create user: ${buat.status} ${JSON.stringify(buat.body)}`);
    staffLoginToken = (await request(server()).post('/auth/login').send({ username: USERNAME, password: 'obbel123' }).expect(200)).body.accessToken;
    const staffId = JSON.parse(Buffer.from(staffLoginToken.split('.')[1], 'base64url').toString('utf8')).sub as string;
    const templates = await request(server()).get('/shift-templates').set(admin()).expect(200);
    await request(server())
      .put('/booth-shift-assignments')
      .set(admin())
      .send({ boothId, shiftTemplateId: templates.body[0].id, staffId, force: true })
      .expect(200);
  });

  afterAll(async () => {
    // Kiriman yang sengaja tidak diterima dibatalkan supaya stok Gudang kembali.
    for (const id of kirimanTerbuka) {
      await request(server())
        .post(`/distributions/${id}/cancel`)
        .set(admin())
        .send({ idempotencyKey: randomUUID(), reasonCode: 'TRANSACTION_NEVER_HAPPENED' });
    }
    await app.close();
  });

  const kirim = async (productId: string, qty: number) => {
    const d = (await request(server()).post('/distributions').set(admin()).send({ idempotencyKey: randomUUID(), boothId, items: [{ productId, qty }] }).expect(201)).body as { id: string };
    return d.id;
  };

  it('dates each notification by when it happened and lists the newest first', async () => {
    staffToken = await bereskanShiftLama(app, adminToken, staffLoginToken);
    const checkIn = await request(server()).post('/shifts/check-in').set({ Authorization: `Bearer ${staffLoginToken}` }).send(CHECKIN).expect(201);
    staffToken = checkIn.body.accessToken ?? staffLoginToken;

    // Stok produk A di Booth dibuat Kritis lewat batas khusus Booth ini.
    await request(server())
      .post('/booth-stock-thresholds/bulk')
      .set(admin())
      .send({ boothId, items: [{ productId: produkA, minimumQty: 100000, criticalQty: 50000 }] })
      .expect(201);
    const awal = await kirim(produkA, 2);
    await request(server()).post(`/distributions/${awal}/receive`).set(staff()).send({ items: [{ productId: produkA, actualQty: 2 }] }).expect(201);
    await jeda();

    // Dua kiriman belum diterima, lalu satu restock yang ditolak.
    const kiriman1 = await kirim(produkB, 1);
    kirimanTerbuka.push(kiriman1);
    await jeda();
    const kiriman2 = await kirim(produkB, 1);
    kirimanTerbuka.push(kiriman2);
    await jeda();
    const restock = (await request(server()).post('/restock-requests').set(staff()).send({ items: [{ productId: produkB, qty: 3 }] }).expect(201)).body as { id: string };
    await request(server()).post(`/restock-requests/${restock.id}/reject`).set(admin()).send({ reason: 'Stok gudang dipakai event' }).expect(201);

    const notif = (await request(server()).get('/notifications').set(staff()).expect(200)).body as { id: string; createdAt: string }[];
    const posisi = (id: string) => {
      const i = notif.findIndex((n) => n.id === id);
      expect(i).toBeGreaterThanOrEqual(0); // gagal keras kalau notifikasinya tidak muncul
      return i;
    };
    const iDitolak = posisi(`restock-rejected:${restock.id}`);
    const iKiriman2 = posisi(`distribution:${kiriman2}`);
    const iKiriman1 = posisi(`distribution:${kiriman1}`);
    const iStok = posisi(`lowstock:Kritis:${boothId}:${produkA}`);
    expect([iDitolak, iKiriman2, iKiriman1, iStok]).toEqual([...[iDitolak, iKiriman2, iKiriman1, iStok]].sort((a, b) => a - b));

    // Waktunya waktu kejadian di database, bukan waktu notifikasi dibaca.
    const waktu = (i: number) => notif[i].createdAt;
    const [d1, d2, rr, bs] = await Promise.all([
      prisma.stockDistribution.findUniqueOrThrow({ where: { id: kiriman1 } }),
      prisma.stockDistribution.findUniqueOrThrow({ where: { id: kiriman2 } }),
      prisma.restockRequest.findUniqueOrThrow({ where: { id: restock.id } }),
      prisma.boothStock.findUniqueOrThrow({ where: { boothId_productId: { boothId, productId: produkA } } }),
    ]);
    expect(waktu(iKiriman1)).toBe((d1.sentAt ?? d1.createdAt).toISOString());
    expect(waktu(iKiriman2)).toBe((d2.sentAt ?? d2.createdAt).toISOString());
    expect(waktu(iDitolak)).toBe(rr.updatedAt.toISOString());
    expect(waktu(iStok)).toBe(bs.updatedAt.toISOString());

    // Seluruh daftar terurut terbaru di atas.
    const urutan = notif.map((n) => n.createdAt);
    expect(urutan).toEqual([...urutan].sort().reverse());
  });

  it('gives Admin one stock alert per open booth and one approval item that clears once approved', async () => {
    type Notif = { id: string; title: string; message: string; createdAt: string };
    const bacaAdmin = async () => (await request(server()).get('/notifications').set(admin()).expect(200)).body as Notif[];
    /// Jumlah shift di item Menunggu Approve (0 kalau itemnya tidak ada).
    const jumlahApprove = (notif: Notif[]) => {
      const n = notif.find((x) => x.id === 'pending:approve');
      if (!n) return 0;
      const angka = /^(\d+) shift/.exec(n.message);
      return angka ? Number(angka[1]) : 1;
    };

    staffToken = await bereskanShiftLama(app, adminToken, staffLoginToken);
    const checkIn = await request(server()).post('/shifts/check-in').set({ Authorization: `Bearer ${staffLoginToken}` }).send(CHECKIN).expect(201);
    staffToken = checkIn.body.accessToken ?? staffLoginToken;
    const sid = checkIn.body.shiftSessionId as string;
    await request(server())
      .post('/booth-stock-thresholds/bulk')
      .set(admin())
      .send({ boothId, items: [{ productId: produkA, minimumQty: 100000, criticalQty: 50000 }] })
      .expect(201);
    const kiriman = await kirim(produkA, 2);
    await request(server()).post(`/distributions/${kiriman}/receive`).set(staff()).send({ items: [{ productId: produkA, actualQty: 2 }] }).expect(201);
    const namaA = (await prisma.product.findUniqueOrThrow({ where: { id: produkA } })).name;

    // Shift OPEN: satu item stok untuk Booth ini, berisi nama Booth dan produknya.
    const buka = await bacaAdmin();
    const stokBooth = buka.filter((n) => n.id === `lowstock:${boothId}`);
    expect(stokBooth).toHaveLength(1);
    expect(stokBooth[0].message.startsWith('E2E Notif Booth: ')).toBe(true);
    expect(stokBooth[0].message).toContain(namaA);
    expect(buka.some((n) => n.id.startsWith(`lowstock:${boothId}:`))).toBe(false);

    // Check-Out + Kembali: stok Booth jadi 0 tapi tidak ada peringatan stok (shift tidak OPEN);
    // shift ini kini menunggu approve dan jadi yang terbaru.
    await tutupShiftLengkap(app, adminToken, staffToken, sid);
    const kembali = await bacaAdmin();
    expect(kembali.some((n) => n.id === `lowstock:${boothId}`)).toBe(false);
    const approve = kembali.find((n) => n.id === 'pending:approve');
    expect(approve).toBeDefined(); // gagal keras kalau itemnya tidak muncul
    const shift = await prisma.shiftSession.findUniqueOrThrow({ where: { id: sid }, include: { cashDeposit: true } });
    expect(approve!.createdAt).toBe(shift.returnedAt!.toISOString());
    expect(approve!.message).toContain('E2E Notif Staff');
    const sebelum = jumlahApprove(kembali);

    // Approve Stok Kembali & Setor Uang: shift ini keluar dari hitungan.
    const retur = await prisma.stockReturn.findFirstOrThrow({ where: { shiftSessionId: sid, status: 'SUBMITTED' }, include: { items: true } });
    await request(server())
      .post(`/returns/${retur.id}/receive`)
      .set(admin())
      .send({ items: retur.items.map((i) => ({ productId: i.productId, qtyReceived: i.qtySubmitted })) })
      .expect(201);
    await request(server())
      .post(`/shifts/${sid}/cash-deposit/confirm`)
      .set(admin())
      .send({ depositedAmount: Number(shift.cashDeposit!.expectedAmount) })
      .expect(201);
    const sesudah = await bacaAdmin();
    expect(jumlahApprove(sesudah)).toBe(sebelum - 1);

    const urutan = sesudah.map((n) => n.createdAt);
    expect(urutan).toEqual([...urutan].sort().reverse());
  });
});
