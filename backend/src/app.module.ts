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
  ],
})
export class AppModule {}
