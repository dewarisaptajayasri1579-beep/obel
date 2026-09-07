import { Module } from '@nestjs/common';
import { CorrectionsModule } from '../corrections/corrections.module';
import { ReconciliationCasesModule } from '../reconciliation-cases/reconciliation-cases.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [CorrectionsModule, ReconciliationCasesModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
