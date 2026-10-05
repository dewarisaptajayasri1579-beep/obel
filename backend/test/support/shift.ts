import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/// Koordinat absen yang dipakai spec e2e. Booth E2E khusus & Gudang di obbel_test
/// tidak punya koordinat acuan, jadi validasi radius (BR-042) tidak menolak titik ini.
export const LOKASI_TEST = { latitude: -6.2088, longitude: 106.8456 };
const FOTO_TEST = 'https://example.com/absen.jpg';

const staffIdDari = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub as string;

/// Absen Tiba di Booth (wajib sebelum Check-Out, BR-042). Idempotent.
export async function absenTiba(app: INestApplication, staffToken: string, shiftSessionId: string) {
  await request(app.getHttpServer())
    .post(`/shifts/${shiftSessionId}/arrive`)
    .set({ Authorization: `Bearer ${staffToken}` })
    .send({ ...LOKASI_TEST, photoUrl: FOTO_TEST })
    .expect(201);
}

/// Spec berjalan di jam berapa pun, sedangkan Check-Out ditolak sebelum jam selesai
/// shift — Admin memberi izin pulang awal (dipakai sekali saat konfirmasi).
export async function izinPulangAwal(app: INestApplication, adminToken: string, staffToken: string) {
  await request(app.getHttpServer())
    .post('/attendance-permits')
    .set({ Authorization: `Bearer ${adminToken}` })
    .send({ staffId: staffIdDari(staffToken), type: 'EARLY_CHECKOUT', reason: 'e2e' })
    .expect(201);
}

/// Absen Kembali di Gudang — sesudahnya Stok Kembali & Setor Uang boleh di-approve.
export async function absenKembali(app: INestApplication, staffToken: string, shiftSessionId: string) {
  await request(app.getHttpServer())
    .post(`/shifts/${shiftSessionId}/return`)
    .set({ Authorization: `Bearer ${staffToken}` })
    .send({ ...LOKASI_TEST, photoUrl: FOTO_TEST })
    .expect(201);
}

/// Bereskan sisa run sebelumnya supaya Barista bisa Berangkat lagi: shift yang
/// masih aktif ditutup lengkap, shift yang menunggu Kembali di-absen-kan Kembali.
/// Mengembalikan token terbaru (Check-In me-reissue token ber-boothId).
export async function bereskanShiftLama(app: INestApplication, adminToken: string, loginToken: string): Promise<string> {
  const server = app.getHttpServer();
  let token = loginToken;
  const aktif = await request(server).get('/shifts/active').set({ Authorization: `Bearer ${loginToken}` });
  if (aktif.status === 200) {
    token = aktif.body.accessToken ?? loginToken;
    await tutupShiftLengkap(app, adminToken, token, aktif.body.shiftSessionId);
  }
  const menunggu = await request(server).get('/shifts/pending-return').set({ Authorization: `Bearer ${token}` }).expect(200);
  if (menunggu.body?.shiftSessionId) await absenKembali(app, token, menunggu.body.shiftSessionId);
  return token;
}

/// Alur penutupan shift lengkap: Tiba → izin pulang awal → Check-Out (stok fisik =
/// stok sistem) → Kembali. Return otomatis TIDAK diterima di sini (spec memutuskan sendiri).
export async function tutupShiftLengkap(app: INestApplication, adminToken: string, staffToken: string, shiftSessionId: string) {
  const server = app.getHttpServer();
  const staff = { Authorization: `Bearer ${staffToken}` };
  await absenTiba(app, staffToken, shiftSessionId);
  await izinPulangAwal(app, adminToken, staffToken);
  const closing = (await request(server).post(`/shifts/${shiftSessionId}/closing/start`).set(staff).expect(201)).body;
  await request(server)
    .post(`/shifts/${shiftSessionId}/closing/confirm`)
    .set(staff)
    .send({
      items: closing.items.map((i: { productId: string; expectedQty: number }) => ({ productId: i.productId, actualQty: i.expectedQty })),
      checkOutLatitude: LOKASI_TEST.latitude,
      checkOutLongitude: LOKASI_TEST.longitude,
      checkOutPhotoUrl: FOTO_TEST,
    })
    .expect(201);
  await absenKembali(app, staffToken, shiftSessionId);
}
