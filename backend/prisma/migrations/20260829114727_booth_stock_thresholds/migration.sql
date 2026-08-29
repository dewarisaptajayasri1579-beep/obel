-- CreateTable
CREATE TABLE "booth_stock_thresholds" (
    "booth_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "minimum_qty" INTEGER NOT NULL DEFAULT 25,
    "critical_qty" INTEGER NOT NULL DEFAULT 10,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booth_stock_thresholds_pkey" PRIMARY KEY ("booth_id","product_id")
);

-- AddForeignKey
ALTER TABLE "booth_stock_thresholds" ADD CONSTRAINT "booth_stock_thresholds_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_stock_thresholds" ADD CONSTRAINT "booth_stock_thresholds_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
