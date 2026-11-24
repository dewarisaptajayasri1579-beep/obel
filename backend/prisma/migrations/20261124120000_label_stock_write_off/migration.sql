-- Pemusnahan Stok (writeOff) now writes reference_type 'stock_write_off_out' so Mutasi Stok
-- labels it "Pemusnahan reject". Relabel the write-offs posted before that change.
-- A write-off is the only stock adjustment whose correction document carries an evidence
-- photo (the general adjustment DTO has no photo field), with reason EXPIRED. Only the label
-- changes: the `_out` suffix keeps the Gudang stock direction, quantities are untouched.
UPDATE "stock_movements" AS m
SET "reference_type" = 'stock_write_off_out'
FROM "transaction_corrections" AS c
WHERE m."movement_type" = 'ADJUSTMENT'
  AND m."reference_type" = 'stock_adjustment_out'
  AND c."entity_type" = 'stock_adjustment'
  AND c."correction_type" = 'ADJUSTMENT'
  AND c."entity_id" = m."reference_id"
  AND c."reason_code" = 'EXPIRED'
  AND c."evidence_photo_url" IS NOT NULL;
