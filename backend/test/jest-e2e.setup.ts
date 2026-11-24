import { config } from 'dotenv';
import { resolve } from 'path';

/// Semua e2e test harus jalan melawan database terisolasi (obbel_test),
/// bukan database dev/shared yang dipakai manual testing sehari-hari —
/// supaya state yang berubah karena manual testing (mis. shift jadi CLOSING)
/// tidak bikin e2e gagal secara acak. Dipanggil via jest-e2e.json
/// `setupFiles`, dijalankan sebelum tiap file test di-require, sehingga
/// DATABASE_URL sudah ke-set sebelum PrismaService dibuat di beforeAll().
// Fail loudly: without .env.test the app would fall back to .env and run the e2e
// suite against the dev database.
const { error } = config({ path: resolve(__dirname, '../.env.test'), override: true });
if (error) {
  throw new Error('backend/.env.test is missing: copy .env.test.example and point it at a local obbel_test database.');
}
