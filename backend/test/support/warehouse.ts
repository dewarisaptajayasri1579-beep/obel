import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';

/// Spec e2e berbagi satu DB dan satu Gudang, dan tiap run menguras Gudang
/// (distribusi, restock, kiriman yang tidak diterima) tanpa mengisinya lagi —
/// lama-lama test gagal INSUFFICIENT_STOCK padahal kodenya benar. Isi ulang lewat
/// Tambah Stok Gudang (tercatat di ledger) sampai tiap produk minimal `minimum`.
export async function isiUlangGudang(app: INestApplication, adminToken: string, productIds: string[], minimum = 100) {
  const server = app.getHttpServer();
  const auth = { Authorization: `Bearer ${adminToken}` };
  const gudang = (await request(server).get('/warehouse-stock').set(auth).expect(200)).body as { productId: string; qtyOnHand: number }[];
  for (const productId of productIds) {
    const kurang = minimum - (gudang.find((g) => g.productId === productId)?.qtyOnHand ?? 0);
    if (kurang <= 0) continue;
    await request(server)
      .post('/stock-receipts')
      .set(auth)
      .send({ idempotencyKey: randomUUID(), receiptDate: new Date().toISOString(), status: 'POSTED', items: [{ productId, qtyReceived: kurang }] })
      .expect(201);
  }
}

/// Spec yang berjualan sebagai booth01 dulu mengandalkan stok booth yang kebetulan diisi spec lain:
/// di DB yang baru dibangun stok booth 0, jadi semua penjualannya ditolak dan spec itu gagal hanya pada
/// run pertama. Isi stok booth Barista lewat jalur resmi (Gudang → kiriman → diterima Barista) sampai
/// tiap produk minimal `minimum`.
export async function ensureBoothStock(app: INestApplication, adminToken: string, staffToken: string, productIds: string[], minimum = 30) {
  const server = app.getHttpServer();
  const staff = { Authorization: `Bearer ${staffToken}` };
  const boothId = (await request(server).get('/shifts/active').set(staff).expect(200)).body.booth.id as string;
  const catalog = (await request(server).get('/catalog').set(staff).expect(200)).body as { id: string; qtyOnHand: number }[];
  const items = productIds
    .map((productId) => ({ productId, qty: minimum - (catalog.find((p) => p.id === productId)?.qtyOnHand ?? 0) }))
    .filter((i) => i.qty > 0);
  if (items.length === 0) return;
  await isiUlangGudang(app, adminToken, items.map((i) => i.productId), Math.max(100, ...items.map((i) => i.qty)));
  const dist = await request(server)
    .post('/distributions')
    .set({ Authorization: `Bearer ${adminToken}` })
    .send({ idempotencyKey: randomUUID(), boothId, items })
    .expect(201);
  await request(server)
    .post(`/distributions/${dist.body.id}/receive`)
    .set(staff)
    .send({ items: items.map((i) => ({ productId: i.productId, actualQty: i.qty })) })
    .expect(201);
}
