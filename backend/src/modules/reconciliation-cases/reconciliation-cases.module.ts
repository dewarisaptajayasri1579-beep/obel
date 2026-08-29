import { Module } from '@nestjs/common';
import { ReconciliationCasesController } from './reconciliation-cases.controller';
import { ReconciliationCasesService } from './reconciliation-cases.service';

@Module({
  controllers: [ReconciliationCasesController],
  providers: [ReconciliationCasesService],
  exports: [ReconciliationCasesService],
})
export class ReconciliationCasesModule {}
