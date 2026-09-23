import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WarehouseStockController } from './warehouse-stock.controller';
import { WarehouseStockGateway } from './warehouse-stock.gateway';
import { WarehouseStockService } from './warehouse-stock.service';

@Module({
  imports: [AuthModule],
  controllers: [WarehouseStockController],
  providers: [WarehouseStockService, WarehouseStockGateway],
})
export class WarehouseStockModule {}
