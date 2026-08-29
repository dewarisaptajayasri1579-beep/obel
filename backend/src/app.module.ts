import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { SalesModule } from './modules/sales/sales.module';
import { BoothsModule } from './modules/booths/booths.module';
import { ProductsModule } from './modules/products/products.module';
import { UsersModule } from './modules/users/users.module';
import { WarehouseStockModule } from './modules/warehouse-stock/warehouse-stock.module';
import { DistributionsModule } from './modules/distributions/distributions.module';
import { RestockRequestsModule } from './modules/restock-requests/restock-requests.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { BoothStockModule } from './modules/booth-stock/booth-stock.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BoothStockThresholdsModule } from './modules/booth-stock-thresholds/booth-stock-thresholds.module';
import { ShiftTemplatesModule } from './modules/shift-templates/shift-templates.module';
import { StockOpnameModule } from './modules/stock-opname/stock-opname.module';
import { StockAdjustmentsModule } from './modules/stock-adjustments/stock-adjustments.module';
import { ReconciliationCasesModule } from './modules/reconciliation-cases/reconciliation-cases.module';
import { OwnerModule } from './modules/owner/owner.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CatalogModule,
    ShiftsModule,
    SalesModule,
    BoothsModule,
    ProductsModule,
    UsersModule,
    WarehouseStockModule,
    DistributionsModule,
    RestockRequestsModule,
    ReturnsModule,
    DashboardModule,
    BoothStockModule,
    ReportsModule,
    BoothStockThresholdsModule,
    ShiftTemplatesModule,
    StockOpnameModule,
    StockAdjustmentsModule,
    ReconciliationCasesModule,
    OwnerModule,
  ],
})
export class AppModule {}
