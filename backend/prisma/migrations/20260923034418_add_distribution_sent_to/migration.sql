-- AlterTable
ALTER TABLE "stock_distributions" ADD COLUMN     "sent_to" TEXT;

-- AddForeignKey
ALTER TABLE "stock_distributions" ADD CONSTRAINT "stock_distributions_sent_to_fkey" FOREIGN KEY ("sent_to") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

