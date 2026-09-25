-- Mode "Habiskan Stok": produk masih dijual & didistribusikan sampai stok habis,
-- tapi tidak menerima pasokan baru. Additive, default false.
ALTER TABLE "products" ADD COLUMN "discontinued" BOOLEAN NOT NULL DEFAULT false;
