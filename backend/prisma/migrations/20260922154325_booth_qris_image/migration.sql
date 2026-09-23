-- Kode QRIS statis milik Booth, ditampilkan di layar Kasir Petugas saat
-- metode QRIS/Split dipilih.
ALTER TABLE "booths" ADD COLUMN "qris_image_url" TEXT;
