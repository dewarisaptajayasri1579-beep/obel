-- CreateTable
CREATE TABLE "staff_liabilities" (
    "id" TEXT NOT NULL,
    "distribution_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" BIGINT NOT NULL,
    "total_amount" BIGINT NOT NULL,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_liabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_liabilities_staff_id_idx" ON "staff_liabilities"("staff_id");

-- CreateIndex
CREATE INDEX "staff_liabilities_distribution_id_idx" ON "staff_liabilities"("distribution_id");

-- AddForeignKey
ALTER TABLE "staff_liabilities" ADD CONSTRAINT "staff_liabilities_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "stock_distributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_liabilities" ADD CONSTRAINT "staff_liabilities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_liabilities" ADD CONSTRAINT "staff_liabilities_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_liabilities" ADD CONSTRAINT "staff_liabilities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

