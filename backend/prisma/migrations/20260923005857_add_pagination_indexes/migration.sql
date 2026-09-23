-- CreateIndex
CREATE INDEX "restock_requests_created_at_idx" ON "restock_requests"("created_at");

-- CreateIndex
CREATE INDEX "stock_distributions_created_at_idx" ON "stock_distributions"("created_at");

-- CreateIndex
CREATE INDEX "stock_receipts_created_at_idx" ON "stock_receipts"("created_at");

