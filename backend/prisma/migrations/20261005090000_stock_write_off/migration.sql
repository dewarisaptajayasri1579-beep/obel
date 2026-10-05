-- Pemusnahan Stok Gudang (BR-041): alasan Expired + foto bukti di dokumen koreksi.
ALTER TYPE "reason_code" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "transaction_corrections" ADD COLUMN "evidence_photo_url" TEXT;
