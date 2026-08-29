import { Module } from '@nestjs/common';
import { WarehouseStockController } from './warehouse-stock.controller';
import { WarehouseStockService } from './warehouse-stock.service';

@Module({
  controllers: [WarehouseStockController],
  providers: [WarehouseStockService],
})
export class WarehouseStockModule {}
