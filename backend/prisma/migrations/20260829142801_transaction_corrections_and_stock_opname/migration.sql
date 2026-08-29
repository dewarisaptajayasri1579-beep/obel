/*
  Warnings:

  - The required column `transaction_group_id` was added to the `payments` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `transaction_group_id` was added to the `stock_distributions` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `transaction_group_id` was added to the `stock_returns` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "reason_code" AS ENUM ('WRONG_PRODUCT', 'WRONG_QTY', 'WRONG_BOOTH', 'WRONG_SHIFT', 'WRONG_PAYMENT_METHOD', 'DUPLICATE_TRANSACTION', 'TRANSACTION_NEVER_HAPPENED', 'WRONG_PHYSICAL_COUNT', 'DAMAGED', 'SPILLED', 'LOST', 'FOUND', 'DATA_ENTRY_ERROR', 'SYSTEM_ERROR', 'OTHER');

-- CreateEnum
CREATE TYPE "correction_type" AS ENUM ('VOID', 'REVISION', 'RECOUNT', 'ADJUSTMENT', 'PAYMENT_CORRECTION');

-- CreateEnum
CREATE TYPE "correction_status" AS ENUM ('PENDING', 'POSTED', 'FAILED');

-- CreateEnum
CREATE TYPE "reconciliation_status" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "reconciliation_severity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "opname_location_type" AS ENUM ('WAREHOUSE', 'BOOTH');

-- CreateEnum
CREATE TYPE "opname_status" AS ENUM ('DRAFT', 'CONFIRMED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "reversal_of_id" TEXT,
ADD COLUMN     "revision_of_id" TEXT,
ADD COLUMN     "status" "correction_status" NOT NULL DEFAULT 'POSTED',
ADD COLUMN     "transaction_group_id" TEXT,
ADD COLUMN     "version_no" INTEGER NOT NULL DEFAULT 1;
UPDATE "payments" SET "transaction_group_id" = gen_random_uuid()::text WHERE "transaction_group_id" IS NULL;
ALTER TABLE "payments" ALTER COLUMN "transaction_group_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "reversal_of_id" TEXT,
ADD COLUMN     "revision_of_id" TEXT;

-- AlterTable
ALTER TABLE "stock_distributions" ADD COLUMN     "reversal_of_id" TEXT,
ADD COLUMN     "revision_of_id" TEXT,
ADD COLUMN     "transaction_group_id" TEXT,
ADD COLUMN     "version_no" INTEGER NOT NULL DEFAULT 1;
UPDATE "stock_distributions" SET "transaction_group_id" = gen_random_uuid()::text WHERE "transaction_group_id" IS NULL;
ALTER TABLE "stock_distributions" ALTER COLUMN "transaction_group_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "stock_returns" ADD COLUMN     "reversal_of_id" TEXT,
ADD COLUMN     "revision_of_id" TEXT,
ADD COLUMN     "transaction_group_id" TEXT,
ADD COLUMN     "version_no" INTEGER NOT NULL DEFAULT 1;
UPDATE "stock_returns" SET "transaction_group_id" = gen_random_uuid()::text WHERE "transaction_group_id" IS NULL;
ALTER TABLE "stock_returns" ALTER COLUMN "transaction_group_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "transaction_corrections" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "transaction_group_id" TEXT NOT NULL,
    "correction_type" "correction_type" NOT NULL,
    "original_version_id" TEXT,
    "replacement_version_id" TEXT,
    "reason_code" "reason_code" NOT NULL,
    "reason_note" TEXT,
    "impact_snapshot" JSONB NOT NULL,
    "status" "correction_status" NOT NULL DEFAULT 'POSTED',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,

    CONSTRAINT "transaction_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_cases" (
    "id" TEXT NOT NULL,
    "case_no" TEXT NOT NULL,
    "source_entity_type" TEXT NOT NULL,
    "source_entity_id" TEXT NOT NULL,
    "status" "reconciliation_status" NOT NULL DEFAULT 'OPEN',
    "severity" "reconciliation_severity" NOT NULL DEFAULT 'WARNING',
    "reason_code" "reason_code" NOT NULL,
    "details" JSONB NOT NULL,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opnames" (
    "id" TEXT NOT NULL,
    "opname_no" TEXT NOT NULL,
    "location_type" "opname_location_type" NOT NULL,
    "booth_id" TEXT,
    "business_date" DATE NOT NULL,
    "status" "opname_status" NOT NULL DEFAULT 'DRAFT',
    "transaction_group_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL DEFAULT 1,
    "revision_of_id" TEXT,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "counted_by" TEXT NOT NULL,
    "correction_reason_code" "reason_code",
    "note" TEXT,

    CONSTRAINT "stock_opnames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_opname_items" (
    "id" TEXT NOT NULL,
    "stock_opname_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "expected_qty" INTEGER NOT NULL,
    "actual_qty" INTEGER NOT NULL,
    "discrepancy_qty" INTEGER NOT NULL,
    "adjustment_movement_id" TEXT,
    "reason_code" "reason_code",
    "reason_note" TEXT,

    CONSTRAINT "stock_opname_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaction_corrections_idempotency_key_key" ON "transaction_corrections"("idempotency_key");

-- CreateIndex
CREATE INDEX "transaction_corrections_entity_type_entity_id_idx" ON "transaction_corrections"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "transaction_corrections_transaction_group_id_idx" ON "transaction_corrections"("transaction_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_cases_case_no_key" ON "reconciliation_cases"("case_no");

-- CreateIndex
CREATE INDEX "reconciliation_cases_source_entity_type_source_entity_id_idx" ON "reconciliation_cases"("source_entity_type", "source_entity_id");

-- CreateIndex
CREATE INDEX "reconciliation_cases_status_idx" ON "reconciliation_cases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_opnames_opname_no_key" ON "stock_opnames"("opname_no");

-- CreateIndex
CREATE INDEX "stock_opnames_location_type_booth_id_idx" ON "stock_opnames"("location_type", "booth_id");

-- CreateIndex
CREATE INDEX "stock_opnames_status_idx" ON "stock_opnames"("status");

-- CreateIndex
CREATE INDEX "stock_opnames_transaction_group_id_idx" ON "stock_opnames"("transaction_group_id");

-- CreateIndex
CREATE INDEX "stock_opname_items_product_id_idx" ON "stock_opname_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_opname_items_stock_opname_id_product_id_key" ON "stock_opname_items"("stock_opname_id", "product_id");

-- AddForeignKey
ALTER TABLE "transaction_corrections" ADD CONSTRAINT "transaction_corrections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_cases" ADD CONSTRAINT "reconciliation_cases_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opnames" ADD CONSTRAINT "stock_opnames_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opnames" ADD CONSTRAINT "stock_opnames_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_stock_opname_id_fkey" FOREIGN KEY ("stock_opname_id") REFERENCES "stock_opnames"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_opname_items" ADD CONSTRAINT "stock_opname_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
