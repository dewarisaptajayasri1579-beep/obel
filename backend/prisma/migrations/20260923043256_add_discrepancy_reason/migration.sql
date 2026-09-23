-- CreateEnum
CREATE TYPE "discrepancy_reason_code" AS ENUM ('LEBIH', 'KURANG', 'RUSAK', 'LAINNYA');

-- AlterTable
ALTER TABLE "stock_distribution_items" ADD COLUMN     "discrepancy_note" TEXT,
ADD COLUMN     "discrepancy_reason_code" "discrepancy_reason_code";

-- CreateIndex
CREATE INDEX "stock_distribution_items_discrepancy_reason_code_idx" ON "stock_distribution_items"("discrepancy_reason_code");

