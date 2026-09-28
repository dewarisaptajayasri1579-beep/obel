-- Foto bukti bayar QRIS yang diambil petugas booth di Kasir. Diisi hanya di
-- baris Payment ber-metode QRIS; NULL untuk Tunai dan data lama.
ALTER TABLE "payments" ADD COLUMN "proof_photo_url" TEXT;
