import { Module } from '@nestjs/common';
import { ReconciliationCasesModule } from '../reconciliation-cases/reconciliation-cases.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ReconciliationCasesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
