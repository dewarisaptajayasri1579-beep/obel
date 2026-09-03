import { Module } from '@nestjs/common';
import { CorrectionsModule } from '../corrections/corrections.module';
import { ReconciliationCasesModule } from '../reconciliation-cases/reconciliation-cases.module';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [CorrectionsModule, ReconciliationCasesModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
