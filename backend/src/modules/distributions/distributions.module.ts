import { Module } from '@nestjs/common';
import { CorrectionsModule } from '../corrections/corrections.module';
import { ReconciliationCasesModule } from '../reconciliation-cases/reconciliation-cases.module';
import { DistributionsController } from './distributions.controller';
import { DistributionsService } from './distributions.service';

@Module({
  imports: [CorrectionsModule, ReconciliationCasesModule],
  controllers: [DistributionsController],
  providers: [DistributionsService],
  exports: [DistributionsService],
})
export class DistributionsModule {}
