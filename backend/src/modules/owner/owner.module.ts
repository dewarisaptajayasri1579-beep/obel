import { Module } from '@nestjs/common';
import { ReconciliationCasesModule } from '../reconciliation-cases/reconciliation-cases.module';
import { OwnerController } from './owner.controller';
import { OwnerService } from './owner.service';

@Module({
  imports: [ReconciliationCasesModule],
  controllers: [OwnerController],
  providers: [OwnerService],
})
export class OwnerModule {}
