import { config } from 'dotenv';
import { resolve } from 'path';

/// Semua e2e test harus jalan melawan database terisolasi (obbel_test),
/// bukan database dev/shared yang dipakai manual testing sehari-hari —
/// supaya state yang berubah karena manual testing (mis. shift jadi CLOSING)
/// tidak bikin e2e gagal secara acak. Dipanggil via jest-e2e.json
/// `setupFiles`, dijalankan sebelum tiap file test di-require, sehingga
/// DATABASE_URL sudah ke-set sebelum PrismaService dibuat di beforeAll().
config({ path: resolve(__dirname, '../.env.test') });
