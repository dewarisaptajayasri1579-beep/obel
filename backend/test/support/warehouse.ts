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
