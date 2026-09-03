import { Module } from '@nestjs/common';
import { CorrectionsModule } from '../corrections/corrections.module';
import { ReconciliationCasesModule } from '../reconciliation-cases/reconciliation-cases.module';
import { StockOpnameController } from './stock-opname.controller';
import { StockOpnameService } from './stock-opname.service';

@Module({
  imports: [CorrectionsModule, ReconciliationCasesModule],
  controllers: [StockOpnameController],
  providers: [StockOpnameService],
})
export class StockOpnameModule {}
