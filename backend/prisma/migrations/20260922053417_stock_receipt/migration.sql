-- CreateEnum
CREATE TYPE "stock_receipt_status" AS ENUM ('DRAFT', 'POSTED', 'REVISED');

-- CreateTable
CREATE TABLE "stock_receipts" (
    "id" TEXT NOT NULL,
    "receipt_no" TEXT NOT NULL,
    "status" "stock_receipt_status" NOT NULL DEFAULT 'DRAFT',
    "receipt_date" DATE NOT NULL,
    "note" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3),
    "posted_by" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "transaction_group_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "revision_of_id" TEXT,

    CONSTRAINT "stock_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_receipt_items" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_received" INTEGER NOT NULL,

    CONSTRAINT "stock_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_receipts_receipt_no_key" ON "stock_receipts"("receipt_no");

-- CreateIndex
CREATE UNIQUE INDEX "stock_receipts_idempotency_key_key" ON "stock_receipts"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "stock_receipts_revision_of_id_key" ON "stock_receipts"("revision_of_id");

-- CreateIndex
CREATE INDEX "stock_receipts_status_idx" ON "stock_receipts"("status");

-- CreateIndex
CREATE INDEX "stock_receipts_receipt_date_idx" ON "stock_receipts"("receipt_date");

-- CreateIndex
CREATE INDEX "stock_receipts_transaction_group_id_idx" ON "stock_receipts"("transaction_group_id");

-- CreateIndex
CREATE INDEX "stock_receipt_items_product_id_idx" ON "stock_receipt_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_receipt_items_receipt_id_product_id_key" ON "stock_receipt_items"("receipt_id", "product_id");

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_revision_of_id_fkey" FOREIGN KEY ("revision_of_id") REFERENCES "stock_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "stock_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
