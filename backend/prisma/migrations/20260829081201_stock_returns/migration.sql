-- CreateEnum
CREATE TYPE "return_status" AS ENUM ('SUBMITTED', 'RECEIVED', 'DISCREPANCY', 'CANCELLED');

-- CreateTable
CREATE TABLE "stock_returns" (
    "id" TEXT NOT NULL,
    "return_no" TEXT NOT NULL,
    "booth_id" TEXT NOT NULL,
    "status" "return_status" NOT NULL DEFAULT 'SUBMITTED',
    "idempotency_key" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" TEXT,
    "received_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_return_items" (
    "id" TEXT NOT NULL,
    "stock_return_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_submitted" INTEGER NOT NULL,
    "qty_received" INTEGER,

    CONSTRAINT "stock_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_returns_return_no_key" ON "stock_returns"("return_no");

-- CreateIndex
CREATE UNIQUE INDEX "stock_returns_idempotency_key_key" ON "stock_returns"("idempotency_key");

-- CreateIndex
CREATE INDEX "stock_returns_booth_id_status_idx" ON "stock_returns"("booth_id", "status");

-- CreateIndex
CREATE INDEX "stock_returns_status_idx" ON "stock_returns"("status");

-- CreateIndex
CREATE INDEX "stock_return_items_product_id_idx" ON "stock_return_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_return_items_stock_return_id_product_id_key" ON "stock_return_items"("stock_return_id", "product_id");

-- AddForeignKey
ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_returns" ADD CONSTRAINT "stock_returns_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_return_items" ADD CONSTRAINT "stock_return_items_stock_return_id_fkey" FOREIGN KEY ("stock_return_id") REFERENCES "stock_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_return_items" ADD CONSTRAINT "stock_return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
