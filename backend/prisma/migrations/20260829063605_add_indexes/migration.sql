-- CreateIndex
CREATE INDEX "booth_stocks_product_id_idx" ON "booth_stocks"("product_id");

-- CreateIndex
CREATE INDEX "payments_sale_id_idx" ON "payments"("sale_id");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_active_idx" ON "products"("active");

-- CreateIndex
CREATE INDEX "profiles_role_idx" ON "profiles"("role");

-- CreateIndex
CREATE INDEX "profiles_default_booth_id_idx" ON "profiles"("default_booth_id");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- CreateIndex
CREATE INDEX "sales_booth_id_created_at_idx" ON "sales"("booth_id", "created_at");

-- CreateIndex
CREATE INDEX "sales_shift_session_id_idx" ON "sales"("shift_session_id");

-- CreateIndex
CREATE INDEX "sales_staff_id_idx" ON "sales"("staff_id");

-- CreateIndex
CREATE INDEX "sales_status_idx" ON "sales"("status");

-- CreateIndex
CREATE INDEX "shift_sessions_staff_id_status_idx" ON "shift_sessions"("staff_id", "status");

-- CreateIndex
CREATE INDEX "shift_sessions_booth_id_status_idx" ON "shift_sessions"("booth_id", "status");

-- CreateIndex
CREATE INDEX "shift_sessions_business_date_idx" ON "shift_sessions"("business_date");

-- CreateIndex
CREATE INDEX "stock_distribution_items_product_id_idx" ON "stock_distribution_items"("product_id");

-- CreateIndex
CREATE INDEX "stock_distributions_booth_id_status_idx" ON "stock_distributions"("booth_id", "status");

-- CreateIndex
CREATE INDEX "stock_distributions_status_idx" ON "stock_distributions"("status");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_occurred_at_idx" ON "stock_movements"("product_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "stock_movements_shift_session_id_occurred_at_idx" ON "stock_movements"("shift_session_id", "occurred_at");

-- CreateIndex
CREATE INDEX "stock_movements_business_date_movement_type_idx" ON "stock_movements"("business_date", "movement_type");
