-- CreateEnum
CREATE TYPE "distribution_status" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'DISCREPANCY', 'CANCELLED');

-- CreateTable
CREATE TABLE "warehouse_stocks" (
    "product_id" TEXT NOT NULL,
    "qty_on_hand" INTEGER NOT NULL DEFAULT 0,
    "version" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_stocks_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "stock_distributions" (
    "id" TEXT NOT NULL,
    "distribution_no" TEXT NOT NULL,
    "booth_id" TEXT NOT NULL,
    "status" "distribution_status" NOT NULL DEFAULT 'SENT',
    "idempotency_key" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "received_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_distribution_items" (
    "id" TEXT NOT NULL,
    "distribution_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_sent" INTEGER NOT NULL,
    "qty_received" INTEGER,

    CONSTRAINT "stock_distribution_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_distributions_distribution_no_key" ON "stock_distributions"("distribution_no");

-- CreateIndex
CREATE UNIQUE INDEX "stock_distributions_idempotency_key_key" ON "stock_distributions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "stock_distribution_items_distribution_id_product_id_key" ON "stock_distribution_items"("distribution_id", "product_id");

-- AddForeignKey
ALTER TABLE "warehouse_stocks" ADD CONSTRAINT "warehouse_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_distributions" ADD CONSTRAINT "stock_distributions_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_distributions" ADD CONSTRAINT "stock_distributions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_distributions" ADD CONSTRAINT "stock_distributions_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_distribution_items" ADD CONSTRAINT "stock_distribution_items_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "stock_distributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_distribution_items" ADD CONSTRAINT "stock_distribution_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
