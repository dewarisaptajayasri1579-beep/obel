import { Module } from '@nestjs/common';
import { BoothStockController } from './booth-stock.controller';
import { BoothStockService } from './booth-stock.service';

@Module({
  controllers: [BoothStockController],
  providers: [BoothStockService],
})
export class BoothStockModule {}
