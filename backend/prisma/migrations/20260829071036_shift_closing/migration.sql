-- CreateEnum
CREATE TYPE "stock_count_status" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateTable
CREATE TABLE "shift_stock_counts" (
    "id" TEXT NOT NULL,
    "shift_session_id" TEXT NOT NULL,
    "status" "stock_count_status" NOT NULL DEFAULT 'DRAFT',
    "counted_by" TEXT NOT NULL,
    "counted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "shift_stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_stock_count_items" (
    "id" TEXT NOT NULL,
    "stock_count_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "actual_qty" INTEGER NOT NULL,
    "discrepancy_qty" INTEGER NOT NULL DEFAULT 0,
    "reason_code" TEXT,
    "reason_note" TEXT,

    CONSTRAINT "shift_stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_stock_counts_shift_session_id_key" ON "shift_stock_counts"("shift_session_id");

-- CreateIndex
CREATE INDEX "shift_stock_count_items_product_id_idx" ON "shift_stock_count_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_stock_count_items_stock_count_id_product_id_key" ON "shift_stock_count_items"("stock_count_id", "product_id");

-- AddForeignKey
ALTER TABLE "shift_stock_counts" ADD CONSTRAINT "shift_stock_counts_shift_session_id_fkey" FOREIGN KEY ("shift_session_id") REFERENCES "shift_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_stock_counts" ADD CONSTRAINT "shift_stock_counts_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_stock_count_items" ADD CONSTRAINT "shift_stock_count_items_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "shift_stock_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_stock_count_items" ADD CONSTRAINT "shift_stock_count_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
