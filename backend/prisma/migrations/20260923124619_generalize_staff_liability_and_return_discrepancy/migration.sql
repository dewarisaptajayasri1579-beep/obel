-- DropForeignKey
ALTER TABLE "staff_liabilities" DROP CONSTRAINT "staff_liabilities_distribution_id_fkey";

-- AlterTable
ALTER TABLE "staff_liabilities" ADD COLUMN     "stock_return_id" TEXT,
ALTER COLUMN "distribution_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "stock_return_items" ADD COLUMN     "discrepancy_note" TEXT,
ADD COLUMN     "discrepancy_reason_code" "discrepancy_reason_code";

-- CreateIndex
CREATE INDEX "staff_liabilities_stock_return_id_idx" ON "staff_liabilities"("stock_return_id");

-- AddForeignKey
ALTER TABLE "staff_liabilities" ADD CONSTRAINT "staff_liabilities_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "stock_distributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_liabilities" ADD CONSTRAINT "staff_liabilities_stock_return_id_fkey" FOREIGN KEY ("stock_return_id") REFERENCES "stock_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

