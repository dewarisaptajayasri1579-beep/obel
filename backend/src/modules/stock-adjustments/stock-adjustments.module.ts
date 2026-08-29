import { Module } from '@nestjs/common';
import { CorrectionsModule } from '../corrections/corrections.module';
import { StockAdjustmentsController } from './stock-adjustments.controller';
import { StockAdjustmentsService } from './stock-adjustments.service';

@Module({
  imports: [CorrectionsModule],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
})
export class StockAdjustmentsModule {}
