-- CreateEnum
CREATE TYPE "restock_request_status" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "restock_requests" (
    "id" TEXT NOT NULL,
    "request_no" TEXT NOT NULL,
    "booth_id" TEXT NOT NULL,
    "status" "restock_request_status" NOT NULL DEFAULT 'REQUESTED',
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "distribution_id" TEXT,
    "reject_reason" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restock_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restock_request_items" (
    "id" TEXT NOT NULL,
    "restock_request_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_requested" INTEGER NOT NULL,

    CONSTRAINT "restock_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restock_requests_request_no_key" ON "restock_requests"("request_no");

-- CreateIndex
CREATE UNIQUE INDEX "restock_requests_distribution_id_key" ON "restock_requests"("distribution_id");

-- CreateIndex
CREATE INDEX "restock_requests_booth_id_status_idx" ON "restock_requests"("booth_id", "status");

-- CreateIndex
CREATE INDEX "restock_requests_status_idx" ON "restock_requests"("status");

-- CreateIndex
CREATE INDEX "restock_request_items_product_id_idx" ON "restock_request_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "restock_request_items_restock_request_id_product_id_key" ON "restock_request_items"("restock_request_id", "product_id");

-- AddForeignKey
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_requests" ADD CONSTRAINT "restock_requests_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "stock_distributions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_request_items" ADD CONSTRAINT "restock_request_items_restock_request_id_fkey" FOREIGN KEY ("restock_request_id") REFERENCES "restock_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restock_request_items" ADD CONSTRAINT "restock_request_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
