import { Module } from '@nestjs/common';
import { DistributionsModule } from '../distributions/distributions.module';
import { RestockRequestsModule } from '../restock-requests/restock-requests.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { StockHandoversController } from './stock-handovers.controller';
import { StockHandoversService } from './stock-handovers.service';

@Module({
  imports: [DistributionsModule, RestockRequestsModule, ShiftsModule],
  controllers: [StockHandoversController],
  providers: [StockHandoversService],
  exports: [StockHandoversService],
})
export class StockHandoversModule {}
