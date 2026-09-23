import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReconciliationCasesModule } from '../reconciliation-cases/reconciliation-cases.module';
import { BoothAktifGateway } from './booth-aktif.gateway';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ReconciliationCasesModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService, BoothAktifGateway],
})
export class DashboardModule {}
