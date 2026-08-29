import { Module } from '@nestjs/common';
import { BoothStockThresholdsController } from './booth-stock-thresholds.controller';
import { BoothStockThresholdsService } from './booth-stock-thresholds.service';

@Module({
  controllers: [BoothStockThresholdsController],
  providers: [BoothStockThresholdsService],
  exports: [BoothStockThresholdsService],
})
export class BoothStockThresholdsModule {}
