import { ValidationPipe, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { ReturnStatus, ShiftStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

/// C5 — Rekap Pengembalian Stok: rekap per Booth × Produk, periode = tanggal shift
/// (Return tanpa shift = tanggal diajukan, batas hari Asia/Jakarta), CANCELLED tidak
/// dihitung, Diterima = angka efektif setelah Koreksi Penerimaan, Tindak Lanjut
/// (Rusak/Ganti Rugi/Lainnya) dirinci, Return SUBMITTED hanya di kolom Menunggu.
/// Laporan read-only, jadi fixture Return ditulis langsung ke DB di booth khusus.
describe('Stock return recap report (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let ownerToken: string;
  let staffToken: string;
  let boothId: string;
  let p1: { id: string; name: string };
  let p2: { id: string; name: string };
  const BOOTH_CODE = 'E2E-RTN-RECAP';
  const SEPTEMBER = { dateFrom: '2026-09-01', dateTo: '2026-09-30' };

  const server = () => app.getHttpServer();
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string) =>
    (await request(server()).post('/auth/login').send({ username, password: 'obbel123' }).expect(200)).body.accessToken as string;

  async function bersihkan() {
    const booth = await prisma.booth.findUnique({ where: { code: BOOTH_CODE } });
    if (!booth) return;
    const returns = await prisma.stockReturn.findMany({ where: { boothId: booth.id }, select: { id: true } });
    const ids = returns.map((r) => r.id);
    await prisma.transactionCorrection.deleteMany({ where: { entityType: 'stock_return', entityId: { in: ids } } });
    await prisma.staffLiability.deleteMany({ where: { stockReturnId: { in: ids } } });
    await prisma.stockReturnItem.deleteMany({ where: { stockReturnId: { in: ids } } });
    await prisma.stockReturn.deleteMany({ where: { id: { in: ids } } });
    await prisma.shiftSession.deleteMany({ where: { boothId: booth.id } });
    await prisma.booth.delete({ where: { id: booth.id } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    [adminToken, ownerToken, staffToken] = await Promise.all([login('admin'), login('owner'), login('booth01')]);

    await bersihkan();
    const admin = await prisma.profile.findUniqueOrThrow({ where: { username: 'admin' } });
    const template = await prisma.shiftTemplate.findFirstOrThrow();
    const produk = await prisma.product.findMany({ orderBy: { name: 'asc' }, take: 2 });
    [p1, p2] = produk.map((p) => ({ id: p.id, name: p.name }));
    boothId = (await prisma.booth.create({ data: { code: BOOTH_CODE, name: 'E2E Rekap Pengembalian' } })).id;

    const shift = (businessDate: string) =>
      prisma.shiftSession.create({
        data: {
          businessDate: new Date(`${businessDate}T00:00:00.000Z`),
          boothId,
          shiftTemplateId: template.id,
          staffId: admin.id,
          status: ShiftStatus.CLOSED,
          scheduledStartAt: new Date(`${businessDate}T01:00:00.000Z`),
          scheduledEndAt: new Date(`${businessDate}T10:00:00.000Z`),
          closedAt: new Date(`${businessDate}T10:00:00.000Z`),
          returnedAt: new Date(`${businessDate}T11:00:00.000Z`),
        },
      });
    const shiftSeptember = await shift('2026-09-30');
    const shiftOktober = await shift('2026-10-01');

    let nomor = 0;
    const retur = async (
      status: ReturnStatus,
      submittedAt: string,
      shiftSessionId: string | null,
      items: { productId: string; qtySubmitted: number; qtyReceived?: number; discrepancyReasonCode?: 'RUSAK' | 'LAINNYA' }[],
    ) => {
      nomor += 1;
      return prisma.stockReturn.create({
        data: {
          returnNo: `E2E-RRECAP-${nomor}`,
          boothId,
          status,
          idempotencyKey: randomUUID(),
          submittedById: admin.id,
          submittedAt: new Date(submittedAt),
          receivedAt: status === ReturnStatus.SUBMITTED ? null : new Date(submittedAt),
          shiftSessionId,
          items: { create: items },
        },
      });
    };

    // Shift 30 Sep, diajukan 1 Okt UTC → tetap September (tanggal shift yang dipakai).
    await retur(ReturnStatus.RECEIVED, '2026-10-01T01:00:00.000Z', shiftSeptember.id, [
      { productId: p1.id, qtySubmitted: 10, qtyReceived: 10 },
      { productId: p2.id, qtySubmitted: 8, qtyReceived: 5, discrepancyReasonCode: 'RUSAK' },
    ]);
    // Tanpa shift, 16 Sep 01.00 WIB: kurang 2 dibebankan Barista, lalu Koreksi Penerimaan +1.
    const dikoreksi = await retur(ReturnStatus.DISCREPANCY, '2026-09-15T18:00:00.000Z', null, [
      { productId: p1.id, qtySubmitted: 6, qtyReceived: 4 },
    ]);
    await prisma.staffLiability.create({
      data: {
        stockReturnId: dikoreksi.id,
        productId: p1.id,
        staffId: admin.id,
        qty: 2,
        unitPrice: BigInt(0),
        totalAmount: BigInt(0),
        createdById: admin.id,
      },
    });
    await prisma.transactionCorrection.create({
      data: {
        entityType: 'stock_return',
        entityId: dikoreksi.id,
        transactionGroupId: dikoreksi.transactionGroupId,
        correctionType: 'ADJUSTMENT',
        reasonCode: 'WRONG_PHYSICAL_COUNT',
        impactSnapshot: { deltas: [{ productId: p1.id, delta: 1 }] },
        createdById: admin.id,
        idempotencyKey: randomUUID(),
      },
    });
    // Masih menunggu approve → hanya kolom Menunggu.
    await retur(ReturnStatus.SUBMITTED, '2026-09-30T09:00:00.000Z', shiftSeptember.id, [{ productId: p1.id, qtySubmitted: 3 }]);
    // Dibatalkan → tidak dihitung sama sekali.
    await retur(ReturnStatus.CANCELLED, '2026-09-10T03:00:00.000Z', null, [{ productId: p1.id, qtySubmitted: 100 }]);
    // Tanpa shift, 1 Okt 00.30 WIB (masih 30 Sep UTC) → Oktober.
    await retur(ReturnStatus.RECEIVED, '2026-09-30T17:30:00.000Z', null, [{ productId: p1.id, qtySubmitted: 7, qtyReceived: 7 }]);
    // Shift 1 Okt walau diajukan 20 Sep → Oktober.
    await retur(ReturnStatus.RECEIVED, '2026-09-20T03:00:00.000Z', shiftOktober.id, [
      { productId: p2.id, qtySubmitted: 4, qtyReceived: 3, discrepancyReasonCode: 'LAINNYA' },
    ]);
  });

  afterAll(async () => {
    await bersihkan();
    await app.close();
  });

  const rekap = (token: string, query: Record<string, string>) =>
    request(server()).get('/reports/stock-return-recap').set(bearer(token)).query({ boothId, ...query });

  it('recaps September by shift date with effective received qty, follow-ups and pending kept apart', async () => {
    const res = await rekap(adminToken, SEPTEMBER).expect(200);
    expect(res.body.booths).toHaveLength(1);
    const booth = res.body.booths[0];
    expect(booth.boothName).toBe('E2E Rekap Pengembalian');
    expect(booth.rows).toEqual([
      {
        productId: p1.id,
        productName: p1.name,
        jumlahDokumen: 2,
        qtyDiajukan: 16,
        qtyDiterima: 15,
        selisih: -1,
        rusak: 0,
        gantiRugi: 2,
        lainnya: 0,
        menunggu: 3,
      },
      {
        productId: p2.id,
        productName: p2.name,
        jumlahDokumen: 1,
        qtyDiajukan: 8,
        qtyDiterima: 5,
        selisih: -3,
        rusak: 3,
        gantiRugi: 0,
        lainnya: 0,
        menunggu: 0,
      },
    ]);
    const angka = { jumlahDokumen: 2, qtyDiajukan: 24, qtyDiterima: 20, selisih: -4, rusak: 3, gantiRugi: 2, lainnya: 0, menunggu: 3 };
    expect(booth.subtotal).toEqual(angka);
    expect(res.body.total).toEqual(angka);
  });

  it('puts the late-night return and the 1 Oct shift into October, and counts everything without a period', async () => {
    const oktober = await rekap(adminToken, { dateFrom: '2026-10-01', dateTo: '2026-10-31' }).expect(200);
    expect(oktober.body.total).toEqual({
      jumlahDokumen: 2,
      qtyDiajukan: 11,
      qtyDiterima: 10,
      selisih: -1,
      rusak: 0,
      gantiRugi: 0,
      lainnya: 1,
      menunggu: 0,
    });

    const semua = await rekap(adminToken, {}).expect(200);
    expect(semua.body.total.jumlahDokumen).toBe(4);
    expect(semua.body.total.qtyDiterima).toBe(30);
    expect(semua.body.total.menunggu).toBe(3);
  });

  it('filters by product', async () => {
    const res = await rekap(adminToken, { ...SEPTEMBER, productId: p2.id }).expect(200);
    expect(res.body.booths[0].rows.map((r: { productId: string }) => r.productId)).toEqual([p2.id]);
    expect(res.body.total.qtyDiterima).toBe(5);
  });

  it('is readable by Owner but not by booth staff', async () => {
    const owner = await rekap(ownerToken, SEPTEMBER).expect(200);
    expect(owner.body.total.qtyDiterima).toBe(20);
    await rekap(staffToken, SEPTEMBER).expect(403);
  });

  it('exports Excel with the same grand total and a PDF document', async () => {
    const excel = await request(server())
      .get('/reports/stock-return-recap/excel')
      .set(bearer(adminToken))
      .query({ boothId, ...SEPTEMBER })
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(excel.headers['content-disposition']).toContain('rekap-pengembalian-stok-');
    const buku = new ExcelJS.Workbook();
    const isi = excel.body as Buffer;
    await buku.xlsx.load(isi.buffer.slice(isi.byteOffset, isi.byteOffset + isi.byteLength) as ArrayBuffer);
    const lembar = buku.getWorksheet('Rekap Pengembalian')!;
    const baris: (string | number)[][] = [];
    lembar.eachRow((row) => baris.push((row.values as (string | number)[]).slice(1)));
    expect(baris).toContainEqual([1, 'E2E Rekap Pengembalian', p1.name, 2, 16, 15, -1, 0, 2, 0, 3]);
    expect(baris).toContainEqual(['', 'GRAND TOTAL', '', 2, 24, 20, -4, 3, 2, 0, 3]);

    const pdf = await request(server())
      .get('/reports/stock-return-recap/pdf')
      .set(bearer(adminToken))
      .query({ boothId, ...SEPTEMBER })
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(Buffer.from(pdf.body).subarray(0, 4).toString()).toBe('%PDF');
  });
});
