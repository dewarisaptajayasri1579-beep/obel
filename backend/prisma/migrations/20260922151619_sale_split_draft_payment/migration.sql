-- Split payment (satu Sale dibayar >1 metode sekaligus, breakdown asli di
-- tabel payments) + Simpan Draft (Sale PENDING belum punya metode bayar).
ALTER TYPE "payment_method" ADD VALUE 'SPLIT';

ALTER TABLE "sales" ALTER COLUMN "payment_method" DROP NOT NULL;
