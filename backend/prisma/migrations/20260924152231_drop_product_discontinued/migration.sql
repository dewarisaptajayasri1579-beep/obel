-- Mode "Habiskan Stok" dibatalkan (diganti guard: produk hanya bisa
-- dinonaktifkan kalau sudah tidak ada stok/transaksi berjalan).
ALTER TABLE "products" DROP COLUMN "discontinued";
