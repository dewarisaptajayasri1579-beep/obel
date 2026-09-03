-- CreateEnum
CREATE TYPE "refund_condition" AS ENUM ('REFUND_NO_STOCK_RETURN', 'REFUND_WITH_STOCK_RETURN', 'PARTIAL_REFUND');

-- CreateTable
CREATE TABLE "sale_refunds" (
    "id" TEXT NOT NULL,
    "refund_no" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "condition" "refund_condition" NOT NULL,
    "amount" BIGINT NOT NULL,
    "reason_code" "reason_code" NOT NULL,
    "reason_note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "sale_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_refund_items" (
    "id" TEXT NOT NULL,
    "sale_refund_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "line_total" BIGINT NOT NULL,
    "stock_returned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sale_refund_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sale_refunds_refund_no_key" ON "sale_refunds"("refund_no");

-- CreateIndex
CREATE UNIQUE INDEX "sale_refunds_idempotency_key_key" ON "sale_refunds"("idempotency_key");

-- CreateIndex
CREATE INDEX "sale_refunds_sale_id_idx" ON "sale_refunds"("sale_id");

-- CreateIndex
CREATE INDEX "sale_refund_items_sale_refund_id_idx" ON "sale_refund_items"("sale_refund_id");

-- CreateIndex
CREATE INDEX "sale_refund_items_product_id_idx" ON "sale_refund_items"("product_id");

-- AddForeignKey
ALTER TABLE "sale_refunds" ADD CONSTRAINT "sale_refunds_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_refunds" ADD CONSTRAINT "sale_refunds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_refund_items" ADD CONSTRAINT "sale_refund_items_sale_refund_id_fkey" FOREIGN KEY ("sale_refund_id") REFERENCES "sale_refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_refund_items" ADD CONSTRAINT "sale_refund_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
