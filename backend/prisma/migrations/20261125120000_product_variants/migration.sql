-- Flavour variants (client visit 2026-11-23, item 9): a product such as Kopsu Rasa has flavours
-- the Barista picks at sale time. A variant is only a sale label: price and stock stay on the
-- product. Sale lines keep the variant name as a snapshot, like product_name_snapshot.
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- One name per product, case-insensitive, among variants that are not deleted.
CREATE UNIQUE INDEX "product_variants_product_name_key"
  ON "product_variants" ("product_id", lower("name"))
  WHERE "deleted_at" IS NULL;

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sale_items" ADD COLUMN "variant_id" TEXT,
ADD COLUMN "variant_name_snapshot" TEXT;

ALTER TABLE "sale_refund_items" ADD COLUMN "variant_id" TEXT;

ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "sale_refund_items" ADD CONSTRAINT "sale_refund_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
