-- AlterTable
ALTER TABLE "products" ADD COLUMN     "critical_qty" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "minimum_qty" INTEGER NOT NULL DEFAULT 25;
